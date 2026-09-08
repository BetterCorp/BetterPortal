"""Handler/renderer URLs through real H3, ASGI and ASP.NET hosts."""
from copy import deepcopy
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from rendering_cases import fixture as render_fixture, Html
from security_cases import post, SOURCE, TARGET, BINDING


def fixture():
    body = render_fixture()
    body["dependencies"] = {"docs": "com.example.other"}
    body["snapshot"]["tenants"][0]["services"][1].update(serviceId="com.example.other", hostname="https://other.test/base")
    app = body["snapshot"]["apps"][0]
    app["routes"][0].update(resolvedMethods=["GET", "POST"])
    app["appRoutes"] = [deepcopy(app["routes"][0]), {"id": SOURCE, "serviceId": SOURCE, "viewId": "docs.index", "path": "/docs/:slug",
        "resolvedServicePath": "/content/:slug", "resolvedMethods": ["GET"], "operations": ["docs.get"], "fixedParams": {"slug": "intro"}}]
    return body


def run_urls(urls, labels):
    cases, results = [], []
    def case(name, call, expected, change=lambda body: None, native=False, handler=False, runtimes=None):
        body = fixture(); change(body)
        if handler:
            body["request"]["headers"]["accept"] = "application/json"
            body["routes"][0]["operations"][0]["urlCalls"] = [call]
        else: body["routes"][0]["operations"][0]["renderers"][0]["urlCalls"] = [call]
        cases.append((name, body, [expected], native, handler, runtimes))
    def route(options=None, view="check", kind="route"): return {"kind": kind, "viewId": view, "options": options or {}}
    params = {"key": "item"}
    for number in (9007199254740993, 9223372036854775807, -9223372036854775808, 9223372036854775809, 18446744073709551615):
        for handler in (False, True):
            case(f"integer-{number}-{handler}", route({"params": {"key": number}, "query": {"n": number}}),
                 f"/check/{number}?n={number}", handler=handler, native=True)
    for handler in (False, True):
        suffix = "-handler" if handler else "-renderer"
        for name, call, expected in (
            ("local", route({"params": params}), "/check/item"),
            ("local-absolute", route({"params": params, "absolute": True}), "https://service.test/check/item"),
            ("ui", route({"params": params}, kind="uiRoute"), "/app/item"),
            ("ui-absolute", route({"params": params, "absolute": True}, kind="uiRoute"), "https://app.test/app/item"),
            ("missing-params", route(), None),
            ("missing-view", route(view="missing"), None),
            ("alias", route({"serviceId": "docs", "absolute": True}, "docs.index"), "https://other.test/content/intro"),
            ("cross-ui", route({"serviceId": "docs", "params": {"slug": "start"}}, "docs.index", "uiRoute"), "/docs/start"),
            ("cross-fixed-override", route({"serviceId": SOURCE, "params": {"slug": "override"}}, "docs.index"), "/content/override"),
            ("cross-ui-no-fixed-param", route({"serviceId": "docs"}, "docs.index", "uiRoute"), None),
            ("escaped-param", route({"params": {"key": "a/b ?&#"}}), "/check/a%2Fb%20%3F%26%23"),
            ("fragment-sse", route({"params": params, "fragment": "nav.profile", "sse": True, "query": {"n": 4, "skip": None}}), "/check/item/__sse?n=4&_f=nav.profile"),
            ("component", route({"params": params, "component": "card"}), "/check/item?_c=card"),
            ("ui-no-service-selectors", route({"params": params, "fragment": "nav.profile", "sse": True}, kind="uiRoute"), "/app/item"),
            ("query", route({"params": params, "query": {"value": "hello ~!*()", "yes": True, "zero": -0.0, "n": 1.0, "small": 1e-7, "large": 1e21}}),
                "/check/item?value=hello+%7E%21*%28%29&yes=true&zero=0&n=1&small=1e-7&large=1e%2B21"),
            ("origin-override", route({"params": params, "absolute": True, "origin": "https://alternate.test:443"}), "https://alternate.test/check/item")):
            case(name + suffix, call, expected, handler=handler)
    for name, call, expected in (
        ("current", {"kind": "current"}, "/check/item"),
        ("path-relative-fragment", {"kind": "path", "path": "/docs#intro"}, "/docs#intro"),
        ("path-relative-encoded-fragment", {"kind": "path", "path": "/docs#hello%20world"}, "/docs#hello%20world"),
        ("path-relative-query-fragment", {"kind": "path", "path": "/docs?old=1#intro", "options": {"query": {"old": 2}, "sse": True}}, "/docs/__sse?old=2#intro"),
        ("current-fragment", {"kind": "current", "options": {"fragment": "nav.profile"}}, "/check/item?_f=nav.profile"),
        ("path-query", {"kind": "path", "path": "/x?keep=a&keep=b&set=old&end=y", "options": {"query": {"set": "new", "new": 0, "skip": None}}}, "/x?keep=a&keep=b&set=new&end=y&new=0"),
        ("path-utf8", {"kind": "path", "path": "/café"}, "/caf%C3%A9"),
        ("path-query-utf8", {"kind": "path", "path": "/café?q=café"}, "/caf%C3%A9?q=caf%C3%A9"),
        ("path-query-quotes", {"kind": "path", "path": "/x?q='hello world'"}, "/x?q=%27hello%20world%27"),
        ("path-absolute-fragment", {"kind": "path", "path": "/café#café", "options": {"absolute": True, "origin": "https://app.test"}}, "https://app.test/caf%C3%A9#caf%C3%A9"),
        ("numeric-format", {"kind": "path", "path": "/x", "options": {"query": {"a": 1e-6, "b": 1.234567890123456e-6, "c": 1e20, "d": -1e-7}}},
            "/x?a=0.000001&b=0.000001234567890123456&c=100000000000000000000&d=-1e-7"),
        ("link", {"kind": "link", "url": "/app/item", "options": {"target": "#main", "swap": "innerHTML", "push": False}},
            {"href": "/app/item", "hx-get": "/app/item", "hx-target": "#main", "hx-swap": "innerHTML", "hx-push-url": "false"}),
        ("form", {"kind": "form", "url": "/check/item", "options": {"method": "POST", "push": "/app/item"}},
            {"action": "/check/item", "method": "POST", "hx-post": "/check/item", "hx-push-url": "/app/item"}),
        ("current-ui", {"kind": "currentUi", "options": {"fragment": "nav.profile", "target": "#nav"}},
            {"href": "/check/item?_f=nav.profile", "hx-get": "/check/item?_f=nav.profile", "hx-target": "#nav"}),
        ("element", {"kind": "element", "reference": {"service": "docs", "path": "/content/:id", "fragment": "nav.profile"}},
            {"serviceId": SOURCE, "url": "https://other.test/content/intro?_f=nav.profile"}),
        ("element-args", {"kind": "element", "reference": {"service": "docs", "path": "/content/:id", "fragment": "nav.profile", "args": {"params": {"slug": "start"}, "query": {"n": True}}}},
            {"serviceId": SOURCE, "url": "https://other.test/content/start?n=true&_f=nav.profile"}),
        ("element-shell", {"kind": "element", "reference": {"service": "shell", "fragment": "branding", "args": {"query": {"n": 1}}}},
            {"serviceId": SOURCE, "url": "https://other.test/.well-known/bp/shell/fragment/branding?n=1"}),
        ("element-empty", {"kind": "element", "reference": {"service": "docs", "fragment": " "}}, {"unavailable": "fragment_required"}),
        ("element-no-path", {"kind": "element", "reference": {"service": "docs", "fragment": "nav.profile"}}, {"unavailable": "service_path_required"}),
        ("element-missing", {"kind": "element", "reference": {"service": "absent", "path": "/content/:id", "fragment": "nav.profile"}}, {"unavailable": "service_unavailable"})):
        case(name, call, expected)
    for name, change in (
        ("disabled-mount", lambda body: body["snapshot"]["apps"][0]["appRoutes"][1].update(enabled=False)),
        ("disabled-service", lambda body: body["snapshot"]["tenants"][0]["services"][1].update(enabled=False)),
        ("other-view", lambda body: body["snapshot"]["apps"][0]["appRoutes"][1].update(viewId="other")),
        ("ambiguous-path", lambda body: body["snapshot"]["apps"][0]["appRoutes"].append({**deepcopy(body["snapshot"]["apps"][0]["appRoutes"][1]), "resolvedServicePath": "/other/:slug"})),
        ("empty-catalog", lambda body: body["snapshot"]["apps"][0].update(appRoutes=[]))):
        case(name, route({"serviceId": "docs"}, "docs.index"), None, change, native=name == "disabled-service")
    for name, change in (
        ("ui-api", lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].update(kind="api")),
        ("ui-post", lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].update(resolvedMethods=["POST"])),
        ("ui-unknown-methods", lambda body: body["snapshot"]["apps"][0]["appRoutes"][0].pop("resolvedMethods")),
        ("ui-ambiguous", lambda body: body["snapshot"]["apps"][0]["appRoutes"].append({**deepcopy(body["snapshot"]["apps"][0]["appRoutes"][0]), "path": "/alternative/:key"}))):
        case(name, route({"params": params}, kind="uiRoute"), None, change)
    case("optional-path", route(), "/check", lambda body: body["routes"][0].update(pathVariants=["/check"]))
    case("optional-prefer-params", route({"params": params}), "/check/item", lambda body: body["routes"][0].update(pathVariants=["/check"]))
    case("preferred-app-origin", route({"params": params, "absolute": True}, kind="uiRoute"), "https://second.test/app/item",
         lambda body: (body["snapshot"]["apps"][0].update(hostnames=["app.test", "second.test"]), body["request"]["headers"].update(origin="https://second.test")))
    case("same-plugin-instance", route({"serviceId": SOURCE}, "docs.index"), "/content/intro",
         lambda body: body["snapshot"]["tenants"][0]["services"][1].update(serviceId="com.example.service"), native=True)
    for reference in ("com.example.service", "docs"):
        for ambiguous in (False, True):
            for absolute in (False, True):
                def same_plugin(body):
                    body["snapshot"]["tenants"][0]["services"][1].update(serviceId="com.example.service")
                    body["dependencies"]["docs"] = "com.example.service"
                    mounts = body["snapshot"]["apps"][0]["appRoutes"]
                    mounts[1]["viewId"] = "check"
                    if not ambiguous: mounts.pop(0)
                case(f"same-plugin-mount-{reference}-{ambiguous}-{absolute}", route({"serviceId": reference, "params": params, "absolute": absolute}),
                     None if ambiguous else ("https://other.test" if absolute else "") + "/content/intro", same_plugin, native=True)
    case("credential-service", route({"serviceId": SOURCE, "absolute": True}, "docs.index"), None,
         lambda body: body["snapshot"]["tenants"][0]["services"][1].update(hostname="https://secret:password@other.test"), native=True)
    case("non-http-service", route({"serviceId": SOURCE, "absolute": True}, "docs.index"), None,
         lambda body: body["snapshot"]["tenants"][0]["services"][1].update(hostname="ftp://other.test"), native=True)
    def providers(body):
        body["snapshot"]["tenants"][0]["services"].append({**deepcopy(body["snapshot"]["tenants"][0]["services"][1]), "id": BINDING})
        mounts = body["snapshot"]["apps"][0]["appRoutes"]
        mounts.append({**deepcopy(mounts[1]), "id": BINDING, "serviceId": BINDING})
    case("ambiguous-provider", route({"serviceId": "docs"}, "docs.index"), None, providers)
    case("element-ambiguous-provider", {"kind": "element", "reference": {"service": "docs", "path": "/content/:id", "fragment": "nav.profile"}},
         {"unavailable": "ambiguous_provider"}, providers)
    case("element-disabled", {"kind": "element", "reference": {"service": "docs", "path": "/content/:id", "fragment": "nav.profile"}},
         {"unavailable": "service_unavailable"}, lambda body: body["snapshot"]["apps"][0]["appRoutes"][1].update(enabled=False))
    case("element-params-required", {"kind": "element", "reference": {"service": "docs", "path": "/content/:id", "fragment": "nav.profile"}},
         {"unavailable": "path_params_required"}, lambda body: body["snapshot"]["apps"][0]["appRoutes"][1].update(fixedParams={}))
    case("element-shell-missing", {"kind": "element", "reference": {"service": "shell", "fragment": "branding"}}, {"unavailable": "shell_unavailable"},
         lambda body: body["snapshot"]["apps"][0]["shell"].update(serviceId=BINDING))
    for name, call, expected in (
        ("network-path", {"kind": "path", "path": "//untrusted.test/path"}, {"invalid": True}),
        ("absolute-path", {"kind": "path", "path": "https://untrusted.test/path"}, {"invalid": True}),
        ("backslash-path", {"kind": "path", "path": "/\\untrusted.test/path"}, {"invalid": True}),
        ("dot-param", route({"params": {"key": ".."}}), None),
        ("encoded-dot-path", {"kind": "path", "path": "/a/%2E%2E/b"}, {"invalid": True}),
        ("invalid-escape", {"kind": "path", "path": "/a/%no"}, {"invalid": True}),
        ("script-link", {"kind": "link", "url": "javascript:alert(1)"}, {"invalid": True}),
        ("credential-origin", route({"params": params, "absolute": True, "origin": "https://secret:password@app.test"}), None),
        ("invalid-query-shape", route({"params": params, "query": {"array": [1, 2]}}), {"invalid": True}),
        ("ambiguous-selectors", route({"params": params, "fragment": "nav.profile", "component": "card"}), {"invalid": True})):
        case(name, call, expected, native=True)
    case("sse-before-query", {"kind": "path", "path": "/x?q=value", "options": {"sse": True}}, "/x/__sse?q=value", native=True)
    for name, body, expected, native, handler, runtimes in cases:
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            if runtimes is not None and label not in runtimes: continue
            result = {"runtime": label, "id": "urls-" + name, "passed": False}
            try:
                try:
                    with urlopen(Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=10) as response:
                        actual = json.load(response)
                except HTTPError as error:
                    # SDKs can reject these addresses before the helper is reachable.
                    diagnostic = json.load(error)
                    if name not in ("credential-service", "non-http-service") or error.code != 500 or "Invalid url" not in diagnostic.get("error", ""): raise
                    result["passed"] = True
                    results.append(result)
                    continue
                assert actual["status"] == 200 and actual["invoked"] == 1, actual
                value = json.loads(actual["body"] if handler else "".join(Html(actual["body"]).text))
                assert value == expected, (expected, value)
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    for error in (False, True):
        for url, label in zip(urls, labels):
            if error and label == "node": continue
            result = {"runtime": label, "id": "urls-rewrite-error" if error else "urls-rewrite", "passed": False}
            try:
                body = fixture(); about = deepcopy(body["routes"][0]); about.update(viewId="about.index", path="/about")
                about["operations"] = [about["operations"][0]]; about["operations"][0]["declaration"]["operationId"] = "about.get"
                body["routes"].append(about)
                spec = body["routes"][0]["operations"][0]
                text = '<a href="{about.index}">About</a><form hx-post="{about.index}"></form><a href="{missing}">Unknown</a>'
                if error:
                    spec["throw"] = True
                    spec["errorRenderers"] = [{"declaration": {"renderer": "bootstrap5", "status": 500}, "text": text}]
                else: spec["renderers"][0]["text"] = text
                actual = post(url, body)
                assert actual["status"] == (500 if error else 200), actual
                assert actual["body"] == text.replace("{about.index}", "/about"), actual
                result["passed"] = True
            except Exception as exception: result["error"] = str(exception)
            results.append(result)
    for url, label in zip(urls, labels):
        if label == "node": continue
        result = {"runtime": label, "id": "urls-error-app-origin", "passed": False}
        try:
            body = fixture(); body["snapshot"]["apps"][0]["hostnames"].append("second.test")
            body["request"]["headers"]["origin"] = "https://second.test"
            spec = body["routes"][0]["operations"][0]; spec["throw"] = True
            spec["errorRenderers"] = [{"declaration": {"renderer": "bootstrap5", "status": 500}, "urlCalls": [route({"params": params, "absolute": True}, kind="uiRoute")]}]
            actual = post(url, body)
            assert actual["status"] == 500, actual
            assert json.loads("".join(Html(actual["body"]).text)) == ["https://second.test/app/item"], actual
            result["passed"] = True
        except Exception as exception: result["error"] = str(exception)
        results.append(result)
    return results
