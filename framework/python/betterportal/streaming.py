"""Validated finite streams with pull backpressure and bounded buffered output."""
from __future__ import annotations

from contextlib import aclosing
from dataclasses import dataclass
import json
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Generic, TypeVar

import anyvali as av
from .contracts import export, object_document, parse
from .sse import encode_event

Item = TypeVar("Item")
SummaryValue = TypeVar("SummaryValue")
Context = TypeVar("Context")


@dataclass(frozen=True)
class Summary(Generic[SummaryValue]):
    value: SummaryValue


class StreamError(ValueError):
    status = 500


def _json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


class StreamHandler(Generic[Item, SummaryValue, Context]):
    def __init__(self, item_schema: av.BaseSchema[Item],
                 run: Callable[[Context], AsyncIterator[Item | Summary[SummaryValue]]],
                 summary_schema: av.BaseSchema[SummaryValue] | None = None, *, max_frame_bytes: int = 1024 * 1024):
        if max_frame_bytes < 1024:
            raise ValueError("Frame limit must be at least 1024 bytes")
        self.item_schema, self.summary_schema, self.run = item_schema, summary_schema, run
        self.max_frame_bytes = max_frame_bytes
        items = export(item_schema)
        items["root"] = {"kind": "array", "items": items["root"], "default": []}
        properties = {"items": items}
        if summary_schema is not None:
            summary = export(summary_schema)
            summary["root"] = {"kind": "optional", "inner": summary["root"]}
            properties["summary"] = summary
        self.response_schema = av.import_schema(object_document(properties))

    async def frames(self, context: Context) -> AsyncGenerator[dict[str, Any], None]:
        count, summarized = 0, False
        producer = self.run(context).__aiter__()
        failure = None
        try:
            try:
                async for value in producer:
                    if summarized:
                        raise StreamError("Stream produced a value after its summary")
                    if isinstance(value, Summary):
                        if self.summary_schema is None:
                            raise StreamError("Stream has no summary schema")
                        frame = {"kind": "summary", "data": self.summary_schema.parse(value.value)}
                        summarized = True
                    else:
                        frame = {"kind": "item", "data": self.item_schema.parse(value)}
                        count += 1
                    if len(_json(frame)) > self.max_frame_bytes:
                        raise StreamError("Stream frame exceeds its byte limit")
                    yield frame
            except av.ValidationError:
                failure = {"kind": "error", "error": "item_validation_failed", "message": "Stream payload validation failed"}
            except Exception:
                failure = {"kind": "error", "error": "stream_failed", "message": "Stream failed"}
        finally:
            close = getattr(producer, "aclose", None)
            if close is not None:
                try:
                    await close()
                except Exception:
                    failure = {"kind": "error", "error": "stream_failed", "message": "Stream failed"}
        # CancelledError and GeneratorExit propagate: neither produces a terminal frame.
        yield parse("StreamErrorFrameSchema", failure) if failure else parse("StreamEndFrameSchema", {"kind": "end", "count": count})

    async def buffered(self, context: Context, *, max_items: int = 10000, max_bytes: int = 8 * 1024 * 1024) -> dict[str, Any]:
        if max_items < 0 or max_bytes < 2:
            raise ValueError("Invalid buffer limits")
        result: dict[str, Any] = {"items": []}
        size = len(_json(result))
        async with aclosing(self.frames(context)) as frames:
            async for frame in frames:
                if frame["kind"] == "error":
                    raise StreamError(frame["message"])
                if frame["kind"] in ("item", "summary"):
                    if frame["kind"] == "item":
                        size += len(_json(frame["data"])) + (1 if result["items"] else 0)
                        result["items"].append(frame["data"])
                    else:
                        size += len(b',"summary":') + len(_json(frame["data"]))
                        result["summary"] = frame["data"]
                    if len(result["items"]) > max_items or size > max_bytes:
                        raise StreamError("Stream buffer exceeds its limit")
        if size > max_bytes:
            raise StreamError("Stream buffer exceeds its limit")
        return result

    async def ndjson(self, context: Context) -> AsyncGenerator[bytes, None]:
        async with aclosing(self.frames(context)) as frames:
            async for frame in frames:
                yield _json(frame) + b"\n"

    async def sse(self, context: Context) -> AsyncGenerator[bytes, None]:
        async with aclosing(self.frames(context)) as frames:
            async for frame in frames:
                yield encode_event(_json(frame).decode("utf-8"), event=frame["kind"], max_data_bytes=self.max_frame_bytes)
