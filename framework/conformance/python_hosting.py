import asyncio
import base64
import httpx
import anyvali as av
from betterportal.asgi import create_app
from betterportal.context import ScopedConfig
from betterportal.handler import Handler
from betterportal.registry import Operation, Route, Registry
from betterportal.service import Service


async def hosting_request(body):
    invoked = 0; cancelled = False
    started = asyncio.Event()
    def function(spec):
        async def run(context):
            nonlocal invoked, cancelled
            invoked += 1
            if spec.get("throw"): raise ValueError("private-password-must-not-leak")
            if spec.get("wait"):
                started.set()
                try: await asyncio.sleep(30)
                finally: cancelled = True
            if "result" in spec: return spec["result"]
            request = context.request_context
            return {"params": context.params, "query": context.query, "request": context.request, "multipart": request.multipart,
                    "tenantId": request.scope.tenant_id, "appId": request.scope.app_id,
                    "caller": request.caller.mode, "user": request.caller.user.get("sub") if request.caller.user else None}
        return run
    registry = Registry([Route(item["viewId"], item["path"], [Operation(
        Handler(av.import_schema(spec["response"]), function(spec), **{key: av.import_schema(value) for key, value in spec.get("schemas", {}).items()}), spec["declaration"])
        for spec in item["operations"]], path_variants=item.get("pathVariants", [])) for item in body["routes"]])
    async with Service(registry, body["declaration"], ScopedConfig(body["snapshot"]) if body.get("snapshot") is not None else None) as service:
        app = create_app(service, max_body_bytes=body.get("maxBodyBytes", 1024 * 1024))
        if body.get("closed"): await service.aclose()
        request = body["request"]
        payload = base64.b64decode(request["bodyBase64"]) if "bodyBase64" in request else request.get("body", "").encode()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://service.test") as client:
            call = asyncio.create_task(client.request(request["method"], request["path"], headers=request.get("headers", {}), content=payload))
            try:
                if body.get("cancel"):
                    await asyncio.wait_for(started.wait(), timeout=3)
                    call.cancel()
                response = await asyncio.wait_for(call, timeout=8)
                return {"status": response.status_code, "headers": dict(response.headers), "body": response.text, "invoked": invoked}
            except asyncio.CancelledError:
                if not body.get("cancel"): raise
                return {"cancelled": cancelled, "invoked": invoked}
            finally:
                call.cancel()
                await asyncio.gather(call, return_exceptions=True)
