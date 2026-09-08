"""Inbound operation mounts through Node's real H3 adapter and native BP policy."""
from copy import deepcopy
from security_cases import post, TENANT, APP, SOURCE, TARGET, BINDING


def fixture():
    return {"action": "access", "tenantId": TENANT, "appId": APP,
            "snapshot": {"serviceIdentity": {"id": TARGET}, "managementOrigins": [],
                "tenants": [{"id": TENANT, "slug": "tenant", "title": "Tenant", "services": [
                    {"id": identifier, "serviceId": "com.example.service", "hostname": "https://service.test", "createdAt": "2026-01-01T00:00:00Z"}
                    for identifier in (TARGET, SOURCE)]}],
                "apps": [{"id": APP, "tenantId": TENANT, "slug": "app", "title": "App", "hostnames": ["app.test"],
                    "routes": [{"id": BINDING, "path": "/app/:key", "serviceId": TARGET, "viewId": "check", "operations": ["check.get"], "resolvedServicePath": "/check/:key"}]}]}}


def run_access(urls, labels):
    cases, results = [], []
    def app(body): return body["snapshot"]["apps"][0]
    def mount(body): return app(body)["routes"][0]
    def case(name, change=lambda body: None, allowed=True, native=False, aliases=None):
        body = fixture(); change(body)
        cases.append((name, body, allowed, native, aliases))
    def clear(body): app(body)["routes"] = []
    def fragment(body, service=TARGET):
        clear(body); body["fragment"] = "menu.badge"
        app(body)["fragments"] = {"menu": [{"serviceId": service, "fragmentId": "badge", "targetPath": "/check/:key"}]}
    def slot(body, service=TARGET):
        clear(body); app(body)["slots"] = [{"slotId": "header", "serviceId": service, "viewId": "check"}]
    case("selected-operation", aliases={TARGET: "com.example.service"})
    case("unselected-method", lambda body: body.update(method="POST"), False)
    case("selected-post", lambda body: (body.update(method="POST"), mount(body).update(operations=["check.post"])))
    case("legacy-operation", lambda body: mount(body).update(operations=["legacy:check:GET"]))
    case("legacy-sibling-method", lambda body: mount(body).update(operations=["legacy:check:POST"]), False)
    case("unknown-operation", lambda body: mount(body).update(operations=["absent"]), False)
    case("different-view", lambda body: mount(body).update(viewId="other"), False)
    case("different-path", lambda body: mount(body).update(resolvedServicePath="/other/:key"), False)
    case("different-path-length", lambda body: mount(body).update(resolvedServicePath="/check"), False)
    case("renamed-parameter", lambda body: mount(body).update(resolvedServicePath="/check/:other"))
    case("path-trailing-slash", lambda body: mount(body).update(resolvedServicePath="/check/:key/"))
    case("path-variant", lambda body: (mount(body).pop("resolvedServicePath"), mount(body).update(servicePathVariant="/check/:key")))
    case("legacy-target-path", lambda body: (mount(body).pop("resolvedServicePath"), mount(body).update(targetPath="/check/:key")))
    case("resolved-path-priority", lambda body: mount(body).update(servicePathVariant="/other/:key", targetPath="/other/:key"))
    case("no-derived-path", lambda body: mount(body).pop("resolvedServicePath"))
    case("disabled-mount", lambda body: mount(body).update(enabled=False), False, aliases={})
    case("catalog-is-not-allowlist", lambda body: (app(body).update(appRoutes=deepcopy(app(body)["routes"])), clear(body)), False, aliases={})
    case("well-known-independent", lambda body: (clear(body), body.update(path="/.well-known/bp/check")))
    case("well-known-prefix-lookalike", lambda body: (clear(body), body.update(path="/.well-known-other/check")), False)
    case("fragment-mounted", fragment, aliases={TARGET: "com.example.service"})
    case("fragment-unqualified", lambda body: (fragment(body), body.update(fragment="badge")))
    case("fragment-wrong-location", lambda body: (fragment(body), body.update(fragment="footer.badge")), False)
    case("fragment-wrong-id", lambda body: (fragment(body), body.update(fragment="menu.other")), False)
    case("fragment-no-selector", lambda body: (fragment(body), body.pop("fragment")), False)
    case("fragment-post-denied", lambda body: (fragment(body), body.update(method="POST")), False)
    case("fragment-disabled", lambda body: (fragment(body), app(body)["fragments"]["menu"][0].update(enabled=False)), False, aliases={})
    case("fragment-wrong-path", lambda body: (fragment(body), app(body)["fragments"]["menu"][0].update(targetPath="/other")), False)
    case("fragment-catalog-denied", lambda body: (fragment(body), app(body).update(appFragments=app(body).pop("fragments"))), False, aliases={})
    case("slot-mounted", slot, aliases={TARGET: "com.example.service"})
    case("slot-post-denied", lambda body: (slot(body), body.update(method="POST")), False)
    case("slot-disabled", lambda body: (slot(body), app(body)["slots"][0].update(enabled=False)), False, aliases={})
    case("slot-wrong-view", lambda body: (slot(body), app(body)["slots"][0].update(viewId="other")), False)
    case("unmounted", clear, False, aliases={})
    case("inactive-tenant", lambda body: body["snapshot"]["tenants"][0].update(active=False), False, aliases={})
    case("wrong-app", lambda body: body.update(appId=SOURCE), False, aliases={})
    case("wrong-tenant", lambda body: body.update(tenantId=SOURCE), False, aliases={})
    # CP-provided local identities cannot be widened through a shared plugin ID.
    case("other-instance", lambda body: mount(body).update(serviceId=SOURCE), False, True, {})
    case("other-instance-fragment", lambda body: fragment(body, SOURCE), False, True, {})
    case("other-instance-slot", lambda body: slot(body, SOURCE), False, True, {})
    case("disabled-local-service", lambda body: body["snapshot"]["tenants"][0]["services"][0].update(enabled=False), False, True, {})
    case("unregistered-local-service", lambda body: body["snapshot"]["tenants"][0]["services"].pop(0), False, True, {})
    case("missing-local-identity", lambda body: body["snapshot"].pop("serviceIdentity"), False, True, {})
    def m2m(body, identifiers): body["snapshot"]["m2m"] = {"localServiceIds": identifiers, "services": [], "bindings": [], "grants": []}
    case("m2m-local-identity", lambda body: (body["snapshot"].pop("serviceIdentity"), m2m(body, [TARGET])), True, True, {TARGET: "com.example.service"})
    case("m2m-unmounted-alias", lambda body: m2m(body, [TARGET, SOURCE]), True, True, {TARGET: "com.example.service"})
    case("m2m-other-identity", lambda body: (body["snapshot"].pop("serviceIdentity"), m2m(body, [SOURCE])), False, True, {})
    case("method-not-registered", lambda body: body.update(method="DELETE"), False, True)
    case("encoded-mount-path", lambda body: mount(body).update(resolvedServicePath="/check/%2f"), False, True)
    for name, body, allowed, native, aliases in cases:
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            result = {"runtime": label, "id": "access-" + name, "passed": False}
            try:
                actual = post(url, body)
                assert actual["allowed"] is allowed, actual
                if label != "node" and aliases is not None: assert actual["aliases"] == aliases, actual
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    return results
