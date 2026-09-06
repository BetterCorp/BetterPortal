"""Typed HTML callbacks and exact method-local renderer selection."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import inspect
import re
from typing import Any, Awaitable, Callable, Generic, Iterable, Mapping, TypeVar, cast
from urllib.parse import quote

from .contracts import parse
from .generated_types import RendererDeclaration, RendererDeclarationInput, ViewRenderData, ViewTenantContext, ViewAppContext, ViewRenderDataRequest, ViewRenderDataRoute
from .handler import RequestContext
from .media import NotAcceptable
from .urls import Urls

Result = TypeVar("Result")


@dataclass(frozen=True)
class RenderContext:
    data: ViewRenderData
    urls: Urls

    @property
    def tenant(self) -> ViewTenantContext: return self.data["tenant"]
    @property
    def app(self) -> ViewAppContext: return self.data["app"]
    @property
    def request(self) -> ViewRenderDataRequest: return self.data["request"]
    @property
    def route(self) -> ViewRenderDataRoute: return self.data["route"]

    @classmethod
    def create(cls, request: RequestContext, view_id: str, matched_path: str, renderer: str, mode: str, kind: str,
               key: str | None, status: int, params: Any, query: Any) -> RenderContext:
        route = {"viewId": view_id, "path": matched_path, "renderer": renderer, "mode": mode, "kind": kind, "status": status}
        if key is not None: route["key"] = key
        return cls(parse("ViewRenderDataSchema", {"tenant": request.scope.tenant, "app": request.scope.app,
            "request": {"method": request.method, "path": request.path, "params": params, "query": query}, "route": route}), request.urls)


class Renderer(Generic[Result]):
    def __init__(self, declaration: RendererDeclarationInput, render: Callable[[Result, RenderContext], str | Awaitable[str]]):
        self._declaration: RendererDeclaration = parse("RendererDeclarationSchema", declaration)
        if not callable(render): raise TypeError("A renderer function is required")
        kind, key = self._declaration["kind"], self._declaration.get("key")
        if kind == "page" and key is not None or kind != "page" and key is None:
            raise ValueError("Only fragment/component renderers require a key")
        if key is not None and not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+" if kind == "fragment" else r"[A-Za-z0-9_-]+", key):
            raise ValueError("Invalid renderer key")
        self._render = render

    @property
    def declaration(self) -> RendererDeclaration: return deepcopy(self._declaration)

    @property
    def identity(self) -> tuple[str, str, str | None, int]:
        return self._declaration["renderer"], self._declaration["kind"], self._declaration.get("key"), self._declaration["status"]

    async def render(self, data: Result, context: RenderContext) -> str:
        value = self._render(data, context)
        if inspect.isawaitable(value): value = await value
        if not isinstance(value, str): raise TypeError("Renderers must return HTML strings")
        return context.urls.rewrite(value)


def renderers(values: Iterable[Renderer[Result]]) -> tuple[Renderer[Result], ...]:
    result = tuple(values)
    if len({item.identity for item in result}) != len(result): raise ValueError("Duplicate renderer")
    return result


def select(values: Iterable[Renderer[Result]], renderer: str | None, kind: str, key: str | None, status: int = 200) -> Renderer[Result]:
    match = next((item for item in values if item.identity == (renderer, kind, key, status)), None)
    if match is None: raise NotAcceptable("Requested renderer is not available")
    return match


def html_metadata(values: Iterable[Renderer[Any]]) -> dict[str, Any]:
    groups: dict[str, list[Renderer[Any]]] = {}
    for item in values:
        if item.identity[3] == 200: groups.setdefault(item.identity[0], []).append(item)
    result = {}
    for renderer, entries in groups.items():
        variants: list[dict[str, Any]] = []
        modes = []
        for entry in entries:
            _, kind, key, _ = entry.identity
            if kind == "page":
                if "page" not in modes: modes.append("page")
                variants.append({"id": "default", "title": "Default Content", "slotId": "main", "renderModes": ["page", "fragment"]})
            elif kind == "fragment":
                if "fragment" not in modes: modes.append("fragment")
                variants.append({"id": key, "title": key, "slotId": key, "renderModes": ["fragment"]})
        result[renderer] = {"defaultRenderer": "default", "renderModes": modes, "slots": list(dict.fromkeys(item["slotId"] for item in variants)), "renderers": variants}
    return parse("HtmlRepresentationSupportSchema", {"renderers": result})


def content_type(mode: str, chrome: Mapping[str, Any] | None = None) -> str:
    result = "text/html; mode=" + parse("RenderModeSchema", mode)
    for name, value in parse("BetterPortalRouteChromeSchema", chrome or {}).items():
        key = re.sub(r"[_\s]+", "-", re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", name)).lower()
        if not re.fullmatch(r"[a-z][a-z0-9-]*", key): continue
        encoded = quote(value, safe="~()*!.'-") if isinstance(value, str) else str(value).lower()
        result += f"; bp-chrome-{key}={encoded}"
    return result + "; charset=utf-8"
