"""Request telemetry must propagate trace identity without leaking request secrets."""
import asyncio
from dataclasses import asdict
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import httpx
from betterportal.asgi import create_app
from betterportal.context import ScopedConfig
from betterportal.observability import Observability, current_trace, parse_traceparent, parse_tracestate, parse_baggage
from betterportal.service import Service
from hosting_cases import fixture
from python_registry import build_registry


async def main():
    events = []
    def broken_sink(event): raise RuntimeError('export unavailable')
    observer = Observability(logger=broken_sink, tracer=events.append)
    source = fixture()
    async with Service(build_registry(source), source['declaration'], ScopedConfig(source['snapshot'])) as service:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service, observability=observer)), base_url='https://service.test') as client:
            parent = '00-' + 'a' * 32 + '-' + 'b' * 16 + '-01'
            response = await client.get('/.well-known/bp/health?token=secret', headers={'traceparent': parent, 'authorization': 'Bearer secret'})
            assert response.status_code == 200 and current_trace() is None
            event = events[-1]
            assert event.trace_id == 'a' * 32 and event.parent_span_id == 'b' * 16 and event.span_id != event.parent_span_id
            assert event.route == '/.well-known/bp/health' and event.status == 200 and event.outcome == 'success'
            assert event.duration_seconds >= 0 and 'secret' not in str(asdict(event))
            await client.get('/secret?token=secret', headers={'traceparent': 'secret'})
            assert events[-1].route == '<unmatched>' and events[-1].status == 404
            assert events[-1].trace_id != event.trace_id and events[-1].parent_span_id is None
            await asyncio.gather(*(client.get('/.well-known/bp/health') for _ in range(4)))
            assert len({entry.trace_id for entry in events[-4:]}) == 4
    assert parse_traceparent('00-' + '0' * 32 + '-' + 'b' * 16 + '-00') is None
    assert parse_traceparent('00-' + 'a' * 32 + '-' + '0' * 16 + '-00') is None
    recorded = []
    observer = Observability(logger=recorded.append, tracer=recorded.append, metrics=recorded.append)
    with observer.start_span('parent', {'token': 'secret', 'safe': 'yes'}) as parent:
        with observer.start_span('child') as child:
            assert child.trace.trace_id == parent.trace.trace_id and child.trace.span_id != parent.trace.span_id
            observer.logger.error(RuntimeError('secret'), {'password': 'secret', 'attempt': 1})
        observer.metrics.counter('requests').increment()
        observer.metrics.gauge('active').set(2)
        observer.metrics.gauge('active').decrement()
        observer.metrics.histogram('latency').observe(0.5)
        timer = observer.metrics.timer(); assert timer.stop() == timer.stop()
    assert current_trace() is None and 'secret' not in str(recorded)
    assert parse_tracestate('one=1,two=2') == 'one=1,two=2'
    assert parse_tracestate('one=1,one=2') is None
    assert parse_baggage('safe=value,bad=unsafe\rvalue') == 'safe=value'
    assert parse_traceparent('01-' + 'a' * 32 + '-' + 'b' * 16 + '-01-extra') is not None
    print('Python observability: trace propagation/isolation, secret-safe events, status and exporter failure passed')

asyncio.run(main())
