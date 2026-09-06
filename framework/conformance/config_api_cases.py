"""Config HTTP lifecycle, ticket trust, tenant/app policy and encrypted state."""
from copy import deepcopy
import json
import threading
from key_cases import peer
from settings_cases import fixture as settings_fixture
from hosting_cases import fixture as hosting_fixture
from security_cases import post, fixtures, TENANT, APP, SOURCE

PATH = "/.well-known/bp/config"
SERVICE = "com.example.service"


def run_config_api(urls, labels):
    results = []
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    encryption = post(urls[0], {"action": "crypto-keys"})["output"]
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "config-api-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "config-api-" + name, "passed": False, "error": str(error)})
    with peer() as (base, routes, counts, barriers):
        routes["/keys"] = [{"body": {"keys": [key["jwk"] for key in keys]}}]
        claims = {**fixtures()["config-ticket"], "iss": base, "serviceId": SERVICE, "actions": ["config.read", "config.write"]}
        def token(url, changes=None, header=None):
            return post(url, {"action": "jwt-raw", "purpose": "config-ticket", "claims": {**claims, **(changes or {})}, "header": header or {}})["token"]
        tokens = [token(url) for url in urls]
        def read(jwt=tokens[0], **options):
            return {"method": "GET", "path": PATH, "headers": {"authorization": "Bearer " + jwt}, **options}
        def write(values, jwt=tokens[0], **options):
            return {"method": "POST", "path": PATH, "headers": {"authorization": "Bearer " + jwt, "content-type": "application/json"},
                    "body": json.dumps({"tenantId": TENANT, "values": values, **options})}
        def fixture():
            body = hosting_fixture()
            return {"action": "config-api", "declaration": body["declaration"], "snapshot": {**body["snapshot"], "managementOrigins": ["https://manage.test"]},
                    "key": encryption["storage"], "descriptors": settings_fixture()["descriptors"], "issuer": base, "jwksUri": base + "/keys"}
        def invoke(url, steps, **options):
            body = {**fixture(), "steps": steps, **options}; actual = post(url, body)
            assert "outcomes" in actual, actual
            return actual
        def expect(actual, statuses, values=None):
            assert [step["status"] for step in actual["outcomes"]] == statuses, actual
            if values is not None:
                assert [json.loads(step["body"]).get("values") for step in actual["outcomes"]] == values, actual
            return actual
        for signing_label, jwt in zip(labels, tokens):
            for url, label in zip(urls, labels):
                def interchange():
                    app_read = read(jwt); app_read["headers"]["x-bp-app-id"] = APP
                    actual = expect(invoke(url, [write({"secret": {"hidden": [None, True]}, "count": "4"}, jwt), read(jwt),
                        write({"appSecret": "app-secret"}, jwt, appId=APP), app_read]), [200] * 4)
                    values = [json.loads(step["body"])["values"] for step in actual["outcomes"]]
                    assert values[0]["secret"] == values[1]["secret"] == "__redacted__" and values[2] == values[3] == {"appSecret": "__redacted__"}, actual
                    assert "hidden" not in actual["stored"] and "app-secret" not in actual["stored"], actual
                    for index, step in enumerate(actual["outcomes"]):
                        assert post(url, {"contract": "ServiceConfigWriteResponseSchema" if index in (0, 2) else "ServiceConfigReadResponseSchema", "input": json.loads(step["body"])})["valid"], step
                check(label, "tickets-from-" + signing_label, interchange)
        invalid_tokens = {name: token(urls[0], changes, header) for name, changes, header in [
            ("issuer", {"iss": "https://evil.test"}, None), ("audience", {"aud": ["other"]}, None), ("service", {"serviceId": "other"}, None),
            ("realm", {"realm": "runtime"}, None), ("expired", {"exp": 1, "iat": 0}, None), ("future", {"iat": claims["iat"] + 600, "exp": claims["exp"] + 600}, None),
            ("kid", None, {"kid": "unknown"}), ("typ", None, {"typ": "BP-S2S-JWT"}), ("action", {"actions": ["config.write"]}, None)]}
        for url, label in zip(urls, labels):
            def schema():
                actual = expect(invoke(url, [{"method": "GET", "path": PATH + "/schema"}], customUiPath="/settings"), [200])
                value = json.loads(actual["outcomes"][0]["body"])
                assert value["serviceId"] == SERVICE and value["mode"] == "hybrid" and value["supportsWrite"] and value["supportsCustomUi"] and value["customUiPath"] == "/settings", value
                assert post(url, {"contract": "ServiceConfigSchemaResponseSchema", "input": value})["valid"]
            check(label, "public-schema", schema)
            check(label, "missing-ticket", lambda: expect(invoke(url, [{"method": "GET", "path": PATH}]), [401]))
            for name, jwt in invalid_tokens.items(): check(label, "ticket-" + name, lambda: expect(invoke(url, [read(jwt)]), [401]))
            check(label, "wrong-write-action", lambda: expect(invoke(url, [write({}, token(urls[0], {"actions": ["config.read"]}))]), [401]))
            check(label, "unsupported", lambda: expect(invoke(url, [read(), write({})], unsupported=True), [501, 501]))
            check(label, "readonly", lambda: expect(invoke(url, [read(), write({})], writable=False, mode="static"), [200, 501]))
            for name, changes in [("disabled-tenant", {"active": False}), ("unknown-tenant", {"id": SOURCE})]:
                def denied_scope():
                    snapshot = fixture()["snapshot"]
                    if name == "unknown-tenant":
                        # Keep snapshot referential integrity while ticket remains on the old tenant.
                        for app in snapshot["apps"]: app["tenantId"] = SOURCE
                    snapshot["tenants"][0].update(changes)
                    expect(invoke(url, [read(), write({})], snapshot=snapshot), [403, 403])
                check(label, name, denied_scope)
            check(label, "write-ticket-tenant-mismatch", lambda: expect(invoke(url, [write({}, tenantId=SOURCE)]), [403]))
            def config_apps():
                snapshot = fixture()["snapshot"]; snapshot["configApps"] = [{"id": SOURCE, "tenantId": TENANT, "title": "Config-only app"}]
                allowed = read(); allowed["headers"]["x-bp-app-id"] = SOURCE
                denied = read(); denied["headers"]["x-bp-app-id"] = APP
                expect(invoke(url, [allowed, denied, write({}, appId=SOURCE), write({}, appId=APP)], snapshot=snapshot), [200, 403, 200, 403])
            check(label, "config-apps-replaces-runtime-apps", config_apps)
            check(label, "config-apps-empty-denies", lambda: expect(invoke(url, [write({}, appId=APP)], snapshot={**fixture()["snapshot"], "configApps": []}), [403]))
            def revoked_scope():
                snapshot = fixture()["snapshot"]; snapshot["tenants"][0]["active"] = False
                expect(invoke(url, [write({"count": 2}), {"snapshot": snapshot}, read(), write({"count": 4})]), [200, 403, 403])
            check(label, "live-tenant-revocation", revoked_scope)
            if label == "node": continue
            for name, request, status in [
                ("unknown-field", write({"unknown": 1}), 400), ("wrong-field-scope", write({"appSecret": "wrong"}), 400),
                ("wrong-type", write({"count": []}), 400), ("unknown-clear", write({}, clearKeys=["unknown"]), 400),
                ("missing-placeholder", write({"secret": "__redacted__"}), 400), ("null-app", write({}, appId=None), 400),
                ("empty-app", write({}, appId=""), 400), ("invalid-json", {**write({}), "body": "{"}, 400),
                ("duplicate-json", {**write({}), "body": '{"tenantId":"x","tenantId":"y","values":{}}'}, 400),
                ("unsupported-media", {**write({}), "headers": {"authorization": "Bearer " + tokens[0], "content-type": "text/plain"}}, 415),
                ("tenant-header", {**read(), "headers": {"authorization": "Bearer " + tokens[0], "x-bp-tenant-id": SOURCE}}, 403),
                ("app-header", {**write({}, appId=APP), "headers": {**write({})["headers"], "x-bp-app-id": SOURCE}}, 403),
                ("wrong-origin", {**read(), "headers": {"authorization": "Bearer " + tokens[0], "origin": "https://app.test"}}, 403)]:
                check(label, name, lambda: expect(invoke(url, [request]), [status]))
            def transaction():
                failed = write({"secret": "new"}, clearKeys=["count"]); failed["mode"] = "fail"
                actual = expect(invoke(url, [write({"secret": "old", "count": 2}), failed, read(),
                    write({"count": "bad"}, clearKeys=["secret"]), read(), write({"secret": "__redacted__"}, clearKeys=["count"]), read()]),
                    [200, 500, 200, 400, 200, 200, 200])
                values = [json.loads(actual["outcomes"][i]["body"])["values"] for i in (0, 2, 4, 6)]
                assert values[:3] == [{"secret": "__redacted__", "count": 2}] * 3 and values[3] == {"secret": "__redacted__"}, actual
                assert "old" not in actual["stored"] and "new" not in actual["stored"], actual
            check(label, "atomic-clear-save-redaction", transaction)
            def runtime_settings():
                runtime = {"method": "GET", "path": "/check/item", "headers": {"origin": "https://app.test"}}
                actual = expect(invoke(url, [runtime, write({"count": "9", "secret": "tenant"}), write({"appSecret": "app"}, appId=APP), runtime]), [200] * 4)
                assert json.loads(actual["outcomes"][0]["body"]) == {"count": 7}, actual
                assert json.loads(actual["outcomes"][-1]["body"]) == {"count": 9, "secret": "tenant", "appSecret": "app"}, actual
            check(label, "handler-effective-settings", runtime_settings)
            def cors():
                request = read(); request["headers"]["origin"] = "https://manage.test"
                preflight = {"method": "OPTIONS", "path": PATH, "headers": {"origin": "https://manage.test", "access-control-request-method": "POST", "access-control-request-headers": "Authorization, Content-Type, X-BP-App-Id"}}
                denied = deepcopy(preflight); denied["headers"]["access-control-request-method"] = "DELETE"
                unauth = deepcopy(request); del unauth["headers"]["authorization"]
                actual = expect(invoke(url, [preflight, request, unauth, denied]), [204, 200, 401, 403])
                for step in actual["outcomes"][:3]:
                    assert step["headers"]["access-control-allow-origin"] == "https://manage.test" and step["headers"]["access-control-allow-credentials"] == "true", actual
                    assert step["headers"]["cache-control"] == "no-store", actual
            check(label, "management-cors-before-auth", cors)
            def cancelled_write():
                blocked = write({"secret": "new"}, clearKeys=["count"]); blocked["cancelWrite"] = True
                actual = invoke(url, [write({"secret": "old", "count": 2}), blocked, read()])
                assert actual["outcomes"][1]["cancelled"] and json.loads(actual["outcomes"][-1]["body"])["values"] == {"secret": "__redacted__", "count": 2}, actual
            check(label, "cancel-write-preserves-values", cancelled_write)
            def startup():
                actual = post(url, {**fixture(), "steps": [read()], "stored": '{"tenants":{"broken":{"tenant":{"secret":"plaintext"}}}}'})
                assert "startupError" in actual and not actual["ready"], actual
            check(label, "failed-settings-startup", startup)
            check(label, "managed-unready", lambda: expect(invoke(url, [read()], managed=True), [503]))
            check(label, "closed-service", lambda: expect(invoke(url, [{"close": True}, read()]), [503]))
            check(label, "bounded-request", lambda: expect(invoke(url, [write({"secret": "x" * 100})], maxBodyBytes=50), [413]))
            def cache_limit():
                actual = expect(invoke(url, [write({"secret": "old"}), write({"secret": "x" * 1500}), read()], maxBytes=700), [200, 500, 200])
                assert json.loads(actual["outcomes"][-1]["body"])["values"] == {"secret": "__redacted__"}, actual
            check(label, "persistence-error-is-server-error", cache_limit)
            check(label, "unprovisioned-fails-closed", lambda: expect(invoke(url, [read()], issuer=None, jwksUri=None), [401]))
            def head():
                actual = expect(invoke(url, [read(method="HEAD"), {"method": "HEAD", "path": PATH + "/schema"},
                    {"method": "OPTIONS", "path": PATH, "headers": {"origin": "https://manage.test", "access-control-request-method": "HEAD"}}]), [200, 200, 204])
                assert all(not step["body"] for step in actual["outcomes"]), actual
            check(label, "head-and-preflight", head)
            for enabled, configured in [(False, True), (True, False), (True, True)]:
                def dev():
                    request = {"method": "GET", "path": PATH, "headers": {"authorization": "Bearer dev-only", "x-bp-tenant-id": TENANT}}
                    missing_tenant = deepcopy(request); del missing_tenant["headers"]["x-bp-tenant-id"]
                    wrong = deepcopy(request); wrong["headers"]["authorization"] += "-wrong"
                    expect(invoke(url, [request, missing_tenant, wrong], issuer=None, jwksUri=None, enableDevToken=enabled,
                        devToken="dev-only" if configured else None), [200 if enabled and configured else 401, 401, 401])
                check(label, f"dev-token-{enabled}-{configured}", dev)
            def missing_required():
                descriptors = settings_fixture()["descriptors"]
                descriptors[0]["jsonSchema"]["root"]["required"].append("secret")
                runtime = {"method": "GET", "path": "/check/item", "headers": {"origin": "https://app.test"}}
                actual = expect(invoke(url, [runtime, {"method": "GET", "path": "/.well-known/bp/health"}, read(), write({"secret": "configured"}), runtime], descriptors=descriptors), [503, 200, 200, 200, 200])
                assert json.loads(actual["outcomes"][-1]["body"])["secret"] == "configured", actual
            check(label, "missing-settings-remain-configurable", missing_required)
            def authentication_race():
                barriers["/blocked"] = (threading.Event(), threading.Event())
                routes["/blocked"] = [{"barrier": True, "body": {"keys": [key["jwk"] for key in keys]}}]
                snapshot = fixture()["snapshot"]; snapshot["tenants"][0]["active"] = False
                request = write({"secret": "forbidden"}); request["duringAuthSnapshot"] = snapshot
                actual = expect(invoke(url, [request], jwksUri=base + "/blocked"), [503])
                assert actual["stored"] is None, actual
            check(label, "revoked-during-authentication", authentication_race)
            def commit_race():
                snapshot = fixture()["snapshot"]; snapshot["tenants"][0]["active"] = False
                request = write({"count": 2}); request["duringWriteSnapshot"] = snapshot
                actual = expect(invoke(url, [request, read()]), [200, 403])
                assert json.loads(actual["stored"])["tenants"][TENANT]["tenant"] == {"count": 2}, actual
            check(label, "snapshot-waits-for-atomic-commit", commit_race)
            def close_write():
                request = write({"secret": "after-shutdown"}); request["closeWrite"] = True
                actual = invoke(url, [request, read()])
                assert actual["outcomes"][0]["cancelled"] and actual["outcomes"][1]["status"] == 503 and actual["stored"] is None and not actual["ready"], actual
            check(label, "shutdown-cancels-commit", close_write)
            def null_active():
                snapshot = fixture()["snapshot"]; snapshot["tenants"][0]["active"] = None
                actual = invoke(url, [{"snapshot": snapshot, "allowFailure": True}, read()])
                assert actual["outcomes"][0]["rejected"] or actual["outcomes"][1]["status"] == 403, actual
            check(label, "null-active-rejected", null_active)
            for source, source_label in zip(urls, labels):
                def preview():
                    descriptors = settings_fixture()["descriptors"]
                    encrypted = {"revision": "preview"}
                    for scope, values in [("tenant", {"count": "11", "secret": "preview"}), ("app", {"appSecret": "preview-app"})]:
                        encrypted[scope] = post(source, {"action": "crypto-preview-fields-encrypt", "key": encryption["preview"], "scope": scope, "descriptors": descriptors, "value": values})["output"]
                    snapshot = fixture()["snapshot"]; preview_snapshot = {**snapshot, "previewConfig": encrypted}
                    runtime = {"method": "GET", "path": "/check/item", "headers": {"origin": "https://app.test"}}
                    broken = deepcopy(preview_snapshot); broken["previewConfig"]["tenant"]["count"] = "bad-number"
                    actual = invoke(url, [write({"secret": "stored", "count": 3}), {"snapshot": preview_snapshot}, runtime, read(),
                        {"snapshot": broken, "allowFailure": True}, runtime, {"snapshot": snapshot}, runtime], previewKey=encryption["preview"])
                    steps = actual["outcomes"]
                    assert [steps[i]["status"] for i in (0, 1, 2, 4, 5)] == [200] * 5 and steps[3]["rejected"], actual
                    assert json.loads(steps[1]["body"]) == json.loads(steps[4]["body"]) == {"count": 11, "secret": "preview", "appSecret": "preview-app"}, actual
                    assert json.loads(steps[2]["body"])["values"] == {"secret": "__redacted__", "count": 3}, actual
                    assert json.loads(steps[5]["body"]) == {"secret": "stored", "count": 3} and "preview" not in actual["stored"], actual
                check(label, "preview-overlay-from-" + source_label, preview)
    return results
