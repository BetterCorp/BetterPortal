"""Native AnyVali contracts; wire names and presence are retained as dictionaries."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import anyvali as av


@lru_cache(maxsize=None)
def contract(name: str) -> av.BaseSchema[Any]:
    if not name.isidentifier():
        raise ValueError("Invalid contract name")
    # Initial conformance adapter; consumer packaging is a later gate.
    source = Path(__file__).resolve().parents[2] / "conformance" / "contracts" / (name + ".json")
    return av.import_schema(source.read_text(encoding="utf-8"))


def parse(name: str, value: Any) -> Any:
    return contract(name).parse(value)


def export(schema: av.BaseSchema[Any]) -> dict[str, Any]:
    return av.export_schema(schema)
