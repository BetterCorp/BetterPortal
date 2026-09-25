"""Declared webhook payloads, scope and control-plane transport ownership."""
import asyncio
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import anyvali as av
import httpx
from betterportal.clients import ClientError
from betterportal.context import ScopedConfig
from betterportal.contracts import export
from betterportal.service import Service
from betterportal.webhooks import Webhooks, WebhookError, WebhookCancelled
from hosting_cases import fixture
from python_registry import build_registry
from security_cases import TENANT, APP


async def main():
    source = fixture()
    source['declaration']['webhooks'] = [{'id': 'changed', 'title': 'Changed', 'payloadSchema': export(av.string())}]
    async with Service(build_registry(source), source['declaration'], ScopedConfig(source['snapshot'])) as service:
        publisher = Webhooks(service, 'https://cp.test', {'authorization': 'Bearer test-only'}, 2)
        service._webhooks = publisher
        requests = []
        status = 202
        def respond(request):
            requests.append(request)
            return httpx.Response(status, content=b'upstream secret')
        publisher._http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        scope = service.clients.scope(TENANT, APP)
        assert await scope.webhook('changed', 'hello', idempotency_key='event-1') == 'event-1'
        assert json.loads(requests[0].content) == {'eventId': 'changed', 'payload': 'hello', 'tenantId': TENANT, 'appId': APP}
        assert requests[0].headers['idempotency-key'] == 'event-1'
        assert requests[0].headers['authorization'] == 'Bearer test-only'
        for event, payload, key in [('unknown', 'hello', 'event-1'), ('changed', 1, 'event-1'), ('changed', 'hello', 'bad\r\nkey')]:
            try: await scope.webhook(event, payload, idempotency_key=key)
            except (ValueError, av.ValidationError): pass
            else: raise AssertionError('Invalid event accepted')
        assert len(requests) == 1
        status = 302
        try: await scope.webhook('changed', 'hello')
        except ClientError as error:
            assert isinstance(error, WebhookError) and error.status == 302 and 'secret' not in str(error)
            assert error.idempotency_key == requests[-1].headers['idempotency-key']
        else: raise AssertionError('Redirect accepted')
        status = 202
        def disconnect(request):
            requests.append(request)
            raise httpx.ReadError('upstream secret', request=request)
        await publisher._http.aclose()
        publisher._http = httpx.AsyncClient(transport=httpx.MockTransport(disconnect))
        try: await scope.webhook('changed', 'hello')
        except WebhookError as error:
            assert error.status == 502 and 'secret' not in str(error)
            error_key = error.idempotency_key
        else: raise AssertionError('Disconnect accepted')
        assert error_key == requests[-1].headers['idempotency-key']
        await publisher._http.aclose()
        publisher._http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        assert await scope.webhook('changed', 'hello', idempotency_key=error_key) == error_key
        assert requests[-1].headers['idempotency-key'] == error_key
        class RetiredContext:
            def _current(self, *, expected=None):
                if expected is not None: raise ClientError(503, 'Request scope is no longer active')
                return scope._current()
        try: await publisher.emit(RetiredContext(), 'changed', 'hello')
        except WebhookError as error:
            assert error.status == 503 and error.idempotency_key == requests[-1].headers['idempotency-key']
        else: raise AssertionError('Retired snapshot accepted')
        async def cancelled(request):
            requests.append(request)
            raise asyncio.CancelledError()
        await publisher._http.aclose()
        publisher._http = httpx.AsyncClient(transport=httpx.MockTransport(cancelled))
        try: await scope.webhook('changed', 'hello')
        except WebhookCancelled as error:
            assert error.idempotency_key == requests[-1].headers['idempotency-key']
        else: raise AssertionError('Cancellation swallowed')
        await publisher.aclose()
        try: await scope.webhook('changed', 'hello')
        except ClientError as error: assert error.status == 503
        else: raise AssertionError('Closed publisher accepted')
    source['declaration']['webhooks'][0]['payloadSchema'] = {}
    async with Service(build_registry(source), source['declaration'], ScopedConfig(source['snapshot'])) as service:
        publisher = Webhooks(service, 'https://cp.test', {}, 2)
        await publisher.aclose()
    from betterportal.sync import ControlPlaneSync
    async with Service(build_registry(source), source['declaration'], managed=True) as service:
        await service.apply_snapshot(source['snapshot'], manifest_submitted=True)
        captured = service._state
        sync = ControlPlaneSync(service, 'https://cp.test', 'test-only')
        await sync._client.aclose()
        wire = 'event: config\ndata: ' + json.dumps(service.snapshot()) + '\n\n'
        sync._client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, headers={'content-type': 'text/event-stream'}, text=wire)))
        try:
            await sync._stream()
            assert service._state is captured and not captured.retired.is_set()
            assert sync.status['updates'] == 1
        finally: await sync.aclose()
    print('Python webhooks: declaration/schema, trusted scope, idempotency, redirect and shutdown passed')

asyncio.run(main())
