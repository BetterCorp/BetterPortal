"""Consumer installation against the actual Node config-manager setup and sync routes."""
import base64
from contextlib import contextmanager
from copy import deepcopy
import json
import secrets
import threading

from hosting_cases import fixture
from security_cases import post, fixtures, TENANT, APP, TARGET, SOURCE
from settings_cases import fixture as settings_fixture
from key_cases import peer as transport_peer


def run_installation(urls, labels):
    results = []
    node = urls[labels.index("node")]
    signer_keys = [post(url, {"action": "jwt-key"})["jwk"] for url in urls]
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "installation-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "installation-" + name, "passed": False, "error": str(error)[:1600]})
    @contextmanager
    def peer():
        body = fixture(); config = {name: deepcopy(body["snapshot"][name]) for name in ("tenants", "apps")}
        config["tenants"][0]["services"] = config["tenants"][0]["services"][:1]
        config["tenants"].append({"id": SOURCE, "slug": "unrelated", "title": "Unrelated", "services": []})
        control = post(node, {"action": "sync-peer", "command": "start", "config": config, "setup": True, "jwks": signer_keys})
        try: yield control
        finally: post(node, {"action": "sync-peer", "command": "stop", "id": control["id"]})
    def issue(control, signer=None, changes=None, **options):
        issued = post(control["url"] + "/.well-known/bp/admin/services/begin-install", {"serviceUrl": "https://service.test", "tenantId": TENANT, "instanceId": TARGET, **options})
        token = issued["setupToken"]
        if signer is not None:
            raw = token.split(".")[1]; claims = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
            claims.update(changes or {})
            token = post(signer, {"action": "jwt-raw", "purpose": "setup", "claims": claims})["token"]
        return {"method": "POST", "path": "/.well-known/bp/install", "body": {"setupToken": token, "cpUrl": control["url"]}}
    def invoke(url, control, steps, **options):
        body = fixture(); body.update({"action": "installation", "cpUrl": control["url"], "steps": steps,
            "key": "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="), **options})
        actual = post(url, body)
        assert actual["valid"], {"error": actual.get("error"), "outcomes": brief(actual.get("outcomes", []))}
        return actual["outcomes"]
    def brief(outcomes): return [{"status": row["status"], "body": row.get("body", "")[:250], "ready": row["ready"]} for row in outcomes]
    def cp_state(control): return post(node, {"action": "sync-peer", "id": control["id"], "command": "state"})
    for url, label in zip(urls, labels):
        if label == "node":
            for signer, source in zip(urls, labels):
                def node_install():
                    with peer() as control:
                        body = fixture(); body.update(action="installation", cpUrl=control["url"], steps=[issue(control, signer), {"kind": "restart"}, {}],
                            key="bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="))
                        actual = post(url, body)
                        assert actual["valid"], actual.get("error")
                        steps = actual["outcomes"]
                        assert all(row["status"] == 200 and row["ready"] for row in steps), brief(steps)
                        assert all(row["manifestSync"]["state"] == "synced" for row in steps)
                        assert steps[0]["apiKeyHash"] == steps[1]["apiKeyHash"] and steps[0]["jwk"] == steps[1]["jwk"]
                        assert steps[0]["snapshot"]["serviceIdentity"]["id"] == TARGET
                        assert not actual["loggedCredential"], "Node installer logged its control-plane API key"
                check(label, "install-restart-from-" + source, node_install)
            continue
        for signer, source in zip(urls, labels):
            def lifecycle():
                with peer() as control:
                    install = issue(control, signer)
                    steps = invoke(url, control, [{}, {"path": "/.well-known/jwks.json"}, install, {"kind": "wait", "updates": 2}, {},
                        {"path": "/check/item", "headers": {"origin": "https://app.test"}},
                        {"method": "POST", "path": "/check/item", "headers": {"origin": "https://app.test"}},
                        install, {"kind": "restart"}, {"kind": "state"}, {"kind": "close"}])
                    # Assert readiness at install completion, then finish the initial SSE
                    # replacement before testing unrelated operation/replay behavior.
                    assert steps.pop(3)["ready"], brief(steps)
                    assert [row["status"] for row in steps] == [503, 200, 200, 200, 200, 404, 200, 200, 200, 200], brief(steps)
                    assert not steps[0]["ready"] and all(row["ready"] for row in steps[2:-1]) and not steps[-1]["ready"], brief(steps)
                    response = json.loads(steps[2]["body"])
                    assert "apiKey" not in response and response["ok"] and response["cpUrl"] == control["url"], response
                    assert steps[2]["headers"]["cache-control"] == "no-store" and steps[2]["headers"]["access-control-allow-origin"] == "*"
                    identity = json.loads(steps[1]["body"])["keys"][0]
                    assert steps[2]["bootstrap"]["identity"]["kid"] == steps[8]["bootstrap"]["identity"]["kid"] == identity["kid"]
                    assert steps[2]["apiKeyHash"] == steps[8]["apiKeyHash"] and steps[2]["configKeyHash"] == steps[8]["configKeyHash"]
                    assert steps[2]["bootstrap"]["apiKey"] == steps[2]["bootstrap"]["identity"]["privateKeyPem"] == "__redacted__"
                    assert "bp_sk_t_" not in steps[2]["stored"] and "PRIVATE KEY" not in steps[2]["stored"]
                    snapshot = steps[2]["snapshot"]
                    assert [tenant["id"] for tenant in snapshot["tenants"]] == [TENANT] and snapshot["serviceIdentity"]["id"] == TARGET, snapshot
                    state = cp_state(control); calls = [call["path"] for call in state["calls"]]
                    assert calls.count("/.well-known/bp/services/redeem") == 1 and calls.index("/.well-known/bp/services/redeem") < calls.index("/.well-known/bp/sync/poll"), calls
                    assert state["config"]["manifestCache"][0]["viewIndex"]["check"]["operations"][0]["operationId"] == "check.get"
            check(label, "install-replay-restart-from-" + source, lifecycle)
        for name, claims in (("wrong-service", {"serviceUrl": "https://other.test"}), ("service-path", {"serviceUrl": "https://service.test/other"}),
                             ("wrong-cp-claim", {"cpUrl": "https://other.test"}), ("wrong-jwks", {"cpJwksUri": "https://other.test/jwks"}),
                             ("expired", {"iat": 1, "exp": 2}), ("future-issuance", {"iat": 9999999900, "exp": 9999999999})):
            def denied():
                with peer() as control:
                    steps = invoke(url, control, [issue(control, url, claims), {}])
                    assert [row["status"] for row in steps] == [401, 503], brief(steps)
                    assert all("apiKey" not in row["bootstrap"] for row in steps)
                    assert all(call["path"] != "/.well-known/bp/services/redeem" for call in cp_state(control)["calls"])
            check(label, name, denied)
        def failed_persistence():
            with peer() as control:
                install = issue(control)
                steps = invoke(url, control, [{}, {**install, "mode": "fail"}, {}])
                assert [row["status"] for row in steps] == [503, 500, 503], brief(steps)
                assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"] and "apiKey" not in steps[2]["bootstrap"]
                assert not cp_state(control)["config"]["manifestCache"]
        check(label, "atomic-credential-save-failure", failed_persistence)
        for kind in ("cancel", "close-install", "cancel-after-save", "parallel-install"):
            def persistence_race():
                with peer() as control:
                    install = issue(control)
                    steps = invoke(url, control, [{}, {"kind": kind, "body": install["body"]},
                        install if kind == "cancel-after-save" else {"kind": "state"}])
                    if kind == "parallel-install":
                        assert steps[1]["statuses"] == [200, 200] and steps[1]["ready"], brief(steps)
                    else:
                        assert steps[1].get("cancelled") and not steps[1]["ready"], brief(steps)
                        if kind == "cancel-after-save":
                            assert "apiKey" in steps[1]["bootstrap"] and steps[2]["status"] == 200 and steps[2]["ready"], brief(steps)
                            assert steps[1]["stored"] == steps[2]["stored"]
                        else:
                            assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"] and "apiKey" not in steps[2]["bootstrap"]
                    assert sum(call["path"] == "/.well-known/bp/services/redeem" for call in cp_state(control)["calls"]) == 1
            check(label, "persistence-" + kind, persistence_race)
        def reconfigure():
            with peer() as control:
                first, second = issue(control), issue(control)
                steps = invoke(url, control, [first, second, {"kind": "restart"}])
                assert all(row["status"] == 200 and row["ready"] for row in steps), brief(steps)
                assert steps[0]["apiKeyHash"] != steps[1]["apiKeyHash"] == steps[2]["apiKeyHash"]
                assert steps[0]["configKeyHash"] == steps[1]["configKeyHash"] == steps[2]["configKeyHash"]
                assert steps[0]["bootstrap"]["identity"] == steps[1]["bootstrap"]["identity"] == steps[2]["bootstrap"]["identity"]
        check(label, "same-instance-reconfiguration", reconfigure)
        def cancel_reconfiguration():
            with peer() as control:
                first, second = issue(control), issue(control)
                steps = invoke(url, control, [first, {"kind": "cancel-after-save", "body": second["body"]}, second, {}])
                assert steps[1].get("cancelled") and not steps[1]["ready"], brief(steps)
                assert [row["status"] for row in steps] == [200, 0, 200, 200] and steps[-1]["ready"], brief(steps)
                assert steps[0]["apiKeyHash"] != steps[1]["apiKeyHash"] == steps[2]["apiKeyHash"]
                assert steps[1]["stored"] == steps[2]["stored"]
                assert sum(call["path"] == "/.well-known/bp/services/redeem" for call in cp_state(control)["calls"]) == 2
        check(label, "cancel-committed-reconfiguration-and-replay", cancel_reconfiguration)
        def replacement():
            with peer() as control:
                steps = invoke(url, control, [issue(control), issue(control, instanceId=SOURCE)])
                assert [row["status"] for row in steps] == [200, 409] and steps[1]["ready"], brief(steps)
                assert steps[0]["stored"] == steps[1]["stored"]
        check(label, "reject-replacement-instance", replacement)
        def replace_tenant():
            with peer() as control:
                steps = invoke(url, control, [issue(control), issue(control, tenantId=SOURCE)])
                assert [row["status"] for row in steps] == [200, 409] and steps[1]["ready"], brief(steps)
                assert steps[0]["stored"] == steps[1]["stored"] and steps[0]["bootstrap"]["tenantLock"] == TENANT
        check(label, "reject-replacement-tenant", replace_tenant)
        def legacy_reconfigure():
            with peer() as control:
                key = "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
                first = invoke(url, control, [issue(control)], key=key)[0]
                state = post(url, {"action": "bootstrap", "operation": "decrypt", "key": key, "stored": first["stored"]})["state"]
                del state["installation"]
                stored = post(url, {"action": "bootstrap", "operation": "encrypt", "key": key, "state": state})["stored"]
                wrong = {**fixture()["snapshot"], "serviceIdentity": {"id": SOURCE}}
                steps = invoke(url, control, [{}, issue(control), {"kind": "snapshot", "snapshot": wrong}, {"kind": "restart"}, {}], key=key, stored=stored)
                assert [row["status"] for row in steps] == [200, 200, 400, 200, 200] and all(row["ready"] for row in steps), brief(steps)
                assert steps[1]["snapshot"] == steps[2]["snapshot"] and steps[1]["bootstrap"]["identity"] == first["bootstrap"]["identity"]
        check(label, "legacy-credentials-bind-on-reconfiguration", legacy_reconfigure)
        for name, options in [("unmanaged", {"managed": False}), ("bad-state", {"stored": "{"}),
            ("remote-http", {"cpUrl": "http://remote.test"}), ("abbreviated-loopback", {"cpUrl": "http://127.1"}),
            ("cp-query", {"cpUrl": "https://cp.test?query"}), ("jwks-userinfo", {"jwksUri": "https://user:secret@cp.test/keys"}),
            ("service-path", {"serviceUrl": "https://service.test/base"}), ("zero-delay", {"retryDelay": 0}), ("negative-timeout", {"requestTimeout": -1})]:
            def invalid_startup():
                body = {**fixture(), "action": "installation", "cpUrl": "https://cp.test", "steps": [],
                    "key": "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="), **options}
                actual = post(url, body)
                assert not actual["valid"] and not actual["outcomes"], actual
            check(label, "startup-" + name, invalid_startup)
        def settings_activation():
            with peer() as control:
                declaration = {**fixture()["declaration"], "configSchemas": settings_fixture()["descriptors"]}
                claims = {**fixtures()["config-ticket"], "iss": control["url"], "serviceId": declaration["pluginId"], "actions": ["config.read", "config.write"]}
                ticket = post(url, {"action": "jwt-raw", "purpose": "config-ticket", "claims": claims})["token"]
                headers = {"authorization": "Bearer " + ticket}
                write = {"method": "POST", "path": "/.well-known/bp/config", "headers": headers,
                         "body": {"tenantId": TENANT, "values": {"count": "12", "secret": "installation-setting-secret"}}}
                read = {"path": "/.well-known/bp/config", "headers": headers}
                operation = {"path": "/check/item", "headers": {"origin": "https://app.test"}}
                # Readiness follows the initial poll. Wait for the first SSE snapshot
                # before testing unchanged config reads; auth rejects retired snapshots.
                settled = {"kind": "wait", "updates": 2}
                steps = invoke(url, control, [{"path": "/.well-known/bp/config/schema"}, issue(control), settled, {"path": "/.well-known/bp/config/schema"},
                    operation, write, read, operation, issue(control), settled, operation, {"kind": "restart"}, settled, read, operation], declaration=declaration, returnConfig=True)
                assert all(row["status"] == 200 for row in steps), brief(steps)
                assert not json.loads(steps[0]["body"])["supportsWrite"] and json.loads(steps[3]["body"])["supportsWrite"]
                assert json.loads(steps[4]["body"]) == {"count": 7}, brief(steps)
                for index in (5, 6, 13): assert json.loads(steps[index]["body"])["values"] == {"count": 12, "secret": "__redacted__"}, brief(steps)
                for index in (7, 10, 14): assert json.loads(steps[index]["body"]) == {"count": 12, "secret": "installation-setting-secret"}, brief(steps)
                assert "installation-setting-secret" not in steps[5]["settingsStored"] and steps[5]["settingsStored"] == steps[13]["settingsStored"]
                assert steps[5]["configKeyHash"] == steps[13]["configKeyHash"]
        check(label, "settings-activation-reconfigure-restart", settings_activation)
        def corrupt_settings():
            with peer() as control:
                declaration = {**fixture()["declaration"], "configSchemas": settings_fixture()["descriptors"]}
                steps = invoke(url, control, [issue(control), {}], declaration=declaration, settingsStored='{"tenants":1}')
                assert [row["status"] for row in steps] == [500, 503], brief(steps)
                assert json.loads(steps[0]["body"])["installed"] and "apiKey" in steps[0]["bootstrap"] and not steps[0]["ready"]
                assert steps[0]["settingsStored"] == '{"tenants":1}' and not cp_state(control)["config"]["manifestCache"]
        check(label, "invalid-settings-cache-stays-unready", corrupt_settings)
        for name, step, expected in [
            ("missing-fields", {"body": {}}, 400), ("null-token", {"body": {"setupToken": None}}, 400),
            ("unknown-field", {"body": {"unknown": True}}, 400), ("bad-token", {"body": {"setupToken": "invalid"}}, 401),
            ("large-token", {"body": {"setupToken": "x" * 32769}}, 400), ("malformed-json", {"raw": "{"}, 400),
            ("duplicate-json", {"raw": '{"setupToken":"one","setupToken":"two","cpUrl":"https://cp.test"}'}, 400),
            ("deep-json", {"raw": '[' * 2000 + '0' + ']' * 2000}, 400),
            ("wrong-media", {"raw": "not-json", "headers": {"content-type": "text/plain"}}, 415),
            ("wrong-method", {"method": "GET"}, 405), ("wrong-cp", {"body": {"cpUrl": "https://other.test"}}, 403)]:
            def invalid_request():
                with peer() as control:
                    request = issue(control)
                    if "body" in step: request["body"].update(step["body"])
                    request.update({key: value for key, value in step.items() if key != "body"})
                    if name == "missing-fields": request["body"] = {}
                    if "raw" in step: request.pop("body", None); request.setdefault("headers", {"content-type": "application/json"})
                    if request.get("method") == "GET": request.pop("body", None)
                    steps = invoke(url, control, [request, {}])
                    assert [row["status"] for row in steps] == [expected, 503], brief(steps)
                    assert "apiKey" not in steps[0]["bootstrap"] and all(call["path"] != "/.well-known/bp/services/redeem" for call in cp_state(control)["calls"])
            check(label, "request-" + name, invalid_request)
        def cors_and_head():
            with peer() as control:
                steps = invoke(url, control, [{"method": "OPTIONS", "path": "/.well-known/bp/install", "headers": {"origin": "https://admin-ui.test", "access-control-request-method": "POST", "access-control-request-headers": "Content-Type"}},
                    {"method": "HEAD", "path": "/.well-known/jwks.json"}, issue(control)])
                assert [row["status"] for row in steps] == [204, 200, 200], brief(steps)
                assert steps[0]["headers"]["access-control-allow-origin"] == "*" and "POST" in steps[0]["headers"]["access-control-allow-methods"]
                assert "access-control-allow-credentials" not in steps[0]["headers"] and steps[1]["body"] == ""
        check(label, "public-preflight-and-jwks-head", cors_and_head)
        def body_bound():
            with peer() as control:
                steps = invoke(url, control, [issue(control)], maxBodyBytes=32)
                assert steps[0]["status"] == 413 and "apiKey" not in steps[0]["bootstrap"], brief(steps)
        check(label, "body-bound-before-redemption", body_bound)
        with transport_peer() as (base, routes, counts, barriers):
            routes["/.well-known/jwks.json"] = [{"body": {"keys": signer_keys}}]
            claims = {**fixtures()["setup"], "iss": base, "cpUrl": base, "cpJwksUri": base + "/.well-known/jwks.json", "instanceId": TARGET,
                      "serviceUrl": "https://service.test", "scope": {"tenantId": TENANT}}
            token = post(url, {"action": "jwt-raw", "purpose": "setup", "claims": claims})["token"]
            install = {"method": "POST", "path": "/.well-known/bp/install", "body": {"setupToken": token, "cpUrl": base}}
            redeem_path = "/.well-known/bp/services/redeem"
            credentials = {"apiKey": "bp_test_install_key", "cpId": "test-cp", "cpJwksUri": claims["cpJwksUri"]}
            for name, response in [("status", {"status": 500, "raw": b"private-upstream-secret"}),
                ("redirect", {"status": 307, "location": base + "/redirected"}), ("wrong-media", {"type": "text/html", "body": credentials}),
                ("malformed", {"raw": b"{"}), ("empty", {"raw": b""}), ("missing-key", {"body": {"cpId": "cp"}}),
                ("wrong-jwks", {"body": {**credentials, "cpJwksUri": "https://other.test/jwks"}}),
                ("header-injection", {"body": {**credentials, "apiKey": "key\r\nX: injected"}}),
                ("large-key", {"body": {**credentials, "apiKey": "x" * 4097}}), ("large-response", {"raw": b"x" * (1024 * 1024 + 1)}),
                ("deadline", {"delay": 0.3, "body": credentials})]:
                def rejected_redemption():
                    routes[redeem_path] = [{"type": "application/json", **response}]
                    steps = invoke(url, {"url": base}, [install, {}], requestTimeout=0.05 if name == "deadline" else 1)
                    assert [row["status"] for row in steps] == [502, 503], brief(steps)
                    assert "apiKey" not in steps[0]["bootstrap"] and "private-upstream-secret" not in steps[0]["body"]
                    assert not counts.get("/redirected") and not counts.get("/.well-known/bp/sync/poll")
                check(label, "redeem-" + name, rejected_redemption)
            routes[redeem_path] = [{"type": "application/json", "body": credentials}]
            routes["/.well-known/bp/sync/poll"] = [{"type": "application/json", "status": 503}]
            def failed_sync():
                steps = invoke(url, {"url": base}, [install, {}])
                assert [row["status"] for row in steps] == [503, 503], brief(steps)
                assert json.loads(steps[0]["body"])["installed"] and steps[0]["bootstrap"]["apiKey"] == "__redacted__"
            check(label, "manifest-required-before-readiness", failed_sync)
            def retry_sync():
                counts.clear()
                routes["/.well-known/bp/sync/poll"] = [{"type": "application/json", "status": 503}, {"type": "application/json", "body": fixture()["snapshot"]}]
                steps = invoke(url, {"url": base}, [install, {"kind": "wait"}, {}])
                assert [row["status"] for row in steps] == [503, 200, 200] and steps[-1]["ready"], brief(steps)
                assert counts[redeem_path] == 1 and steps[0]["stored"] == steps[-1]["stored"]
            check(label, "retry-sync-without-redeeming-again", retry_sync)
            def tenant_lock():
                snapshot = deepcopy(fixture()["snapshot"])
                snapshot["tenants"].append({"id": SOURCE, "slug": "other", "title": "Other", "services": []})
                other = deepcopy(snapshot["apps"][0]); other.update(id=SOURCE, tenantId=SOURCE, slug="other", hostnames=["other.test"])
                snapshot["apps"].append(other)
                routes["/.well-known/bp/sync/poll"] = [{"type": "application/json", "body": snapshot}]
                routes["/.well-known/bp/sync"] = [{"type": "text/event-stream", "raw": b"", "hold": True}]
                claims_ticket = {**fixtures()["config-ticket"], "iss": base, "serviceId": fixture()["declaration"]["pluginId"], "tenantId": SOURCE}
                ticket = post(url, {"action": "jwt-raw", "purpose": "config-ticket", "claims": claims_ticket})["token"]
                steps = invoke(url, {"url": base}, [install, {"path": "/check/item", "headers": {"origin": "https://other.test"}},
                    {"method": "OPTIONS", "path": "/check/item", "headers": {"origin": "https://other.test", "access-control-request-method": "GET"}},
                    {"path": "/.well-known/bp/config", "headers": {"authorization": "Bearer " + ticket}}, {"kind": "restart"},
                    {"path": "/check/item", "headers": {"origin": "https://other.test"}}], requestTimeout=5)
                assert [row["status"] for row in steps] == [200, 426, 426, 403, 200, 426], brief(steps)
                assert steps[0]["bootstrap"]["tenantLock"] == TENANT and steps[-1]["ready"]
            check(label, "tenant-lock-covers-operations-config-and-restart", tenant_lock)
            for name, snapshot in [("missing-identity", {k: v for k, v in fixture()["snapshot"].items() if k != "serviceIdentity"}),
                                   ("wrong-identity", {**fixture()["snapshot"], "serviceIdentity": {"id": SOURCE}})]:
                def bound_snapshot():
                    routes["/.well-known/bp/sync/poll"] = [{"type": "application/json", "body": snapshot}]
                    steps = invoke(url, {"url": base}, [install, {}])
                    assert [row["status"] for row in steps] == [503, 503] and steps[0]["snapshot"] is None, brief(steps)
                check(label, "snapshot-" + name, bound_snapshot)
            for phase, path in [("jwks", "/.well-known/jwks.json"), ("redeem", redeem_path), ("sync", "/.well-known/bp/sync/poll")]:
                for kind in ("cancel", "close-install", "host-stop"):
                    def cancelled_transport():
                        counts.clear(); barriers.clear()
                        routes["/.well-known/jwks.json"] = [{"body": {"keys": signer_keys}}]
                        routes[redeem_path] = [{"type": "application/json", "body": credentials}]
                        routes["/.well-known/bp/sync/poll"] = [{"type": "application/json", "body": fixture()["snapshot"]}]
                        barriers[path] = (threading.Event(), threading.Event()); routes[path][0]["barrier"] = True
                        steps = invoke(url, {"url": base}, [{"kind": kind, "path": "/.well-known/bp/install", "barrier": base + path, "body": install["body"]}, {"kind": "state"}])
                        assert steps[0].get("cancelled") and all(not step["ready"] for step in steps), brief(steps)
                        assert ("apiKey" in steps[0]["bootstrap"]) == (phase == "sync")
                        assert steps[0]["snapshot"] is None
                        if phase == "jwks": assert not counts.get(redeem_path), counts
                        if phase != "sync": assert not counts.get("/.well-known/bp/sync/poll"), counts
                    check(label, phase + "-" + kind, cancelled_transport)
    return results
