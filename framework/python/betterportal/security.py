"""BP token purposes and trust policy; cryptographic operations use PyJWT/OpenSSL."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from functools import cached_property
import base64
import inspect
import json
import re
import secrets
import time
from typing import Any, Awaitable, Callable, Mapping
from uuid import UUID

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from .contracts import contract, parse

CONFIG_TICKET_AUDIENCE = "betterportal-service-config"
_KID = re.compile(r"[A-Za-z0-9_-]{1,256}\Z")
KeyResolver = Callable[[str], str | Awaitable[str]]


class TokenError(ValueError):
    """Authentication failed; callers may safely turn this into a 401 response."""
    status = 401


class PermissionDenied(TokenError):
    """Authenticated identity lacks a currently enabled permission."""
    status = 403


class TokenPurpose(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    SERVICE = "service"
    CONFIG_TICKET = "config-ticket"
    CP_ENVELOPE = "cp-envelope"
    SETUP = "setup"


_CONTRACTS = {
    TokenPurpose.ACCESS: "JwtClaimsSchema",
    TokenPurpose.REFRESH: "JwtClaimsSchema",
    TokenPurpose.SERVICE: "ServiceTokenClaimsSchema",
    TokenPurpose.CONFIG_TICKET: "ServiceConfigTicketClaimsSchema",
    TokenPurpose.CP_ENVELOPE: "CpEnvelopeClaimsSchema",
    TokenPurpose.SETUP: "SetupTokenClaimsSchema",
}


def uuid7() -> str:
    """UUIDv7 on Python 3.10+, using the standard library's CSPRNG."""
    random = secrets.randbits(74)
    value = ((time.time_ns() // 1_000_000) << 80) | (7 << 76)
    value |= ((random >> 62) << 64) | (2 << 62) | (random & ((1 << 62) - 1))
    return str(UUID(int=value))


@dataclass(frozen=True)
class KeyPair:
    private_key_pem: str = field(repr=False)
    kid: str

    def __post_init__(self) -> None:
        if not _KID.fullmatch(self.kid):
            raise ValueError("Invalid signing key ID")
        self.private_key  # Validate imported keys before they become usable.

    @cached_property
    def private_key(self) -> rsa.RSAPrivateKey:
        key = serialization.load_pem_private_key(self.private_key_pem.encode(), password=None)
        if not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 2048:
            raise ValueError("BP requires an RSA key of at least 2048 bits")
        return key

    @property
    def public_key_pem(self) -> str:
        return self.private_key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()

    @classmethod
    def generate(cls, kid: str | None = None, key_size: int = 2048) -> KeyPair:
        if key_size not in (2048, 3072, 4096):
            raise ValueError("RSA key size must be 2048, 3072 or 4096")
        key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
        modulus = key.public_key().public_numbers().n.to_bytes(key_size // 8, "big")
        identifier = base64.urlsafe_b64encode(modulus).decode().rstrip("=")[:16]
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()).decode()
        return cls(pem, kid if kid is not None else identifier)

    def public_jwk(self) -> dict[str, Any]:
        numbers = self.private_key.public_key().public_numbers()
        encode = lambda n: base64.urlsafe_b64encode(n.to_bytes((n.bit_length() + 7) // 8, "big")).decode().rstrip("=")
        return parse("RsaPublicJwkSchema", {"kty": "RSA", "alg": "RS256", "use": "sig",
                                          "kid": self.kid, "n": encode(numbers.n), "e": encode(numbers.e)})


def _purpose_claims(claims: Mapping[str, Any], purpose: TokenPurpose) -> dict[str, Any]:
    parsed = parse(_CONTRACTS[purpose], dict(claims))
    if purpose != TokenPurpose.CONFIG_TICKET and parsed.get("tokenType") != purpose.value:
        raise TokenError("Token purpose mismatch")
    if parsed["exp"] <= parsed["iat"]:
        raise TokenError("Token expiration must follow issuance")
    if purpose == TokenPurpose.SERVICE:
        if parsed["exp"] - parsed["iat"] > 60 or parsed["sub"] != parsed["iss"]:
            raise TokenError("Invalid service token lifetime or subject")
    return parsed


def sign_token(key: KeyPair, claims: Mapping[str, Any], purpose: TokenPurpose) -> str:
    parsed = _purpose_claims(claims, purpose)
    return jwt.encode(parsed, key.private_key, algorithm="RS256", headers={
        "kid": key.kid, "typ": "BP-S2S-JWT" if purpose == TokenPurpose.SERVICE else "JWT"
    })


def _jwt_object(part: str) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", part):
        raise TokenError("Invalid JWT encoding")
    raw = base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))
    if base64.urlsafe_b64encode(raw).decode().rstrip("=") != part:
        raise TokenError("Invalid JWT encoding")

    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise TokenError("Duplicate JWT member")
            result[key] = value
        return result

    def invalid_constant(value: str) -> None:
        raise TokenError("Invalid JSON number")

    value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique, parse_constant=invalid_constant)
    if not isinstance(value, dict):
        raise TokenError("JWT part must be an object")
    return value


async def verify_token(token: str, resolver: KeyResolver, *, issuer: str, audience: str | None,
                       purpose: TokenPurpose, clock_tolerance: int = 0) -> dict[str, Any]:
    if not issuer or (purpose != TokenPurpose.SETUP and not audience) or clock_tolerance < 0:
        raise ValueError("Issuer, audience and nonnegative clock tolerance are required")
    if not isinstance(token, str) or not token or len(token) > 32768:
        raise TokenError("Invalid token size")
    try:
        parts = token.split(".")
        if len(parts) != 3 or not re.fullmatch(r"[A-Za-z0-9_-]+", parts[2]):
            raise TokenError("Invalid JWT encoding")
        header = _jwt_object(parts[0])
        _jwt_object(parts[1])  # Reject duplicate claims before the library reads them.
        typ = "BP-S2S-JWT" if purpose == TokenPurpose.SERVICE else "JWT"
        if header.get("alg") != "RS256" or header.get("typ") != typ:
            raise TokenError("Invalid token algorithm or header type")
        if any(field in header for field in ("jku", "x5u", "jwk", "crit", "b64")):
            raise TokenError("Unsupported token header")
        kid = header.get("kid")
        if not isinstance(kid, str) or not _KID.fullmatch(kid):
            raise TokenError("Invalid token key ID")
        pem = resolver(kid)
        if inspect.isawaitable(pem):
            pem = await pem
        key = serialization.load_pem_public_key(pem.encode())
        if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048:
            raise TokenError("Untrusted signing key type or size")
        required = ["iss", "iat", "exp", "jti"] + (["aud"] if purpose != TokenPurpose.SETUP else [])
        claims = jwt.decode(token, key, algorithms=["RS256"], issuer=issuer, audience=audience,
                            leeway=clock_tolerance, options={"require": required, "verify_aud": audience is not None})
        return _purpose_claims(claims, purpose)
    except TokenError:
        raise
    except Exception as error:
        # Key lookup and parser errors must not disclose key material or token contents.
        raise TokenError("Token verification failed") from error


async def verify_config_ticket(token: str, resolver: KeyResolver, *, issuer: str, service_id: str,
                               tenant_id: str, action: str) -> dict[str, Any]:
    claims = await verify_token(token, resolver, issuer=issuer, audience=CONFIG_TICKET_AUDIENCE,
                                purpose=TokenPurpose.CONFIG_TICKET)
    if claims["serviceId"] != service_id or claims["tenantId"] != tenant_id or action not in claims["actions"]:
        raise TokenError("Config ticket scope or action mismatch")
    return claims


async def authorize_service(token: str, policy: Mapping[str, Any], *, source_service_id: str,
                            tenant_id: str, app_id: str, view_id: str, method: str, mode: str,
                            required_permissions: tuple[str, ...] = ()) -> dict[str, Any]:
    """Authorize a service envelope against the current scoped snapshot.

    Delegated mode checks the service half only; the host must also authorize its user token.
    """
    if mode not in ("service", "delegated"):
        raise ValueError("Invalid service caller mode")
    current = contract("ScopedServiceConfigSchema", "m2m").parse(dict(policy))
    if not isinstance(token, str) or not token or len(token) > 32768:
        raise TokenError("Invalid token size")
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise TokenError("Invalid JWT encoding")
        audience = _jwt_object(parts[1]).get("aud")
        if audience not in current["localServiceIds"]:
            raise TokenError("Service token targets another service")
    except (ValueError, KeyError, TypeError) as error:
        raise TokenError("Invalid service envelope") from error

    def resolve(kid: str) -> str:
        sources = [service for service in current["services"]
                   if service["id"] == source_service_id and service.get("keyId") == kid and service.get("publicKeyPem")]
        if len(sources) != 1:
            raise TokenError("Service signing key is not uniquely trusted")
        return sources[0]["publicKeyPem"]

    claims = await verify_token(token, resolve, issuer=source_service_id, audience=audience, purpose=TokenPurpose.SERVICE)
    if claims["tenantId"] != tenant_id or claims["appId"] != app_id:
        raise TokenError("Service token tenant or app mismatch")
    bindings = [binding for binding in current["bindings"] if binding["enabled"] and binding["id"] == claims["bindingId"]
                and binding["sourceServiceId"] == claims["iss"] and binding["targetServiceId"] == claims["aud"]
                and binding["mode"] == mode and binding["tenantId"] == tenant_id
                and ("appId" not in binding or binding["appId"] == app_id) and binding["targetViewId"] == view_id]
    if len(bindings) != 1:
        raise PermissionDenied("Service binding is unavailable or ambiguous")
    grants = [grant for grant in current["grants"] if grant["enabled"] and grant["bindingId"] == bindings[0]["id"]
              and grant["tenantId"] == tenant_id and ("appId" not in grant or grant["appId"] == app_id)
              and method in grant["methods"]]
    # One grant must cover the request; permissions from separate grants are not unioned.
    grant = next((grant for grant in grants if all(p in grant["permissions"] for p in required_permissions)), None)
    if grant is None:
        raise PermissionDenied("Service grant is unavailable or insufficient")
    return {"claims": claims, "permissions": grant["permissions"]}


@dataclass(frozen=True)
class TokenIssuer:
    key: KeyPair
    issuer: str
    audience: str
    access_seconds: int = 900
    refresh_seconds: int = 604800

    def issue_pair(self, user: Mapping[str, Any], *, include_refresh: bool = True) -> dict[str, Any]:
        if self.access_seconds < 1 or self.refresh_seconds < 1:
            raise ValueError("Token lifetimes must be positive")
        if include_refresh and (not user.get("authProvider") or not isinstance(user.get("refreshContext"), dict)):
            raise ValueError("Refresh tokens require authProvider and refreshContext")
        now, identifier = int(time.time()), uuid7()
        common = {**user, "iss": self.issuer, "aud": self.audience, "realm": "runtime", "iat": now, "jti": identifier}
        access = {**common, "tokenType": "access", "exp": now + self.access_seconds}
        access.pop("refreshContext", None)
        result = {"tokenId": identifier, "accessToken": sign_token(self.key, access, TokenPurpose.ACCESS),
                  "accessTokenExpiresInSeconds": self.access_seconds}
        if include_refresh:
            refresh = {**common, "roles": [], "tokenType": "refresh", "exp": now + self.refresh_seconds}
            result.update(refreshToken=sign_token(self.key, refresh, TokenPurpose.REFRESH),
                          refreshTokenExpiresInSeconds=self.refresh_seconds)
        return result

    async def verify_refresh(self, token: str, *, tenant_id: str, app_id: str) -> dict[str, Any]:
        def resolve(kid: str) -> str:
            if kid != self.key.kid:
                raise TokenError("Unknown signing key")
            return self.key.public_key_pem
        claims = await verify_token(token, resolve, issuer=self.issuer, audience=self.audience,
                                    purpose=TokenPurpose.REFRESH)
        if claims["tenantId"] != tenant_id or claims["appId"] != app_id:
            raise TokenError("Refresh token tenant or app mismatch")
        return claims
