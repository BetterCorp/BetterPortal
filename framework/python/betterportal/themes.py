"""Native shell fragments and browser-runtime-compatible BPRoute controls."""
from __future__ import annotations

from dataclasses import dataclass
from copy import deepcopy
from types import MappingProxyType
from typing import Mapping
from html import escape
import inspect
import re
from typing import Any, Callable, Iterable, cast
from .generated_types import BPRouteReferenceInput
from .contracts import parse
from .handler import RequestContext
from .rendering import RenderContext


def bp_route(context: RenderContext, reference: dict[str, Any], states: Mapping[str, Any] | None = None,
             as_: str | None = None, **attributes: Any) -> str:
    """Render browser-compatible BPRoute controls/embeds; supplied state HTML is trusted.

    Each state is HTML or a mapping with content/as/HTML attributes. Component or
    fragment selects GET embedding. Unknown access is checked by the request.
    """
    states = states or {}
    embedding = bool(reference.get('component') or reference.get('fragment'))
    success = states.get('ok', '')
    success_attrs = {key: value for key, value in success.items() if key != 'content'} if isinstance(success, Mapping) else {}
    merged = {**attributes, **success_attrs}
    methods = [key for key in ('hx-get', 'hx-post', 'hx-put', 'hx-patch', 'hx-delete') if key in merged and merged[key] is not False]
    method = 'GET' if embedding else methods[0][3:].upper() if methods else reference.get('method', 'GET')
    options = {key: value for key, value in reference.items() if key not in ('service', 'args')}
    if 'service' in reference: options['serviceId'] = reference['service']
    options.update(reference.get('args', {})); options['method'] = method
    shell = reference.get('service') == 'shell' and reference.get('fragment') and not reference.get('path') and not reference.get('viewId')
    resolved_shell = context.urls.element(cast(BPRouteReferenceInput, reference)) if shell else None
    destination = None if shell else context.route(cast(Any, options))
    override = merged[methods[0]] if len(methods) == 1 and isinstance(merged[methods[0]], str) and merged[methods[0]] else None
    request = override or (resolved_shell.get('url') if resolved_shell else None) or (destination.get('absoluteViewPath') or destination['viewPath'] if destination else None)
    tag = success_attrs.get('as', as_ or ('none' if embedding else 'a'))
    actionable = bool(methods) or tag in ('button', 'form')
    available = bool(request) and not (len(methods) > 1 and not embedding) and not (reference.get('component') and reference.get('fragment'))
    available = available and (embedding or actionable or bool(destination and destination.get('uiPath')) or bool(override))
    initial = 'loading' if available and embedding else 'ok' if available else 'error'

    def attrs_html(values: Mapping[str, Any]) -> str:
        output = []
        for key, value in values.items():
            if not re.fullmatch(r'[A-Za-z_:][A-Za-z0-9_:.-]*', key): raise ValueError('Invalid BPRoute attribute')
            if value is None or value is False: continue
            output.append(key if value is True else key + '="' + escape(str(value), quote=True) + '"')
        return ' '.join(output)

    def branch(name: str, state: Any) -> str:
        values = {**attributes, **({key: value for key, value in state.items() if key != 'content'} if isinstance(state, Mapping) else {})}
        selected = str(values.pop('as', as_ or ('a' if name == 'ok' and not embedding else 'none')))
        content = str(state.get('content', '') if isinstance(state, Mapping) else state)
        if name != 'ok' or embedding:
            for key in list(values):
                if key in ('href', 'action', 'method') or key.startswith('hx-'): values.pop(key)
        elif request:
            if methods:
                values.pop('href', None)
                if values.get(methods[0]) is True or values.get(methods[0]) == '': values[methods[0]] = request
            elif selected == 'form': values.update({'action': request, 'method': method.lower(), 'hx-' + method.lower(): request})
            elif selected == 'button' or method != 'GET': values['hx-' + method.lower()] = request; values.setdefault('type', 'button')
            else: values.setdefault('href', destination['viewPath'] if destination else request)
            values['data-bp-route-control'] = ''
        if name == 'ok' and embedding: content = '<template data-bp-route-insertion></template>'
        if selected == 'none': return content
        if not re.fullmatch(r'[a-z][a-z0-9-]*', selected, re.I): raise ValueError('Invalid BPRoute element')
        attrs = attrs_html(values)
        return '<' + selected + (' ' + attrs if attrs else '') + '>' + content + '</' + selected + '>'

    branches = {name: branch(name, state) for name, state in states.items()}
    branches.setdefault('ok', branch('ok', ''))
    templates = ''.join('<template data-bp-route-state="' + escape(name, quote=True) + '">' + html + '</template>' for name, html in branches.items())
    root: dict[str, Any] = {'data-bp-route': '', 'data-bp-mode': 'embed' if embedding else 'action', 'data-bp-state': initial, 'style': 'display:contents'}
    service_id = resolved_shell.get('serviceId') if resolved_shell else destination.service_id if destination else None
    if service_id: root['data-bp-service'] = service_id
    if not available: root['data-bp-unavailable'] = 'route_unavailable'
    if embedding and available: root.update({'hx-get': request, 'hx-trigger': 'load, bp:route-retry', 'hx-target': 'this', 'hx-swap': 'none', 'aria-busy': 'true'})
    return '<bp-route ' + attrs_html(root) + '>' + templates + branches.get(initial, '') + '</bp-route>'


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
            return bp_route(context, {'service': reference['serviceId'], 'path': reference['targetPath'], 'fragment': reference['fragmentId']})
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
            return result
        return await render(identifier, ())
