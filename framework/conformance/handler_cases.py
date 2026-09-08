"""Method input and output validation; Node uses its actual H3 operation adapter."""
from copy import deepcopy
import json
from pathlib import Path
from context_cases import fixture
from security_cases import post, TENANT, APP


def run_handlers(urls, labels):
    value = json.loads(Path(__file__).with_name("contracts").joinpath("JsonValueSchema.json").read_text())
    def doc(root): return {**value, "root": root}
    def obj(properties, unknown="strip"):
        return doc({"kind": "object", "properties": properties, "required": [key for key, node in properties.items() if node["kind"] != "optional"], "unknownKeys": unknown})
    number = {"kind": "int", "coerce": {"toInt": True}}
    schemas = {"params": obj({"key": {"kind": "string", "minLength": 3}}),
               "query": obj({"n": {**number, "default": 7}, "tags": {"kind": "optional", "inner": {"kind": "array", "items": {"kind": "string"}}}}),
               "headers": obj({"x-count": {**number, "default": 2}}),
               "request": obj({"name": {"kind": "string", "default": "there"}, "payload": {"kind": "optional", "inner": value["root"]}})}
    base = {"action": "handler", "config": fixture(), "tenantId": TENANT, "appId": APP, "schemas": schemas,
            "response": value, "values": {"params": {"key": "item"}, "query": {}, "headers": {}, "request": {}}}
    default = {"params": {"key": "item"}, "query": {"n": 7}, "headers": {"x-count": 2}, "request": {"name": "there"}}
    cases = [("defaults", {}, default, 200, None),
             ("coercion", {"query": {"n": "42"}, "headers": {"x-count": "3"}}, {**default, "query": {"n": 42}, "headers": {"x-count": 3}}, 200, None),
             ("repeated-query", {"query": {"tags": ["one", "two"]}}, {**default, "query": {"n": 7, "tags": ["one", "two"]}}, 200, None),
             ("recursive-request", {"request": {"payload": {"deep": [None, True, {"n": 1}]}}},
              {**default, "request": {"name": "there", "payload": {"deep": [None, True, {"n": 1}]}}}, 200, None),
             ("strip-unknown", {"request": {"unused": "private"}, "query": {"unused": "private"}}, default, 200, None),
             ("bad-params", {"params": {"key": "x"}}, None, 400, "params"),
             ("bad-query", {"query": {"n": "oops"}}, None, 400, "query"),
             ("bad-headers", {"headers": {"x-count": "oops"}}, None, 400, "headers"),
             ("bad-body", {"request": {"name": 3}}, None, 400, "request")]
    results = []
    for url, label in zip(urls, labels):
        scenarios = [(name, {**deepcopy(base), "values": {**base["values"], **changes}}, expected, status, field) for name, changes, expected, status, field in cases
                     if label != "node" or name != "repeated-query"]  # Node keeps only the final query value.
        scenarios += [("invalid-output", {**base, "response": doc({"kind": "string"}), "result": 1}, None, 500, None),
                      ("output-coercion", {**base, "response": doc(number), "result": "42"}, 42, 200, None),
                      ("output-strip", {**base, "response": obj({"answer": number}), "result": {"answer": "42", "private": "removed"}}, {"answer": 42}, 200, None)]
        reject = deepcopy(base)
        reject["schemas"]["query"]["root"]["unknownKeys"] = "reject"
        reject["values"]["query"] = {"unknown": "no"}
        scenarios.append(("reject-unknown", reject, None, 400, "query"))
        if label != "node":
            # Node replaces null/array JSON request bodies with {}, losing wire presence.
            scenarios += [("null-body", {**base, "values": {**base["values"], "request": None}}, None, 400, "request"),
                          ("array-body", {**base, "schemas": {**schemas, "request": doc({"kind": "array", "items": number})},
                           "values": {**base["values"], "request": ["1", "2"]}}, {**default, "request": [1, 2]}, 200, None)]
        for name, body, expected, status, field in scenarios:
            result = {"runtime": label, "id": "handler-" + name, "passed": False}
            try:
                actual = post(url, body)
                assert actual["status"] == status and actual["invoked"] is (status != 400), actual
                if status == 200: assert actual["output"] == expected, actual
                if field and label != "node": assert actual["field"] == field, actual
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
        if label != "node":
            result = {"runtime": label, "id": "handler-cancellation", "passed": False}
            try:
                actual = post(url, {**base, "cancel": True})
                assert actual == {"cancelled": True, "closed": True}, actual
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    return results
