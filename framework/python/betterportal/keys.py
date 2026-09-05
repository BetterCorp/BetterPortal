"""Configured JWKS trust, bounded HTTP loading, rotation and shutdown."""
from __future__ import annotations

import asyncio
import time
from typing import Any, Mapping
from urllib.parse import urlsplit

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from .contracts import parse
from .security import TokenError, _KID
from .jsoncodec import loads


def secure_endpoint(value: str, *, allow_query: bool = False) -> str:
    """BP control-plane/JWKS URLs: HTTPS, with exact loopback HTTP exceptions."""
    if not isinstance(value, str) or any(c.isspace() or ord(c) < 32 for c in value) or "\\" in value:
        raise ValueError("Invalid trusted endpoint")
    url = urlsplit(value)
    if (not url.hostname or url.username is not None or url.password is not None or url.fragment
            or (not allow_query and "?" in value) or "#" in value or url.port == 0
            or (url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1")))):
        raise ValueError("Endpoint requires HTTPS without userinfo, query or fragment (HTTP only on exact loopback)")
    return value


def public_keys(document: Mapping[str, Any]) -> dict[str, str]:
    parsed = parse("PublicJwksSchema", dict(document))
    if not 1 <= len(parsed["keys"]) <= 128:
        raise TokenError("JWKS must contain 1 to 128 keys")
    result = {}
    for jwk in parsed["keys"]:
        kid = jwk["kid"]
        if not _KID.fullmatch(kid) or kid in result:
            raise TokenError("Invalid or duplicate JWKS key ID")
        key = RSAAlgorithm.from_jwk(jwk)
        if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048:
            raise TokenError("JWKS RSA key is too small")
        result[kid] = key.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return result


class JwksClient:
    """One issuer/endpoint cache. Supply only URLs from trusted configuration."""
    def __init__(self, issuer: str, uri: str):
        if not issuer:
            raise ValueError("Issuer is required")
        self.issuer, self.uri = issuer, secure_endpoint(uri, allow_query=True)
        self._client = httpx.AsyncClient(follow_redirects=False, timeout=5, trust_env=False)
        self._keys: dict[str, str] = {}
        self._expires = self._next_attempt = 0.0
        self._generation = 0
        self._refresh: asyncio.Task[dict[str, str]] | None = None
        self._tasks: set[asyncio.Task[dict[str, str]]] = set()
        self._closed = False

    def invalidate(self) -> None:
        self._generation += 1
        self._keys = {}
        self._expires = self._next_attempt = 0
        self._refresh = None

    async def _load(self, generation: int) -> dict[str, str]:
        try:
            async with self._client.stream("GET", self.uri, headers={"Accept": "application/jwk-set+json, application/json"}) as response:
                if response.status_code != 200 or response.headers.get("content-type", "").split(";", 1)[0].strip().lower() not in (
                    "application/json", "application/jwk-set+json"
                ):
                    raise TokenError("JWKS endpoint returned an invalid status or content type")
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > 1024 * 1024:
                        raise TokenError("JWKS response exceeds 1 MiB")
                keys = public_keys(loads(content.decode("utf-8")))
            if generation != self._generation or self._closed:
                raise TokenError("JWKS cache was invalidated during refresh")
            self._keys, self._expires = keys, time.monotonic() + 1800
            return keys
        except TokenError:
            raise
        except Exception as error:
            raise TokenError("JWKS retrieval failed") from error
        finally:
            if generation == self._generation:
                self._next_attempt = time.monotonic() + 2

    async def resolve(self, kid: str) -> str:
        if self._closed:
            raise RuntimeError("JWKS client is closed")
        if not _KID.fullmatch(kid):
            raise TokenError("Invalid token key ID")
        if time.monotonic() < self._expires and kid in self._keys:
            return self._keys[kid]
        if self._refresh is None:
            if time.monotonic() < self._next_attempt:
                raise TokenError("JWKS key unavailable; refresh is throttled")
            self._next_attempt = time.monotonic() + 2
            task = asyncio.create_task(self._bounded_load(self._generation))
            self._refresh = task
            self._tasks.add(task)

            def finished(task: asyncio.Task[dict[str, str]]) -> None:
                self._tasks.discard(task)
                if self._refresh is task:
                    self._refresh = None
                if not task.cancelled():
                    task.exception()  # Observe failures if every waiter disconnected.
            task.add_done_callback(finished)
        # A disconnected request cancels its own wait, not other requests sharing the refresh.
        generation = self._generation
        keys = await asyncio.shield(self._refresh)
        if generation != self._generation:
            raise TokenError("JWKS cache was invalidated during lookup")
        if kid not in keys:
            raise TokenError("JWKS key not found")
        return keys[kid]

    async def _bounded_load(self, generation: int) -> dict[str, str]:
        try:
            return await asyncio.wait_for(self._load(generation), timeout=5)
        except asyncio.TimeoutError as error:
            raise TokenError("JWKS retrieval timed out") from error

    async def aclose(self) -> None:
        self._closed = True
        self.invalidate()
        tasks = tuple(self._tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self._client.aclose()

    async def __aenter__(self) -> JwksClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()
