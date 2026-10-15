"""External identities never confer BP scope; native response helpers reject injection."""
import asyncio
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
import jwt
from betterportal.auth_helpers import ExternalOidc, auth_cookie, auth_redirect, require_permission
from betterportal.handler import ResponseState, RequestContext
from betterportal.handler import Handler
from betterportal.asgi import create_app
from betterportal.registry import Registry, Route, Operation
from betterportal.rendering import Renderer
from betterportal.service import Service
import anyvali as av
from betterportal.authorization import AuthorizedCaller
from betterportal.context import ScopedConfig
from betterportal.security import KeyPair, TokenError, PermissionDenied
from hosting_cases import fixture
from security_cases import TENANT, APP, TARGET

async def main():
    key = KeyPair.generate()
    async with ExternalOidc('https://issuer.test', 'app', 'https://issuer.test/keys', clock_tolerance=0) as provider:
        await provider.keys._client.aclose()
        provider.keys._client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'keys': [key.public_jwk()]})))
        claims = {'iss': 'https://issuer.test', 'aud': 'app', 'sub': 'external-user', 'exp': int(time.time()) + 30, 'nonce': 'bound-nonce'}
        def token(changes={}, headers={}): return jwt.encode({**claims, **changes}, key.private_key, algorithm='RS256', headers={'kid': key.kid, **headers})
        assert (await provider.verify(token(), nonce='bound-nonce'))['sub'] == 'external-user'
        for value in (token({'aud': 'wrong'}), token({'exp': 1}), token({'exp': '123'}), token({}, {'jku': 'https://evil.test'}), token({}, {'typ': 'BP-S2S-JWT'})):
            try: await provider.verify(value)
            except TokenError: pass
            else: raise AssertionError('Untrusted external credential accepted')
        try: await provider.verify(token(), nonce='wrong')
        except TokenError: pass
        else: raise AssertionError('Nonce mismatch accepted')
    state = ResponseState()
    auth_cookie(state, '__Host-refresh', 'value', max_age=60)
    assert 'HttpOnly' in state.headers[0][1] and 'Secure' in state.headers[0][1] and 'Domain=' not in state.headers[0][1]
    state.bp_headers.set('Authorization', 'Bearer test', locked=True, scope_to_owner=True, expires_in_seconds=60)
    assert 'locked=true; scope=true; expires=' in state.headers[-1][1]
    state.bp_headers.remove('authorization')
    assert state.headers[-1] == ('BP-RemoveHeader', 'authorization')
    for value in ('bad\r\nvalue', 'value; locked=false', 'value,other=x'):
        try: state.bp_headers.set('Test', value)
        except ValueError: pass
        else: raise AssertionError('Directive injection accepted')
    source = fixture(); scope = ScopedConfig(source['snapshot']).by_id(TENANT, APP)
    context = RequestContext(scope, AuthorizedCaller(), 'GET', '/')
    assert auth_redirect(context, 'afterLogin', '/home?tab=1') == '/home?tab=1'
    for redirect in ('//evil.test', 'https://evil.test', '/\\evil.test', '/x\r\nLocation: x'):
        try: auth_redirect(context, 'afterLogin', redirect)
        except ValueError: pass
        else: raise AssertionError('Unsafe redirect accepted')
    scope.app['auth'] = {'roles': [{'id': 'reader', 'permissions': [{'serviceId': TARGET, 'viewId': 'check', 'permissions': ['read']}]}]}
    context = RequestContext(scope, AuthorizedCaller(user={'roles': ['reader']}), 'GET', '/')
    assert require_permission(context, TARGET, 'check', 'read') == TARGET
    for action in ('write', 'delete'):
        try: require_permission(context, TARGET, 'check', action)
        except PermissionDenied: pass
        else: raise AssertionError('Missing grant accepted')
    # A handler-level permission check is an HTTP authorization failure, not 500.
    def guarded(context):
        context.require_permission(TARGET, 'check', 'write')
        raise AssertionError('Unauthorized handler continued')
    denied = Renderer({'renderer': 'bootstrap5', 'status': 403}, lambda data, context: '<p>Access denied</p>')
    page = Renderer({'renderer': 'bootstrap5'}, lambda data, context: '<p>Allowed</p>')
    operation = Operation(Handler(av.string(), guarded, renderers=[page]), source['routes'][0]['operations'][0]['declaration'], error_renderers=[denied])
    registry = Registry([Route('check', '/check/:key', [operation])])
    source['snapshot']['apps'][0]['shell'] = {'serviceId': TARGET, 'service': 'example', 'renderer': 'bootstrap5'}
    async with Service(registry, source['declaration'], ScopedConfig(source['snapshot'])) as service:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)), base_url='http://service.test') as client:
            for accept in ('application/json', 'text/html'):
                response = await client.get('/check/item', headers={'origin': 'https://app.test', 'accept': accept})
                assert response.status_code == 403, (response.status_code, response.text)
                assert response.headers['access-control-allow-origin'] == 'https://app.test'
                assert response.headers['cache-control'] == 'no-store'
                assert response.json() == {'error': 'Access denied'} if accept == 'application/json' else response.text == '<p>Access denied</p>'
    print('Python auth helpers: OIDC trust/nonce, redirects, cookies, BP directives and permission targets passed')

asyncio.run(main())
