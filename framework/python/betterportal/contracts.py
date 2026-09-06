"""Native AnyVali contracts; wire names and presence are retained as dictionaries."""
from __future__ import annotations

from functools import lru_cache
from copy import deepcopy
from importlib.resources import files
import json
from pathlib import Path
from typing import Any

import anyvali as av


def names() -> list[str]:
    source = files("betterportal").joinpath("_contracts")
    if not source.is_dir():
        source = Path(__file__).resolve().parents[2] / "conformance" / "contracts"
    return sorted(path.name.removesuffix(".json") for path in source.iterdir() if path.name.endswith(".json"))


def document(name: str, *path: str) -> dict[str, Any]:
    if not name.isidentifier():
        raise ValueError("Invalid contract name")
    source = files("betterportal").joinpath("_contracts").joinpath(name + ".json")
    if not source.is_file():
        # Editable repository checkout; wheels and sdists contain the same generated corpus.
        source = Path(__file__).resolve().parents[2] / "conformance" / "contracts" / (name + ".json")
    result = json.loads(source.read_text(encoding="utf-8"))
    for field in path:
        node = result["root"]
        while node["kind"] in ("optional", "nullable"):
            node = node["inner"]
        result["root"] = node["properties"][field]
    return result


@lru_cache(maxsize=None)
def contract(name: str, *path: str) -> av.BaseSchema[Any]:
    """Import a canonical contract or field, preserving its recursive definitions."""
    return av.import_schema(document(name, *path))


def parse(name: str, value: Any) -> Any:
    return contract(name).parse(value)


def export(schema: av.BaseSchema[Any]) -> dict[str, Any]:
    return av.export_schema(schema)


def object_document(properties: dict[str, dict[str, Any]], *, unknown_keys: str = "strip") -> dict[str, Any]:
    """Compose portable roots before native import, retaining recursive definitions.

    Conflicting definition/extension names fail explicitly; no schema is silently replaced.
    """
    if unknown_keys not in ("strip", "reject", "allow"):
        raise ValueError("Invalid unknown-key policy")
    result: dict[str, Any] = {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "definitions": {}, "extensions": {},
        "root": {"kind": "object", "properties": {}, "required": [], "unknownKeys": unknown_keys}}
    if properties:
        first = next(iter(properties.values()))
        result.update({key: first[key] for key in ("anyvaliVersion", "schemaVersion")})
    for name, child in properties.items():
        av.import_schema(child)  # AnyVali owns document validity.
        if any(child[key] != result[key] for key in ("anyvaliVersion", "schemaVersion")):
            raise ValueError("Cannot compose different document versions")
        result["root"]["properties"][name] = deepcopy(child["root"])
        if child["root"]["kind"] != "optional":
            result["root"]["required"].append(name)
        for section in ("definitions", "extensions"):
            for key, value in child.get(section, {}).items():
                if key in result[section] and result[section][key] != value:
                    raise ValueError(f"Conflicting {section} name: {key}")
                result[section][key] = deepcopy(value)
    av.import_schema(result)
    return result
