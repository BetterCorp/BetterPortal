from betterportal.context import ScopedConfig, http_origin


def context_request(body):
    try:
        if body["action"] == "http-origin":
            return {"status": 200, "output": http_origin(body["value"])}
        config = ScopedConfig(body["snapshot"])
        if body.get("mutate"):
            tenant, app = body["snapshot"]["tenants"][0]["id"], body["snapshot"]["apps"][0]["id"]
            body["snapshot"]["tenants"][0]["active"] = False
            config.document()["tenants"][0]["active"] = False
            config.by_id(tenant, app).tenant["active"] = False
        context = config.by_id(*body["byId"]) if "byId" in body else config.resolve(body.get("headers", {}),
            scheme=body.get("scheme", "https"), mode=body.get("mode", "service"), trusted_addresses=body.get("trustedAddresses", []))
        output = {"tenantId": context.tenant_id, "appId": context.app_id, "renderer": context.app.get("shell", {}).get("renderer")} if context else None
        if output is not None and "check" in body:
            output["allowed"] = context.origin_policy.allows(body["check"], referer=body.get("referer", False))
        return {"status": 200, "output": output}
    except Exception:
        return {"status": 400}
