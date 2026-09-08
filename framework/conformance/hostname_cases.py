"""Hostname approval through the existing Node CP and standalone installation hosts."""
import base64
from contextlib import contextmanager
from copy import deepcopy
import json
import secrets
import threading

from hosting_cases import fixture
from key_cases import peer as transport_peer
from security_cases import post, TENANT, TARGET, SOURCE

PATH = "/.well-known/bp/hostname-change"
CONFIRM = "/.well-known/bp/services/confirm-hostname-change"
POLL = "/.well-known/bp/sync/poll"
OLD, NEW = "https://service.test", "https://renamed.test:8443"
TOKEN = "bp_hc_" + "a" * 43


def run_hostname(urls, labels):
    results = []
    node = urls[labels.index("node")]
    key = "bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")

    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "hostname-" + name, "passed": True})
        except Exception as error: results.append({"runtime": label, "id": "hostname-" + name, "passed": False, "error": str(error)[:2000]})

    @contextmanager
    def peer():
        config = {name: deepcopy(fixture()["snapshot"][name]) for name in ("tenants", "apps")}
        config["tenants"][0]["services"] = config["tenants"][0]["services"][:1]
        control = post(node, {"action": "sync-peer", "command": "start", "config": config, "setup": True})
        try: yield control
        finally: post(node, {"action": "sync-peer", "command": "stop", "id": control["id"]})

    def seed(url, cp, **changes):
        state = {"version": 1, "apiKey": "bp-test-key", "cpUrl": cp, "cpId": "test-cp", "cpJwksUri": cp + "/.well-known/jwks.json",
            "configEncryptionKey": "hostname-settings-secret-" + "x" * 32, "tenantLock": TENANT,
            "installation": {"instanceId": TARGET, "serviceUrl": OLD, "cpUrl": cp, "cpJwksUri": cp + "/.well-known/jwks.json", "scope": {"tenantId": TENANT}, "jti": SOURCE}, **changes}
        actual = post(url, {"action": "bootstrap", "operation": "encrypt", "key": key, "state": state})
        assert actual["valid"], actual
        return actual["stored"]

    def call(url, cp, steps, **options):
        actual = post(url, {**fixture(), "action": "installation", "cpUrl": cp, "key": key, "steps": steps,
            "stored": seed(url, cp), **options})
        assert actual["valid"], {"error": actual.get("error"), "outcomes": actual.get("outcomes")}
        return actual["outcomes"]

    def issue(control, address=NEW):
        return post(control["url"] + "/.well-known/bp/admin/services/begin-hostname-change", {"instanceId": TARGET, "serviceUrl": address})["changeToken"]

    def request(token=TOKEN, **changes): return {"method": "POST", "path": PATH, "body": {"changeToken": token}, **changes}
    def brief(steps): return [{"status": row["status"], "ready": row["ready"], "body": row.get("body", "")[:200]} for row in steps]

    for url, label in zip(urls, labels):
        def lifecycle():
            with peer() as control:
                token = issue(control)
                steps = call(url, control["url"], [{}, {"kind": "restart", "serviceUrl": NEW}, {}, request(token), {}, {"kind": "restart"}, {}])
                assert steps[3]["status"] == 200 and json.loads(steps[3]["body"]) == {"ok": True, "serviceUrl": NEW}, brief(steps)
                assert all(steps[index]["ready"] for index in (0, 3, 4, 5, 6)), brief(steps)
                assert all(row["apiKeyHash"] == steps[0]["apiKeyHash"] and row["configKeyHash"] == steps[0]["configKeyHash"] for row in steps)
                config = post(node, {"action": "sync-peer", "id": control["id"], "command": "state"})["config"]
                assert config["tenants"][0]["services"][0]["hostname"] == NEW
                if label != "node":
                    assert steps[2]["status"] == 503 and not steps[1]["ready"], brief(steps)
                    assert steps[0]["bootstrap"]["installation"]["serviceUrl"] == OLD and steps[3]["bootstrap"]["installation"]["serviceUrl"] == NEW
                    assert steps[3]["bootstrap"]["identity"] == steps[0]["bootstrap"]["identity"] == steps[5]["bootstrap"]["identity"]
                    assert steps[3]["headers"]["access-control-allow-origin"] == "*" and steps[3]["headers"]["cache-control"] == "no-store"
        check(label, "real-cp-confirm-restart-preserves-identity", lifecycle)
        if label == "node": continue

        def forged_headers():
            with peer() as control:
                steps = call(url, control["url"], [{}, request(issue(control), headers={"host": "renamed.test:8443", "x-forwarded-proto": "https", "forwarded": "host=renamed.test:8443;proto=https"})])
                assert steps[1]["status"] == 403 and steps[1]["ready"] and steps[0]["stored"] == steps[1]["stored"], brief(steps)
        check(label, "headers-cannot-change-configured-address", forged_headers)

        def replay():
            with peer() as control:
                token = issue(control)
                steps = call(url, control["url"], [request(token), request(token), {"kind": "restart"}], serviceUrl=NEW)
                assert [row["status"] for row in steps] == [200, 400, 200] and all(row["ready"] for row in steps), brief(steps)
                assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"]
        check(label, "file-cp-single-use-token-does-not-undo-commit", replay)

        def rejection():
            with peer() as control:
                steps = call(url, control["url"], [{}, request(), {}], serviceUrl=NEW)
                assert [row["status"] for row in steps] == [503, 400, 503] and steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"], brief(steps)
        check(label, "unrecognized-token-preserves-old-binding", rejection)

        for name, changes, status in [
            ("empty", {"body": {"changeToken": ""}}, 400), ("jwt", {"body": {"changeToken": "eyJ.setup.token"}}, 400),
            ("null", {"body": {"changeToken": None}}, 400), ("unknown-field", {"body": {"changeToken": TOKEN, "serviceUrl": NEW}}, 400),
            ("non-json", {"raw": "{}", "headers": {"content-type": "text/plain"}}, 415), ("invalid-json", {"raw": "{", "headers": {"content-type": "application/json"}}, 400),
            ("deep-json", {"raw": '[' * 2000 + '0' + ']' * 2000, "headers": {"content-type": "application/json"}}, 400),
            ("oversized", {"raw": " " * (1024 * 1024 + 1), "headers": {"content-type": "application/json"}}, 413),
            ("get", {"method": "GET"}, 405), ("head", {"method": "HEAD"}, 405), ("preflight", {"method": "OPTIONS"}, 204),
        ]:
            def invalid_input():
                steps = call(url, "https://cp.test", [{}, request(**changes)], serviceUrl=NEW)
                assert steps[1]["status"] == status and steps[0]["stored"] == steps[1]["stored"], brief(steps)
            check(label, "input-" + name, invalid_input)
        def uninstalled():
            stored = post(url, {"action": "bootstrap", "operation": "encrypt", "key": key, "state": {"version": 1}})["stored"]
            steps = call(url, "https://cp.test", [request()], stored=stored)
            assert steps[0]["status"] == 409 and not steps[0]["ready"], brief(steps)
        check(label, "uninstalled", uninstalled)

        with transport_peer() as (base, routes, counts, barriers):
            good = {"type": "application/json", "body": {"ok": True, "serviceUrl": NEW}}
            snapshot = fixture()["snapshot"]
            snapshot["tenants"][0]["services"][0]["hostname"] = NEW
            routes[POLL] = [{"type": "application/json", "body": snapshot}]
            routes["/.well-known/bp/sync"] = [{"type": "text/event-stream", "raw": b"", "hold": True}]
            for name, response, status in [
                ("denied-key", {"status": 401}, 401), ("denied-instance", {"status": 403}, 403), ("busy", {"status": 409}, 409),
                ("upstream-error", {"status": 500, "raw": b"private-upstream-secret"}, 502),
                ("redirect", {"status": 307, "location": base + "/redirected"}, 502),
                ("wrong-media", {"type": "text/html", "body": good["body"]}, 502),
                ("malformed", {"raw": b"{"}, 502), ("null", {"body": None}, 502),
                ("false-ok", {"body": {"ok": False, "serviceUrl": NEW}}, 502),
                ("wrong-address", {"body": {"ok": True, "serviceUrl": OLD}}, 502),
                ("unsafe-address", {"body": {"ok": True, "serviceUrl": "http://remote.test"}}, 502),
                ("large", {"raw": b"x" * (1024 * 1024 + 1)}, 502),
                ("deadline", {"delay": 0.3, "body": good["body"]}, 502),
            ]:
                def upstream_rejection():
                    counts.clear(); routes[CONFIRM] = [{"type": "application/json", **response}]
                    steps = call(url, base, [{}, request(), {}], serviceUrl=NEW, requestTimeout=0.05 if name == "deadline" else 1)
                    assert [row["status"] for row in steps] == [503, status, 503], brief(steps)
                    assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"] and "private-upstream-secret" not in steps[1]["body"]
                    assert not counts.get(POLL) and not counts.get("/redirected"), counts
                check(label, "confirm-" + name, upstream_rejection)

            for name, mutate in [
                ("wrong-instance", lambda value: value["serviceIdentity"].update(id=SOURCE)),
                ("wrong-address", lambda value: value["tenants"][0]["services"][0].update(hostname=OLD)),
                ("missing-instance", lambda value: value.pop("serviceIdentity")),
                ("missing-registration", lambda value: value["tenants"][0]["services"].pop(0)),
                ("invalid-snapshot", lambda value: value.update(tenants=None)),
            ]:
                def snapshot_rejection():
                    candidate = deepcopy(snapshot); mutate(candidate)
                    routes[CONFIRM] = [good]; routes[POLL] = [{"type": "application/json", "body": candidate}]
                    steps = call(url, base, [{}, request(), {}], serviceUrl=NEW)
                    assert [row["status"] for row in steps] == [503, 502, 503] and steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"], brief(steps)
                check(label, "projection-" + name, snapshot_rejection)

            routes[CONFIRM] = [good]; routes[POLL] = [{"type": "application/json", "body": snapshot}]
            def failed_sync():
                counts.clear()
                routes[POLL] = [{"type": "application/json", "body": snapshot}, {"status": 503}]
                steps = call(url, base, [request(), {}], serviceUrl=NEW)
                assert [row["status"] for row in steps] == [503, 503] and json.loads(steps[0]["body"])["installed"], brief(steps)
                assert steps[0]["bootstrap"]["installation"]["serviceUrl"] == NEW and steps[0]["stored"] == steps[1]["stored"]
            check(label, "committed-address-requires-normal-sync", failed_sync)
            def revoked_projection():
                routes[POLL] = [{"status": 401}]
                steps = call(url, base, [{}, request()], serviceUrl=NEW)
                assert steps[1]["status"] == 401 and not steps[1]["ready"] and steps[0]["stored"] == steps[1]["stored"], brief(steps)
            check(label, "confirmation-cannot-bypass-revoked-credential", revoked_projection)
            def bounded_projection():
                routes[POLL] = [{"type": "application/json", "raw": b"x" * (16 * 1024 * 1024 + 1)}]
                steps = call(url, base, [{}, request()], serviceUrl=NEW)
                assert steps[1]["status"] == 502 and steps[0]["stored"] == steps[1]["stored"], brief(steps)
            check(label, "projection-byte-limit", bounded_projection)
            def response_projection():
                routes[POLL] = [{"type": "application/json", "body": snapshot}]
                routes[CONFIRM] = [{"type": "application/json", "body": {**good["body"], "apiKey": "private-upstream-secret"}}]
                steps = call(url, base, [request()], serviceUrl=NEW)
                assert steps[0]["status"] == 200 and json.loads(steps[0]["body"]) == good["body"], brief(steps)
            check(label, "success-response-omits-upstream-secrets", response_projection)
            def total_deadline():
                routes[CONFIRM] = [{**good, "delay": 0.18}]
                routes[POLL] = [{"type": "application/json", "body": snapshot, "delay": 0.18}]
                steps = call(url, base, [{}, request()], serviceUrl=NEW, requestTimeout=0.3)
                assert steps[1]["status"] == 502 and steps[0]["stored"] == steps[1]["stored"], brief(steps)
            check(label, "confirmation-and-projection-share-deadline", total_deadline)
            routes[CONFIRM] = [good]; routes[POLL] = [{"type": "application/json", "body": snapshot}]
            def save_failure():
                steps = call(url, base, [{}, request(mode="fail"), {}], serviceUrl=NEW)
                assert [row["status"] for row in steps] == [503, 500, 503] and steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"], brief(steps)
            check(label, "atomic-save-failure", save_failure)

            for kind in ("cancel", "close-install", "cancel-after-save", "parallel-install"):
                def persistence_race():
                    steps = call(url, base, [{}, {"kind": kind, "hostname": True, "body": {"changeToken": TOKEN}},
                        {"kind": "restart"} if kind == "cancel-after-save" else {"kind": "state"}], serviceUrl=NEW)
                    if kind == "parallel-install":
                        assert steps[1]["statuses"] == [200, 200] and steps[1]["ready"], brief(steps)
                    else:
                        assert steps[1].get("cancelled") and not steps[1]["ready"], brief(steps)
                        if kind == "cancel-after-save":
                            assert steps[1]["bootstrap"]["installation"]["serviceUrl"] == NEW and steps[2]["ready"], brief(steps)
                            assert steps[1]["stored"] == steps[2]["stored"]
                        else: assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"]
                check(label, "persistence-" + kind, persistence_race)

            for path, phase in ((CONFIRM, "confirm"), (POLL, "projection")):
                for kind in ("cancel", "close-install", "host-stop"):
                    def cancel_transport():
                        counts.clear(); barriers.clear()
                        routes[CONFIRM] = [dict(good)]; routes[POLL] = [{"type": "application/json", "body": snapshot}]
                        barriers[path] = (threading.Event(), threading.Event()); routes[path][0]["barrier"] = True
                        steps = call(url, base, [{}, {"kind": kind, "hostname": True, "path": PATH, "body": {"changeToken": TOKEN}, "barrier": base + path}, {"kind": "state"}], serviceUrl=NEW)
                        assert steps[1].get("cancelled") and all(not row["ready"] for row in steps), brief(steps)
                        assert steps[0]["stored"] == steps[1]["stored"] == steps[2]["stored"]
                        if phase == "confirm": assert not counts.get(POLL), counts
                    check(label, phase + "-" + kind, cancel_transport)
    return results
