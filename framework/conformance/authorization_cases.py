"""Current-role, scope, caller-mode and delegated policy through real Node/native entry points."""
from copy import deepcopy
from security_cases import post, fixtures, verification, TENANT, APP, SOURCE, TARGET, ISSUER, AUDIENCE


def run_authorization(urls, labels):
    results = []
    def check(label, name, url, request, status=200, mode="user"):
        try:
            actual = post(url, request)
            assert actual["status"] == status, actual
            if status == 200:
                assert actual["output"] == {"mode": mode, "user": "user-1" if mode in ("user", "delegated") else None,
                                            "service": SOURCE if mode in ("service", "delegated") else None}, actual
            results.append({"runtime": label, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": label, "id": name, "passed": False, "error": str(error)})
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    claims = fixtures()
    claims["access"]["roles"] = ["reader"]
    for index, (signer, signer_label, key) in enumerate(zip(urls, labels, keys)):
        service_index = (index + 1) % len(urls)
        service_key = keys[service_index]
        def sign(purpose, value):
            return post(signer, {"action": "jwt-sign", "purpose": purpose, "claims": value})["token"]
        access = sign("access", claims["access"])
        refresh = sign("refresh", claims["refresh"])
        refresh_request = {"action": "jwt-refresh-verify", "token": refresh, "issuer": ISSUER, "audience": AUDIENCE, "tenantId": TENANT, "appId": APP}
        for name, changes, valid in [("refresh-helper-valid", {}, True), ("refresh-helper-tenant", {"tenantId": SOURCE}, False),
                                     ("refresh-helper-app", {"appId": SOURCE}, False), ("refresh-helper-access", {"token": access}, False),
                                     ("refresh-helper-issuer", {"issuer": "https://wrong.example"}, False), ("refresh-helper-audience", {"audience": "other"}, False)]:
            try:
                actual = post(signer, {**refresh_request, **changes})
                assert actual["valid"] == valid and (not valid or actual["output"] == "user-1"), actual
                results.append({"runtime": signer_label, "id": name, "passed": True})
            except Exception as error:
                results.append({"runtime": signer_label, "id": name, "passed": False, "error": str(error)})
        service = post(urls[service_index], {"action": "jwt-sign", "purpose": "service", "claims": claims["service"]})["token"]
        app_auth = {"serviceId": SOURCE, "expectedIssuer": ISSUER, "expectedAudience": AUDIENCE, "jwksUri": ISSUER + "/jwks",
                    "roles": [{"id": "reader", "title": "Reader", "permissions": [{"serviceId": TARGET, "viewId": "read-item", "permissions": ["read"]}]}]}
        m2m = verification("service", claims["service"], service, service_key)["service"]["policy"]
        m2m["services"][0].update(keyId=service_key["kid"], publicKeyPem=service_key["publicKeyPem"])
        requirement = {"required": True, "callers": ["user", "service", "delegated"],
                       "permissions": [{"serviceId": "org.betterportal.test", "viewId": "read-item", "permissions": ["read"]}]}
        request = {"action": "auth-request", "headers": {"authorization": "Bearer " + access}, "requirement": requirement,
                   "userKey": key, "method": "GET", "viewId": "read-item", "context": {"tenantId": TENANT, "appId": APP,
                   "appAuth": app_auth, "servicePolicy": m2m, "serviceAliases": {TARGET: "org.betterportal.test"}}}
        machine_headers = {"x-bp-service-id": SOURCE, "x-bp-tenant-id": TENANT, "x-bp-app-id": APP}
        variants = [("current-role", request, 200, "user")]
        def variant(name, mutate, status=403, mode="user"):
            changed = deepcopy(request)
            mutate(changed)
            variants.append((name, changed, status, mode))
        variant("role-revoked", lambda item: item["context"]["appAuth"].update(roles=[]))
        variant("role-permissions-revoked", lambda item: item["context"]["appAuth"]["roles"][0].update(permissions=[]))
        variant("alias-revoked", lambda item: item["context"].update(serviceAliases={}))
        variant("user-scope-hints-not-authority", lambda item: item["headers"].update({"x-bp-app-id": SOURCE, "x-bp-tenant-id": TARGET}), 200)
        variant("wrong-view-grant", lambda item: item["context"]["appAuth"]["roles"][0]["permissions"][0].update(viewId="other"))
        variant("every-action-required", lambda item: item["requirement"]["permissions"][0].update(permissions=["read", "delete"]))
        variant("user-caller-denied", lambda item: item["requirement"].update(callers=["service"]))
        variant("no-credentials", lambda item: item.update(headers={}), 401)
        variant("verifier-unavailable", lambda item: item.pop("userKey"), 503)
        variant("auth-context-unavailable", lambda item: item["context"].pop("appAuth"), 503)
        variant("refresh-denied", lambda item: item["headers"].update(authorization="Bearer " + sign("refresh", claims["refresh"])), 401)
        for scope in ("tenantId", "appId"):
            variant("wrong-token-" + scope, lambda item: item["headers"].update(authorization="Bearer " + sign("access", {**claims["access"], scope: SOURCE})), 401)
        root = sign("access", {**claims["access"], "roles": ["*"]})
        variant("root-outside-management", lambda item: item["headers"].update(authorization="Bearer " + root))
        variant("root-wrong-management-app", lambda item: (item["headers"].update(authorization="Bearer " + root), item["context"].update(managementScope={"tenantId": TENANT, "appId": SOURCE})))
        variant("root-management", lambda item: (item["headers"].update(authorization="Bearer " + root), item["context"].update(managementScope={"tenantId": TENANT, "appId": APP})), 200)
        variant("optional-anonymous", lambda item: (item.update(headers={}), item["requirement"].update(required=False)), 200, None)
        variant("optional-invalid-user", lambda item: (item.update(headers={"authorization": "Bearer invalid"}), item["requirement"].update(required=False)), 200, None)
        variant("optional-insufficient-user", lambda item: (item["context"]["appAuth"].update(roles=[]), item["requirement"].update(required=False)), 200, None)
        variant("service-current-grant", lambda item: item.update(headers={**machine_headers, "authorization": "Bearer " + service}), 200, "service")
        variant("service-context-mismatch", lambda item: item.update(headers={**machine_headers, "x-bp-app-id": SOURCE, "authorization": "Bearer " + service}), 401)
        variant("service-method-revoked", lambda item: (item.update(headers={**machine_headers, "authorization": "Bearer " + service}), item.update(method="POST")))
        delegated = deepcopy(request)
        delegated["headers"].update(**machine_headers, **{"x-bp-service-authorization": "Bearer " + service})
        delegated["context"]["servicePolicy"]["bindings"][0]["mode"] = "delegated"
        variants.append(("delegated-both", delegated, 200, "delegated"))
        for name, change in [("delegated-user-revoked", lambda item: item["context"]["appAuth"].update(roles=[])),
                             ("delegated-binding-revoked", lambda item: item["context"]["servicePolicy"]["bindings"][0].update(enabled=False)),
                             ("delegated-grant-revoked", lambda item: item["context"]["servicePolicy"]["grants"][0].update(enabled=False)),
                             ("delegated-mode-denied", lambda item: item["requirement"].update(callers=["user", "service"]))]:
            changed = deepcopy(delegated)
            change(changed)
            variants.append((name, changed, 403, None))
        for target, target_label in zip(urls, labels):
            pair = signer_label + "->" + target_label
            for name, value, status, mode in variants:
                check(pair, name, target, value, status, mode)
            if target_label != "node":
                for name, headers in [("partial-envelope", {**request["headers"], "x-bp-service-id": SOURCE}),
                    ("delegated-without-user", {**machine_headers, "x-bp-service-authorization": "Bearer " + service}),
                    ("machine-without-scope", {"authorization": "Bearer " + service}),
                    ("malformed-secondary", {**machine_headers, **request["headers"], "x-bp-service-authorization": "invalid"})]:
                    changed = deepcopy(request)
                    changed.update(headers=headers)
                    changed["requirement"]["required"] = False
                    check(pair, "native-" + name, target, changed, 401)
                changed = deepcopy(delegated)
                changed["requirement"]["required"] = False
                changed["context"]["servicePolicy"]["grants"] = []
                check(pair, "native-optional-delegated-revoked", target, changed, 403)
                changed = deepcopy(request)
                changed["context"]["appAuth"]["roles"].append(deepcopy(app_auth["roles"][0]))
                check(pair, "native-ambiguous-roles", target, changed, 503)
    return results
