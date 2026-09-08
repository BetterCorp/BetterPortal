"""Scoped event delivery. LocalEvents serves one event loop, with no replica broadcast."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, AbstractAsyncContextManager
from dataclasses import dataclass
import inspect
import json
from typing import AsyncGenerator, AsyncIterator, Awaitable, Callable, Generic, Protocol, TypeVar, cast

import anyvali as av
from .jsoncodec import loads


@dataclass(frozen=True)
class EventScope:
    tenant_id: str
    app_id: str


@dataclass(frozen=True)
class EventAddress:
    view_id: str
    scope: EventScope


class SubscriptionOverflow(RuntimeError):
    pass


class EventTransport(Protocol):
    async def publish(self, address: EventAddress, data: bytes) -> None: ...
    def subscribe(self, address: EventAddress) -> AbstractAsyncContextManager[AsyncIterator[bytes]]: ...
    async def aclose(self) -> None: ...


class _Subscription(AsyncIterator[bytes]):
    def __init__(self, capacity: int):
        self.queue: asyncio.Queue[bytes | None] = asyncio.Queue(capacity)
        self.closed = False
        self.error: Exception | None = None

    def finish(self, error: Exception | None = None) -> None:
        if self.closed:
            return
        self.closed, self.error = True, error
        while not self.queue.empty():
            self.queue.get_nowait()
        self.queue.put_nowait(None)

    async def __anext__(self) -> bytes:
        if self.closed and self.queue.empty():
            if self.error:
                raise self.error
            raise StopAsyncIteration
        value = await self.queue.get()
        if self.error:
            raise self.error
        if value is None:
            raise StopAsyncIteration
        return value


class LocalEvents:
    """Bounded ephemeral fan-out. Applications own and close the transport."""
    def __init__(self, *, capacity: int = 256, max_payload_bytes: int = 1024 * 1024):
        if capacity < 1 or max_payload_bytes < 1:
            raise ValueError("Event limits must be positive")
        self.capacity, self.max_payload_bytes = capacity, max_payload_bytes
        self._subscribers: dict[EventAddress, set[_Subscription]] = {}
        self._closed = False
        self._loop: asyncio.AbstractEventLoop | None = None

    def _check(self) -> None:
        if self._closed:
            raise RuntimeError("Event transport is closed")
        loop = asyncio.get_running_loop()
        if self._loop is None:
            self._loop = loop
        if self._loop is not loop:
            raise RuntimeError("LocalEvents belongs to another event loop")

    def _remove(self, address: EventAddress, subscriber: _Subscription) -> None:
        group = self._subscribers.get(address)
        if group is not None:
            group.discard(subscriber)
            if not group:
                self._subscribers.pop(address, None)

    async def publish(self, address: EventAddress, data: bytes) -> None:
        self._check()
        if not isinstance(data, bytes) or len(data) > self.max_payload_bytes:
            raise ValueError("Invalid event payload or byte limit exceeded")
        for subscriber in tuple(self._subscribers.get(address, ())):
            try:
                subscriber.queue.put_nowait(data)
            except asyncio.QueueFull:
                subscriber.finish(SubscriptionOverflow("SSE subscriber exceeded its pending event limit"))
                self._remove(address, subscriber)

    @asynccontextmanager
    async def subscribe(self, address: EventAddress) -> AsyncIterator[AsyncIterator[bytes]]:
        self._check()
        subscriber = _Subscription(self.capacity)
        self._subscribers.setdefault(address, set()).add(subscriber)
        try:
            yield subscriber
        finally:
            self._remove(address, subscriber)
            subscriber.finish()

    async def aclose(self) -> None:
        if self._closed:
            return
        self._check()
        self._closed = True
        for group in self._subscribers.values():
            for subscriber in group:
                subscriber.finish()
        self._subscribers.clear()


Input = TypeVar("Input")
Event = TypeVar("Event")
Context = TypeVar("Context")


def encode_event(data: str, *, event: str | None = None, event_id: str | None = None,
                 retry: int | None = None, max_data_bytes: int = 1024 * 1024) -> bytes:
    """Encode one UTF-8 SSE message. Hosts flush each yielded message."""
    if max_data_bytes < 1 or len(data.encode("utf-8")) > max_data_bytes:
        raise ValueError("SSE data byte limit exceeded")
    for value in (event, event_id):
        if value is not None and (any(c in value for c in "\r\n\0") or len(value.encode("utf-8")) > 1024):
            raise ValueError("Invalid SSE event name or ID")
    if retry is not None and (type(retry) is not int or retry < 0):
        raise ValueError("SSE retry must be a nonnegative integer")
    fields = [] if event is None else ["event: " + event]
    # splitlines() also splits Unicode separators, which SSE treats as data.
    fields.extend("data: " + line for line in data.replace("\r\n", "\n").replace("\r", "\n").split("\n"))
    if event_id is not None:
        fields.append("id: " + event_id)
    if retry is not None:
        fields.append("retry: " + str(retry))
    return ("\n".join(fields) + "\n\n").encode("utf-8")


class SseRoute(Generic[Input, Event, Context]):
    def __init__(self, view_id: str, input_schema: av.BaseSchema[Input], event_schema: av.BaseSchema[Event],
                 mapper: Callable[[Input, Context], Event | Awaitable[Event]], *, transport: EventTransport, max_payload_bytes: int = 1024 * 1024):
        if not view_id:
            raise ValueError("View ID is required")
        self.view_id, self.input_schema, self.event_schema = view_id, input_schema, event_schema
        self.mapper, self.transport = mapper, transport
        if max_payload_bytes < 1:
            raise ValueError("Payload limit must be positive")
        self.max_payload_bytes = max_payload_bytes

    def _encode(self, value: object) -> bytes:
        data = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
        if len(data) > self.max_payload_bytes:
            raise ValueError("Event payload byte limit exceeded")
        return data

    async def publish(self, scope: EventScope, value: Input) -> Input:
        parsed = self.input_schema.parse(value)
        payload = self._encode(parsed)
        await self.transport.publish(EventAddress(self.view_id, scope), payload)
        return parsed

    @asynccontextmanager
    async def subscribe(self, scope: EventScope, context: Context) -> AsyncIterator[AsyncIterator[Event]]:
        async with self.transport.subscribe(EventAddress(self.view_id, scope)) as subscription:
            async def events() -> AsyncGenerator[Event, None]:
                async for data in subscription:
                    if len(data) > self.max_payload_bytes:
                        raise ValueError("Event payload byte limit exceeded")
                    value = self.input_schema.parse(loads(data.decode("utf-8")))
                    mapped = self.mapper(value, context)
                    if inspect.isawaitable(mapped):
                        mapped = await mapped
                    event = self.event_schema.parse(cast(Event, mapped))
                    self._encode(event)
                    yield event
            iterator = events()
            try:
                yield iterator
            finally:
                await iterator.aclose()

    async def wire(self, scope: EventScope, context: Context, *,
                   render: Callable[[Event], str | Awaitable[str]] | None = None,
                   event: str | None = None) -> AsyncGenerator[bytes, None]:
        encode_event("", event=event, max_data_bytes=self.max_payload_bytes)
        async with self.subscribe(scope, context) as subscription:
            async for value in subscription:
                try:
                    data = render(value) if render else value if isinstance(value, str) else self._encode(value).decode("utf-8")
                    if inspect.isawaitable(data):
                        data = await data
                    message = encode_event(cast(str, data), event=event, max_data_bytes=self.max_payload_bytes)
                except Exception:
                    message = encode_event('{"code":"render_failed","message":"Event rendering failed"}', event="error", max_data_bytes=self.max_payload_bytes)
                yield message
