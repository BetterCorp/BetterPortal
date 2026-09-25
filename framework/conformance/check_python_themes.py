"""Shell overrides, isolation, cycles, BP elements and global status renderers."""
import asyncio
from copy import deepcopy
from html import escape
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
from betterportal.asgi import create_app
from betterportal.context import ScopedConfig
from betterportal.rendering import Renderer
from betterportal.service import Service
from betterportal.themes import ShellFragment, ShellFragments
from hosting_cases import fixture
from python_registry import build_registry
from security_cases import TARGET

async def main():
    fragments = ShellFragments([
        ShellFragment({'id': 'brand', 'kind': 'fragment', 'title': 'Brand', 'description': ''}, lambda context: '<b>' + escape(context.tenant['title']) + '</b>'),
        ShellFragment({'id': 'nav', 'kind': 'block', 'title': 'Navigation', 'description': '', 'defaultItems': ['brand']}, lambda context: '<nav>' + ''.join(context.items) + '</nav>')])
    source = fixture()
    source['declaration']['shell'] = {'service': 'example', 'renderer': 'bootstrap5', 'fragments': fragments.declarations()}
    source['snapshot']['apps'][0]['shell'] = {'serviceId': TARGET, 'service': 'example', 'renderer': 'bootstrap5'}
    source['snapshot']['m2m'] = {'localServiceIds': [TARGET], 'services': [], 'bindings': [], 'grants': []}
    async with Service(build_registry(source), source['declaration'], ScopedConfig(source['snapshot']),
        status_renderers=[Renderer({'renderer': 'bootstrap5', 'status': 404}, lambda data, context: '<p>Missing</p>')]) as service:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service, shell_fragments=fragments)), base_url='https://app.test') as client:
            url = '/.well-known/bp/shell/fragment/nav'
            response = await client.get(url)
            assert response.status_code == 200 and response.text.startswith('<nav><b>'), response.text
            changed = deepcopy(source['snapshot'])
            changed['apps'][0]['shellFragments'] = {TARGET: {'nav': {'mode': 'override', 'item': {'source': 'shell', 'fragmentId': 'brand'}}}}
            await service.apply_snapshot(changed)
            assert (await client.get(url)).text.startswith('<nav><b>')
            changed = deepcopy(source['snapshot'])
            changed['apps'][0]['shellFragments'] = {TARGET: {'brand': {'mode': 'none'}}}
            await service.apply_snapshot(changed)
            assert (await client.get(url)).text == '<nav></nav>'
            changed['apps'][0]['shellFragments'][TARGET]['brand'] = {'mode': 'override', 'item': {'source': 'shell', 'fragmentId': 'nav'}}
            await service.apply_snapshot(changed)
            assert (await client.get(url)).status_code == 404
            assert (await client.get('/missing', headers={'accept': 'text/html'})).text == '<p>Missing</p>'
            unknown = await client.get(url, headers={'host': 'evil.test'})
            assert unknown.status_code == 400, (unknown.status_code, unknown.text)
    print('Python themes: defaults, explicit empty overrides, cycles, scope and global status renderer passed')

asyncio.run(main())
