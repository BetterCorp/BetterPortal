"""Scoped subscription checks over the public native delivery APIs."""
import asyncio
from contextlib import AsyncExitStack
import anyvali as av
from betterportal.sse import LocalEvents, SseRoute, EventScope, EventAddress, SubscriptionOverflow


async def probe():
    result = {}
    transport = LocalEvents(capacity=4, max_payload_bytes=1024)
    schema = av.string()
    route = SseRoute("view", schema, schema, lambda value, context: value + context, transport=transport)
    other = SseRoute("other", schema, schema, lambda value, context: value + context, transport=transport)
    scopes = [EventScope("tenant", "app"), EventScope("tenant", "other"), EventScope("other", "app")]
    try:
        async with AsyncExitStack() as stack:
            first = await stack.enter_async_context(route.subscribe(scopes[0], "-one"))
            second = await stack.enter_async_context(route.subscribe(scopes[0], "-two"))
            app = await stack.enter_async_context(route.subscribe(scopes[1], ""))
            tenant = await stack.enter_async_context(route.subscribe(scopes[2], ""))
            view = await stack.enter_async_context(other.subscribe(scopes[0], ""))
            await route.publish(scopes[0], "own")
            await route.publish(scopes[1], "app")
            await route.publish(scopes[2], "tenant")
            await other.publish(scopes[0], "view")
            for iterator, expected in [(first, "own-one"), (second, "own-two"), (app, "app"), (tenant, "tenant"), (view, "view")]:
                assert await asyncio.wait_for(iterator.__anext__(), 1) == expected
            result["scope-route-fanout"] = True
            for value in range(5):
                await route.publish(scopes[0], str(value))
            try:
                await first.__anext__()
                raise AssertionError("Overflow was not rejected")
            except SubscriptionOverflow:
                pass
            result["overflow"] = True
            await route.publish(scopes[1], "still-active")
            assert await app.__anext__() == "still-active"
            result["overflow-isolated"] = True
        async with route.subscribe(scopes[0], "") as fresh:
            await route.publish(scopes[0], "fresh")
            assert await fresh.__anext__() == "fresh"
        result["no-history"] = True
        async with route.subscribe(scopes[0], "") as idle:
            waiting = asyncio.create_task(idle.__anext__())
            await asyncio.sleep(0)
            waiting.cancel()
            try:
                await waiting
                raise AssertionError("Cancellation returned an event")
            except asyncio.CancelledError:
                pass
        result["idle-cancel"] = True
        try:
            await route.publish(scopes[0], 1)
            raise AssertionError("Invalid input accepted")
        except av.ValidationError:
            pass
        result["input-validation"] = True
        invalid = SseRoute("invalid", schema, schema, lambda value, context: 42, transport=transport)
        async with invalid.subscribe(scopes[0], None) as events:
            await invalid.publish(scopes[0], "value")
            try:
                await events.__anext__()
                raise AssertionError("Invalid event accepted")
            except av.ValidationError:
                pass
        result["event-validation"] = True
        for payload in (b"false", b'"unterminated', b'"\xff"'):
            async with route.subscribe(scopes[0], "") as events:
                await transport.publish(EventAddress("view", scopes[0]), payload)
                try:
                    await events.__anext__()
                    raise AssertionError("Corrupt transport payload accepted")
                except (av.ValidationError, ValueError):
                    pass
        result["transport-validation"] = True
        bounded = SseRoute("bounded", schema, schema, lambda value, context: value * 10, transport=transport, max_payload_bytes=16)
        async with bounded.subscribe(scopes[0], None) as events:
            await bounded.publish(scopes[0], "long")
            try:
                await events.__anext__()
                raise AssertionError("Oversized event accepted")
            except ValueError:
                pass
        try:
            await bounded.publish(scopes[0], "x" * 17)
            raise AssertionError("Oversized input accepted")
        except ValueError:
            pass
        result["payload-bounds"] = True
        def mutate(value, context):
            original = value["value"]
            value["value"] = context
            return original
        snapshot = SseRoute("snapshot", av.object_({"value": av.string()}), schema, mutate, transport=transport)
        async with snapshot.subscribe(scopes[0], "one") as first, snapshot.subscribe(scopes[0], "two") as second:
            value = {"value": "before"}
            await snapshot.publish(scopes[0], value)
            value["value"] = "after"
            assert await first.__anext__() == await second.__anext__() == "before"
        result["publication-snapshot"] = True
        started = asyncio.Event()
        async def pending(value, context):
            started.set()
            await asyncio.Event().wait()
            return value
        mapping = SseRoute("mapping", schema, schema, pending, transport=transport)
        async with mapping.subscribe(scopes[0], None) as events:
            await mapping.publish(scopes[0], "value")
            waiting = asyncio.create_task(events.__anext__())
            await asyncio.wait_for(started.wait(), 1)
            waiting.cancel()
            try:
                await asyncio.wait_for(waiting, 1)
                raise AssertionError("Mapper cancellation returned an event")
            except asyncio.CancelledError:
                pass
        result["mapper-cancel"] = True
        async with transport.subscribe(EventAddress("raw", scopes[0])) as idle:
            waiting = asyncio.create_task(idle.__anext__())
            await asyncio.sleep(0)
            await transport.aclose()
            try:
                await asyncio.wait_for(waiting, 1)
                raise AssertionError("Closed transport returned an event")
            except StopAsyncIteration:
                pass
        try:
            await route.publish(scopes[0], "closed")
            raise AssertionError("Closed transport accepted publish")
        except RuntimeError:
            pass
        result["shutdown"] = True
    finally:
        await transport.aclose()
    return result
