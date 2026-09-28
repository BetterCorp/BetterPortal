"""Native shell fragments and browser-runtime-compatible BP elements."""
from __future__ import annotations

from dataclasses import dataclass
from copy import deepcopy
from types import MappingProxyType
from typing import Mapping
from html import escape
import inspect
from typing import Any, Callable, Iterable, cast
from .generated_types import BPElementReferenceInput
from .contracts import parse
from .handler import RequestContext
from .rendering import RenderContext


def element(context: RenderContext, reference: dict[str, Any], children: str = '') -> str:
    """Children are trusted rendered HTML; all generated attributes are escaped."""
    resolved = context.urls.element(cast(BPElementReferenceInput, reference))
    ready = bool(resolved.get('url'))
    attributes = {'data-bp-element': '', 'data-bp-state': 'loading' if ready else 'nok', 'aria-busy': 'true' if ready else 'false'}
    if resolved.get('serviceId'): attributes['data-bp-service'] = resolved['serviceId']
    if resolved.get('unavailable'): attributes['data-bp-unavailable'] = resolved['unavailable']
    if ready: attributes.update({'hx-get': resolved['url'], 'hx-trigger': 'load, bp:element-retry', 'hx-target': 'this', 'hx-swap': 'none'})
    attrs = ' '.join(key if value == '' else key + '="' + escape(value, quote=True) + '"' for key, value in attributes.items())
    return '<bp-element ' + attrs + '>' + children + '</bp-element>'


@dataclass(frozen=True)
class ShellContext:
    presentation: RenderContext
    fragment_id: str
    items: tuple[str, ...]
    config: Mapping[str, Any]
    @property
    def request(self): return self.presentation.request
    @property
    def tenant(self): return self.presentation.tenant
    @property
    def app(self): return self.presentation.app
    @property
    def urls(self): return self.presentation.urls


class ShellFragment:
    def __init__(self, declaration: dict[str, Any], render: Callable[[ShellContext], Any]):
        self.declaration = parse('ShellFragmentDescriptorSchema', declaration)
        if not callable(render): raise ValueError('Shell renderer must be callable')
        self.render = render


class ShellFragments:
    def __init__(self, fragments: Iterable[ShellFragment]):
        self.fragments: dict[str, ShellFragment] = {}
        for fragment in fragments:
            identifier = fragment.declaration['id']
            if identifier in self.fragments: raise ValueError('Duplicate shell fragment')
            self.fragments[identifier] = fragment
        for fragment in self.fragments.values():
            if fragment.declaration['kind'] == 'fragment' and fragment.declaration['defaultItems']: raise ValueError('Only blocks have default items')
            if any(identifier not in self.fragments for identifier in fragment.declaration['defaultItems']): raise ValueError('Unknown default shell fragment')

    def declarations(self): return [deepcopy(fragment.declaration) for fragment in self.fragments.values()]

    async def render(self, identifier: str, request: RequestContext) -> str:
        shell = request.scope.app.get('shell')
        if shell is None or identifier not in self.fragments: raise ValueError('Shell fragment is unavailable')
        settings = request.scope.app.get('shellFragments', {}).get(shell['serviceId'], {})
        context = RenderContext.create(request, 'shell.' + identifier, request.path, shell['renderer'], 'fragment', 'page', None, 200, {}, {})
        visited = 0
        async def item(reference, stack):
            if reference['source'] == 'shell': return await render(reference['fragmentId'], stack)
            return element(context, {'service': reference['serviceId'], 'path': reference['targetPath'], 'fragment': reference['fragmentId']})
        async def render(name, stack):
            nonlocal visited
            visited += 1
            if name in stack or len(stack) >= 16 or visited > 128: raise ValueError('Shell fragment cycle or size limit')
            definition = self.fragments.get(name)
            if definition is None: raise ValueError('Unknown shell fragment')
            setting = settings.get(name, {})
            if setting.get('mode') == 'none': return ''
            stack = (*stack, name)
            if setting.get('mode') == 'override' and definition.declaration['kind'] == 'fragment': return await item(setting['item'], stack)
            if setting.get('mode') == 'items' and definition.declaration['kind'] != 'block': raise ValueError('Only shell blocks accept items')
            if setting.get('mode') == 'override': references = [setting['item']]
            elif setting.get('mode') == 'items': references = setting['items']
            else:
                legacy = request.scope.app.get('fragments', {}).get(name, [])
                references = [{'source': 'service', 'serviceId': value['serviceId'], 'targetPath': value['targetPath'],
                               'fragmentId': value['fragmentId'] if '.' in value['fragmentId'] else name + '.' + value['fragmentId']}
                              for value in legacy if value['enabled']]
                if not legacy:
                    for slot in request.scope.app.get('slots', []):
                        if not slot['enabled'] or not slot['slotId'].startswith(name + '.'): continue
                        route = next((route for route in request.scope.app['routes'] if route['enabled'] and route['serviceId'] == slot['serviceId'] and route['viewId'] == slot['viewId']), None)
                        if route is not None:
                            path = route.get('resolvedServicePath') or route.get('targetPath')
                            if path: references.append({'source': 'service', 'serviceId': slot['serviceId'], 'fragmentId': slot['slotId'], 'targetPath': path})
                if not legacy and not references: references = [{'source': 'shell', 'fragmentId': value} for value in definition.declaration['defaultItems']]
            items = tuple([await item(value, stack) for value in references])
            result = definition.render(ShellContext(context, name, items, MappingProxyType(deepcopy(dict(request.config)))))
            if inspect.isawaitable(result): result = await result
            if not isinstance(result, str) or len(result.encode('utf-8')) > 1024 * 1024: raise ValueError('Invalid shell fragment output')
            return request.urls.rewrite(result)
        return await render(identifier, ())
