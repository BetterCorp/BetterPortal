"""Real encrypted files, atomic failures and all-language persisted-state interchange."""
from copy import deepcopy
import json
from settings_cases import fixture
from security_cases import post, TENANT, APP, SOURCE


def run_settings_store(urls, labels):
    results = []
    key = post(urls[0], {"action": "crypto-keys"})["output"]["storage"]
    other = SOURCE
    initialize = {"kind": "initialize"}
    def write(values, tenant=TENANT, **options): return {"kind": "write", "tenantId": tenant, "values": values, **options}
    def read(tenant=TENANT, **options): return {"kind": "read", "tenantId": tenant, **options}
    def invoke(url, steps, **options):
        body = fixture(); body.update(action="settings-store", key=key, steps=steps, **options)
        actual = post(url, body)
        assert "outcomes" in actual, actual
        return actual
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "settings-store-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "settings-store-" + name, "passed": False, "error": str(error)})
    seed_steps = [initialize, write({"secret": "one-secret", "count": 2}), write({"appSecret": {"private": [None, True]}}, appId=APP), write({"secret": "two-secret"}, other)]
    seeds = {}
    for url, label in zip(urls, labels):
        def seed():
            actual = invoke(url, seed_steps)
            assert all(value["valid"] for value in actual["outcomes"]), actual
            assert "one-secret" not in actual["stored"] and "two-secret" not in actual["stored"] and '"private"' not in actual["stored"], actual
            seeds[label] = actual["stored"]
        check(label, "encrypted-write", seed)
    for source, stored in seeds.items():
        for url, label in zip(urls, labels):
            def interchange():
                actual = invoke(url, [initialize, read(), read(appId=APP), read(other), read(other, appId=APP)], stored=stored)
                assert all(value["valid"] for value in actual["outcomes"]), actual
                assert [value["values"] for value in actual["outcomes"][1:]] == [
                    {"secret": "one-secret", "count": 2}, {"appSecret": {"private": [None, True]}}, {"secret": "two-secret"}, {}], actual
                assert post(url, {"contract": "PersistedServiceConfigStateSchema", "input": json.loads(actual["stored"])})["valid"]
            check(label, "read-" + source, interchange)
    for url, label in zip(urls, labels):
        if label == "node": continue
        def lifecycle():
            actual = invoke(url, [read(), write({"secret": "uninitialized"}), initialize, initialize,
                write({"secret": "one-secret"}), {"kind": "mutate", "tenantId": TENANT}, read(), read(redacted=True),
                {"kind": "restart"}, read(), initialize, read(), {"kind": "close"}, read(), write({"count": 9})])
            steps = actual["outcomes"]
            assert [i for i, value in enumerate(steps) if not value["valid"]] == [0, 1, 9, 13, 14], actual
            assert steps[2]["ready"] and not steps[2]["loaded"] and not steps[3]["loaded"] and steps[10]["loaded"], actual
            assert steps[6]["values"] == steps[11]["values"] == {"secret": "one-secret"}, actual
            assert steps[7]["values"] == {"secret": "__redacted__"} and not steps[12]["ready"], actual
            assert steps[4]["stored"] == steps[-1]["stored"], actual
        check(label, "lifecycle-and-owned-reads", lifecycle)
        def overlays():
            actual = invoke(url, [initialize, read(), read(appId=APP), {"kind": "effective", "tenantId": TENANT, "appId": APP},
                write({"secret": "tenant"}), write({"appSecret": "app"}, appId=APP), {"kind": "effective", "tenantId": TENANT, "appId": APP},
                read(appId=APP, redacted=True), read(other)])
            assert all(value["valid"] for value in actual["outcomes"]), actual
            assert [value["values"] for value in actual["outcomes"][1:4]] == [{}, {}, {"count": 7}], actual
            assert actual["outcomes"][6]["values"] == {"count": 7, "secret": "tenant", "appSecret": "app"}, actual
            assert actual["outcomes"][7]["values"] == {"appSecret": "__redacted__"} and actual["outcomes"][8]["values"] == {}, actual
        check(label, "stored-overrides-vs-effective", overlays)
        for name, failed in [
            ("unknown", write({"unknown": 1})), ("scope", write({"appSecret": "wrong-scope"})),
            ("invalid-value", write({"count": "invalid"}, clearKeys=["secret"])),
            ("clear-unknown", write({}, clearKeys=["absent"])),
            ("placeholder-missing", write({"appSecret": "__redacted__"}, appId=APP)),
            ("persistence", write({"secret": "new"}, clearKeys=["count"], mode="fail"))]:
            def failure():
                actual = invoke(url, [initialize, write({"secret": "old", "count": 2}), failed, read()])
                steps = actual["outcomes"]
                assert steps[1]["valid"] and not steps[2]["valid"] and steps[3]["valid"], actual
                assert steps[3]["values"] == {"secret": "old", "count": 2} and steps[1]["stored"] == steps[2]["stored"] == steps[3]["stored"], actual
            check(label, "atomic-failure-" + name, failure)
        def clear_and_placeholder():
            actual = invoke(url, [initialize, write({"secret": {"old": [None]}, "count": 4}), write({"secret": "__redacted__"}, clearKeys=["count"]), read(),
                write({}, clearKeys=["secret"]), read(), {"kind": "effective", "tenantId": TENANT, "appId": APP}])
            assert all(value["valid"] for value in actual["outcomes"]), actual
            assert actual["outcomes"][3]["values"] == {"secret": {"old": [None]}} and actual["outcomes"][5]["values"] == {}, actual
            assert actual["outcomes"][6]["values"] == {"count": 7}, actual
        check(label, "atomic-clear-and-placeholder", clear_and_placeholder)
        for kind in ("cancel-write", "close-write"):
            def cancellation():
                blocked = write({"secret": "new"}); blocked["kind"] = kind
                actual = invoke(url, [initialize, write({"secret": "old"}), blocked, {"kind": "restart"}, initialize, read()])
                steps = actual["outcomes"]
                assert all(value["valid"] for value in steps) and steps[2]["cancelled"], actual
                assert steps[1]["stored"] == steps[2]["stored"] and steps[-1]["values"] == {"secret": "old"}, actual
            check(label, kind, cancellation)
        def cancelled_initialize():
            actual = invoke(url, [{"kind": "cancel-initialize"}, initialize, read()])
            assert actual["outcomes"][0]["cancelled"] and not actual["outcomes"][0]["ready"], actual
            assert actual["outcomes"][1]["ready"] and actual["outcomes"][2]["values"] == {} and actual["stored"] is None, actual
        check(label, "cancel-initialize", cancelled_initialize)
        def concurrent():
            first = write({"count": 3}); first.update(kind="concurrent-save", following=write({"secret": "following"}))
            actual = invoke(url, [initialize, write({"secret": "old"}), first, read(), {"kind": "concurrent", "writes": [write({"count": i}, str(i)) for i in range(12)]}, read("9")])
            assert all(value["valid"] for value in actual["outcomes"]), actual
            assert actual["outcomes"][3]["values"] == {"secret": "following", "count": 3} and actual["outcomes"][-1]["values"] == {"count": 9}, actual
            assert len(json.loads(actual["stored"])["tenants"]) == 13, actual
        check(label, "serialized-concurrent-writes", concurrent)
        def size_failure():
            actual = invoke(url, [initialize, write({"secret": "old"}), write({"secret": "x" * 1500}), read()], maxBytes=700)
            assert actual["outcomes"][1]["valid"] and not actual["outcomes"][2]["valid"], actual
            assert actual["outcomes"][3]["values"] == {"secret": "old"} and actual["outcomes"][1]["stored"] == actual["stored"], actual
        check(label, "bounded-file-preserves-state", size_failure)
        check(label, "memory-store", lambda: _memory(invoke(url, [initialize, write({"secret": "memory"}), read()], memory=True)))
        for name, stored in [("json", "{"), ("duplicate", '{"tenants":{},"tenants":{}}'), ("wrong-shape", '[]'), ("unknown-root", '{"other":{}}'),
            ("plain-secret", json.dumps({"tenants": {TENANT: {"tenant": {"secret": "plaintext"}}}})),
            ("wrong-field-scope", json.dumps({"tenants": {TENANT: {"app": {APP: {"count": 1}}}}})),
            ("empty-tenant", '{"tenants":{"":{}}}'), ("empty-app", json.dumps({"tenants": {TENANT: {"app": {"": {}}}}}))]:
            def invalid_cache():
                actual = invoke(url, [initialize, read()], stored=stored)
                assert all(not value["valid"] and not value["ready"] for value in actual["outcomes"]) and actual["stored"] == stored, actual
            check(label, "reject-cache-" + name, invalid_cache)
        if seeds:
            sample = json.loads(next(iter(seeds.values())))["tenants"][TENANT]
            for shape in ("bare", "wrapped"):
                def legacy():
                    stored = json.dumps(sample if shape == "bare" else {"tenants": {}, "legacy": sample})
                    actual = invoke(url, [initialize, {"kind": "initialize", "legacyTenantId": TENANT}, read(), read(other)], stored=stored)
                    assert not actual["outcomes"][0]["valid"] and actual["outcomes"][0]["stored"] == stored, actual
                    assert all(value["valid"] for value in actual["outcomes"][1:]), actual
                    assert actual["outcomes"][2]["values"] == {"secret": "one-secret", "count": 2} and actual["outcomes"][3]["values"] == {}, actual
                    assert "legacy" not in json.loads(actual["stored"]) and list(json.loads(actual["stored"])["tenants"]) == [TENANT], actual
                check(label, "explicit-legacy-owner-" + shape, legacy)
            def legacy_conflict():
                stored = json.dumps({"tenants": {TENANT: sample}, "legacy": sample})
                actual = invoke(url, [{"kind": "initialize", "legacyTenantId": TENANT}], stored=stored)
                assert not actual["outcomes"][0]["valid"] and actual["stored"] == stored, actual
            check(label, "legacy-owner-conflict", legacy_conflict)
            for cancelled in (False, True):
                def failed_migration():
                    stored = json.dumps(sample)
                    failed = {"kind": "cancel-migration" if cancelled else "initialize", "legacyTenantId": TENANT, "mode": "fail"}
                    actual = invoke(url, [failed, {"kind": "initialize", "legacyTenantId": TENANT}, read()], stored=stored)
                    first = actual["outcomes"][0]
                    assert first["stored"] == stored and not first["ready"] and (first.get("cancelled") if cancelled else not first["valid"]), actual
                    assert actual["outcomes"][1]["valid"] and actual["outcomes"][2]["values"] == {"secret": "one-secret", "count": 2}, actual
                check(label, "legacy-" + ("cancel" if cancelled else "failed-save"), failed_migration)
            def corrupted_ciphertext():
                corrupted = deepcopy(sample); corrupted["app"][APP]["appSecret"] += "tampered"
                stored = json.dumps({"tenants": {TENANT: corrupted}})
                actual = invoke(url, [initialize, read()], stored=stored)
                assert all(not step["ready"] and not step["valid"] for step in actual["outcomes"]) and actual["stored"] == stored, actual
            check(label, "reject-tampered-app-cache", corrupted_ciphertext)
    return results


def _memory(actual):
    assert all(value["valid"] for value in actual["outcomes"]), actual
    assert actual["outcomes"][-1]["values"] == {"secret": "memory"} and actual["stored"] is None, actual
