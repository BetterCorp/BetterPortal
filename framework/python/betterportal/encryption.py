"""BP configuration envelopes using native scrypt/AES-GCM and AnyVali validation."""
from __future__ import annotations

import base64
import json
import secrets
from typing import Any, Iterable, Literal

import anyvali as av
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

from .contracts import parse
from .jsoncodec import loads

Scope = Literal["tenant", "app"]
_LIMIT = 1024 * 1024
_PREVIEW = "encrypted:bp-aes256gcm-v1:"
_KEY = "bp_pck_"
_PREFIXES = {"enc:aes256gcm:": (16, 16384), "enc:aes256gcm2:": (12, 32768), "enc:aes256gcm3:": (12, 32768)}


class ConfigEncryptionError(ValueError):
    """Invalid configuration ciphertext; messages never contain values or keys."""


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value: str, *, url: bool = False) -> bytes:
    if not value or len(value) > 2 * _LIMIT:
        raise ConfigEncryptionError("Invalid configuration envelope")
    try:
        data = base64.b64decode(value + ("=" * (-len(value) % 4) if url else ""), altchars=b"-_" if url else None, validate=True)
        if (_encode(data) if url else base64.b64encode(data).decode("ascii")) != value:
            raise ValueError()
        return data
    except (ValueError, UnicodeError):
        raise ConfigEncryptionError("Invalid configuration encoding") from None


def _bounded(value: bytes) -> bytes:
    if len(value) > _LIMIT:
        raise ConfigEncryptionError("Configuration value exceeds 1 MiB")
    return value


class ConfigCipher:
    """One service key; new strings use v2, other JSON values v3, v1 is read-only."""
    def __init__(self, secret: str):
        material = secret.encode("utf-8")
        if not 32 <= len(material) <= 4096:
            raise ConfigEncryptionError("Use a service-generated key of at least 256 bits")
        # Per-instance key derivation avoids both repeated scrypt work and a global secret cache.
        self._keys = {cost: AESGCM(Scrypt(salt=b"bp-config-store", length=32, n=cost, r=8, p=1).derive(material))
                      for cost in (16384, 32768)}

    @staticmethod
    def generate_key() -> str:
        return _encode(secrets.token_bytes(32))

    def encrypt(self, value: Any) -> str:
        value = parse("JsonValueSchema", value)
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        nonce = secrets.token_bytes(12)
        payload = self._keys[32768].encrypt(nonce, _bounded(text.encode("utf-8")), None)
        prefix = "enc:aes256gcm2:" if isinstance(value, str) else "enc:aes256gcm3:"
        return prefix + base64.b64encode(nonce + payload[-16:] + payload[:-16]).decode("ascii")

    def decrypt(self, value: str) -> Any:
        prefix = next((prefix for prefix in _PREFIXES if isinstance(value, str) and value.startswith(prefix)), None)
        if prefix is None:
            raise ConfigEncryptionError("Unknown configuration envelope")
        length, cost = _PREFIXES[prefix]
        payload = _decode(value[len(prefix):])
        if not length + 16 <= len(payload) <= _LIMIT + length + 16:
            raise ConfigEncryptionError("Invalid configuration envelope length")
        try:
            plain = self._keys[cost].decrypt(payload[:length], payload[length + 16:] + payload[length:length + 16], None).decode("utf-8")
            return parse("JsonValueSchema", loads(plain) if prefix == "enc:aes256gcm3:" else plain)
        except (InvalidTag, ValueError, UnicodeError, av.ValidationError):
            raise ConfigEncryptionError("Configuration authentication failed") from None


def generate_preview_key() -> str:
    return _KEY + _encode(secrets.token_bytes(32))


def _preview_key(value: str) -> bytes:
    if not value.startswith(_KEY):
        raise ConfigEncryptionError("Invalid preview key")
    key = _decode(value[len(_KEY):], url=True)
    if len(key) != 32:
        raise ConfigEncryptionError("Invalid preview key length")
    return key


def _aad(scope: Scope, path: Iterable[str | int]) -> bytes:
    if scope not in ("tenant", "app"):
        raise ConfigEncryptionError("Invalid preview scope")
    parts = list(path)
    if any(not isinstance(part, (str, int)) or isinstance(part, bool) for part in parts):
        raise ConfigEncryptionError("Invalid preview field path")
    return ("betterportal.preview-config.v1\n" + scope + "\n" + ".".join(map(str, parts))).encode("utf-8")


def encrypt_preview_value(key: str, scope: Scope, path: Iterable[str | int], value: str) -> str:
    if not isinstance(value, str):
        raise ConfigEncryptionError("Preview values must be strings")
    nonce = secrets.token_bytes(12)
    payload = AESGCM(_preview_key(key)).encrypt(nonce, _bounded(value.encode("utf-8")), _aad(scope, path))
    return _PREVIEW + _encode(nonce) + ":" + _encode(payload)


def decrypt_preview_value(key: str, scope: Scope, path: Iterable[str | int], value: str) -> str:
    if not isinstance(value, str) or not value.startswith(_PREVIEW):
        raise ConfigEncryptionError("Unknown preview envelope")
    parts = value[len(_PREVIEW):].split(":")
    if len(parts) != 2:
        raise ConfigEncryptionError("Invalid preview envelope")
    nonce, payload = (_decode(part, url=True) for part in parts)
    if len(nonce) != 12 or not 16 <= len(payload) <= _LIMIT + 16:
        raise ConfigEncryptionError("Invalid preview envelope length")
    try:
        return AESGCM(_preview_key(key)).decrypt(nonce, payload, _aad(scope, path)).decode("utf-8")
    except (InvalidTag, ValueError, UnicodeError):
        raise ConfigEncryptionError("Preview authentication failed") from None


def preview_schema(descriptors: Iterable[dict[str, Any]], scope: Scope) -> av.BaseSchema[Any]:
    _aad(scope, [])
    fields: dict[str, av.BaseSchema[Any]] = {}
    required = []
    for descriptor in descriptors:
        for field in parse("ConfigSchemaDescriptorSchema", descriptor)["fields"]:
            if field["scope"] != scope:
                continue
            if field["key"] in fields:
                raise ValueError("Duplicate preview field")
            schema = av.string().max_length(255).describe(field["description"], title=field["title"], sensitive=field["visibility"] == "secret")
            fields[field["key"]] = schema if field["required"] else av.optional(schema)
            if field["required"]:
                required.append(field["key"])
    return av.object_(fields, required=required, unknown_keys="reject")


def encrypt_preview(schema: av.BaseSchema[Any], key: str, scope: Scope, values: Any) -> Any:
    return av.encrypt(schema, values, lambda path, value: encrypt_preview_value(key, scope, path, value))


def decrypt_preview(schema: av.BaseSchema[Any], key: str, scope: Scope, values: Any) -> Any:
    return av.decrypt(schema, values, lambda path, value: decrypt_preview_value(key, scope, path, value))
