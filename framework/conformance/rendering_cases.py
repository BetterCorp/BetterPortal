"""HTML through real H3/ASGI/ASP.NET hosts and shared renderer manifests."""
from copy import deepcopy
from html.parser import HTMLParser
import json
from hosting_cases import fixture as host_fixture
from registry_cases import without_documents
from security_cases import post, SOURCE


def fixture():
    body = host_fixture()
    body["snapshot"]["apps"][0]["shell"] = {"serviceId": SOURCE, "service": "bootstrap1", "renderer": "bootstrap5"}
    body["request"]["headers"]["accept"] = "text/html"
    body["routes"][0]["operations"][0].update(result='<script> & " hello', renderers=[
        {"declaration": {"renderer": "bootstrap5"}},
        {"declaration": {"renderer": "bootstrap5", "kind": "fragment", "key": "nav.profile"}},
        {"declaration": {"renderer": "bootstrap5", "kind": "component", "key": "card"}}])
    return body


class Html(HTMLParser):
    def __init__(self, value):
        super().__init__(convert_charrefs=True)
        self.text = []; self.tags = []
        self.feed(value)
    def handle_data(self, value): self.text.append(value)
    def handle_starttag(self, name, attrs): self.tags.append(name)


def run_rendering(urls, labels):
    results, cases = [], []
    def check(label, name, action):
        result = {"runtime": label, "id": "rendering-" + name, "passed": False}
        try: action(); result["passed"] = True
        except Exception as error: result["error"] = str(error)
        results.append(result)
    def case(name, change=lambda body: None, status=200, kind="page", mode="page", native=False):
        body = fixture(); change(body); cases.append((name, body, status, kind, mode, native))
    case("page")
    case("fragment-mode", lambda body: body["request"]["headers"].update(accept="text/html;mode=fragment"), mode="fragment")
    case("embed-mode", lambda body: body["request"]["headers"].update(accept="text/html;mode=embed"), mode="embed")
    case("fragment-query", lambda body: body["request"].update(path="/check/item?_f=nav.profile"), kind="fragment", mode="fragment")
    case("component-query", lambda body: body["request"].update(path="/check/item?_c=card"), kind="component", mode="fragment")
    case("fragment-accept", lambda body: body["request"]["headers"].update(accept="text/html;fragment=nav.profile"), kind="fragment", mode="fragment")
    case("fragment-quoted", lambda body: body["request"]["headers"].update(accept='text/html;fragment="nav.profile"'), kind="fragment", mode="fragment")
    case("query-over-accept", lambda body: (body["request"].update(path="/check/item?_f=nav.profile"), body["request"]["headers"].update(accept="text/html;fragment=missing")), kind="fragment", mode="fragment")
    case("forged-theme", lambda body: (body["request"]["headers"].update({"X-BP-Theme": "untrusted", "accept": "text/html;theme=untrusted"}), body["request"].update(path="/check/item?_theme=untrusted")))
    def parsed_context(body):
        body["request"]["path"] = "/check/42?n=7&private=removed"
        def schema(properties): return {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {
            "kind": "object", "properties": properties, "required": list(properties), "unknownKeys": "strip"}}
        number = {"kind": "int", "coerce": {"toInt": True}}
        schemas = {"params": schema({"key": number}), "query": schema({"n": number, "limit": {**number, "default": 10}})}
        for operation in body["routes"][0]["operations"]: operation["schemas"] = schemas
    case("parsed-context", parsed_context)
    case("missing-app-renderer", lambda body: body["snapshot"]["apps"][0].pop("shell"), 406)
    case("exact-renderer", lambda body: body["snapshot"]["apps"][0]["shell"].update(renderer="bootstrap"), 406)
    case("missing-fragment", lambda body: body["request"].update(path="/check/item?_f=nav.missing"), 406)
    case("missing-component", lambda body: body["request"].update(path="/check/item?_c=missing"), 406)
    def post_request(body, with_renderer=True):
        body["request"].update(method="POST")
        body["snapshot"]["apps"][0]["routes"][0]["operations"].append("check.post")
        body["routes"][0]["operations"][1]["result"] = "POST"
        if with_renderer: body["routes"][0]["operations"][1]["renderers"] = [{"declaration": {"renderer": "bootstrap5"}}]
    case("method-specific", post_request)
    case("wrong-renderer-method", lambda body: post_request(body, False), 406)
    case("render-error", lambda body: body["routes"][0]["operations"][0]["renderers"][0].update(throw=True), 500)
    case("response-validation", lambda body: body["routes"][0]["operations"][0].update(response={"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {"kind": "bool"}}), 500)
    case("denied-operation", lambda body: body["snapshot"]["apps"][0]["routes"][0].update(operations=["unavailable.get"]), 404)
    case("duplicate-component", lambda body: body["request"].update(path="/check/item?_c=card&_c=other"), 400, native=True)
    case("ambiguous-selector", lambda body: body["request"].update(path="/check/item?_f=nav.profile&_c=card"), 400, native=True)
    case("fragment-suffix", lambda body: body["request"].update(path="/check/item?_f=nav.profile.extra"), 406, native=True)
    def fragment_mount(body):
        body["snapshot"]["apps"][0]["routes"] = []
        body["snapshot"]["apps"][0]["fragments"] = {"nav": [{"serviceId": body["snapshot"]["serviceIdentity"]["id"], "fragmentId": "profile", "targetPath": "/check/:key"}]}
        body["request"]["headers"]["accept"] = "text/html;fragment=nav.profile"
    case("fragment-only-mount", fragment_mount, kind="fragment", mode="fragment")
    case("fragment-mount-denied", lambda body: (fragment_mount(body), body["snapshot"]["apps"][0]["fragments"]["nav"][0].update(enabled=False)), 404)
    case("zero-quality-selector", lambda body: (fragment_mount(body), body["request"]["headers"].update(accept="text/html;fragment=nav.profile;q=0,application/json")), 404, native=True)
    for accept in ("application/json", "application/vnd.betterportal.metadata+json", "text/html;fragment=nav.profile;q=0,application/json", "*/*", "image/png"):
        case("fragment-grant-denied-" + accept, lambda body, accept=accept: (fragment_mount(body),
             body["request"].update(path="/check/item?_f=nav.profile"), body["request"]["headers"].update(accept=accept)), 404, native=True)
    case("invalid-accept-auth-first", lambda body: (body["routes"][0]["operations"][0]["declaration"].update(auth={"required": True}), body["request"]["headers"].update(accept="unacceptable")), 401, native=True)
    for method in ("GET", "POST"):
        for selector, kind, key in (("_f", "fragment", "nav.profile"), ("_c", "component", "card")):
            def strict_query(body, method=method, selector=selector, key=key):
                body["request"].update(method=method, path=f"/check/item?{selector}={key}&n=7")
                spec = body["routes"][0]["operations"][0 if method == "GET" else 1]
                if method == "POST":
                    body["snapshot"]["apps"][0]["routes"][0]["operations"].append("check.post")
                    spec["renderers"] = deepcopy(body["routes"][0]["operations"][0]["renderers"])
                spec["schemas"] = {"query": {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {
                    "kind": "object", "properties": {"n": {"kind": "int", "coerce": {"toInt": True}}}, "required": ["n"], "unknownKeys": "reject"}}}
            case(f"strict-query-{method}-{selector}", strict_query, kind=kind, mode="fragment")
            case(f"strict-query-unknown-{method}-{selector}", lambda body, change=strict_query: (change(body), body["request"].update(path=body["request"]["path"] + "&unknown=1")), 400)
    for name, body, status, kind, mode, native in cases:
        expected = None
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            def action():
                nonlocal expected
                actual = post(url, body)
                assert actual["status"] == status, actual
                if status != 200:
                    if label != "node":
                        assert "private-render-secret" not in actual["body"], actual
                        if status in (404, 406): assert actual["invoked"] == 0, actual
                    return
                assert actual["headers"]["content-type"].startswith("text/html") and "mode=" + mode in actual["headers"]["content-type"], actual
                html = Html(actual["body"])
                assert html.tags == ["pre"], actual
                value = json.loads("".join(html.text))
                assert value["context"]["route"]["kind"] == kind, actual
                if name == "parsed-context":
                    assert value["context"]["request"]["params"] == {"key": 42}, actual
                    assert value["context"]["request"]["query"] == {"n": 7, "limit": 10}, actual
                if name.startswith("strict-query-"): assert value["context"]["request"]["query"] == {"n": 7}, actual
                assert set(value["context"]["tenant"]) == {"id", "slug", "title", "branding"}, actual
                assert set(value["context"]["app"]) == {"id", "tenantId", "slug", "title", "defaultRoute", "shell"}, actual
                if expected is None: expected = value
                assert value == expected, (expected, value)
            check(label, name, action)
    for url, label in zip(urls, labels):
        if label == "node": continue
        for accept in ("application/json", "application/vnd.betterportal.metadata+json", "text/html", "image/png"):
            for fail in (False, True):
                def vary():
                    body = fixture(); body["request"]["headers"]["accept"] = accept
                    spec = body["routes"][0]["operations"][0]
                    spec["declaration"]["cacheHints"] = {"ttlSeconds": 60}
                    spec.update(throw=fail, responseHeaders=[["Vary", "Accept-Language"]])
                    actual = post(url, body)
                    expected_status = 406 if accept == "image/png" else 500 if fail and "metadata" not in accept else 200
                    assert actual["status"] == expected_status, actual
                    cache = {part.strip() for part in actual["headers"].get("cache-control", "").split(",")}
                    assert cache == ({"private", "max-age=60"} if expected_status == 200 else {"no-store"}), actual
                    fields = {part.strip().lower() for part in actual["headers"].get("vary", "").split(",")}
                    assert {"accept", "origin"} <= fields, actual
                    if actual["invoked"] and not fail: assert "accept-language" in fields, actual
                check(label, f"vary-{accept}-{fail}", vary)
    for name, change in (("metadata", lambda body: None), ("method-metadata", post_request)):
        body = fixture(); change(body); body["action"] = "registry"
        expected = None
        for url, label in zip(urls, labels):
            def action():
                nonlocal expected
                actual = post(url, body)
                assert actual["status"] == 200, actual
                value = without_documents(actual["schema"])
                if expected is None: expected = value
                assert value == expected, (expected, value)
            check(label, name, action)
    for status in (201, 202, 206, 302, 404, 503):
        for representation in ("html", "json"):
            for url, label in zip(urls, labels):
                # Node's generic status helper incorrectly forbids 206/redirect bodies.
                if label == "node" and status in (206, 302): continue
                def action():
                    body = fixture(); spec = body["routes"][0]["operations"][0]; spec["status"] = status
                    spec["renderers"].append({"declaration": {"renderer": "bootstrap5", "status": status}, "text": "<p>Custom status</p>"})
                    body["request"]["headers"]["accept"] = "text/html" if representation == "html" else "application/json"
                    actual = post(url, body)
                    assert actual["status"] == status and actual["invoked"] == 1, actual
                    assert actual["body"] == "<p>Custom status</p>" if representation == "html" else json.loads(actual["body"]) == spec["result"], actual
                check(label, f"status-{status}-{representation}", action)
    for status in (204, 205, 304):
        for url, label in zip(urls, labels):
            def action():
                body = fixture(); body["routes"][0]["operations"][0]["status"] = status
                actual = post(url, body)
                assert actual["status"] == status and actual["body"] == "", actual
            check(label, "bodyless-" + str(status), action)
    for url, label in zip(urls, labels):
        def head():
            body = fixture(); body["request"]["method"] = "HEAD"
            actual = post(url, body)
            assert actual["status"] == 200 and actual["body"] == "" and actual["headers"]["content-type"].startswith("text/html"), actual
        check(label, "head", head)
        def chrome():
            body = fixture(); body["routes"][0]["operations"][0]["declaration"]["chrome"] = {"hideMenu": True, "fullScreen": False, "heading": "A; B\r\n", "spacing": 7.5, "invalid;key": "ignored"}
            actual = post(url, body)
            assert actual["status"] == 200, actual
            content = actual["headers"]["content-type"]
            for value in ("bp-chrome-hide-menu=true", "bp-chrome-full-screen=false", "bp-chrome-heading=A%3B%20B%0D%0A", "bp-chrome-spacing=7.5"):
                assert value in content, actual
            assert "invalid" not in content, actual
        check(label, "chrome", chrome)
        def no_fallback():
            body = fixture(); body["routes"][0]["operations"][0]["status"] = 201
            actual = post(url, body)
            assert actual["status"] == 201 and actual["body"] == "", actual
        check(label, "explicit-status-renderer", no_fallback)
        def headers():
            body = fixture(); body["request"]["headers"]["accept"] = "application/json"
            body["routes"][0]["operations"][0]["responseHeaders"] = [["HX-Trigger", "bp:menu-changed"], ["Set-Cookie", "one=1; HttpOnly"], ["Set-Cookie", "two=2; Secure"]]
            actual = post(url, body)
            assert actual["status"] == 200 and actual["headers"].get("hx-trigger") == "bp:menu-changed", actual
            assert actual["cookies"] == ["one=1; HttpOnly", "two=2; Secure"], actual
        check(label, "response-headers", headers)
        for kind, selector in (("page", ""), ("fragment", "?_f=nav.profile"), ("component", "?_c=card")):
            # Node's auth error path currently selects only a page status renderer.
            if label == "node" and kind != "page": continue
            def error_renderer():
                body = fixture(); body["request"]["path"] = "/check/item" + selector
                spec = body["routes"][0]["operations"][0]; spec["declaration"]["auth"] = {"required": True}
                body["snapshot"]["apps"][0]["auth"] = {"serviceId": SOURCE, "expectedIssuer": "https://auth.test", "expectedAudience": "app", "jwksUri": "http://127.0.0.1:1/keys"}
                declaration = {"renderer": "bootstrap5", "kind": kind, "status": 401}
                if kind != "page": declaration["key"] = "nav.profile" if kind == "fragment" else "card"
                spec["errorRenderers"] = [{"declaration": declaration, "text": "<p>Sign in</p>"}]
                actual = post(url, body)
                assert actual["status"] == 401 and actual["body"] == "<p>Sign in</p>" and actual["invoked"] == 0, actual
                if label != "node": assert "mode=" + ("page" if kind == "page" else "fragment") in actual["headers"]["content-type"], actual
            check(label, "auth-error-" + kind, error_renderer)
        if label != "node":
            for error in (False, True):
                def cancellation():
                    body = fixture(); body["cancel"] = True
                    spec = body["routes"][0]["operations"][0]
                    if error:
                        spec["throw"] = True
                        spec["errorRenderers"] = [{"declaration": {"renderer": "bootstrap5", "status": 500}, "wait": True}]
                    else: spec["renderers"][0]["wait"] = True
                    assert post(url, body) == {"cancelled": True, "invoked": 1}
                check(label, "error-renderer-cancel" if error else "renderer-cancel", cancellation)
            for denied in (False, True):
                def preflight():
                    body = fixture(); fragment_mount(body); body["request"].update(method="OPTIONS")
                    body["request"]["headers"].update(accept="*/*", **{"access-control-request-method": "GET", "access-control-request-headers": "Authorization"})
                    if denied: body["snapshot"]["apps"][0]["fragments"]["nav"][0]["serviceId"] = SOURCE
                    actual = post(url, body)
                    assert actual["status"] == (403 if denied else 204) and actual["invoked"] == 0, actual
                check(label, "accept-fragment-preflight-denied" if denied else "accept-fragment-preflight", preflight)
            for trigger in ("throw", "invalid-output", "invalid-query", "broken-error-renderer"):
                def generic_error():
                    body = fixture(); spec = body["routes"][0]["operations"][0]
                    status = 400 if trigger == "invalid-query" else 500
                    spec["errorRenderers"] = [{"declaration": {"renderer": "bootstrap5", "status": status}}]
                    if trigger in ("throw", "broken-error-renderer"): spec["throw"] = True
                    if trigger == "broken-error-renderer": spec["errorRenderers"][0]["throw"] = True
                    if trigger == "invalid-output": spec["response"] = {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {"kind": "bool"}}
                    if trigger == "invalid-query": spec["schemas"] = {"query": {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {"kind": "bool"}}}
                    actual = post(url, body)
                    assert actual["status"] == status and "private-" not in actual["body"], actual
                    if trigger != "broken-error-renderer":
                        value = json.loads("".join(Html(actual["body"]).text))
                        assert value["data"]["status"] == status and set(value["data"]) == {"status", "error"}, actual
                check(label, trigger, generic_error)
    for name, change in (
        ("duplicate-renderer", lambda spec: spec["renderers"].append(deepcopy(spec["renderers"][0]))),
        ("page-key", lambda spec: spec["renderers"][0]["declaration"].update(key="wrong")),
        ("fragment-key", lambda spec: spec["renderers"][1]["declaration"].update(key="nav.profile.extra")),
        ("component-key", lambda spec: spec["renderers"][2]["declaration"].pop("key"))):
        for url, label in zip(urls, labels):
            if label == "node": continue
            def action():
                body = fixture(); body["action"] = "registry"; change(body["routes"][0]["operations"][0])
                assert post(url, body)["status"] == 400
            check(label, name, action)
    return results
