"""Native AnyVali contracts; wire names and presence are retained as dictionaries."""
from __future__ import annotations

from functools import lru_cache
from importlib.resources import files
import json
from pathlib import Path
from typing import Any

import anyvali as av


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
