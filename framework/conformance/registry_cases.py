"""Real Node manifest builder, native registries, and cross-SDK exported operation schemas."""
from copy import deepcopy
import json
from pathlib import Path
from security_cases import post


def fixture():
    value = json.loads(Path(__file__).with_name("contracts").joinpath("JsonValueSchema.json").read_text())
    params = {**value, "root": {"kind": "object", "properties": {"key": {"kind": "optional", "inner": {"kind": "string"}}}, "required": [], "unknownKeys": "strip"}}
    query = {**value, "root": {"kind": "object", "properties": {"limit": {"kind": "int", "default": 10}}, "required": ["limit"], "unknownKeys": "strip"}}
    return {"action": "registry", "declaration": {"pluginId": "com.example.registry", "version": "1.0.0", "title": "Registry", "description": "Registry"},
            "routes": [{"viewId": "items.index", "path": "/items/:key", "pathVariants": ["/items"], "operations": [
                {"declaration": {"operationId": "items.read", "method": "GET", "title": "Read", "description": "Read items", "auth": {}}, "response": value, "schemas": {"params": params, "query": query}},
                {"declaration": {"operationId": "items.write", "method": "POST", "title": "Write", "description": "Write items", "auth": {"required": True, "callers": ["user", "service"]}},
                 "response": {**value, "root": {"kind": "string"}}, "schemas": {"params": params, "request": value}}
            ]}]}


def without_documents(value):
    if isinstance(value, dict):
        if "anyvaliVersion" in value and "root" in value: return "<AnyVali>"
        return {key: without_documents(item) for key, item in value.items()}
    if isinstance(value, list): return [without_documents(item) for item in value]
    return value


def run_registry(urls, labels):
    results, baseline = [], None
    shared = []
    def case(name, change, status=200, native=False):
        body = fixture(); change(body)
        shared.append((name, body, status, native))
    def operation(body): return body["routes"][0]["operations"][0]["declaration"]
    case("defaults-methods-variants", lambda body: None)
    for index in (0, 1):
        for field in ("Accept-Language", "X-!#$%&'*+.^_`|~012azAZ-", "", "X-\u00e9", "X-\u2603", "X-Test\n", "X-Test\r\nInjected: yes", "X-Test\0", "X Test", "X-Test,Accept", "X:Test", " X-Test", "X-Test\t"):
            case(f"vary-field-{index}-{field!r}", lambda body, field=field, index=index:
                 body["routes"][0]["operations"][index]["declaration"].update(cacheHints={"ttlSeconds": index * 60, "varyBy": [field]}),
                 200 if field in ("Accept-Language", "X-!#$%&'*+.^_`|~012azAZ-") else 400)
    case("empty-view-title", lambda body: body["routes"][0].update(title=""), 400)
    case("empty-view-description", lambda body: body["routes"][0].update(description=""), 400)
    def demo(body, response, root=None):
        if root is not None: body["routes"][0]["operations"][0]["response"]["root"] = root
        operation(body)["demoScenarios"] = [{"id": "example", "title": "Example", "response": response}]
    case("demo-recursive", lambda body: demo(body, {"nested": [None, True, {"items": [1, "two"]}]}))
    case("demo-invalid", lambda body: demo(body, [], {"kind": "string"}), 400)
    case("demo-null", lambda body: demo(body, None, {"kind": "nullable", "inner": {"kind": "string"}}))
    case("demo-null-denied", lambda body: demo(body, None, {"kind": "string"}), 400)
    def demo_object(body, unknown):
        demo(body, {"count": "12", "extra": True}, {"kind": "object", "properties": {
            "count": {"kind": "int", "coerce": {"toInt": True}}, "name": {"kind": "string", "default": "Example"}},
            "required": ["count", "name"], "unknownKeys": unknown})
    case("demo-normalized", lambda body: demo_object(body, "strip"))
    case("demo-unknown-denied", lambda body: demo_object(body, "reject"), 400)
    def finite_demo(body, value):
        spec = body["routes"][0]["operations"][0]
        spec["finite"] = {"itemSchema": {**spec["response"], "root": {"kind": "string"}}}
        demo(body, {"items": [value]})
    case("demo-finite", lambda body: finite_demo(body, "item"))
    case("demo-finite-invalid", lambda body: finite_demo(body, 1), 400)
    def api_contract(body, variants=False):
        if not variants: body["routes"][0]["pathVariants"] = []
        body["routes"][0]["operations"][1]["declaration"].update(apiContracts=[{"id": "write", "version": "1.0.0", "title": "Write"}])
    case("api-contract", api_contract)
    # Node repeats API contracts while iterating expanded optional paths.
    case("api-contract-variants", lambda body: api_contract(body, True), native=True)
    case("local-dependency", lambda body: operation(body).update(dependencies=[{"operationId": "items.write", "method": "POST"}]))
    def alias(body, local=False):
        body["dependencies"] = {"peer": "com.example.registry" if local else "com.example.peer"}
        operation(body).update(dependencies=[{"serviceId": "peer", "operationId": "items.write", "method": "POST"}])
    case("external-alias", alias)
    case("local-alias", lambda body: alias(body, True))
    case("unknown-alias", lambda body: operation(body).update(dependencies=[{"serviceId": "absent", "operationId": "x", "method": "GET"}]), 400)
    case("missing-local-operation", lambda body: operation(body).update(dependencies=[{"operationId": "absent", "method": "GET"}]), 400)
    case("wrong-local-method", lambda body: operation(body).update(dependencies=[{"operationId": "items.write", "method": "GET"}]), 400)
    case("contract-caller-denied", lambda body: operation(body).update(apiContracts=[{"id": "read", "version": "1.0.0", "title": "Read"}]), 400)
    case("robots", lambda body: operation(body).update(robots=[{"userAgent": "*", "access": "disallow", "crawlDelaySeconds": 10}], sitemap={"kind": "exclude"}))
    case("invalid-robots", lambda body: operation(body).update(robots=[{"userAgent": "*\nAllow: /", "access": "allow"}]), 400)
    def config(body):
        body["declaration"]["configSchemas"] = [{"id": "settings", "title": "Settings", "description": "Settings", "scope": "tenant", "jsonSchema": {}, "fields": []}]
    case("config-admin-discovery", config)
    def override(body):
        config(body)
        body["declaration"]["adminApis"] = [{"id": "config.schema", "title": "Custom", "description": "Custom", "path": "/schema", "methods": ["GET"], "supportsCustomUi": True}]
    case("config-admin-override", override)
    case("derived-field-denied", lambda body: operation(body).update(raw=True), 400)
    case("explicit-auth-required", lambda body: operation(body).pop("auth"), 400)
    case("operation-id-syntax", lambda body: operation(body).update(operationId="invalid operation"), 400)
    case("duplicate-operation", lambda body: body["routes"][0]["operations"][1]["declaration"].update(operationId="items.read"), 400, True)
    case("duplicate-method", lambda body: body["routes"][0]["operations"][1]["declaration"].update(method="GET"), 400, True)
    case("duplicate-view", lambda body: body["routes"].append(deepcopy(body["routes"][0])), 400, True)
    def ambiguous(body):
        other = deepcopy(body["routes"][0]); other.update(viewId="other", path="/items/:other", pathVariants=[])
        for item in other["operations"]: item["declaration"]["operationId"] += ".other"
        body["routes"].append(other)
    case("ambiguous-parameter-path", ambiguous, 400, True)
    case("different-param-schemas", lambda body: body["routes"][0]["operations"][1]["schemas"].pop("params"), 400, True)
    for index, path in enumerate(["https://external/path", "//host/path", "/a//b", "/a/../b", "/a/%2f", "/:id/:id", "/:1bad", "/[id]", "/a?b", "/a\\b"]):
        case("path-" + str(index), lambda body, path=path: body["routes"][0].update(path=path, pathVariants=[]), 400, True)
    for name, body, status, native in shared:
        expected = None
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            result = {"runtime": label, "id": "registry-" + name, "passed": False}
            try:
                actual = post(url, body)
                assert actual["status"] == status, actual
                if status == 200:
                    schema = actual["schema"]
                    normalized = without_documents(schema)
                    if expected is None: expected = normalized
                    assert normalized == expected, (expected, normalized)
                    if name == "defaults-methods-variants":
                        manifest = schema["manifest"]; view = manifest["views"][0]
                        assert manifest["category"] == "service" and manifest["deploymentModes"] == ["self-hosted"]
                        assert view["pathVariants"] == ["/items/:key", "/items"] and schema["routes"][0]["paramNames"] == ["key"]
                        assert [item["auth"]["required"] for item in view["operations"]] == [False, True]
                        baseline = baseline or {}
                        baseline[label] = schema
                    if name.startswith("api-contract"):
                        descriptor, = schema["manifest"]["apiContracts"]
                        assert descriptor["viewId"] == "items.index" and descriptor["methods"] == ["POST"]
                    if name.startswith("config-admin"):
                        apis = schema["manifest"]["adminApis"]
                        assert len(apis) == 2 and {item["id"] for item in apis} == {"config.schema", "config.values"}
                    if name == "demo-normalized":
                        assert schema["manifest"]["views"][0]["operations"][0]["demoScenarios"][0]["response"] == {"count": 12, "name": "Example"}
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    for source, schema in (baseline or {}).items():
        document = schema["manifest"]["views"][0]["operations"][0]["jsonResponseSchema"]
        for url, label in zip(urls, labels):
            result = {"runtime": label, "id": "registry-response-schema-from-" + source, "passed": False}
            try:
                value = {"nested": [None, True, {"text": "value"}]}
                actual = post(url, {"document": document, "input": value})
                assert actual.get("valid") and actual.get("output") == value, actual
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    return results
