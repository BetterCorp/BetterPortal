"""Authenticated bootstrap state and persistent signing identity, independent of hosting."""
from __future__ import annotations

import asyncio
import base64
import json
import secrets
from typing import Any

import anyvali as av
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

from .contracts import contract, parse
from .encryption import _decode, _encode
from .jsoncodec import loads
from .keys import secure_endpoint
from .security import KeyPair
from .storage import StateStore

_LIMIT = 1024 * 1024


class BootstrapError(ValueError):
    """Invalid protected state; messages do not disclose credentials or key material."""


def _identity(value: dict[str, Any]) -> KeyPair:
    pair = KeyPair(value["privateKeyPem"], value["kid"])
    # Node persists SPKI. Comparing the whole normalized PEM also rejects appended
    # private material which permissive PEM parsers can otherwise ignore.
    if "".join(value["publicKeyPem"].split()) != "".join(pair.public_key_pem.split()):
        raise BootstrapError("Signing identity public/private keys do not match")
    return pair


def _state(value: Any) -> dict[str, Any]:
    try:
        result = parse("BootstrapStateSchema", value)
        for field in ("cpUrl", "cpJwksUri"):
            if field in result: secure_endpoint(result[field], allow_query=field == "cpJwksUri")
        if "apiKey" in result and (not result["apiKey"].isascii() or any(ord(c) < 33 or ord(c) == 127 for c in result["apiKey"])):
            raise ValueError()
        if "identity" in result: _identity(result["identity"])
        return result
    except (ValueError, TypeError, av.ValidationError):
        raise BootstrapError("Invalid bootstrap state") from None


class BootstrapCipher:
    """Node-compatible whole-state AES-GCM. Keep the master key in a protected host secret."""
    def __init__(self, key: str):
        try:
            if not isinstance(key, str) or not key.startswith("bp_bsk_") or len(_decode(key[7:], url=True)) != 32:
                raise ValueError()
            self._cipher = AESGCM(Scrypt(salt=b"bp-bootstrap-state-v1", length=32, n=16384, r=8, p=1).derive(key.encode()))
        except ValueError:
            raise BootstrapError("Invalid bootstrap master key") from None

    @staticmethod
    def generate_key() -> str: return "bp_bsk_" + _encode(secrets.token_bytes(32))

    def encrypt(self, value: Any) -> bytes:
        value = _state(value)
        plain = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
        if len(plain) > _LIMIT: raise BootstrapError("Bootstrap state exceeds 1 MiB")
        iv = secrets.token_bytes(12)
        encrypted = self._cipher.encrypt(iv, plain, None)
        envelope = {"v": 1, **{k: base64.b64encode(v).decode() for k, v in {"iv": iv, "tag": encrypted[-16:], "ct": encrypted[:-16]}.items()}}
        return json.dumps(parse("BootstrapStateEnvelopeSchema", envelope), separators=(",", ":")).encode()

    def decrypt(self, value: bytes) -> dict[str, Any]:
        try:
            if len(value) > 2 * _LIMIT: raise ValueError()
            envelope = parse("BootstrapStateEnvelopeSchema", loads(value.decode("utf-8")))
            iv, tag, ct = (_decode(envelope[k]) for k in ("iv", "tag", "ct"))
            if len(iv) != 12 or len(tag) != 16 or len(ct) > _LIMIT: raise ValueError()
            return _state(loads(self._cipher.decrypt(iv, ct + tag, None).decode("utf-8")))
        except (ValueError, TypeError, InvalidTag, av.ValidationError):
            raise BootstrapError("Bootstrap state authentication failed") from None


class BootstrapStateStore:
    """One owner per state store. Each operation reloads state; failed writes never publish it.

    Cancellation belongs to the calling task. No background work or plaintext cache is retained.
    """
    def __init__(self, store: StateStore, key: str):
        self._store, self._cipher = store, BootstrapCipher(key)
        self._gate = asyncio.Lock()

    async def _read(self) -> dict[str, Any]:
        raw = await self._store.load()
        return {"version": 1} if raw is None else self._cipher.decrypt(raw)

    async def read(self, *, redacted: bool = False) -> dict[str, Any]:
        async with self._gate:
            value = await self._read()
            if not redacted: return value
            paths = []
            def redact(path, _value):
                paths.append(path)
                return "encrypted:redacted"
            # AnyVali requires encrypted markers during traversal. Replace only the
            # paths it identified in this canonical object (which has no unions).
            result = av.encrypt(contract("BootstrapStateSchema"), value, redact)
            for path in paths:
                parent = result
                for part in path[:-1]: parent = parent[part]
                parent[path[-1]] = "__redacted__"
            return result

    async def write(self, patch: dict[str, Any]) -> dict[str, Any]:
        patch = _state({"version": 1, **patch})
        async with self._gate:
            value = _state({**await self._read(), **patch})
            await self._store.save(self._cipher.encrypt(value))
            return value

    async def clear(self) -> None:
        async with self._gate:
            await self._store.save(self._cipher.encrypt({"version": 1}))

    async def identity(self) -> KeyPair:
        async with self._gate:
            value = await self._read()
            if "identity" in value: return _identity(value["identity"])
            pair = KeyPair.generate()
            value["identity"] = {"privateKeyPem": pair.private_key_pem, "publicKeyPem": pair.public_key_pem, "kid": pair.kid}
            await self._store.save(self._cipher.encrypt(value))
            return pair
