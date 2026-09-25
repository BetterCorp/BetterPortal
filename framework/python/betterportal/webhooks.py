"""Declared, validated webhook publication through the configured control plane."""
from __future__ import annotations

import asyncio
from http.cookiejar import CookieJar
import json
import re
import secrets
from typing import Any, TYPE_CHECKING
import anyvali as av
import httpx
from .clients import ClientError, _NoCookies
from .keys import secure_endpoint
from .contracts import document
if TYPE_CHECKING:
    from .clients import RequestClients
    from .service import Service


class Webhooks:
    def __init__(self, service: Service, base_url: str, headers: dict[str, str], timeout: float):
        self._service = service
        self._url = secure_endpoint(base_url).rstrip('/') + '/.well-known/bp/webhooks/events'
        self._schemas: dict[str, av.BaseSchema[Any]] = {}
        for event in service.manifest['webhooks']:
            if event['id'] in self._schemas: raise ValueError('Duplicate webhook event ID')
            self._schemas[event['id']] = av.import_schema(event['payloadSchema'] or document('JsonValueSchema'))
        self._headers, self._timeout = dict(headers), timeout
        self._http: httpx.AsyncClient | None = None
        self._tasks: set[asyncio.Task[Any]] = set()
        self._closed = False

    async def emit(self, context: RequestClients, event_id: str, payload: Any, *, idempotency_key: str | None = None) -> str:
        if self._closed: raise ClientError(503, 'Webhook publisher is closed')
        state, scope = context._current()
        if event_id not in self._schemas: raise ValueError('Webhook event is not declared')
        key = idempotency_key if idempotency_key is not None else secrets.token_urlsafe(24)
        if not re.fullmatch(r'[A-Za-z0-9._:-]{1,200}', key): raise ValueError('Invalid webhook idempotency key')
        body = json.dumps({'eventId': event_id, 'payload': self._schemas[event_id].parse(payload),
            'tenantId': scope.tenant_id, 'appId': scope.app_id}, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
        if len(body) > 1024 * 1024: raise ValueError('Webhook payload exceeds 1 MiB')
        task = asyncio.current_task(); assert task is not None
        self._tasks.add(task)
        async def retire():
            await state.retired.wait()
            task.cancel()
        watcher = asyncio.create_task(retire())
        try:
            if self._http is None: self._http = httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=self._timeout, cookies=CookieJar(policy=_NoCookies()))
            async def send():
                assert self._http is not None
                # No automatic retry: callers reuse their idempotency key after uncertain delivery.
                async with self._http.stream('POST', self._url, content=body, headers={**self._headers,
                        'accept': 'application/json', 'content-type': 'application/json', 'idempotency-key': key}) as response:
                    if not 200 <= response.status_code < 300: raise ClientError(response.status_code, 'Webhook publication failed')
                    context._current(expected=state)
            try: await asyncio.wait_for(send(), self._timeout)
            except (httpx.HTTPError, asyncio.TimeoutError): raise ClientError(502, 'Webhook transport failed') from None
            return key
        finally:
            watcher.cancel()
            await asyncio.gather(watcher, return_exceptions=True)
            self._tasks.discard(task)

    async def aclose(self):
        self._closed = True
        tasks = tuple(self._tasks - {asyncio.current_task()})
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if self._http is not None: await self._http.aclose()
