"""Inbound app mounts and permission aliases for the current service instances."""
from __future__ import annotations

from types import MappingProxyType
from typing import Any, Iterable, Mapping

from .context import ScopedContext
from .registry import Route, _path_matches


class AppAccess:
    def __init__(self, scope: ScopedContext, local_service_ids: Iterable[str]):
        self._app = scope.app
        local = frozenset(local_service_ids)
        self._alias_services = {service["id"]: service for service in scope.tenant["services"]
                                if scope.tenant["active"] and service["enabled"]}
        self._services = {identifier: service for identifier, service in self._alias_services.items() if identifier in local}

    def permission_aliases(self, route: Route | None = None, method: str = "GET", *, path: str | None = None, fragment: str | None = None) -> Mapping[str, str]:
        """Only enabled local instances referenced by this app can alias a plugin ID."""
        app = self._app
        references = [*app["routes"], *app["slots"], *(item for items in app["fragments"].values() for item in items)]
        references.extend(app[key] for key in ("shell", "auth") if key in app)
        mounted = {item["serviceId"] for item in references if item.get("enabled", True)}
        owners = self._permission_owners(route, method, path, fragment) if route is not None else None
        return MappingProxyType({identifier: service["serviceId"] for identifier, service in self._services.items()
                                 if identifier in mounted and "serviceId" in service and (owners is None or identifier in owners)
                                 and (route is None or self.allows(route, method, path=path, fragment=fragment, service_id=identifier))})

    def additional_permission_aliases(self) -> Mapping[str, str]:
        """Trusted app-mounted aliases for authored requirements, independently of the inbound owner."""
        app = self._app
        references = [*app["routes"], *app["slots"], *(item for items in app["fragments"].values() for item in items)]
        references.extend(app[key] for key in ("shell", "auth") if key in app)
        mounted = {item["serviceId"] for item in references if item.get("enabled", True)}
        return MappingProxyType({identifier: service["serviceId"] for identifier, service in self._alias_services.items()
                                 if identifier in mounted and "serviceId" in service})

    def _permission_owners(self, route: Route, method: str, path: str | None, fragment: str | None) -> set[str] | None:
        path = path or route.paths[0]
        if path not in route.paths:
            raise ValueError("The matched path is not registered on this view")
        if path.startswith("/.well-known/"):
            return None
        operation = next((item for item in route.operations if item.method == method), None)
        if operation is None:
            return set()
        if method == "GET" and fragment:
            location, dot, identifier = fragment.partition(".")
            candidates = self._app["fragments"].get(location, []) if dot and location else [item for items in self._app["fragments"].values() for item in items]
            identifier = identifier if dot and location else fragment
            owners = {item["serviceId"] for item in candidates if item["fragmentId"] == identifier and self._fragment_allowed(item, path)}
            if owners:
                return owners
        owners = {mount["serviceId"] for mount in self._app["routes"] if mount["enabled"] and mount["serviceId"] in self._services
                  and mount["viewId"] == route.view_id and (operation.id in mount["operations"] or f"legacy:{route.view_id}:{method}" in mount["operations"])
                  and _path_matches(mount.get("resolvedServicePath", mount.get("servicePathVariant", mount.get("targetPath", path))), path)}
        if not owners and method == "GET":
            owners = {item["serviceId"] for item in self._app["slots"] if item["enabled"] and item["viewId"] == route.view_id and item["serviceId"] in self._services}
        return owners

    def allows(self, route: Route, method: str, *, path: str | None = None, fragment: str | None = None, service_id: str | None = None) -> bool:
        """The host supplies the matched registered path, before handler execution."""
        path = route.paths[0] if path is None else path
        if path not in route.paths:
            raise ValueError("The matched path is not registered on this view")
        operation = next((item for item in route.operations if item.method == method), None)
        if operation is None:
            return False
        return self.allows_operation(route.view_id, operation.id, method, path, fragment=fragment, service_id=service_id)

    def allows_operation(self, view_id: str, operation_id: str, method: str, path: str, *, fragment: str | None = None, service_id: str | None = None) -> bool:
        """Apply mount policy to an operation from a validated local or dependency contract."""
        # Discovery and control-plane endpoints have their own declared auth policy.
        if path.startswith("/.well-known/"):
            return True
        legacy = f"legacy:{view_id}:{method}"
        def local(identifier: str) -> bool:
            return identifier in self._services and (service_id is None or identifier == service_id)
        for mount in self._app["routes"]:
            target = mount.get("resolvedServicePath", mount.get("servicePathVariant", mount.get("targetPath")))
            if (mount["enabled"] and local(mount["serviceId"]) and mount["viewId"] == view_id
                    and (operation_id in mount["operations"] or legacy in mount["operations"])
                    and (target is None or _path_matches(target, path))):
                return True
        if method == "GET":
            if fragment:
                location, dot, identifier = fragment.partition(".")
                candidates = self._app["fragments"].get(location, []) if dot and location else [item for items in self._app["fragments"].values() for item in items]
                identifier = identifier if dot and location else fragment
                if any(item["fragmentId"] == identifier and self._fragment_allowed(item, path, service_id) for item in candidates):
                    return True
            if any(item["enabled"] and local(item["serviceId"]) and item["viewId"] == view_id for item in self._app["slots"]):
                return True
        return False

    def _fragment_allowed(self, item: Mapping[str, Any], path: str, service_id: str | None = None) -> bool:
        return bool(item["enabled"] and item["serviceId"] in self._services and (service_id is None or item["serviceId"] == service_id)
                    and _path_matches(item["targetPath"], path))

    def allows_preflight(self, route: Route, method: str, *, path: str | None = None, fragment: str | None = None) -> bool:
        if self.allows(route, method, path=path, fragment=fragment): return True
        # OPTIONS does not carry the subsequent request's Accept fragment parameter.
        return method == "GET" and fragment is None and any(item.method == method for item in route.operations) and any(
            self._fragment_allowed(item, path or route.paths[0]) for items in self._app["fragments"].values() for item in items)
