"""Operation registration and manifests derived from native AnyVali contracts."""
from __future__ import annotations

from copy import deepcopy
import re
from types import MappingProxyType
from typing import Any, Iterable, Mapping, cast

from .contracts import contract, export, parse
from .generated_types import OperationDeclarationInput, OperationDeclaration, ManifestDeclarationInput, PluginManifest, BpSchemaOutput, ViewRenderError
from .handler import Handler, RequestContext, Invocation
from .response import RawHandler, RawResponse
from .rendering import Renderer, RenderContext, html_metadata, content_type, renderers as unique_renderers


class Operation:
    def __init__(self, handler: Handler[Any, Any, Any, Any, Any] | RawHandler[Any, Any, Any, Any], declaration: OperationDeclarationInput, *, error_renderers: Iterable[Renderer[ViewRenderError]] = ()):
        self.handler = handler
        self._declaration = parse("OperationDeclarationSchema", declaration)
        self.error_renderers = unique_renderers(error_renderers)
        if any(item.identity[3] < 400 for item in self.error_renderers): raise ValueError("Error renderers require an error status")

    @property
    def declaration(self) -> OperationDeclaration:
        return cast(OperationDeclaration, deepcopy(self._declaration))

    @property
    def id(self) -> str: return self._declaration["operationId"]

    @property
    def method(self) -> str: return self._declaration["method"]

    async def invoke(self, context: RequestContext, values: Mapping[str, Any]) -> Any:
        return (await self.execute(context, values)).value

    async def execute(self, context: RequestContext, values: Mapping[str, Any]) -> Invocation[Any]:
        if context.method != self.method:
            raise ValueError("Operation method does not match the request context")
        return await self.handler.execute(context, values)

    async def render_error(self, context: RenderContext, message: str) -> RawResponse | None:
        route = context.route
        identity = (route["renderer"], route["kind"], route.get("key"), route["status"])
        renderer = next((item for item in self.error_renderers if item.identity == identity), None)
        if renderer is None and not any(item.identity[:3] == identity[:3] for item in self.handler.renderers): return None
        html = await renderer.render(parse("ViewRenderErrorSchema", {"error": message, "status": route["status"]}), context) if renderer is not None else ""
        mode = route["mode"] if route["kind"] == "page" else "fragment"
        return RawResponse(html.encode("utf-8"), status=route["status"], headers={"content-type": content_type(mode, self._declaration.get("chrome"))})

    def metadata(self, view_id: str, aliases: Mapping[str, str], plugin_id: str) -> dict[str, Any]:
        result = deepcopy(self._declaration)
        result.update({target: export(self.handler.schemas[source]) if source in self.handler.schemas else {}
                       for source, target in (("query", "querySchema"), ("headers", "headersSchema"), ("request", "bodySchema"))})
        html = html_metadata(self.handler.renderers)
        result.update(jsonResponseSchema=export(self.handler.response_schema) if self.handler.response_schema is not None else {}, metadataResponseSchema={}, renderable=bool(html["renderers"]), html=html)
        if self.handler.is_raw: result["raw"] = True
        result.setdefault("sitemap", {"kind": "default"})
        for dependency in result["dependencies"]:
            if "serviceId" in dependency:
                alias = dependency["serviceId"]
                if alias not in aliases:
                    raise ValueError("Unknown dependency alias: " + alias)
                if aliases[alias] == plugin_id: dependency.pop("serviceId")
                else: dependency["serviceId"] = aliases[alias]
        for descriptor in result["apiContracts"]:
            if not set(descriptor.get("modes", ["service"])).issubset(result["auth"]["callers"]):
                raise ValueError("API contract caller modes are not allowed by the operation")
            descriptor.update(viewId=view_id, methods=[self.method])
        for rule in result["robots"]:
            if not re.fullmatch(r"[A-Za-z0-9*._-]{1,100}", rule["userAgent"]):
                raise ValueError("Invalid robots user-agent token")
        return parse("ViewOperationMetadataSchema", result)


def _segments(path: str) -> tuple[str, ...]:
    if not path.startswith("/") or any(char in path for char in "?#\\%") or any(ord(char) < 33 for char in path):
        raise ValueError("Expected a root-relative route path")
    segments = tuple(path[1:].split("/")) if path != "/" else ()
    if any(not segment or segment in (".", "..") or any(char in segment for char in "[]{}") for segment in segments):
        raise ValueError("Invalid route segment")
    parameters = [segment[1:] for segment in segments if segment.startswith(":")]
    if any(not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) for name in parameters) or len(parameters) != len(set(parameters)):
        raise ValueError("Invalid or duplicate route parameter")
    if any(":" in segment and not segment.startswith(":") for segment in segments):
        raise ValueError("Parameters must occupy a complete route segment")
    return segments


class Route:
    def __init__(self, view_id: str, path: str, operations: Iterable[Operation], *, path_variants: Iterable[str] = ()):
        self.view_id = contract("ViewMetadataSchema", "viewId").parse(view_id)
        self.paths = tuple(sorted(set([path, *path_variants]), key=lambda value: (-sum(segment.startswith(":") for segment in _segments(value)), -len(value), value)))
        self.operations = tuple(operations)
        if not self.operations or len({operation.method for operation in self.operations}) != len(self.operations):
            raise ValueError("A route needs unique method operations")
        schemas = [export(operation.handler.schemas["params"]) if "params" in operation.handler.schemas else {} for operation in self.operations]
        if any(schema != schemas[0] for schema in schemas[1:]):
            raise ValueError("A view must publish one consistent params schema")

    @property
    def param_names(self) -> list[str]:
        return list(dict.fromkeys(segment[1:] for path in self.paths for segment in _segments(path) if segment.startswith(":")))


class Registry:
    def __init__(self, routes: Iterable[Route], *, dependencies: Mapping[str, str] | None = None):
        self.routes = tuple(routes)
        self.dependencies = MappingProxyType({alias: parse("PluginIdSchema", plugin) for alias, plugin in (dependencies or {}).items()})
        view_ids, operation_ids, paths = set(), set(), set()
        for route in self.routes:
            if route.view_id in view_ids: raise ValueError("Duplicate view ID: " + route.view_id)
            view_ids.add(route.view_id)
            for operation in route.operations:
                if operation.id in operation_ids: raise ValueError("Duplicate operation ID: " + operation.id)
                operation_ids.add(operation.id)
                for path in route.paths:
                    key = (operation.method, tuple(":" if part.startswith(":") else part for part in _segments(path)))
                    if key in paths: raise ValueError("Ambiguous route path: " + path)
                    paths.add(key)

    def manifest(self, declaration: ManifestDeclarationInput) -> PluginManifest:
        result = parse("ManifestDeclarationSchema", declaration)
        plugin_id = result["pluginId"]
        local = {(operation.id, operation.method) for route in self.routes for operation in route.operations}
        views, contracts = [], list(result["apiContracts"])
        for route in self.routes:
            operations = [operation.metadata(route.view_id, self.dependencies, plugin_id) for operation in route.operations]
            for operation in operations:
                for dependency in operation["dependencies"]:
                    if "serviceId" not in dependency and (dependency["operationId"], dependency["method"]) not in local:
                        raise ValueError("Unavailable local operation dependency")
                contracts.extend(operation["apiContracts"])
            primary = next((item for item in operations if item["method"] == "GET"), operations[0])
            schema = route.operations[0].handler.schemas.get("params")
            views.append({"viewId": route.view_id, "path": route.paths[0], "pathVariants": list(route.paths) if len(route.paths) > 1 else [],
                          "title": primary["title"], "description": primary["description"], "paramsSchema": export(schema) if schema is not None else {}, "operations": operations})
        capabilities = list(dict.fromkeys([*result["capabilities"], "view.json", "view.metadata"]))
        renderers, modes = [], []
        if "shell" in result:
            renderers.append(result["shell"]["renderer"])
            capabilities.append("renderer." + renderers[0])
        for route in self.routes:
            for registered in route.operations:
                for renderer in registered.handler.renderers:
                    theme, kind, _, status = renderer.identity
                    if status != 200: continue
                    renderers.append(theme); capabilities.append("renderer." + theme)
                    if kind == "page": modes.append("page")
                    if kind == "fragment": modes.append("fragment")
                    if kind in ("page", "component"): capabilities.append("view.html")
        if result["configSchemas"]:
            existing = {item["id"] for item in result["adminApis"]}
            for identifier, title, description, path, methods in (
                ("config.schema", "Config Schema", "BetterPortal-managed config schemas for this service.", "/.well-known/bp/config/schema", ["GET"]),
                ("config.values", "Config Values", "Read and write BetterPortal-managed config values.", "/.well-known/bp/config", ["GET", "POST"])):
                if identifier not in existing:
                    result["adminApis"].append({"id": identifier, "title": title, "description": description, "path": path, "methods": methods, "supportsCustomUi": False})
        result.update(protocolVersion=2, views=views, capabilities=list(dict.fromkeys(capabilities)), supportedRenderers=list(dict.fromkeys(renderers)), supportedRenderModes=list(dict.fromkeys(modes)), apiContracts=contracts)
        return cast(PluginManifest, parse("PluginManifestSchema", result))

    def schema(self, declaration: ManifestDeclarationInput) -> BpSchemaOutput:
        result = {"manifest": self.manifest(declaration), "routes": [
            {"viewId": route.view_id, "path": route.paths[0], "pathVariants": list(route.paths) if len(route.paths) > 1 else [],
             "operations": [{"operationId": operation.id, "method": operation.method} for operation in route.operations],
             "paramNames": route.param_names, **self._rendering(route)} for route in self.routes]}
        return cast(BpSchemaOutput, parse("BpSchemaOutputSchema", result))

    @staticmethod
    def _rendering(route: Route) -> dict[str, Any]:
        themes, components = [], []
        fragments: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for operation in route.operations:
            for renderer in operation.handler.renderers:
                theme, kind, key, status = renderer.identity
                if status != 200: continue
                themes.append(theme)
                if kind == "component": components.append(key)
                if kind == "fragment":
                    location, identifier = cast(str, key).split(".")
                    item = fragments.setdefault((location, identifier, operation.id, operation.method),
                        {"fragmentLocation": location, "fragmentId": identifier, "operationId": operation.id, "method": operation.method, "renderers": []})
                    item["renderers"].append(theme)
        return {"renderers": list(dict.fromkeys(themes)), "hasFragments": bool(fragments), "fragments": list(fragments.values()), "components": list(dict.fromkeys(components))}
