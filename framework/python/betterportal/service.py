"""Standalone BP request policy. HTTP adapters supply routing, bodies and cancellation."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any, Iterable, Mapping, cast

from .access import AppAccess
from .authorization import AuthContext, authorize_request, is_machine_request
from .context import ScopedConfig, ScopedContext
from .cors import Cors
from .generated_types import HttpMethod, ManifestDeclarationInput, PluginManifest
from .handler import RequestContext
from .keys import JwksClient, secure_endpoint
from .registry import Operation, Registry, Route
from .security import TokenError
from .urls import Urls


class RequestError(Exception):
    def __init__(self, status: int, message: str, headers: Mapping[str, str] | None = None, *, scope: ScopedContext | None = None):
        super().__init__(message)
        self.status = status
        self.headers = dict(headers or {})
        self.scope = scope


class Service:
    def __init__(self, registry: Registry, declaration: ManifestDeclarationInput, snapshot: ScopedConfig | None = None):
        self.registry = registry
        self._schema = registry.schema(declaration)
        self._snapshot = snapshot
        self._config = snapshot.document() if snapshot is not None else {}
        self._closed = False
        addresses = {(app["auth"]["expectedIssuer"], secure_endpoint(app["auth"]["jwksUri"], allow_query=True))
                     for app in self._config.get("apps", []) if "auth" in app}
        self._keys = {(issuer, uri): JwksClient(issuer, uri) for issuer, uri in addresses}

    @property
    def ready(self) -> bool: return self._snapshot is not None and not self._closed

    @property
    def manifest(self) -> PluginManifest: return deepcopy(self._schema["manifest"])

    def schema(self) -> dict[str, Any]: return cast(dict[str, Any], deepcopy(self._schema))

    def _resolve(self, headers: Mapping[str, str], scheme: str, mode: str, trusted_addresses: Iterable[str], *, preflight: bool = False) -> ScopedContext:
        if not self.ready or self._snapshot is None:
            raise RequestError(503, "Service is not ready")
        machine = not preflight and is_machine_request(headers)
        scope = (self._snapshot.by_id(headers.get("x-bp-tenant-id", ""), headers.get("x-bp-app-id", "")) if machine
                 else self._snapshot.resolve(headers, scheme=scheme, mode=mode, trusted_addresses=trusted_addresses))
        if scope is None:
            raise RequestError(401 if machine else 400, "BetterPortal tenant/app context required")
        return scope

    @staticmethod
    def _headers(headers: Mapping[str, str]) -> dict[str, str]:
        result = {key.lower(): value for key, value in headers.items()}
        if len(result) != len(headers): raise RequestError(400, "Duplicate request headers")
        return result

    def preflight(self, route: Route, headers: Mapping[str, str], *, matched_path: str | None = None, fragment: str | None = None,
                  scheme: str = "https", mode: str = "service", trusted_addresses: Iterable[str] = ()) -> dict[str, str]:
        normalized = self._headers(headers)
        scope = self._resolve(normalized, scheme, mode, trusted_addresses, preflight=True)
        access = AppAccess(scope, self._snapshot.local_service_ids if self._snapshot else ())
        methods = [operation.method for operation in route.operations if access.allows_preflight(route, operation.method, path=matched_path, fragment=fragment)]
        return Cors(scope.origin_policy, methods).preflight(normalized.get("origin"), normalized.get("access-control-request-method"), normalized.get("access-control-request-headers"))

    async def prepare(self, route: Route, method: str, path: str, headers: Mapping[str, str], *, matched_path: str | None = None,
                      fragment: str | None = None, scheme: str = "https", mode: str = "service", trusted_addresses: Iterable[str] = ()) -> tuple[RequestContext, dict[str, str]]:
        normalized = self._headers(headers)
        scope = self._resolve(normalized, scheme, mode, trusted_addresses)
        response_headers = Cors(scope.origin_policy, [item.method for item in route.operations]).headers(normalized.get("origin"))
        access = AppAccess(scope, self._snapshot.local_service_ids if self._snapshot else ())
        if not access.allows(route, method, path=matched_path, fragment=fragment):
            raise RequestError(404, "Route not found", response_headers, scope=scope)
        operation = next(item for item in route.operations if item.method == method)
        app_auth = scope.app.get("auth")
        keys = self._keys.get((app_auth["expectedIssuer"], secure_endpoint(app_auth["jwksUri"], allow_query=True))) if app_auth else None
        management = self._config.get("configManagement", {})
        root = (management["adminTenantId"], management["managementAppId"]) if "adminTenantId" in management and "managementAppId" in management else None
        auth = AuthContext(scope.tenant_id, scope.app_id, app_auth, keys.resolve if keys else None,
                           self._config.get("m2m"), access.permission_aliases(route, method, path=matched_path, fragment=fragment), root)
        try:
            caller = await authorize_request(normalized, operation.declaration["auth"], auth, view_id=route.view_id, method=method)
        except TokenError as error:
            message = {401: "Authentication required or invalid", 403: "Access denied", 503: "Authentication unavailable"}.get(error.status, "Authentication failed")
            raise RequestError(error.status, message, response_headers, scope=scope) from error
        if caller.service is not None and not access.allows(route, method, path=matched_path, fragment=fragment, service_id=caller.service["aud"]):
            raise RequestError(403, "Access denied", response_headers, scope=scope)
        return RequestContext(scope, caller, cast(HttpMethod, method), path, url_context=self.urls(scope, path, normalized, scheme)), response_headers

    def urls(self, scope: ScopedContext, path: str, headers: Mapping[str, str] | None = None, scheme: str = "https") -> Urls:
        headers = headers or {}
        return Urls(scope, self.registry, self._config.get("serviceIdentity", {}).get("id", self._schema["manifest"]["pluginId"]), path,
                    app_origins=[headers.get("origin", ""), headers.get("referer", ""), scheme + "://" + headers.get("host", "")])

    @staticmethod
    def metadata(route: Route, operation: Operation, matched_path: str) -> dict[str, Any]:
        declaration = operation.declaration
        primary = next((item.declaration for item in route.operations if item.method == "GET"), declaration)
        return {"viewId": route.view_id, "title": primary["title"], "description": primary["description"], "path": matched_path,
                **{key: declaration[key] for key in ("operationId", "method", "auth", "cacheHints")}}

    async def aclose(self) -> None:
        self._closed = True
        await asyncio.gather(*(client.aclose() for client in self._keys.values()))

    async def __aenter__(self) -> Service: return self

    async def __aexit__(self, *args: Any) -> None: await self.aclose()
