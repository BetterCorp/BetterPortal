"""Generate typed JSON clients that delegate all BP request policy to the runtime."""
from __future__ import annotations

import hashlib
import json
import keyword
import re
from typing import Any

from .clients import ClientContract
from .typegen import TypeGenerator, _identifier


def generate_client(value: Any, class_name: str = "DependencyClient") -> str:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", class_name) or keyword.iskeyword(class_name) or class_name in TypeGenerator.reserved_names | {"ValueError"}:
        raise ValueError("Invalid Python client class name")
    contract = ClientContract(value)
    operations = contract.json_operations()
    if not operations: raise ValueError("Dependency contract has no JSON operations")
    documents, entries = {}, []
    reserved = {class_name, "ValueError", "_bp_json", "_bp_cast", "_BpRequestClients", "_BpClientContract", "_bp_contract"}
    methods: set[str] = set()
    for identifier, schemas in sorted(operations.items()):
        method = _identifier(identifier)
        if method.startswith("_"): method = "op" + method
        if method in methods: method += "_" + hashlib.sha256(identifier.encode()).hexdigest()[:12]
        if method in methods: raise ValueError("Generated client method name collision")
        methods.add(method)
        prefix = class_name + "_" + method
        inputs = prefix + "Inputs"
        reserved.add(inputs)
        fields = {}
        for name, document in schemas.inputs.items():
            key = prefix + "_" + name + "Schema"
            documents[key] = document
            fields[name] = TypeGenerator.root_name(key, True)
        output = prefix + "_ResponseSchema"
        documents[output] = schemas.output
        entries.append((identifier, method, inputs, fields, schemas.required_inputs, TypeGenerator.root_name(output, False)))
    source = TypeGenerator(documents, reserved_names=reserved).generate()
    source += "\nimport json as _bp_json\nfrom typing import cast as _bp_cast\n"
    source += "from betterportal.clients import RequestClients as _BpRequestClients, ClientContract as _BpClientContract\n\n"
    source += "_bp_contract = _BpClientContract(_bp_json.loads(" + repr(json.dumps(contract.schema(), ensure_ascii=True, separators=(",", ":"))) + "))\n\n"
    for _, _, inputs, fields, required, _ in entries:
        source += f"{inputs} = TypedDict({inputs!r}, {{\n"
        source += "".join(f"    {name!r}: {'Required' if name in required else 'NotRequired'}[{type_name!r}],\n" for name, type_name in fields.items())
        source += "})\n\n"
    source += f"class {class_name}:\n"
    source += "    def __init__(self, context: _BpRequestClients, *, service_id: str | None = None, request_id: str | None = None):\n"
    source += "        if service_id is not None and request_id is not None: raise ValueError('Select a user service or a declared M2M request')\n"
    source += "        self._bp_client = context.m2m(request_id, _bp_contract) if request_id is not None else context.user(_bp_contract, service_id)\n"
    for identifier, method, inputs, _, required, output in entries:
        argument = inputs if required else inputs + " | None = None"
        source += f"\n    async def {method}(self, values: {argument}) -> {output}:\n"
        source += f"        return _bp_cast({output}, await self._bp_client.request({identifier!r}, values))\n"
    return source
