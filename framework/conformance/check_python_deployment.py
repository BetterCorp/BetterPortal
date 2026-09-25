"""Deployment trust boundary and public discovery data projection."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
from betterportal.asgi import create_app
from betterportal.bootstrap import BootstrapCipher
from betterportal.context import ScopedConfig
from betterportal.hosting import DeploymentConfig, TrustedProxyMiddleware
from betterportal.service import Service
from hosting_cases import fixture
from python_registry import build_registry
from security_cases import TARGET

async def main():
    key = BootstrapCipher.generate_key()
    config = DeploymentConfig.from_env({'BP_CP_URL': 'https://cp.test', 'BP_PUBLIC_ORIGIN': 'https://service.test', 'BP_BOOTSTRAP_MASTER_KEY': key})
    assert key not in repr(config)
    observed = []
    async def app(scope, receive, send):
        observed.append(scope)
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        await send({'type': 'http.response.body', 'body': b'ok'})
    for peer, trusted in [('10.2.0.4', True), ('10.3.0.4', False)]:
        transport = httpx.ASGITransport(app=TrustedProxyMiddleware(app, ['10.2.0.0/24']), client=(peer, 1234))
        async with httpx.AsyncClient(transport=transport, base_url='http://internal.test') as client:
            headers = {'x-forwarded-host': 'app.test', 'x-forwarded-proto': 'https', 'x-forwarded-for': '10.2.0.5'}
            assert (await client.get('/', headers=headers)).status_code == 200
            scope = observed[-1]
            assert scope['scheme'] == ('https' if trusted else 'http')
            assert dict(scope['headers'])[b'host'] == (b'app.test' if trusted else b'internal.test')
            assert not any(key.startswith(b'x-forwarded') for key, _ in scope['headers'])
            headers['x-forwarded-host'] = 'app.test,evil.test'
            assert (await client.get('/', headers=headers)).status_code == (400 if trusted else 200)
    source = fixture()
    source['declaration']['shell'] = {'service': 'example', 'renderer': 'bootstrap5'}
    source['declaration']['developerResources'] = [{'id': 'ui.guide', 'kind': 'guide', 'title': 'UI', 'description': '', 'mediaType': 'text/markdown', 'content': '```markdown\n```python\nFULL RESOURCE\n```\n```'}]
    source['snapshot']['apps'][0]['shell'] = {'serviceId': TARGET, 'service': 'example', 'renderer': 'bootstrap5'}
    source['snapshot']['m2m'] = {'localServiceIds': [TARGET], 'services': [], 'bindings': [], 'grants': []}
    source['snapshot']['tenants'][0]['services'][0]['config'] = {'secret': 'PRIVATE-SENTINEL'}
    async with Service(build_registry(source), source['declaration'], ScopedConfig(source['snapshot'])) as service:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service, mode='theme')), base_url='https://app.test') as client:
            response = await client.get('/.well-known/bp/ai.json')
            assert response.status_code == 200, response.text
            graph = response.json()
            assert graph['documents']['drop'] == 'https://app.test/llms-drop.txt'
            drop = await client.get('/llms-drop.txt')
            assert drop.status_code == 200 and drop.headers['cache-control'] == 'no-store', drop.text
            assert 'PRIVATE-SENTINEL' not in drop.text and 'FULL RESOURCE' in drop.text and 'betterportal-llms-drop.v1' in drop.text
            assert source['declaration']['developerResources'][0]['content'] in drop.text
            assert 'https://app.test/.well-known/bp/schema.json' in drop.text
            assert ':key' not in (await client.get('/sitemap.xml')).text
            changed = deepcopy(source['snapshot']); changed['apps'][0]['seo'] = {'visibility': 'private'}
            await service.apply_snapshot(changed)
            assert 'Disallow: /' in (await client.get('/robots.txt')).text
            assert '<url>' not in (await client.get('/sitemap.xml')).text
            assert (await client.get('/llms.txt', headers={'host': 'evil.test'})).status_code == 400
    print('Python deployment: explicit proxy trust, secret configuration and public shell discovery passed')

asyncio.run(main())
