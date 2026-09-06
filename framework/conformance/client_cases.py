"""Native outbound clients, shared HTTP faults, and calls into the other BP hosts."""
from contextlib import contextmanager
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import gzip
import threading
from urllib.parse import urlsplit
from hosting_cases import fixture as host_fixture
from security_cases import post, fixtures, verification, TENANT, APP, SOURCE, TARGET, BINDING, ISSUER, AUDIENCE


@contextmanager
def client_peer():
    state = {"requests": [], "reply": {}}
    started, release = threading.Event(), threading.Event()
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.startswith("/control/"):
                ready = started.wait(3) if self.path == "/control/started" else True
                if self.path == "/control/release": release.set()
                self.send_response(200 if ready else 504); self.end_headers(); return
            if self.path == "/jwks":
                self.send_response(200); self.send_header("content-type", "application/jwk-set+json"); self.end_headers()
                self.wfile.write(json.dumps(state["jwks"]).encode()); return
            record = {"method": self.command, "path": self.path, "headers": {name.lower(): value for name, value in self.headers.items()},
                      "body": self.rfile.read(int(self.headers.get("content-length", "0"))).decode()}
            state["requests"].append(record); reply = state["reply"]
            try:
                if reply.get("barrier"):
                    started.set()
                    if not release.wait(5): raise TimeoutError("Client barrier not released")
                if "upstream" in reply:
                    upstream = deepcopy(reply["host"]); upstream["request"] = record
                    result = post(reply["upstream"], upstream)
                    status, data, media = result["status"], result["body"].encode(), "application/json"
                else:
                    status, data, media = reply.get("status", 200), reply.get("raw", json.dumps(reply.get("body", record)).encode()), reply.get("type", "application/json")
                self.send_response(status); self.send_header("content-type", media)
                for name, value in reply.get("headers", {}).items(): self.send_header(name, value)
                self.end_headers(); self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
        do_POST = do_GET
        do_PUT = do_GET
        do_PATCH = do_GET
        do_DELETE = do_GET
        def log_message(self, *args): pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    try: yield f"http://127.0.0.1:{server.server_port}", state, started, release
    finally: release.set(); server.shutdown(); server.server_close(); thread.join(2)


def target_fixture():
    host = host_fixture(); host["routes"][0]["operations"] = host["routes"][0]["operations"][:1]
    operation = host["routes"][0]["operations"][0]["declaration"]
    operation["auth"] = {"required": True, "callers": ["user", "service", "delegated"],
        "permissions": [{"serviceId": "com.example.service", "viewId": "check", "permissions": ["read"]}]}
    operation["apiContracts"] = [{"id": "read-item", "version": "1.0.0", "title": "Read", "modes": ["service", "delegated"], "permissions": ["read"]}]
    return host


def run_clients(urls, labels):
    results = []
    def check(label, name, action):
        result = {"runtime": label, "id": "clients-" + name, "passed": False}
        try: action(); result["passed"] = True
        except Exception as error: result["error"] = str(error)
        results.append(result)
    keys = {label: post(url, {"action": "jwt-key"}) for url, label in zip(urls, labels)}
    contracts = {label: post(url, {**target_fixture(), "action": "registry"}) for url, label in zip(urls, labels)}
    for label, result in contracts.items():
        if result.get("status") != 200: raise AssertionError((label, result))
    token = post(urls[0], {"action": "jwt-sign", "purpose": "access", "claims": fixtures()["access"]})["token"]
    with client_peer() as (base, peer, started, release):
        peer["jwks"] = {"keys": [keys[labels[0]]["jwk"]]}
        for url, label in zip(urls, labels):
            if label == "node": continue  # Node's outbound policy still lives in its BSB plugin.
            key = keys[label]
            body = host_fixture(); body.update(action="clients", tenantId=TENANT, appId=APP, serviceId=TARGET, contract=contracts["node"]["schema"])
            body["declaration"]["pluginId"] = "com.example.caller"
            body["declaration"]["m2mRequests"] = [{"id": "read-item", "title": "Read", "contractId": "read-item", "methods": ["GET"], "permissions": ["read"]}]
            snapshot = body["snapshot"]
            snapshot["serviceIdentity"] = {"id": SOURCE, "keyId": key["kid"], "publicKeyPem": key["publicKeyPem"]}
            snapshot["tenants"][0]["services"][0]["hostname"] = base
            snapshot["tenants"][0]["services"][1]["serviceId"] = "com.example.caller"
            app = snapshot["apps"][0]
            app["routes"].append({**deepcopy(app["routes"][0]), "id": SOURCE, "serviceId": SOURCE})
            app["auth"] = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": base + "/jwks",
                "roles": [{"id": "reader", "title": "Reader", "permissions": [{"serviceId": TARGET, "viewId": "check", "permissions": ["read"]}]}]}
            policy = verification("service", fixtures()["service"], "", key)["service"]["policy"]
            policy["localServiceIds"] = [SOURCE]
            policy["services"] = [{"id": SOURCE, "hostname": "https://source.test", "serviceId": "com.example.caller", "keyId": key["kid"], "publicKeyPem": key["publicKeyPem"]},
                                  {"id": TARGET, "hostname": base, "serviceId": "com.example.service"}]
            policy["bindings"][0]["targetViewId"] = "check"
            snapshot["m2m"] = policy
            body["headers"] = {"origin": "https://app.test", "authorization": "Bearer " + token, "cookie": "private-cookie=forbidden"}
            def run(change=lambda item: None, *, expected=200, reply=None, count=None, validate=None):
                item = deepcopy(body); change(item)
                peer["requests"].clear(); peer["reply"] = reply or {}; started.clear(); release.clear()
                actual = post(url, item)
                values = actual.get("results", [actual])
                statuses = expected if isinstance(expected, list) else [expected]
                assert [value["status"] for value in values] == statuses, actual
                if count is not None: assert len(peer["requests"]) == count, peer["requests"]
                if validate: validate(values)
                return values
            def case(name, change=lambda item: None, **kwargs): check(label, name, lambda: run(change, **kwargs))
            def operation(item): return next(view for view in item["contract"]["manifest"]["views"] if view["viewId"] == "check")["operations"][0]
            def view(item): return next(view for view in item["contract"]["manifest"]["views"] if view["viewId"] == "check")
            def service(item): item.update(requestId="read-item", background=True)
            def delegated(item):
                item["declaration"]["m2mRequests"][0]["mode"] = "delegated"
                item["snapshot"]["m2m"]["bindings"][0]["mode"] = "delegated"
                item["requestId"] = "read-item"
            def user_result(values):
                headers = values[0]["output"]["headers"]
                assert headers["authorization"] == "Bearer " + token and headers["origin"] == "https://app.test", headers
                assert "cookie" not in headers and "x-bp-service-authorization" not in headers, headers
            case("user-credentials", validate=user_result, count=1)
            case("anonymous-public", lambda item: (item["headers"].pop("authorization"), operation(item)["auth"].update(required=False)), count=1)
            case("anonymous-required", lambda item: item["headers"].pop("authorization"), expected=401, count=0)
            case("invalid-optional-user-not-forwarded", lambda item: (item["headers"].update(authorization="Bearer invalid"), operation(item)["auth"].update(required=False)),
                 validate=lambda values: (assert_no_auth(values)), count=1)
            def machine_result(values, mode="service"):
                headers = values[0]["output"]["headers"]
                assert headers["x-bp-service-id"] == SOURCE and headers["x-bp-tenant-id"] == TENANT and headers["x-bp-app-id"] == APP, headers
                machine = headers["authorization" if mode == "service" else "x-bp-service-authorization"].removeprefix("Bearer ")
                if mode == "delegated": assert headers["authorization"] == "Bearer " + token, headers
                for verifier, other in zip(urls, labels):
                    request = verification("service", fixtures()["service"], machine, key)
                    request["service"].update(viewId="check", mode=mode); request["service"]["policy"] = deepcopy(policy)
                    request["service"]["policy"]["localServiceIds"] = [TARGET]
                    request["service"]["policy"]["bindings"][0]["mode"] = mode
                    actual = post(verifier, request); assert actual["valid"], (other, actual)
            case("service-cross-verification", service, validate=machine_result, count=1)
            case("delegated-cross-verification", delegated, validate=lambda values: machine_result(values, "delegated"), count=1)
            for author, contract in contracts.items(): case("contract-from-" + author, lambda item, contract=contract: item.update(contract=contract["schema"]), count=1)
            case("alias", lambda item: item.update(dependencies={"peer": "com.example.service"}, serviceId="peer"), count=1)
            case("unknown-service", lambda item: item.update(serviceId="com.example.absent"), expected=403, count=0)
            case("ambiguous-plugin", lambda item: (item.update(serviceId="com.example.service"), item["snapshot"]["tenants"][0]["services"][1].update(serviceId="com.example.service")), expected=403, count=0)
            case("disabled-target", lambda item: item["snapshot"]["tenants"][0]["services"][0].update(enabled=False), expected=403, count=0)
            case("operation-unmounted", lambda item: item["snapshot"]["apps"][0]["routes"][0].update(operations=["other.get"]), expected=403, count=0)
            case("full-app-routes", lambda item: (item["snapshot"]["apps"][0].update(appRoutes=deepcopy(item["snapshot"]["apps"][0]["routes"])), item["snapshot"]["apps"][0]["routes"].pop(0)), count=1)
            case("background-user-denied", lambda item: item.update(background=True), expected=400, count=0)
            case("unknown-operation", lambda item: item.update(steps=[{"operation": "missing"}]), expected=400, count=0)
            case("unknown-input", lambda item: item.update(steps=[{"values": {"params": {"key": "item"}, "token": "forbidden"}}]), expected=400, count=0)
            case("missing-params", lambda item: item.update(steps=[{"values": {}}]), expected=400, count=0)
            case("path-traversal", lambda item: item.update(steps=[{"values": {"params": {"key": ".."}}}]), expected=400, count=0)
            case("optional-path", lambda item: (view(item).update(pathVariants=["/check"]), item["snapshot"]["apps"][0]["routes"][0].update(resolvedServicePath="/check"), item.update(steps=[{"values": {}}])), count=1)
            for name in ("Authorization", "Cookie", "Origin", "Host", "X-BP-Service-Authorization", "Content-Length", "Accept", "Content-Type", "Content-Encoding", "Accept-Encoding", "Proxy-Authorization"):
                case("reserved-header-" + name.lower(), lambda item, name=name: item.update(steps=[{"values": {"params": {"key": "item"}, "headers": {name: "forbidden"}}}]), expected=400, count=0)
            case("query-and-header", lambda item: item.update(steps=[{"values": {"params": {"key": "space / value"}, "query": {"q": ["a b", "c"], "flag": True}, "headers": {"x-custom": "ok"}}}]),
                 count=1, validate=lambda values: expect(values[0]["output"]["path"], "/check/space%20%2F%20value?q=a+b&q=c&flag=true"))
            def write(item, values):
                op = operation(item); op.update(method="POST", operationId="check.post")
                item["snapshot"]["apps"][0]["routes"][0]["operations"] = ["check.post"]
                item["steps"] = [{"operation": "check.post", "values": {"params": {"key": "item"}, **values}}]
            case("json-post", lambda item: write(item, {"body": {"value": True}}), count=1,
                 validate=lambda values: expect(json.loads(values[0]["output"]["body"]), {"value": True}))
            case("omitted-body", lambda item: write(item, {}), count=1, validate=lambda values: expect(values[0]["output"]["body"], ""))
            def body_schema(item, root, values):
                write(item, values)
                operation(item)["bodySchema"] = {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": root}
            case("null-body", lambda item: body_schema(item, {"kind": "nullable", "inner": {"kind": "string"}}, {"body": None}), count=1,
                 validate=lambda values: expect(values[0]["output"]["body"], "null"))
            case("required-body", lambda item: body_schema(item, {"kind": "string"}, {}), expected=400, count=0)
            case("invalid-body", lambda item: body_schema(item, {"kind": "string"}, {"body": []}), expected=400, count=0)
            case("body-default", lambda item: body_schema(item, {"kind": "string", "default": "fallback"}, {}), count=1,
                 validate=lambda values: expect(values[0]["output"]["body"], '"fallback"'))
            case("body-coercion", lambda item: body_schema(item, {"kind": "int", "coerce": {"toInt": True}}, {"body": "12"}), count=1,
                 validate=lambda values: expect(json.loads(values[0]["output"]["body"]), 12))
            case("get-body-denied", lambda item: item.update(steps=[{"values": {"params": {"key": "item"}, "body": {}}}]), expected=400, count=0)
            case("request-size", lambda item: write(item, {"body": {"value": "x" * (16 * 1024 * 1024)}}), expected=400, count=0)
            case("duplicate-header", lambda item: item.update(steps=[{"values": {"params": {"key": "item"}, "headers": {"x-test": "a", "X-Test": "b"}}}]), expected=400, count=0)
            case("bad-header", lambda item: item.update(steps=[{"values": {"params": {"key": "item"}, "headers": {"x-test": "a\r\nb"}}}]), expected=400, count=0)
            for name, value in (("null", None), ("object", {}), ("array", [])):
                case("header-" + name, lambda item, value=value: item.update(steps=[{"values": {"params": {"key": "item"}, "headers": {"x-test": value}}}]), expected=400, count=0)
            def header_coercion(item):
                operation(item)["headersSchema"] = {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {"kind": "object", "properties": {
                    "x-count": {"kind": "int", "coerce": {"toInt": True}}}, "required": ["x-count"], "unknownKeys": "reject"}}
                item["steps"] = [{"values": {"params": {"key": "item"}, "headers": {"x-count": "12"}}}]
            case("header-coercion", header_coercion, count=1, validate=lambda values: expect(values[0]["output"]["headers"]["x-count"], "12"))
            for address in ("http://remote.test", "http://127.1", "http://127.0.0.1.evil.test", "https://user:password@remote.test", base + "/prefix"):
                case("unsafe-origin-" + address, lambda item, address=address: item["snapshot"]["tenants"][0]["services"][0].update(hostname=address), expected=400, count=0)
            case("redirect", reply={"status": 307, "headers": {"location": base + "/stolen"}}, expected=307, count=1)
            case("upstream-error-redacted", reply={"status": 500, "raw": b"private-error-secret"}, expected=500, count=1,
                 validate=lambda values: expect("private-error-secret" in str(values), False))
            case("wrong-media", reply={"type": "text/html", "raw": b"<h1>secret</h1>"}, expected=502, count=1)
            case("unsolicited-compression", reply={"headers": {"content-encoding": "gzip"}, "raw": gzip.compress(b'"' + b'x' * (16 * 1024 * 1024) + b'"')}, expected=502, count=1)
            for name, raw in [("malformed", b"{"), ("duplicate", b'{"x":1,"x":2}'), ("utf8", b'"\xff"'), ("oversized", b'"' + b'x' * (16 * 1024 * 1024) + b'"')]:
                case("response-" + name, reply={"raw": raw}, expected=502, count=1)
            case("response-schema", lambda item: operation(item)["jsonResponseSchema"].update(root={"kind": "bool"}), expected=502, count=1)
            case("no-content-null", lambda item: operation(item)["jsonResponseSchema"].update(root={"kind": "nullable", "inner": {"kind": "bool"}}), reply={"status": 204, "raw": b""}, count=1,
                 validate=lambda values: expect(values[0]["output"], None))
            case("no-content-required", lambda item: operation(item)["jsonResponseSchema"].update(root={"kind": "bool"}), reply={"status": 204, "raw": b""}, expected=502, count=1)
            case("no-json-output", lambda item: operation(item).update(jsonResponseSchema={}), expected=400, count=0)
            case("no-cookie-replay", lambda item: item.update(steps=[{}, {}]), reply={"headers": {"set-cookie": "secret=forbidden; Path=/"}}, expected=[200, 200], count=2,
                 validate=lambda values: expect(any("cookie" in item["output"]["headers"] for item in values), False))
            for field in ("bindings", "grants"):
                case("revoked-" + field, lambda item, field=field: (service(item), item["snapshot"]["m2m"][field][0].update(enabled=False)), expected=403, count=0)
            case("grant-permission", lambda item: (service(item), item["snapshot"]["m2m"]["grants"][0].update(permissions=[])), expected=403, count=0)
            case("request-capability", lambda item: (service(item), item["declaration"]["m2mRequests"][0].update(requiredCapabilities=["missing"])), expected=403, count=0)
            case("request-method", lambda item: (service(item), item["declaration"]["m2mRequests"][0].update(methods=["POST"])), expected=403, count=0)
            case("contract-mode", lambda item: (service(item), item["contract"]["manifest"]["apiContracts"][0].update(modes=["delegated"])), expected=403, count=0)
            case("contract-id", lambda item: (service(item), item["contract"]["manifest"]["apiContracts"][0].update(id="other")), expected=403, count=0)
            case("binding-source", lambda item: (service(item), item["snapshot"]["m2m"]["bindings"][0].update(sourceServiceId=TARGET)), expected=403, count=0)
            case("binding-target-plugin", lambda item: (service(item), item["snapshot"]["m2m"]["services"][1].update(serviceId="com.example.other")), expected=403, count=0)
            case("no-key", lambda item: (service(item), item.update(noKey=True)), expected=503, count=0)
            case("unregistered-key", lambda item: (service(item), item["snapshot"]["serviceIdentity"].update(keyId="different")), expected=503, count=0)
            case("wrong-tenant", lambda item: (service(item), item.update(tenantId=TARGET)), expected=403, count=0)
            case("wrong-app", lambda item: (service(item), item.update(appId=TARGET)), expected=403, count=0)
            case("delegated-no-user", lambda item: (delegated(item), item.update(background=True)), expected=401, count=0)
            case("not-ready", lambda item: (service(item), item.update(snapshot=None)), expected=503, count=0)
            case("closed", lambda item: item.update(steps=[{"close": True}]), expected=503, count=0)
            case("retired-request", lambda item: item.update(steps=[{"snapshot": deepcopy(item["snapshot"])}]), expected=503, count=0)
            def revoke(item):
                service(item); update = deepcopy(item["snapshot"]); update["m2m"]["grants"][0]["enabled"] = False
                item["steps"] = [{}, {"snapshot": update}]
            case("background-rechecks-grants", revoke, expected=[200, 403], count=1)
            for action, status in (("cancel", 499), ("close", 499), ("snapshot", 503)):
                case("during-" + action, lambda item, action=action: item.update(steps=[{"during": {"url": base, action: deepcopy(item["snapshot"]) if action == "snapshot" else True}}]),
                     reply={"barrier": True}, expected=status, count=1)
            case("generated-alias", lambda item: item.update(generated=True, dependencies={"peer": "com.example.service"}, serviceId="peer"), count=1)
            case("generated-operation-unmounted", lambda item: (item.update(generated=True), item["snapshot"]["apps"][0]["routes"][0].update(operations=["other.get"])), expected=403, count=0)
            case("generated-background-rechecks-grants", lambda item: (item.update(generated=True), revoke(item)), expected=[200, 403], count=1)
            for action, status in (("cancel", 499), ("close", 499), ("snapshot", 503)):
                case("generated-during-" + action, lambda item, action=action: item.update(generated=True, steps=[{"during": {"url": base, action: deepcopy(item["snapshot"]) if action == "snapshot" else True}}]),
                     reply={"barrier": True}, expected=status, count=1)
            for other_url, other in zip(urls, labels):
                if other == label: continue
                for mode in ("user", "service", "delegated"):
                    target = target_fixture(); target["snapshot"] = deepcopy(snapshot)
                    if other == "node" and mode != "user": target["machineHost"] = True
                    target["snapshot"]["serviceIdentity"] = {"id": TARGET}
                    target["snapshot"]["m2m"]["localServiceIds"] = [TARGET]
                    target["snapshot"]["m2m"]["bindings"][0]["mode"] = "delegated" if mode == "delegated" else "service"
                    change = service if mode == "service" else delegated if mode == "delegated" else lambda item: None
                    def validate(values, mode=mode):
                        output = values[0]["output"]
                        assert output["tenantId"] == TENANT and output["appId"] == APP and output["caller"] == mode, output
                        assert output["user"] == (None if mode == "service" else "user-1"), output
                    case("host-" + other + "-" + mode, change, reply={"upstream": other_url, "host": target}, validate=validate, count=1)
                    case("generated-host-" + other + "-" + mode, lambda item: (change(item), item.update(generated=True)), reply={"upstream": other_url, "host": target}, validate=validate, count=1)
    return results


def expect(actual, expected): assert actual == expected, (actual, expected)
def assert_no_auth(values): assert "authorization" not in values[0]["output"]["headers"], values
