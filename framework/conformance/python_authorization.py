"""Test-only entry point to native request authorization."""
import asyncio
from betterportal.authorization import AuthContext, authorize_request
from betterportal.security import TokenError


def authorization(body):
    context = body["context"]
    def resolve(kid):
        if kid != body["userKey"]["kid"]:
            raise TokenError("Unknown key")
        return body["userKey"]["publicKeyPem"]
    management = context.get("managementScope")
    trusted = AuthContext(context["tenantId"], context["appId"], context.get("appAuth"), resolve if body.get("userKey") else None,
                          context.get("servicePolicy"), context.get("serviceAliases", {}),
                          (management["tenantId"], management["appId"]) if management else None)
    try:
        caller = asyncio.run(authorize_request(body["headers"], body["requirement"], trusted, view_id=body["viewId"], method=body["method"]))
        return {"status": 200, "output": {"mode": caller.mode, "user": caller.user["sub"] if caller.user else None, "service": caller.service["iss"] if caller.service else None}}
    except TokenError as error:
        return {"status": error.status}
