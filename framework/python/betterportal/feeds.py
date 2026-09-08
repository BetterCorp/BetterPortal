"""Bind scoped subscriber delivery to an existing typed GET handler."""
from __future__ import annotations

from typing import Any, Awaitable, Callable, Generic, Iterable, Mapping

from .handler import Params, Query, Headers, Body, Handler, HandlerContext, RequestContext
from .rendering import Renderer, RenderContext, renderers as unique_renderers, select
from .response import RawHandler, RawResponse
from .sse import Input, Event, SseRoute, EventScope


class SseFeed(Generic[Params, Query, Headers, Body, Input, Event]):
    def __init__(self, owner: Handler[Params, Query, Headers, Body, Any] | RawHandler[Params, Query, Headers, Body],
                 route: SseRoute[Input, Event, HandlerContext[Params, Query, Headers, Body]], *, renderers: Iterable[Renderer[Event]] = ()):
        self.owner, self.route = owner, route
        self.renderers = unique_renderers(renderers)
        for renderer in self.renderers:
            if renderer.identity[1] != "fragment" or renderer.identity[3] != 200:
                raise ValueError("SSE event renderers require a success fragment")
            if not any(value.identity == renderer.identity for value in owner.renderers):
                raise ValueError("An SSE event renderer requires its owning GET fragment")

    def open_stream(self, context: RequestContext, values: Mapping[str, Any], *, fragment: str | None = None,
                    render_context: Callable[[str, Any, Any], RenderContext]) -> RawResponse:
        prepared = self.owner.prepare(context, values)
        render: Callable[[Event], Awaitable[str]] | None = None
        if fragment is not None:
            theme = context.scope.app.get("shell", {}).get("renderer")
            renderer = select(self.renderers, theme, "fragment", fragment)
            presentation = render_context(renderer.identity[0], prepared.params, prepared.query)
            render = lambda value: renderer.render(value, presentation)
        return RawResponse(self.route.wire(EventScope(context.scope.tenant_id, context.scope.app_id), prepared, render=render),
            headers={"content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store"})

    async def publish(self, scope: EventScope, value: Input) -> Input:
        """Service code supplies the trusted publication scope; no event history is implied."""
        return await self.route.publish(scope, value)
