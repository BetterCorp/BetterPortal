"""Standalone atomic state policy; Node supplies real schema, JWT and preview wire baselines."""
from copy import deepcopy
import json
import threading
import sys
from access_cases import fixture
from key_cases import peer
from security_cases import post, fixtures, SOURCE, TARGET, ISSUER, AUDIENCE

DECLARATION = {"pluginId": "com.example.service", "title": "Snapshots", "description": "Snapshots", "version": "1.0.0"}
HEADERS = {"origin": "https://app.test"}


def run_snapshots(urls, labels):
    results = []
    native = [(url, label) for url, label in zip(urls, labels) if label != "node"]
    initial = fixture()["snapshot"]
    changed = deepcopy(initial); changed["tenants"][0]["title"] = "Changed"
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "snapshots-" + name, "passed": True})
        except Exception as error:
            print(f"{label} snapshots-{name}: {str(error)[:500]}", file=sys.stderr, flush=True)
            results.append({"runtime": label, "id": "snapshots-" + name, "passed": False, "error": str(error)})
    def execute(url, steps, **options):
        result = post(url, {"action": "snapshots", "declaration": DECLARATION, "steps": steps, **options})
        assert result["temporaryFiles"] == 0, result
        return result
    def title(state): return state["snapshot"]["tenants"][0]["title"] if state["snapshot"] else None
    def apply(snapshot=initial, **options): return {"snapshot": snapshot, **options}
    read = {"kind": "read", "headers": HEADERS}
    for url, label in native:
        if label == "python":
            def worker_cancel():
                actual = execute(url, [], workerProbe=True)
                assert actual == {"cancelled": True, "preserved": True, "temporaryFiles": 0}, actual
            check(label, "repeated-worker-cancellation-cleanup", worker_cancel)
        def file_error():
            actual = execute(url, [], fileProbe=True)
            assert actual == {"failed": True, "preserved": True, "temporaryFiles": 0}, actual
        check(label, "file-rename-failure-cleanup", file_error)
        def readiness():
            actual = execute(url, [read, apply(), read, apply(submitted=True), read])["steps"]
            assert [step["ready"] for step in actual] == [False, False, False, True, True], actual
            assert [actual[i]["request"]["status"] for i in (0, 2, 4)] == [503, 503, 200], actual
        check(label, "manifest-before-readiness", readiness)
        def local():
            actual = execute(url, [apply(), read], managed=False)["steps"]
            assert actual[0]["ready"] and actual[1]["request"]["status"] == 200, actual
        check(label, "local-readiness", local)
        def restored():
            actual = execute(url, [{"kind": "restore"}, read, apply(submitted=True), read], stored=json.dumps(initial))["steps"]
            assert actual[0]["restored"] and not actual[0]["ready"] and actual[1]["request"]["status"] == 503, actual
            assert actual[-1]["request"]["status"] == 200, actual
        check(label, "restored-cache-not-ready", restored)
        for name, stored in [("missing", None), ("malformed", "{"), ("duplicate-json", '{"tenants":[],"tenants":[]}'), ("null", "null"), ("array", "[]")]:
            def restore_invalid():
                actual = execute(url, [{"kind": "restore"}], **({"stored": stored} if stored is not None else {}))["steps"][0]
                assert actual["snapshot"] is None and not actual["ready"], actual
                assert (actual.get("restored") is False) if stored is None else not actual["accepted"], actual
            check(label, "restore-" + name, restore_invalid)
        def restore_late():
            actual = execute(url, [apply(submitted=True), {"kind": "restore"}])["steps"]
            assert not actual[-1]["accepted"] and actual[-1]["ready"], actual
        check(label, "restore-cannot-replace-active", restore_late)
        def save_failure():
            actual = execute(url, [apply(submitted=True), apply(changed, save="fail"), read])
            assert not actual["steps"][1]["accepted"] and title(actual["steps"][1]) == "Tenant", actual
            assert actual["steps"][2]["request"]["status"] == 200 and json.loads(actual["stored"])["tenants"][0]["title"] == "Tenant", actual
        check(label, "save-failure-preserves-active-and-disk", save_failure)
        def failed_start():
            actual = execute(url, [apply(submitted=True, save="fail"), read])
            assert not actual["steps"][0]["accepted"] and actual["stored"] is None and actual["steps"][1]["request"]["status"] == 503, actual
        check(label, "failed-first-save-not-ready", failed_start)
        def first_save_blocked():
            actual = execute(url, [apply(submitted=True, save="block")])["steps"][0]
            assert not actual["during"]["ready"] and actual["during"]["snapshot"] is None and actual["ready"], actual
        check(label, "first-save-not-ready-until-commit", first_save_blocked)
        def serialize_updates():
            last = deepcopy(changed); last["tenants"][0]["title"] = "Last"
            actual = execute(url, [apply(submitted=True), apply(changed, save="block", queued=last)])
            assert title(actual["steps"][-1]) == "Last" and json.loads(actual["stored"])["tenants"][0]["title"] == "Last" and actual["saves"] == 3, actual
        check(label, "serialized-concurrent-updates", serialize_updates)
        for name, options in [("commit", {}), ("cancel", {"cancel": True}), ("shutdown", {"shutdown": True})]:
            def blocked():
                actual = execute(url, [apply(submitted=True), apply(changed, save="block", **options)])
                outcome = actual["steps"][1]
                assert title(outcome["during"]) == "Tenant" and outcome["during"]["ready"], actual
                expected = "Changed" if name == "commit" else "Tenant"
                assert title(outcome) == expected and json.loads(actual["stored"])["tenants"][0]["title"] == expected, actual
                if name != "commit": assert outcome["cancelled"], actual
                assert outcome["ready"] == (name != "shutdown"), actual
            check(label, "persist-before-activate-" + name, blocked)
        def closed():
            actual = execute(url, [apply(submitted=True), {"kind": "close"}, apply(changed), read])
            assert not actual["steps"][2]["accepted"] and title(actual["steps"][2]) == "Tenant" and actual["steps"][3]["request"]["status"] == 503, actual
        check(label, "closed-service-rejects-update", closed)
        def owned():
            actual = execute(url, [apply(submitted=True), {"kind": "mutate"}])["steps"]
            assert title(actual[-1]) == "Tenant", actual
        check(label, "snapshot-owned-copy", owned)
        mutations = [
            ("duplicate-tenant", lambda data: data["tenants"].append(deepcopy(data["tenants"][0]))),
            ("duplicate-app", lambda data: data["apps"].append(deepcopy(data["apps"][0]))),
            ("orphan-app", lambda data: data["apps"][0].update(tenantId=SOURCE)),
            ("invalid-origin", lambda data: data["apps"][0].update(originOverrides=["https://evil.test/path"])),
            ("insecure-verifier", lambda data: data["apps"][0].update(auth={"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": "http://remote.test/keys"})),
        ]
        for name, mutate in mutations:
            def invalid():
                bad = deepcopy(changed); mutate(bad)
                actual = execute(url, [apply(submitted=True), apply(bad)])
                assert not actual["steps"][1]["accepted"] and title(actual["steps"][1]) == "Tenant" and actual["saves"] == 1, actual
            check(label, "reject-" + name, invalid)
        for name, mutate, status in [
            ("revoked-operation", lambda data: data["apps"][0]["routes"][0].update(operations=["check.post"]), 404),
            ("inactive-tenant", lambda data: data["tenants"][0].update(active=False), 400),
            ("changed-origin", lambda data: data["apps"][0].update(hostnames=["elsewhere.test"]), 400),
        ]:
            def policy_update():
                update = deepcopy(changed); mutate(update)
                actual = execute(url, [apply(submitted=True), read, apply(update), read])["steps"]
                assert actual[1]["request"]["status"] == 200 and actual[3]["request"]["status"] == status, actual
            check(label, "live-" + name, policy_update)
        def urls_update():
            update = deepcopy(changed); update["tenants"][0]["services"][0]["hostname"] = "https://changed.test"
            actual = execute(url, [apply(submitted=True), read, apply(update), read])["steps"]
            assert actual[1]["request"]["url"] == "https://service.test/check/item" and actual[3]["request"]["url"] == "https://changed.test/check/item", actual
        check(label, "url-cache-replaced", urls_update)
        def size_limit():
            actual = execute(url, [apply(submitted=True)], maxBytes=20)
            assert not actual["steps"][0]["accepted"] and actual["stored"] is None, actual
        check(label, "file-size-limit", size_limit)

    for source, source_label in native:
        cached = execute(source, [apply(submitted=True)])["stored"]
        for target, target_label in zip(urls, labels):
            def portable():
                if target_label == "node":
                    assert post(target, {"contract": "ScopedServiceConfigSchema", "input": json.loads(cached)})["valid"]
                else:
                    actual = execute(target, [{"kind": "restore"}], stored=cached)["steps"][0]
                    assert actual["restored"] and title(actual) == "Tenant" and not actual["ready"], actual
            check(source_label + "->" + target_label, "cache-interchange", portable)

    descriptors = [{"id": "test", "title": "Test", "description": "Preview", "scope": "tenant", "jsonSchema": {}, "fields": [
        {"key": name, "title": name, "description": name, "scope": scope, "visibility": visibility, "ownership": "bp", "sourceOfTruth": "bp"}
        for name, scope, visibility in [("secret", "tenant", "secret"), ("public", "tenant", "public"), ("appSecret", "app", "secret")]]}]
    for source, source_label in zip(urls, labels):
        key = post(source, {"action": "crypto-keys"})["output"]["preview"]
        preview = {"revision": "one"}
        for scope, values in [("tenant", {"secret": "private", "public": "visible"}), ("app", {"appSecret": "app-private"})]:
            preview[scope] = post(source, {"action": "crypto-preview-fields-encrypt", "key": key, "scope": scope, "descriptors": descriptors, "value": values})["output"]
        config = deepcopy(initial); config["previewConfig"] = preview
        for url, label in native:
            def preview_roundtrip():
                actual = execute(url, [apply(config, submitted=True), read, apply(), read], previewKey=key, declaration={**DECLARATION, "configSchemas": descriptors})
                assert actual["steps"][1]["request"]["config"] == {"secret": "private", "public": "visible", "appSecret": "app-private"}, actual
                assert actual["steps"][3]["request"]["config"] == {}, actual
                encrypted = execute(url, [apply(config, submitted=True)], previewKey=key, declaration={**DECLARATION, "configSchemas": descriptors})["stored"]
                assert "private" not in encrypted, encrypted
                restored = execute(url, [{"kind": "restore"}], stored=encrypted, previewKey=key, declaration={**DECLARATION, "configSchemas": descriptors})
                assert restored["steps"][0]["restored"], restored
            check(source_label + "->" + label, "preview-atomic-interchange", preview_roundtrip)
            for name, mutate in [
                ("bad-app-cipher", lambda data: data["previewConfig"]["app"].update(appSecret="plaintext")),
                ("unknown-field", lambda data: data["previewConfig"]["tenant"].update(unknown="value")),
                ("missing-app", lambda data: data.update(apps=[])),
                ("ambiguous-scope", lambda data: data["tenants"].append({"id": SOURCE, "slug": "second", "title": "Second", "services": []})),
                ("inactive-scope", lambda data: data["tenants"][0].update(active=False)),
            ]:
                def preview_invalid():
                    bad = deepcopy(config); bad["previewConfig"]["revision"] = "two"; mutate(bad)
                    actual = execute(url, [apply(config, submitted=True), apply(bad), read], previewKey=key, declaration={**DECLARATION, "configSchemas": descriptors})
                    assert not actual["steps"][1]["accepted"] and actual["saves"] == 1, actual
                    assert actual["steps"][2]["request"]["config"]["appSecret"] == "app-private", actual
                    assert json.loads(actual["stored"])["previewConfig"]["revision"] == "one", actual
                check(source_label + "->" + label, "preview-preserved-" + name, preview_invalid)

    with peer() as (base, routes, counts, barriers):
        for signer, signer_label in zip(urls, labels):
            key = post(signer, {"action": "jwt-key"})
            token = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": fixtures()["access"]})["token"]
            headers = {**HEADERS, "authorization": "Bearer " + token}
            for url, label in native:
                for name in ("revocation", "rotation", "race", "cancel"):
                    def auth_update():
                        path = "/snapshots/" + signer_label + "/" + label + "/" + name
                        good = {"body": {"keys": [key["jwk"]]}, "barrier": name in ("race", "cancel")}
                        routes[path] = [good, {"body": {"keys": []}}] if name == "rotation" else [good]
                        if name in ("race", "cancel"): barriers[path] = threading.Event(), threading.Event()
                        config = deepcopy(initial)
                        config["apps"][0]["auth"] = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": base + path,
                            "roles": [{"id": "reader", "title": "Reader", "permissions": [{"serviceId": TARGET, "viewId": "check", "permissions": ["read"]}]}]}
                        update = deepcopy(config)
                        if name != "rotation": update["apps"][0]["auth"]["roles"] = []
                        steps = [apply(config, submitted=True)]
                        if name in ("race", "cancel"): steps += [{"kind": "auth-race", "headers": headers, "snapshot": update, "uri": base + path, "cancel": name == "cancel"}]
                        else: steps += [{"kind": "read", "headers": headers}, apply(update), {"kind": "read", "headers": headers}]
                        actual = execute(url, steps, auth={"required": True, "permissions": [{"serviceId": "com.example.service", "viewId": "check", "permissions": ["read"]}]})["steps"]
                        if name == "cancel": assert actual[-1]["request"] == {"cancelled": True}, actual
                        else: assert actual[-1]["request"]["status"] == {"race": 503, "rotation": 401, "revocation": 403}[name], actual
                        if name not in ("race", "cancel"): assert actual[1]["request"]["status"] == 200 and counts[path] == 2, actual
                    check(signer_label + "->" + label, "auth-" + name, auth_update)
    return results
