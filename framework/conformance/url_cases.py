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
    def case(name, input, expected, change=lambda body: None, native=False, runtimes=None):
        cases.append((name, input, expected, change, native, runtimes))
    case("self", None, resolved("/check/item?hello=world", ui="/app/item?hello=world"))
    case("canonical-own-reference", {"serviceId": "com.example.service", "viewId": "check", "params": {"key": "item"}}, resolved("/check/item", ui="/app/item"))
    def canonical_self(body):
        body["snapshot"].pop("serviceIdentity", None)
        body["snapshot"]["m2m"] = {"localServiceIds": [TARGET], "services": [], "bindings": [], "grants": []}
    case("canonical-current-self", None, resolved("/check/item?hello=world", ui="/app/item?hello=world"), canonical_self)

    case("self-query", {"query": {"page": 2}}, resolved("/check/item?hello=world&page=2", ui="/app/item?hello=world&page=2"))
    def repeated(body):
        body["request"]["path"] = "/check/item?hello=world&tag=a&tag=b&empty=&empty=x"
    case("self-repeated-query", None, resolved("/check/item?hello=world&tag=a&tag=b&empty=&empty=x", ui="/app/item?hello=world&tag=a&tag=b&empty=&empty=x"), repeated)
    case("self-repeated-query-override", {"query": {"tag": "latest", "empty": None}}, resolved("/check/item?hello=world&tag=latest", ui="/app/item?hello=world&tag=latest"), repeated)
    case("path-question-values", {"path": "/check/item?q=what?x&next=/a?b"}, resolved("/check/item?q=what%3Fx&next=%2Fa%3Fb", ui="/app/item?q=what%3Fx&next=%2Fa%3Fb"))
    case("path-question-override", {"path": "/check/item?q=what?x&next=/a?b", "query": {"q": "latest"}}, resolved("/check/item?q=latest&next=%2Fa%3Fb", ui="/app/item?q=latest&next=%2Fa%3Fb"))
    case("path-repeated-query", {"path": "/check/item?tag=a&tag=b"}, resolved("/check/item?tag=a&tag=b", ui="/app/item?tag=a&tag=b"))
    case("path-repeated-query-override", {"path": "/check/item?tag=a&tag=b", "query": {"tag": "latest"}}, resolved("/check/item?tag=latest", ui="/app/item?tag=latest"))
    case("self-param", {"params": {"key": "other"}}, resolved("/check/other?hello=world", ui="/app/other?hello=world"))
    case("view-id", {"viewId": "check", "params": {"key": "a/b"}, "query": {"q": "hello world", "omit": None}}, resolved("/check/a%2Fb?q=hello+world", ui="/app/a%2Fb?q=hello+world"))
    case("path", {"path": "/check/item?existing=yes", "query": {"q": "hello world"}}, resolved("/check/item?existing=yes&q=hello+world", ui="/app/item?existing=yes&q=hello+world"))
    case("path-pattern", {"path": "/check/:key", "params": {"key": "42"}}, resolved("/check/42", ui="/app/42"))
    case("encoded-unicode", {"viewId": "check", "params": {"key": "日本語 a/b"}, "query": {"flag": True, "count": 42}}, resolved("/check/%E6%97%A5%E6%9C%AC%E8%AA%9E%20a%2Fb?flag=true&count=42", ui="/app/%E6%97%A5%E6%9C%AC%E8%AA%9E%20a%2Fb?flag=true&count=42"))
    case("raw-query-clear", {"path": "/check/item?hello=world", "query": {"hello": None}}, resolved("/check/item", ui="/app/item"))
    def overlapping(body, reverse=False, dependency=False):
        if dependency:
            mounts = body["snapshot"]["apps"][0]["appRoutes"]
            mounts[1].update(viewId="first", path="/left/:section", resolvedServicePath="/a/:section/new", fixedParams={})
            mounts.append({**deepcopy(mounts[1]), "id": BINDING, "viewId": "second", "path": "/right/:id", "resolvedServicePath": "/a/users/:id"})
            if reverse: mounts[1:] = reversed(mounts[1:])
        else:
            route = deepcopy(body["routes"][0])
            route.update(viewId="first", path="/a/:section/new")
            second = deepcopy(route)
            second.update(viewId="second", path="/a/users/:id")
            for entry in (route, second):
                for operation in entry["operations"]:
                    operation["declaration"]["operationId"] = entry["viewId"] + "." + operation["declaration"]["method"].lower()
            body["routes"].extend([second, route] if reverse else [route, second])
            mounts = body["snapshot"]["apps"][0]["appRoutes"]
            mounts.extend([{**deepcopy(mounts[0]), "id": SOURCE, "viewId": "first", "path": "/left/:section", "resolvedServicePath": "/a/:section/new"},
                           {**deepcopy(mounts[0]), "id": BINDING, "viewId": "second", "path": "/right/:id", "resolvedServicePath": "/a/users/:id"}])
    for dependency in (False, True):
        for reverse in (False, True):
            for template, params, api, ui in (("/a/:section/new", {"section": "sales"}, "/a/sales/new", "/left/sales"), ("/a/users/:id", {"id": "new"}, "/a/users/new", "/right/new")):
                case(f"exact-template-{dependency}-{reverse}-{template}", {"path": template, "params": params, **({"serviceId": "docs"} if dependency else {})},
                     resolved(api, ui=ui, origin="https://other.test" if dependency else "https://service.test"),
                     lambda body, reverse=reverse, dependency=dependency: overlapping(body, reverse, dependency))
    for dependency in (False, True):
        for reverse in (False, True):
            case(f"concrete-overlap-{dependency}-{reverse}", {"path": "/a/users/new", **({"serviceId": "docs"} if dependency else {})},
                 resolved("/a/users/new", ui="/right/new", origin="https://other.test" if dependency else "https://service.test"),
                 lambda body, reverse=reverse, dependency=dependency: overlapping(body, reverse, dependency))
    def overlapping_self(body):
        overlapping(body)
        body["request"]["path"] = "/a/users/new?hello=world"
        app = body["snapshot"]["apps"][0]
        app["routes"].extend(deepcopy(app["appRoutes"][-2:]))
        for mount, route in zip(app["routes"][-2:], body["routes"][-2:]):
            mount["operations"] = [op["declaration"]["operationId"] for op in route["operations"]]
    case("overlapping-self", None, resolved("/a/users/new?hello=world", ui="/right/new?hello=world"), overlapping_self)
    case("unsupported-method", {"method": "DELETE"}, None)
    case("hash-rejected", {"path": "/check/item#anchor"}, None)
    case("dot-param-rejected", {"viewId": "check", "params": {"key": ".."}}, None)
    def literal_path(body, raw, encoded):
        body["routes"][0]["path"] = raw
        body["request"]["path"] = encoded + "?hello=world"
        body["snapshot"]["apps"][0]["routes"][0].update(path="/literal", resolvedServicePath=raw)
        body["snapshot"]["apps"][0]["appRoutes"][0].update(path="/literal", resolvedServicePath=raw)
    for raw, encoded, runtimes in (("/café", "/caf%C3%A9", None), ("/orders today", "/orders%20today", ["node"])):
        change = lambda body, raw=raw, encoded=encoded: literal_path(body, raw, encoded)
        case("literal-self-" + raw, None, resolved(encoded + "?hello=world", ui="/literal?hello=world"), change, runtimes=runtimes)
        case("literal-path-" + raw, {"path": encoded}, resolved(encoded, ui="/literal"), change, runtimes=runtimes)
    case("encoded-concrete-path", {"path": "/check/a%2Fb"}, resolved("/check/a%2Fb", ui="/app/a%2Fb"))
    case("method", {"method": "POST"}, resolved("/check/item?hello=world"))
    case("unknown-view", {"viewId": "unknown"}, None)
    case("unknown-path", {"path": "/unknown"}, None)
    case("missing-params", {"viewId": "check"}, None)
    case("both-selectors", {"viewId": "check", "path": "/check/item"}, None)
    case("query-selectors", {"path": "/check/item", "query": {"_c": "card", "_f": "nav.profile", "q": "yes"}}, resolved("/check/item?q=yes", ui="/app/item?q=yes"))
    case("path-selectors", {"path": "/check/item?_c=card&_f=nav.profile&q=yes"}, resolved("/check/item?q=yes", ui="/app/item?q=yes"))
    case("selector-conflict-query", {"path": "/check/item?_f=nav.profile", "component": "card", "query": {"_f": "other"}}, resolved("/check/item", "/check/item?_c=card"))
    def self_selector(body): body["request"]["path"] = "/check/item?hello=world&_c=card"
    case("self-selectors", None, resolved("/check/item?hello=world", ui="/app/item?hello=world"), self_selector)
    case("component", {"viewId": "check", "params": {"key": "item"}, "component": "card"}, resolved("/check/item", "/check/item?_c=card"))
    case("fragment", {"viewId": "check", "params": {"key": "item"}, "fragment": "nav.profile"}, resolved("/check/item", "/check/item?_f=nav.profile"))
    def feed(body):
        schema = body["routes"][0]["operations"][0]["response"]
        body["routes"][0]["feed"] = {"inputSchema": schema, "eventSchema": schema, "publications": []}
    case("sse", {"viewId": "check", "params": {"key": "item"}, "sse": True, "fragment": "nav.profile"}, resolved("/check/item/__sse", "/check/item/__sse?_f=nav.profile"), feed)
    case("unsupported-sse", {"viewId": "check", "params": {"key": "item"}, "sse": True}, None)
    case("non-get-sse", {"viewId": "check", "params": {"key": "item"}, "method": "POST", "sse": True}, None, feed)
    case("unknown-dependency-sse", {"viewId": "docs.index", "serviceId": "docs", "sse": True}, None)
    def finite_target(body):
        route = deepcopy(body["routes"][0]); route.update(viewId="stream", path="/stream")
        operation = route["operations"][0]; route["operations"] = [operation]
        operation["declaration"]["operationId"] = "stream.get"
        operation["finite"] = {"itemSchema": operation["response"], "items": []}
        body["routes"].append(route)
    case("finite-sse", {"viewId": "stream", "sse": True}, resolved("/stream/__sse"), finite_target)
    for raw, encoded in (("https://service.test/prefix", "https://service.test/prefix"), ("https://service.test/prefix///", "https://service.test/prefix"), ("https://service.test/café", "https://service.test/caf%C3%A9")):
        case("service-base-" + raw, {"viewId": "check", "params": {"key": "a/b"}}, resolved("/check/a%2Fb", ui="/app/a%2Fb", origin=encoded),
             lambda body, raw=raw: body["snapshot"]["tenants"][0]["services"][0].update(hostname=raw))
    for raw in ("https://user:pass@service.test/prefix", "https://user@service.test", "https://:pass@service.test", "https://service.test/?token=secret", "https://service.test/#secret"):
        change = lambda body, raw=raw: body["snapshot"]["tenants"][0]["services"][0].update(hostname=raw)
        case("unsafe-service-base-" + raw, {"viewId": "check", "params": {"key": "item"}}, resolved("/check/item", ui="/app/item", origin=None), change, runtimes=["node"])
        case("unsafe-service-base-" + raw, {"viewId": "check", "params": {"key": "item"}}, None, change, runtimes=["dotnet"] if "@" in raw else ["python", "dotnet"])
    for host in ("https://user:pass@app.test", "https://user@app.test", "https://:pass@app.test", "https://app.test/?token=secret", "https://app.test/#secret"):
        expected = resolved("/check/item", ui="/app/item")
        expected["absoluteUiPath"] = None
        change = lambda body, host=host: body["snapshot"]["apps"][0].update(hostnames=[host])
        case("unsafe-app-origin-" + host, {"viewId": "check", "params": {"key": "item"}}, expected, change, runtimes=["node"])
        # Native scoped contexts reject these invalid origins before constructing URL helpers.
        error = "Invalid HTTP authority" if "@" in host else "Expected an origin without path, query or fragment"
        case("unsafe-app-origin-" + host, {"viewId": "check", "params": {"key": "item"}}, {"validationError": error}, change, runtimes=["python", "dotnet"])
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
    def missing_dependency_path(body):
        mount = body["snapshot"]["apps"][0]["appRoutes"][1]
        for key in ("resolvedServicePath", "servicePathVariant", "targetPath"): mount.pop(key, None)
    case("dependency-missing-service-path", {"viewId": "docs.index", "serviceId": "docs"}, None, missing_dependency_path)
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
    def fixed_local(body):
        body["snapshot"]["apps"][0]["appRoutes"][0].update(path="/fixed", fixedParams={"key": "pinned"})
    case("local-fixed", {"viewId": "check"}, resolved("/check/pinned", ui="/fixed"), fixed_local)
    case("local-fixed-path", {"path": "/check/:key"}, resolved("/check/pinned", ui="/fixed"), fixed_local)
    case("local-fixed-override", {"viewId": "check", "params": {"key": "other"}}, resolved("/check/other"), fixed_local)
    def fixed_aliases(body):
        fixed_local(body)
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[0]), "id": alias_id, "path": "/another", "fixedParams": {"key": "other"}})
    case("local-fixed-ambiguous", {"viewId": "check"}, None, fixed_aliases)
    case("local-fixed-selected", {"viewId": "check", "mountId": alias_id}, resolved("/check/other", ui="/another"), fixed_aliases)
    def duplicate_current(body):
        body["snapshot"].pop("serviceIdentity", None)
        body["snapshot"]["tenants"][0]["services"].append({**deepcopy(body["snapshot"]["tenants"][0]["services"][0]), "id": alias_id, "hostname": "https://copy.test"})
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[0]), "id": alias_id, "serviceId": alias_id, "path": "/copy/:key"})
    # Native hosts reject ambiguous canonical owners before invoking a handler; exercise Node resolver rejection directly.
    case("ambiguous-current-instance", None, None, duplicate_current, runtimes=["node"])
    case("concrete-current-target", {"serviceId": TARGET, "viewId": "check", "params": {"key": "item"}}, resolved("/check/item", ui="/app/item"), duplicate_current, runtimes=["node"])
    def concrete_identity(body):
        duplicate_current(body)
        body["snapshot"]["serviceIdentity"] = {"id": alias_id}
        body["snapshot"]["apps"][0]["routes"].append(deepcopy(body["snapshot"]["apps"][0]["appRoutes"][-1]))
    case("known-current-instance", None, resolved("/check/item?hello=world", ui="/copy/item?hello=world", origin="https://copy.test"), concrete_identity)
    def getter_identity(body):
        duplicate_current(body)
        body["routeUrlServiceId"] = TARGET
    case("current-instance-getter", None, resolved("/check/item?hello=world", ui="/app/item?hello=world"), getter_identity, runtimes=["node"])
    case("disabled-ui", {"viewId": "check", "params": {"key": "item"}}, resolved("/check/item"), lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].update(enabled=False))
    def providers(body):
        body["snapshot"]["tenants"][0]["services"].append({**deepcopy(body["snapshot"]["tenants"][0]["services"][1]), "id": BINDING})
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[1]), "id": BINDING, "serviceId": BINDING})
    case("ambiguous-provider", {"viewId": "docs.index", "serviceId": "docs"}, None, providers)
    def overlapping_providers(body):
        providers(body)
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts[1].update(path="/generic/:section", resolvedServicePath="/a/:section/new", fixedParams={})
        mounts[2].update(path="/specific/:id", resolvedServicePath="/a/users/:id", fixedParams={})
        body["snapshot"]["tenants"][0]["services"][-1]["hostname"] = "https://copy.test"
    case("selected-provider-ui", {"path": "/a/users/new", "serviceId": "docs"}, resolved("/a/users/new", ui="/specific/new", origin="https://copy.test"), overlapping_providers)

    for url, label in zip(urls, labels):
        for name, input, expected, change, native, runtimes in cases:
            if native and label == "node": continue
            if runtimes is not None and label not in runtimes: continue
            for handler in (False, True):
                result = {"runtime": label, "id": "url-" + name + ("-handler" if handler else "-renderer"), "passed": False}
                try:
                    body = fixture(); change(body)
                    call = {"kind": "routeUrl", **({"input": input} if input is not None else {})}
                    if handler: body["request"]["headers"]["accept"] = "application/json"
                    for route in body["routes"]:
                        operation = next(spec for spec in route["operations"] if spec["declaration"]["method"] == body["request"].get("method", "GET"))
                        if handler: operation["urlCalls"] = [call]
                        else:
                            for renderer in operation["renderers"]: renderer["urlCalls"] = [call]
                    if isinstance(expected, dict) and "validationError" in expected:
                        try: post(url, body)
                        except AssertionError as error:
                            text = str(error)
                            assert text.startswith("HTTP 500: "), text
                            assert json.loads(text.removeprefix("HTTP 500: ")) == {"error": expected["validationError"]}, text
                        else: raise AssertionError("Expected native origin validation to reject invalid app configuration")
                    else:
                        actual = post(url, body)
                        assert actual["status"] == 200 and actual["invoked"] == 1, actual
                        value = json.loads(actual["body"] if handler else "".join(Html(actual["body"]).text))
                        assert value == [expected], (value, expected)
                    result["passed"] = True
                except Exception as error: result["error"] = str(error)
                results.append(result)
    return results
