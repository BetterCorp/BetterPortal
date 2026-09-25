"""Python outbound streaming regression gate using real policy and a controlled transport."""
import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
import sys
import os
import subprocess
import tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import anyvali as av
import httpx
from betterportal.clients import ClientContract, ClientError
from betterportal.clientgen import generate_client
from betterportal.context import ScopedConfig
from betterportal.contracts import export
from betterportal.service import Service
from hosting_cases import fixture
from security_cases import TARGET
from python_registry import build_registry


class Wire(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks, self.closed = chunks, False
    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk
    async def aclose(self): self.closed = True


@asynccontextmanager
async def peer(chunks, *, raw=False, status=200, headers=None, use_generated=False):
    source = fixture()
    operation = source['routes'][0]['operations'][0]
    if raw: operation['raw'] = True
    else: operation['finite'] = {'itemSchema': export(av.string()), 'summarySchema': export(av.int_())}
    registry = build_registry(source)
    service = Service(registry, source['declaration'], ScopedConfig(source['snapshot']))
    wire = Wire(chunks)
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(status, headers=headers or {'content-type': 'application/octet-stream' if raw else 'application/x-ndjson'}, stream=wire)
    service.clients._http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    context, *_ = await service.prepare(registry.routes[0], 'GET', '/check/item', {'origin': 'https://app.test'})
    contract = registry.schema(source['declaration'])
    client = context.clients.user(ClientContract(contract), TARGET)
    namespace = {}
    exec(compile(generate_client(contract, 'Peer'), '<generated-client>', 'exec'), namespace)
    generated = namespace['Peer'](context.clients, service_id=TARGET)
    assert callable(generated.check_get if raw else generated.check_get_stream)
    try: yield generated if use_generated else client, service, wire, requests, source
    finally: await service.aclose()


async def main():
    values = {'params': {'key': 'item'}}
    valid = b'{"kind":"item","data":"hello"}\n{"kind":"summary","data":1}\n{"kind":"end","count":1}\n'
    for chunks in ([valid], [bytes([value]) for value in valid]):
        async with peer(chunks) as (client, _, wire, requests, _):
            async with client.stream('check.get', values) as frames:
                result = [frame async for frame in frames]
            assert [frame['kind'] for frame in result] == ['item', 'summary', 'end']
            assert wire.closed and requests[0].headers['accept'] == 'application/x-ndjson'
    async with peer([valid], use_generated=True) as (client, _, wire, _, _):
        async with client.check_get_stream(values) as frames:
            assert len([frame async for frame in frames]) == 3
        assert wire.closed
    async with peer([b'download'], raw=True, use_generated=True) as (client, _, wire, _, _):
        async with client.check_get(values) as response:
            assert b''.join([chunk async for chunk in response.body]) == b'download'
        assert wire.closed
    sse = b'event: item\r\ndata: {"kind":"item","data":"hello"}\r\n\r\nevent: end\r\ndata: {"kind":"end","count":1}\r\n\r\n'
    async with peer([bytes([byte]) for byte in sse], headers={'content-type': 'text/event-stream'}) as (client, _, wire, requests, _):
        async with client.stream('check.get', values, transport='sse') as frames:
            assert len([frame async for frame in frames]) == 2
        assert requests[0].url.path.endswith('/item/__sse') and wire.closed
    async with peer([b': heartbeat\n\ndata: "hello"\n\n'], headers={'content-type': 'text/event-stream'}) as (client, _, wire, _, _):
        async with client.subscribe('check.get', av.string(), values) as events:
            assert [event async for event in events] == ['hello']
        assert wire.closed
    async with peer([b'data: plain text\n\n'], headers={'content-type': 'text/event-stream'}) as (client, _, wire, _, _):
        async with client.subscribe('check.get', av.string(), values, text=True) as events:
            assert [event async for event in events] == ['plain text']
        assert wire.closed
    failures = [b'',  b'{"kind":"item","data":"hello"}\n', b'{"kind":"item","data":1}\n',
        b'{"kind":"end","count":1}\n', b'{"kind":"end","count":0}', b'not json\n',
        b'{"kind":"error","error":"secret","message":"secret"}\n',
        b'{"kind":"summary","data":1}\n{"kind":"item","data":"bad"}\n',
        b'{"kind":"end","count":0}\n{"kind":"end","count":0}\n',
        b'{"kind":"item","data":"' + b'x' * 200 + b'"}\n']
    for payload in failures:
        async with peer([payload]) as (client, _, wire, _, _):
            try:
                async with client.stream('check.get', values, max_frame_bytes=100) as frames:
                    [frame async for frame in frames]
            except ClientError as error:
                assert error.status == 502 and 'secret' not in str(error)
            else: raise AssertionError(payload)
            assert wire.closed
    async with peer([b'download'], raw=True) as (client, _, wire, _, _):
        async with client.raw('check.get', values) as response:
            assert response.status == 200
            assert b''.join([chunk async for chunk in response.body]) == b'download'
        assert wire.closed
    async with peer([b'too large'], raw=True) as (client, _, wire, _, _):
        try:
            async with client.raw('check.get', values, max_bytes=2) as response:
                [chunk async for chunk in response.body]
        except ClientError: pass
        else: raise AssertionError('Unbounded raw response')
        assert wire.closed
    for status, headers in [(302, None), (200, {'content-type': 'application/json'}), (200, {'content-encoding': 'gzip'})]:
        async with peer([], status=status, headers=headers) as (client, _, wire, _, _):
            try:
                async with client.stream('check.get', values): pass
            except ClientError: pass
            else: raise AssertionError('Invalid upstream accepted')
            assert wire.closed
    async with peer([valid]) as (client, _, wire, _, _):
        async with client.stream('check.get', values) as frames:
            assert (await anext(frames))['kind'] == 'item'
        assert wire.closed
    async with peer([valid]) as (client, service, wire, _, source):
        entered = asyncio.Event()
        async def consume():
            async with client.stream('check.get', values):
                entered.set()
                await asyncio.Event().wait()
        task = asyncio.create_task(consume())
        await entered.wait()
        await service.apply_snapshot(deepcopy(source['snapshot']))
        try: await asyncio.wait_for(task, 1)
        except asyncio.CancelledError: pass
        else: raise AssertionError('Retired stream was not cancelled')
        assert wire.closed
    source = fixture()
    source['routes'][0]['operations'][0]['finite'] = {'itemSchema': export(av.string()), 'summarySchema': export(av.int_())}
    with tempfile.TemporaryDirectory(prefix='bp-stream-types-') as directory:
        path = Path(directory)
        (path / 'peer.py').write_text(generate_client(build_registry(source).schema(source['declaration']), 'Peer'))
        positive = "from peer import Peer\nasync def read(client: Peer) -> str:\n    async with client.check_get_stream({'params': {'key': 'one'}}) as frames:\n        async for frame in frames:\n            if frame['kind'] == 'item':\n                return frame['data']\n    return ''\n"
        (path / 'positive.py').write_text(positive)
        (path / 'negative.py').write_text(positive.replace('-> str:', '-> int:').replace("return ''", 'return 0'))
        command = [sys.executable, '-m', 'mypy', '--follow-imports=silent', '--follow-untyped-imports', '--cache-dir', str(path / 'cache')]
        environment = {**os.environ, 'MYPYPATH': str(Path(__file__).resolve().parents[1] / 'python')}
        accepted = subprocess.run([*command, str(path / 'peer.py'), str(path / 'positive.py')], env=environment, text=True, capture_output=True)
        assert accepted.returncode == 0, accepted.stdout + accepted.stderr
        rejected = subprocess.run([*command, str(path / 'negative.py')], env=environment, text=True, capture_output=True)
        assert rejected.returncode != 0 and '[return-value]' in rejected.stdout, rejected.stdout + rejected.stderr
    print('Python raw/stream clients: framing, validation, bounds, cleanup and snapshot retirement passed')

asyncio.run(main())
