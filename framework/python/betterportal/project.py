"""Local dependency resolution and frozen native builds from BP project files."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any

from .clientgen import generate_client
from .contracts import parse
from .jsoncodec import loads


def _read(path: Path) -> bytes:
    with path.open("rb") as file: data = file.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024: raise ValueError("Project document exceeds its size limit")
    return data


def _json(data: bytes) -> Any: return loads(data.decode("utf-8"))
def _digest(data: bytes) -> str: return "sha256:" + hashlib.sha256(data).hexdigest()


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and _read(path) == data: return
    descriptor, temporary = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as file:
            file.write(data); file.flush(); os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def _document(path: Path, value: Any) -> None:
    _write(path, (json.dumps(value, ensure_ascii=True, indent=2, allow_nan=False) + "\n").encode())


class Project:
    def __init__(self, directory: str | Path):
        self.directory = Path(directory).resolve()
        self.config = self._load("betterportal.json", "BetterPortalProjectConfigSchema", {})
        self.lock = self._load("betterportal.lock.json", "BetterPortalLockSchema", {})
        self._aliases(self.config.get("dependencies", {}))

    def _load(self, file: str, schema: str, default: Any) -> Any:
        path = self.directory / file
        return parse(schema, _json(_read(path)) if path.is_file() else default)

    @staticmethod
    def _aliases(values: Any) -> None:
        names: set[str] = set()
        for alias in values:
            parse("DependencyAliasSchema", alias)
            name = alias.replace("-", "_").lower()
            if name in names: raise ValueError("Dependency aliases produce colliding native filenames")
            names.add(name)

    def selector(self, value: str) -> tuple[str, str, str | None]:
        raw = value.strip()
        if not raw: raise ValueError("Dependency selector is required")
        identity, separator, version = raw.rpartition("@")
        if not separator: identity, version = raw, ""
        elif not identity or not version: raise ValueError("Incomplete dependency selector")
        if version and version != "latest": parse("SemverSchema", version)
        if "/" in identity: kind = "registryRef"; parse("RegistryReferenceSchema", identity)
        elif "." in identity: kind = "pluginId"; parse("PluginIdSchema", identity)
        elif self.config.get("defaultNamespace"):
            kind, identity = "registryRef", self.config["defaultNamespace"] + "/" + identity
            parse("RegistryReferenceSchema", identity)
        else:
            kind = "shortName"
            parse("RegistryReferenceSchema", "example/" + identity)
        return kind, identity, version or None

    @staticmethod
    def _matches(selector: tuple[str, str, str | None], registry_ref: str, contract: Any) -> bool:
        kind, identity, version = selector; manifest = contract["manifest"]
        actual = registry_ref if kind == "registryRef" else manifest["pluginId"] if kind == "pluginId" else registry_ref.split("/")[-1]
        matched = identity == actual or kind == "shortName" and identity == manifest["pluginId"].split(".")[-1]
        return matched and (version in (None, "latest") or version == manifest["version"])

    def local(self, selector: tuple[str, str, str | None], path: str | Path) -> tuple[Path, str, bytes, Any]:
        directory = (self.directory / path).resolve()
        if not directory.is_dir(): raise ValueError("A local dependency path must be a project directory")
        config_path = directory / "betterportal.json"
        config = parse("BetterPortalProjectConfigSchema", _json(_read(config_path)) if config_path.is_file() else {})
        reference = config.get("registryRef", selector[1] if selector[0] == "registryRef" else "")
        parse("RegistryReferenceSchema", reference)
        files = ([directory / "bp-contract.json"] if (directory / "bp-contract.json").is_file() else [])
        files += sorted((directory / "lib/bp-contracts").glob("*.json"))
        found = []
        for file in files:
            data = _read(file); contract = parse("BpSchemaOutputSchema", _json(data))
            if self._matches(selector, reference, contract): found.append((directory, reference, data, contract))
        if not found: raise ValueError("No local contract matches the dependency identity and version")
        if len({_digest(value[2]) for value in found}) != 1: raise ValueError("Local dependency is ambiguous; select an exact version")
        return found[0]

    def _cache(self, locked: Any) -> Path:
        return self.directory / ".betterportal/contracts" / locked["pluginId"] / (locked["version"] + ".json")

    def _output(self, alias: str) -> Path:
        return self.directory / "bp_dependencies" / ("dep_" + alias.replace("-", "_") + ".py")

    def add_local(self, value: str, path: str | Path, alias: str | None = None) -> Any:
        selector = self.selector(value)
        source, reference, data, contract = self.local(selector, path)
        alias = alias or reference.split("/")[1]
        dependencies = {**self.config.get("dependencies", {}), alias: reference + "@" + (selector[2] or contract["manifest"]["version"])}
        self._aliases(dependencies)
        locked = parse("LockedDependencySchema", {"registryRef": reference, "pluginId": contract["manifest"]["pluginId"],
            "version": contract["manifest"]["version"], "digest": _digest(data), "digestFormat": "json-bytes"})
        generated = generate_client(contract).encode()
        locals = self._load(".betterportal/local-lock.json", "LocalDependencyLockSchema", {})
        for name, other in self.lock["dependencies"].items():
            if name != alias and (other["pluginId"], other["version"]) == (locked["pluginId"], locked["version"]) and other["digest"] != locked["digest"]:
                # Migrating one alias can preserve another legacy pin when its cache is untouched.
                cache = self._cache(other)
                if "digestFormat" not in other and cache.is_file() and _digest(_read(cache)) == locked["digest"]: continue
                raise ValueError("Another dependency locks different content for this plugin and version")
        # Cache and generated code precede the lock update. An interrupted update fails frozen verification.
        _write(self._cache(locked), data)
        _write(self._output(alias), generated)
        self.config["dependencies"] = dependencies
        self.lock["dependencies"][alias] = locked
        locals[alias] = {**locked, "path": os.path.relpath(source, self.directory)}
        _document(self.directory / ".betterportal/local-lock.json", locals)
        _document(self.directory / "betterportal.json", self.config)
        _document(self.directory / "betterportal.lock.json", self.lock)
        return locked

    def frozen(self, *, check: bool = False) -> list[Path]:
        outputs = []
        # Validate the entire dependency set before updating any generated source.
        prepared = []
        for alias, value in self.config.get("dependencies", {}).items():
            locked = self.lock["dependencies"].get(alias)
            if locked is None: raise ValueError("Frozen dependency is not locked: " + alias)
            if locked.get("digestFormat") != "json-bytes": raise ValueError("Legacy locale-based lock requires explicit native dependency installation: " + alias)
            path = self._cache(locked)
            if not path.is_file(): raise ValueError("Frozen dependency is not cached: " + alias)
            data = _read(path)
            if _digest(data) != locked["digest"]: raise ValueError("Frozen dependency changed: " + alias)
            contract = parse("BpSchemaOutputSchema", _json(data))
            if contract["manifest"]["pluginId"] != locked["pluginId"] or contract["manifest"]["version"] != locked["version"] or not self._matches(self.selector(value), locked["registryRef"], contract):
                raise ValueError("Frozen dependency identity or version changed: " + alias)
            output = self._output(alias); generated = generate_client(contract).encode()
            if check and (not output.is_file() or _read(output) != generated): raise ValueError("Generated dependency is stale: " + alias)
            prepared.append((output, generated))
        for output, generated in prepared:
            if not check: _write(output, generated)
            outputs.append(output)
        return outputs
