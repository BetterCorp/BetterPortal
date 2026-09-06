"""Scoped service requests, mounted page links and HTML attribute helpers."""
from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
import re
from typing import Any, Iterable, Mapping, TYPE_CHECKING, cast
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit

from .context import ScopedContext, http_origin, _origins
from .contracts import parse
from .generated_types import BPElementReferenceInput, ResolvedBPElementReference, RouteUrlOptionsInput, RouteUiOptionsInput
if TYPE_CHECKING:
    from .registry import Registry


def _scalar(value: Any) -> str:
    if isinstance(value, str): return value
    if isinstance(value, bool): return str(value).lower()
    number = float(value)
    if number == 0: return "0"
    text = repr(number).lower()
    if 1e-6 <= abs(number) < 1e21:
        fixed = format(Decimal(text), "f")
        return fixed.rstrip("0").rstrip(".") if "." in fixed else fixed
    mantissa, exponent = text.split("e")
    return mantissa.removesuffix(".0") + "e" + ("+" if int(exponent) >= 0 else "-") + str(abs(int(exponent)))


def _origin(value: str) -> str:
    return http_origin(value if "://" in value else "https://" + value)


def _path(value: str) -> str:
    if not value.startswith("/") or value.startswith("//") or "\\" in value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Expected a root-relative URL")
    if re.search(r"%(?![0-9A-Fa-f]{2})", value): raise ValueError("Invalid URL escape")
    path = urlsplit(value).path
    if any(unquote(part).lower() in (".", "..") for part in path.split("/")):
        raise ValueError("URL must not traverse path segments")
    return quote(path, safe="/!$&'()*+,-.:;=@_%~")


def _fill(path: str, params: Mapping[str, Any]) -> str | None:
    parts = []
    for part in path.split("?")[0].split("/"):
        if part.startswith(":"):
            value = params.get(part[1:])
            if value is None: return None
            part = quote(_scalar(value), safe="~()*!.'-")
        parts.append(part)
    value = "/".join(parts) + ("?" + path.split("?", 1)[1] if "?" in path else "")
    try: _path(value)
    except ValueError: return None
    return value


def _render(path: str, options: Mapping[str, Any]) -> str:
    encoded = _path(path); parts = urlsplit(path)
    if options.get("sse"): encoded = encoded.rstrip("/") + "/__sse"
    changes = dict(options.get("query", {}))
    if options.get("component") and options.get("fragment"): raise ValueError("Ambiguous renderer selector")
    if options.get("component"): changes["_c"] = options["component"]
    if options.get("fragment"): changes["_f"] = options["fragment"]
    query = quote(parts.query, safe="!$&()*+,-./:;=?@[]^_`{|}~%")
    if any(value is not None for value in changes.values()):
        pairs = parse_qsl(query, keep_blank_values=True, encoding="utf-8", errors="strict")
        for name, value in changes.items():
            if value is None: continue
            index = next((index for index, pair in enumerate(pairs) if pair[0] == name), len(pairs))
            pairs = [pair for pair in pairs if pair[0] != name]
            pairs.insert(index, (name, _scalar(value)))
        query = urlencode(pairs, safe="*").replace("~", "%7E")
    result = encoded + ("?" + query if query else "")
    if options.get("absolute") and options.get("origin"):
        result = _origin(options["origin"]) + result + ("#" + quote(parts.fragment, safe="/?:@!$&'()*+,;=-._~%") if parts.fragment else "")
    return result


class Urls:
    def __init__(self, scope: ScopedContext, registry: Registry | None, service_id: str | None, path: str, *, app_origins: Iterable[str] = ()):
        # Only navigation data is retained; renderer helpers do not retain credentials/config.
        self._services = []
        for service in scope.tenant["services"]:
            if not scope.tenant["active"] or not service["enabled"]: continue
            try: origin = http_origin(service["hostname"], allow_path=True)
            except ValueError: continue
            self._services.append({**{key: service[key] for key in ("id", "serviceId") if key in service}, "hostname": origin})
        self._mounts = deepcopy(scope.app.get("appRoutes", scope.app["routes"]))
        self._shell = deepcopy(scope.app.get("shell", {}))
        self._hosts = tuple(scope.app["hostnames"])
        self._aliases = dict(registry.dependencies) if registry is not None else {}
        self._routes = {route.view_id: route.paths for route in registry.routes} if registry is not None else {}
        self._service_id, self._path = service_id, path
        self._app_origin = None
        allowed = {origin for host in self._hosts for origin in _origins(host)}
        for candidate in app_origins:
            try:
                origin = http_origin(candidate, allow_path=True)
                if origin in allowed: self._app_origin = origin; break
            except ValueError: pass

    def _ids(self, reference: str | None) -> set[str]:
        reference = self._aliases.get(reference, reference) if reference is not None else None
        return {item["id"] for item in self._services if reference in (item["id"], item.get("serviceId"))} if reference else set()

    def _service_origin(self, reference: str, override: str | None = None) -> str | None:
        ids = self._ids(reference)
        if not ids: return None
        try:
            origins = {item["hostname"] for item in self._services if item["id"] in ids}
            return _origin(override) if override else next(iter(origins)) if len(origins) == 1 else None
        except ValueError: return None

    def current(self, options: RouteUrlOptionsInput | None = None) -> str: return self.path(self._path, options)

    @staticmethod
    def path(path: str, options: RouteUrlOptionsInput | None = None) -> str:
        return _render(path, parse("RouteUrlOptionsSchema", options or {}))

    def route(self, view_id: str, options: RouteUrlOptionsInput | None = None) -> str | None:
        opts = parse("RouteUrlOptionsSchema", options or {})
        target = opts.get("serviceId", self._service_id)
        ids = self._ids(target)
        if not ids: return None
        if ids & self._ids(self._service_id):
            path = next((value for candidate in self._routes.get(view_id, ()) if (value := _fill(candidate, opts["params"])) is not None), None)
        else:
            mounts = {(item["serviceId"], self._service_path(item)): item for item in self._mounts
                      if item["enabled"] and item["serviceId"] in ids and item["viewId"] == view_id and self._service_path(item)}
            if len(mounts) != 1: return None
            (target, template), mount = next(iter(mounts.items()))
            path = _fill(cast(str, template), {**mount["fixedParams"], **opts["params"]})
        if path is None: return None
        if opts["absolute"]:
            opts["origin"] = self._service_origin(target, opts.get("origin"))
            if opts["origin"] is None: return None
        return _render(path, opts)

    def ui_route(self, view_id: str, options: RouteUrlOptionsInput | None = None) -> str | None:
        opts = parse("RouteUrlOptionsSchema", options or {})
        ids = self._ids(opts.get("serviceId", self._service_id))
        paths = {_fill(item["path"], opts["params"]) for item in self._mounts if item["enabled"] and item["kind"] == "page"
                 and "GET" in item.get("resolvedMethods", []) and item["viewId"] == view_id and item["serviceId"] in ids}
        paths.discard(None)
        if len(paths) != 1: return None
        if opts["absolute"]:
            origin = opts.get("origin") or self._app_origin or next(iter(self._hosts), None)
            if origin is None: return None
            try: opts["origin"] = _origin(origin)
            except ValueError: return None
        # Navigation never gains a component, fragment or SSE service selector.
        return _render(cast(str, next(iter(paths))), {key: opts[key] for key in ("query", "absolute", "origin") if key in opts})

    @staticmethod
    def _service_path(mount: Mapping[str, Any]) -> str | None:
        return mount.get("resolvedServicePath", mount.get("servicePathVariant", mount.get("targetPath")))

    def element(self, reference: BPElementReferenceInput) -> ResolvedBPElementReference:
        from .access import _path_matches
        value = parse("BPElementReferenceSchema", reference)
        def unavailable(reason): return parse("ResolvedBPElementReferenceSchema", {"unavailable": reason})
        if not value["fragment"].strip(): return unavailable("fragment_required")
        path: str | None
        if value["service"] == "shell":
            service_id = self._shell.get("serviceId")
            origin = self._service_origin(service_id) if service_id else None
            if not origin: return unavailable("shell_unavailable")
            path = "/.well-known/bp/shell/fragment/" + quote(value["fragment"], safe="~()*!.'-")
            opts = {"query": value["args"]["query"]}
        else:
            if not value.get("path", "").startswith("/"): return unavailable("service_path_required")
            ids = self._ids(value["service"])
            mounts = [item for item in self._mounts if item["enabled"] and item["serviceId"] in ids and self._service_path(item)
                      and _path_matches(cast(str, self._service_path(item)), value["path"])]
            if len(mounts) != 1: return unavailable("ambiguous_provider" if mounts else "service_unavailable")
            mount = mounts[0]; service_id = mount["serviceId"]; origin = self._service_origin(service_id)
            if not origin: return unavailable("service_unavailable")
            path = _fill(cast(str, self._service_path(mount)), {**mount["fixedParams"], **value["args"]["params"]})
            if path is None: return unavailable("path_params_required")
            opts = {"query": value["args"]["query"], "fragment": value["fragment"]}
        try: url = _render(path, {**opts, "absolute": True, "origin": origin})
        except ValueError: return unavailable("service_path_required")
        return parse("ResolvedBPElementReferenceSchema", {"url": url, "serviceId": service_id})

    @staticmethod
    def _attributes(url: str, opts: Mapping[str, Any], form: bool) -> dict[str, str]:
        if url.startswith("/"): _path(url)
        else: http_origin(url, allow_path=True)
        method = opts["method"]
        attrs = {"action": url, "method": method} if form else {"href": url}
        attrs["hx-" + method.lower()] = url
        for source, target in (("target", "hx-target"), ("swap", "hx-swap"), ("push", "hx-push-url")):
            if source in opts: attrs[target] = _scalar(opts[source])
        return attrs

    @staticmethod
    def link(url: str, options: RouteUiOptionsInput | None = None) -> dict[str, str]:
        return Urls._attributes(url, parse("RouteUiOptionsSchema", options or {}), False)

    @staticmethod
    def form(url: str, options: RouteUiOptionsInput | None = None) -> dict[str, str]:
        return Urls._attributes(url, parse("RouteUiOptionsSchema", options or {}), True)

    def current_ui(self, options: RouteUiOptionsInput | None = None) -> dict[str, str]:
        opts = parse("RouteUiOptionsSchema", options or {})
        return self._attributes(_render(self._path, opts), opts, False)

    def rewrite(self, html: str) -> str:
        def replace(match):
            value = self.route(match[3])
            if value is None: return match[0]
            from html import escape
            return match[1] + "=" + match[2] + escape(value, quote=True) + match[2]
        return re.sub(r"(?<![\w:-])(href|action|hx-get|hx-post|hx-put|hx-patch|hx-delete|hx-download)=([\"'])\{([A-Za-z0-9_$.-]+)\}\2", replace, html)
