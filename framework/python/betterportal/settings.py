"""Service settings field policy and native AnyVali sensitive-value transforms."""
from __future__ import annotations

from copy import deepcopy
import asyncio
import json
import secrets
from typing import Any, Iterable, cast

import anyvali as av
from .contracts import contract, object_document, parse
from .encryption import ConfigCipher, ConfigEncryptionError, Scope
from .generated_types import ConfigSchemaDescriptorInput, ConfigSchemaDescriptor
from .jsoncodec import loads
from .storage import StateStore

_REDACTED = "__redacted__"
_NATIVE = "encrypted:"
_BP = ("enc:aes256gcm:", "enc:aes256gcm2:", "enc:aes256gcm3:")
_MISSING = object()


class SettingsInputError(ValueError):
    """Invalid declared settings input, distinct from persistence/encryption failure."""


def _supported(document: dict[str, Any]) -> None:
    # AnyVali #128: refs bypass their own sensitive pipeline in all three SDKs.
    # Reject the unsafe declaration, including unused definitions; no data validator.
    pending = [document["root"], *document.get("definitions", {}).values()]
    while pending:
        node = pending.pop()
        if node["kind"] == "ref" and node.get("metadata", {}).get("sensitive"):
            raise ValueError("AnyVali #128: sensitive metadata requires a wrapper or definition, not a ref node")
        pending.extend(node.get("properties", {}).values())
        for key in ("items", "values", "valueSchema", "inner", "schema", "schemas", "variants", "allOf"):
            child = node.get(key)
            if isinstance(child, dict): pending.append(child)
            elif isinstance(child, list): pending.extend(child)


def _at(value: Any, path: tuple[str | int, ...]) -> Any:
    for part in path:
        if isinstance(value, dict) and part in value: value = value[part]
        elif isinstance(value, list) and isinstance(part, int) and 0 <= part < len(value): value = value[part]
        else: return _MISSING
    return value


def _put(value: Any, path: tuple[str | int, ...], replacement: Any) -> None:
    parent = _at(value, path[:-1])
    parent[path[-1]] = replacement


class SettingsSchema:
    """Compile descriptor fields from portable AnyVali documents, once per service.

    Field scopes control writes. Native schemas own values/defaults/recursion and
    nested unknown keys; descriptor visibility adds sensitive metadata.
    """
    def __init__(self, descriptors: Iterable[ConfigSchemaDescriptorInput | ConfigSchemaDescriptor]):
        self._descriptors = [parse("ConfigSchemaDescriptorSchema", item) for item in descriptors]
        documents: dict[Scope, dict[str, dict[str, Any]]] = {"tenant": {}, "app": {}}
        required: dict[Scope, list[str]] = {"tenant": [], "app": []}
        self._secrets: dict[Scope, set[str]] = {"tenant": set(), "app": set()}
        seen = set()
        for descriptor in self._descriptors:
            if descriptor["id"] in seen: raise ValueError("Duplicate settings descriptor")
            seen.add(descriptor["id"])
            document = av.export_schema(av.import_schema(descriptor["jsonSchema"]))
            _supported(document)
            root = document["root"]
            if root["kind"] != "object" or root.get("metadata", {}).get("sensitive"):
                raise ValueError("Settings descriptors require an AnyVali object with individual fields")
            fields = descriptor["fields"]
            if len({field["key"] for field in fields}) != len(fields) or {field["key"] for field in fields} != set(root["properties"]):
                raise ValueError("Settings descriptor fields must match its AnyVali properties")
            for field in fields:
                scope, key = cast(Scope, field["scope"]), field["key"]
                if key in documents[scope]: raise ValueError("Duplicate settings field in one scope")
                child = deepcopy(document); child["root"] = deepcopy(root["properties"][key])
                node = child["root"]
                if "defaultValue" in field:
                    # The native schema remains the single source of defaults.
                    if "default" not in node or field["defaultValue"] != node["default"]:
                        raise ValueError("Descriptor defaultValue must match the AnyVali field default")
                if field["visibility"] == "secret":
                    # A one-branch union gives bare refs a native sensitive pipeline
                    # without making required fields optional or widening their values.
                    if node["kind"] == "ref":
                        child["root"] = node = {"kind": "union", "variants": [node], **({"default": deepcopy(node["default"])} if "default" in node else {})}
                    node["metadata"] = {**node.get("metadata", {}), "sensitive": True}
                while True:
                    if node.get("metadata", {}).get("sensitive"): self._secrets[scope].add(key)
                    if node["kind"] not in ("optional", "nullable"): break
                    node = node.get("inner", node.get("schema"))
                documents[scope][key] = child
                if key in root.get("required", []): required[scope].append(key)
        self._full: dict[Scope, av.BaseSchema[Any]] = {}
        self._partial: dict[Scope, av.BaseSchema[Any]] = {}
        self._names = {scope: frozenset(fields) for scope, fields in documents.items()}
        for scope, properties in documents.items():
            # BP rejects undeclared top-level fields below. An allow container lets
            # each nested schema retain its own unknown-key policy in every SDK.
            document = object_document(properties, unknown_keys="allow")
            document["root"]["required"] = required[scope]
            self._full[scope] = av.import_schema(document)
            for key, child in document["root"]["properties"].items():
                node = child
                while True:
                    node.pop("default", None)
                    if node["kind"] not in ("optional", "nullable"): break
                    node = node.get("inner", node.get("schema"))
                document["root"]["properties"][key] = {"kind": "optional", "inner": child}
            document["root"]["required"] = []
            self._partial[scope] = av.import_schema(document)

    def descriptors(self) -> list[dict[str, Any]]: return deepcopy(self._descriptors)

    def _check(self, scope: Scope, values: Any) -> None:
        if scope not in self._names or not isinstance(values, dict) or any(key not in self._names[scope] for key in values):
            raise ValueError("Unknown settings field or scope")

    def values(self, scope: Scope, values: Any, *, partial: bool = True) -> dict[str, Any]:
        self._check(scope, values)
        return cast(dict[str, Any], (self._partial if partial else self._full)[scope].parse(values))

    def encode(self, scope: Scope, values: Any, cipher: ConfigCipher) -> dict[str, Any]:
        self._check(scope, values)
        paths = set()
        def encrypt(path, value):
            paths.add(tuple(path))
            return _NATIVE + cipher.encrypt(value)
        encrypted = av.encrypt(self._partial[scope], values, encrypt)
        # Only top-level sensitive fields use Node's legacy marker. Nested native
        # sensitive nodes keep AnyVali's marker; no arbitrary strings are rewritten.
        for key in self._secrets[scope]:
            value = encrypted.get(key)
            if value is not None and (key,) not in paths: raise ConfigEncryptionError("Sensitive setting was not encrypted")
            if (key,) in paths: encrypted[key] = value[len(_NATIVE):]
        return cast(dict[str, Any], encrypted)

    def decode(self, scope: Scope, values: Any, cipher: ConfigCipher) -> dict[str, Any]:
        self._check(scope, values)
        data = deepcopy(values)
        for key in self._secrets[scope]:
            value = data.get(key)
            if isinstance(value, str) and value.startswith(_BP): data[key] = _NATIVE + value
        def decrypt(path, value):
            if not isinstance(value, str) or not value.startswith(_NATIVE): raise ConfigEncryptionError("Invalid encrypted setting")
            return cipher.decrypt(value[len(_NATIVE):])
        return cast(dict[str, Any], av.decrypt(self._partial[scope], data, decrypt))

    def _redact(self, scope: Scope, values: Any) -> tuple[dict[str, Any], set[tuple[str | int, ...]]]:
        self._check(scope, values)
        markers: dict[tuple[str | int, ...], str] = {}
        def sensitive(path, value):
            marker = _NATIVE + secrets.token_hex(32)
            markers[tuple(path)] = marker
            return marker
        result = av.encrypt(self._partial[scope], values, sensitive)
        # Union validation may invoke callbacks in rejected branches. Only markers
        # retained in the parsed result identify secrets in the selected branch.
        paths = {path for path, marker in markers.items() if _at(result, path) == marker}
        # Native nullable schemas do not transform null. BP's config API still
        # redacts every present field explicitly declared secret, including null.
        paths.update((key,) for key in self._secrets[scope] if key in result)
        for path in paths: _put(result, path, _REDACTED)
        return result, paths

    def redact(self, scope: Scope, values: Any) -> dict[str, Any]: return self._redact(scope, values)[0]

    def merge(self, scope: Scope, current: Any, values: Any, clear_keys: Iterable[str] = ()) -> dict[str, Any]:
        self._check(scope, values)
        result = self.values(scope, current)
        for key in clear_keys:
            if key not in self._names[scope]: raise ValueError("Unknown settings field or scope")
            result.pop(key, None)
        previous = deepcopy(result)
        _, old_paths = self._redact(scope, previous)
        result.update(deepcopy(values))
        restored = set()
        for path in old_paths:
            if _at(result, path) == _REDACTED:
                _put(result, path, deepcopy(_at(previous, path))); restored.add(path)
        result = self.values(scope, result)
        _, paths = self._redact(scope, result)
        if not restored.issubset(paths) or any(_at(result, path) == _REDACTED for path in paths):
            raise ValueError("Redaction placeholder has no matching stored secret")
        return result

    def effective(self, tenant: Any, app: Any) -> dict[str, Any]:
        values = self.values("tenant", tenant, partial=False)
        self._check("app", app)
        inherited = {key: value for key, value in values.items() if key in self._names["app"]}
        return {**values, **self.values("app", {**inherited, **app}, partial=False)}


class ServiceSettings:
    """One writer's encrypted tenant/app state. Credential/scope authorization belongs to Service.

    The store replaces complete documents atomically. No cross-replica cache
    invalidation or multi-writer coordination is implied by this local owner.
    """
    def __init__(self, schema: SettingsSchema, cipher: ConfigCipher, store: StateStore | None = None):
        self.schema, self._cipher, self._store = schema, cipher, store
        self._state: dict[str, Any] = {"tenants": {}}
        self._loaded = self._closed = False
        self._lock = asyncio.Lock()
        self._writers: set[asyncio.Task[Any]] = set()

    @property
    def ready(self) -> bool: return self._loaded and not self._closed

    def _open(self, *, loaded: bool = True) -> None:
        if self._closed or loaded and not self._loaded: raise RuntimeError("Settings are closed or not initialized")

    @staticmethod
    def _identity(tenant_id: str, app_id: str | None = None) -> None:
        contract("ServiceConfigWriteRequestSchema", "tenantId").parse(tenant_id)
        if app_id is not None: contract("ServiceConfigWriteRequestSchema", "appId").parse(app_id)

    def _bucket(self, state: dict[str, Any], tenant_id: str) -> dict[str, Any]:
        value = state["tenants"].get(tenant_id, {"tenant": {}, "app": {}})
        return {"tenant": self.schema.decode("tenant", value["tenant"], self._cipher),
                "app": {app_id: self.schema.decode("app", values, self._cipher) for app_id, values in value["app"].items()}}

    async def initialize(self, *, legacy_tenant_id: str | None = None) -> bool:
        """Validate the entire encrypted cache before publishing it; legacy ownership is explicit."""
        task = asyncio.current_task(); assert task is not None
        self._writers.add(task)
        try:
            async with self._lock:
                self._open(loaded=False)
                if self._loaded: return False
                data = await self._store.load() if self._store else None
                if data is not None and len(data) > 16 * 1024 * 1024: raise ValueError("Settings exceed 16 MiB")
                value = loads(data.decode("utf-8")) if data is not None else {"tenants": {}}
                if isinstance(value, dict) and "tenants" not in value and any(key in value for key in ("tenant", "app")) and set(value) <= {"tenant", "app"}:
                    value = {"tenants": {}, "legacy": value}
                state = parse("PersistedServiceConfigStateSchema", value)
                migrated = "legacy" in state
                if migrated:
                    if legacy_tenant_id is None: raise ValueError("Legacy settings require an explicit tenant owner")
                    self._identity(legacy_tenant_id)
                    if legacy_tenant_id in state["tenants"]: raise ValueError("Legacy settings conflict with an existing tenant")
                    state["tenants"][legacy_tenant_id] = state.pop("legacy")
                for tenant_id, bucket in state["tenants"].items():
                    self._identity(tenant_id)
                    for app_id in bucket["app"]: self._identity(tenant_id, app_id)
                    self._bucket(state, tenant_id)
                if migrated: await self._save(state)
                else: self._open(loaded=False)
                self._state, self._loaded = state, True
                return data is not None
        finally: self._writers.discard(task)

    async def _save(self, state: dict[str, Any]) -> None:
        data = json.dumps(state, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
        if len(data) > 16 * 1024 * 1024: raise ValueError("Settings exceed 16 MiB")
        if self._store is not None: await self._store.save(data)

    def read(self, tenant_id: str) -> dict[str, Any]:
        self._open(); self._identity(tenant_id)
        return self._bucket(self._state, tenant_id)

    def values(self, tenant_id: str, app_id: str | None = None, *, redacted: bool = False) -> dict[str, Any]:
        self._identity(tenant_id, app_id)
        bucket = self.read(tenant_id)
        values = bucket["tenant"] if app_id is None else bucket["app"].get(app_id, {})
        return self.schema.redact("tenant" if app_id is None else "app", values) if redacted else values

    def effective(self, tenant_id: str, app_id: str) -> dict[str, Any]:
        self._identity(tenant_id, app_id)
        bucket = self.read(tenant_id)
        return self.schema.effective(bucket["tenant"], bucket["app"].get(app_id, {}))

    async def write(self, tenant_id: str, values: dict[str, Any], *, app_id: str | None = None, clear_keys: Iterable[str] = ()) -> dict[str, Any]:
        try:
            request = parse("ServiceConfigWriteRequestSchema", {"tenantId": tenant_id, "values": values,
                "clearKeys": list(clear_keys), **({"appId": app_id} if app_id is not None else {})})
        except (av.ValidationError, ValueError, TypeError) as error: raise SettingsInputError("Invalid settings request") from error
        task = asyncio.current_task(); assert task is not None
        self._writers.add(task)
        try:
            async with self._lock:
                self._open()
                scope: Scope = "tenant" if app_id is None else "app"
                current = self.values(tenant_id, app_id)
                try: merged = self.schema.merge(scope, current, request["values"], request["clearKeys"])
                except (av.ValidationError, ValueError, TypeError) as error: raise SettingsInputError("Invalid settings values") from error
                encrypted = self.schema.encode(scope, merged, self._cipher)
                state = deepcopy(self._state)
                bucket = state["tenants"].setdefault(tenant_id, {"tenant": {}, "app": {}})
                if app_id is None: bucket["tenant"] = encrypted
                else: bucket["app"][app_id] = encrypted
                await self._save(state)
                # No suspension between durable commit and in-memory publication.
                self._state = state
                return deepcopy(merged)
        finally: self._writers.discard(task)

    async def aclose(self) -> None:
        self._closed = True
        writers = tuple(self._writers - {asyncio.current_task()})
        for task in writers: task.cancel()
        await asyncio.gather(*writers, return_exceptions=True)
        async with self._lock: self._state = {"tenants": {}}

    async def __aenter__(self) -> ServiceSettings:
        await self.initialize()
        return self

    async def __aexit__(self, *args: Any) -> None: await self.aclose()
