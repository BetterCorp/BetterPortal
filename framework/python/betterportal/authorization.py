"""Host-independent BP user and delegated request authorization."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from .contracts import parse
from .security import KeyResolver, PermissionDenied, TokenError, TokenPurpose, _jwt_object, authorize_service, verify_token


class AuthUnavailable(TokenError):
    status = 503


@dataclass(frozen=True)
class AuthContext:
    """Trusted, resolved request scope and policy from one snapshot revision."""
    tenant_id: str
    app_id: str
    app_auth: Mapping[str, Any] | None = None
    key_resolver: KeyResolver | None = None
    service_policy: Mapping[str, Any] | None = None
    service_aliases: Mapping[str, str] = field(default_factory=dict)
    management_scope: tuple[str, str] | None = None


@dataclass(frozen=True)
class AuthorizedCaller:
    mode: str | None = None
    user: Mapping[str, Any] | None = None
    service: Mapping[str, Any] | None = None


async def authorize_user(token: str, requirement: Mapping[str, Any], context: AuthContext) -> dict[str, Any]:
    """Verify an access credential and expand its role IDs through current app policy."""
    if context.app_auth is None or context.key_resolver is None:
        raise AuthUnavailable("User authentication context unavailable")
    policy = parse("AppAuthConfigSchema", dict(context.app_auth))
    required = parse("ApiAuthRequirementSchema", dict(requirement))
    aliases = dict(context.service_aliases)
    roles = policy["roles"]
    if len({role["id"] for role in roles}) != len(roles):
        raise AuthUnavailable("Ambiguous role configuration")
    claims = await verify_token(token, context.key_resolver, issuer=policy["expectedIssuer"],
                                audience=policy["expectedAudience"], purpose=TokenPurpose.ACCESS)
    if (claims["tenantId"], claims["appId"]) != (context.tenant_id, context.app_id):
        raise TokenError("User token tenant or app mismatch")
    if "*" in claims["roles"] and context.management_scope == (context.tenant_id, context.app_id):
        return claims
    grants = [grant for role in roles if role["id"] in claims["roles"] for grant in role["permissions"]]
    def matches(granted: str, requested: str) -> bool:
        return granted == requested or aliases.get(granted) == requested or aliases.get(requested) == granted
    if not all(any(matches(grant["serviceId"], item["serviceId"]) and grant["viewId"] == item["viewId"] and action in grant["permissions"]
                   for grant in grants) for item in required["permissions"] for action in item["permissions"]):
        raise PermissionDenied("Insufficient user permissions")
    return claims


def _bearer(value: str | None) -> str | None:
    if value is None:
        return None
    scheme, separator, token = value.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token or len(token) > 32768 or any(char.isspace() for char in token):
        raise TokenError("Invalid bearer credential")
    return token


def _service_token(token: str) -> bool:
    try:
        return _jwt_object(token.split(".")[0]).get("typ") == "BP-S2S-JWT"
    except (ValueError, TypeError, KeyError):
        return False


async def authorize_request(headers: Mapping[str, str], requirement: Mapping[str, Any], context: AuthContext,
                            *, view_id: str, method: str) -> AuthorizedCaller:
    """Complete caller policy. Machine envelopes always fail closed, even on optional-auth operations."""
    policy = parse("ApiAuthRequirementSchema", dict(requirement))
    normalized = {name.lower(): value for name, value in headers.items()}
    if len(normalized) != len(headers):
        raise TokenError("Duplicate request headers")
    machine = any(name in normalized for name in ("x-bp-service-id", "x-bp-service-authorization"))
    try:
        primary = _bearer(normalized.get("authorization"))
        delegated = "x-bp-service-authorization" in normalized
        service = primary is not None and _service_token(primary)
        machine |= delegated or service
        if primary is None:
            raise TokenError("Authentication required")
        mode = "delegated" if delegated else "service" if service else "user"
        if machine and (mode == "user" or any(not normalized.get(name) for name in ("x-bp-service-id", "x-bp-tenant-id", "x-bp-app-id"))):
            raise TokenError("Incomplete service envelope")
        if mode not in policy["callers"]:
            raise PermissionDenied("Caller mode is not allowed")
        if not machine:
            return AuthorizedCaller("user", await authorize_user(primary, policy, context))
        if (normalized["x-bp-tenant-id"], normalized["x-bp-app-id"]) != (context.tenant_id, context.app_id):
            raise TokenError("Service headers do not match resolved scope")
        if context.service_policy is None:
            raise AuthUnavailable("Service authentication context unavailable")
        secondary = _bearer(normalized.get("x-bp-service-authorization"))
        if delegated and (secondary is None or service):
            raise TokenError("Delegated calls require user and service credentials")
        user = await authorize_user(primary, policy, context) if delegated else None
        credential = secondary if delegated else primary
        if credential is None:
            raise TokenError("Service credential required")
        caller = await authorize_service(credential, context.service_policy,
            source_service_id=normalized["x-bp-service-id"], tenant_id=context.tenant_id, app_id=context.app_id,
            view_id=view_id, method=method, mode=mode,
            required_permissions=tuple(action for item in policy["permissions"] for action in item["permissions"]))
        return AuthorizedCaller(mode, user, caller["claims"])
    except TokenError:
        if policy["required"] or machine:
            raise
        return AuthorizedCaller()
