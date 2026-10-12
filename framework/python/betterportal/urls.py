"""Scoped service requests, mounted page links and HTML attribute helpers."""
from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
import re
from typing import Any, Iterable, Mapping, TYPE_CHECKING, cast
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit

from .context import ScopedContext, http_origin, http_base_url, _origins
from .contracts import parse
from .generated_types import BPElementReferenceInput, ResolvedBPElementReference, RouteUrlOptionsInput, RouteUiOptionsInput, ResolvedRouteUrl
if TYPE_CHECKING:
    from .registry import Registry


def _scalar(value: Any) -> str:
    if isinstance(value, str): return value
    if isinstance(value, bool): return str(value).lower()
    if isinstance(value, int): return str(value)
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


def _matches(template: str, path: str) -> bool:
    """Compare URI segments without treating encoded delimiters as separators."""
    left = template.split("?", 1)[0].rstrip("/").split("/")
    right = path.split("?", 1)[0].rstrip("/").split("/")
    try:
        return len(left) == len(right) and all(a.startswith(":") or b.startswith(":") or unquote(a, errors="strict") == unquote(b, errors="strict") for a, b in zip(left, right))
    except (ValueError, UnicodeError): return False


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
    if changes:
        pairs = parse_qsl(query, keep_blank_values=True, encoding="utf-8", errors="strict")
        for name, value in changes.items():
            if value is None:
                pairs = [pair for pair in pairs if pair[0] != name]
                continue
            index = next((index for index, pair in enumerate(pairs) if pair[0] == name), len(pairs))
            pairs = [pair for pair in pairs if pair[0] != name]
            pairs.insert(index, (name, _scalar(value)))
        query = urlencode(pairs, safe="*").replace("~", "%7E")
    result = encoded + ("?" + query if query else "") + ("#" + quote(parts.fragment, safe="/?:@!$&'()*+,;=-._~%") if parts.fragment else "")
    if options.get("absolute") and options.get("origin"):
        result = _origin(options["origin"]) + result
    return result


class Urls:
    def __init__(self, scope: ScopedContext, registry: Registry | None, service_id: str | None, path: str, *, app_origins: Iterable[str] = ()):
        # Only navigation data is retained; renderer helpers do not retain credentials/config.
        self._services = []
        for service in scope.tenant["services"]:
            if not scope.tenant["active"] or not service["enabled"]: continue
            try: origin = http_base_url(service["hostname"])
            except ValueError: continue
            self._services.append({**{key: service[key] for key in ("id", "serviceId") if key in service}, "hostname": origin})
        self._mounts = deepcopy(scope.app.get("appRoutes", scope.app["routes"]))
        self._shell = deepcopy(scope.app.get("shell", {}))
        self._hosts = tuple(scope.app["hostnames"])
        self._aliases = dict(registry.dependencies) if registry is not None else {}
        self._routes = {route.view_id: (route.paths, {op.declaration["method"] for op in route.operations}) for route in registry.routes} if registry is not None else {}
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

    def route_url(self, input: RouteUrlOptionsInput | None = None) -> ResolvedRouteUrl | None:
        """Resolve self, a service path or a view ID into six explicit destination fields.

        apiPath/viewPath use the service endpoint; viewPath adds HTML selectors.
        uiPath is the mounted GET page. absoluteApiPath/absoluteViewPath use the
        service origin; absoluteUiPath uses the public app origin. Never forward
        internal destinations to a view as response data.
        """
        return self._resolve(input, "GET", {}, {})

    def _resolve(self, input: RouteUrlOptionsInput | None, method: str, params: Mapping[str, Any], query: Mapping[str, Any]) -> ResolvedRouteUrl | None:
        opts = parse("RouteUrlOptionsSchema", input or {})
        if "path" in opts and "viewId" in opts: return None
        if "path" in opts:
            try:
                if "#" in opts["path"]: return None
                _path(opts["path"])
            except ValueError: return None
        self_target = "path" not in opts and "viewId" not in opts
        target = opts.get("serviceId", self._service_id)
        ids, own = self._ids(target), self._ids(self._service_id)
        if not ids or self_target and ids != own: return None
        method = opts.get("method", method if self_target else "GET")
        parameters = {**(params if self_target else {}), **opts["params"]}
        opts["query"] = {**(query if self_target else {}), **dict(parse_qsl(urlsplit(opts.get("path", "")).query, keep_blank_values=True)), **opts["query"]}
        if opts.get("component") and opts.get("fragment"): return None
        selector, view_id = opts.get("path", self._path if self_target else None), opts.get("viewId")
        path: str | None = None
        if ids == own and len(ids) == 1:
            target = next(iter(ids))
            candidates = [(name, candidate) for name, (paths, methods) in self._routes.items() if method in methods for candidate in paths
                          if name == view_id] if view_id is not None else [
                (name, candidate) for name, (paths, methods) in self._routes.items() if method in methods for candidate in paths
                if selector is not None and _matches(candidate, selector.split("?", 1)[0])]
            exact = [(name, candidate) for name, candidate in candidates if selector is not None and candidate.rstrip("/") == selector.split("?", 1)[0].rstrip("/")]
            if exact: candidates = exact
            resolved = []
            for name, candidate in candidates:
                mounts = [mount for mount in self._mounts if mount["enabled"] and mount["serviceId"] in ids and mount["viewId"] == name
                    and method in mount.get("resolvedMethods", []) and (not opts.get("mountId") or opts["mountId"] == mount["id"])
                    and ((template := self._service_path(mount)) is None or _matches(candidate, template))]
                defaults = [mount.get("fixedParams", {}) for mount in mounts] if mounts else [{}]
                for fixed in defaults:
                    values = {**fixed, **(self._parameters(candidate, self._path) if self_target else {}), **parameters}
                    value = _fill(candidate if self_target or selector is None else selector, values)
                    if value is not None: resolved.append((name, candidate, value))
            def rank(template: str) -> tuple[int, ...]:
                return (-sum(part.startswith(":") for part in template.split("/")),) if view_id is not None else tuple(int(part.startswith(":")) for part in template.split("/"))
            resolved.sort(key=lambda item: rank(item[1]))
            if not resolved: return None
            best = rank(resolved[0][1])
            eligible = [item for item in resolved if rank(item[1]) == best]
            if len({value for _, _, value in eligible}) != 1: return None
            view_id, _, path = eligible[0]
        else:
            targets = []
            for mount in self._mounts:
                template = self._service_path(mount)
                if not mount["enabled"] or mount["serviceId"] not in ids or method not in mount.get("resolvedMethods", []): continue
                if opts.get("mountId") and opts["mountId"] != mount["id"]: continue
                if not template or (mount["viewId"] != view_id if view_id is not None else not selector or not _matches(template, selector.split("?", 1)[0])): continue
                value = _fill(selector or template, {**mount.get("fixedParams", {}), **parameters})
                if value is not None: targets.append((mount, value))
            exact_targets = [(mount, value) for mount, value in targets if selector is not None and (self._service_path(mount) or "").rstrip("/") == selector.split("?", 1)[0].rstrip("/")]
            if exact_targets: targets = exact_targets
            if selector is not None and targets:
                def mount_rank(mount: Mapping[str, Any]) -> tuple[int, ...]:
                    return tuple(int(part.startswith(":")) for part in (self._service_path(mount) or "").split("/"))
                best_rank = min(mount_rank(mount) for mount, _ in targets)
                targets = [(mount, value) for mount, value in targets if mount_rank(mount) == best_rank]
            unique = {(mount["serviceId"], value): (mount, value) for mount, value in targets}
            if len(unique) != 1: return None
            mount, path = next(iter(unique.values())); target, view_id = mount["serviceId"], mount["viewId"]
        if path is None: return None
        pages = set()
        if method == "GET" and not any(opts.get(key) for key in ("sse", "component", "fragment")):
            for mount in self._mounts:
                if not mount["enabled"] or mount["kind"] != "page" or mount["serviceId"] != target or mount["viewId"] != view_id or "GET" not in mount.get("resolvedMethods", []): continue
                if opts.get("mountId") and opts["mountId"] != mount["id"]: continue
                template = self._service_path(mount)
                if template is None and ids == own:
                    template = next((candidate for candidate in self._routes.get(view_id, ((), set()))[0] if _matches(candidate, path.split("?", 1)[0])), None)
                if template is None: continue
                values = {**mount.get("fixedParams", {}), **parameters, **self._parameters(template, path)}
                ui_names = {part[1:] for part in mount["path"].split("/") if part.startswith(":")}
                if any(name not in ui_names and values.get(name) != value for name, value in mount.get("fixedParams", {}).items()): continue
                mounted, service = _fill(mount["path"], values), _fill(template, values)
                if mounted is not None and service is not None and _matches(service, path.split("?", 1)[0]): pages.add(_render(mounted, {"query": opts["query"]}))
        ui = next(iter(pages)) if len(pages) == 1 else None
        origin = self._service_origin(target)
        try:
            api = _render(path, {"query": opts["query"], "sse": opts["sse"]})
            view = _render(path, opts)
            app = self._app_origin
            if app is None:
                for host in self._hosts:
                    try: app = _origin(host); break
                    except ValueError: pass
            return parse("ResolvedRouteUrlSchema", {"apiPath": api, "viewPath": view, "uiPath": ui,
                "absoluteApiPath": origin + api if origin else None, "absoluteViewPath": origin + view if origin else None,
                "absoluteUiPath": app + ui if app and ui else None})
        except ValueError: return None

    @staticmethod
    def _parameters(template: str, path: str) -> dict[str, str]:
        return {part[1:]: unquote(value) for part, value in zip(template.split("?", 1)[0].split("/"), path.split("?", 1)[0].split("/")) if part.startswith(":")}

    @staticmethod
    def _service_path(mount: Mapping[str, Any]) -> str | None:
        return mount.get("resolvedServicePath", mount.get("servicePathVariant", mount.get("targetPath")))

    def element(self, reference: BPElementReferenceInput) -> ResolvedBPElementReference:
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
                      and _matches(cast(str, self._service_path(item)), value["path"])]
            if len(mounts) != 1: return unavailable("ambiguous_provider" if mounts else "service_unavailable")
            mount = mounts[0]; service_id = mount["serviceId"]; origin = self._service_origin(service_id)
            if not origin: return unavailable("service_unavailable")
            path = _fill(cast(str, self._service_path(mount)), {**mount.get("fixedParams", {}), **value["args"]["params"]})
            if path is None: return unavailable("path_params_required")
            opts = {"query": value["args"]["query"], "fragment": value["fragment"]}
        try: url = origin + _render(path, opts)
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
