import asyncio
import base64
import httpx
import anyvali as av
import html
import json
from urllib.parse import urlsplit
from betterportal.asgi import create_app
from betterportal.context import ScopedConfig
from betterportal.handler import Handler
from betterportal.finite import FiniteHandler, StreamRenderers
from betterportal.streaming import Summary
from betterportal.response import RawHandler, RawResponse
from betterportal.rendering import Renderer
from betterportal.registry import Operation, Route, Registry
from betterportal.service import Service
from python_feeds import FeedProbe


def url_calls(context, calls):
    values = []
    for call in calls:
        try:
            urls, options = context.urls, call.get("options", {})
            if call["kind"] == "route": value = urls.route(call["viewId"], options)
            elif call["kind"] == "uiRoute": value = urls.ui_route(call["viewId"], options)
            elif call["kind"] == "path": value = urls.path(call["path"], options)
            elif call["kind"] == "current": value = urls.current(options)
            elif call["kind"] == "currentUi": value = urls.current_ui(options)
            elif call["kind"] == "element": value = urls.element(call["reference"])
            else: value = getattr(urls, call["kind"])(call["url"], options)
            values.append(value)
        except (ValueError, TypeError, av.ValidationError): values.append({"invalid": True})
    return values


async def hosting_request(body):
    invoked = 0; cancelled = False
    started = asyncio.Event()
    feeds = FeedProbe(body, started)
    stream = {"reads": 0, "closed": False}
    class RawBody:
        def __init__(self, spec): self.spec, self.index = spec, 0
        def __aiter__(self): return self
        async def __anext__(self):
            nonlocal cancelled
            if self.index >= len(self.spec["chunks"]): raise StopAsyncIteration
            stream["reads"] += 1
            if self.index == 1 and self.spec.get("wait"):
                started.set()
                try: await asyncio.sleep(30)
                finally: cancelled = True
            if self.index == 1 and self.spec.get("throw"): raise ValueError("private-stream-secret")
            value = base64.b64decode(self.spec["chunks"][self.index]); self.index += 1
            return value
        async def aclose(self): stream["closed"] = True
    def function(spec):
        async def run(context):
            nonlocal invoked, cancelled
            invoked += 1
            if "status" in spec: context.response.status = spec["status"]
            for name, value in spec.get("responseHeaders", []): context.response.set_header(name, value, append=True)
            if spec.get("throw"): raise ValueError("private-password-must-not-leak")
            if "urlCalls" in spec: return url_calls(context, spec["urlCalls"])
            if spec.get("wait"):
                started.set()
                try: await asyncio.sleep(30)
                except asyncio.CancelledError:
                    if not spec.get("returnOnCancel"): raise
                finally: cancelled = True
            if "result" in spec: return spec["result"]
            if "raw" in spec:
                raw = spec["raw"]
                value = RawBody(raw) if "chunks" in raw else base64.b64decode(raw.get("body", ""))
                if "filename" in raw: return RawResponse.file(value, raw["filename"], content_type=raw.get("contentType", "application/octet-stream"), inline=raw.get("inline", False))
                return RawResponse(value, status=raw.get("status", 200), headers=raw.get("headers", []))
            request = context.request_context
            return {"params": context.params, "query": context.query, "request": context.request, "multipart": request.multipart,
                    "tenantId": request.scope.tenant_id, "appId": request.scope.app_id,
                    "caller": request.caller.mode, "user": request.caller.user.get("sub") if request.caller.user else None}
        return run
    def render_function(item):
        async def render(data, context):
            nonlocal cancelled
            if item.get("wait"):
                started.set()
                try: await asyncio.sleep(30)
                finally: cancelled = True
            if item.get("throw") or "throwOn" in item and item["throwOn"] == data: raise ValueError("private-render-secret")
            if "text" in item: return item["text"]
            value = url_calls(context, item["urlCalls"]) if "urlCalls" in item else data if item.get("dataOnly") else {"data": data, "context": context.data}
            return "<pre>" + html.escape(json.dumps(value)) + "</pre>"
        return render
    def renderer(item): return Renderer(item["declaration"], render_function(item))
    def handler(spec):
        schemas = {key: av.import_schema(value) for key, value in spec.get("schemas", {}).items()}
        renderers = [renderer(item) for item in spec.get("renderers", [])]
        if "finite" in spec:
            finite = spec["finite"]
            async def produce(context):
                nonlocal invoked, cancelled
                invoked += 1
                try:
                    for index, value in enumerate(finite.get("items", [])):
                        stream["reads"] += 1
                        if finite.get("wait") and index == 1:
                            started.set()
                            try: await asyncio.sleep(30)
                            finally: cancelled = True
                        yield value
                    if finite.get("contextItem"):
                        # Reuse the ordinary author callback, counting this as one producer.
                        invoked -= 1; yield await function(spec)(context)
                    if finite.get("fail"): raise ValueError("private-stream-secret")
                    if "summary" in finite: yield Summary(finite["summary"])
                    for value in finite.get("afterSummary", []): yield value
                finally: stream["closed"] = True
            return FiniteHandler(av.import_schema(finite["itemSchema"]), produce,
                summary=av.import_schema(finite["summarySchema"]) if "summarySchema" in finite else None,
                renderers=renderers, stream_renderers=[StreamRenderers(item["renderer"], render_function(item["shell"]), render_function(item["item"]),
                    summary=render_function(item["summary"]) if "summary" in item else None, error=render_function(item["error"]) if "error" in item else None)
                    for item in spec.get("streamRenderers", [])], **schemas,
                **{target: finite[source] for source, target in (("maxFrameBytes", "max_frame_bytes"), ("maxItems", "max_items"), ("maxBytes", "max_bytes")) if source in finite})
        return RawHandler(function(spec), **schemas) if "raw" in spec and not spec.get("jsonHandler") else Handler(av.import_schema(spec["response"]), function(spec), renderers=renderers, **schemas)
    registry = Registry([Route(item["viewId"], item["path"], [Operation(handler(spec), spec["declaration"], error_renderers=[renderer(item) for item in spec.get("errorRenderers", [])])
        for spec in item["operations"]], path_variants=item.get("pathVariants", [])) for item in body["routes"]], dependencies=body.get("dependencies"))
    registry = feeds.bind(registry, render_function)
    async with Service(registry, body["declaration"], ScopedConfig(body["snapshot"]) if body.get("snapshot") is not None else None) as service, feeds:
        app = create_app(service, max_body_bytes=body.get("maxBodyBytes", 1024 * 1024))
        if body.get("feedHostShutdown"):
            lifespan = app.router.lifespan_context(app)
            await lifespan.__aenter__()
        if body.get("closed"): await service.aclose()
        request = body["request"]
        payload = base64.b64decode(request["bodyBase64"]) if "bodyBase64" in request else request.get("body", "").encode()
        if body.get("rawOutputProbe"):
            first = asyncio.Event(); release = asyncio.Event(); disconnected = asyncio.Event()
            delivered = []; drained = False
            async def receive():
                nonlocal drained
                if not drained: drained = True; return {"type": "http.request", "body": payload, "more_body": False}
                await disconnected.wait(); return {"type": "http.disconnect"}
            async def send(message):
                if message["type"] == "http.response.body" and message.get("body"):
                    delivered.append(message["body"])
                    if len(delivered) == 1:
                        first.set()
                        if body["rawOutputProbe"] == "backpressure": await release.wait()
            url = urlsplit("http://service.test" + request["path"])
            scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"}, "http_version": "1.1", "method": request["method"],
                "scheme": "http", "path": url.path, "raw_path": url.path.encode(), "query_string": url.query.encode(), "root_path": "",
                "headers": [(key.lower().encode(), value.encode()) for key, value in request["headers"].items()], "server": ("service.test", 80)}
            task = asyncio.create_task(app(scope, receive, send))
            try:
                await asyncio.wait_for(first.wait(), 3)
                observed = feeds.stats["mapped"] if feeds.specs else stream["reads"]
                if body["rawOutputProbe"] == "disconnect":
                    await asyncio.wait_for(started.wait(), 3); disconnected.set()
                else: release.set()
                try: await asyncio.wait_for(task, 3)
                except asyncio.CancelledError:
                    if body["rawOutputProbe"] != "disconnect": raise
                return {"observed": observed, "stream": stream, "cancelled": cancelled, "invoked": invoked, **feeds.result()}
            finally:
                task.cancel(); await asyncio.gather(task, return_exceptions=True)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://service.test") as client:
            call = asyncio.create_task(client.request(request["method"], request["path"], headers=request.get("headers", {}), content=payload))
            try:
                if body.get("feedShutdown"):
                    await asyncio.wait_for(started.wait(), 3)
                    if body.get("feedHostShutdown"): await lifespan.__aexit__(None, None, None)
                    else: await service.aclose()
                    try: await asyncio.wait_for(asyncio.shield(call), 1)
                    except asyncio.TimeoutError: return {"shutdown": False, "invoked": invoked, **feeds.result()}
                    except asyncio.CancelledError: pass
                    await feeds.inner.publish(feeds.address, b"null")
                    return {"shutdown": True, "transportOpen": True, "invoked": invoked, **feeds.result()}
                if body.get("cancel"):
                    await asyncio.wait_for(started.wait(), timeout=3)
                    call.cancel()
                response = await asyncio.wait_for(call, timeout=8)
                return {"status": response.status_code, "headers": dict(response.headers), "body": response.text, "bodyBase64": base64.b64encode(response.content).decode(),
                        "cookies": response.headers.get_list("set-cookie"), "stream": stream, "invoked": invoked, **feeds.result()}
            except asyncio.CancelledError:
                if not body.get("cancel"): raise
                return {"cancelled": cancelled, "invoked": invoked, **({"stream": stream} if body.get("rawProbe") else {}), **feeds.result()}
            except Exception:
                if not body.get("rawProbe"): raise
                return {"transportError": True, "stream": stream, "invoked": invoked, **feeds.result()}
            finally:
                call.cancel()
                await asyncio.gather(call, return_exceptions=True)
