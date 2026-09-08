"""Scoped request addressing and origin policy through real Node/native helpers."""
from copy import deepcopy
from security_cases import post, TENANT, APP, SOURCE, TARGET, BINDING


def fixture():
    return {"managementOrigins": ["https://management.test"],
            "tenants": [{"id": tenant, "slug": str(index), "title": "Tenant", "services": []} for index, tenant in enumerate((TENANT, SOURCE))],
            "apps": [{"id": app, "tenantId": tenant, "slug": str(index), "title": "App", "hostnames": [host]}
                     for index, (app, tenant, host) in enumerate(((APP, TENANT, "a.test"), (TARGET, SOURCE, "b.test")))],
            "configApps": [{"id": BINDING, "tenantId": TENANT, "title": "Config only"}]}


def run_context(urls, labels):
    results = []
    a = {"tenantId": TENANT, "appId": APP, "renderer": None}
    b = {"tenantId": SOURCE, "appId": TARGET, "renderer": None}
    shared = [
        ("host", {"headers": {"host": "a.test"}}, a),
        ("origin-first", {"headers": {"host": "a.test", "origin": "https://b.test"}}, b),
        ("theme-host-first", {"mode": "theme", "headers": {"host": "a.test", "origin": "https://b.test"}}, a),
        ("referer-path", {"headers": {"referer": "https://b.test/orders?q=1", "host": "service.test"}}, b),
        ("inactive", {"inactive": True, "headers": {"host": "a.test"}}, None),
        ("unknown", {"headers": {"host": "service.test"}}, None),
        ("forged-proxy", {"headers": {"host": "service.test", "forwarded": "host=a.test", "x-forwarded-host": "a.test", "cf-original-host": "a.test"}}, None),
        ("forged-context", {"headers": {"host": "service.test", "hx-current-url": "https://a.test", "x-bp-tenant-id": TENANT, "x-bp-app-id": APP}}, None),
        ("scope-hints-ignored", {"headers": {"host": "a.test", "x-bp-tenant-id": SOURCE, "x-bp-app-id": TARGET}}, a),
        ("allowed-origin", {"headers": {"host": "a.test"}, "check": "https://a.test"}, {**a, "allowed": True}),
        ("denied-origin", {"headers": {"host": "a.test"}, "check": "https://b.test"}, {**a, "allowed": False}),
        ("origin-override", {"originOverride": "https://embed.test", "headers": {"host": "a.test"}, "check": "https://embed.test"}, {**a, "allowed": True}),
        ("null-active-rejected", {"nullActive": True}, "invalid"),
    ]
    native = [
        ("snapshot-copies", {"headers": {"host": "a.test"}, "mutate": True}, a),
        ("wrong-port", {"headers": {"host": "a.test:8443"}}, None),
        ("cross-default-port", {"scheme": "http", "headers": {"host": "a.test:443"}}, None),
        ("valid-default-port", {"headers": {"host": "a.test:443"}}, a),
        ("host-verified-proxy", {"headers": {"host": "service.test"}, "trustedAddresses": ["https://b.test"]}, b),
        ("bound-id", {"byId": [TENANT, APP]}, a),
        ("wrong-bound-id", {"byId": [SOURCE, APP]}, None),
        ("config-only-not-runtime", {"byId": [TENANT, BINDING]}, None),
        ("duplicate-app", {"duplicateApp": True}, "invalid"),
        ("duplicate-tenant", {"duplicateTenant": True}, "invalid"),
        ("orphan-app", {"orphan": True}, "invalid"),
        ("ambiguous-host", {"ambiguous": True}, "invalid"),
        ("distinct-port", {"ports": True, "headers": {"host": "shared.test:8444"}}, b),
        ("userinfo", {"headers": {"host": "evil@a.test"}}, None),
        ("encoded-host", {"headers": {"host": "%61.test"}}, None),
        ("origin-path", {"headers": {"origin": "https://a.test/path"}}, None),
        ("referer-same-origin", {"headers": {"host": "a.test"}, "check": "https://a.test/path?q=1", "referer": True}, {**a, "allowed": True}),
        ("referer-path-override", {"refererOverride": "https://embed.test/specific", "headers": {"host": "a.test"}, "check": "https://embed.test/specific", "referer": True}, {**a, "allowed": True}),
        ("referer-path-restricted", {"refererOverride": "https://embed.test/specific", "headers": {"host": "a.test"}, "check": "https://embed.test/other", "referer": True}, {**a, "allowed": False}),
    ]
    def check(label, name, url, body, expected):
        try:
            actual = post(url, body)
            assert actual == expected, actual
            results.append({"runtime": label, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": label, "id": name, "passed": False, "error": str(error)})
    for url, label in zip(urls, labels):
        for name, changes, output in shared + (native if label != "node" else []):
            snapshot = fixture()
            if changes.get("inactive"): snapshot["tenants"][0]["active"] = False
            if changes.get("nullActive"): snapshot["tenants"][0]["active"] = None
            if changes.get("originOverride"): snapshot["apps"][0]["originOverrides"] = [changes["originOverride"]]
            if changes.get("refererOverride"): snapshot["apps"][0]["refererOverrides"] = [changes["refererOverride"]]
            if changes.get("duplicateApp"): snapshot["apps"].append(deepcopy(snapshot["apps"][0]))
            if changes.get("duplicateTenant"): snapshot["tenants"].append(deepcopy(snapshot["tenants"][0]))
            if changes.get("orphan"): snapshot["apps"][0]["tenantId"] = BINDING
            if changes.get("ambiguous"): snapshot["apps"][1]["hostnames"] = ["https://A.test:443"]
            if changes.get("ports"):
                for index, app in enumerate(snapshot["apps"]): app["hostnames"] = [f"https://shared.test:{8443 + index}"]
            check(label, name, url, {"action": "context", "snapshot": snapshot, **changes},
                  {"status": 400} if output == "invalid" else {"status": 200, "output": output})
        if label != "node":
            for index, (value, output) in enumerate([
                ("HTTPS://Example.com:443", "https://example.com"), ("http://example.com:443", "http://example.com:443"),
                ("https://[0:0:0:0:0:0:0:1]:443", "https://[::1]"), ("https://café.test", "https://xn--caf-dma.test"),
                ("https://@example.com", None), ("https://%65xample.com", None), ("https://example.com?", None),
                ("https://example.com#", None), ("https://example.com/path", None), ("https://example.com:0", None),
                ("https://example.com/%2E", None),
                ("https://example.com\\evil", None), ("https://example.com\r\nInjected: yes", None),
            ]):
                check(label, f"http-origin-{index}", url, {"action": "http-origin", "value": value},
                      {"status": 400} if output is None else {"status": 200, "output": output})
    return results
