"""Hosted subscriber feeds: operation policy, scoped transport and event rendering."""
from copy import deepcopy
from io import BytesIO
import json
from hosting_cases import fixture as host_fixture
from rendering_cases import Html
from key_cases import peer
from security_cases import post, SOURCE, TARGET, TENANT, APP, ISSUER, AUDIENCE, fixtures, verification
from sse_cases import read_events


def fixture():
    body = host_fixture(); body["rawProbe"] = True
    schema = body["routes"][0]["operations"][0]["response"]
    body["routes"][0]["feed"] = {"inputSchema": schema, "eventSchema": schema, "publications": [{"value": value} for value in (1, {"nested": [None, True]}, "line\n雪")]}
    body["request"].update(path="/check/item/__sse?hello=world")
    body["request"]["headers"]["accept"] = "text/event-stream"
    return body


def themed(body):
    body["snapshot"]["apps"][0]["shell"] = {"serviceId": SOURCE, "service": "bootstrap1", "renderer": "bootstrap5"}
    declaration = {"renderer": "bootstrap5", "kind": "fragment", "key": "nav.profile"}
    body["routes"][0]["operations"][0]["renderers"] = [{"declaration": declaration, "text": "<p>Initial</p>"}]
    body["routes"][0]["feed"]["renderers"] = [{"declaration": declaration, "dataOnly": True}]
    body["request"]["path"] += "&_f=nav.profile"


def events(actual): return list(read_events(BytesIO(actual["body"].encode())))


def run_feeds(urls, labels):
    results = []
    def check(url, label, name, body, assertion, native=False):
        if native and label == "node": return
        row = {"runtime": label, "id": "feed-" + name, "passed": False}
        try: assertion(post(url, body)); row["passed"] = True
        except Exception as error: row["error"] = str(error)
        results.append(row)
    def status(actual, code=200, mapped=0):
        assert actual.get("status") == code and actual["invoked"] == 0, actual
        assert actual["feed"]["active"] == 0 and actual["feed"]["mapped"] == mapped, actual
    for url, label in zip(urls, labels):
        for name in ("data", "empty", "strings", "scope-isolation", "nullable", "input-rejection", "context", "themed", "fragment-only", "safe-render-context", "render-recovery", "optional-path", "feed-overrides-finite"):
            body = fixture(); route = body["routes"][0]; feed = route["feed"]
            expected = [item["value"] for item in feed["publications"]]
            if name == "empty": feed["publications"] = []; expected = []
            if name == "strings": expected = ["", "first\nsecond\n", " x\n\nevent: spoof\nid: other"]
            if name == "nullable": expected = [None, False, [None]]
            if name in ("strings", "nullable"): feed["publications"] = [{"value": value} for value in expected]
            if name == "scope-isolation": feed["publications"] = [{"value": "wrong tenant", "tenantId": SOURCE}, {"value": "wrong app", "appId": SOURCE}, {"value": "wrong view", "viewId": "other"}, *feed["publications"]]
            if name == "input-rejection":
                feed["inputSchema"] = {**feed["inputSchema"], "root": {"kind": "string"}}
                feed["publications"] = [{"value": 42}, {"value": "accepted"}]; expected = ["accepted"]
            if name == "context":
                feed.update(contextEvent=True, publications=[{"value": "read"}])
                app = body["snapshot"]["apps"][0]
                expected = [{"params": {"key": "item"}, "query": {"hello": "world"}, "tenantId": app["tenantId"], "appId": app["id"], "caller": None, "user": None}]
            if name in ("themed", "fragment-only", "safe-render-context", "render-recovery"): themed(body)
            if name == "fragment-only":
                body["snapshot"]["apps"][0]["routes"] = []
                body["snapshot"]["apps"][0]["fragments"] = {"nav": [{"serviceId": TARGET, "fragmentId": "profile", "targetPath": "/check/:key"}]}
            if name == "safe-render-context": feed["renderers"][0]["dataOnly"] = False
            if name == "render-recovery": feed["renderers"][0]["throwOn"] = 1
            if name == "optional-path":
                route["pathVariants"] = ["/check"]; body["request"]["path"] = "/check/__sse"
                body["snapshot"]["apps"][0]["routes"][0]["resolvedServicePath"] = "/check"
            if name == "feed-overrides-finite": route["operations"][0]["finite"] = {"itemSchema": feed["inputSchema"], "items": ["must not run"]}
            def delivered(actual):
                status(actual, mapped=len(expected))
                assert actual["feed"]["closed"] and actual["headers"]["content-type"].startswith("text/event-stream"), actual
                assert actual["headers"]["access-control-allow-origin"] == "https://app.test", actual
                messages = events(actual)
                assert len(messages) == len(expected), actual
                for index, (message, value) in enumerate(zip(messages, expected)):
                    if name == "render-recovery" and index == 0:
                        assert message["event"] == "error" and json.loads(message["data"])["code"] == "render_failed", actual
                        continue
                    assert message["event"] == "message", actual
                    if name in ("themed", "fragment-only", "safe-render-context", "render-recovery"):
                        html = Html(message["data"]); assert html.tags == ["pre"], actual
                        parsed = json.loads("".join(html.text))
                        if name == "safe-render-context":
                            assert parsed["data"] == value and set(parsed["context"]) == {"tenant", "app", "request", "route"}, actual
                            context = parsed["context"]
                            assert context["request"]["path"] == "/check/item" and "services" not in context["tenant"], actual
                            assert context["route"]["kind"] == "fragment" and context["route"]["key"] == "nav.profile", actual
                        else: assert parsed == value, actual
                    else: assert message["data"] == value if isinstance(value, str) else json.loads(message["data"]) == value, actual
                if name == "input-rejection": assert actual["feed"]["inputErrors"] == 1, actual
            check(url, label, name, body, delivered, native=name == "render-recovery")
        for name, code in (("denied-operation", 404), ("disabled-mount", 404), ("no-full-mount", 404), ("auth-required", 401), ("query-required", 400),
                           ("missing-renderer", 406), ("wrong-theme", 406), ("fragment-tick-required", 406), ("fragment-theme-required", 406),
                           ("component-selector", 400), ("duplicate-selector", 400), ("wrong-origin", 403)):
            body = fixture(); route = body["routes"][0]; app = body["snapshot"]["apps"][0]
            if name == "denied-operation": app["routes"][0]["operations"] = ["check.post"]
            if name == "disabled-mount": app["routes"][0]["enabled"] = False
            if name == "no-full-mount": app["routes"] = []; app["fragments"] = {"nav": [{"serviceId": TARGET, "fragmentId": "profile", "targetPath": "/check/:key"}]}
            if name == "auth-required": route["operations"][0]["declaration"]["auth"] = {"required": True}
            if name == "query-required": route["operations"][0]["schemas"] = {"query": {**route["feed"]["inputSchema"], "root": {"kind": "object", "properties": {"required": {"kind": "string"}}, "required": ["required"], "unknownKeys": "strip"}}}
            if name == "missing-renderer": themed(body); route["feed"]["renderers"] = []
            if name == "wrong-theme": themed(body); app["shell"]["renderer"] = "other"
            if name in ("fragment-tick-required", "fragment-theme-required"):
                themed(body); app["routes"] = []; app["fragments"] = {"nav": [{"serviceId": TARGET, "fragmentId": "profile", "targetPath": "/check/:key"}]}
                if name == "fragment-tick-required": route["feed"]["renderers"] = []
                else: app["shell"]["renderer"] = "other"
            if name == "component-selector": body["request"]["path"] += "&_c=card"
            if name == "duplicate-selector": body["request"]["path"] += "&_f=a&_f=b"
            if name == "wrong-origin": body["request"]["headers"].update(origin="https://other.test", host="app.test")
            check(url, label, name, body, lambda actual: status(actual, code), native=name in ("auth-required", "missing-renderer", "wrong-theme", "fragment-tick-required", "fragment-theme-required", "component-selector", "duplicate-selector", "wrong-origin"))
        body = fixture(); body["request"]["method"] = "HEAD"
        def head(actual):
            status(actual); assert not actual["feed"]["closed"] and actual["body"] == "", actual
        check(url, label, "head-no-subscription", body, head, native=True)
        for stage in ("subscribe", "mapper", "renderer"):
            body = fixture(); body.update(cancel=True, feedCancelStage=stage)
            if stage == "mapper": body["routes"][0]["feed"]["wait"] = True
            if stage == "renderer": themed(body); body["routes"][0]["feed"]["renderers"][0]["wait"] = True
            def cancelled(actual):
                assert actual["invoked"] == 0 and actual["feed"]["active"] == 0 and actual["feed"]["closed"], actual
                if stage == "mapper": assert actual["feed"]["cancelled"], actual
            check(url, label, "cancel-" + stage, body, cancelled, native=True)
        body = fixture(); body["rawOutputProbe"] = "backpressure"
        def backpressure(actual):
            assert actual["observed"] == 1 and actual["feed"]["mapped"] == 3 and actual["feed"]["closed"] and actual["invoked"] == 0, actual
        check(url, label, "backpressure", body, backpressure, native=True)
        body = fixture(); body.update(rawOutputProbe="disconnect", cancel=True, feedCancelStage="mapper")
        body["routes"][0]["feed"].update(wait=True, waitAfter=1)
        def disconnected(actual):
            assert actual["invoked"] == 0 and actual["feed"]["mapped"] == 2 and actual["feed"]["closed"] and actual["feed"]["cancelled"] and actual["feed"]["active"] == 0, actual
        check(url, label, "disconnect-after-event", body, disconnected, native=True)
        for stage in ("subscribe", "mapper", "renderer"):
            body = fixture(); body.update(feedShutdown=True, feedCancelStage=stage)
            if stage == "mapper": body["routes"][0]["feed"]["wait"] = True
            if stage == "renderer": themed(body); body["routes"][0]["feed"]["renderers"][0]["wait"] = True
            def shutdown(actual):
                assert actual["shutdown"] and actual["transportOpen"] and actual["invoked"] == 0 and actual["feed"]["active"] == 0 and actual["feed"]["closed"], actual
            check(url, label, "service-shutdown-" + stage, body, shutdown, native=True)
        for stage in ("subscribe", "mapper", "renderer", "output"):
            for revoked in ("mount", "tenant", "unchanged"):
                body = fixture(); body["feedCancelStage"] = stage
                if stage == "output": body["rawOutputProbe"] = "backpressure"
                if stage == "mapper": body["routes"][0]["feed"]["wait"] = True
                if stage == "renderer": themed(body); body["routes"][0]["feed"]["renderers"][0]["wait"] = True
                body["feedSnapshot"] = deepcopy(body["snapshot"])
                if revoked == "mount": body["feedSnapshot"]["apps"][0]["routes"][0]["enabled"] = False
                if revoked == "tenant": body["feedSnapshot"]["tenants"][0]["active"] = False
                def retired(actual):
                    shutdown(actual)
                    assert actual["feed"]["mapped"] == (0 if stage == "subscribe" else 1), actual
                    if stage == "mapper": assert actual["feed"]["cancelled"], actual
                check(url, label, f"snapshot-retirement-{stage}-{revoked}", body, retired, native=True)
        for name in ("mapper-error", "invalid-event", "corrupt-json", "corrupt-contract", "event-bound", "render-bound", "overflow"):
            body = fixture(); feed = body["routes"][0]["feed"]
            feed["publications"] = [{"value": "event"}]
            if name == "mapper-error": feed["throw"] = True
            if name == "invalid-event": feed["eventSchema"] = {**feed["eventSchema"], "root": {"kind": "string"}}; feed["result"] = 42
            if name == "corrupt-json": feed["publications"] = [{"raw": "{private-transport-secret"}]
            if name == "corrupt-contract":
                feed["inputSchema"] = {**feed["inputSchema"], "root": {"kind": "string"}}
                feed["publications"] = [{"raw": "42"}]
            if name == "event-bound": feed.update(maxPayloadBytes=128, result="x" * 256)
            if name == "render-bound": themed(body); feed["maxPayloadBytes"] = 128; feed["renderers"][0]["text"] = "x" * 256
            if name == "overflow": body.update(feedCapacity=1, feedOverflow=True); feed["publications"] = [{"value": index} for index in range(5)]
            def failed(actual):
                assert actual["invoked"] == 0 and actual["feed"]["active"] == 0 and actual["feed"]["closed"], actual
                assert actual["feed"]["mapped"] == (0 if name.startswith("corrupt") else 1), actual
                assert "private" not in actual.get("body", ""), actual
                if name == "render-bound":
                    messages = events(actual)
                    assert len(messages) == 1 and messages[0]["event"] == "error" and json.loads(messages[0]["data"])["code"] == "render_failed", actual
                else: assert actual.get("transportError") or actual.get("status") == 500, actual
            check(url, label, name, body, failed, native=True)
        body = fixture(); body.update(feedShutdown=True, feedHostShutdown=True, feedCancelStage="subscribe")
        check(url, label, "host-shutdown", body, shutdown, native=True)
        for requested in ("GET", "POST"):
            body = fixture(); body["request"]["method"] = "OPTIONS"
            body["request"]["headers"]["access-control-request-method"] = requested
            check(url, label, "preflight-" + requested, body, lambda actual: status(actual, 204 if requested == "GET" else 403), native=True)
        body = fixture(); themed(body); body["snapshot"]["apps"][0]["routes"] = []
        body["snapshot"]["apps"][0]["fragments"] = {"nav": [{"serviceId": TARGET, "fragmentId": "profile", "targetPath": "/check/:key"}]}
        body["request"]["path"] = "/check/item/__sse"
        body["request"]["headers"]["accept"] = "text/html;fragment=nav.profile"
        check(url, label, "accept-cannot-grant-fragment", body, lambda actual: status(actual, 404), native=True)
        body = fixture(); themed(body); body["request"]["path"] = "/check/item?_f=nav.profile"
        body["request"]["headers"]["accept"] = "text/html"
        def initial(actual):
            assert actual["status"] == 200 and actual["invoked"] == 1 and actual["feed"]["mapped"] == 0 and actual["body"] == "<p>Initial</p>", actual
        check(url, label, "initial-fragment", body, initial)
        for name in ("query-default", "headers-required", "rewrite"):
            body = fixture(); route = body["routes"][0]; feed = route["feed"]
            if name == "query-default":
                route["operations"][0]["schemas"] = {"query": {**feed["inputSchema"], "root": {"kind": "object", "properties": {"limit": {"kind": "int", "coerce": {"toInt": True}, "default": 10}}, "required": ["limit"], "unknownKeys": "strip"}}}
                feed.update(contextEvent=True, publications=[{"value": None}])
            if name == "headers-required":
                route["operations"][0]["schemas"] = {"headers": {**feed["inputSchema"], "root": {"kind": "object", "properties": {"x-required": {"kind": "string"}}, "required": ["x-required"], "unknownKeys": "strip"}}}
            if name == "rewrite":
                themed(body); feed["renderers"][0]["text"] = '<a href="{about.index}">Reload</a>'
                about = deepcopy(route); about.pop("feed"); about.update(viewId="about.index", path="/about")
                about["operations"] = [about["operations"][0]]; about["operations"][0]["declaration"]["operationId"] = "about.get"
                body["routes"].append(about)
            def inputs(actual):
                status(actual, 400 if name == "headers-required" else 200, 0 if name == "headers-required" else 1 if name == "query-default" else 3)
                if name == "query-default": assert json.loads(events(actual)[0]["data"])["query"] == {"limit": 10}, actual
                if name == "rewrite": assert events(actual)[0]["data"] == '<a href="/about">Reload</a>', actual
            check(url, label, name, body, inputs, native=name in ("headers-required", "rewrite"))
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    claims = fixtures()
    with peer() as (base, routes, counts, barriers):
        routes["/feed-keys"] = [{"body": {"keys": [key["jwk"] for key in keys]}}]
        for signer, signer_label, key in zip(urls, labels, keys):
            user = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": claims["access"]})["token"]
            wrong = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": {**claims["access"], "tenantId": SOURCE}})["token"]
            machine = post(signer, {"action": "jwt-sign", "purpose": "service", "claims": claims["service"]})["token"]
            for name in ("user", "wrong-tenant", "revoked-role", "delegated", "delegated-revoked", "machine-grant-revoked"):
                body = fixture(); feed = body["routes"][0]["feed"]; app = body["snapshot"]["apps"][0]
                feed.update(contextEvent=True, publications=[{"value": None}])
                body["routes"][0]["operations"][0]["declaration"]["auth"] = {"required": True, "callers": ["user", "service", "delegated"],
                    "permissions": [{"serviceId": "com.example.service", "viewId": "check", "permissions": ["read"]}]}
                app["auth"] = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": base + "/feed-keys",
                    "roles": [{"id": "reader", "title": "Reader", "permissions": [{"serviceId": TARGET, "viewId": "check", "permissions": ["read"]}]}]}
                body["request"]["headers"]["authorization"] = "Bearer " + (wrong if name == "wrong-tenant" else user)
                if name.startswith("delegated") or name == "machine-grant-revoked":
                    policy = verification("service", claims["service"], machine, key)["service"]["policy"]
                    policy["services"][0].update(publicKeyPem=key["publicKeyPem"], keyId=key["kid"])
                    policy["bindings"][0].update(targetViewId="check", mode="delegated")
                    body["snapshot"]["m2m"] = policy
                    body["request"]["headers"].update({"x-bp-service-id": SOURCE, "x-bp-tenant-id": TENANT, "x-bp-app-id": APP, "x-bp-service-authorization": "Bearer " + machine})
                    if name == "machine-grant-revoked": policy["grants"][0]["enabled"] = False
                if name in ("revoked-role", "delegated-revoked"): app["auth"]["roles"] = []
                code = 200 if name in ("user", "delegated") else 401 if name == "wrong-tenant" else 403
                def authorized(actual):
                    status(actual, code, 1 if code == 200 else 0)
                    if code == 200:
                        caller = json.loads(events(actual)[0]["data"])
                        assert caller["caller"] == name and caller["user"] == "user-1" and caller["tenantId"] == TENANT and caller["appId"] == APP, actual
                for url, label in zip(urls, labels):
                    check(url, label, signer_label + "-auth-" + name, body, authorized, native=name.startswith("delegated") or name == "machine-grant-revoked")
                if name in ("user", "delegated"):
                    body["feedCancelStage"] = "mapper"; feed["wait"] = True
                    feed["publications"] *= 2
                    body["feedSnapshot"] = deepcopy(body["snapshot"])
                    if name == "user": body["feedSnapshot"]["apps"][0]["auth"]["roles"] = []
                    else: body["feedSnapshot"]["m2m"]["grants"][0]["enabled"] = False
                    def revoked_while_connected(actual):
                        assert actual["shutdown"] and actual["transportOpen"] and actual["feed"]["mapped"] == 1, actual
                        assert actual["feed"]["closed"] and actual["feed"]["active"] == 0 and actual["feed"]["cancelled"], actual
                    for url, label in zip(urls, labels):
                        check(url, label, signer_label + "-live-revocation-" + name, body, revoked_while_connected, native=True)
    return results
