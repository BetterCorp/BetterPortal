"""Finite operation handlers reuse ordinary input policy and validated stream drivers."""
from __future__ import annotations

from contextlib import aclosing
from types import MappingProxyType
from typing import Any, AsyncIterator, Awaitable, Callable, Generic, Iterable, Mapping, cast
import anyvali as av

from .contracts import export, parse
from .generated_types import StreamErrorFrame, StreamShellContext
from .handler import Body, Handler, HandlerContext, Headers, Params, Query, RequestContext
from .rendering import Renderer, RenderContext
from .response import RawResponse
from .streaming import Item, StreamHandler, Summary, SummaryValue, _json
from .sse import encode_event


class StreamRenderers(Generic[Item, SummaryValue]):
    def __init__(self, renderer: str,
                 shell: Callable[[StreamShellContext, RenderContext], str | Awaitable[str]],
                 item: Callable[[Item, RenderContext], str | Awaitable[str]], *,
                 summary: Callable[[SummaryValue, RenderContext], str | Awaitable[str]] | None = None,
                 error: Callable[[StreamErrorFrame, RenderContext], str | Awaitable[str]] | None = None):
        self.shell = Renderer({"renderer": renderer}, shell)
        self.item = Renderer({"renderer": renderer}, item)
        self.summary = Renderer({"renderer": renderer}, summary) if summary is not None else None
        self.error = Renderer({"renderer": renderer}, error) if error is not None else None
        self.renderer = self.shell.identity[0]


class FiniteHandler(Handler[Params, Query, Headers, Body, dict[str, Any]], Generic[Params, Query, Headers, Body, Item, SummaryValue]):
    """One producer per consuming request; metadata and streamed HEAD never start it."""
    def __init__(self, item: av.BaseSchema[Item],
                 run: Callable[[HandlerContext[Params, Query, Headers, Body]], AsyncIterator[Item | Summary[SummaryValue]]], *,
                 summary: av.BaseSchema[SummaryValue] | None = None,
                 params: av.BaseSchema[Params] | None = None, query: av.BaseSchema[Query] | None = None,
                 headers: av.BaseSchema[Headers] | None = None, request: av.BaseSchema[Body] | None = None,
                 renderers: Iterable[Renderer[dict[str, Any]]] = (),
                 stream_renderers: Iterable[StreamRenderers[Item, SummaryValue]] = (),
                 max_frame_bytes: int = 1024 * 1024, max_items: int = 10000, max_bytes: int = 8 * 1024 * 1024):
        if max_items < 0 or max_bytes < 2: raise ValueError("Invalid buffer limits")
        self.stream = StreamHandler(item, run, summary, max_frame_bytes=max_frame_bytes)
        sets = tuple(stream_renderers)
        self.stream_renderers = MappingProxyType({value.renderer: value for value in sets})
        if len(self.stream_renderers) != len(sets): raise ValueError("Duplicate stream renderer")
        async def buffered(context: HandlerContext[Params, Query, Headers, Body]) -> dict[str, Any]:
            return await self.stream.buffered(context, max_items=max_items, max_bytes=max_bytes)
        super().__init__(self.stream.response_schema, buffered, params=params, query=query, headers=headers, request=request, renderers=renderers)

    def streaming_metadata(self) -> dict[str, Any]:
        return {"itemSchema": export(self.stream.item_schema),
                **({"summarySchema": export(self.stream.summary_schema)} if self.stream.summary_schema is not None else {})}

    def open_stream(self, context: RequestContext, values: Mapping[str, Any], *, sse: bool = False,
                    render_context: Callable[[str, Any, Any], RenderContext] | None = None) -> RawResponse:
        prepared = self.prepare(context, values)
        theme = context.scope.app.get("shell", {}).get("renderer")
        renderer = self.stream_renderers.get(theme) if theme is not None else None
        body = (self._rendered_sse(prepared, renderer, render_context(renderer.renderer, prepared.params, prepared.query))
                if sse and renderer is not None and render_context is not None else self.stream.sse(prepared) if sse else self.stream.ndjson(prepared))
        return RawResponse(body, headers={"content-type": "text/event-stream; charset=utf-8" if sse else "application/x-ndjson; charset=utf-8", "cache-control": "no-store"})

    async def shell(self, context: RequestContext, values: Mapping[str, Any], connection_path: str, mode: str,
                    render_context: Callable[[str, Any, Any], RenderContext]) -> str | None:
        theme = context.scope.app.get("shell", {}).get("renderer")
        renderer = self.stream_renderers.get(theme) if theme is not None else None
        if renderer is None or mode == "page" and any(value.identity == (theme, "page", None, 200) for value in self.renderers): return None
        prepared = self.prepare(context, values)
        data = parse("StreamShellContextSchema", {"sseConnectPath": connection_path, "params": prepared.params, "query": prepared.query})
        return await renderer.shell.render(data, render_context(renderer.renderer, prepared.params, prepared.query))

    async def _rendered_sse(self, prepared: HandlerContext[Params, Query, Headers, Body], renderer: StreamRenderers[Item, SummaryValue],
                            context: RenderContext) -> AsyncIterator[bytes]:
        async with aclosing(self.stream.frames(prepared)) as frames:
            async for frame in frames:
                kind = frame["kind"]
                try:
                    if kind == "item": data = await renderer.item.render(cast(Item, frame["data"]), context)
                    elif kind == "summary":
                        if renderer.summary is None: continue
                        data = await renderer.summary.render(cast(SummaryValue, frame["data"]), context)
                    elif kind == "end": data = ""
                    elif renderer.error is not None: data = await renderer.error.render(cast(StreamErrorFrame, frame), context)
                    else: data = _json(frame).decode("utf-8")
                    message = encode_event(data, event=kind, max_data_bytes=self.stream.max_frame_bytes)
                except Exception:
                    error = parse("StreamErrorFrameSchema", {"kind": "error", "error": "render_failed", "message": "Stream rendering failed"})
                    yield encode_event(_json(error).decode("utf-8"), event="error", max_data_bytes=self.stream.max_frame_bytes)
                    return
                yield message
