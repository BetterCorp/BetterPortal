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
    operations = contract.json_operations(include_raw=True)
    declarations = {operation["operationId"]: operation for view in contract.schema()["manifest"]["views"] for operation in view["operations"]}
    extended = any(op.get("raw") or op.get("streaming") for op in declarations.values())
    if not operations: raise ValueError("Dependency contract has no supported operations")
    documents, entries = {}, []
    stream_types: dict[str, tuple[str, str, str | None, str | None]] = {}
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
        streaming = declarations[identifier].get("streaming")
        if streaming:
            item_key, summary_key = prefix + "_ItemSchema", prefix + "_SummarySchema"
            documents[item_key] = streaming["itemSchema"]
            declared_item_frame, declared_summary_frame = prefix + "ItemFrame", prefix + "SummaryFrame"
            reserved.update({declared_item_frame, declared_summary_frame})
            if streaming.get("summarySchema"): documents[summary_key] = streaming["summarySchema"]
            stream_types[identifier] = (declared_item_frame, TypeGenerator.root_name(item_key, False),
                declared_summary_frame if streaming.get("summarySchema") else None,
                TypeGenerator.root_name(summary_key, False) if streaming.get("summarySchema") else None)
    if extended:
        reserved.update({"_BpRawClientResponse", "_BpAsyncContextManager", "_BpAsyncIterator", "_BpStreamEndFrame", "_BpLiteral"})
    source = TypeGenerator(documents, reserved_names=reserved).generate()
    source += "\nimport json as _bp_json\nfrom typing import cast as _bp_cast\n"
    source += "from betterportal.clients import RequestClients as _BpRequestClients, ClientContract as _BpClientContract\n\n"
    if extended:
        source += "from typing import AsyncContextManager as _BpAsyncContextManager, AsyncIterator as _BpAsyncIterator, Literal as _BpLiteral\n"
        source += "from betterportal.clients import RawClientResponse as _BpRawClientResponse\n"
        source += "from betterportal.generated_types import StreamEndFrame as _BpStreamEndFrame\n\n"
    source += "_bp_contract = _BpClientContract(_bp_json.loads(" + repr(json.dumps(contract.schema(), ensure_ascii=True, separators=(",", ":"))) + "))\n\n"
    for _, _, inputs, fields, required, _ in entries:
        source += f"{inputs} = TypedDict({inputs!r}, {{\n"
        source += "".join(f"    {name!r}: {'Required' if name in required else 'NotRequired'}[{type_name!r}],\n" for name, type_name in fields.items())
        source += "})\n\n"
    for item_frame, item_type, summary_frame, summary_type in stream_types.values():
        source += f"class {item_frame}(TypedDict):\n    kind: _BpLiteral['item']\n    data: {item_type}\n\n"
        if summary_frame:
            source += f"class {summary_frame}(TypedDict):\n    kind: _BpLiteral['summary']\n    data: {summary_type}\n\n"
    source += f"class {class_name}:\n"
    source += "    def __init__(self, context: _BpRequestClients, *, service_id: str | None = None, request_id: str | None = None):\n"
    source += "        if service_id is not None and request_id is not None: raise ValueError('Select a user service or a declared M2M request')\n"
    source += "        self._bp_client = context.m2m(request_id, _bp_contract) if request_id is not None else context.user(_bp_contract, service_id)\n"
    for identifier, method, inputs, _, required, output in entries:
        argument = inputs if required else inputs + " | None = None"
        declaration = declarations[identifier]
        if declaration.get("raw"):
            source += f"\n    def {method}(self, values: {argument}) -> _BpAsyncContextManager[_BpRawClientResponse]:\n"
            source += f"        return self._bp_client.raw({identifier!r}, values)\n"
        else:
            source += f"\n    async def {method}(self, values: {argument}) -> {output}:\n"
            source += f"        return _bp_cast({output}, await self._bp_client.request({identifier!r}, values))\n"
        if declaration.get("streaming"):
            stream_method = method + "_stream"
            if stream_method in methods: stream_method += "_" + hashlib.sha256(identifier.encode()).hexdigest()[:12]
            if stream_method in methods: raise ValueError("Generated stream method name collision")
            methods.add(stream_method)
            item_frame, _, summary_frame, _ = stream_types[identifier]
            frame_type = " | ".join(name for name in (item_frame, summary_frame, "_BpStreamEndFrame") if name)
            result_type = f"_BpAsyncContextManager[_BpAsyncIterator[{frame_type}]]"
            source += f"\n    def {stream_method}(self, values: {argument}, *, transport: _BpLiteral['ndjson', 'sse'] = 'ndjson', max_frame_bytes: int = 1024 * 1024) -> {result_type}:\n"
            source += f"        return _bp_cast({result_type}, self._bp_client.stream({identifier!r}, values, transport=transport, max_frame_bytes=max_frame_bytes))\n"
    return source
