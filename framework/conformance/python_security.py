"""Test-only security actions; no signing endpoint belongs in a consumer host."""
import asyncio
import jwt
from python_keys import key_actions
from betterportal.security import KeyPair, TokenPurpose, TokenIssuer, TokenError, sign_token, verify_token, verify_config_ticket, authorize_service

KEY = KeyPair.generate()


def security(body):
    action = body["action"]
    if action.startswith("keys-"):
        return asyncio.run(key_actions(body))
    if action == "jwt-key":
        return {"publicKeyPem": KEY.public_key_pem, "kid": KEY.kid, "jwk": KEY.public_jwk()}
    if action == "jwt-pair":
        return TokenIssuer(KEY, body["issuer"], body["audience"]).issue_pair(body["user"])
    if action == "jwt-refresh-verify":
        try:
            claims = asyncio.run(TokenIssuer(KEY, body["issuer"], body["audience"]).verify_refresh(body["token"], tenant_id=body["tenantId"], app_id=body["appId"]))
            return {"valid": True, "output": claims["sub"]}
        except TokenError:
            return {"valid": False}
    purpose = TokenPurpose(body["purpose"])
    if action == "jwt-sign":
        return {"token": sign_token(KEY, body["claims"], purpose)}
    if action == "jwt-raw":
        header = {"typ": "BP-S2S-JWT" if purpose == TokenPurpose.SERVICE else "JWT", "kid": KEY.kid, **body.get("header", {})}
        return {"token": jwt.encode(body["claims"], KEY.private_key, algorithm="RS256", headers=header)}
    if action == "jwt-verify":
        def resolve(kid):
            if kid != body["kid"]:
                raise TokenError("Unknown signing key")
            return body["publicKeyPem"]
        try:
            if purpose == TokenPurpose.CONFIG_TICKET:
                scope = body["scope"]
                output = asyncio.run(verify_config_ticket(body["token"], resolve, issuer=body["issuer"],
                    service_id=scope["serviceId"], tenant_id=scope["tenantId"], action=scope["action"]))
            elif purpose == TokenPurpose.SERVICE:
                service = body["service"]
                policy = service["policy"]
                policy["services"] = [{**s, "keyId": body["kid"], "publicKeyPem": body["publicKeyPem"]} for s in policy["services"]]
                output = asyncio.run(authorize_service(body["token"], policy, source_service_id=body["issuer"],
                    tenant_id=service["tenantId"], app_id=service["appId"], view_id=service["viewId"], method=service["method"],
                    mode=service["mode"], required_permissions=tuple(service["requiredPermissions"])))["claims"]
            else:
                output = asyncio.run(verify_token(body["token"], resolve, issuer=body["issuer"],
                    audience=body.get("audience"), purpose=purpose))
            return {"valid": True, "output": output}
        except TokenError:
            return {"valid": False}
    raise ValueError("Unknown security action")
