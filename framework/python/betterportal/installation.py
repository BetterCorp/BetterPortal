"""Pinned control-plane installation, credential persistence and sync ownership."""
from __future__ import annotations

import asyncio
import json
import math
from datetime import datetime, timezone
from typing import Any, cast

import anyvali as av
import httpx

from .bootstrap import BootstrapStateStore
from .config_api import ConfigApi
from .context import ScopedConfig, http_origin
from .contracts import parse
from .encryption import ConfigCipher
from .generated_types import AuthProviderRuntimeMetadataInput, ServiceConfigManagementMode
from .jsoncodec import loads
from .keys import JwksClient, secure_endpoint
from .security import KeyPair, TokenError, TokenPurpose, verify_token
from .service import RequestError, Service
from .settings import ServiceSettings, SettingsSchema
from .storage import StateStore
from .sync import ControlPlaneSync, build_submission


class ServiceInstallation:
    """One installation owner. Trust and the public service address come from host configuration.

    The host starts/closes this owner before closing its Service. Reconfiguration
    can rotate credentials for the same instance. Changing the configured public
    address pauses activation until the configured CP confirms a hostname token.
    """
    def __init__(self, service: Service, state: BootstrapStateStore, cp_url: str, service_url: str, *,
                 settings_store: StateStore | None = None, cp_jwks_uri: str | None = None,
                 auth_provider: AuthProviderRuntimeMetadataInput | None = None,
                 config_mode: ServiceConfigManagementMode | None = None, custom_ui_path: str | None = None,
                 writable: bool = True, retry_delay: float = 5, request_timeout: float = 30):
        if not service.managed or not service._provisionable: raise ValueError("Installation requires an unprovisioned managed Service")
        self.service, self._store = service, state
        self._cp = secure_endpoint(cp_url).rstrip("/")
        self._address = http_origin(secure_endpoint(service_url))
        self._jwks = secure_endpoint(cp_jwks_uri or self._cp + "/.well-known/jwks.json", allow_query=True)
        if any(not math.isfinite(value) or not 0 < value <= 4294967.294 for value in (retry_delay, request_timeout)):
            raise ValueError("Invalid installation timing")
        self._timeout, self._delay = request_timeout, retry_delay
        descriptors = service.manifest["configSchemas"]
        self._settings_schema = SettingsSchema(descriptors) if descriptors else None
        if descriptors and settings_store is None: raise ValueError("Installed settings require an explicit state store")
        self._settings_store = settings_store
        self._config_options = {"mode": config_mode, "custom_ui_path": custom_ui_path, "writable": writable}
        self._provider = parse("AuthProviderRuntimeMetadataSchema", auth_provider) if auth_provider is not None else None
        self._keys = JwksClient(self._cp, self._jwks)
        self._client = httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=request_timeout)
        self._gate = asyncio.Lock()
        self._writers: set[asyncio.Task[Any]] = set()
        self._identity: KeyPair | None = None
        self._sync: ControlPlaneSync | None = None
        self._closed = self._started = self._provisioned = self._installed = False

    @property
    def identity(self) -> KeyPair:
        if self._closed or self._identity is None: raise RuntimeError("Installation identity is not available")
        return self._identity

    def jwks(self) -> dict[str, Any]: return {"keys": [self.identity.public_jwk()]}

    @property
    def installed(self) -> bool: return self._installed

    @property
    def status(self) -> dict[str, Any]:
        return {"installed": self._installed, "closed": self._closed, "sync": self._sync.status if self._sync else None}

    def _binding(self, value: Any, *, check_address: bool = True) -> dict[str, Any]:
        binding = parse("ServiceInstallationBindingSchema", value)
        origin = http_origin(secure_endpoint(binding["serviceUrl"]))
        if (binding["cpUrl"].rstrip("/") != self._cp or binding["cpJwksUri"] != self._jwks
                or check_address and origin != self._address):
            raise TokenError("Setup token does not match the configured installation")
        return binding

    def _credentials(self, value: dict[str, Any], *, check_address: bool = True) -> None:
        if value.get("cpUrl", "").rstrip("/") != self._cp or value.get("cpJwksUri", self._jwks) != self._jwks:
            raise ValueError("Stored credentials do not match the configured control plane")
        if "installation" in value:
            tenant = self._binding(value["installation"], check_address=check_address).get("scope", {}).get("tenantId")
            if tenant is not None and value.get("tenantLock", tenant) != tenant: raise ValueError("Stored installation tenant does not match its lock")

    async def _activate(self, value: dict[str, Any]) -> bool:
        self._credentials(value)
        self.service._suspend_sync()
        if self._sync is not None:
            previous = self._sync
            self._sync = None
            await previous.aclose()
        binding = value.get("installation", {})
        await self.service._bind_installation(binding.get("instanceId"), value.get("tenantLock", binding.get("scope", {}).get("tenantId")))
        # Construct/validate sync before mutating the service or attaching its credentials.
        sync = ControlPlaneSync(self.service, self._cp, value["apiKey"], key_pair=self.identity,
                                auth_provider=self._provider, retry_delay=self._delay, request_timeout=self._timeout)
        try:
            if not self._provisioned:
                settings = ServiceSettings(self._settings_schema, ConfigCipher(value["configEncryptionKey"]), self._settings_store) if self._settings_schema else None
                api = ConfigApi(settings, issuer=self._cp, jwks_uri=self._jwks, **cast(Any, self._config_options))
                await self.service._provision(api)
                self._provisioned = True
            self._sync = sync
            return await sync.start()
        except BaseException:
            await sync.aclose()
            self._sync = None
            raise

    async def start(self) -> bool:
        task = asyncio.current_task(); assert task is not None
        self._writers.add(task)
        try:
            async with self._gate:
                if self._closed or self._started: raise RuntimeError("Installation is closed or already started")
                self._started = True
                value = await self._store.read()
                if "apiKey" in value: self._credentials(value, check_address=False)
                self._identity = await self._store.identity()
                if "apiKey" not in value: return False
                self._installed = True
                if "installation" in value and http_origin(value["installation"]["serviceUrl"]) != self._address:
                    return False
                return await self._activate(value)
        finally: self._writers.discard(task)

    async def _post(self, path: str, payload: Any, schema: str, *, api_key: str | None = None, limit: int = 1024 * 1024) -> dict[str, Any]:
        headers = {"accept": "application/json"}
        if api_key is not None: headers["authorization"] = "Bearer " + api_key
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
        if len(data) > limit: raise ValueError("Control-plane request exceeds limit")
        async with self._client.stream("POST", self._cp + "/.well-known/bp/" + path, content=data,
                                       headers={**headers, "content-type": "application/json"}) as response:
            self._client.cookies.clear()
            if response.status_code in (400, 401, 403, 404, 409):
                raise RequestError(response.status_code, "Control plane rejected the request")
            if response.status_code != 200 or response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                raise ValueError("Invalid control-plane response")
            buffer = bytearray()
            async for chunk in response.aiter_bytes(chunk_size=8192):
                if len(buffer) + len(chunk) > limit: raise ValueError("Control-plane response exceeds limit")
                buffer.extend(chunk)
        return parse(schema, loads(buffer.decode("utf-8")))

    async def _redeem(self, token: str) -> dict[str, Any]:
        payload = {"setupToken": token, "pluginId": self.service.manifest["pluginId"], "serviceUrl": self._address, "jwks": self.jwks()}
        if self._provider is not None: payload["authProvider"] = self._provider
        value = await self._post("services/redeem", payload, "ServiceRedeemResponseSchema")
        if value["cpJwksUri"] != self._jwks or any(ord(c) < 33 or ord(c) > 126 for c in value["apiKey"]):
            raise ValueError("Invalid redemption credentials")
        return value

    async def change_hostname(self, body: Any) -> tuple[int, dict[str, Any]]:
        try: request = parse("ServiceHostnameChangeRequestSchema", body)
        except av.ValidationError: raise RequestError(400, "Invalid hostname-change request") from None
        task = asyncio.current_task(); assert task is not None
        self._writers.add(task)
        try:
            async with self._gate:
                if self._closed or not self._started: raise RequestError(503, "Installation is not available")
                value = await self._store.read()
                if "apiKey" not in value or "installation" not in value:
                    raise RequestError(409, "An installed service binding is required")
                self._credentials(value, check_address=False)
                binding = value["installation"]
                async def confirm():
                    result = await self._post("services/confirm-hostname-change", {**request, "serviceUrl": self._address},
                        "ServiceHostnameChangeResponseSchema", api_key=value["apiKey"])
                    if http_origin(secure_endpoint(result["serviceUrl"])) != self._address: raise ValueError("Unexpected confirmed address")
                    # A cached CP confirmation alone does not prove which instance owns
                    # it. Read the authenticated current projection before local commit.
                    snapshot = ScopedConfig(await self._post("sync/poll", build_submission(self.service.manifest,
                        key_pair=self.identity, auth_provider=self._provider), "ScopedServiceConfigSchema", api_key=value["apiKey"], limit=16 * 1024 * 1024)).document()
                    services = [item for tenant in snapshot["tenants"] for item in tenant["services"]] + snapshot.get("m2m", {}).get("services", [])
                    addresses = {http_origin(secure_endpoint(item["hostname"])) for item in services if item["id"] == binding["instanceId"]}
                    if snapshot.get("serviceIdentity", {}).get("id") != binding["instanceId"] or addresses != {self._address}:
                        raise ValueError("Control plane did not bind this instance to the configured address")
                    return result
                try: result = await asyncio.wait_for(confirm(), self._timeout)
                except RequestError: raise
                except Exception: raise RequestError(502, "Control-plane hostname confirmation failed") from None
                value = await self._store.write({"installation": {**binding, "serviceUrl": self._address}})
                return (200, result) if await self._activate(value) else (503, {"error": "Hostname confirmed; awaiting valid control-plane configuration", "installed": True})
        finally: self._writers.discard(task)

    async def install(self, body: Any) -> tuple[int, dict[str, Any]]:
        try: request = parse("ServiceInstallRequestSchema", body)
        except av.ValidationError: raise RequestError(400, "Invalid installation request") from None
        if request["cpUrl"].rstrip("/") != self._cp: raise RequestError(403, "Installation control plane does not match configured trust")
        task = asyncio.current_task(); assert task is not None
        self._writers.add(task)
        try:
            async with self._gate:
                if self._closed or not self._started: raise RequestError(503, "Installation is not available")
                try:
                    claims = await verify_token(request["setupToken"], self._keys.resolve, issuer=self._cp, audience=None, purpose=TokenPurpose.SETUP)
                    binding = self._binding({field: claims[field] for field in ("instanceId", "serviceUrl", "cpUrl", "cpJwksUri", "scope", "jti") if field in claims})
                except (TokenError, ValueError): raise RequestError(401, "A valid setup token for this installation is required") from None
                value = await self._store.read()
                tenant = binding.get("scope", {}).get("tenantId")
                if tenant is not None and value.get("tenantLock") is not None and tenant != value["tenantLock"]:
                    raise RequestError(409, "Setup cannot change the installed tenant")
                if "apiKey" in value:
                    self._credentials(value, check_address=False)
                    previous = value.get("installation")
                    if previous and http_origin(previous["serviceUrl"]) != self._address:
                        raise RequestError(409, "Confirm the configured hostname before reconfiguration")
                    expected = previous["instanceId"] if previous else (self.service.snapshot() or {}).get("serviceIdentity", {}).get("id")
                    if expected != binding["instanceId"]: raise RequestError(409, "Setup cannot replace the installed service instance")
                    if previous and previous["jti"] == binding["jti"]:
                        ready = self.service.ready if self._sync is not None else await self._activate(value)
                        return self._response(ready)
                try: credentials = await asyncio.wait_for(self._redeem(request["setupToken"]), self._timeout)
                except Exception: raise RequestError(502, "Control-plane redemption failed") from None
                value = await self._store.write({**credentials, "cpUrl": self._cp, "installation": binding,
                    **({"tenantLock": tenant} if tenant is not None else {}),
                    "configEncryptionKey": value.get("configEncryptionKey") or ConfigCipher.generate_key(),
                    "installedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")})
                self._installed = True
                return self._response(await self._activate(value))
        finally: self._writers.discard(task)

    def _response(self, ready: bool) -> tuple[int, dict[str, Any]]:
        if not ready: return 503, {"error": "Installed; awaiting valid control-plane configuration", "installed": True, "pluginId": self.service.manifest["pluginId"]}
        return 200, parse("ServiceInstallResponseSchema", {"ok": True, "pluginId": self.service.manifest["pluginId"],
                         "cpUrl": self._cp, "manifestVersion": self.service.manifest["version"]})

    async def aclose(self) -> None:
        self._closed = True
        self.service._suspend_sync()
        writers = tuple(self._writers - {asyncio.current_task()})
        for task in writers: task.cancel()
        await asyncio.gather(*writers, return_exceptions=True)
        async with self._gate:
            if self._sync is not None: await self._sync.aclose()
            await self._keys.aclose()
            await self._client.aclose()

    async def __aenter__(self) -> ServiceInstallation:
        try: await self.start()
        except BaseException:
            await self.aclose()
            raise
        return self

    async def __aexit__(self, *args: Any) -> None: await self.aclose()
