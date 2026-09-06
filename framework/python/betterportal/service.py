"""Standalone BP request policy. HTTP adapters supply routing, bodies and cancellation."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import json
from typing import Any, Iterable, Mapping, cast

from .access import AppAccess
from .authorization import AuthContext, authorize_request, is_machine_request
from .context import ScopedConfig, ScopedContext
from .encryption import decrypt_preview, preview_schema
from .cors import Cors
from .generated_types import HttpMethod, ManifestDeclarationInput, PluginManifest
from .handler import RequestContext
from .keys import JwksClient, secure_endpoint
from .jsoncodec import loads
from .registry import Operation, Registry, Route
from .security import TokenError
from .storage import StateStore
from .urls import Urls


class RequestError(Exception):
    def __init__(self, status: int, message: str, headers: Mapping[str, str] | None = None, *, scope: ScopedContext | None = None):
        super().__init__(message)
        self.status = status
        self.headers = dict(headers or {})
        self.scope = scope


class _Snapshot:
    def __init__(self, snapshot: ScopedConfig, descriptors: Iterable[dict[str, Any]], preview_key: str | None):
        self.snapshot, self.config = snapshot, snapshot.document()
        self.preview: dict[str, Any] = {}
        self.preview_scope: tuple[str, str] | None = None
        preview = self.config.get("previewConfig")
        if preview is not None:
            tenants, apps = self.config["tenants"], self.config["apps"]
            if not preview_key: raise ValueError("Preview configuration requires its decryption key")
            if len(tenants) != 1 or len(apps) != 1 or not tenants[0]["active"] or apps[0]["tenantId"] != tenants[0]["id"]:
                raise ValueError("Preview configuration requires an unambiguous active tenant/app scope")
            self.preview_scope = tenants[0]["id"], apps[0]["id"]
            self.preview = {**decrypt_preview(preview_schema(descriptors, "tenant"), preview_key, "tenant", preview["tenant"]),
                            **decrypt_preview(preview_schema(descriptors, "app"), preview_key, "app", preview["app"])}
        # Validate every endpoint before allocating clients or publishing any policy.
        addresses = {(app["auth"]["expectedIssuer"], secure_endpoint(app["auth"]["jwksUri"], allow_query=True))
                     for app in self.config.get("apps", []) if "auth" in app}
        self.keys = {(issuer, uri): JwksClient(issuer, uri) for issuer, uri in addresses}

    async def close(self) -> None:
        await asyncio.gather(*(client.aclose() for client in self.keys.values()))


class Service:
    def __init__(self, registry: Registry, declaration: ManifestDeclarationInput, snapshot: ScopedConfig | None = None,
                 *, state_store: StateStore | None = None, managed: bool = False, preview_key: str | None = None):
        self.registry = registry
        self._schema = registry.schema(declaration)
        self._store, self._preview_key = state_store, preview_key
        self._state = self._build(snapshot) if snapshot is not None else None
        self._managed, self._submitted = managed, False
        self._updates = asyncio.Lock()
        self._cleanup: set[asyncio.Task[None]] = set()
        self._writers: set[asyncio.Task[Any]] = set()
        self._closed = False

    def _build(self, snapshot: ScopedConfig) -> _Snapshot:
        return _Snapshot(snapshot, cast(Iterable[dict[str, Any]], self._schema["manifest"]["configSchemas"]), self._preview_key)

    @property
    def ready(self) -> bool: return self._state is not None and not self._closed and (not self._managed or self._submitted)

    def snapshot(self) -> dict[str, Any] | None:
        return self._state.snapshot.document() if self._state else None

    async def restore_snapshot(self) -> bool:
        """Restore a validated cache before startup; managed services remain unready."""
        task = asyncio.current_task()
        assert task is not None
        self._writers.add(task)
        try:
            async with self._updates:
                if self._closed or self._state is not None: raise RuntimeError("Restore requires an empty, open service")
                if self._store is None: return False
                data = await self._store.load()
                if data is None: return False
                if len(data) > 16 * 1024 * 1024: raise ValueError("Snapshot exceeds 16 MiB")
                next_state = self._build(ScopedConfig(loads(data.decode("utf-8"))))
                if self._closed:
                    await next_state.close()
                    raise RuntimeError("Service is closed")
                self._state = next_state
                return True
        finally: self._writers.discard(task)

    async def apply_snapshot(self, value: Mapping[str, Any], *, manifest_submitted: bool = False) -> None:
        """Validate, persist, then atomically publish. Submission means an acknowledged manifest POST."""
        task = asyncio.current_task()
        assert task is not None
        self._writers.add(task)
        try:
            async with self._updates:
                if self._closed: raise RuntimeError("Service is closed")
                next_state = self._build(ScopedConfig(value))
                try:
                    data = json.dumps(next_state.config, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
                    if len(data) > 16 * 1024 * 1024: raise ValueError("Snapshot exceeds 16 MiB")
                    if self._store is not None: await self._store.save(data)
                except BaseException:
                    await next_state.close()
                    raise
                # No suspension after persistence until publication and cache invalidation finish.
                previous, self._state = self._state, next_state
                self._submitted = self._submitted or manifest_submitted
                if previous is not None:
                    for client in previous.keys.values(): client.invalidate()
                    cleanup = asyncio.create_task(previous.close())
                    self._cleanup.add(cleanup)
                    def finished(task: asyncio.Task[None]) -> None:
                        self._cleanup.discard(task)
                        if not task.cancelled(): task.exception()
                    cleanup.add_done_callback(finished)
        finally: self._writers.discard(task)

    @property
    def manifest(self) -> PluginManifest: return deepcopy(self._schema["manifest"])

    def schema(self) -> dict[str, Any]: return cast(dict[str, Any], deepcopy(self._schema))

    def _resolve(self, state: _Snapshot | None, headers: Mapping[str, str], scheme: str, mode: str, trusted_addresses: Iterable[str], *, preflight: bool = False) -> ScopedContext:
        if not self.ready or state is None:
            raise RequestError(503, "Service is not ready")
        machine = not preflight and is_machine_request(headers)
        scope = (state.snapshot.by_id(headers.get("x-bp-tenant-id", ""), headers.get("x-bp-app-id", "")) if machine
                 else state.snapshot.resolve(headers, scheme=scheme, mode=mode, trusted_addresses=trusted_addresses))
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
        state = self._state
        scope = self._resolve(state, normalized, scheme, mode, trusted_addresses, preflight=True)
        assert state is not None
        access = AppAccess(scope, state.snapshot.local_service_ids)
        methods = [operation.method for operation in route.operations if access.allows_preflight(route, operation.method, path=matched_path, fragment=fragment)]
        return Cors(scope.origin_policy, methods).preflight(normalized.get("origin"), normalized.get("access-control-request-method"), normalized.get("access-control-request-headers"))

    async def prepare(self, route: Route, method: str, path: str, headers: Mapping[str, str], *, matched_path: str | None = None,
                      fragment: str | None = None, scheme: str = "https", mode: str = "service", trusted_addresses: Iterable[str] = ()) -> tuple[RequestContext, dict[str, str]]:
        normalized = self._headers(headers)
        state = self._state
        scope = self._resolve(state, normalized, scheme, mode, trusted_addresses)
        assert state is not None
        response_headers = Cors(scope.origin_policy, [item.method for item in route.operations]).headers(normalized.get("origin"))
        access = AppAccess(scope, state.snapshot.local_service_ids)
        if not access.allows(route, method, path=matched_path, fragment=fragment):
            raise RequestError(404, "Route not found", response_headers, scope=scope)
        operation = next(item for item in route.operations if item.method == method)
        app_auth = scope.app.get("auth")
        keys = state.keys.get((app_auth["expectedIssuer"], secure_endpoint(app_auth["jwksUri"], allow_query=True))) if app_auth else None
        management = state.config.get("configManagement", {})
        root = (management["adminTenantId"], management["managementAppId"]) if "adminTenantId" in management and "managementAppId" in management else None
        auth = AuthContext(scope.tenant_id, scope.app_id, app_auth, keys.resolve if keys else None,
                           state.config.get("m2m"), access.permission_aliases(route, method, path=matched_path, fragment=fragment), root)
        async def verify():
            try: return await authorize_request(normalized, operation.declaration["auth"], auth, view_id=route.view_id, method=method)
            except asyncio.CancelledError:
                if self._state is not state or self._closed:
                    raise TokenError("Configuration verifier was retired") from None
                raise
        # Keep cancellation of a retired verifier distinct from cancellation of this request
        # on Python 3.10, which has no public Task.cancelling() API.
        verification = asyncio.create_task(verify())
        try:
            caller = await asyncio.shield(verification)
        except asyncio.CancelledError:
            verification.cancel()
            await asyncio.gather(verification, return_exceptions=True)
            raise
        except TokenError as error:
            if self._state is not state or self._closed:
                raise RequestError(503, "Configuration changed during authentication") from error
            message = {401: "Authentication required or invalid", 403: "Access denied", 503: "Authentication unavailable"}.get(error.status, "Authentication failed")
            raise RequestError(error.status, message, response_headers, scope=scope) from error
        except Exception as error:
            if self._state is not state or self._closed:
                raise RequestError(503, "Configuration changed during authentication") from error
            raise
        if self._state is not state or self._closed:
            raise RequestError(503, "Configuration changed during authentication")
        if caller.service is not None and not access.allows(route, method, path=matched_path, fragment=fragment, service_id=caller.service["aud"]):
            raise RequestError(403, "Access denied", response_headers, scope=scope)
        values = deepcopy(state.preview) if state.preview_scope == (scope.tenant_id, scope.app_id) else {}
        return RequestContext(scope, caller, cast(HttpMethod, method), path, config=values,
                              url_context=self.urls(scope, path, normalized, scheme)), response_headers

    def urls(self, scope: ScopedContext, path: str, headers: Mapping[str, str] | None = None, scheme: str = "https") -> Urls:
        headers = headers or {}
        state = self._state
        config = state.config if state else {}
        return Urls(scope, self.registry, config.get("serviceIdentity", {}).get("id", self._schema["manifest"]["pluginId"]), path,
                    app_origins=[headers.get("origin", ""), headers.get("referer", ""), scheme + "://" + headers.get("host", "")])

    @staticmethod
    def metadata(route: Route, operation: Operation, matched_path: str) -> dict[str, Any]:
        declaration = operation.declaration
        primary = next((item.declaration for item in route.operations if item.method == "GET"), declaration)
        return {"viewId": route.view_id, "title": primary["title"], "description": primary["description"], "path": matched_path,
                **{key: declaration[key] for key in ("operationId", "method", "auth", "cacheHints")}}

    async def aclose(self) -> None:
        self._closed = True
        writers = tuple(self._writers - {asyncio.current_task()})
        for task in writers: task.cancel()
        await asyncio.gather(*writers, return_exceptions=True)
        async with self._updates:
            if self._state is not None: await self._state.close()
            await asyncio.gather(*tuple(self._cleanup))

    async def __aenter__(self) -> Service: return self

    async def __aexit__(self, *args: Any) -> None: await self.aclose()
