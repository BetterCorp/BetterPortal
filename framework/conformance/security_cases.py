"""Language-neutral HTTP security checks. This runner uses only the standard library."""
from copy import deepcopy
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

TENANT = "01952200-0000-7000-8000-000000000001"
APP = "01952200-0000-7000-8000-000000000002"
SOURCE = "01952200-0000-7000-8000-000000000003"
TARGET = "01952200-0000-7000-8000-000000000004"
BINDING = "01952200-0000-7000-8000-000000000005"
ISSUER = "https://issuer.example.test"
AUDIENCE = "bp-test"


def post(url, body):
    try:
        with urlopen(Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=10) as response:
            return json.load(response)
    except HTTPError as error:
        raise AssertionError(f"HTTP {error.code}: {error.read().decode()[:300]}") from None


def fixtures():
    now = int(time.time())
    common = {"iss": ISSUER, "iat": now, "exp": now + 300, "jti": "conformance", "aud": AUDIENCE}
    user = {**common, "sub": "user-1", "realm": "runtime", "tenantId": TENANT, "appId": APP, "roles": ["reader"]}
    return {
        "access": {**user, "tokenType": "access"},
        "refresh": {**user, "roles": [], "tokenType": "refresh", "authProvider": SOURCE, "refreshContext": {"nested": [None, {"value": True}]}},
        "cp-envelope": {**common, "tokenType": "cp-envelope", "tenantId": TENANT, "appId": APP,
                        "cpId": "control-plane", "cpJwksUri": ISSUER + "/.well-known/jwks.json"},
        "setup": {**{k: v for k, v in common.items() if k != "aud"}, "tokenType": "setup", "instanceId": SOURCE,
                  "serviceUrl": "https://service.example.test", "cpUrl": ISSUER, "cpJwksUri": ISSUER + "/.well-known/jwks.json"},
        "config-ticket": {**common, "aud": ["betterportal-service-config"], "sub": "control-plane", "realm": "control-plane",
                          "tenantId": TENANT, "serviceId": TARGET, "actions": ["config.read"]},
        "service": {**common, "iss": SOURCE, "sub": SOURCE, "aud": TARGET, "exp": now + 60, "nbf": now,
                    "tokenType": "service", "tenantId": TENANT, "appId": APP, "bindingId": BINDING},
    }


def verification(purpose, claims, token, key):
    service = {"tenantId": TENANT, "appId": APP, "viewId": "read-item", "method": "GET", "mode": "service",
        "requiredPermissions": ["read"], "policy": {"localServiceIds": [TARGET], "services": [{"id": SOURCE, "hostname": "https://source.example.test"}], "bindings": [
            {"id": BINDING, "enabled": True, "sourceServiceId": SOURCE, "targetServiceId": TARGET, "mode": "service",
             "tenantId": TENANT, "appId": APP, "targetViewId": "read-item", "requestId": "read-item", "contractId": "read-item",
             "createdAt": "2026-09-01T00:00:00Z"}], "grants": [
            {"id": BINDING, "enabled": True, "bindingId": BINDING, "tenantId": TENANT, "appId": APP,
             "methods": ["GET"], "permissions": ["read"], "createdAt": "2026-09-01T00:00:00Z"}]}}
    audience = claims.get("aud")
    return {"action": "jwt-verify", "purpose": purpose, "token": token, **key, "issuer": claims["iss"],
            "audience": audience[0] if isinstance(audience, list) else audience,
            "scope": {"serviceId": TARGET, "tenantId": TENANT, "action": "config.read"}, "service": service}


def run_security(urls, labels):
    results = []

    def check(runtime, name, action):
        result = {"runtime": runtime, "id": name, "passed": False}
        try:
            action()
            result["passed"] = True
        except Exception as error:
            result["error"] = str(error)
        results.append(result)

    def expect(url, body, valid):
        result = post(url, body)
        assert result.get("valid") is valid, f"Expected valid={valid}, got {result}"
        return result.get("output")

    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    for signer, signing_url in enumerate(urls):
        cases = fixtures()
        for purpose, claims in cases.items():
            token = post(signing_url, {"action": "jwt-sign", "purpose": purpose, "claims": claims})["token"]
            body = verification(purpose, claims, token, keys[signer])
            for verifier, url in enumerate(urls):
                runtime = f"{labels[signer]}->{labels[verifier]}"
                def valid_case():
                    output = expect(url, body, True)
                    for name, value in claims.items():
                        if name not in ("iat", "exp", "nbf", "jti"):  # Node issuers supply current issuance times/UUIDs.
                            assert output[name] == value, (name, output[name], value)
                check(runtime, f"jwt-{purpose}", valid_case)
                broken = deepcopy(body)
                parts = token.split(".")
                parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
                broken["token"] = ".".join(parts)
                check(runtime, f"jwt-{purpose}-tamper", lambda: expect(url, broken, False))
                broken = {**body, "issuer": "https://untrusted.example.test"}
                check(runtime, f"jwt-{purpose}-issuer", lambda: expect(url, broken, False))
                broken = {**body, "kid": "untrusted-key"}
                check(runtime, f"jwt-{purpose}-key", lambda: expect(url, broken, False))
                if purpose not in ("config-ticket", "service", "setup"):
                    broken = {**body, "audience": "another-service"}
                    check(runtime, f"jwt-{purpose}-audience", lambda: expect(url, broken, False))
                if purpose == "config-ticket":
                    for field, value in (("serviceId", SOURCE), ("tenantId", APP), ("action", "config.write")):
                        broken = {**body, "scope": {**body["scope"], field: value}}
                        check(runtime, f"ticket-{field}", lambda: expect(url, broken, False))
                if purpose == "service":
                    for field, value in (("tenantId", APP), ("appId", TENANT), ("viewId", "write-item"), ("method", "POST"),
                                         ("mode", "delegated"), ("requiredPermissions", ["write"])):
                        broken = deepcopy(body)
                        broken["service"][field] = value
                        check(runtime, f"service-{field}", lambda: expect(url, broken, False))
                    for collection in ("bindings", "grants"):
                        broken = deepcopy(body)
                        broken["service"]["policy"][collection][0]["enabled"] = False
                        check(runtime, f"service-revoked-{collection}", lambda: expect(url, broken, False))
                    broken = deepcopy(body)
                    broken["service"]["policy"]["localServiceIds"] = [SOURCE]
                    check(runtime, "service-wrong-local-target", lambda: expect(url, broken, False))
        # Signed adversarial claims exercise policy, rather than merely breaking the signature.
        access = cases["access"]
        invalid = {
            "expired": {**access, "iat": access["iat"] - 120, "exp": access["iat"] - 60},
            "not-yet-valid": {**access, "nbf": access["iat"] + 120},
            "missing-exp": {k: v for k, v in access.items() if k != "exp"},
            "missing-iat": {k: v for k, v in access.items() if k != "iat"},
            "wrong-purpose": {**access, "tokenType": "refresh"},
            "invalid-tenant": {**access, "tenantId": "tenant"},
            "invalid-role": {**access, "roles": [""]},
        }
        for name, claims in invalid.items():
            token = post(signing_url, {"action": "jwt-raw", "purpose": "access", "claims": claims})["token"]
            for verifier, url in enumerate(urls):
                body = verification("access", access, token, keys[signer])
                check(f"{labels[signer]}->{labels[verifier]}", "jwt-" + name, lambda: expect(url, body, False))
        for header in ({"jku": "https://attacker.example/jwks"}, {"x5u": "https://attacker.example/cert"}, {"typ": "BP-S2S-JWT"}, {"kid": "../key"}):
            token = post(signing_url, {"action": "jwt-raw", "purpose": "access", "claims": access, "header": header})["token"]
            for verifier, url in enumerate(urls):
                body = verification("access", access, token, keys[signer])
                check(f"{labels[signer]}->{labels[verifier]}", "jwt-header-" + next(iter(header)), lambda: expect(url, body, False))
        user = {"sub": "user-1", "tenantId": TENANT, "appId": APP, "roles": ["reader"], "authProvider": SOURCE,
                "refreshContext": {"value": [None, {"x": 1}]}}
        pair = post(signing_url, {"action": "jwt-pair", "issuer": ISSUER, "audience": AUDIENCE, "user": user})
        for verifier, url in enumerate(urls):
            def pair_case():
                access = expect(url, verification("access", cases["access"], pair["accessToken"], keys[signer]), True)
                refresh = expect(url, verification("refresh", cases["refresh"], pair["refreshToken"], keys[signer]), True)
                assert access["jti"] == refresh["jti"] == pair["tokenId"]
                assert "refreshContext" not in access and refresh["roles"] == []
                assert access["roles"] == ["reader"] and refresh["refreshContext"] == user["refreshContext"]
            check(f"{labels[signer]}->{labels[verifier]}", "jwt-refresh-pair", pair_case)
    return results
