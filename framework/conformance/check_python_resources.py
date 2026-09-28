"""Public developer resources: exact content, descriptors, safe bounds and unknown IDs."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
from betterportal.asgi import create_app
from betterportal.service import Service
from hosting_cases import fixture
from python_registry import build_registry

async def main():
    source = fixture()
    resource = {'id': 'dev.guide', 'kind': 'guide', 'title': 'Guide', 'mediaType': 'text/plain; charset=utf-8', 'content': '# Public guide\n```python\nprint("hello")\n```\n'}
    source['declaration']['developerResources'] = [resource]
    async with Service(build_registry(source), source['declaration']) as service:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)), base_url='https://service.test') as client:
            response = await client.get('/.well-known/bp/resources')
            assert response.status_code == 200
            entry = response.json()[0]
            assert 'content' not in entry and entry['id'] == resource['id']
            response = await client.get(entry['url'])
            assert response.text == resource['content'] and response.headers['content-type'] == resource['mediaType']
            assert response.headers['x-content-type-options'] == 'nosniff'
            assert (await client.get('/.well-known/bp/resources/unknown')).status_code == 404
            assert (await client.head(entry['url'])).content == b''
    for resources in ([resource, resource], [{**resource, 'content': '\u20ac' * (200 * 1024)}]):
        declaration = deepcopy(source['declaration']); declaration['developerResources'] = resources
        try: build_registry(source).schema(declaration)
        except ValueError: pass
        else: raise AssertionError('Invalid resource accepted')
    print('Python resources: exact content, index, HEAD, unknown IDs and UTF-8 bounds passed')

asyncio.run(main())
