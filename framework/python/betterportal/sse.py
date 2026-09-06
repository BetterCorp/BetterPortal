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
