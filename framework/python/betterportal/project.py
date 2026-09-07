"""Local dependency resolution and frozen native builds from BP project files."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any
from anyvali import ValidationError

from .clientgen import generate_client
from .contracts import parse
from .jsoncodec import loads
from .registry_client import RegistryClient

_Candidate = tuple[Path, str, bytes, Any]


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

    def _local_candidates(self, selector: tuple[str, str, str | None], path: str | Path, *, strict: bool) -> list[_Candidate]:
        directory = (self.directory / path).resolve()
        try:
            if not directory.is_dir(): raise ValueError("A local dependency path must be a project directory")
            config_path = directory / "betterportal.json"
            config = parse("BetterPortalProjectConfigSchema", _json(_read(config_path)) if config_path.is_file() else {})
            reference = config.get("registryRef", selector[1] if strict and selector[0] == "registryRef" else "")
            parse("RegistryReferenceSchema", reference)
            files = ([directory / "bp-contract.json"] if (directory / "bp-contract.json").is_file() else [])
            files += sorted((directory / "lib/bp-contracts").glob("*.json"))
        except (OSError, ValueError, ValidationError):
            if strict: raise
            return []
        found = []
        for file in files:
            try:
                data = _read(file); contract = parse("BpSchemaOutputSchema", _json(data))
            except (OSError, ValueError, ValidationError):
                if strict: raise
                continue
            if self._matches(selector, reference, contract): found.append((directory, reference, data, contract))
        return found

    @staticmethod
    def _select(found: list[_Candidate]) -> _Candidate | None:
        if len({(value[1], _digest(value[2])) for value in found}) > 1:
            raise ValueError("Local dependency is ambiguous; select an exact identity, version or --path")
        return found[0] if found else None

    def local(self, selector: tuple[str, str, str | None], path: str | Path) -> _Candidate:
        found = self._select(self._local_candidates(selector, path, strict=True))
        if not found: raise ValueError("No local contract matches the dependency identity and version")
        return found

    @staticmethod
    def _children(directory: Path) -> list[Path]:
        try: return sorted(path for path in directory.iterdir() if path.is_dir())
        except OSError: return []

    def _package_roots(self, directory: Path) -> list[Path]:
        if directory.name != "node_modules": return [directory]
        roots = []
        for package in self._children(directory):
            roots += self._children(package) if package.name.startswith("@") else [package]
        return roots

    def _discover(self, selector: tuple[str, str, str | None]) -> _Candidate | None:
        root = next((path for path in (self.directory, *self.directory.parents) if (path / ".git").exists()), self.directory)
        roots = []
        package = root / "package.json"
        if package.is_file():
            metadata = parse("LocalWorkspacePackageSchema", _json(_read(package)))
            roots += [root / path for path in metadata["workspaces"] if "*" not in path]
        roots.append(self.directory / "node_modules")
        roots += self._children(root.parent)
        roots += [self.directory / path for path in os.environ.get("BP_DEV_PATHS", "").split(os.pathsep) if path]
        found = []
        for path in dict.fromkeys(Path(os.path.abspath(path)) for path in roots):
            for package in self._package_roots(path):
                found += self._local_candidates(selector, package, strict=False)
        return self._select(found)

    async def add(self, value: str, path: str | Path | None = None, alias: str | None = None, url: str | None = None) -> Any:
        if path is not None and url is not None: raise ValueError("Select --path or --registry")
        if path is not None: return self.add_local(value, path, alias)
        if url is None:
            selector = self.selector(value)
            local = self._discover(selector)
            if local is not None: return self._install(selector, *local, alias)
        return await self.add_registry(value, alias, url)

    def _cache(self, locked: Any) -> Path:
        return self.directory / ".betterportal/contracts" / locked["pluginId"] / (locked["version"] + ".json")

    def _output(self, alias: str) -> Path:
        return self.directory / "bp_dependencies" / ("dep_" + alias.replace("-", "_") + ".py")

    def add_local(self, value: str, path: str | Path, alias: str | None = None) -> Any:
        selector = self.selector(value)
        source, reference, data, contract = self.local(selector, path)
        return self._install(selector, source, reference, data, contract, alias)

    async def add_registry(self, value: str, alias: str | None = None, url: str | None = None) -> Any:
        selector = self.selector(value)
        if alias is not None: self._aliases({**self.config.get("dependencies", {}), alias: value})
        reference, data, contract = await RegistryClient(url).lookup(*selector)
        return self._install(selector, None, reference, data, contract, alias)

    async def publish(self, file: str | Path, url: str | None = None) -> Any:
        reference = self.config.get("registryRef")
        if reference is None: raise ValueError("betterportal.json must define registryRef before publishing")
        token = os.environ.get("BP_REGISTRY_TOKEN")
        if not token: raise ValueError("BP_REGISTRY_TOKEN is required")
        return await RegistryClient(url).publish(reference, _json(_read(self.directory / file)), token)

    def _install(self, selector: tuple[str, str, str | None], source: Path | None, reference: str, data: bytes, contract: Any, alias: str | None) -> Any:
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
        if source is None: locals.pop(alias, None)
        else: locals[alias] = {**locked, "path": os.path.relpath(source, self.directory)}
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
