"""Exercise native typed handlers with an explicit test scope."""
import anyvali as av
import asyncio
from betterportal.handler import Handler, RequestContext, HandlerInputError, HandlerOutputError
from betterportal.context import ScopedConfig
from betterportal.authorization import AuthorizedCaller


async def invoke(body):
    called = False
    started, closed = asyncio.Event(), asyncio.Event()
    async def run(context):
        nonlocal called
        called = True
        if body.get("cancel"):
            try:
                started.set()
                await asyncio.Event().wait()
            finally:
                closed.set()
        return body["result"] if "result" in body else {name: getattr(context, name) for name in ("params", "query", "headers", "request")}
    handler = Handler(av.import_schema(body["response"]), run, **{key: av.import_schema(value) for key, value in body["schemas"].items()})
    scope = ScopedConfig(body["config"]).by_id(body["tenantId"], body["appId"])
    assert scope is not None
    context = RequestContext(scope, AuthorizedCaller(), "POST", "/check/item")
    if body.get("cancel"):
        task = asyncio.create_task(handler.invoke(context, body["values"]))
        await asyncio.wait_for(started.wait(), 2)
        task.cancel()
        try:
            await asyncio.wait_for(task, 2)
            raise AssertionError("Cancelled handler returned success")
        except asyncio.CancelledError:
            return {"cancelled": True, "closed": closed.is_set()}
    try:
        return {"status": 200, "output": await handler.invoke(context, body["values"]), "invoked": called}
    except HandlerInputError as error:
        return {"status": error.status, "field": error.field, "invoked": called}
    except HandlerOutputError as error:
        return {"status": error.status, "invoked": called}
