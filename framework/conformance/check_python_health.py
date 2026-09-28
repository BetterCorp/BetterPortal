"""Health diagnostics require a current, cryptographically verified management scope."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
from betterportal.asgi import create_app
from betterportal.context import ScopedConfig
from betterportal.security import TokenPurpose, sign_token
from betterportal.service import Service
from hosting_cases import fixture
from python_registry import build_registry
from python_security import KEY
from security_cases import APP, TENANT, SOURCE, TARGET, ISSUER, AUDIENCE, fixtures


async def main():
    source = fixture()
    snapshot = source['snapshot']
    snapshot['configManagement'] = {'adminTenantId': TENANT, 'managementAppId': APP}
    snapshot['apps'][0]['auth'] = {'serviceId': SOURCE, 'expectedIssuer': ISSUER, 'expectedAudience': AUDIENCE,
                                  'jwksUri': 'https://keys.test/jwks', 'roles': []}
    async with Service(build_registry(source), source['declaration'], ScopedConfig(snapshot)) as service:
        keys = next(iter(service._state.keys.values()))
        await keys._client.aclose()
        keys._client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request:
            httpx.Response(200, json={'keys': [KEY.public_jwk()]})))
        app = create_app(service)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://service.test') as client:
            async def health(token=None):
                response = await client.get('/.well-known/bp/health', headers={'authorization': 'Bearer ' + token} if token else {})
                assert response.status_code == 200
                assert response.headers['cache-control'] == 'private, no-store'
                assert response.headers['vary'] == 'Authorization'
                return response.json()
            assert await health() == {'ok': True}
            assert await health('invalid') == {'ok': True}
            claims = fixtures()['access']
            result = await health(sign_token(KEY, claims, TokenPurpose.ACCESS))
            assert result['pluginId'] == source['declaration']['pluginId'] and result['ready']
            for replacement in ({'appId': TARGET}, {'tenantId': TARGET}, {'iat': 1, 'exp': 2}):
                assert await health(sign_token(KEY, {**claims, **replacement}, TokenPurpose.ACCESS)) == {'ok': True}
            assert await health(sign_token(KEY, fixtures()['refresh'], TokenPurpose.REFRESH)) == {'ok': True}
            changed = deepcopy(snapshot)
            changed['configManagement']['managementAppId'] = TARGET
            await service.apply_snapshot(changed)
            assert await health(sign_token(KEY, claims, TokenPurpose.ACCESS)) == {'ok': True}
    print('Python health: management JWT, wrong scope/purpose, invalid credentials, revocation and cache policy passed')

asyncio.run(main())
