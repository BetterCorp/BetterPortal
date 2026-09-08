"""Starlette hosting for the standalone BP runtime (install betterportal[asgi])."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import replace
import re
from typing import Any, Coroutine, TypeVar, cast
from urllib.parse import parse_qsl, quote

from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route as HttpRoute

from .contracts import parse
from .authorization import AuthorizedCaller
from .generated_types import HttpMethod
from .cors import CorsDenied
from .handler import HandlerInputError, RequestContext
from .jsoncodec import loads
from .media import NotAcceptable, negotiate
from .registry import Route, _segments
from .response import RawResponse
from .rendering import RenderContext, content_type as html_content_type, select as select_renderer
from .service import RequestError, Service
from .sync import ControlPlaneSync
from .installation import ServiceInstallation
from .finite import FiniteHandler

_SINGLE = {"host", "origin", "referer", "authorization", "content-type", "content-length", "x-bp-service-id", "x-bp-tenant-id", "x-bp-app-id", "x-bp-service-authorization"}


def _headers(request: Request) -> dict[str, str]:
    result: dict[str, str] = {}
    if sum(len(key) + len(value) for key, value in request.headers.raw) > 65536:
        raise RequestError(431, "Request headers are too large")
    for raw_key, raw_value in request.headers.raw:
        key, value = raw_key.decode("ascii").lower(), raw_value.decode("latin-1")
        if any(char in value for char in "\r\n\0") or key in result and key in _SINGLE:
            raise RequestError(400, "Invalid or duplicate request header")
        result[key] = result[key] + ("; " if key == "cookie" else ", ") + value if key in result else value
    return result


def _append(values: dict[str, Any], key: str, value: Any) -> None:
    if key not in values: values[key] = value
    elif isinstance(values[key], list): values[key].append(value)
    else: values[key] = [values[key], value]


def _pairs(raw: bytes) -> list[tuple[str, str]]:
    if re.search(rb"%(?![0-9A-Fa-f]{2})", raw): raise ValueError("Invalid percent escape")
    return parse_qsl(raw.decode("utf-8"), keep_blank_values=True, max_num_fields=1000, encoding="utf-8", errors="strict")


def _query(raw: bytes) -> dict[str, Any]:
    if len(raw) > 8192: raise RequestError(414, "Query string is too large")
    try:
        pairs = _pairs(raw)
    except ValueError as error:
        raise RequestError(400, "Invalid query string") from error
    values: dict[str, Any] = {}
    for key, value in pairs: _append(values, key, value)
    return values


async def _body(request: Request, maximum: int) -> bytes:
    # A bounded read returns BP JSON errors on oversized requests.
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > maximum: raise RequestError(413, "Request body is too large")
        data.extend(chunk)
    return bytes(data)


async def _decode(request: Request, body: bytes) -> tuple[Any, Any]:
    if not body: return {}, None
    media = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if media == "application/json" or media.endswith("+json"):
        try: return loads(body.decode("utf-8")), None
        except (ValueError, UnicodeError, RecursionError) as error: raise RequestError(400, "Invalid JSON body") from error
    if media not in ("application/x-www-form-urlencoded", "multipart/form-data"):
        raise RequestError(415, "Unsupported request content type")
    if media == "application/x-www-form-urlencoded":
        fields: dict[str, Any] = {}
        try:
            for name, value in _pairs(body):
                _append(fields, name, value)
        except (ValueError, UnicodeError) as error: raise RequestError(400, "Invalid form body") from error
        return fields, parse("MultipartRequestSchema", {"fields": fields, "files": {}})
    async def replay(): return {"type": "http.request", "body": body, "more_body": False}
    buffered = Request(request.scope, replay)
    values: dict[str, Any] = {}; fields = {}; files: dict[str, Any] = {}
    try:
        async with buffered.form(max_files=100, max_fields=1000, max_part_size=1024 * 1024) as form:
            for name, item in form.multi_items():
                if isinstance(item, UploadFile):
                    content = await item.read()
                    _append(values, name, item.filename or "")
                    _append(files, name, {"fieldName": name, "filename": item.filename or "", "contentType": item.content_type or "application/octet-stream",
                                          "size": len(content), "data": list(content)})
                else:
                    _append(values, name, item); _append(fields, name, item)
    except HTTPException as error: raise RequestError(400, "Invalid form body") from error
    return values, parse("MultipartRequestSchema", {"fields": fields, "files": files})


_Output = TypeVar("_Output")


async def _connected(request: Request, work: Coroutine[Any, Any, _Output], service: Service | None = None) -> _Output:
    """The body is drained before watching receive, so the watcher cannot steal input."""
    async def disconnected():
        while (await request.receive())["type"] != "http.disconnect": pass
    task = asyncio.create_task(work)
    watchers = [asyncio.create_task(disconnected())]
    if service is not None: watchers.append(asyncio.create_task(service.wait_stopped()))
    try:
        try:
            done, _ = await asyncio.wait((task, *watchers), return_when=asyncio.FIRST_COMPLETED)
            if task not in done: raise asyncio.CancelledError
        finally:
            task.cancel()
            for watcher in watchers: watcher.cancel()
            await asyncio.gather(task, *watchers, return_exceptions=True)
        return await task
    except BaseException:
        # A handler may catch cancellation and return an owned stream anyway.
        if task.done() and not task.cancelled() and task.exception() is None:
            result = task.result()
            if isinstance(result, _RawReply): await result.raw.aclose()
        raise


class _RawReply(Response):
    def __init__(self, raw: RawResponse, headers: dict[str, str], *, head: bool, service: Service | None = None):
        self.raw, self.service = raw, service
        pairs = [(name.lower().encode("ascii"), value.encode("latin-1")) for name, value in raw.headers]
        for name, value in headers.items():
            if name.lower() == "vary":
                value = ", ".join([*(item.decode("latin-1") for key, item in pairs if key == b"vary"), value])
            pairs = [(key, item) for key, item in pairs if key != name.lower().encode("ascii")]
            pairs.append((name.lower().encode("ascii"), value.encode("latin-1")))
        if isinstance(raw.body, bytes) or head:
            self.reply = Response(b"" if head else raw.body, status_code=raw.status)
            if isinstance(raw.body, bytes) and raw.status not in (204, 304): pairs.append((b"content-length", str(len(raw.body)).encode("ascii")))
        else:
            async def chunks():
                async for chunk in raw.body:
                    if not isinstance(chunk, bytes): raise TypeError("Raw stream chunks must be bytes")
                    yield chunk
            self.reply = StreamingResponse(chunks(), status_code=raw.status)
        self.reply.raw_headers = pairs

    async def __call__(self, scope, receive, send):
        try:
            if isinstance(self.reply, StreamingResponse):
                # Watch receive for every ASGI version, including while a producer waits.
                await _connected(Request(scope, receive), self.reply.stream_response(send), self.service)
            else: await self.reply(scope, receive, send)
        finally:
            close = getattr(getattr(self.reply, "body_iterator", None), "aclose", None)
            if close is not None: await close()
            await self.raw.aclose()


def create_app(service: Service, *, max_body_bytes: int = 1024 * 1024, mode: str = "service", sync: ControlPlaneSync | None = None,
               installation: ServiceInstallation | None = None) -> Starlette:
    """One owned service lifetime. Configure trusted proxies in the ASGI server."""
    if max_body_bytes < 1 or mode not in ("service", "theme"): raise ValueError("Invalid hosting options")
    if sync is not None and sync.service is not service: raise ValueError("Sync belongs to a different service")
    if installation is not None and (installation.service is not service or sync is not None): raise ValueError("Installation must own this service's synchronization")
    control = installation or sync
    @asynccontextmanager
    async def lifespan(app):
        async with service:
            if control is None: yield
            else:
                async with control: yield

    async def error(request: Request, exception: Exception) -> Response:
        status = exception.status_code if isinstance(exception, HTTPException) else 500
        return JSONResponse({"error": "Route not found" if status == 404 else "Method not allowed" if status == 405 else "Request failed"}, status_code=status,
                            headers=exception.headers if isinstance(exception, HTTPException) else None)

    def endpoint(operations: dict[str, tuple[Route, str]], *, sse: bool = False):
        async def handle(request: Request) -> Response:
            response_headers = {"vary": "Origin, Accept"}
            failure_scope = None; operation = None; route = None; representation = None
            kind, key, matched = "page", None, ""
            query: dict[str, Any] = {}; params: dict[str, Any] = {}; headers: dict[str, str] = {}

            async def failure(status, message, scope=None):
                scope = scope or failure_scope
                theme = scope.app.get("shell", {}).get("renderer") if scope is not None else None
                if theme and operation is not None and route is not None and representation is not None and representation.kind == "html":
                    async def render():
                        context = RenderContext.create(RequestContext(scope, AuthorizedCaller(), cast(HttpMethod, requested), request.url.path,
                            url_context=service.urls(scope, request.url.path, headers, request.url.scheme)),
                            route.view_id, matched, theme, representation.mode or "page", kind, key, status, params, query)
                        value = await operation.render_error(context, message)
                        return _RawReply(value, response_headers, head=request.method == "HEAD", service=service) if value is not None else None
                    try:
                        rendered = await _connected(request, render(), service if service.ready else None)
                        if rendered is not None: return rendered
                    except Exception:
                        status, message = 500, "Request failed"
                return JSONResponse({"error": message}, status_code=status, headers=response_headers)

            async def execute(headers, query, body):
                nonlocal response_headers, failure_scope
                assert operation is not None and route is not None
                context, response_headers = await service.prepare(route, requested, request.url.path, headers, matched_path=matched,
                    fragment=fragment, scheme=request.url.scheme, mode=mode)
                failure_scope = context.scope
                if negotiation_error is not None: raise negotiation_error
                if representation is not None and representation.kind == "metadata":
                    return JSONResponse(service.metadata(route, operation, matched), headers=response_headers, media_type="application/vnd.betterportal.metadata+json")
                value, multipart = await _decode(request, body)
                context = replace(context, multipart=multipart)
                values = {"params": params, "query": query, "headers": headers, "request": value}
                def stream_context(theme, parsed_params, parsed_query):
                    return RenderContext.create(context, route.view_id, matched, theme, "fragment", "page", None, 200, parsed_params, parsed_query)
                if sse and route.sse is not None:
                    def event_context(theme, parsed_params, parsed_query):
                        path = request.url.path.removesuffix("/__sse") or "/"
                        presentation = replace(context, path=path, url_context=service.urls(context.scope, path, headers, request.url.scheme))
                        return RenderContext.create(presentation, route.view_id, matched, theme, "fragment", "fragment", fragment, 200, parsed_params, parsed_query)
                    return _RawReply(route.sse.open_stream(context, values, fragment=fragment, render_context=event_context), response_headers, head=request.method == "HEAD", service=service)
                if isinstance(operation.handler, FiniteHandler) and (sse or representation is not None and representation.kind == "ndjson"):
                    return _RawReply(operation.handler.open_stream(context, values, sse=sse, render_context=stream_context), response_headers, head=request.method == "HEAD", service=service)
                if isinstance(operation.handler, FiniteHandler) and requested == "GET" and kind == "page" and representation is not None and representation.kind == "html":
                    connection = quote(request.url.path.rstrip("/"), safe="/:@!$&'()*+,;=-._~") + "/__sse"
                    if request.scope["query_string"]: connection += "?" + quote(request.scope["query_string"].decode("utf-8"), safe="!$&'()*+,-./:;=?@_~%")
                    shell = await operation.handler.shell(context, values, connection, representation.mode or "page", stream_context)
                    if shell is not None:
                        return _RawReply(RawResponse(shell.encode("utf-8"), headers={"content-type": html_content_type("fragment", operation.declaration.get("chrome")), "cache-control": "no-store"}), response_headers, head=request.method == "HEAD", service=service)
                if representation is not None and representation.kind == "html":
                    theme = context.scope.app.get("shell", {}).get("renderer")
                    if not any(item.identity[:3] == (theme, kind, key) for item in operation.handler.renderers):
                        raise NotAcceptable("Requested renderer is not available")
                output = await operation.execute(context, values)
                if operation.handler.is_raw: return _RawReply(output.value, response_headers, head=request.method == "HEAD", service=service)
                status = context.response.status
                application_headers = [(name, value) for name, value in context.response.headers if name.lower() != "content-type"]
                if status in (204, 205, 304): return _RawReply(RawResponse(status=status, headers=application_headers), response_headers, head=request.method == "HEAD", service=service)
                if representation is not None and representation.kind == "html":
                    try: renderer = select_renderer(operation.handler.renderers, theme, kind, key, status)
                    except NotAcceptable:
                        if status == 200: raise
                        return _RawReply(RawResponse(status=status, headers=application_headers), response_headers, head=request.method == "HEAD", service=service)
                    render_context = RenderContext.create(context, route.view_id, matched, renderer.identity[0], representation.mode or "page", kind, key, status, output.params, output.query)
                    html = await renderer.render(output.value, render_context)
                    content_mode = "fragment" if kind != "page" else representation.mode or "page"
                    return _RawReply(RawResponse(html.encode("utf-8"), status=status, headers=[*application_headers, ("content-type", html_content_type(content_mode, operation.declaration.get("chrome")))]), response_headers, head=request.method == "HEAD", service=service)
                content = JSONResponse(output.value).body
                return _RawReply(RawResponse(content, status=status, headers=[*application_headers, ("content-type", "application/json")]), response_headers, head=request.method == "HEAD", service=service)
            try:
                headers = _headers(request); query = _query(request.scope["query_string"])
                fragment = query.get("_f")
                if fragment is not None and not isinstance(fragment, str): raise RequestError(400, "Invalid fragment selector")
                preflight = request.method == "OPTIONS" and "access-control-request-method" in headers
                requested = headers["access-control-request-method"] if preflight else "GET" if request.method == "HEAD" else request.method
                if requested not in operations: raise RequestError(403 if preflight else 405, "Method not allowed")
                route, matched = operations[requested]
                if sse and ("_c" in query or route.sse is None and "_f" in query): raise RequestError(400, "Stream connection does not support this selector")
                params = {part[1:]: request.path_params[f"_bp{index}"] for index, part in enumerate(_segments(matched)) if part.startswith(":")}
                if preflight:
                    response_headers = service.preflight(route, headers, matched_path=matched, fragment=fragment, scheme=request.url.scheme, mode=mode)
                    return Response(status_code=204, headers=response_headers)
                operation = next(item for item in route.operations if item.method == requested)
                representation = None; negotiation_error = None
                try:
                    if not operation.handler.is_raw and not sse:
                        offers = ["json", "metadata"]
                        if operation.handler.renderers or operation.error_renderers or isinstance(operation.handler, FiniteHandler) and operation.handler.stream_renderers: offers.append("html")
                        if isinstance(operation.handler, FiniteHandler): offers.append("ndjson")
                        representation = negotiate(headers.get("accept"), offers)
                except NotAcceptable as error: negotiation_error = error
                if representation is not None and representation.kind == "ndjson" and ("_f" in query or "_c" in query or representation.fragment is not None):
                    raise RequestError(400, "Stream connections do not accept renderer selectors")
                fragment = fragment if fragment is not None else representation.fragment if representation is not None else None
                component = query.get("_c")
                if component is not None and not isinstance(component, str) or fragment is not None and component is not None:
                    raise RequestError(400, "Invalid or ambiguous renderer selector")
                kind, key = ("fragment", fragment) if fragment is not None else ("component", component) if component is not None else ("page", None)
                query = {name: value for name, value in query.items() if name not in ("_f", "_c")}
                body = await _body(request, max_body_bytes)
                return await _connected(request, execute(headers, query, body), service if service.ready else None)
            except RequestError as exception:
                response_headers = {**response_headers, **exception.headers}
                return await failure(exception.status, str(exception), exception.scope)
            except CorsDenied:
                return JSONResponse({"error": "Origin or method is not allowed"}, status_code=403, headers={"vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"})
            except NotAcceptable:
                return await failure(406, "Representation not available")
            except HandlerInputError as exception:
                return await failure(400, "Invalid request " + exception.field)
            except Exception:
                return await failure(500, "Request failed")
        return handle

    async def discovery(request: Request) -> Response:
        path = request.url.path
        headers = {"access-control-allow-origin": "*", "cache-control": "no-store"}
        if request.method == "OPTIONS":
            if request.headers.get("access-control-request-method") not in ("GET", "HEAD"):
                return JSONResponse({"error": "Method not allowed"}, status_code=403, headers=headers)
            return Response(status_code=204, headers={**headers, "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "Accept"})
        if path == "/.well-known/bp/health": return JSONResponse({"ok": service.ready}, status_code=200 if service.ready else 503, headers=headers)
        if path == "/.well-known/bp/manifest": return JSONResponse(service.manifest, headers=headers)
        if path == "/.well-known/jwks.json" and installation is not None:
            try: return JSONResponse(installation.jwks(), headers=headers)
            except RuntimeError: return JSONResponse({"error": "Signing identity is not available"}, status_code=503, headers=headers)
        return JSONResponse(service.config_schema() if path == "/.well-known/bp/config/schema" else service.schema(), headers=headers)

    paths = ["/.well-known/bp/health", "/.well-known/bp/manifest", "/.well-known/bp/schema.json", "/.well-known/bp/config/schema"]
    if installation is not None: paths.append("/.well-known/jwks.json")
    routes = [HttpRoute(path, discovery, methods=["GET", "OPTIONS"]) for path in paths]
    if installation is not None:
        async def install_endpoint(request: Request) -> Response:
            response_headers = {"access-control-allow-origin": "*", "cache-control": "no-store"}
            assert installation is not None
            try:
                headers = _headers(request)
                if request.method == "OPTIONS":
                    return Response(status_code=204, headers={**response_headers, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Content-Type, Accept"})
                content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if content_type != "application/json" and not content_type.endswith("+json"): raise RequestError(415, "Installation requires JSON")
                body = await _body(request, max_body_bytes)
                try: value = loads(body.decode("utf-8"))
                except (ValueError, UnicodeError): raise RequestError(400, "Invalid JSON body") from None
                async def execute():
                    status, result = await (installation.change_hostname(value) if request.url.path.endswith("/hostname-change") else installation.install(value))
                    return JSONResponse(result, status_code=status, headers=response_headers)
                return await _connected(request, execute())
            except RequestError as error:
                return JSONResponse({"error": str(error), "installed": installation.installed}, status_code=error.status, headers=response_headers)
            except Exception:
                return JSONResponse({"error": "Installation failed", "installed": installation.installed}, status_code=500, headers=response_headers)
        for path in ("/.well-known/bp/install", "/.well-known/bp/hostname-change"):
            paths.append(path)
            routes.append(HttpRoute(path, install_endpoint, methods=["POST", "OPTIONS"]))
    async def config_endpoint(request: Request) -> Response:
        response_headers = {"vary": "Origin", "cache-control": "no-store"}
        try:
            headers = _headers(request)
            response_headers = service.config_headers(headers, preflight=request.method == "OPTIONS")
            if request.method == "OPTIONS": return Response(status_code=204, headers=response_headers)
            body = await _body(request, max_body_bytes)
            async def execute():
                value = None
                if request.method == "POST":
                    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
                    if content_type != "application/json" and not content_type.endswith("+json"):
                        raise RequestError(415, "Config writes require JSON")
                    try: value = loads(body.decode("utf-8"))
                    except (ValueError, UnicodeError) as error: raise RequestError(400, "Invalid JSON body") from error
                result = await service.config_request("config.write" if request.method == "POST" else "config.read", headers, value)
                return JSONResponse(result, headers=response_headers)
            return await _connected(request, execute())
        except RequestError as error: return JSONResponse({"error": str(error)}, status_code=error.status, headers={**response_headers, **error.headers})
        except CorsDenied: return JSONResponse({"error": "Origin or preflight is not allowed"}, status_code=403, headers=response_headers)
        except Exception: return JSONResponse({"error": "Request failed"}, status_code=500, headers=response_headers)
    paths.append("/.well-known/bp/config")
    routes.append(HttpRoute(paths[-1], config_endpoint, methods=["GET", "POST", "OPTIONS"]))
    entries = [(route, path) for route in service.registry.routes for path in route.paths]
    groups: dict[str, dict[str, tuple[Route, str]]] = {}
    for route, path in entries:
        if path in paths: raise ValueError("Route conflicts with BP discovery: " + path)
        pattern = "/" + "/".join("{_bp" + str(index) + "}" if part.startswith(":") else part for index, part in enumerate(_segments(path)))
        groups.setdefault(pattern, {}).update({item.method: (route, path) for item in route.operations})
    for pattern, operations in groups.items():
        routes.append(HttpRoute(pattern, endpoint(operations), methods=[*operations, "OPTIONS"]))
    for pattern, operations in groups.items():
        if "GET" in operations and (operations["GET"][0].sse is not None or isinstance(next(item for item in operations["GET"][0].operations if item.method == "GET").handler, FiniteHandler)):
            stream_path = pattern.rstrip("/") + "/__sse"
            if stream_path in groups: raise ValueError("Route conflicts with SSE: " + stream_path)
            routes.append(HttpRoute(stream_path, endpoint({"GET": operations["GET"]}, sse=True), methods=["GET", "OPTIONS"]))
    # Include generated SSE paths in Starlette's static-before-parameter ordering.
    routes.sort(key=lambda route: tuple(part.startswith("{") for part in route.path.split("/")))
    app = Starlette(routes=routes, lifespan=lifespan, exception_handlers={HTTPException: error, Exception: error})
    app.router.redirect_slashes = False
    return app
