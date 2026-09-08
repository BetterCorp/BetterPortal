"""Native control-plane clients against a language-neutral HTTP/SSE peer."""
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import sys
import time

from hosting_cases import fixture
from security_cases import post
from registry_cases import fixture as registry_fixture


@contextmanager
def sync_peer():
    scenarios, calls, counts = {}, {}, {}
    stop = threading.Event(); lock = threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def do_POST(self): self.reply()
        def do_GET(self): self.reply()
        def reply(self):
            base, _, suffix = self.path.partition("/.well-known/bp/sync")
            key = (base, self.command)
            raw = self.rfile.read(int(self.headers.get("content-length", "0")))
            with lock:
                calls.setdefault(base, []).append({"method": self.command, "path": self.path, "headers": dict(self.headers), "body": json.loads(raw) if raw else None})
                choices = scenarios.get(base, {"poll": [{"raw": b"unexpected redirect"}], "sse": [{"raw": b"unexpected redirect", "hold": False}]})["poll" if suffix == "/poll" else "sse"]
                index = counts.get(key, 0); counts[key] = index + 1
                value = choices[min(index, len(choices) - 1)]
            try:
                if value.get("waitHeaders"): stop.wait(value["waitHeaders"])
                data = value.get("raw", json.dumps(value.get("snapshot", {})).encode())
                self.send_response(value.get("status", 200))
                self.send_header("Content-Type", value.get("type", "application/json" if suffix == "/poll" else "text/event-stream"))
                if value.get("location"): self.send_header("Location", value["location"])
                self.send_header("Connection", "close")
                if suffix == "/poll": self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                for chunk in value.get("chunks", [data]): self.wfile.write(chunk); self.wfile.flush()
                if suffix != "/poll" and value.get("hold", True): stop.wait(4)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
            finally: self.close_connection = True
        def log_message(self, *args): pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.05), daemon=True); thread.start()
    try: yield f"http://127.0.0.1:{server.server_port}", scenarios, calls, counts
    finally: stop.set(); server.shutdown(); server.server_close(); thread.join(timeout=2)


def run_sync(urls, labels):
    results = []
    def check(label, name, action):
        try: action(); results.append({"runtime": label, "id": "sync-" + name, "passed": True})
        except Exception as error:
            print(f"{label} sync-{name}: {str(error)[:400]}", file=sys.stderr, flush=True)
            results.append({"runtime": label, "id": "sync-" + name, "passed": False, "error": str(error)})
    initial = fixture()["snapshot"]
    updated = deepcopy(initial); updated["tenants"][0]["title"] = "Updated"
    def event(snapshot=updated, newline="\n"):
        return ("event: config" + newline + "data: " + json.dumps(snapshot) + newline * 2).encode()
    def title(result): return result["final"]["snapshot"]["tenants"][0]["title"]
    with sync_peer() as (base, scenarios, calls, counts):
        for url, label in zip(urls, labels):
            if label == "node": continue
            def scenario(name, poll=None, sse=None, **options):
                path = "/" + label + "/" + name
                scenarios[path] = {"poll": poll or [{"snapshot": initial}], "sse": sse or [{"raw": b": connected\n\n"}]}
                body = fixture(); body.update(action="sync", baseUrl=base + path, **options)
                actual = post(url, body)
                assert actual["valid"], actual
                assert actual["closed"]["phase"] == "closed", actual
                assert not actual["readyAfterClose"], actual
                assert counts[(path, "POST")] <= actual["closed"]["attempts"] <= counts[(path, "POST")] + 1, actual
                for call in calls[path]:
                    headers = {key.lower(): value for key, value in call["headers"].items()}
                    assert headers["authorization"] == "Bearer bp-test-key", headers
                    if call["method"] == "POST": assert call["body"] == actual["submission"], call
                return actual, path
            def startup():
                actual, path = scenario("startup", until={"phase": "connected"})
                assert actual["started"] and actual["health"] == {"status": 200, "body": {"ok": True}}, actual
                assert actual["final"]["sync"]["updates"] == 1 and [call["method"] for call in calls[path]][:2] == ["POST", "GET"], actual
                for target, target_label in zip(urls, labels):
                    valid = post(target, {"contract": "ControlPlaneSubmissionSchema", "input": actual["submission"]})
                    assert valid["valid"], (target_label, valid)
            check(label, "manifest-before-stream", startup)
            for name, wire in [("lf", event()), ("crlf", event(newline="\r\n")), ("cr", event(newline="\r")), ("bom", b"\xef\xbb\xbf" + event()),
                ("multiline", b"event: config\ndata: {\ndata: " + json.dumps(updated)[1:].encode() + b"\n\n"),
                ("ignored-then-valid", b"event: unrelated\ndata: {}\n\n" + event())]:
                def streaming():
                    actual, _ = scenario("stream-" + name, sse=[{"raw": wire}], until={"updates": 2})
                    assert title(actual) == "Updated" and actual["final"]["sync"]["updates"] == 2, actual
                check(label, "stream-" + name, streaming)
            def split_chunks():
                actual, _ = scenario("split-chunks", sse=[{"chunks": [bytes([byte]) for byte in event(newline="\r\n")]}], until={"updates": 2})
                assert title(actual) == "Updated", actual
            check(label, "split-crlf-chunks", split_chunks)
            def unicode_chunks():
                unicode_config = deepcopy(updated); unicode_config["tenants"][0]["title"] = "Updated café 🔐"
                wire = ("event: config\ndata: " + json.dumps(unicode_config, ensure_ascii=False) + "\n\n").encode()
                actual, _ = scenario("unicode-chunks", sse=[{"chunks": [bytes([byte]) for byte in wire]}], until={"updates": 2})
                assert title(actual) == "Updated café 🔐", actual
            check(label, "unicode-chunks", unicode_chunks)
            def invalid_then_valid():
                actual, _ = scenario("invalid-event", sse=[{"raw": b"event: config\ndata: {\n\n" + event()}], until={"updates": 2})
                assert title(actual) == "Updated" and actual["saves"] == 2 and actual["final"]["sync"]["lastError"] is None, actual
            check(label, "invalid-event-preserves-and-recovers", invalid_then_valid)
            def incomplete():
                actual, _ = scenario("partial-frame", sse=[{"raw": event().rstrip(b"\n"), "hold": False}, {"raw": b": connected\n\n"}], until={"updates": 2, "phase": "connected"})
                assert title(actual) == "Tenant" and actual["saves"] == 2, actual
            check(label, "incomplete-frame-not-applied", incomplete)
            for name, failure in [("status", {"status": 503}), ("type", {"snapshot": initial, "type": "text/html"}),
                ("malformed", {"raw": b"{"}), ("scope", {"snapshot": {}})]:
                def first_failure():
                    actual, path = scenario("bootstrap-" + name, poll=[failure], retryDelay=1)
                    assert not actual["started"] and not actual["final"]["ready"] and actual["health"] == {"status": 503, "body": {"ok": False}}, actual
                    assert all(call["method"] == "POST" for call in calls[path]), calls[path]
                check(label, "failed-bootstrap-" + name, first_failure)
            def reconnect():
                actual, path = scenario("reconnect", sse=[{"raw": b": close\n\n", "hold": False}, {"raw": event()}], until={"updates": 3})
                assert title(actual) == "Updated" and [call["method"] for call in calls[path]][:4] == ["POST", "GET", "POST", "GET"], actual
            check(label, "reconnect-resubmits-manifest", reconnect)
            def poll_fallback():
                actual, _ = scenario("poll-fallback", poll=[{"snapshot": initial}, {"snapshot": updated}], sse=[{"status": 503, "raw": b"", "hold": False}], until={"updates": 2})
                assert title(actual) == "Updated", actual
            check(label, "poll-fallback", poll_fallback)
            def bootstrap_retry():
                actual, _ = scenario("bootstrap-retry", poll=[{"status": 503}, {"snapshot": updated}], until={"updates": 1, "phase": "connected"})
                assert not actual["started"] and actual["final"]["ready"] and title(actual) == "Updated", actual
            check(label, "failed-bootstrap-retries", bootstrap_retry)
            for code in (401, 403, 409, 412, 503):
                def denial():
                    actual, _ = scenario("denied-" + str(code), poll=[{"snapshot": initial}, {"status": 503}],
                        sse=[{"status": code, "raw": b"", "hold": False}], until={"attempts": 2, "phase": "retrying"})
                    assert actual["started"] and title(actual) == "Tenant", actual
                    assert actual["final"]["ready"] == (code == 503), actual
                    assert actual["operation"]["status"] == (200 if code == 503 else 503), actual
                check(label, "authorization-or-transient-" + str(code), denial)
            def denial_recovery():
                actual, _ = scenario("denial-recovery", sse=[{"status": 403, "raw": b"", "hold": False}, {"raw": event()}], until={"updates": 3})
                assert actual["final"]["ready"] and title(actual) == "Updated", actual
            check(label, "authorization-recovery", denial_recovery)
            for name, mutate, expected in [
                ("operation", lambda value: value["apps"][0]["routes"][0].update(operations=["check.post"]), 404),
                ("tenant", lambda value: value["tenants"][0].update(active=False), 400),
                ("origin", lambda value: value["apps"][0].update(hostnames=["changed.test"]), 400),
            ]:
                def policy_update():
                    config = deepcopy(updated); mutate(config)
                    actual, _ = scenario("policy-" + name, sse=[{"raw": event(config)}], until={"updates": 2})
                    assert actual["operation"]["status"] == expected, actual
                check(label, "live-policy-" + name, policy_update)
            for mode in ("poll", "sse"):
                def redirect():
                    leak = "/leak-" + label + "-" + mode
                    reply = {"status": 302, "location": base + leak, "raw": b"", "hold": False}
                    actual, _ = scenario("redirect-" + mode, **({"poll": [reply]} if mode == "poll" else {"sse": [reply]}),
                                         retryDelay=1, until={} if mode == "poll" else {"phase": "retrying"})
                    assert not calls.get(leak), calls.get(leak)
                    if mode == "poll": assert not actual["started"] and not actual["final"]["ready"], actual
                check(label, "reject-redirect-" + mode, redirect)
            for name, response in [("duplicate-json", {"raw": b'{"tenants":[],"tenants":[]}'}), ("invalid-utf8", {"raw": b'{"x":"\xff"}'}),
                ("too-large", {"raw": b" " * (16 * 1024 * 1024 + 1)}), ("deadline", {"waitHeaders": 0.3})]:
                def invalid_poll():
                    actual, _ = scenario("invalid-poll-" + name, poll=[response], retryDelay=1, requestTimeout=0.1 if name == "deadline" else 1)
                    assert not actual["started"] and not actual["final"]["ready"] and actual["stored"] is None, actual
                check(label, "poll-" + name, invalid_poll)
            for name, wire in [("utf8", b"event: config\ndata: \xff\n\n"), ("too-large", b"data: " + b" " * (16 * 1024 * 1024))]:
                def invalid_stream():
                    actual, _ = scenario("invalid-stream-" + name, sse=[{"raw": wire}], retryDelay=1, until={"phase": "retrying"})
                    assert title(actual) == "Tenant" and actual["saves"] == 1, actual
                check(label, "stream-reject-" + name, invalid_stream)
            def previous_frame():
                actual, _ = scenario("good-before-bad", sse=[{"raw": event() + b"event: config\ndata: \xff\n\n"}], retryDelay=1, until={"phase": "retrying"})
                assert title(actual) == "Updated" and actual["saves"] == 2, actual
            check(label, "valid-frame-before-invalid-encoding", previous_frame)
            def failed_save():
                actual, _ = scenario("save-failed", saveFailures=1, until={"updates": 1, "phase": "connected"})
                assert not actual["started"] and actual["final"]["ready"] and actual["saves"] == 2, actual
            check(label, "failed-persistence-retries", failed_save)
            for cached in (json.dumps(initial), "{"):
                def restored():
                    actual, _ = scenario("restore-" + str(len(cached)), stored=cached, poll=[{"snapshot": updated}], until={"phase": "connected"})
                    assert actual["started"] and title(actual) == "Updated", actual
                check(label, "restore-" + str(len(cached)), restored)
            def hosted():
                actual, _ = scenario("hosted", hosted=True, sse=[{"raw": event()}], until={"updates": 2})
                assert actual["health"]["status"] == 200 and actual["serviceClosed"] and title(actual) == "Updated", actual
            check(label, "host-lifetime", hosted)
            def cancel_startup():
                path = "/" + label + "/cancel-startup"
                scenarios[path] = {"poll": [{"waitHeaders": 1, "snapshot": initial}], "sse": []}
                body = fixture(); body.update(action="sync", baseUrl=base + path, cancelStartup=True)
                assert post(url, body) == {"valid": True, "cancelled": True, "ready": False, "stored": None}
            check(label, "cancel-startup", cancel_startup)
            def cancel_failed_save():
                path = "/" + label + "/cancel-failed-save"
                scenarios[path] = {"poll": [{"snapshot": initial}], "sse": []}
                body = fixture(); body.update(action="sync", baseUrl=base + path, cancelFailedSave=True)
                assert post(url, body) == {"valid": True, "cancelled": True, "ready": False, "stored": None}
            check(label, "cancel-failed-save", cancel_failed_save)
            for name, options in [("local-service", {"managed": False}), ("empty-key", {"apiKey": ""}), ("header-injection", {"apiKey": "key\r\nx: injected"}),
                ("large-key", {"apiKey": "x" * 4097}), ("zero-delay", {"retryDelay": 0}), ("negative-timeout", {"requestTimeout": -1}),
                ("large-delay", {"retryDelay": 4294968}), ("large-timeout", {"requestTimeout": 4294968})]:
                def invalid_options():
                    body = fixture(); body.update(action="sync", baseUrl=base, **options)
                    assert post(url, body) == {"valid": False}
                check(label, "options-" + name, invalid_options)
            def payload():
                source = registry_fixture()
                source["routes"][0]["operations"][0]["renderers"] = [{"declaration": {"renderer": theme, "kind": kind, **({"key": "nav.profile"} if kind == "fragment" else {})}}
                    for theme in ("bootstrap5", "other") for kind in ("page", "fragment")]
                source["routes"][0]["operations"][0]["declaration"].update(dependencies=[{"operationId": "items.write", "method": "POST"}],
                    robots=[{"userAgent": "*", "access": "disallow"}], chrome={"hideMenu": True})
                source["routes"][0]["operations"][1].update(raw=True)
                source["routes"][0]["operations"][1]["declaration"]["apiContracts"] = [{"id": "write", "version": "1.0.0", "title": "Write"}]
                source["declaration"].update(shell={"service": "example", "renderer": "bootstrap5"},
                    configSchemas=[{"id": "settings", "title": "Settings", "description": "Settings", "scope": "tenant", "jsonSchema": {}, "fields": []}],
                    m2mRequests=[{"id": "read-peer", "title": "Read peer", "contractId": "write", "methods": ["GET"]}],
                    webhooks=[{"id": "changed", "title": "Changed", "payloadSchema": {}}],
                    developerResources=[{"id": "guide", "kind": "guide", "title": "Guide", "mediaType": "text/plain", "content": "Example guide"}])
                actual, _ = scenario("payload", declaration=source["declaration"], routes=source["routes"], generateKey=True,
                    authProvider={"issuer": "https://auth.test", "audience": "app", "jwksUri": "https://auth.test/keys"}, until={"phase": "connected"})
                value = actual["submission"]; view = value["viewIndex"]["items.index"]; read, write = view["operations"]
                assert view["pathVariants"] == ["/items/:key", "/items"] and len(view["fragments"]) == 1, value
                assert view["fragments"][0] == {"fragmentId": "nav.profile", "targetPath": "/items/:key", "operationId": "items.read", "method": "GET"}, value
                assert read["renderers"] == ["bootstrap5", "other"] and read["renderModes"] == ["page", "fragment"] and not read["authRequired"], value
                assert write["authRequired"] and write["raw"] and write["schemas"]["response"] == {} and "metadataResponse" in write["schemas"], value
                assert len(value["apiContracts"]) == len(value["configSchemas"]) == len(value["m2mRequests"]) == len(value["webhooks"]) == len(value["developerResources"]) == 1, value
                assert value["shell"]["renderer"] == "bootstrap5" and value["authProvider"]["audience"] == "app", value
                assert value["publicKeyPem"].startswith("-----BEGIN PUBLIC KEY-----") and len(value["keyId"]) == 16 and "PRIVATE KEY" not in json.dumps(value), value
                for target in urls:
                    assert post(target, {"contract": "ControlPlaneSubmissionSchema", "input": value})["valid"]
                    parsed = post(target, {"document": read["schemas"]["query"], "input": {}})
                    assert parsed["valid"] and parsed["output"] == {"limit": 10}, parsed
            check(label, "full-manifest-payload", payload)
            for endpoint in ("http://remote.test", "http://127.1", "http://2130706433", "http://0x7f000001", "http://127.0.0.2", "http://localhost.",
                "http://[0:0:0:0:0:0:0:1]", "https://user:secret@remote.test", "https://remote.test?x=1", "https://remote.test#fragment", "https://remote.test\\evil"):
                def invalid_url():
                    body = fixture(); body.update(action="sync", baseUrl=endpoint)
                    assert post(url, body) == {"valid": False}, endpoint
                check(label, "endpoint-" + endpoint, invalid_url)
    if "node" in labels:
        node = urls[labels.index("node")]
        for url, label in zip(urls, labels):
            if label == "node": continue
            def real_node(mode):
                body = fixture()
                config = {key: deepcopy(initial[key]) for key in ("tenants", "apps")}
                # A second tenant/app must never reach this tenant service's snapshot.
                other = deepcopy(config["tenants"][0]); other.update(id="01910000-0000-7000-8000-000000000099", slug="other", title="Other tenant", services=[])
                config["tenants"].append(other)
                config["tenants"][0]["services"] = config["tenants"][0]["services"][:1]
                peer = post(node, {"action": "sync-peer", "command": "start", "config": config})
                assert "id" in peer, peer
                def command(name, **values): return post(node, {"action": "sync-peer", "id": peer["id"], "command": name, **values})
                try:
                    body.update(action="sync", baseUrl=peer["url"], generateKey=True, retryDelay=0.1, requestTimeout=2, until={"updates": 2})
                    if mode == "invalid-key": body.update(apiKey="wrong-key", until={})
                    if mode in ("change", "revoke"):
                        body["until"] = {"updates": 2} if mode == "change" else {"attempts": 2, "phase": "retrying"}
                        if mode == "change": body["untilTitle"] = "Node update"
                        with ThreadPoolExecutor(max_workers=1) as workers:
                            running = workers.submit(post, url, body)
                            deadline = time.monotonic() + 4
                            while True:
                                state = command("state")
                                registration = state["config"]["tenants"][0]["services"][0]
                                if any(call["method"] == "GET" for call in state["calls"]) and registration.get("lastSyncAt"): break
                                assert time.monotonic() < deadline and not running.done(), state
                                time.sleep(0.01)
                            if mode == "change": command("update", title="Node update", operations=["check.post"])
                            else: command("update", revoke=True)
                            actual = running.result(timeout=6)
                    else: actual = post(url, body)
                    assert actual["valid"] and not actual["readyAfterClose"], actual
                    state = command("state")
                    if mode == "invalid-key":
                        assert not actual["started"] and actual["health"]["status"] == 503 and not state["config"]["manifestCache"], actual
                        return
                    snapshot = actual["final"]["snapshot"]
                    assert len(snapshot["tenants"]) == 1 and snapshot["tenants"][0]["id"] == initial["tenants"][0]["id"], snapshot
                    assert "apiKeyHash" not in json.dumps(snapshot) and "Other tenant" not in json.dumps(snapshot), snapshot
                    manifest = state["config"]["manifestCache"][0]
                    assert manifest["serviceId"] == snapshot["serviceIdentity"]["id"], manifest
                    assert manifest["viewIndex"]["check"]["operations"][0]["operationId"] == "check.get", manifest
                    assert state["config"]["tenants"][0]["services"][0]["keyId"] == actual["submission"]["keyId"], state
                    assert [call["method"] for call in state["calls"]][:2] == ["POST", "GET"], state
                    assert actual["operation"]["status"] == {"bootstrap": 200, "change": 404, "revoke": 503}[mode], actual
                    assert actual["final"]["ready"] == (mode != "revoke"), actual
                    if mode == "change": assert snapshot["tenants"][0]["title"] == "Node update", actual
                    for target in urls: assert post(target, {"contract": "ScopedServiceConfigSchema", "input": json.loads(actual["stored"])})["valid"]
                finally: command("stop")
            for mode in ("bootstrap", "invalid-key", "change", "revoke"):
                check(label, "node-config-manager-" + mode, lambda mode=mode: real_node(mode))
    return results
