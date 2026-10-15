"""Strict JSON decoding at protocol trust boundaries; schema validation remains AnyVali's job."""
import json
import math
from typing import Any


def loads(value: str) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, item in pairs:
            if key in result:
                raise ValueError("Duplicate JSON member")
            result[key] = item
        return result

    def invalid_constant(value: str) -> None:
        raise ValueError("Invalid JSON number")

    def finite_float(value: str) -> float:
        result = float(value)
        if not math.isfinite(result): raise ValueError("Invalid JSON number")
        return result

    try:
        return json.loads(value, object_pairs_hook=unique, parse_constant=invalid_constant, parse_float=finite_float)
    except RecursionError as error:
        raise ValueError("JSON nesting exceeds the parser limit") from error
