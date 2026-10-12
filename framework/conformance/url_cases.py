"""Handler/renderer URLs through real H3, ASGI and ASP.NET hosts."""
from copy import deepcopy
import json
from rendering_cases import fixture as render_fixture, Html
from security_cases import post, SOURCE, TARGET, BINDING


def fixture():
    body = render_fixture()
    body["dependencies"] = {"docs": "com.example.other"}
    body["snapshot"]["tenants"][0]["services"][1].update(serviceId="com.example.other", hostname="https://other.test")
    app = body["snapshot"]["apps"][0]
    app["routes"][0].update(resolvedMethods=["GET", "POST"])
    app["appRoutes"] = [deepcopy(app["routes"][0]), {"id": SOURCE, "serviceId": SOURCE, "viewId": "docs.index", "path": "/docs/:slug",
        "resolvedServicePath": "/content/:slug", "resolvedMethods": ["GET"], "operations": ["docs.get"], "fixedParams": {"slug": "intro"}}]
    return body


def run_urls(urls, labels):
    """The same six-field contract in real API handlers and HTML renderers."""
    cases, results = [], []
    def resolved(api, view=None, ui=None, origin="https://service.test"):
        view = api if view is None else view
        return {"apiPath": api, "viewPath": view, "uiPath": ui,
            "absoluteApiPath": origin + api if origin else None,
            "absoluteViewPath": origin + view if origin else None,
            "absoluteUiPath": "https://app.test" + ui if ui else None}
    def case(name, input, expected, change=lambda body: None, native=False):
        cases.append((name, input, expected, change, native))
    case("self", None, resolved("/check/item?hello=world", ui="/app/item?hello=world"))
    case("self-query", {"query": {"page": 2}}, resolved("/check/item?hello=world&page=2", ui="/app/item?hello=world&page=2"))
    case("self-param", {"params": {"key": "other"}}, resolved("/check/other?hello=world", ui="/app/other?hello=world"))
    case("view-id", {"viewId": "check", "params": {"key": "a/b"}, "query": {"q": "hello world", "omit": None}}, resolved("/check/a%2Fb?q=hello+world", ui="/app/a%2Fb?q=hello+world"))
    case("path", {"path": "/check/item?existing=yes", "query": {"q": "hello world"}}, resolved("/check/item?existing=yes&q=hello+world", ui="/app/item?existing=yes&q=hello+world"))
    case("path-pattern", {"path": "/check/:key", "params": {"key": "42"}}, resolved("/check/42", ui="/app/42"))
    case("encoded-unicode", {"viewId": "check", "params": {"key": "日本語 a/b"}, "query": {"flag": True, "count": 42}}, resolved("/check/%E6%97%A5%E6%9C%AC%E8%AA%9E%20a%2Fb?flag=true&count=42", ui="/app/%E6%97%A5%E6%9C%AC%E8%AA%9E%20a%2Fb?flag=true&count=42"))
    case("raw-query-clear", {"path": "/check/item?hello=world", "query": {"hello": None}}, resolved("/check/item", ui="/app/item"))
    case("unsupported-method", {"method": "DELETE"}, None)
    case("hash-rejected", {"path": "/check/item#anchor"}, None)
    case("dot-param-rejected", {"viewId": "check", "params": {"key": ".."}}, None)
    case("method", {"method": "POST"}, resolved("/check/item?hello=world"))
    case("unknown-view", {"viewId": "unknown"}, None)
    case("unknown-path", {"path": "/unknown"}, None)
    case("missing-params", {"viewId": "check"}, None)
    case("both-selectors", {"viewId": "check", "path": "/check/item"}, None)
    case("component", {"viewId": "check", "params": {"key": "item"}, "component": "card"}, resolved("/check/item", "/check/item?_c=card"))
    case("fragment", {"viewId": "check", "params": {"key": "item"}, "fragment": "nav.profile"}, resolved("/check/item", "/check/item?_f=nav.profile"))
    case("sse", {"viewId": "check", "params": {"key": "item"}, "sse": True, "fragment": "nav.profile"}, resolved("/check/item/__sse", "/check/item/__sse?_f=nav.profile"))
    for raw, encoded in (("https://service.test/prefix", "https://service.test/prefix"), ("https://service.test/prefix///", "https://service.test/prefix"), ("https://service.test/café", "https://service.test/caf%C3%A9")):
        case("service-base-" + raw, {"viewId": "check", "params": {"key": "a/b"}}, resolved("/check/a%2Fb", ui="/app/a%2Fb", origin=encoded),
             lambda body, raw=raw: body["snapshot"]["tenants"][0]["services"][0].update(hostname=raw))
    for number in (9007199254740993, 9223372036854775807, -9223372036854775808, 18446744073709551615):
        case("integer-" + str(number), {"viewId": "check", "params": {"key": number}, "query": {"n": number}},
             resolved(f"/check/{number}?n={number}", ui=f"/app/{number}?n={number}"), native=True)
    def self_post(body):
        body["request"]["method"] = "POST"
        body["snapshot"]["apps"][0]["routes"][0]["operations"].append("check.post")
        body["routes"][0]["operations"][1]["renderers"] = deepcopy(body["routes"][0]["operations"][0]["renderers"])
    case("self-post", None, resolved("/check/item?hello=world"), self_post)
    case("selector-conflict", {"viewId": "check", "params": {"key": "item"}, "component": "card", "fragment": "nav.profile"}, None)
    case("dependency", {"viewId": "docs.index", "serviceId": "docs"}, resolved("/content/intro", ui="/docs/intro", origin="https://other.test"))
    case("dependency-path", {"path": "/content/:slug", "serviceId": "docs"}, resolved("/content/intro", ui="/docs/intro", origin="https://other.test"))
    case("disabled-provider", {"viewId": "docs.index", "serviceId": "docs"}, None,
         lambda body: body["snapshot"]["tenants"][0]["services"][1].update(enabled=False))
    case("dependency-fixed-override", {"viewId": "docs.index", "serviceId": "docs", "params": {"slug": "start"}}, resolved("/content/start", ui="/docs/start", origin="https://other.test"))
    case("missing-ui-methods", {"viewId": "check", "params": {"key": "item"}}, resolved("/check/item"),
         lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].pop("resolvedMethods"))
    case("query-clear", {"query": {"hello": None}}, resolved("/check/item", ui="/app/item"))
    alias_id = "01952200-0000-7000-8000-000000000006"
    def aliases(body):
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[0]), "id": alias_id, "path": "/alias/:key"})
    case("ambiguous-ui", {"viewId": "check", "params": {"key": "item"}}, resolved("/check/item"), aliases)
    case("selected-mount", {"viewId": "check", "params": {"key": "item"}, "mountId": alias_id}, resolved("/check/item", ui="/alias/item"), aliases)
    case("disabled-ui", {"viewId": "check", "params": {"key": "item"}}, resolved("/check/item"), lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].update(enabled=False))
    def providers(body):
        body["snapshot"]["tenants"][0]["services"].append({**deepcopy(body["snapshot"]["tenants"][0]["services"][1]), "id": BINDING})
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[1]), "id": BINDING, "serviceId": BINDING})
    case("ambiguous-provider", {"viewId": "docs.index", "serviceId": "docs"}, None, providers)
    for url, label in zip(urls, labels):
        for name, input, expected, change, native in cases:
            if native and label == "node": continue
            for handler in (False, True):
                result = {"runtime": label, "id": "url-" + name + ("-handler" if handler else "-renderer"), "passed": False}
                try:
                    body = fixture(); change(body)
                    call = {"kind": "routeUrl", **({"input": input} if input is not None else {})}
                    operation = next(spec for spec in body["routes"][0]["operations"] if spec["declaration"]["method"] == body["request"].get("method", "GET"))
                    if handler:
                        body["request"]["headers"]["accept"] = "application/json"
                        operation["urlCalls"] = [call]
                    else: operation["renderers"][0]["urlCalls"] = [call]
                    actual = post(url, body)
                    assert actual["status"] == 200 and actual["invoked"] == 1, actual
                    value = json.loads(actual["body"] if handler else "".join(Html(actual["body"]).text))
                    assert value == [expected], (value, expected)
                    result["passed"] = True
                except Exception as error: result["error"] = str(error)
                results.append(result)
    return results
