"""Whole-state wire compatibility and native atomic bootstrap/signing-key ownership."""
import base64
from copy import deepcopy
import json
import secrets
from security_cases import post, TENANT


def run_bootstrap(urls, labels):
    results = []
    key = "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
    state = {"version": 1, "apiKey": "bp_sk_t_test-secret", "cpUrl": "https://cp.test", "cpId": "cp-test",
             "cpJwksUri": "https://cp.test/.well-known/jwks.json", "configEncryptionKey": "storage-secret-" + "a" * 32,
             "tenantLock": TENANT, "installedAt": "2026-09-06T12:00:00Z"}
    def call(url, operation, **options): return post(url, {"action": "bootstrap", "operation": operation, "key": key, **options})
    def store(url, steps, **options):
        actual = call(url, "store", steps=steps, **options)
        assert actual["valid"], actual
        return actual["outcomes"]
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "bootstrap-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "bootstrap-" + name, "passed": False, "error": str(error)})
    seeds = {}
    for url, label in zip(urls, labels):
        def encrypt():
            a, b = (call(url, "encrypt", state=state) for _ in range(2))
            assert a["valid"] and b["valid"] and a["stored"] != b["stored"], (a, b)
            assert state["apiKey"] not in a["stored"] and state["configEncryptionKey"] not in a["stored"]
            seeds[label] = a["stored"]
        check(label, "unique-authenticated-envelopes", encrypt)
    for source, ciphertext in seeds.items():
        for url, label in zip(urls, labels):
            def decrypt():
                actual = call(url, "decrypt", stored=ciphertext)
                assert actual.get("state") == state, actual
            check(label, "decrypt-" + source, decrypt)
            for field in ("iv", "tag", "ct"):
                def tamper():
                    envelope = json.loads(ciphertext); raw = bytearray(base64.b64decode(envelope[field])); raw[0] ^= 1
                    envelope[field] = base64.b64encode(raw).decode()
                    actual = call(url, "decrypt", stored=json.dumps(envelope))
                    assert not actual["valid"], actual
                check(label, "tamper-" + source + "-" + field, tamper)
    identities = {}
    for url, label in zip(urls, labels):
        if label == "node": continue
        def lifecycle():
            steps = store(url, [{"kind": "read"}, {"kind": "write", "patch": state}, {"kind": "identity"}, {"kind": "identity"},
                {"kind": "restart"}, {"kind": "identity"}, {"kind": "read", "redacted": True}, {"kind": "read"},
                {"kind": "clear"}, {"kind": "read"}])
            assert all(item["valid"] for item in steps), [(i, item.get("error")) for i, item in enumerate(steps) if not item["valid"]]
            assert steps[0]["state"] == steps[-1]["state"] == {"version": 1}
            assert steps[2]["jwk"] == steps[3]["jwk"] == steps[5]["jwk"]
            assert steps[2]["stored"] == steps[5]["stored"], "Reading existing identity rewrote state"
            redacted = steps[6]["state"]
            assert redacted["apiKey"] == redacted["configEncryptionKey"] == redacted["identity"]["privateKeyPem"] == "__redacted__", redacted
            assert "PRIVATE KEY" not in steps[7]["stored"]
            assert {k: v for k, v in steps[7]["state"].items() if k != "identity"} == state
            identities[label] = (steps[7]["state"], steps[7]["stored"], steps[5]["jwk"])
        check(label, "durable-identity-redaction-and-clear", lifecycle)
        for patch in ({"version": 2}, {"apiKey": None}, {"apiKey": ""}, {"apiKey": "secret\nheader"}, {"apiKey": "sécret"},
                      {"tenantLock": "wrong"}, {"unknown": "no"}, {"identity": {}}, {"cpUrl": "http://remote.test"},
                      {"cpUrl": "http://127.0.0.2"}, {"cpUrl": "https://cp.test?query"}, {"cpJwksUri": "https://user:secret@cp.test"}):
            def bad_patch():
                steps = store(url, [{"kind": "write", "patch": state}, {"kind": "write", "patch": patch}, {"kind": "read"}])
                assert steps[0]["valid"] and not steps[1]["valid"] and steps[2]["state"] == state, steps
                assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"]
            check(label, "reject-patch-" + str(patch), bad_patch)
        for endpoint in ("http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "https://cp.test/path"):
            def valid_endpoint():
                actual = call(url, "encrypt", state={"version": 1, "cpUrl": endpoint, "cpJwksUri": endpoint + "/jwks?version=1"})
                assert actual["valid"], actual
            check(label, "secure-endpoint-" + endpoint, valid_endpoint)
        for name, operation in [("save", {"kind": "write", "patch": {"apiKey": "new"}, "mode": "fail"}),
                                ("identity", {"kind": "identity", "mode": "fail"}), ("clear", {"kind": "clear", "mode": "fail"}),
                                ("cancel-write", {"kind": "cancel", "patch": {"apiKey": "new"}}), ("cancel-identity", {"kind": "cancel", "identity": True})]:
            def failed_save():
                steps = store(url, [{"kind": "write", "patch": state}, operation, {"kind": "read"}])
                assert not steps[1]["valid"] or steps[1].get("cancelled"), steps
                assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"] and steps[2]["state"] == state, steps
            check(label, "atomic-" + name, failed_save)
        def parallel():
            steps = store(url, [{"kind": "parallel", "patches": [{"apiKey": "one"}, {"cpId": "two"}]}, {"kind": "read"}])
            assert steps[-1].get("state") == {"version": 1, "apiKey": "one", "cpId": "two"}, steps
        check(label, "concurrent-patches-retained", parallel)
        def byte_limit():
            steps = store(url, [{"kind": "write", "patch": {"cpId": "old"}}, {"kind": "write", "patch": {"cpId": "x" * 1000}}, {"kind": "read"}], limit=256)
            assert steps[0]["valid"] and not steps[1]["valid"] and steps[2]["state"] == {"version": 1, "cpId": "old"}, steps
        check(label, "file-limit-preserves-state", byte_limit)
        invalid = {"plaintext": json.dumps(state), "malformed": "not-json", "null": "null", "empty": "", "oversize": "x" * (2 * 1024 * 1024 + 1)}
        envelope = json.loads(next(iter(seeds.values())))
        for field, value in (("v", 2), ("iv", "AA=="), ("tag", "AA=="), ("ct", "!"), ("extra", "unknown")):
            invalid["envelope-" + field] = json.dumps({**envelope, field: value})
        invalid["duplicate-version"] = json.dumps(envelope)[:-1] + ',"v":1}'
        for name, stored in invalid.items():
            def invalid_file():
                actual = call(url, "decrypt", stored=stored)
                assert not actual["valid"], actual
                assert state["apiKey"] not in actual.get("error", ""), actual
            check(label, "reject-" + name, invalid_file)
        for name, invalid_key in (("prefix", "a" * 32), ("short", "bp_bsk_short"), ("padding", key + "="), ("truncated", "bp_bsk_" + "A" * 42), ("alphabet", "bp_bsk_" + "!" * 43)):
            def invalid_master():
                actual = call(url, "encrypt", state=state, key=invalid_key)
                assert not actual["valid"] and invalid_key not in actual.get("error", ""), actual
            check(label, "master-key-" + name, invalid_master)
        def wrong_master():
            other = "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
            assert not call(url, "decrypt", stored=next(iter(seeds.values())), key=other)["valid"]
        check(label, "wrong-master-key", wrong_master)
    for source, (value, stored, jwk) in identities.items():
        for url, label in zip(urls, labels):
            def exchange_identity():
                actual = call(url, "decrypt", stored=stored)
                assert actual.get("state") == value, actual
                rewritten = call(url, "encrypt", state=actual["state"])
                assert rewritten["valid"], rewritten
                if label != "node":
                    steps = store(url, [{"kind": "identity"}], stored=rewritten["stored"])
                    assert steps[0].get("jwk") == jwk, steps
            check(label, "identity-interchange-" + source, exchange_identity)
            if label == "node": continue
            for name, patch in (("mismatched-public", {"publicKeyPem": post(url, {"action": "jwt-key"})["publicKeyPem"]}),
                                ("public-only", {"privateKeyPem": value["identity"]["publicKeyPem"]}), ("invalid-kid", {"kid": "a/b"}),
                                ("private-in-public", {"publicKeyPem": value["identity"]["privateKeyPem"]}),
                                ("appended-private", {"publicKeyPem": value["identity"]["publicKeyPem"] + value["identity"]["privateKeyPem"]})):
                def invalid_identity():
                    invalid = deepcopy(value); invalid["identity"].update(patch)
                    actual = call(url, "encrypt", state=invalid)
                    assert not actual["valid"] and "PRIVATE KEY" not in actual.get("error", ""), actual
                check(label, "identity-" + name + "-" + source, invalid_identity)
    return results
