"""Portable settings declarations, native sensitive traversal and Node ciphertext."""
from copy import deepcopy
import json
from pathlib import Path
from security_cases import post


def fixture():
    document = json.loads(Path(__file__).with_name("contracts").joinpath("JsonValueSchema.json").read_text())
    secret = {"kind": "string", "metadata": {"sensitive": True}}
    properties = {
        "count": {"kind": "int", "default": 7, "coerce": {"toInt": True}},
        "secret": document["root"],
        "prefix": {"kind": "literal", "value": "enc:aes256gcm2:ordinary-data"},
        "nested": {"kind": "object", "properties": {"password": secret, "label": {"kind": "string"}}, "required": ["password", "label"], "unknownKeys": "allow"},
        "rows": {"kind": "array", "items": {"kind": "object", "properties": {"secret": {"kind": "int", "metadata": {"sensitive": True}}}, "required": ["secret"], "unknownKeys": "strip"}},
        "strict": {"kind": "object", "properties": {}, "required": [], "unknownKeys": "reject"},
    }
    document["root"] = {"kind": "object", "properties": properties, "required": ["count"], "unknownKeys": "reject"}
    fields = [{"key": key, "title": key, "description": key, "scope": "app" if key in ("nested", "rows", "strict") else "tenant",
               "visibility": "secret" if key == "secret" else "public", "ownership": "bp", "sourceOfTruth": "bp"} for key in properties]
    return {"action": "settings-schema", "command": "values", "scope": "tenant", "descriptors": [
        {"id": "settings", "title": "Settings", "description": "Settings", "scope": "tenant", "jsonSchema": document, "fields": fields}]}


def run_settings(urls, labels):
    results = []
    native = [(url, label) for url, label in zip(urls, labels) if label != "node"]
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "settings-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "settings-" + name, "passed": False, "error": str(error)})
    def request(url, command="values", *, source=None, valid=True, expected=None, **options):
        body = deepcopy(source or fixture()); body.update(command=command, **options)
        actual = post(url, body)
        assert actual["valid"] == valid, actual
        if not valid: return actual
        if expected is not None: assert actual["output"] == expected, actual
        return actual["output"]
    key = post(urls[0], {"action": "crypto-keys"})["output"]["storage"]
    for url, label in native:
        cases = [
            ("partial-omission", {}, True, True, {}),
            ("effective-default", {}, False, True, {"count": 7}),
            ("coercion", {"count": "12"}, True, True, {"count": 12}),
            ("wrong-type", {"count": "invalid"}, True, False, None),
            ("wrong-scope", {"nested": {}}, True, False, None),
            ("unknown-field", {"absent": 1}, True, False, None),
            ("recursive-secret", {"secret": {"nested": [None, {"enabled": True}]}}, True, True, {"secret": {"nested": [None, {"enabled": True}]}}),
            ("nullable-secret", {"secret": None}, True, True, {"secret": None}),
        ]
        for name, values, partial, valid, expected in cases:
            check(label, name, lambda: request(url, values=values, partial=partial, valid=valid, expected=expected))
        check(label, "nested-policy-allow", lambda: request(url, scope="app", values={"nested": {"password": "s", "label": "L", "extra": [None]}}, expected={"nested": {"password": "s", "label": "L", "extra": [None]}}))
        check(label, "nested-policy-strip", lambda: request(url, scope="app", values={"rows": [{"secret": 1, "extra": 2}]}, expected={"rows": [{"secret": 1}]}))
        check(label, "nested-policy-reject", lambda: request(url, scope="app", values={"strict": {"extra": 2}}, valid=False))
        check(label, "invalid-scope", lambda: request(url, scope="platform", values={}, valid=False))
        for name, mutate in [
            ("duplicate-descriptor", lambda v: v["descriptors"].append(deepcopy(v["descriptors"][0]))),
            ("missing-field", lambda v: v["descriptors"][0]["fields"].pop()),
            ("duplicate-field", lambda v: v["descriptors"][0]["fields"].append(deepcopy(v["descriptors"][0]["fields"][0]))),
            ("legacy-shorthand", lambda v: v["descriptors"][0].update(jsonSchema={"secret": "string"})),
            ("drifting-default", lambda v: v["descriptors"][0]["fields"][0].update(defaultValue=99)),
        ]:
            def invalid():
                source = fixture(); mutate(source)
                request(url, source=source, values={}, valid=False)
            check(label, name, invalid)
        def default_metadata():
            source = fixture(); source["descriptors"][0]["fields"][0]["defaultValue"] = 7
            request(url, source=source, values={}, partial=False, expected={"count": 7})
        check(label, "matching-default", default_metadata)
        def optional_fields():
            source = fixture(); properties = source["descriptors"][0]["jsonSchema"]["root"]["properties"]
            properties["prefix"] = {"kind": "optional", "inner": {"kind": "nullable", "inner": {"kind": "string"}}}
            request(url, source=source, values={"prefix": None}, expected={"prefix": None})
            properties["count"] = {"kind": "optional", "inner": properties["count"]}
            request(url, source=source, values={}, expected={})
            request(url, source=source, values={}, partial=False, expected={"count": 7})
        check(label, "optional-nullable-default-wrappers", optional_fields)
        for place in ("root", "nested", "definition"):
            def sensitive_ref():
                source = fixture(); document = source["descriptors"][0]["jsonSchema"]
                document["definitions"]["Secret"] = {"kind": "string"}
                ref = {"kind": "ref", "ref": "#/definitions/Secret", "metadata": {"sensitive": True}}
                if place == "root": document["root"]["properties"]["secret"] = ref
                elif place == "nested": document["root"]["properties"]["nested"]["properties"]["password"] = ref
                else: document["definitions"]["Unused"] = ref
                request(url, source=source, values={}, valid=False)
            check(label, "reject-unsafe-sensitive-ref-" + place, sensitive_ref)
        def definition_sensitive():
            source = fixture(); document = source["descriptors"][0]["jsonSchema"]
            document["definitions"]["Secret"] = {"kind": "string", "metadata": {"sensitive": True}}
            document["root"]["properties"]["nested"]["properties"]["password"] = {"kind": "ref", "ref": "#/definitions/Secret"}
            request(url, "redact", source=source, scope="app", values={"nested": {"password": "secret", "label": "L"}}, expected={"nested": {"password": "__redacted__", "label": "L"}})
        check(label, "sensitive-definition", definition_sensitive)
        def declassification():
            source = fixture(); document = source["descriptors"][0]["jsonSchema"]
            document["root"]["properties"]["nested"] = {"kind": "union", "variants": [
                {"kind": "object", "properties": {"kind": {"kind": "literal", "value": kind}, "value": {"kind": "string", "metadata": {"sensitive": kind == "secret"}}},
                 "required": ["kind", "value"], "unknownKeys": "reject"} for kind in ("secret", "public")]}
            request(url, "merge", source=source, scope="app", current={"nested": {"kind": "secret", "value": "old-secret"}},
                    values={"nested": {"kind": "public", "value": "__redacted__"}}, valid=False)
        check(label, "placeholder-cannot-declassify", declassification)
        for index, secret in enumerate(("", "secret", 4, False, None, {"nested": [None, True]}, "encrypted:literal", "enc:aes256gcm2:literal")):
            check(label, "redact-" + str(index), lambda: request(url, "redact", values={"secret": secret, "count": 2}, expected={"secret": "__redacted__", "count": 2}))
        value = {"nested": {"password": "old", "label": "L", "other": 1}, "rows": [{"secret": 10}, {"secret": 20}]}
        redacted = {"nested": {"password": "__redacted__", "label": "L", "other": 1}, "rows": [{"secret": "__redacted__"}, {"secret": "__redacted__"}]}
        check(label, "nested-redaction", lambda: request(url, "redact", scope="app", values=value, expected=redacted))
        check(label, "nested-placeholder", lambda: request(url, "merge", scope="app", current=value, values={**redacted, "nested": {**redacted["nested"], "label": "Changed"}}, expected={**value, "nested": {**value["nested"], "label": "Changed"}}))
        for name, current, changes, clear, valid, expected in [
            ("placeholder", {"secret": {"n": 2}}, {"secret": "__redacted__", "count": 3}, [], True, {"secret": {"n": 2}, "count": 3}),
            ("placeholder-null", {"secret": None}, {"secret": "__redacted__"}, [], True, {"secret": None}),
            ("placeholder-without-secret", {}, {"secret": "__redacted__"}, [], False, None),
            ("placeholder-after-clear", {"secret": "old"}, {"secret": "__redacted__"}, ["secret"], False, None),
            ("clear", {"secret": "old", "count": 3}, {}, ["secret"], True, {"count": 3}),
            ("clear-and-write", {"secret": "old"}, {"secret": "new"}, ["secret"], True, {"secret": "new"}),
            ("clear-unknown", {}, {}, ["absent"], False, None),
            ("clear-wrong-scope", {}, {}, ["nested"], False, None),
            ("omission-preserved", {"count": 3}, {"secret": None}, [], True, {"count": 3, "secret": None}),
        ]:
            check(label, name, lambda: request(url, "merge", current=current, values=changes, clearKeys=clear, valid=valid, expected=expected))
        def effective():
            source = fixture(); app = deepcopy(source["descriptors"][0]); app.update(id="app", scope="app")
            app["jsonSchema"]["root"]["properties"] = {"count": {"kind": "int", "default": 9}}
            app["fields"] = [deepcopy(app["fields"][0])]; app["fields"][0]["scope"] = "app"
            source["descriptors"].append(app)
            request(url, "effective", source=source, tenant={}, app={}, expected={"count": 7})
            request(url, "effective", source=source, tenant={"count": 1}, app={"count": 2}, expected={"count": 2})
        check(label, "tenant-default-app-override", effective)
        for index, secret in enumerate(("", "secret", 3, False, None, {"nested": [None, True]}, "encrypted:literal", "enc:aes256gcm2:literal")):
            def encrypted():
                plain = {"secret": secret, "prefix": "enc:aes256gcm2:ordinary-data"}
                stored = request(url, "encode", values=plain, key=key)
                assert stored["prefix"] == plain["prefix"], stored
                for target, _ in native: request(target, "decode", values=stored, key=key, expected=plain)
                if "node" in labels:
                    decoded = post(urls[labels.index("node")], {"action": "crypto-store-decrypt", "key": key, "value": stored["secret"]})
                    assert decoded["valid"] and decoded["output"] == secret, decoded
            check(label, "ciphertext-interchange-" + str(index), encrypted)
        def nested_crypto():
            stored = request(url, "encode", scope="app", values=value, key=key)
            assert stored["nested"]["password"].startswith("encrypted:enc:aes256gcm2:") and stored["rows"][0]["secret"].startswith("encrypted:enc:aes256gcm3:"), stored
            for target, _ in native: request(target, "decode", scope="app", values=stored, key=key, expected=value)
            bad = deepcopy(stored); bad["nested"]["password"] += "tampered"
            request(url, "decode", scope="app", values=bad, key=key, valid=False)
        check(label, "nested-ciphertext-and-tampering", nested_crypto)
        for plaintext in ("plain secret", 13, {}, "encrypted:unrecognized", "enc:unknown:payload"):
            check(label, "reject-unauthenticated-" + str(plaintext), lambda: request(url, "decode", values={"secret": plaintext}, key=key, valid=False))
        for source, source_label in zip(urls, labels):
            def read_existing():
                ciphertext = post(source, {"action": "crypto-store-encrypt", "key": key, "value": {"existing": [None, 1]}})["output"]
                request(url, "decode", values={"secret": ciphertext}, key=key, expected={"secret": {"existing": [None, 1]}})
            check(label, "read-existing-" + source_label, read_existing)
    return results
