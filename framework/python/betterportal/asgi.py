"""Starlette hosting for the standalone BP runtime (install betterportal[asgi])."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import replace
from typing import Any, Coroutine, TypeVar
from urllib.parse import parse_qsl

from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.routing import Route as HttpRoute

from .contracts import parse
from .cors import CorsDenied
from .handler import HandlerInputError
from .jsoncodec import loads
from .media import NotAcceptable, negotiate
from .registry import Route, _segments
from .response import RawResponse
from .service import RequestError, Service

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


def _query(raw: bytes) -> dict[str, Any]:
    if len(raw) > 8192: raise RequestError(414, "Query string is too large")
    try:
        pairs = parse_qsl(raw.decode("utf-8"), keep_blank_values=True, max_num_fields=1000, encoding="utf-8", errors="strict")
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
            for name, value in parse_qsl(body.decode("utf-8"), keep_blank_values=True, max_num_fields=1000, encoding="utf-8", errors="strict"):
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


async def _connected(request: Request, work: Coroutine[Any, Any, _Output]) -> _Output:
    """The body is drained before watching receive, so the watcher cannot steal input."""
    async def disconnected():
        while (await request.receive())["type"] != "http.disconnect": pass
    task = asyncio.create_task(work); watcher = asyncio.create_task(disconnected())
    try:
        try:
            done, _ = await asyncio.wait((task, watcher), return_when=asyncio.FIRST_COMPLETED)
            if task not in done: raise asyncio.CancelledError
        finally:
            task.cancel(); watcher.cancel()
            await asyncio.gather(task, watcher, return_exceptions=True)
        return await task
    except BaseException:
        # A handler may catch cancellation and return an owned stream anyway.
        if task.done() and not task.cancelled() and task.exception() is None:
            result = task.result()
            if isinstance(result, _RawReply): await result.raw.aclose()
        raise


class _RawReply(Response):
    def __init__(self, raw: RawResponse, headers: dict[str, str], *, head: bool):
        self.raw = raw
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
                await _connected(Request(scope, receive), self.reply.stream_response(send))
            else: await self.reply(scope, receive, send)
        finally:
            close = getattr(getattr(self.reply, "body_iterator", None), "aclose", None)
            if close is not None: await close()
            await self.raw.aclose()


def create_app(service: Service, *, max_body_bytes: int = 1024 * 1024, mode: str = "service") -> Starlette:
    """One owned service lifetime. Configure trusted proxies in the ASGI server."""
    if max_body_bytes < 1 or mode not in ("service", "theme"): raise ValueError("Invalid hosting options")
    @asynccontextmanager
    async def lifespan(app):
        async with service: yield

    async def error(request: Request, exception: Exception) -> Response:
        status = exception.status_code if isinstance(exception, HTTPException) else 500
        return JSONResponse({"error": "Route not found" if status == 404 else "Method not allowed" if status == 405 else "Request failed"}, status_code=status,
                            headers=exception.headers if isinstance(exception, HTTPException) else None)

    def endpoint(operations: dict[str, tuple[Route, str]]):
        async def handle(request: Request) -> Response:
            response_headers = {"vary": "Origin"}
            async def execute(headers, query, body):
                nonlocal response_headers
                context, response_headers = await service.prepare(route, requested, request.url.path, headers, matched_path=matched,
                    fragment=fragment, scheme=request.url.scheme, mode=mode)
                operation = next(item for item in route.operations if item.method == requested)
                representation = None if operation.handler.is_raw else negotiate(headers.get("accept"), ("json", "metadata"))
                if representation is not None and representation.kind == "metadata":
                    return JSONResponse(service.metadata(route, operation, matched), headers=response_headers, media_type="application/vnd.betterportal.metadata+json")
                value, multipart = await _decode(request, body)
                context = replace(context, multipart=multipart)
                params = {part[1:]: request.path_params[f"_bp{index}"] for index, part in enumerate(_segments(matched)) if part.startswith(":")}
                output = await operation.invoke(context, {"params": params, "query": query, "headers": headers, "request": value})
                if operation.handler.is_raw: return _RawReply(output, response_headers, head=request.method == "HEAD")
                return JSONResponse(output, headers=response_headers)
            try:
                headers = _headers(request); query = _query(request.scope["query_string"])
                fragment = query.get("_f")
                if fragment is not None and not isinstance(fragment, str): raise RequestError(400, "Invalid fragment selector")
                requested = headers.get("access-control-request-method", "") if request.method == "OPTIONS" else "GET" if request.method == "HEAD" else request.method
                if requested not in operations: raise RequestError(403 if request.method == "OPTIONS" else 405, "Method not allowed")
                route, matched = operations[requested]
                if request.method == "OPTIONS":
                    response_headers = service.preflight(route, headers, matched_path=matched, fragment=fragment, scheme=request.url.scheme, mode=mode)
                    return Response(status_code=204, headers=response_headers)
                body = await _body(request, max_body_bytes)
                return await _connected(request, execute(headers, query, body))
            except RequestError as exception:
                return JSONResponse({"error": str(exception)}, status_code=exception.status, headers={**response_headers, **exception.headers})
            except CorsDenied:
                return JSONResponse({"error": "Origin or method is not allowed"}, status_code=403, headers={"vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"})
            except NotAcceptable:
                return JSONResponse({"error": "Representation not available"}, status_code=406, headers=response_headers)
            except HandlerInputError as exception:
                return JSONResponse({"error": "Invalid request " + exception.field}, status_code=400, headers=response_headers)
            except Exception:
                return JSONResponse({"error": "Request failed"}, status_code=500, headers=response_headers)
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
        return JSONResponse(service.schema(), headers=headers)

    paths = ["/.well-known/bp/health", "/.well-known/bp/manifest", "/.well-known/bp/schema.json"]
    routes = [HttpRoute(path, discovery, methods=["GET", "OPTIONS"]) for path in paths]
    entries = [(route, path) for route in service.registry.routes for path in route.paths]
    # Starlette matches in declaration order. Static segments precede parameter segments.
    entries.sort(key=lambda entry: tuple(part.startswith(":") for part in _segments(entry[1])))
    groups: dict[str, dict[str, tuple[Route, str]]] = {}
    for route, path in entries:
        if path in paths: raise ValueError("Route conflicts with BP discovery: " + path)
        pattern = "/" + "/".join("{_bp" + str(index) + "}" if part.startswith(":") else part for index, part in enumerate(_segments(path)))
        groups.setdefault(pattern, {}).update({item.method: (route, path) for item in route.operations})
    for pattern, operations in groups.items():
        routes.append(HttpRoute(pattern, endpoint(operations), methods=[*operations, "OPTIONS"]))
    app = Starlette(routes=routes, lifespan=lifespan, exception_handlers={HTTPException: error, Exception: error})
    app.router.redirect_slashes = False
    return app
