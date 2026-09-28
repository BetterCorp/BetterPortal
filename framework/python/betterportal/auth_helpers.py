"""External identity verification and safe native authentication presentation helpers."""
from __future__ import annotations

import math
from http.cookies import SimpleCookie
import re
from typing import Any, TYPE_CHECKING
from urllib.parse import urlsplit
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from .context import http_origin, _origins
from .keys import JwksClient
from .security import TokenError, PermissionDenied, _jwt_object, _KID
from .urls import _path
if TYPE_CHECKING:
    from .handler import RequestContext, ResponseState


class ExternalOidc:
    """Verify external RS256 claims. Applications explicitly map these to BP users."""
    def __init__(self, issuer: str, audience: str, jwks_uri: str, *, clock_tolerance: int = 30):
        if not issuer or not audience or not 0 <= clock_tolerance <= 300: raise ValueError('Invalid OIDC trust options')
        self.issuer, self.audience, self.clock_tolerance = issuer, audience, clock_tolerance
        self.keys = JwksClient(issuer, jwks_uri)

    async def verify(self, token: str, *, nonce: str | None = None) -> dict[str, Any]:
        try:
            if not isinstance(token, str) or not 0 < len(token) <= 16384: raise ValueError()
            parts = token.split('.')
            if len(parts) != 3: raise ValueError()
            header, claims = _jwt_object(parts[0]), _jwt_object(parts[1])
            if header.get('alg') != 'RS256' or header.get('typ', 'JWT') != 'JWT': raise ValueError()
            if any(name in header for name in ('jku', 'x5u', 'jwk', 'crit', 'b64')): raise ValueError()
            kid = header.get('kid')
            if not isinstance(kid, str) or not _KID.fullmatch(kid): raise ValueError()
            if not isinstance(claims.get('sub'), str) or not claims['sub']: raise ValueError()
            for name in ('exp', 'iat', 'nbf'):
                if name == 'exp' or name in claims:
                    value = claims.get(name)
                    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value): raise ValueError()
            if nonce is not None and claims.get('nonce') != nonce: raise ValueError()
            key = serialization.load_pem_public_key((await self.keys.resolve(kid)).encode())
            if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048: raise ValueError()
            return jwt.decode(token, key, algorithms=['RS256'], issuer=self.issuer, audience=self.audience,
                              leeway=self.clock_tolerance, options={'require': ['sub', 'exp', 'iss', 'aud']})
        except Exception: raise TokenError('External identity verification failed') from None

    async def aclose(self) -> None: await self.keys.aclose()
    async def __aenter__(self): return self
    async def __aexit__(self, *args): await self.aclose()


def auth_redirect(context: RequestContext, kind: str, requested: str | None = None) -> str:
    if kind not in ('afterLogin', 'afterLogout'): raise ValueError('Invalid auth redirect kind')
    def safe(value: str) -> str:
        if not value or any(ord(char) < 32 or ord(char) == 127 for char in value) or '\\' in value: raise ValueError('Invalid auth redirect')
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            allowed = {origin for host in context.scope.app['hostnames'] for origin in _origins(host)}
            if parsed.username is not None or parsed.password is not None or http_origin(value, allow_path=True) not in allowed:
                raise ValueError('Auth redirect is outside the current app')
        else:
            value = value if value.startswith('/') else '/' + value
            _path(value)
        return value
    if requested is not None: return safe(requested)
    target = context.scope.app.get('auth', {}).get('redirects', {}).get(kind)
    if target:
        result = context.urls.ui_route(target['viewId'], {'serviceId': target['serviceId']})
        if result is not None: return safe(result)
    return safe(context.scope.app.get('defaultRoute') or '/')


def auth_cookie(response: ResponseState, name: str, value: str, *, max_age: int, same_site: str = 'Lax') -> None:
    """Host-only Secure/HttpOnly cookie. max_age=0 expires the same cookie."""
    if not re.fullmatch(r'[A-Za-z0-9_!#$%&\'*+.^`|~-]{1,128}', name): raise ValueError('Invalid cookie name')
    if not isinstance(max_age, int) or isinstance(max_age, bool) or not 0 <= max_age <= 31536000: raise ValueError('Invalid cookie lifetime')
    if same_site not in ('Strict', 'Lax', 'None') or len(value) > 4096 or any(ord(char) < 32 or ord(char) > 126 for char in value): raise ValueError('Invalid cookie value or policy')
    cookie = SimpleCookie(); cookie[name] = value
    cookie[name]['path'] = '/'; cookie[name]['secure'] = True; cookie[name]['httponly'] = True
    cookie[name]['samesite'] = same_site; cookie[name]['max-age'] = max_age
    response.set_header('Set-Cookie', cookie[name].OutputString(), append=True)


def require_permission(context: RequestContext, service_id: str, view_id: str, action: str) -> str:
    """Resolve one enabled permission target and check the current user's role grants."""
    if context._retired is not None and context._retired.is_set(): raise PermissionDenied('Permission context was retired')
    if context.caller.user is None: raise PermissionDenied('User permission required')
    aliases = context.client_context._owner._service.registry.dependencies if context.client_context is not None else {}
    services = [service for service in context.scope.tenant['services'] if service['enabled']]
    def resolve(reference):
        reference = aliases.get(reference, reference)
        targets = [service['id'] for service in services if reference in (service['id'], service.get('serviceId'))]
        return targets[0] if len(targets) == 1 else None
    target = resolve(service_id)
    if target is None: raise PermissionDenied('Permission target is unavailable or ambiguous')
    roles = context.scope.app.get('auth', {}).get('roles', [])
    if not any(grant['viewId'] == view_id and action in grant['permissions'] and resolve(grant['serviceId']) == target
               for role in roles if role['id'] in context.caller.user['roles'] for grant in role['permissions']):
        raise PermissionDenied('Insufficient user permissions')
    return target
