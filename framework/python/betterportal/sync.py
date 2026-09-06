"""BP-owned manifest submission and scoped SSE/poll synchronization, without BSB."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import json
import math
from typing import Any, AsyncIterator, cast

import httpx
from .contracts import parse
from .generated_types import AuthProviderRuntimeMetadataInput, ControlPlaneSubmission, PluginManifest
from .jsoncodec import loads
from .keys import secure_endpoint
from .security import KeyPair
from .service import Service

_LIMIT = 16 * 1024 * 1024


def build_submission(manifest: PluginManifest, *, key_pair: KeyPair | None = None,
                     auth_provider: AuthProviderRuntimeMetadataInput | None = None) -> ControlPlaneSubmission:
    value = parse("PluginManifestSchema", manifest)
    result = {key: value[key] for key in ("title", "capabilities", "configSchemas", "webhooks", "apiContracts", "m2mRequests", "developerResources")}
    result.update(manifestVersion=value["version"], viewIndex={})
    if "shell" in value: result["shell"] = value["shell"]
    if auth_provider is not None: result["authProvider"] = auth_provider
    if key_pair is not None: result.update(publicKeyPem=key_pair.public_key_pem, keyId=key_pair.kid)
    for view in value["views"]:
        operations, fragments, seen = [], [], set()
        for operation in view["operations"]:
            renderers = operation["html"]["renderers"]
            item = {key: operation[key] for key in ("operationId", "method", "title", "description", "robots", "dependencies", "renderable", "apiContracts", "demoScenarios")}
            item.update(renderers=list(renderers), renderModes=list(dict.fromkeys(mode for theme in renderers.values() for mode in theme["renderModes"])),
                        authRequired=operation["auth"]["required"], permissions=operation["auth"]["permissions"],
                        schemas={target: operation[source] for target, source in (("query", "querySchema"), ("headers", "headersSchema"),
                            ("request", "bodySchema"), ("response", "jsonResponseSchema"), ("metadataResponse", "metadataResponseSchema"))})
            item.update({key: operation[key] for key in ("role", "sitemap", "chrome", "raw") if key in operation})
            operations.append(item)
            for theme in renderers.values():
                for renderer in theme["renderers"]:
                    identity = renderer["slotId"], operation["operationId"], operation["method"]
                    if identity[0] == "main" or identity in seen: continue
                    seen.add(identity)
                    fragments.append({"fragmentId": identity[0], "targetPath": view["path"], "operationId": identity[1], "method": identity[2]})
        result["viewIndex"][view["viewId"]] = {**{key: view[key] for key in ("viewId", "title", "description", "path", "pathVariants", "paramsSchema")},
                                                 "operations": operations, "fragments": fragments}
    return cast(ControlPlaneSubmission, parse("ControlPlaneSubmissionSchema", result))


async def _frames(chunks: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    """Bound a complete SSE frame before decoding; preserve LF, CR and split CRLF."""
    frame = bytearray(); line_size = 0; carriage = False
    async for chunk in chunks:
        for byte in chunk:
            if carriage and byte == 10:
                carriage = False
                continue
            carriage = byte == 13
            frame.append(byte)
            if len(frame) > _LIMIT: raise ValueError("SSE frame exceeds 16 MiB")
            if byte in (10, 13):
                if line_size == 0:
                    yield bytes(frame)
                    frame.clear()
                line_size = 0
            else: line_size += 1
    # A partial frame at EOF never becomes an update.


class ControlPlaneSync:
    """One service/CP connection. Failed bootstrap returns False and retries in the background."""
    def __init__(self, service: Service, base_url: str, api_key: str, *, key_pair: KeyPair | None = None,
                 auth_provider: AuthProviderRuntimeMetadataInput | None = None, retry_delay: float = 5, request_timeout: float = 30):
        if not service.managed: raise ValueError("Control-plane synchronization requires a managed Service")
        self.service = service
        self._url = secure_endpoint(base_url).rstrip("/") + "/.well-known/bp/sync"
        if not api_key or len(api_key) > 4096 or any(ord(char) < 33 or ord(char) > 126 for char in api_key):
            raise ValueError("Invalid control-plane API key")
        if any(not math.isfinite(value) or not 0 < value <= 4294967.294 for value in (retry_delay, request_timeout)):
            raise ValueError("Invalid synchronization timing")
        self._headers = {"authorization": "Bearer " + api_key}
        self._submission = build_submission(service.manifest, key_pair=key_pair, auth_provider=auth_provider)
        self._payload = json.dumps(self._submission, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
        if len(self._payload) > _LIMIT: raise ValueError("Manifest submission exceeds 16 MiB")
        self._delay, self._timeout = retry_delay, request_timeout
        self._client = httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=request_timeout)
        self._task: asyncio.Task[None] | None = None
        self._first: asyncio.Future[bool] | None = None
        self._closed = False
        self._phase = "idle"
        self._error: str | None = None
        self._attempts = self._updates = 0

    @property
    def status(self) -> dict[str, Any]:
        """Diagnostics contain no credentials, URLs, config values or exception messages."""
        return {"phase": self._phase, "lastError": self._error, "attempts": self._attempts, "updates": self._updates}

    def submission(self) -> ControlPlaneSubmission: return deepcopy(self._submission)

    async def start(self) -> bool:
        if self._closed or self._task is not None: raise RuntimeError("Sync is closed or already started")
        self.service._suspend_sync()
        self._first = asyncio.get_running_loop().create_future()
        self._task = asyncio.create_task(self._run())
        try: return await asyncio.shield(self._first)
        except BaseException:
            await self.aclose()
            raise

    async def _poll(self) -> None:
        self._phase = "submitting"; self._attempts += 1
        async with self._client.stream("POST", self._url + "/poll", content=self._payload,
                headers={**self._headers, "accept": "application/json", "content-type": "application/json"}) as response:
            self._client.cookies.clear()
            if response.status_code in (401, 403, 409, 412): self.service._suspend_sync()
            if response.status_code != 200 or response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                raise ValueError("Invalid poll response")
            data = bytearray()
            async for chunk in response.aiter_bytes(chunk_size=8192):
                if len(data) + len(chunk) > _LIMIT: raise ValueError("Snapshot exceeds 16 MiB")
                data.extend(chunk)
        await self.service.apply_snapshot(loads(data.decode("utf-8")), manifest_submitted=True)
        self._updates += 1; self._error = None

    async def _stream(self) -> None:
        self._phase = "connecting"
        async with self._client.stream("GET", self._url, headers={**self._headers, "accept": "text/event-stream"}) as response:
            self._client.cookies.clear()
            if response.status_code in (401, 403, 409, 412): self.service._suspend_sync()
            if response.status_code != 200 or response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "text/event-stream":
                raise ValueError("Invalid SSE response")
            self._phase = "connected"
            first = True
            async for frame in _frames(response.aiter_bytes()):
                text = frame.decode("utf-8-sig" if first else "utf-8"); first = False
                event, lines = "message", []
                for line in text.replace("\r", "\n").split("\n"):
                    name, colon, value = line.partition(":")
                    if not colon: value = ""
                    if value.startswith(" "): value = value[1:]
                    if name == "event": event = value
                    elif name == "data": lines.append(value)
                if event == "config" and lines:
                    try: await self.service.apply_snapshot(loads("\n".join(lines)))
                    except Exception:
                        self._error = "invalid_update"
                    else: self._updates += 1; self._error = None

    async def _run(self) -> None:
        assert self._first is not None
        try:
            if self.service.snapshot() is None:
                try: await self.service.restore_snapshot()
                except Exception: self._error = "invalid_cache"
            while not self._closed:
                try:
                    await asyncio.wait_for(self._poll(), self._timeout)
                    if self._closed: return
                    if not self._first.done(): self._first.set_result(True)
                    await self._stream()
                    self._error = "stream_closed"
                except asyncio.CancelledError: raise
                except Exception: self._error = "sync_failed"
                self._phase = "retrying"
                if not self._first.done(): self._first.set_result(False)
                if self._closed: return
                await asyncio.sleep(self._delay)
        finally:
            if not self._first.done(): self._first.cancel()
            self._phase = "closed"

    async def aclose(self) -> None:
        self._closed = True
        if self._task is not None:
            self.service._suspend_sync()
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
            self.service._suspend_sync()
        await self._client.aclose()
        self._phase = "closed"

    async def __aenter__(self) -> ControlPlaneSync:
        await self.start()
        return self

    async def __aexit__(self, *args: Any) -> None: await self.aclose()
