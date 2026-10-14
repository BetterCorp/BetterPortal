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
            # Service-provided shell items must use the renamed BPRoute helper.
            changed = deepcopy(source['snapshot'])
            changed['apps'][0]['shellFragments'] = {TARGET: {'nav': {'mode': 'items', 'items': [
                {'source': 'service', 'serviceId': TARGET, 'targetPath': '/check/item', 'fragmentId': 'menu.badge'}]}}}
            await service.apply_snapshot(changed)
            response = await client.get(url)
            assert response.status_code == 200 and '<bp-route ' in response.text, response.text
            assert 'data-bp-mode="embed"' in response.text and 'data-bp-service="' + TARGET + '"' in response.text
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

# Native BPRoute aliases must produce HTMX options rather than browser targets.
from types import SimpleNamespace
from betterportal.themes import bp_route
from betterportal.urls import RouteDestination
fake = SimpleNamespace(route=lambda options: RouteDestination({'viewPath': '/check/item', 'absoluteViewPath': 'https://service.test/check/item', 'uiPath': '/app/item'}, None, options, True, TARGET))
for options in ({'target': '#summary', 'swap': 'outerHTML'}, {'swap': 'outerHTML'}):
    control = bp_route(fake, {'viewId': 'check'}, {'ok': 'Show'}, **options)
    assert 'hx-get="https://service.test/check/item"' in control and 'hx-swap="outerHTML"' in control, control
    assert ' target=' not in control, control
    if 'target' in options: assert 'hx-target="#summary"' in control, control
control = bp_route(fake, {'method': 'OPTIONS'}, {'error': {'as': 'label', 'content': 'Unavailable'}}, as_='button')
assert 'data-bp-state="error"' in control and 'hx-options' not in control, control

control = bp_route(fake, {'component': 'summary'}, {'ok': {'hx-delete': 'https://override.test/wrong', 'content': 'Ignored'}})
assert 'https://override.test' not in control and 'Ignored' not in control and 'data-bp-mode="embed"' in control, control
control = bp_route(fake, {'method': 'DELETE'}, {'ok': 'Delete'}, as_='form')
assert 'method="post"' in control and 'hx-delete="https://service.test/check/item"' in control, control

# Success-state HTML methods and explicit route options follow Node's precedence.
calls = []
def resolve(options):
    calls.append(options)
    return RouteDestination({'viewPath': '/check/item', 'absoluteViewPath': 'https://service.test/check/item', 'uiPath': '/app/item'}, None, options, True, TARGET)
fake.route = resolve
control = bp_route(fake, {'viewId': 'check'}, {'ok': {'as': 'form', 'method': 'post', 'content': 'Save'}})
assert calls[-1]['method'] == 'POST' and 'hx-post="https://service.test/check/item"' in control and 'method="post"' in control, control
control = bp_route(fake, {'viewId': 'check', 'method': 'delete'}, {'ok': 'Delete'}, as_='button')
assert calls[-1]['method'] == 'DELETE' and 'hx-delete="https://service.test/check/item"' in control, control
bp_route(fake, {'viewId': 'check', 'service': 'legacy', 'serviceId': TARGET,
               'params': {'key': 'explicit'}, 'query': {'tab': 'explicit'},
               'args': {'params': {'key': 'legacy'}, 'query': {'tab': 'legacy'}}}, {'ok': 'Show'})
assert calls[-1]['serviceId'] == TARGET and calls[-1]['params'] == {'key': 'explicit'} and calls[-1]['query'] == {'tab': 'explicit'}, calls[-1]
bp_route(fake, {'viewId': 'check', 'args': {'params': {'key': 'legacy'}, 'query': {'tab': 'legacy'}}}, {'ok': 'Show'})
assert calls[-1]['params'] == {'key': 'legacy'} and calls[-1]['query'] == {'tab': 'legacy'}, calls[-1]
