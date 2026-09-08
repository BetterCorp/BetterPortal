"""Strict JSON decoding at protocol trust boundaries; schema validation remains AnyVali's job."""
import json
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

    try:
        return json.loads(value, object_pairs_hook=unique, parse_constant=invalid_constant)
    except RecursionError as error:
        raise ValueError("JSON nesting exceeds the parser limit") from error
