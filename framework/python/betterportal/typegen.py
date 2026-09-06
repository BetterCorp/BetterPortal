"""Generate Python typing declarations directly from portable AnyVali documents."""
from __future__ import annotations

import hashlib
import json
import keyword
import re
from typing import Any, Mapping

import anyvali as av


def _identifier(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_]", "_", value)
    if not value or value[0].isdigit():
        value = "T_" + value
    return value + "_" if keyword.iskeyword(value) else value


class TypeGenerator:
    """Typing describes wire values; AnyVali alone applies constraints and defaults."""
    def __init__(self, documents: Mapping[str, dict[str, Any]]):
        self.documents = dict(sorted(documents.items()))
        self.names: dict[tuple[str, bool], str] = {}
        self.reserved: set[str] = {"Any", "Literal", "NoReturn", "TypeAlias", "Union", "NotRequired", "Required", "TypedDict", "str", "int", "bool", "float", "list", "dict"}
        self.emitted: dict[str, str] = {}
        self.definitions: dict[tuple[str, str, bool], str] = {}
        for document in self.documents.values():
            av.import_schema(document)
        for contract, document in self.documents.items():
            for input_type in (False, True):
                name = self.root_name(contract, input_type)
                if name in self.reserved:
                    raise ValueError(f"Generated type name collision: {name}")
                self.reserved.add(name)
                self.names.setdefault((self.fingerprint(document["root"], document), input_type), name)

    @staticmethod
    def root_name(contract: str, input_type: bool) -> str:
        return _identifier(contract.removesuffix("Schema") + ("Input" if input_type else ""))

    @staticmethod
    def fingerprint(node: dict[str, Any], document: dict[str, Any]) -> str:
        # Equal reference spellings can mean different definitions in different documents.
        def has_reference(value: Any) -> bool:
            if isinstance(value, dict):
                return value.get("kind") == "ref" or any(has_reference(child) for child in value.values())
            return isinstance(value, list) and any(has_reference(child) for child in value)
        return json.dumps([node, document.get("definitions", {}) if has_reference(node) else {}], sort_keys=True, separators=(",", ":"))

    def reserve(self, hint: str, identity: str) -> str:
        name = _identifier(hint)
        if name in self.reserved:
            name += "_" + hashlib.sha256(identity.encode()).hexdigest()[:12]
        if name in self.reserved:
            raise ValueError(f"Generated type name collision: {name}")
        self.reserved.add(name)
        return name

    def reference(self, ref: str, document: dict[str, Any], input_type: bool) -> str:
        if not ref.startswith("#/definitions/"):
            raise ValueError(f"Only local AnyVali definition references are supported: {ref}")
        key = ref[len("#/definitions/"):].replace("~1", "/").replace("~0", "~")
        definitions = document.get("definitions", {})
        if key not in definitions:
            raise ValueError(f"Unresolved AnyVali definition: {key}")
        identity = (json.dumps(definitions, sort_keys=True), key, input_type)
        if identity not in self.definitions:
            name = self.reserve(key + ("Input" if input_type else ""), str(identity))
            self.definitions[identity] = name
            self.emit(name, definitions[key], document, input_type)
        return self.definitions[identity]

    def type_of(self, node: dict[str, Any], document: dict[str, Any], input_type: bool, hint: str, *, expand: bool = False) -> str:
        identity = (self.fingerprint(node, document), input_type)
        if not expand and node["kind"] in ("object", "enum", "union", "intersection", "record", "ref") and identity in self.names:
            return self.names[identity]
        if input_type and node.get("coerce"):
            return "Any"  # Coercion accepts source types beyond the output wire type; AnyVali decides validity.
        kind = node["kind"]
        if kind in ("optional", "nullable"):
            inner = self.type_of(node["inner"] if "inner" in node else node["schema"], document, input_type, hint)
            return f"Union[{inner}, None]" if kind == "nullable" else inner
        if kind == "ref":
            return self.reference(node["ref"], document, input_type)
        primitives = {"string": "str", "bool": "bool", "number": "float", "null": "None", "never": "NoReturn", "any": "Any", "unknown": "Any"}
        if kind in primitives:
            return primitives[kind]
        if kind in ("int", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64", "uint"):
            return "int"
        if kind in ("literal", "enum"):
            values = [node["value"]] if kind == "literal" else node["values"]
            if not values:
                return "NoReturn"
            if not all(value is None or isinstance(value, (str, bool, int)) for value in values):
                # Python Literal does not accept floating point constants.
                types = list(dict.fromkeys("None" if value is None else "bool" if isinstance(value, bool) else
                    "str" if isinstance(value, str) else "int" if isinstance(value, int) else "float" if isinstance(value, float) else
                    "list[Any]" if isinstance(value, list) else "dict[str, Any]" for value in values))
                return types[0] if len(types) == 1 else "Union[" + ", ".join(types) + "]"
            return "Literal[" + ", ".join(repr(value) for value in values) + "]"
        if kind in ("array", "record"):
            child = node["items"] if kind == "array" else node["valueSchema"] if "valueSchema" in node else node["values"]
            value = self.type_of(child, document, input_type, hint + "Item")
            return f"list[{value}]" if kind == "array" else f"dict[str, {value}]"
        if kind in ("union", "tuple"):
            children = node["variants"] if kind == "union" else node.get("items", node.get("elements", []))
            values = list(dict.fromkeys(self.type_of(child, document, input_type, hint + f"Variant{index + 1}") for index, child in enumerate(children)))
            union = "NoReturn" if not values else values[0] if len(values) == 1 else "Union[" + ", ".join(values) + "]"
            # AnyVali's Python tuple parser returns a list; positional constraints remain in the document.
            return f"list[{union}]" if kind == "tuple" else union
        if kind == "intersection":
            children = node["allOf"]
            records = [child for child in children if child["kind"] == "record"]
            if records and all(child["kind"] in ("record", "object") for child in children):
                # Python typing cannot express a TypedDict with typed additional keys across supported checkers.
                # The record value type represents these open mappings; AnyVali retains required named fields.
                values = [self.type_of(child.get("valueSchema", child.get("values")), document, input_type, hint + "Value") for child in records]
                return "dict[str, " + (values[0] if len(values) == 1 else "Union[" + ", ".join(values) + "]") + "]"
            if all(child["kind"] == "object" for child in children):
                merged: dict[str, Any] = {"kind": "object", "properties": {}, "required": []}
                for child in children:
                    for key, value in child["properties"].items():
                        existing = merged["properties"].get(key)
                        merged["properties"][key] = {"kind": "intersection", "allOf": [existing, value]} if existing is not None and existing != value else value
                    merged["required"].extend(child.get("required", child["properties"]))
                return self.type_of(merged, document, input_type, hint)
            values = list(dict.fromkeys(self.type_of(child, document, input_type, hint + f"Part{index + 1}") for index, child in enumerate(children)))
            # Python has no general intersection type. Keep exact shared types; AnyVali enforces other intersections.
            return values[0] if len(values) == 1 else "Any"
        if kind == "object":
            name = self.names.get(identity)
            if name is None:
                name = self.reserve(hint, str(identity))
                self.names[identity] = name
                self.emit(name, node, document, input_type)
            return name
        raise ValueError(f"Unsupported AnyVali kind for Python typing: {kind}")

    def emit(self, name: str, node: dict[str, Any], document: dict[str, Any], input_type: bool) -> None:
        if name in self.emitted:
            return
        self.emitted[name] = ""  # Reserve before descending through recursive references.
        if node["kind"] == "object":
            lines = [f'{name} = TypedDict({name!r}, {{']
            required = node.get("required", list(node["properties"]))
            for field, child in node["properties"].items():
                value = self.type_of(child, document, input_type, name + _identifier(field).capitalize())
                present = field in required and child["kind"] != "optional" and not (input_type and "default" in child)
                wrapper = "Required" if present else "NotRequired"
                lines.append(f"    {field!r}: {wrapper}[{value!r}],")
            lines.append("})")
            self.emitted[name] = "\n".join(lines)
        else:
            value = self.type_of(node, document, input_type, name, expand=True)
            self.emitted[name] = f"{name}: TypeAlias = {value!r}"

    def generate(self) -> str:
        for contract, document in self.documents.items():
            for input_type in (False, True):
                self.emit(self.root_name(contract, input_type), document["root"], document, input_type)
        digest = hashlib.sha256(json.dumps(self.documents, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        header = f"# Generated from AnyVali documents; do not edit. SHA256: {digest}\n"
        header += "from __future__ import annotations\nfrom typing import Any, Literal, NoReturn, TypeAlias, Union\nfrom typing_extensions import NotRequired, Required, TypedDict\n\n"
        return header + "\n\n".join(value for _, value in sorted(self.emitted.items())) + "\n"


def generate_types(documents: Mapping[str, dict[str, Any]]) -> str:
    return TypeGenerator(documents).generate()
