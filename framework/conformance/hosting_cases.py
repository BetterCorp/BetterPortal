"""Consumer hosts: Starlette ASGI, ASP.NET Core HTTP and the existing Node H3 adapter."""
from copy import deepcopy
import json
import base64
from pathlib import Path
from access_cases import fixture as access_fixture
from key_cases import peer
from security_cases import post, TENANT, APP, SOURCE, TARGET, ISSUER, AUDIENCE, fixtures, verification


def fixture():
    directory = Path(__file__).with_name("contracts")
    value = json.loads((directory / "JsonValueSchema.json").read_text())
    return {"action": "hosting", "snapshot": access_fixture()["snapshot"],
        "declaration": {"pluginId": "com.example.service", "title": "Host", "description": "Host service", "version": "1.0.0"},
        "operationDocument": (directory / "OperationDeclarationSchema.json").read_text(),
        "routes": [{"viewId": "check", "path": "/check/:key", "operations": [{"declaration": {
            "operationId": "check." + method.lower(), "method": method, "title": method, "description": "Check", "auth": {}}, "response": value}
            for method in ("GET", "POST")]}],
        "request": {"method": "GET", "path": "/check/item?hello=world", "headers": {"origin": "https://app.test", "accept": "application/json"}}}


def run_hosting(urls, labels):
    results = []
    def check(label, name, action):
        result = {"runtime": label, "id": "hosting-" + name, "passed": False}
        try: action(); result["passed"] = True
        except Exception as error: result["error"] = str(error)
        results.append(result)
    def app(body): return body["snapshot"]["apps"][0]
    def mounted(body): return app(body)["routes"][0]
    def write(body, data='{"hello":"world"}', media="application/json"):
        body["request"].update(method="POST", body=data)
        body["request"]["headers"]["content-type"] = media
        mounted(body)["operations"] = ["check.get", "check.post"]
    def validate(actual, status=200, invoked=None, expected=None):
        assert actual["status"] == status, actual
        if invoked is not None: assert actual["invoked"] == invoked, actual
        if expected is not None: assert json.loads(actual["body"]) == expected, actual
    baseline = {"params": {"key": "item"}, "query": {"hello": "world"}, "request": {}, "multipart": None,
                "tenantId": TENANT, "appId": APP, "caller": None, "user": None}
    cases = []
    def case(name, change=lambda body: None, status=200, invoked=None, expected=None, native=False):
        body = fixture(); change(body)
        cases.append((name, body, status, invoked, expected, native))
    case("json-get", invoked=1, expected=baseline)
    case("json-post", write, invoked=1, expected={**baseline, "request": {"hello": "world"}})
    case("wrong-operation", lambda body: body["request"].update(method="POST"), 404, 0)
    case("disabled-mount", lambda body: mounted(body).update(enabled=False), 404, 0)
    case("metadata", lambda body: body["request"]["headers"].update(accept="application/vnd.betterportal.metadata+json"))
    for method in ("GET", "POST"):
        for title, description in (("View title", "View description"), ("View title", None), (None, None), (None, "View description")):
            def metadata(body, method=method, title=title, description=description):
                body["request"].update(method=method)
                body["request"]["headers"]["accept"] = "application/vnd.betterportal.metadata+json"
                mounted(body)["operations"] = ["check.get", "check.post"]
                if title is not None: body["routes"][0]["title"] = title
                if description is not None: body["routes"][0]["description"] = description
            case(f"metadata-override-{method}-{title}-{description}", metadata)
    case("metadata-no-get", lambda body: (metadata(body, "POST", None, None), body["routes"][0]["operations"].pop(0)))
    def metadata_without_get(body):
        metadata(body, "PUT", None, None); body["routes"][0]["operations"].pop(0)
        operation = deepcopy(body["routes"][0]["operations"][0])
        operation["declaration"].update(method="PUT", operationId="check.put", title="PUT", description="Update")
        body["routes"][0]["operations"].append(operation)
        mounted(body)["operations"].append("check.put")
    case("metadata-no-get-secondary-operation", metadata_without_get)
    for encoded, decoded in (("a%2Fb", "a/b"), ("a%252Fb", "a%2Fb"), ("%E9%9B%AA%2f%25", "\u96ea/%")):
        case("encoded-segment-" + encoded, lambda body, encoded=encoded: body["request"].update(path="/check/" + encoded + "?hello=world"),
             invoked=1, expected={**baseline, "params": {"key": decoded}})
    case("preflight", lambda body: (body["request"].update(method="OPTIONS"), body["request"]["headers"].update({"access-control-request-method": "GET"})), 204, 0)
    case("urlencoded", lambda body: write(body, "hello=world", "application/x-www-form-urlencoded"), expected={**baseline, "request": {"hello": "world"}, "multipart": {"fields": {"hello": "world"}, "files": {}}})
    multipart = '--bp\r\nContent-Disposition: form-data; name="hello"\r\n\r\nworld\r\n--bp\r\nContent-Disposition: form-data; name="upload"; filename="hello.txt"\r\nContent-Type: text/plain\r\n\r\nHi\r\n--bp--\r\n'
    upload = {"fieldName": "upload", "filename": "hello.txt", "contentType": "text/plain", "size": 2, "data": [72, 105]}
    case("multipart", lambda body: write(body, multipart, "multipart/form-data; boundary=bp"), expected={**baseline, "request": {"hello": "world", "upload": "hello.txt"}, "multipart": {"fields": {"hello": "world"}, "files": {"upload": upload}}})
    case("health", lambda body: body["request"].update(path="/.well-known/bp/health"), invoked=0, expected={"ok": True})
    case("manifest", lambda body: body["request"].update(path="/.well-known/bp/manifest"), invoked=0)
    case("schema", lambda body: body["request"].update(path="/.well-known/bp/schema.json"), invoked=0)
    case("json-null", lambda body: (write(body, "null"), body["routes"][0]["operations"][1].update(schemas={"request": body["routes"][0]["operations"][1]["response"]})), expected={**baseline, "request": None}, native=True)
    case("json-array", lambda body: (write(body, "[null,true]"), body["routes"][0]["operations"][1].update(schemas={"request": body["routes"][0]["operations"][1]["response"]})), expected={**baseline, "request": [None, True]}, native=True)
    case("malformed-json", lambda body: write(body, "{"), 400, 0, native=True)
    case("duplicate-json-member", lambda body: write(body, '{"x":1,"x":2}'), 400, 0, native=True)
    case("deep-json", lambda body: write(body, '[' * 2000 + '0' + ']' * 2000), 400, 0, native=True)
    case("nonfinite-json", lambda body: write(body, '{"x":NaN}'), 400, 0, native=True)
    case("unsupported-body", lambda body: write(body, "Hello", "text/plain"), 415, 0, native=True)
    case("body-limit", lambda body: (write(body), body.update(maxBodyBytes=4)), 413, 0, native=True)
    case("unacceptable", lambda body: body["request"]["headers"].update(accept="image/png"), 406, 0, native=True)
    case("no-renderer", lambda body: body["request"]["headers"].update(accept="text/html"), 406, 0, native=True)
    case("query-repeated", lambda body: body["request"].update(path="/check/item?hello=a&hello=b"), expected={**baseline, "query": {"hello": ["a", "b"]}}, native=True)
    case("query-case", lambda body: body["request"].update(path="/check/item?Name=a&name=b"), expected={**baseline, "query": {"Name": "a", "name": "b"}}, native=True)
    case("form-repeated", lambda body: write(body, "hello=a&hello=b", "application/x-www-form-urlencoded"), expected={**baseline, "request": {"hello": ["a", "b"]}, "multipart": {"fields": {"hello": ["a", "b"]}, "files": {}}}, native=True)
    case("form-case", lambda body: write(body, "Name=a&name=b", "application/x-www-form-urlencoded"), expected={**baseline, "request": {"Name": "a", "name": "b"}, "multipart": {"fields": {"Name": "a", "name": "b"}, "files": {}}}, native=True)
    case("malformed-form", lambda body: write(body, "invalid", "multipart/form-data"), 400, 0, native=True)
    case("not-ready-health", lambda body: (body.update(snapshot=None), body["request"].update(path="/.well-known/bp/health")), 503, 0, {"ok": False}, True)
    case("not-ready-operation", lambda body: body.update(snapshot=None), 503, 0, native=True)
    case("closed-operation", lambda body: body.update(closed=True), 503, 0, native=True)
    case("other-instance-mount", lambda body: mounted(body).update(serviceId=SOURCE), 404, 0, native=True)
    case("wrong-origin", lambda body: body["request"]["headers"].update(origin="https://wrong.test", host="app.test"), 403, 0, native=True)
    case("preflight-denied-method", lambda body: (body["request"].update(method="OPTIONS"), body["request"]["headers"].update({"access-control-request-method": "POST"})), 403, 0, native=True)
    case("handler-error", lambda body: body["routes"][0]["operations"][0].update(throw=True), 500, 1, {"error": "Request failed"}, True)
    case("invalid-response", lambda body: body["routes"][0]["operations"][0].update(response={**body["routes"][0]["operations"][0]["response"], "root": {"kind": "bool"}}), 500, 1, {"error": "Request failed"}, True)
    def split_methods(body):
        write(body)
        operation = body["routes"][0]["operations"].pop()
        operation["declaration"]["operationId"] = "other.post"
        body["routes"].append({"viewId": "other", "path": "/check/:other", "operations": [operation]})
        app(body)["routes"].append({**deepcopy(mounted(body)), "id": SOURCE, "viewId": "other", "operations": ["other.post"], "resolvedServicePath": "/check/:other"})
    case("same-path-different-methods", split_methods, expected={**baseline, "params": {"other": "item"}, "request": {"hello": "world"}})
    case("same-path-method-preflight", lambda body: (split_methods(body), body["request"].update(method="OPTIONS"), body["request"]["headers"].update({"access-control-request-method": "POST"})), 204, 0)
    def static(body):
        operation = deepcopy(body["routes"][0]["operations"][0]); operation["declaration"]["operationId"] = "static.get"; operation["result"] = {"static": True}
        body["routes"].append({"viewId": "static", "path": "/check/special", "operations": [operation]})
        app(body)["routes"].append({**deepcopy(mounted(body)), "id": SOURCE, "viewId": "static", "operations": ["static.get"], "resolvedServicePath": "/check/special"})
        body["request"]["path"] = "/check/special"
    case("static-route-priority", static, expected={"static": True})
    def intersecting(body, reverse=False):
        static(body)
        body["routes"][0]["path"] = "/:section/special"
        body["routes"][1]["path"] = "/check/:id"
        for mount, route in zip(app(body)["routes"], body["routes"]): mount["resolvedServicePath"] = route["path"]
        if reverse: body["routes"].reverse()
    case("intersecting-route-priority", intersecting, expected={"static": True})
    case("intersecting-route-priority-reversed", lambda body: intersecting(body, True), expected={"static": True})
    def options(body, allowed=True, required=False):
        operation = deepcopy(body["routes"][0]["operations"][0])
        operation["declaration"].update(operationId="check.options", method="OPTIONS", auth={"required": required})
        operation["result"] = {"options": True}
        body["routes"][0]["operations"].append(operation)
        if allowed: mounted(body)["operations"].append("check.options")
        body["request"]["method"] = "OPTIONS"
    case("declared-options", options, invoked=1, expected={"options": True}, native=True)
    case("declared-options-denied", lambda body: options(body, False), 404, 0, native=True)
    case("declared-options-auth", lambda body: options(body, required=True), 401, 0, native=True)
    case("declared-options-preflight", lambda body: (options(body, required=True), body["request"]["headers"].update({"access-control-request-method": "GET"})), 204, 0, native=True)
    case("undeclared-options", lambda body: body["request"].update(method="OPTIONS"), 405, 0, native=True)
    nested_header = base64.urlsafe_b64encode(('{"nested":' + '[' * 2000 + '0' + ']' * 2000 + '}').encode()).decode().rstrip("=")
    for required in (False, True):
        case("deep-jwt-" + str(required), lambda body, required=required: (
            app(body).update(auth={"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": "http://127.0.0.1:1/keys", "roles": []}),
            body["routes"][0]["operations"][0]["declaration"].update(auth={"required": required}),
            body["request"]["headers"].update(authorization="Bearer " + nested_header + ".e30.AA")),
            401 if required else 200, 0 if required else 1, native=True)
    case("optional-path", lambda body: (body["routes"][0].update(pathVariants=["/check"]), mounted(body).update(resolvedServicePath="/check"), body["request"].update(path="/check?hello=world")), expected={**baseline, "params": {}})
    mixed = multipart.replace('name="hello"', 'name="upload"')
    case("mixed-field-file", lambda body: write(body, mixed, "multipart/form-data; boundary=bp"), expected={**baseline,
        "request": {"upload": ["world", "hello.txt"]}, "multipart": {"fields": {"upload": "world"}, "files": {"upload": upload}}}, native=True)
    case("unknown-path-json-error", lambda body: body["request"].update(path="/unknown"), 404, 0, {"error": "Route not found"}, True)
    case("unknown-method-json-error", lambda body: body["request"].update(method="DELETE"), 405, 0, {"error": "Method not allowed"}, True)
    case("query-invalid-utf8", lambda body: body["request"].update(path="/check/item?hello=%FF"), 400, 0, native=True)
    case("form-invalid-utf8", lambda body: write(body, "hello=%FF", "application/x-www-form-urlencoded"), 400, 0, native=True)
    case("form-invalid-raw-utf8", lambda body: (write(body, "", "application/x-www-form-urlencoded"), body["request"].update(bodyBase64="eD3/")), 400, 0, native=True)
    for encoded in ("%", "%2", "%ZZ"):
        for field in ("name", "value"):
            pairs = encoded + "=value" if field == "name" else "hello=" + encoded
            case("query-percent-" + field + "-" + encoded, lambda body, pairs=pairs: (body.update(rawTarget=True), body["request"].update(path="/check/item?" + pairs)), 400, 0, native=True)
            case("form-percent-" + field + "-" + encoded, lambda body, pairs=pairs: write(body, pairs, "application/x-www-form-urlencoded"), 400, 0, native=True)
    case("query-encoded-percent", lambda body: body["request"].update(path="/check/item?hello=%25ZZ"), expected={**baseline, "query": {"hello": "%ZZ"}}, native=True)
    case("form-encoded-percent", lambda body: write(body, "hello=%25ZZ", "application/x-www-form-urlencoded"), expected={**baseline, "request": {"hello": "%ZZ"}, "multipart": {"fields": {"hello": "%ZZ"}, "files": {}}}, native=True)
    case("duplicate-preflight-selector", lambda body: (body["request"].update(method="OPTIONS", path="/check/item?_f=a&_f=b"), body["request"]["headers"].update({"access-control-request-method": "GET"})), 400, 0, native=True)
    for name, body, status, invoked, expected, native in cases:
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            def action():
                actual = post(url, body)
                # Unmapped ASP.NET paths belong to the containing application.
                if label == "dotnet" and name == "unknown-path-json-error":
                    validate(actual, 404, 0); assert actual["body"] == "", actual
                else: validate(actual, status, invoked, expected)
                if name.startswith("metadata"):
                    value = json.loads(actual["body"])
                    method = body["request"]["method"]
                    assert value["operationId"] == "check." + method.lower() and value["method"] == method, actual
                    route = body["routes"][0]
                    primary = next((item for item in route["operations"] if item["declaration"]["method"] == "GET"), route["operations"][0])["declaration"]
                    assert value["title"] == route.get("title", primary["title"]) and value["description"] == route.get("description", primary["description"]), actual
                    if label != "node": assert actual["invoked"] == 0, actual
                if name == "manifest": assert json.loads(actual["body"])["views"][0]["viewId"] == "check", actual
                if name == "schema": assert json.loads(actual["body"])["manifest"]["pluginId"] == "com.example.service", actual
                if name == "json-get": assert actual["headers"]["access-control-allow-origin"] == "https://app.test", actual
            check(label, name, action)
    for url, label in zip(urls, labels):
        if label != "python": continue
        for mount in ("", "/prefix", "/caf\u00e9"):
            for encoded, decoded, raw in (("a%2Fb", "a/b", True), ("a%252Fb", "a%2Fb", True), ("%E9%9B%AA", "\u96ea", False)):
                def asgi_mount():
                    from urllib.parse import quote
                    body = fixture(); body.update(mount=mount, omitRawPath=not raw)
                    body["request"]["path"] = quote(mount) + "/%63heck/" + encoded + "?hello=world"
                    validate(post(url, body), invoked=1, expected={**baseline, "params": {"key": decoded}})
                check(label, f"asgi-mount-{mount}-{encoded}-{raw}", asgi_mount)
    for url, label in zip(urls, labels):
        if label != "dotnet": continue
        for encoded, decoded in (("a%2Fb", "a/b"), ("a%252Fb", "a%2Fb")):
            def trailing_slash():
                body = fixture(); body["request"]["path"] = "/check/" + encoded + "/?hello=world"
                validate(post(url, body), invoked=1, expected={**baseline, "params": {"key": decoded}})
            check(label, "encoded-trailing-slash-" + encoded, trailing_slash)
    for url, label in zip(urls, labels):
        if label != "dotnet": continue
        for placement in ("before", "after"):
            for status in (401, 404, 500):
                for method in ("GET", "DELETE"):
                    def unrelated():
                        body = fixture(); body["hostEndpoints"] = True
                        body["request"].update(method=method, path=f"/__host/{placement}/{status}")
                        actual = post(url, body)
                        validate(actual, status if method == "GET" else 405, 0)
                        assert actual["body"] == "" and "content-type" not in actual["headers"], actual
                    check(label, f"unrelated-{placement}-{status}-{method}", unrelated)
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    claims = fixtures()
    with peer() as (base, routes, counts, barriers):
        routes["/host-keys"] = [{"body": {"keys": [key["jwk"] for key in keys]}}]
        for signer, signer_label, key in zip(urls, labels, keys):
            user = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": claims["access"]})["token"]
            wrong_scope = post(signer, {"action": "jwt-sign", "purpose": "access", "claims": {**claims["access"], "tenantId": SOURCE}})["token"]
            refresh = post(signer, {"action": "jwt-sign", "purpose": "refresh", "claims": claims["refresh"]})["token"]
            machine = post(signer, {"action": "jwt-sign", "purpose": "service", "claims": claims["service"]})["token"]
            body = fixture()
            app(body)["auth"] = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": base + "/host-keys",
                "roles": [{"id": "reader", "title": "Reader", "permissions": [{"serviceId": TARGET, "viewId": "check", "permissions": ["read"]}]}]}
            body["routes"][0]["operations"][0]["declaration"]["auth"] = {"required": True, "callers": ["user", "service", "delegated"],
                "permissions": [{"serviceId": "com.example.service", "viewId": "check", "permissions": ["read"]}]}
            body["request"]["headers"]["authorization"] = "Bearer " + user
            variants = []
            def auth_case(name, change=lambda body: None, status=200, caller="user", native=False):
                value = deepcopy(body); change(value); variants.append((name, value, status, caller, native))
            auth_case("user")
            auth_case("user-wrong-scope", lambda body: body["request"]["headers"].update(authorization="Bearer " + wrong_scope), 401)
            auth_case("user-forged-scope-hints", lambda body: body["request"]["headers"].update({"x-bp-tenant-id": SOURCE, "x-bp-app-id": SOURCE}))
            auth_case("revoked-role", lambda body: app(body)["auth"].update(roles=[]), 403)
            auth_case("refresh-denied", lambda body: body["request"]["headers"].update(authorization="Bearer " + refresh), 401)
            auth_case("missing-credential", lambda body: body["request"]["headers"].pop("authorization"), 401)
            def service_api(value):
                value["routes"][0]["path"] = "/.well-known/bp/custom/:key"
                value["request"]["path"] = "/.well-known/bp/custom/item?hello=world"
                app(value)["routes"] = []
                value["routes"][0]["operations"][0]["declaration"]["auth"]["permissions"] = []
            # Protocol service APIs use operation auth independently of page mounts.
            auth_case("well-known-user", service_api)
            auth_case("well-known-missing-credential", lambda value: (service_api(value), value["request"]["headers"].pop("authorization")), 401)
            auth_case("well-known-wrong-scope", lambda value: (service_api(value), value["request"]["headers"].update(authorization="Bearer " + wrong_scope)), 401)
            auth_case("preflight-before-auth", lambda body: (body["request"].update(method="OPTIONS"), body["request"]["headers"].update({"authorization": "invalid", "access-control-request-method": "GET"})), 204)
            auth_case("other-instance-role-alias", lambda body: app(body)["auth"]["roles"][0]["permissions"][0].update(serviceId=SOURCE), 403, native=True)
            def service(body, delegated=False):
                policy = verification("service", claims["service"], machine, key)["service"]["policy"]
                policy["services"][0].update(publicKeyPem=key["publicKeyPem"], keyId=key["kid"])
                policy["bindings"][0].update(targetViewId="check", mode="delegated" if delegated else "service")
                body["snapshot"]["m2m"] = policy
                body["request"]["headers"].update({"x-bp-service-id": SOURCE, "x-bp-tenant-id": TENANT, "x-bp-app-id": APP,
                    "authorization": "Bearer " + (user if delegated else machine)})
                if delegated: body["request"]["headers"]["x-bp-service-authorization"] = "Bearer " + machine
            auth_case("machine", service, caller="service", native=True)
            auth_case("delegated", lambda body: service(body, True), caller="delegated", native=True)
            auth_case("delegated-user-revoked", lambda body: (service(body, True), app(body)["auth"].update(roles=[])), 403, native=True)
            auth_case("machine-grant-revoked", lambda body: (service(body), body["snapshot"]["m2m"]["grants"][0].update(enabled=False)), 403, native=True)
            auth_case("machine-wrong-scope", lambda body: (service(body), body["request"]["headers"].update({"x-bp-app-id": SOURCE})), 401, native=True)
            auth_case("partial-machine-optional-auth", lambda body: (body["routes"][0]["operations"][0]["declaration"]["auth"].update(required=False), body["request"]["headers"].update({"x-bp-service-id": SOURCE})), 401, native=True)
            auth_case("local-unmounted-role-alias", lambda body: (body["snapshot"].update(m2m={"localServiceIds": [TARGET, SOURCE], "services": [], "bindings": [], "grants": []}),
                app(body)["auth"]["roles"][0]["permissions"][0].update(serviceId=SOURCE)), 403, native=True)
            wrong_target = post(signer, {"action": "jwt-sign", "purpose": "service", "claims": {**claims["service"], "aud": SOURCE}})["token"]
            def wrong_local_target(body):
                service(body)
                body["snapshot"]["m2m"]["localServiceIds"] = [TARGET, SOURCE]
                body["snapshot"]["m2m"]["bindings"][0]["targetServiceId"] = SOURCE
                body["request"]["headers"]["authorization"] = "Bearer " + wrong_target
            auth_case("wrong-local-machine-target", wrong_local_target, 403, native=True)
            for name, request, status, caller, native in variants:
                for url, label in zip(urls, labels):
                    if native and label == "node": continue
                    def action():
                        actual = post(url, request)
                        validate(actual, status, 1 if status == 200 else 0)
                        if status == 200:
                            output = json.loads(actual["body"])
                            assert output["caller"] == caller and output["user"] == ("user-1" if caller in ("user", "delegated") else None), actual
                        elif status != 204 and label != "node" and name not in ("machine-wrong-scope", "partial-machine-optional-auth"):
                            assert actual["headers"].get("access-control-allow-origin") == "https://app.test", actual
                    check(signer_label + "->" + label, name, action)
    for url, label in zip(urls, labels):
        if label == "node": continue
        def cancel():
            body = fixture(); body["routes"][0]["operations"][0]["wait"] = True; body["cancel"] = True
            assert post(url, body) == {"cancelled": True, "invoked": 1}
        check(label, "cancellation", cancel)
    return results
