"""Finite operations through actual registered hosts, using the same author inputs."""
from copy import deepcopy
from io import BytesIO
import json
from hosting_cases import fixture as host_fixture
from rendering_cases import Html
from key_cases import peer
from security_cases import post, SOURCE, TARGET, TENANT, APP, ISSUER, AUDIENCE, fixtures, verification
from sse_cases import read_events


def fixture(mode="json"):
    body = host_fixture()
    spec = body["routes"][0]["operations"][0]
    spec["finite"] = {"itemSchema": spec["response"], "items": [1, {"nested": [None, True]}, "line\n雪"]}
    if mode == "sse": body["request"]["path"] = "/check/item/__sse?hello=world"
    body["request"]["headers"]["accept"] = {"json": "application/json", "ndjson": "application/x-ndjson", "sse": "text/event-stream", "html": "text/html"}[mode]
    return body


def themed(body):
    body["snapshot"]["apps"][0]["shell"] = {"serviceId": SOURCE, "service": "bootstrap1", "renderer": "bootstrap5"}
    body["routes"][0]["operations"][0]["streamRenderers"] = [{"renderer": "bootstrap5", "shell": {"dataOnly": True}, "item": {"dataOnly": True}, "summary": {"dataOnly": True}}]


def html_data(text): return json.loads("".join(Html(text).text))


def frames(actual, mode):
    if mode == "ndjson": return [json.loads(line) for line in actual["body"].splitlines()]
    events = list(read_events(BytesIO(actual["body"].encode())))
    values = [json.loads(event["data"]) for event in events]
    assert [event["event"] for event in events] == [value["kind"] for value in values], actual
    return values


def run_finite(urls, labels):
    results = []
    def check(url, label, name, body, assertion, *, native=False):
        if native and label == "node": return
        result = {"runtime": label, "id": "finite-" + name, "passed": False}
        try:
            actual = post(url, body)
            assertion(actual)
            result["passed"] = True
        except Exception as error: result["error"] = str(error)
        results.append(result)
    def response(actual, status=200, invoked=None):
        assert actual.get("status") == status, actual
        if invoked is not None: assert actual["invoked"] == invoked, actual
    def value(actual, expected):
        response(actual, invoked=1); assert json.loads(actual["body"]) == expected, actual
    def stream_value(actual, mode, expected):
        response(actual, invoked=1)
        if label != "node": assert "accept" in {part.strip().lower() for part in actual["headers"].get("vary", "").split(",")}, actual
        assert actual["headers"]["content-type"].startswith("application/x-ndjson" if mode == "ndjson" else "text/event-stream"), actual
        assert frames(actual, mode) == expected, actual
    for url, label in zip(urls, labels):
        for encoded, decoded in (("a%2Fb", "a/b"), ("a%252Fb", "a%2Fb")):
            body = fixture("html"); themed(body)
            body["request"]["path"] = "/check/" + encoded + "?hello=world"
            def encoded_shell(actual):
                response(actual, invoked=0)
                data = html_data(actual["body"])
                assert data == {"sseConnectPath": "/check/" + encoded + "/__sse?hello=world", "params": {"key": decoded}, "query": {"hello": "world"}}, actual
            check(url, label, "encoded-shell-" + encoded, body, encoded_shell)
            body = fixture("sse"); body["request"]["path"] = "/check/" + encoded + "/__sse?hello=world"
            body["routes"][0]["operations"][0]["finite"].update(items=[], contextItem=True)
            def encoded_event(actual):
                response(actual, invoked=1)
                assert frames(actual, "sse")[0]["data"]["params"] == {"key": decoded}, actual
            check(url, label, "encoded-stream-" + encoded, body, encoded_event)
        for mode in ("json", "ndjson", "sse"):
            for name, changes in (("order", {}), ("empty", {"items": []}), ("summary", {"summary": {"total": 3}}), ("null-summary", {"summary": None}), ("omitted-summary", {})):
                body = fixture(mode); finite = body["routes"][0]["operations"][0]["finite"]
                finite.update(changes)
                if "summary" in name: finite["summarySchema"] = finite["itemSchema"]
                expected = {"items": finite["items"], **({"summary": finite["summary"]} if "summary" in finite else {})}
                expected_frames = [{"kind": "item", "data": item} for item in finite["items"]]
                if "summary" in finite: expected_frames.append({"kind": "summary", "data": finite["summary"]})
                expected_frames.append({"kind": "end", "count": len(finite["items"])})
                check(url, label, name + "-" + mode, body, lambda actual: value(actual, expected) if mode == "json" else stream_value(actual, mode, expected_frames))
            for name, status, mutate in (
                ("denied-operation", 404, lambda b, s: b["snapshot"]["apps"][0]["routes"][0].update(operations=["check.post"])),
                ("disabled-mount", 404, lambda b, s: b["snapshot"]["apps"][0]["routes"][0].update(enabled=False)),
                ("required-auth", 401, lambda b, s: s["declaration"].update(auth={"required": True})),
                ("invalid-query", 400, lambda b, s: s.update(schemas={"query": {**s["response"], "root": {"kind": "object", "properties": {"required": {"kind": "string"}}, "required": ["required"], "unknownKeys": "strip"}}})),
                ("invalid-header", 400, lambda b, s: s.update(schemas={"headers": {**s["response"], "root": {"kind": "object", "properties": {"x-required": {"kind": "string"}}, "required": ["x-required"], "unknownKeys": "strip"}}})),
                ("wrong-origin", 403, lambda b, s: b["request"]["headers"].update(origin="https://wrong.test", host="app.test"))):
                body = fixture(mode); mutate(body, body["routes"][0]["operations"][0])
                check(url, label, name + "-" + mode, body, lambda actual: response(actual, status, 0), native=name in ("required-auth", "wrong-origin", "invalid-header"))
            for name in ("producer-error", "invalid-item", "invalid-summary", "after-summary", "item-limit", "frame-limit"):
                if name == "item-limit" and mode != "json": continue
                body = fixture(mode); finite = body["routes"][0]["operations"][0]["finite"]
                finite["items"] = ["first"]
                if name == "producer-error": finite["fail"] = True
                if name == "invalid-item": finite.update(itemSchema={**finite["itemSchema"], "root": {"kind": "string"}}, items=["first", 2, "never"])
                if name == "invalid-summary": finite.update(summarySchema={**finite["itemSchema"], "root": {"kind": "string"}}, summary=2)
                if name == "after-summary": finite.update(summarySchema=finite["itemSchema"], summary=None, afterSummary=[2])
                if name == "item-limit": finite.update(maxItems=0)
                if name == "frame-limit": finite.update(maxFrameBytes=1024, items=["x" * 1100])
                def failed(actual):
                    response(actual, 500 if mode == "json" else 200, 1)
                    if label != "node": assert "private" not in actual["body"], actual
                    if mode != "json":
                        values = frames(actual, mode)
                        assert values[-1]["kind"] == "error" and not any(frame["kind"] in ("error", "end") for frame in values[:-1]), actual
                        assert values[-1]["error"] == ("item_validation_failed" if name in ("invalid-item", "invalid-summary") else "stream_failed"), actual
                        assert values[0] == {"kind": "item", "data": "first"} if name != "frame-limit" else len(values) == 1, actual
                check(url, label, name + "-" + mode, body, failed, native=name in ("after-summary", "item-limit", "frame-limit"))
            if mode != "json":
                body = fixture(mode); body["request"]["method"] = "HEAD"
                def head(actual):
                    response(actual, invoked=0); assert actual["body"] == "", actual
                check(url, label, "head-" + mode, body, head, native=True)
                for selector in ("_f=nav.profile", "_c=card"):
                    body = fixture(mode); body["request"]["path"] += "&" + selector
                    check(url, label, "selector-rejected-" + selector + "-" + mode, body, lambda actual: response(actual, 400, 0), native=True)
            for probe in ("backpressure", "cancel"):
                if mode == "json" and probe == "backpressure": continue
                body = fixture(mode); body["rawProbe"] = True
                if probe == "cancel": body["cancel"] = True; body["routes"][0]["operations"][0]["finite"]["wait"] = True
                else: body["rawOutputProbe"] = "backpressure"
                def lifecycle(actual):
                    assert actual["stream"]["closed"] and actual["invoked"] == 1, actual
                    if probe == "cancel": assert actual["cancelled"] and actual["stream"]["reads"] == 2, actual
                    else: assert actual["observed"] == 1 and actual["stream"]["reads"] == 3, actual
                check(url, label, probe + "-" + mode, body, lifecycle, native=True)
        body = fixture()
        spec = body["routes"][0]["operations"][0]
        spec["schemas"] = {"query": {**spec["response"], "root": {"kind": "object", "properties": {"required": {"kind": "string"}}, "required": ["required"], "unknownKeys": "strip"}}}
        body["request"].update(method="POST", body='{"ok":true}')
        body["request"]["headers"]["content-type"] = "application/json"
        body["snapshot"]["apps"][0]["routes"][0]["operations"] = ["check.post"]
        body["routes"][0]["operations"][1]["schemas"] = {"query": {**spec["response"], "root": {"kind": "object", "properties": {}, "required": [], "unknownKeys": "strip"}}}
        def other_method(actual):
            response(actual, invoked=1)
            assert json.loads(actual["body"])["request"] == {"ok": True}, actual
        check(url, label, "method-specific-handler", body, other_method)
        body["routes"][0]["operations"][1].pop("schemas")
        check(url, label, "method-absent-schema-not-inherited", body, other_method, native=True)
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            body = fixture(); body["action"] = "registry"
            body["routes"][0]["operations"] = [body["routes"][0]["operations"][0]]
            body["routes"][0]["operations"][0]["declaration"].update(method=method)
            check(url, label, "reject-non-get-" + method, body, lambda actual: response(actual, 400), native=True)
        for path in ("/check/item/__sse?hello=world", "/check/__sse?hello=world"):
            body = fixture("sse"); body["routes"][0]["pathVariants"] = ["/check"]
            body["request"]["path"] = path
            if path.startswith("/check/__sse"): body["snapshot"]["apps"][0]["routes"][0]["resolvedServicePath"] = "/check"
            check(url, label, "optional-route-" + path, body, lambda actual: response(actual, invoked=1))
        for mode in ("html", "sse"):
            body = fixture(mode); themed(body)
            spec = body["routes"][0]["operations"][0]; spec["finite"].update(summarySchema=spec["response"], summary={"total": 3})
            def rendered(actual):
                response(actual, invoked=0 if mode == "html" else 1)
                if mode == "html":
                    assert "mode=fragment" in actual["headers"]["content-type"], actual
                    assert html_data(actual["body"]) == {"sseConnectPath": "/check/item/__sse?hello=world", "params": {"key": "item"}, "query": {"hello": "world"}}, actual
                else:
                    events = list(read_events(BytesIO(actual["body"].encode())))
                    assert [event["event"] for event in events] == ["item"] * 3 + ["summary", "end"], actual
                    assert [html_data(event["data"]) for event in events[:-1]] == [*spec["finite"]["items"], {"total": 3}], actual
                    assert events[-1]["data"] == "", actual
            check(url, label, "themed-" + mode, body, rendered)
        for path in ("/.well-known/bp/manifest", "/.well-known/bp/schema.json", "/check/item?hello=world"):
            body = fixture(); themed(body); body["request"].update(path=path)
            if path.startswith("/check/"): body["request"]["headers"]["accept"] = "application/vnd.betterportal.metadata+json"
            def metadata(actual):
                response(actual, invoked=0 if label != "node" or path.startswith("/.well-known") else None)
                data = json.loads(actual["body"])
                if path.endswith("schema.json"):
                    assert data["routes"][0]["renderers"] == ["bootstrap5"], actual
                    data = data["manifest"]
                if not path.startswith("/check/"):
                    assert {"stream.ndjson", "view.sse-render", "renderer.bootstrap5", "view.html"} <= set(data["capabilities"]), actual
                    assert data["supportedRenderModes"] == ["fragment"], actual
                    data = data["views"][0]["operations"][0]
                else:
                    assert data["operationId"] == "check.get" and data["method"] == "GET", actual
                    return
                assert "itemSchema" in data["streaming"] and "summarySchema" not in data["streaming"], actual
                assert data["renderable"] and data["html"]["renderers"]["bootstrap5"] == {"defaultRenderer": "default", "renderModes": ["fragment"], "slots": [], "renderers": []}, actual
            check(url, label, "metadata-" + path, body, metadata)
        for name in ("buffered-page", "buffered-fragment", "buffered-component", "fragment-shell", "exact-theme", "sse-json-fallback", "ndjson-ignores-theme", "shell-query", "shell-percent", "shell-input", "shell-error", "item-render-error", "summary-omitted", "error-renderer", "error-renderer-fails", "render-bound", "shell-rewrite", "item-rewrite", "safe-context"):
            mode = "sse" if name in ("sse-json-fallback", "item-render-error", "summary-omitted", "error-renderer", "error-renderer-fails", "render-bound", "item-rewrite") else "ndjson" if name == "ndjson-ignores-theme" else "html"
            body = fixture(mode); themed(body); spec = body["routes"][0]["operations"][0]
            renderer = spec["streamRenderers"][0]
            if name.startswith("buffered-") or name == "fragment-shell":
                kind = name.removeprefix("buffered-") if name.startswith("buffered-") else "page"
                spec["renderers"] = [{"declaration": {"renderer": "bootstrap5", "kind": kind, **({"key": "nav.profile" if kind == "fragment" else "card"} if kind != "page" else {})}, "dataOnly": True}]
                if kind != "page": body["request"]["path"] += "&" + ("_f=nav.profile" if kind == "fragment" else "_c=card")
                if name == "buffered-page": body["request"]["headers"]["accept"] = "text/html;mode=page"
                if name == "fragment-shell": body["request"]["headers"]["accept"] = "text/html;mode=fragment"
            if name in ("exact-theme", "sse-json-fallback"): body["snapshot"]["apps"][0]["shell"]["renderer"] = "other"
            if name == "shell-query": body["request"]["path"] = "/check/caf%C3%A9?a=%26&a=two+words&snow=%E9%9B%AA"
            if name == "shell-percent": body["request"]["path"] = "/check/a%25b?hello=%25"
            if name == "shell-input":
                integer = {"kind": "int", "coerce": {"toInt": True}}
                spec["schemas"] = {"query": {**spec["response"], "root": {"kind": "object", "properties": {"limit": {**integer, "default": 10}}, "required": ["limit"], "unknownKeys": "strip"}}}
            if name == "shell-error": renderer["shell"]["throw"] = True
            if name == "item-render-error": renderer["item"]["throw"] = True
            if name == "render-bound": renderer["item"]["text"] = "x" * 1100; spec["finite"]["maxFrameBytes"] = 1024
            if name == "summary-omitted":
                renderer.pop("summary"); spec["finite"].update(summarySchema=spec["response"], summary=None)
            if name.startswith("error-renderer"):
                spec["finite"]["fail"] = True
                renderer["error"] = {"text": "<p>Unavailable</p>", "throw": name.endswith("fails")}
            if name in ("shell-rewrite", "item-rewrite"):
                renderer["shell" if mode == "html" else "item"]["text"] = '<a href="{about.index}">Reload</a>'
                about = deepcopy(body["routes"][0]); about.update(viewId="about.index", path="/about")
                about["operations"] = [about["operations"][0]]; about["operations"][0]["declaration"]["operationId"] = "about.get"
                body["routes"].append(about)
            if name == "safe-context": renderer["shell"]["dataOnly"] = False
            def selection(actual):
                response(actual, 406 if name == "exact-theme" else 500 if name == "shell-error" else 200,
                    1 if mode != "html" or name.startswith("buffered-") or label == "node" and name == "exact-theme" else 0)
                if name in ("exact-theme", "shell-error"):
                    assert "private" not in actual["body"], actual; return
                if name.startswith("buffered-"): assert html_data(actual["body"]) == {"items": spec["finite"]["items"]}, actual
                elif name == "fragment-shell": assert "sseConnectPath" in html_data(actual["body"]), actual
                elif name == "shell-query":
                    assert html_data(actual["body"]) == {"sseConnectPath": "/check/caf%C3%A9/__sse?a=%26&a=two+words&snow=%E9%9B%AA",
                        "params": {"key": "café"},
                        "query": {"a": "two words" if label == "node" else ["&", "two words"], "snow": "雪"}}, actual
                elif name == "shell-input": assert html_data(actual["body"])["query"] == {"limit": 10}, actual
                elif name == "shell-percent": assert html_data(actual["body"])["sseConnectPath"] == "/check/a%25b/__sse?hello=%25", actual
                elif name in ("sse-json-fallback", "ndjson-ignores-theme"): assert frames(actual, mode)[-1] == {"kind": "end", "count": 3}, actual
                elif name == "safe-context":
                    context = html_data(actual["body"])["context"]
                    assert set(context) == {"tenant", "app", "request", "route"} and "services" not in context["tenant"], actual
                    assert context["route"]["mode"] == "fragment" and context["request"]["params"] == {"key": "item"}, actual
                elif name == "shell-rewrite": assert actual["body"] == '<a href="/about">Reload</a>', actual
                else:
                    events = list(read_events(BytesIO(actual["body"].encode())))
                    if name == "summary-omitted": assert [event["event"] for event in events] == ["item"] * 3 + ["end"], actual
                    elif name == "item-rewrite": assert events[0]["data"] == '<a href="/about">Reload</a>', actual
                    else:
                        assert events[-1]["event"] == "error" and all(event["event"] == "item" for event in events[:-1]), actual
                        if name == "error-renderer": assert events[-1]["data"] == "<p>Unavailable</p>", actual
                        else: assert json.loads(events[-1]["data"])["error"] == "render_failed" and "private" not in actual["body"], actual
            check(url, label, name, body, selection, native=name in ("item-render-error", "error-renderer-fails", "render-bound", "safe-context"))
        for mode in ("sse", "ndjson"):
            body = fixture(mode)
            app = body["snapshot"]["apps"][0]; app["routes"] = []
            app["fragments"] = {"nav": [{"serviceId": TARGET, "fragmentId": "profile", "targetPath": "/check/:key"}]}
            check(url, label, "fragment-only-denied-" + mode, body, lambda actual: response(actual, 404, 0))
            body["request"]["path"] += "&_f=nav.profile"
            check(url, label, "fragment-only-selector-denied-" + mode, body, lambda actual: response(actual, 400, 0), native=True)
        for requested in ("GET", "POST"):
            body = fixture("sse"); body["request"]["method"] = "OPTIONS"
            body["request"]["headers"]["access-control-request-method"] = requested
            def cors(actual):
                response(actual, 204 if requested == "GET" else 403, 0)
                if requested == "GET": assert actual["headers"]["access-control-allow-origin"] == "https://app.test", actual
            check(url, label, "sse-preflight-" + requested, body, cors, native=True)
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    claims = fixtures()
    with peer() as (base, routes, counts, barriers):
        routes["/finite-keys"] = [{"body": {"keys": [key["jwk"] for key in keys]}}]
        for signer, signer_label, key in zip(urls, labels, keys):
            user = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": claims["access"]})["token"]
            wrong = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": {**claims["access"], "tenantId": SOURCE}})["token"]
            machine = post(signer, {"action": "jwt-sign", "purpose": "service", "claims": claims["service"]})["token"]
            for mode in ("ndjson", "sse"):
                for name in ("user", "wrong-tenant", "revoked-role", "delegated", "delegated-revoked", "machine-grant-revoked"):
                    body = fixture(mode); spec = body["routes"][0]["operations"][0]; app = body["snapshot"]["apps"][0]
                    spec["finite"].update(items=[], contextItem=True)
                    spec["declaration"]["auth"] = {"required": True, "callers": ["user", "service", "delegated"],
                        "permissions": [{"serviceId": "com.example.service", "viewId": "check", "permissions": ["read"]}]}
                    app["auth"] = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": base + "/finite-keys",
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
                    status = 200 if name in ("user", "delegated") else 401 if name == "wrong-tenant" else 403
                    def authorized(actual):
                        response(actual, status, 1 if status == 200 else 0)
                        if status == 200:
                            caller = frames(actual, mode)[0]["data"]
                            assert caller["caller"] == name and caller["user"] == "user-1" and caller["tenantId"] == TENANT and caller["appId"] == APP, actual
                    for url, label in zip(urls, labels):
                        check(url, label, signer_label + "-auth-" + name + "-" + mode, body, authorized, native=name.startswith("delegated") or name == "machine-grant-revoked")
    return results
