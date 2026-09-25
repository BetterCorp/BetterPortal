"""Replaceable request telemetry with bounded trace propagation and safe HTTP events."""
from __future__ import annotations

import asyncio
from contextvars import ContextVar, Token
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
import math
from types import MappingProxyType
import re
import secrets
import time
from typing import Any, Callable, Mapping


@dataclass(frozen=True)
class HttpObservation:
    trace_id: str
    span_id: str
    parent_span_id: str | None
    method: str
    route: str
    status: int
    duration_seconds: float
    outcome: str


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    flags: str = '00'
    tracestate: str | None = None
    baggage: str | None = None

    @property
    def traceparent(self) -> str:
        return f'00-{self.trace_id}-{self.span_id}-{self.flags}'


_current: ContextVar[TraceContext | None] = ContextVar('bp_trace', default=None)


def current_trace() -> TraceContext | None:
    return _current.get()


def parse_traceparent(value: str) -> TraceContext | None:
    value = value.strip().lower()
    match = re.fullmatch(r'([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(.*)', value)
    if match is None or match[1] == 'ff' or int(match[2], 16) == 0 or int(match[3], 16) == 0: return None
    suffix = match[5]
    if suffix and (match[1] == '00' or not suffix.startswith('-') or any(ord(char) < 33 or ord(char) > 126 for char in suffix)): return None
    return TraceContext(match[2], match[3], match[4])


class Observability:
    """Inject logging/tracing/metric exporters through one immutable completion event.

    Core events contain route templates and status, never bodies, query strings,
    credentials, raw exception messages or caller-controlled request paths.
    Exporters must be nonblocking. Exporter failures cannot fail a request.
    """
    def __init__(self, *, logger: Callable[[Any], None] | None = None,
                 tracer: Callable[[Any], None] | None = None,
                 metrics: Callable[[Any], None] | None = None):
        self._logger_sink, self._tracer_sink, self._metrics_sink = logger, tracer, metrics
        self.logger, self.metrics = Logger(self), Metrics(self)
        self._sinks = tuple(sink for sink in (logger, tracer, metrics) if sink is not None)

    @staticmethod
    def _export(sink, value):
        if sink is not None:
            try: sink(value)
            except Exception: pass

    def start_span(self, name: str, attributes: Mapping[str, Any] | None = None):
        return Span(self, name, attributes)

    def record(self, value: HttpObservation) -> None:
        for sink in self._sinks:
            try: sink(value)
            except Exception: pass


class ObservabilityMiddleware:
    def __init__(self, app: Any, *, observer: Observability, routes: Mapping[Any, tuple[str, ...]]):
        self.app, self.observer, self.routes = app, observer, routes

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        parents = [value for key, value in scope.get('headers', ()) if key.lower() == b'traceparent']
        parent = parse_traceparent(parents[0].decode('ascii', errors='replace')) if len(parents) == 1 and len(parents[0]) <= 256 else None
        headers = {name: ','.join(value.decode('latin-1') for key, value in scope.get('headers', ()) if key.lower() == name)
                   for name in (b'tracestate', b'baggage')}
        trace = TraceContext(parent.trace_id if parent else secrets.token_hex(16), secrets.token_hex(8), parent.flags if parent else '00', parse_tracestate(headers.get(b'tracestate', '')) if parent else None, parse_baggage(headers.get(b'baggage', '')))
        observer_token = _observer.set(self.observer)
        token = _current.set(trace)
        started, status, outcome = time.monotonic(), 500, 'exception'
        async def observed_send(message):
            nonlocal status, outcome
            if message['type'] == 'http.response.start':
                status = message['status']
                outcome = 'success' if status < 400 else 'client-error' if status < 500 else 'server-error'
            await send(message)
        try:
            await self.app(scope, receive, observed_send)
        except asyncio.CancelledError:
            outcome = 'cancelled'
            raise
        except Exception:
            outcome = 'exception'
            raise
        finally:
            _current.reset(token)
            _observer.reset(observer_token)
            method = scope.get('method', '')
            if method not in {'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'}: method = 'OTHER'
            paths = self.routes.get(scope.get('endpoint'), ())
            path = scope.get('path', '')
            route = path if path in paths else paths[0] if paths else '<unmatched>'
            self.observer.record(HttpObservation(trace.trace_id, trace.span_id, parent.span_id if parent else None,
                method, route, status, time.monotonic() - started, outcome))

# Exporter-neutral instruments. Core integrations emit only bounded, safe metadata.

def safe_attributes(values: Mapping[str, Any] | None) -> Mapping[str, str | int | float | bool]:
    result: dict[str, str | int | float | bool] = {}
    for key, value in (values or {}).items():
        if len(result) >= 64: break
        if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]{0,127}', key): continue
        if re.search(r'password|secret|token|authorization|cookie|credential|body|payload|query', key, re.I): continue
        if isinstance(value, str): result[key] = value[:1024]
        elif isinstance(value, (bool, int)): result[key] = value
        elif isinstance(value, float) and math.isfinite(value): result[key] = value
    return MappingProxyType(result)


@dataclass(frozen=True)
class SpanObservation:
    name: str
    trace_id: str
    span_id: str
    parent_span_id: str | None
    duration_seconds: float
    outcome: str
    attributes: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class LogObservation:
    level: str
    message: str
    trace_id: str | None
    attributes: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MetricObservation:
    kind: str
    name: str
    value: float
    labels: Mapping[str, Any] = field(default_factory=dict)


class Timer:
    def __init__(self):
        self._start = time.monotonic()
        self._elapsed: float | None = None
    def stop(self) -> float:
        if self._elapsed is None: self._elapsed = time.monotonic() - self._start
        return self._elapsed


class Metric:
    def __init__(self, owner: Observability, kind: str, name: str):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]{0,127}', name): raise ValueError('Invalid metric name')
        self.owner, self.kind, self.name = owner, kind, name
    def _emit(self, kind: str, value: float, labels: Mapping[str, Any] | None):
        if isinstance(value, bool) or not math.isfinite(value): raise ValueError('Invalid metric value')
        self.owner._export(self.owner._metrics_sink, MetricObservation(kind, self.name, value, safe_attributes(labels)))
    def increment(self, value: float = 1, labels: Mapping[str, Any] | None = None):
        if self.kind not in ('counter', 'gauge') or value < 0: raise ValueError('Invalid metric increment')
        self._emit(self.kind + '.increment', value, labels)
    def decrement(self, value: float = 1, labels: Mapping[str, Any] | None = None):
        if self.kind != 'gauge' or isinstance(value, bool) or value < 0: raise ValueError('Only gauges can decrement')
        self._emit('gauge.increment', -value, labels)
    def set(self, value: float, labels: Mapping[str, Any] | None = None):
        if self.kind != 'gauge': raise ValueError('Only gauges can be set')
        self._emit('gauge.set', value, labels)
    def observe(self, value: float, labels: Mapping[str, Any] | None = None):
        if self.kind != 'histogram': raise ValueError('Only histograms accept observations')
        self._emit('histogram.observe', value, labels)


class Metrics:
    def __init__(self, owner: Observability): self.owner = owner
    def counter(self, name: str): return Metric(self.owner, 'counter', name)
    def gauge(self, name: str): return Metric(self.owner, 'gauge', name)
    def histogram(self, name: str): return Metric(self.owner, 'histogram', name)
    def timer(self): return Timer()


class Logger:
    def __init__(self, owner: Observability): self.owner = owner
    def log(self, level: str, message: str | Exception, attributes: Mapping[str, Any] | None = None):
        if level not in ('debug', 'info', 'warn', 'error'): raise ValueError('Invalid log level')
        trace = current_trace()
        safe_message = type(message).__name__ if isinstance(message, Exception) else message[:2048]
        self.owner._export(self.owner._logger_sink, LogObservation(level, safe_message, trace.trace_id if trace else None, safe_attributes(attributes)))
    def debug(self, message, attributes=None): self.log('debug', message, attributes)
    def info(self, message, attributes=None): self.log('info', message, attributes)
    def warn(self, message, attributes=None): self.log('warn', message, attributes)
    def error(self, message, attributes=None): self.log('error', message, attributes)


class Span(AbstractContextManager):
    def __init__(self, owner: Observability, name: str, attributes: Mapping[str, Any] | None):
        if not isinstance(name, str) or not 0 < len(name) <= 128: raise ValueError('Invalid span name')
        self.owner, self.name, self.attributes = owner, name, dict(safe_attributes(attributes))
        self._token: Token[TraceContext | None] | None = None
        self._entered = False
        self._ended = False
        self.outcome = 'success'
    def __enter__(self):
        if self._entered: raise RuntimeError('Span already entered')
        self._entered = True
        self.parent = current_trace()
        self.trace = TraceContext(self.parent.trace_id if self.parent else secrets.token_hex(16), secrets.token_hex(8),
            self.parent.flags if self.parent else '00', self.parent.tracestate if self.parent else None, self.parent.baggage if self.parent else None)
        self._token = _current.set(self.trace)
        self._start = time.monotonic()
        return self
    def set_attributes(self, attributes: Mapping[str, Any]):
        self.attributes.update(safe_attributes(attributes))
        self.attributes = dict(safe_attributes(self.attributes))
        return self
    def error(self): self.outcome = 'error'
    def __exit__(self, kind, value, traceback):
        if self._ended: return False
        self._ended = True
        if kind is not None: self.outcome = 'cancelled' if issubclass(kind, asyncio.CancelledError) else 'error'
        assert self._token is not None
        _current.reset(self._token)
        self.owner._export(self.owner._tracer_sink, SpanObservation(self.name, self.trace.trace_id, self.trace.span_id,
            self.parent.span_id if self.parent else None, time.monotonic() - self._start, self.outcome, safe_attributes(self.attributes)))
        return False


_observer: ContextVar[Observability | None] = ContextVar('bp_observability', default=None)

def current_observability() -> Observability:
    return _observer.get() or Observability()


def parse_tracestate(value: str) -> str | None:
    if not value or len(value) > 512 or any(ord(char) < 32 or ord(char) > 126 for char in value): return None
    members = [part.strip() for part in value.split(',')]
    if len(members) > 32: return None
    keys = set()
    for member in members:
        key, separator, content = member.partition('=')
        if not separator or key in keys or not 0 < len(content) <= 256 or '=' in content or content.endswith(' '): return None
        if not re.fullmatch(r'(?:[a-z][a-z0-9_*/-]{0,255}|[a-z0-9][a-z0-9_*/-]{0,240}@[a-z][a-z0-9_*/-]{0,13})', key): return None
        keys.add(key)
    return ','.join(members)


def parse_baggage(value: str) -> str | None:
    if len(value.encode('utf-8')) > 8192: return None
    members = value.split(',')
    if len(members) > 64: return None
    valid = []
    session = False
    for member in members:
        key, separator, content = member.strip().partition('='); key, content = key.strip(), content.strip()
        if not separator or not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", key) or not content: continue
        if any(ord(char) < 32 or ord(char) > 126 or char in ',\\"' for char in content): continue
        if key == 'bp.session_id':
            identifier = content.split(';')[0]
            if session or not re.fullmatch(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}', identifier): continue
            session = True
        valid.append(key + '=' + content)
    return ','.join(valid) or None
