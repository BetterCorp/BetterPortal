"""Discover explicit authoring factories in a route package; never invoke handlers."""
from __future__ import annotations

import importlib
import importlib.machinery
import importlib.util
import inspect
import os
from pathlib import Path
import re
import sys
from types import ModuleType
from typing import Any, Mapping

from .contracts import export, parse
from .feeds import SseFeed
from .registry import Operation, Registry, Route, _segments

_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")


def _paths(parts: tuple[str, ...]) -> tuple[list[str], str]:
    variants: list[list[str]] = [[]]
    identifiers = []
    for part in parts:
        optional = re.fullmatch(r"\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]", part)
        parameter = optional or re.fullmatch(r"\[([A-Za-z_][A-Za-z0-9_]*)\]", part)
        segment = ":" + parameter[1] if parameter else part
        if not parameter and ":" in part: raise ValueError("Filesystem parameters use [id] or [[id]]")
        variants = [value for path in variants for value in ([path, [*path, segment]] if optional else [[*path, segment]])]
        identifiers.append("$" + parameter[1] if parameter else part)
    paths = ["/" + "/".join(value) for value in variants]
    for path in paths: _segments(path)
    return paths, ".".join([*identifiers, "index"])


def _concrete(document: dict[str, Any]) -> None:
    # Walk schema children only: defaults, enum values and metadata are user data.
    def visit(node: dict[str, Any]) -> None:
        if node["kind"] in ("any", "unknown") or node.get("unknownKeys") == "allow":
            raise ValueError("Route schemas must be concrete and cannot allow unknown keys")
        kind = node["kind"]
        if kind == "object":
            for child in node["properties"].values(): visit(child)
        elif kind in ("optional", "nullable"): visit(node["inner"] if "inner" in node else node["schema"])
        elif kind == "array": visit(node["items"])
        elif kind == "record": visit(node["valueSchema"] if "valueSchema" in node else node["values"])
        elif kind in ("tuple", "union", "intersection"):
            children = node.get("items", node.get("elements", [])) if kind == "tuple" else node["variants" if kind == "union" else "allOf"]
            for child in children: visit(child)
    visit(document["root"])
    for definition in document.get("definitions", {}).values(): visit(definition)


def _create(module: ModuleType, *args: Any) -> Any:
    factory = getattr(module, "create", None)
    if not inspect.isfunction(factory) or inspect.iscoroutinefunction(factory) or inspect.isgeneratorfunction(factory) or inspect.isasyncgenfunction(factory):
        raise ValueError(module.__name__ + " must export a synchronous create factory")
    signature = inspect.signature(factory)
    if len(signature.parameters) != len(args) or any(parameter.kind not in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD) for parameter in signature.parameters.values()):
        raise ValueError(module.__name__ + " has an invalid route factory signature")
    signature.bind(*args)
    value = factory(*args)
    if inspect.isawaitable(value):
        if inspect.iscoroutine(value): value.close()
        raise ValueError(module.__name__ + " must return its declaration synchronously")
    return value


def _package(parent: ModuleType, directory: Path) -> ModuleType:
    # A dot in a URL segment is not a Python package separator. Other segment
    # names (including [id]) work with the standard module loader unchanged.
    if "." not in directory.name:
        module = importlib.import_module(parent.__name__ + "." + directory.name)
        if [Path(path).resolve() for path in getattr(module, "__path__", [])] != [directory]: raise ValueError("Conflicting route package: " + str(directory))
        return module
    name = parent.__name__ + ".__bp_route_" + directory.name.encode("utf-8").hex()
    if name in sys.modules:
        module = sys.modules[name]
        if list(getattr(module, "__path__", [])) != [str(directory)]: raise ValueError("Conflicting route package: " + str(directory))
        return module
    initializer = directory / "__init__.py"
    spec = importlib.util.spec_from_file_location(name, initializer, submodule_search_locations=[str(directory)]) if initializer.is_file() else importlib.machinery.ModuleSpec(name, loader=None, is_package=True)
    if spec is None: raise ValueError("Cannot load route package: " + str(directory))
    spec.submodule_search_locations = [str(directory)]
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        if spec.loader is not None: spec.loader.exec_module(module)
    except BaseException:
        del sys.modules[name]
        raise
    return module


def discover(package: str, *, dependencies: Mapping[str, str] | None = None) -> Registry:
    """Load index.py / METHOD.py / sse.py factories from one filesystem package.

    Index factories return RouteDeclarationInput. Methods return typed Operations,
    including their renderers. SSE create(owner, view_id) receives the actual GET
    handler. The returned Registry is shared by hosting and contract export.
    """
    root = importlib.import_module(package)
    locations = list(getattr(root, "__path__", []))
    if len(locations) != 1 or not Path(locations[0]).is_dir(): raise ValueError("Expected one filesystem route package")
    base = Path(locations[0]).resolve()
    packages = {base: root}
    routes = []
    for current, directories, filenames in os.walk(base):
        directories[:] = sorted(name for name in directories if name != "__pycache__" and not name.startswith("_renderer.") and (not name.startswith(".") or name == ".well-known"))
        directory = Path(current)
        recognized = {Path(name).stem for name in filenames if name.endswith(".py") and
                      (Path(name).stem.upper() in (*_METHODS, "HEAD", "INDEX", "SSE") or name.endswith(".sse.py"))}
        if not recognized: continue
        if "index" not in recognized: raise ValueError("Route modules require index.py: " + str(directory))
        if any(name not in (*_METHODS, "index", "sse") for name in recognized): raise ValueError("Use uppercase method files and one sse.py for GET")
        parts = directory.relative_to(base).parts
        paths, default_id = _paths(parts)
        current_path, module = base, root
        for part in parts:
            current_path = current_path / part
            if current_path not in packages: packages[current_path] = _package(module, current_path)
            module = packages[current_path]
        declaration = parse("RouteDeclarationSchema", _create(importlib.import_module(module.__name__ + ".index")))
        view_id = declaration.get("viewId", default_id)
        operations = []
        for method in _METHODS:
            if method not in recognized: continue
            operation = _create(importlib.import_module(module.__name__ + "." + method))
            if not isinstance(operation, Operation) or operation.method != method: raise ValueError("Method factory must return a matching Operation: " + method)
            for schema in operation.handler.schemas.values(): _concrete(export(schema))
            if operation.handler.response_schema is not None: _concrete(export(operation.handler.response_schema))
            operations.append(operation)
        feed = None
        if "sse" in recognized:
            owner = next((operation.handler for operation in operations if operation.method == "GET"), None)
            if owner is None: raise ValueError("SSE requires a GET operation")
            feed = _create(importlib.import_module(module.__name__ + ".sse"), owner, view_id)
            if not isinstance(feed, SseFeed): raise ValueError("SSE factory must return SseFeed")
            _concrete(export(feed.route.input_schema)); _concrete(export(feed.route.event_schema))
        routes.append(Route(view_id, paths[0], operations, path_variants=paths[1:], sse=feed,
                            title=declaration.get("title"), description=declaration.get("description")))
    if not routes: raise ValueError("No route factories found in " + package)
    return Registry(routes, dependencies=dependencies)
