"""Test-only wire adapter over the consumer stream primitive."""
import asyncio
from contextlib import aclosing
import json
import anyvali as av
from betterportal.streaming import StreamHandler, Summary, StreamError
from betterportal.contracts import contract


async def probe():
    results = {}
    produced, closed = [], []
    async def values(context):
        try:
            for index in range(3):
                produced.append(index)
                yield index
        finally:
            closed.append(True)
    handler = StreamHandler(contract("JsonValueSchema"), values)
    frames = handler.frames(None)
    assert (await frames.__anext__())["data"] == 0
    await asyncio.sleep(0.02)
    assert produced == [0]
    await frames.aclose()
    assert closed == [True]
    results["backpressure-close"] = True
    for buffered in (False, True):
        started, finished = asyncio.Event(), asyncio.Event()
        async def pending(context):
            try:
                yield 1
                started.set()
                await asyncio.Event().wait()
            finally:
                finished.set()
        stream = StreamHandler(contract("JsonValueSchema"), pending)
        seen = []
        async def consume():
            if buffered:
                return await stream.buffered(None)
            async for frame in stream.frames(None):
                seen.append(frame)
        task = asyncio.create_task(consume())
        await asyncio.wait_for(started.wait(), 1)
        task.cancel()
        try:
            await asyncio.wait_for(task, 1)
            raise AssertionError("Cancellation returned success")
        except asyncio.CancelledError:
            pass
        assert finished.is_set() and not any(frame["kind"] in ("end", "error") for frame in seen)
        results["cancel-buffered" if buffered else "cancel-producer"] = True
    recursive = StreamHandler(contract("JsonValueSchema"), values, contract("JsonValueSchema"))
    value = {"items": [{"a": [None, {"b": 1}]}], "summary": None}
    assert recursive.response_schema.parse(value) == value
    assert recursive.response_schema.parse({}) == {"items": []}
    assert not recursive.response_schema.safe_parse({"items": False}).success
    results["derived-recursive-schema"] = True
    return results


async def streaming(response, body):
    async def produce(context):
        for item in body.get("items", []):
            if body.get("delay"):
                await asyncio.sleep(body["delay"] / 1000)
            yield item
        if body.get("fail"):
            raise RuntimeError("private producer error")
        if "summary" in body:
            yield Summary(body["summary"])
        for item in body.get("afterSummary", []):
            yield item
    handler = StreamHandler(av.import_schema(body["itemSchema"]), produce,
                            av.import_schema(body["summarySchema"]) if "summarySchema" in body else None,
                            max_frame_bytes=body.get("maxFrameBytes", 1024 * 1024))
    if body.get("format") == "buffered":
        try:
            output = await handler.buffered(None, max_items=body.get("maxItems", 10000), max_bytes=body.get("maxBytes", 8 * 1024 * 1024))
            response.send_response(200)
        except StreamError:
            output = {"error": "Stream failed"}
            response.send_response(500)
        response.send_header("Content-Type", "application/json")
        response.end_headers()
        response.wfile.write(json.dumps(output).encode())
        return
    response.send_response(200)
    sse = body.get("format") == "sse"
    response.send_header("Content-Type", ("text/event-stream" if sse else "application/x-ndjson") + "; charset=utf-8")
    response.end_headers()
    async with aclosing(handler.sse(None) if sse else handler.ndjson(None)) as frames:
        async for frame in frames:
            response.wfile.write(frame)
            response.wfile.flush()
