"""Conservative public sitemap and robots projection of scoped route mounts."""
from html import escape
from typing import Any
import re
from .context import http_origin
from .urls import _path


def documents(scope, origin):
    origin = http_origin(origin)
    app = scope.app
    private = app.get('seo', {}).get('visibility', 'auto') == 'private'
    enabled = {item['id'] for item in scope.tenant['services'] if item['enabled']}
    urls: dict[str, Any] = {}
    rules: dict[tuple[str, str], tuple[str, float]] = {}
    mandatory = set()
    def rule(agent, path, access, delay=0):
        if not re.fullmatch(r'[A-Za-z0-9_.*-]{1,128}', agent): raise ValueError('Invalid robots user agent')
        key = (agent, path)
        old = rules.get(key, ('allow', 0))
        rules[key] = ('disallow' if 'disallow' in (old[0], access) else 'allow', max(old[1], delay))
    if private: rule('*', '/', 'disallow')
    else:
        for route in app.get('appRoutes', app['routes']):
            if not route['enabled'] or route.get('kind', 'page') != 'page': continue
            path = _path(route['path'])
            parts = path.split('/')
            dynamic = next((index for index, part in enumerate(parts) if part.startswith(':')), None)
            prefix = path + '$' if dynamic is None else '/'.join(parts[:dynamic]).rstrip('/') + '/*'
            if route['serviceId'] not in enabled or route.get('authRequired') is not False:
                mandatory.add(prefix)
                rule('*', prefix, 'disallow'); continue
            for item in route.get('robots') or [{'userAgent': '*', 'access': 'allow'}]:
                rule(item['userAgent'], prefix, item['access'], item.get('crawlDelaySeconds', 0))
            metadata = route.get('sitemap', {})
            if dynamic is not None or metadata.get('kind') in ('exclude', 'provider'): continue
            # Dynamic providers must be resolved by the owning service; never guess
            # paths or issue network requests during public discovery.
            urls[origin + path] = metadata
    # A named crawler does not inherit the wildcard group (RFC 9309).
    defaults = {path: policy for (agent, path), policy in rules.items() if agent == '*'}
    for agent in {key[0] for key in rules}:
        for path, policy in defaults.items(): rules.setdefault((agent, path), policy)
        for path in mandatory: rule(agent, path, 'disallow')
    lines = []
    for agent in sorted({key[0] for key in rules}):
        lines.append('User-agent: ' + agent)
        delay = 0.0
        for (owner, path), (access, seconds) in sorted(rules.items()):
            if owner != agent: continue
            lines.append(('Disallow' if access == 'disallow' else 'Allow') + ': ' + path)
            delay = max(delay, seconds)
        if delay: lines.append('Crawl-delay: ' + str(delay))
        lines.append('')
    if not private: lines.append('Sitemap: ' + origin + '/sitemap.xml')
    if len(urls) > 50000: raise ValueError('Sitemap exceeds URL limit')
    entries = []
    for url, metadata in sorted(urls.items()):
        entry = '<url><loc>' + escape(url) + '</loc>'
        for key, tag in (('lastModified', 'lastmod'), ('changeFrequency', 'changefreq'), ('priority', 'priority')):
            if key in metadata: entry += '<' + tag + '>' + escape(str(metadata[key])) + '</' + tag + '>'
        entries.append(entry + '</url>')
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(entries) + '</urlset>\n'
    if len(xml.encode('utf-8')) > 50 * 1024 * 1024: raise ValueError('Sitemap exceeds byte limit')
    return {'/robots.txt': '\n'.join(lines) + '\n', '/sitemap.xml': xml}
