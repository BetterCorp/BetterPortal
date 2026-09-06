"""Service settings field policy and native AnyVali sensitive-value transforms."""
from __future__ import annotations

from copy import deepcopy
import secrets
from typing import Any, Iterable, cast

import anyvali as av
from .contracts import object_document, parse
from .encryption import ConfigCipher, ConfigEncryptionError, Scope
from .generated_types import ConfigSchemaDescriptorInput

_REDACTED = "__redacted__"
_NATIVE = "encrypted:"
_BP = ("enc:aes256gcm:", "enc:aes256gcm2:", "enc:aes256gcm3:")
_MISSING = object()


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
    def __init__(self, descriptors: Iterable[ConfigSchemaDescriptorInput]):
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
                    # BP visibility annotates a native wrapper, including when the
                    # authored field is a recursive reference. Value types stay native.
                    child["root"] = node = {"kind": "optional", "inner": node, "metadata": {"sensitive": True}}
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
