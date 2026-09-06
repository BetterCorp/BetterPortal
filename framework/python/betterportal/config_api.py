"""Ticket-protected settings policy; Service coordinates snapshots and lifetime."""
from __future__ import annotations

from typing import Any, Iterable, Mapping
import hmac
import os
import time
import anyvali as av
from .contracts import parse
from .generated_types import ConfigSchemaDescriptorInput, ConfigSchemaDescriptor, ServiceConfigManagementMode
from .keys import JwksClient, secure_endpoint
from .security import TokenError, verify_config_ticket, CONFIG_TICKET_AUDIENCE, uuid7
from .settings import ServiceSettings, SettingsInputError


class ConfigApi:
    def __init__(self, settings: ServiceSettings | None = None, *, issuer: str | None = None, jwks_uri: str | None = None,
                 mode: ServiceConfigManagementMode | None = None, custom_ui_path: str | None = None, writable: bool = True, dev_token: str | None = None):
        if (issuer is None) != (jwks_uri is None): raise ValueError("Config tickets require both issuer and JWKS URI")
        self.settings = settings
        self._issuer = secure_endpoint(issuer) if issuer is not None else None
        self._keys = JwksClient(self._issuer, jwks_uri) if self._issuer is not None and jwks_uri is not None else None
        self._dev_token = dev_token if dev_token and os.environ.get("BP_ALLOW_DEV_CONFIG_TOKEN") == "true" else None
        self._options = {"mode": mode if mode is not None else ("hybrid" if settings is not None else "static"), "supportsWrite": settings is not None and writable,
                         "supportsCustomUi": custom_ui_path is not None, **({"customUiPath": custom_ui_path} if custom_ui_path is not None else {})}

    def schema(self, service_id: str, descriptors: Iterable[ConfigSchemaDescriptorInput | ConfigSchemaDescriptor]) -> dict[str, Any]:
        value = parse("ServiceConfigSchemaResponseSchema", {"serviceId": service_id, "configSchemas": list(descriptors), **self._options})
        if self.settings is not None and self.settings.schema.descriptors() != value["configSchemas"]:
            raise ValueError("Settings descriptors must match the service manifest")
        return value

    @property
    def ready(self) -> bool: return self.settings is None or self.settings.ready

    async def initialize(self) -> None:
        if self.settings is not None: await self.settings.initialize()

    async def authorize(self, service_id: str, headers: Mapping[str, str], action: str) -> dict[str, Any]:
        bearer = headers.get("authorization", "")
        if not bearer.startswith("Bearer "): raise TokenError("A valid config ticket is required")
        token = bearer[7:]
        if self._keys is not None and self._issuer is not None:
            try: return await verify_config_ticket(token, self._keys.resolve, issuer=self._issuer, service_id=service_id, action=action)
            except TokenError: pass
        if self._dev_token is not None and hmac.compare_digest(token.encode("utf-8"), self._dev_token.encode("utf-8")):
            now = int(time.time())
            try:
                return parse("ServiceConfigTicketClaimsSchema", {"iss": "betterportal-dev", "aud": [CONFIG_TICKET_AUDIENCE], "sub": "admin.dev",
                    "exp": now + 300, "iat": now, "jti": uuid7(), "realm": "control-plane", "tenantId": headers.get("x-bp-tenant-id", ""),
                    "serviceId": service_id, "actions": [action]})
            except av.ValidationError: pass
        raise TokenError("A valid config ticket is required")

    async def apply(self, service_id: str, snapshot: Mapping[str, Any], claims: Mapping[str, Any], headers: Mapping[str, str], action: str, body: Any) -> dict[str, Any]:
        from .service import RequestError
        if self.settings is None or action == "config.write" and not self._options["supportsWrite"]:
            raise RequestError(501, "Dynamic config operation is not supported")
        tenant_id = claims["tenantId"]
        if action == "config.write":
            try: request = parse("ServiceConfigWriteRequestSchema", body)
            except av.ValidationError as error: raise RequestError(400, "Invalid config write payload") from error
            if request["tenantId"] != tenant_id: raise RequestError(403, "Config ticket tenant mismatch")
            app_id = request.get("appId")
            if "x-bp-app-id" in headers and headers["x-bp-app-id"] != app_id:
                raise RequestError(403, "Config app header does not match the write")
        else: app_id = headers.get("x-bp-app-id")
        if "x-bp-tenant-id" in headers and headers["x-bp-tenant-id"] != tenant_id:
            raise RequestError(403, "Config tenant header does not match the ticket")
        if not any(tenant["id"] == tenant_id and tenant["active"] for tenant in snapshot["tenants"]):
            raise RequestError(403, "Config scope is not allowed")
        if app_id is not None and not any(app["id"] == app_id and app["tenantId"] == tenant_id for app in snapshot.get("configApps", snapshot["apps"])):
            raise RequestError(403, "Config scope is not allowed")
        if action == "config.write":
            try: values = await self.settings.write(tenant_id, request["values"], app_id=app_id, clear_keys=request["clearKeys"])
            except SettingsInputError as error: raise RequestError(400, "Invalid config values") from error
            values = self.settings.schema.redact("tenant" if app_id is None else "app", values)
        else: values = self.settings.values(tenant_id, app_id, redacted=True)
        return parse("ServiceConfigWriteResponseSchema" if action == "config.write" else "ServiceConfigReadResponseSchema", {
            "serviceId": service_id, "tenantId": tenant_id, **({"appId": app_id} if app_id is not None else {}),
            "values": values, **({"ok": True} if action == "config.write" else {})})

    async def aclose(self) -> None:
        try:
            if self._keys is not None: await self._keys.aclose()
        finally:
            if self.settings is not None: await self.settings.aclose()
