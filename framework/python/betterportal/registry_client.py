"""Bounded authoring requests to the existing BP contract registry."""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any
from urllib.parse import quote

import httpx

from .contracts import parse
from .jsoncodec import loads
from .keys import secure_endpoint


class RegistryClient:
    def __init__(self, url: str | None = None):
        self.url = secure_endpoint(url if url is not None else os.environ.get("BP_REGISTRY_URL", "https://io.betterportal.org")).rstrip("/")

    async def _request(self, path: str, data: bytes | None = None, token: str | None = None) -> tuple[bytes, httpx.Headers]:
        async def send() -> tuple[bytes, httpx.Headers]:
            headers = {"accept": "application/json", "accept-encoding": "identity"}
            if token is not None:
                if not 1 <= len(token) <= 32768 or any(ord(c) < 33 or ord(c) > 126 for c in token):
                    raise ValueError("Invalid registry token")
                headers["authorization"] = "Bearer " + token
            if data is not None:
                if len(data) > 16 * 1024 * 1024: raise ValueError("Registry request exceeds its size limit")
                headers["content-type"] = "application/json"
            # One request per client: no cookie persistence or environment proxy credentials.
            async with httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=30) as client:
                async with client.stream("GET" if data is None else "POST", self.url + path, headers=headers, content=data) as response:
                    if response.status_code not in ((200,) if data is None else (200, 201)):
                        raise ValueError(f"Registry request failed ({response.status_code})")
                    if response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json" or response.headers.get("content-encoding", "identity").lower() != "identity":
                        raise ValueError("Invalid registry response representation")
                    buffer = bytearray()
                    async for chunk in response.aiter_raw(chunk_size=8192):
                        if len(buffer) + len(chunk) > 16 * 1024 * 1024: raise ValueError("Registry response exceeds its size limit")
                        buffer.extend(chunk)
                    return bytes(buffer), response.headers
        return await asyncio.wait_for(send(), 30)

    async def lookup(self, kind: str, identity: str, version: str | None) -> tuple[str, bytes, Any]:
        if kind == "shortName":
            data, _ = await self._request("/v1/packages?name=" + quote(identity, safe=""))
            matches = parse("RegistryPackageListSchema", loads(data.decode("utf-8")))
            if len(matches) != 1 or matches[0]["registryRef"].split("/")[-1] != identity:
                raise ValueError("Registry selector is ambiguous or missing; use the full reference")
            kind, identity = "registryRef", matches[0]["registryRef"]
        path = "/v1/packages/" + identity if kind == "registryRef" else "/v1/plugin-ids/" + quote(identity, safe="")
        data, headers = await self._request(path + "/" + quote(version or "latest", safe="") + "/schema.json")
        reference = identity if kind == "registryRef" else headers.get("bp-registry-ref", "")
        parse("RegistryReferenceSchema", reference)
        contract = parse("BpSchemaOutputSchema", loads(data.decode("utf-8")))
        if kind == "pluginId" and contract["manifest"]["pluginId"] != identity or version not in (None, "latest") and contract["manifest"]["version"] != version:
            raise ValueError("Registry returned a different dependency identity or version")
        if headers.get("bp-registry-ref", reference) != reference:
            raise ValueError("Registry returned a different package reference")
        return reference, data, contract

    async def publish(self, reference: str, contract: Any, token: str) -> Any:
        parse("RegistryReferenceSchema", reference)
        contract = parse("BpSchemaOutputSchema", contract)
        data = json.dumps(contract, ensure_ascii=True, separators=(",", ":"), allow_nan=False).encode()
        response, _ = await self._request("/v1/packages/" + reference, data, token)
        result = parse("RegistryPublishResultSchema", loads(response.decode("utf-8")))
        if result["registryRef"] != reference or any(result[name] != contract["manifest"][name] for name in ("pluginId", "version")):
            raise ValueError("Registry publish response has a different identity or version")
        return result
