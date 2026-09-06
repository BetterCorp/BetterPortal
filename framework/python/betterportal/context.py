"""Validated scoped configuration and exact browser addressing, independent of ASGI."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import ipaddress
from typing import Any, Mapping, Iterable
from urllib.parse import urlsplit

import httpx
from .contracts import parse


def http_origin(value: str, *, allow_path: bool = False) -> str:
    if not isinstance(value, str) or len(value) > 8192 or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value) or "\\" in value:
        raise ValueError("Invalid HTTP address")
    raw = urlsplit(value)
    if raw.scheme not in ("http", "https") or not raw.netloc or "@" in raw.netloc or "%" in raw.netloc:
        raise ValueError("Invalid HTTP authority")
    if not allow_path and (raw.path not in ("", "/") or "?" in value or "#" in value):
        raise ValueError("Expected an origin without path, query or fragment")
    try:
        url = httpx.URL(value)
        host = url.raw_host.decode("ascii")
    except (httpx.InvalidURL, UnicodeError) as error:
        raise ValueError("Invalid HTTP address") from error
    if not host or url.port == 0:
        raise ValueError("Invalid HTTP authority")
    if ":" in host:
        host = "[" + ipaddress.IPv6Address(host).compressed + "]"
    port = url.port
    if port == (443 if url.scheme == "https" else 80):
        port = None
    return f"{url.scheme}://{host}" + (f":{port}" if port is not None else "")


def _origins(hostname: str) -> list[str]:
    return [http_origin(hostname)] if "://" in hostname else [http_origin("https://" + hostname), http_origin("http://" + hostname)]


def _referer(value: str) -> str:
    origin = http_origin(value, allow_path=True)
    if "#" in value:
        raise ValueError("Referer must not contain a fragment")
    path = httpx.URL(value).raw_path.decode("ascii")
    return origin + (path if path != "/" else "")


@dataclass(frozen=True)
class OriginPolicy:
    origins: frozenset[str]
    referers: frozenset[str]

    @classmethod
    def from_app(cls, app: Mapping[str, Any]) -> OriginPolicy:
        origins = {origin for hostname in app["hostnames"] for origin in _origins(hostname)}
        origins.update(http_origin(value) for value in app["originOverrides"])
        return cls(frozenset(origins), frozenset(origins | {_referer(value) for value in app["refererOverrides"]}))

    def allows(self, value: str | None, *, referer: bool = False) -> bool:
        if value is None:
            return False
        try:
            if referer:
                normalized = _referer(value)
                return normalized in self.referers or http_origin(value, allow_path=True) in self.referers
            return http_origin(value) in self.origins
        except ValueError:
            return False


@dataclass(frozen=True)
class ScopedContext:
    tenant: dict[str, Any]
    app: dict[str, Any]
    origin_policy: OriginPolicy

    @property
    def tenant_id(self) -> str:
        return self.tenant["id"]

    @property
    def app_id(self) -> str:
        return self.app["id"]


class ScopedConfig:
    """One validated snapshot. Request contexts own copies; replacement belongs to the provider."""
    def __init__(self, value: Mapping[str, Any]):
        self._snapshot = parse("ScopedServiceConfigSchema", deepcopy(dict(value)))
        self._tenants = self._index(self._snapshot["tenants"])
        self._apps = self._index(self._snapshot["apps"])
        self._hosts: dict[str, str] = {}
        self._policies = {}
        for tenant in self._tenants.values():
            self._index(tenant["services"])
        for app in self._apps.values():
            if app["tenantId"] not in self._tenants:
                raise ValueError("App refers to an unknown tenant")
            self._policies[app["id"]] = OriginPolicy.from_app(app)
            for hostname in app["hostnames"]:
                for origin in _origins(hostname):
                    if origin in self._hosts and self._hosts[origin] != app["id"]:
                        raise ValueError("App host is ambiguous")
                    self._hosts[origin] = app["id"]
        for app in self._snapshot.get("configApps", []):
            if app["tenantId"] not in self._tenants:
                raise ValueError("Config app refers to an unknown tenant")
        self._index(self._snapshot.get("configApps", []))
        for origin in self._snapshot["managementOrigins"]:
            http_origin(origin)

    @staticmethod
    def _index(values: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        result = {}
        for value in values:
            if value["id"] in result:
                raise ValueError("Duplicate scoped identity")
            result[value["id"]] = value
        return result

    def document(self) -> dict[str, Any]:
        return deepcopy(self._snapshot)

    def by_id(self, tenant_id: str, app_id: str) -> ScopedContext | None:
        app, tenant = self._apps.get(app_id), self._tenants.get(tenant_id)
        if app is None or tenant is None or not tenant["active"] or app["tenantId"] != tenant_id:
            return None
        return ScopedContext(deepcopy(tenant), deepcopy(app), self._policies[app_id])

    def resolve(self, headers: Mapping[str, str], *, scheme: str = "https", mode: str = "service",
                trusted_addresses: Iterable[str] = ()) -> ScopedContext | None:
        """Proxy addresses must already be verified by the host's proxy middleware.

        Raw proxy, tenant/app and HTMX headers never establish authority here.
        """
        if scheme not in ("http", "https") or mode not in ("service", "theme"):
            raise ValueError("Invalid request addressing mode")
        normalized = {key.lower(): value for key, value in headers.items()}
        if len(normalized) != len(headers):
            raise ValueError("Duplicate request headers")
        direct = [(scheme + "://" + normalized[key], False) for key in ("host", ":authority", "authority") if key in normalized]
        embedded = [(normalized[key], key == "referer") for key in ("origin", "referer") if key in normalized]
        trusted = [(value, False) for value in trusted_addresses]
        candidates = direct + trusted + embedded if mode == "theme" else embedded + direct + trusted
        if "alt-used" in normalized:
            candidates.append((scheme + "://" + normalized["alt-used"], False))
        for candidate, allow_path in candidates:
            try:
                origin = http_origin(candidate, allow_path=allow_path)
            except ValueError:
                continue
            app = self._apps.get(self._hosts.get(origin, ""))
            if app is not None:
                context = self.by_id(app["tenantId"], app["id"])
                if context is not None:
                    return context
        return None
