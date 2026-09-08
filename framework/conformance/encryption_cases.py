"""Language-neutral cryptographic interoperability, native sensitive traversal and tampering checks."""
import base64
from copy import deepcopy
import json
from pathlib import Path

from security_cases import post


def run_encryption(urls, labels):
    results = []
    def check(runtime, name, fn):
        try:
            fn()
            results.append({"runtime": runtime, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": runtime, "id": name, "passed": False, "error": str(error)})
    def expect(url, request, value=None, valid=True):
        result = post(url, request)
        assert result["valid"] == valid, result
        if valid:
            assert result["output"] == value, result
    def output(url, request):
        result = post(url, request)
        assert result["valid"], f"{request['action']} at {url}: {result}"
        return result["output"]
    def altered(envelope, index, preview=False):
        prefix, encoded = envelope.rsplit(":", 1)
        payload = bytearray(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        payload[index] ^= 1
        return prefix + ":" + (base64.urlsafe_b64encode(payload).decode().rstrip("=") if preview else base64.b64encode(payload).decode())

    vectors = json.loads(Path(__file__).with_name("encryption-fixtures.json").read_text(encoding="utf-8"))
    for url, label in zip(urls, labels):
        for vector in vectors:
            request = {"action": "crypto-store-decrypt", "key": vector["key"], "value": vector["envelope"]}
            check(label, vector["id"], lambda: expect(url, request, vector["value"]))
            check(label, vector["id"] + "-tamper", lambda: expect(url, {**request, "value": altered(vector["envelope"], -1)}, valid=False))
    keys = [output(url, {"action": "crypto-keys"}) for url in urls]
    for source, source_label, key in zip(urls, labels, keys):
        for index, value in enumerate(["", "secret 🔐\nline", "enc:aes256gcm2:plaintext", 0, 1.5, False, None, [], {"nested": [True, None, {"value": 3}]}]):
            encrypted = output(source, {"action": "crypto-store-encrypt", "key": key["storage"], "value": value})
            assert encrypted.startswith("enc:aes256gcm2:" if isinstance(value, str) else "enc:aes256gcm3:"), encrypted
            check(source_label, f"storage-nonce-unique-{index}", lambda: _different(encrypted, output(source, {"action": "crypto-store-encrypt", "key": key["storage"], "value": value})))
            for target, target_label in zip(urls, labels):
                request = {"action": "crypto-store-decrypt", "key": key["storage"], "value": encrypted}
                pair = source_label + "->" + target_label
                check(pair, f"storage-roundtrip-{index}", lambda: expect(target, request, value))
                if index == 1:
                    for name, position in [("nonce", 0), ("tag", 12), ("ciphertext", -1)]:
                        check(pair, "storage-tamper-" + name, lambda: expect(target, {**request, "value": altered(encrypted, position)}, valid=False))
                    check(pair, "storage-wrong-key", lambda: expect(target, {**request, "key": "wrong-test-key-with-more-than-32-bytes"}, valid=False))
        for index, value in enumerate(["secret 🔐", ""]):
            request = {"key": key["preview"], "value": value, "scope": "tenant", "path": ["secrets", 0, "key"]}
            encrypted = output(source, {**request, "action": "crypto-preview-encrypt"})
            check(source_label, f"preview-nonce-unique-{index}", lambda: _different(encrypted, output(source, {**request, "action": "crypto-preview-encrypt"})))
            for target, target_label in zip(urls, labels):
                pair = source_label + "->" + target_label
                decrypt = {**request, "action": "crypto-preview-decrypt", "value": encrypted}
                check(pair, f"preview-roundtrip-{index}", lambda: expect(target, decrypt, value))
                parts = encrypted.split(":")
                for segment in (2, 3):
                    for suffix in ("!", "=", "\n"):
                        malformed = parts.copy(); malformed[segment] += suffix
                        check(pair, f"preview-encoding-{index}-{segment}-{ord(suffix)}", lambda: expect(target, {**decrypt, "value": ":".join(malformed)}, valid=False))
                check(pair, f"preview-key-encoding-{index}", lambda: expect(target, {**decrypt, "key": key["preview"] + "="}, valid=False))
                for name, change in [("scope", {"scope": "app"}), ("path", {"path": ["other"]}),
                    ("tag", {"value": altered(encrypted, -1, True)}), ("key", {"key": "bp_pck_" + "A" * 43})]:
                    check(pair, f"preview-tamper-{name}-{index}", lambda: expect(target, {**decrypt, **change}, valid=False))

    fields = [{"key": name, "title": name, "description": name, "scope": "tenant", "visibility": visibility,
               "ownership": "bp", "sourceOfTruth": "bp", "required": required}
              for name, visibility, required in [("secret", "secret", True), ("public", "public", False), ("protected", "protected", False), ("optional", "secret", False)]]
    descriptors = [{"id": "test", "title": "Test", "description": "Conformance", "scope": "tenant", "jsonSchema": {}, "fields": fields}]
    for source, source_label, key in zip(urls, labels, keys):
        request = {"action": "crypto-preview-fields-encrypt", "key": key["preview"], "scope": "tenant", "descriptors": descriptors,
                   "value": {"secret": "private", "public": "visible", "protected": "visible-too"}, "roundtrip": True}
        encrypted = output(source, request)
        check(source_label, "preview-sensitive-only", lambda: _sensitive(encrypted))
        for target, target_label in zip(urls, labels):
            check(source_label + "->" + target_label, "preview-imported-sensitive", lambda: expect(target, {**request, "action": "crypto-preview-fields-decrypt", "value": encrypted}, request["value"]))
        for name, value in [("missing", {}), ("null", {"secret": None}), ("unknown", {"secret": "value", "other": "x"}),
                            ("number", {"secret": 2}), ("max-length", {"secret": "x" * 256})]:
            check(source_label, "preview-fields-invalid-" + name, lambda: expect(source, {**request, "value": value}, valid=False))
        check(source_label, "preview-plaintext-rejected", lambda: expect(source, {**request, "action": "crypto-preview-fields-decrypt"}, valid=False))
        if source_label != "node":
            for name, envelope in [("plaintext", "plain"), ("short", "enc:aes256gcm2:AAAA"), ("noncanonical", vectors[1]["envelope"] + "\n")]:
                check(source_label, "storage-reject-" + name, lambda: expect(source, {"action": "crypto-store-decrypt", "key": key["storage"], "value": envelope}, valid=False))
            check(source_label, "preview-key-padding", lambda: expect(source, {**request, "key": key["preview"] + "="}, valid=False))
            check(source_label, "preview-invalid-scope", lambda: expect(source, {**request, "scope": "other"}, valid=False))
            for name, value in [("limit", "x" * (1024 * 1024 + 1)), ("utf8-limit", "🔐" * (256 * 1024 + 1))]:
                check(source_label, "storage-" + name, lambda: expect(source, {"action": "crypto-store-encrypt", "key": key["storage"], "value": value}, valid=False))
                check(source_label, "preview-" + name, lambda: expect(source, {"action": "crypto-preview-encrypt", "key": key["preview"], "scope": "tenant", "path": ["key"], "value": value}, valid=False))
            check(source_label, "storage-short-key", lambda: expect(source, {"action": "crypto-store-encrypt", "key": "short", "value": "secret"}, valid=False))
            check(source_label, "preview-path-type", lambda: expect(source, {"action": "crypto-preview-encrypt", "key": key["preview"], "scope": "tenant", "path": [True], "value": "secret"}, valid=False))
            for name, value in [("extra-part", encrypted["secret"] + ":extra"), ("short-nonce", "encrypted:bp-aes256gcm-v1:AA:AAAA"),
                                ("short-tag", "encrypted:bp-aes256gcm-v1:" + "A" * 16 + ":AA")]:
                check(source_label, "preview-reject-" + name, lambda: expect(source, {**request, "action": "crypto-preview-fields-decrypt", "value": {"secret": value}}, valid=False))
            duplicates = deepcopy(descriptors)
            duplicates[0]["fields"].append(fields[0])
            check(source_label, "preview-duplicate-field", lambda: expect(source, {**request, "descriptors": duplicates}, valid=False))
    return results


def _different(first, second):
    assert first != second, "Encryption reused its nonce"


def _sensitive(value):
    assert value["secret"].startswith("encrypted:bp-aes256gcm-v1:"), value
    assert value["public"] == "visible" and value["protected"] == "visible-too" and "optional" not in value, value
