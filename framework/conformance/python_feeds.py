"""Deterministic publications through a replaceable transport and real hosted feeds."""
import asyncio
from contextlib import asynccontextmanager
import json
import anyvali as av
from betterportal.feeds import SseFeed
from betterportal.registry import Route, Registry
from betterportal.rendering import Renderer
from betterportal.sse import LocalEvents, SseRoute, EventAddress, EventScope


class FeedProbe:
    def __init__(self, body, started):
        self.body, self.started = body, started
        self.specs = {route["viewId"]: route["feed"] for route in body["routes"] if "feed" in route}
        self.feeds = {}; self.task = None; self.address = None
        self.subscribed = asyncio.Event(); self.mapped = asyncio.Semaphore(0)
        self.consumed = asyncio.Semaphore(0); self.overflowed = asyncio.Event()
        self.stats = {"active": 0, "closed": False, "mapped": 0, "inputErrors": 0, "cancelled": False}
        self.inner = LocalEvents(capacity=body.get("feedCapacity", 256))

    def bind(self, registry, render_function):
        if not self.specs: return registry
        def binding(route):
            if route.view_id not in self.specs: return route
            spec = self.specs[route.view_id]
            owner = next(operation.handler for operation in route.operations if operation.method == "GET")
            async def mapper(value, context):
                self.stats["mapped"] += 1; self.mapped.release()
                if self.body.get("feedOverflow"): await self.overflowed.wait()
                if spec.get("wait") and self.stats["mapped"] > spec.get("waitAfter", 0):
                    self.started.set()
                    try: await asyncio.sleep(30)
                    finally: self.stats["cancelled"] = True
                if spec.get("throw"): raise ValueError("private-mapper-secret")
                if spec.get("contextEvent"):
                    request = context.request_context
                    return {"params": context.params, "query": context.query, "tenantId": request.scope.tenant_id, "appId": request.scope.app_id,
                        "caller": request.caller.mode, "user": request.caller.user.get("sub") if request.caller.user else None}
                return spec["result"] if "result" in spec else value
            contract = SseRoute(route.view_id, av.import_schema(spec["inputSchema"]), av.import_schema(spec["eventSchema"]), mapper,
                transport=self, max_payload_bytes=spec.get("maxPayloadBytes", 1024 * 1024))
            feed = SseFeed(owner, contract, renderers=[Renderer(item["declaration"], render_function(item)) for item in spec.get("renderers", [])])
            self.feeds[route.view_id] = feed
            return Route(route.view_id, route.paths[0], route.operations, path_variants=route.paths[1:], sse=feed)
        return Registry([binding(route) for route in registry.routes], dependencies=registry.dependencies)

    async def publish(self, address, data): await self.inner.publish(address, data)
    async def aclose(self): await self.inner.aclose()
    @asynccontextmanager
    async def subscribe(self, address):
        async with self.inner.subscribe(address) as events:
            self.address = address; self.stats["active"] += 1; self.subscribed.set()
            if self.body.get("feedCancelStage") == "subscribe": self.started.set()
            async def observed():
                async for value in events:
                    self.consumed.release()
                    yield value
            try: yield observed()
            finally: self.stats["active"] -= 1; self.stats["closed"] = True

    async def deliver(self):
        await self.subscribed.wait()
        if self.body.get("feedCancelStage") == "subscribe": await asyncio.Event().wait()
        assert self.address is not None
        spec = self.specs[self.address.view_id]
        app = self.body["snapshot"]["apps"][0]
        try:
            for index, publication in enumerate(spec.get("publications", [])):
                address = EventAddress(publication.get("viewId", self.address.view_id), EventScope(publication.get("tenantId", app["tenantId"]), publication.get("appId", app["id"])))
                try:
                    if "raw" in publication: await self.inner.publish(address, publication["raw"].encode())
                    elif address.view_id != self.address.view_id:
                        await self.inner.publish(address, json.dumps(publication["value"]).encode())
                    else: await self.feeds[self.address.view_id].publish(address.scope, publication["value"])
                except av.ValidationError: self.stats["inputErrors"] += 1; continue
                if address == self.address:
                    if "raw" in publication: await self.consumed.acquire()
                    elif not self.body.get("feedOverflow") or index == 0: await self.mapped.acquire()
        finally:
            self.overflowed.set()
            await self.inner.aclose()

    async def __aenter__(self):
        if self.specs: self.task = asyncio.create_task(self.deliver())
        return self
    async def __aexit__(self, *args):
        if self.task is not None:
            self.task.cancel(); await asyncio.gather(self.task, return_exceptions=True)
        await self.inner.aclose()

    def result(self): return {"feed": self.stats} if self.specs else {}
