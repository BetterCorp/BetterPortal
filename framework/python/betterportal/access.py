"""Inbound app mounts and permission aliases for the current service instances."""
from __future__ import annotations

from types import MappingProxyType
from typing import Iterable, Mapping

from .context import ScopedContext
from .registry import Route, _segments


def _path_matches(mounted: str, registered: str) -> bool:
    try:
        left, right = _segments(mounted.rstrip("/") or "/"), _segments(registered)
        return len(left) == len(right) and all(a == b or a.startswith(":") or b.startswith(":") for a, b in zip(left, right))
    except ValueError:
        return False


class AppAccess:
    def __init__(self, scope: ScopedContext, local_service_ids: Iterable[str]):
        self._app = scope.app
        local = frozenset(local_service_ids)
        self._services = {service["id"]: service for service in scope.tenant["services"]
                          if scope.tenant["active"] and service["enabled"] and service["id"] in local}

    def permission_aliases(self) -> Mapping[str, str]:
        """Only enabled local instances referenced by this app can alias a plugin ID."""
        app = self._app
        references = [*app["routes"], *app["slots"], *(item for items in app["fragments"].values() for item in items)]
        references.extend(app[key] for key in ("shell", "auth") if key in app)
        mounted = {item["serviceId"] for item in references if item.get("enabled", True)}
        return MappingProxyType({identifier: service["serviceId"] for identifier, service in self._services.items()
                                 if identifier in mounted and "serviceId" in service})

    def allows(self, route: Route, method: str, *, path: str | None = None, fragment: str | None = None) -> bool:
        """The host supplies the matched registered path, before handler execution."""
        path = route.paths[0] if path is None else path
        if path not in route.paths:
            raise ValueError("The matched path is not registered on this view")
        operation = next((item for item in route.operations if item.method == method), None)
        if operation is None:
            return False
        # Discovery and control-plane endpoints have their own declared auth policy.
        if path.startswith("/.well-known/"):
            return True
        legacy = f"legacy:{route.view_id}:{method}"
        for mount in self._app["routes"]:
            target = mount.get("resolvedServicePath", mount.get("servicePathVariant", mount.get("targetPath")))
            if (mount["enabled"] and mount["serviceId"] in self._services and mount["viewId"] == route.view_id
                    and (operation.id in mount["operations"] or legacy in mount["operations"])
                    and (target is None or _path_matches(target, path))):
                return True
        if method == "GET":
            if fragment:
                location, dot, identifier = fragment.partition(".")
                candidates = self._app["fragments"].get(location, []) if dot and location else [item for items in self._app["fragments"].values() for item in items]
                identifier = identifier if dot and location else fragment
                if any(item["enabled"] and item["serviceId"] in self._services and item["fragmentId"] == identifier
                       and _path_matches(item["targetPath"], path) for item in candidates):
                    return True
            if any(item["enabled"] and item["serviceId"] in self._services and item["viewId"] == route.view_id for item in self._app["slots"]):
                return True
        return False
