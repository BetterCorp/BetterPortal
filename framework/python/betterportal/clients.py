"""Scoped JSON dependency clients. BP owns credentials, policy and transport limits."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import dataclass
from http.cookiejar import CookieJar, DefaultCookiePolicy
import json
import time
from typing import Any, TYPE_CHECKING
from urllib.parse import urlencode

import anyvali as av
import httpx

from .access import AppAccess
from .context import ScopedContext, http_origin, _origins
from .contracts import document, object_document, parse
from .jsoncodec import loads
from .keys import secure_endpoint
from .response import RawResponse
from .registry import _segments
from .security import TokenPurpose, sign_token, uuid7
from .urls import _fill, _scalar
if TYPE_CHECKING:
    from .service import Service, _Snapshot


class _NoCookies(DefaultCookiePolicy):
    def set_ok(self, cookie: Any, request: Any) -> bool: return False


class ClientError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class ClientOperationSchemas:
    inputs: dict[str, dict[str, Any]]
    required_inputs: frozenset[str]
    output: dict[str, Any]


class ClientContract:
    """A dependency's exported BP contract; each field retains its own definitions."""
    def __init__(self, value: Any):
        self._schema = parse("BpSchemaOutputSchema", value)
        self._operations: dict[str, tuple[dict[str, Any], dict[str, Any], Any, dict[str, Any], Any]] = {}
        for view in self._schema["manifest"]["views"]:
            for path in [view["path"], *view["pathVariants"]]: _segments(path)
            for operation in view["operations"]:
                identifier = operation["operationId"]
                if identifier in self._operations: raise ValueError("Duplicate dependency operation ID")
                fields = {"params": view["paramsSchema"], "query": operation["querySchema"], "headers": operation["headersSchema"]}
                body = operation["bodySchema"]
                if not body:
                    body = document("JsonObjectSchema")
                    body["root"] = {"kind": "optional", "inner": body["root"]}
                fields["body"] = body
                schemas, keys = {}, {}
                for name, field in fields.items():
                    field = deepcopy(field if field else document("JsonObjectSchema"))
                    if "root" not in field: raise ValueError("Dependency schemas must be AnyVali documents")
                    if name != "body": field["root"].setdefault("default", {})
                    schemas[name] = av.import_schema(object_document({name: field}, unknown_keys="reject"))
                    optional = document("JsonValueSchema")
                    # Each declared field schema owns value validation and coercion.
                    optional["root"] = {"kind": "optional", "inner": {"kind": "unknown"}}
                    keys[name] = optional
                output = av.import_schema(operation["jsonResponseSchema"]) if operation["jsonResponseSchema"] else None
                self._operations[identifier] = (view, operation, av.import_schema(object_document(keys, unknown_keys="reject")), schemas, output)

    @property
    def plugin_id(self) -> str: return self._schema["manifest"]["pluginId"]

    def schema(self) -> dict[str, Any]: return deepcopy(self._schema)

    def json_operations(self) -> dict[str, ClientOperationSchemas]:
        """Owned documents for native authoring; AnyVali determines input presence."""
        result = {}
        for identifier, (_, _, _, fields, output) in self._operations.items():
            if output is None: continue
            inputs = {}
            for name, field in fields.items():
                exported = deepcopy(av.export_schema(field))
                exported["root"] = exported["root"]["properties"][name]
                inputs[name] = exported
            result[identifier] = ClientOperationSchemas(inputs, frozenset(name for name, field in fields.items() if not field.safe_parse({}).success), deepcopy(av.export_schema(output)))
        return result

    def _prepare(self, identifier: str, values: Any) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], str, str, Any]:
        if identifier not in self._operations: raise ValueError("Unknown dependency operation")
        view, operation, keys, fields, output = self._operations[identifier]
        if output is None: raise ValueError("Dependency operation does not declare JSON output")
        source = keys.parse({} if values is None else values)
        parsed = {}
        for name, schema in fields.items():
            parsed.update(schema.parse({name: source[name]} if name in source else {}))
        if any(not isinstance(parsed.get(name), dict) for name in ("params", "query", "headers")):
            raise ValueError("Dependency params, query and headers must be objects")
        selected = next(((variant, path) for variant in [view["path"], *view["pathVariants"]] if (path := _fill(variant, parsed["params"])) is not None), None)
        if selected is None: raise ValueError("Dependency route parameters do not select a path")
        return view, operation, parsed, selected[1], selected[0], output


class ServiceClients:
    """One lazy connection pool per service; shutdown cancels its pending calls."""
    def __init__(self, service: Service):
        self._service = service
        self._http: httpx.AsyncClient | None = None
        self._pending: set[asyncio.Task[Any]] = set()
        self._closed = False

    def scope(self, tenant_id: str, app_id: str) -> RequestClients:
        """Background callers may use declared service-mode dependencies only."""
        return RequestClients(self, tenant_id, app_id)

    async def _send(self, client: Client, identifier: str, values: Any) -> Any:
        if self._closed: raise ClientError(503, "Dependency client is closed")
        task = asyncio.current_task(); assert task is not None
        self._pending.add(task)
        try:
            view, operation, parsed, path, variant, output = client._contract._prepare(identifier, values)
            state, scope = client._context._current()
            origin, headers = client._authorize(state, scope, view, operation, variant)
            if any(not isinstance(value, (str, int, float, bool)) for value in parsed["headers"].values()):
                raise ValueError("Dependency header values must be strings, numbers or booleans")
            custom = {name: _scalar(value) for name, value in parsed["headers"].items()}
            RawResponse(headers=custom)
            forbidden = {"authorization", "cookie", "set-cookie", "host", "origin", "referer", "accept", "accept-encoding", "content-type", "content-encoding"}
            if len({name.lower() for name in custom}) != len(custom) or any(name.lower() in forbidden or name.lower().startswith("x-bp-") for name in custom):
                raise ValueError("Dependency headers cannot replace framework credentials or routing")
            headers.update(custom)
            pairs = []
            for name, value in parsed["query"].items():
                if value is None: continue
                for item in value if isinstance(value, list) else [value]:
                    if item is None: continue
                    pairs.append((name, _scalar(item)))
            address = origin + path + ("?" + urlencode(pairs) if pairs else "")
            data = json.dumps(parsed["body"], ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() if "body" in parsed else None
            if len(address) > 8192 or data is not None and len(data) > 16 * 1024 * 1024:
                raise ValueError("Dependency request exceeds its size limit")
            if data is not None and operation["method"] in ("GET", "HEAD"):
                raise ValueError("Dependency GET/HEAD requests cannot carry a body")
            if data is not None: headers["content-type"] = "application/json"
            headers["accept"] = "application/json"
            headers["accept-encoding"] = "identity"
            if self._http is None:
                self._http = httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=30, cookies=CookieJar(policy=_NoCookies()))
            async def request():
                async with self._http.stream(operation["method"], address, content=data, headers=headers) as response:
                    if not 200 <= response.status_code < 300:
                        raise ClientError(response.status_code, "Dependency returned an unsuccessful status")
                    if response.status_code not in (204, 205) and response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                        raise ClientError(502, "Dependency did not return JSON")
                    if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
                        raise ClientError(502, "Dependency returned unsupported content encoding")
                    body = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        if len(body) + len(chunk) > 16 * 1024 * 1024: raise ClientError(502, "Dependency response exceeds its size limit")
                        body.extend(chunk)
                    client._context._current(expected=state)
                    return output.parse(None if response.status_code in (204, 205) and not body else loads(body.decode("utf-8")))
            try: return await asyncio.wait_for(request(), 30)
            except ClientError: raise
            except Exception: raise ClientError(502, "Dependency request or response validation failed") from None
        finally: self._pending.discard(task)

    async def aclose(self) -> None:
        self._closed = True
        tasks = tuple(self._pending - {asyncio.current_task()})
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if self._http is not None: await self._http.aclose()


class RequestClients:
    """Opaque request binding; bearer credentials never enter render contexts."""
    def __init__(self, owner: ServiceClients, tenant_id: str, app_id: str, *, revision: _Snapshot | None = None, user_token: str | None = None):
        self._owner, self._tenant, self._app = owner, tenant_id, app_id
        self._revision, self._user_token = revision, user_token

    def _current(self, expected: _Snapshot | None = None) -> tuple[_Snapshot, ScopedContext]:
        service = self._owner._service
        state = service._state
        if not service.ready or state is None or self._revision is not None and state is not self._revision or expected is not None and state is not expected:
            raise ClientError(503, "Dependency configuration is unavailable or changed")
        if service._tenant_lock is not None and self._tenant != service._tenant_lock:
            raise ClientError(403, "Dependency tenant is not allowed")
        scope = state.snapshot.by_id(self._tenant, self._app)
        if scope is None: raise ClientError(403, "Dependency tenant/app is unavailable")
        return state, scope

    def user(self, contract: ClientContract, service_id: str | None = None) -> Client:
        if self._revision is None: raise ValueError("User clients require a service request context")
        return Client(self, contract, service_id=service_id or contract.plugin_id)

    def m2m(self, request_id: str, contract: ClientContract) -> Client:
        return Client(self, contract, request_id=request_id)


class Client:
    def __init__(self, context: RequestClients, contract: ClientContract, *, service_id: str | None = None, request_id: str | None = None):
        self._context, self._contract = context, contract
        self._service_id, self._request_id = service_id, request_id

    async def request(self, operation_id: str, values: Any = None) -> Any:
        return await self._context._owner._send(self, operation_id, values)

    def _authorize(self, state: _Snapshot, scope: ScopedContext, view: dict[str, Any], operation: dict[str, Any], path: str) -> tuple[str, dict[str, str]]:
        service = self._context._owner._service
        if self._request_id is None:
            assert self._service_id is not None
            reference = service.registry.dependencies.get(self._service_id, self._service_id)
            targets = [item for item in scope.tenant["services"] if item["enabled"] and reference in (item["id"], item.get("serviceId")) and item.get("serviceId") == self._contract.plugin_id]
            if len(targets) != 1: raise ClientError(403, "Dependency service is unavailable or ambiguous")
            target = targets[0]
            if "user" not in operation["auth"]["callers"]: raise ClientError(403, "Dependency operation does not allow user calls")
            app = {**scope.app, "routes": scope.app.get("appRoutes", scope.app["routes"])}
            access = AppAccess(ScopedContext(scope.tenant, app, scope.origin_policy), [target["id"]])
            if not access.allows_operation(view["viewId"], operation["operationId"], operation["method"], path, service_id=target["id"]):
                raise ClientError(403, "Dependency operation is not mounted")
            origins = [origin for hostname in scope.app["hostnames"] for origin in _origins(hostname)]
            if not origins: raise ClientError(503, "Dependency app origin is unavailable")
            headers = {"origin": origins[0]}
            if self._context._user_token: headers["authorization"] = "Bearer " + self._context._user_token
            elif operation["auth"]["required"]: raise ClientError(401, "Dependency requires a BP user")
        else:
            requests = [item for item in service.manifest["m2mRequests"] if item["id"] == self._request_id]
            if len(requests) != 1: raise ClientError(403, "Dependency request is not uniquely declared")
            request = requests[0]; mode = request["mode"]
            if mode not in operation["auth"]["callers"] or operation["method"] not in request["methods"]:
                raise ClientError(403, "Dependency caller mode or method is not allowed")
            policy = state.config.get("m2m", {})
            bindings = [item for item in policy.get("bindings", []) if item["enabled"] and item["requestId"] == self._request_id
                and item["sourceServiceId"] in policy["localServiceIds"] and item["tenantId"] == scope.tenant_id
                and item.get("appId", scope.app_id) == scope.app_id and item["mode"] == mode
                and item["contractId"] == request["contractId"] and item["targetViewId"] == view["viewId"]]
            if len(bindings) != 1: raise ClientError(403, "Dependency binding is unavailable or ambiguous")
            binding = bindings[0]
            contracts = [item for item in self._contract._schema["manifest"]["apiContracts"] if item["id"] == binding["contractId"] and item["viewId"] == view["viewId"]
                         and operation["method"] in item["methods"] and mode in item["modes"]]
            if len(contracts) != 1 or binding["contractId"] not in [item["id"] for item in operation["apiContracts"]]:
                raise ClientError(403, "Dependency contract does not cover the operation")
            if not set(request["requiredCapabilities"]).issubset(contracts[0]["capabilities"]):
                raise ClientError(403, "Dependency contract capabilities are insufficient")
            required = {*request["permissions"], *contracts[0]["permissions"], *(permission for item in operation["auth"]["permissions"] for permission in item["permissions"])}
            grants = [item for item in policy.get("grants", []) if item["enabled"] and item["bindingId"] == binding["id"] and item["tenantId"] == scope.tenant_id
                and item.get("appId", scope.app_id) == scope.app_id and operation["method"] in item["methods"] and required.issubset(item["permissions"])]
            if not grants: raise ClientError(403, "Dependency grant is unavailable or insufficient")
            targets = [item for item in policy["services"] if item["id"] == binding["targetServiceId"] and item["serviceId"] == self._contract.plugin_id]
            if len(targets) != 1: raise ClientError(403, "Dependency target is unavailable or ambiguous")
            target = targets[0]
            key, identity = service._signing_key, state.config.get("serviceIdentity", {})
            if key is None or identity.get("keyId") != key.kid or "".join(identity.get("publicKeyPem", "").split()) != "".join(key.public_key_pem.split()):
                raise ClientError(503, "Dependency signing identity is not registered")
            headers = {"x-bp-service-id": binding["sourceServiceId"], "x-bp-tenant-id": scope.tenant_id, "x-bp-app-id": scope.app_id}
            now = int(time.time())
            token = sign_token(key, {"iss": binding["sourceServiceId"], "sub": binding["sourceServiceId"], "aud": target["id"],
                "tenantId": scope.tenant_id, "appId": scope.app_id, "bindingId": binding["id"], "iat": now, "exp": now + 60, "jti": uuid7(), "tokenType": "service"}, TokenPurpose.SERVICE)
            if mode == "delegated":
                if not self._context._user_token or self._context._revision is None: raise ClientError(401, "Delegated dependency calls require a BP user")
                headers.update(authorization="Bearer " + self._context._user_token)
                headers["x-bp-service-authorization"] = "Bearer " + token
            else: headers["authorization"] = "Bearer " + token
        endpoint = secure_endpoint(target["hostname"])
        return http_origin(endpoint, allow_path=True) + httpx.URL(endpoint).raw_path.decode("ascii").rstrip("/"), headers
