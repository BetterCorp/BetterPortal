"""Explicit raw handlers and host-independent byte/stream responses."""
from __future__ import annotations

import inspect
import re
from typing import Any, AsyncIterator, Awaitable, Callable, Generic, Mapping, Sequence
from urllib.parse import quote

import anyvali as av
from .handler import HandlerContext, HandlerInputs, RequestContext, Params, Query, Headers, Body

_TRANSPORT_HEADERS = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "content-length"}


class RawResponse:
    """The host owns and closes a streaming body after delivery or cancellation."""
    def __init__(self, body: bytes | AsyncIterator[bytes] = b"", *, status: int = 200,
                 headers: Mapping[str, str] | Sequence[tuple[str, str]] = ()):
        if type(status) is not int or not 200 <= status <= 599: raise ValueError("Invalid final response status")
        if not isinstance(body, bytes) and not hasattr(body, "__anext__"): raise TypeError("Raw bodies must be bytes or an async iterator")
        if status in (204, 205, 304) and body != b"": raise ValueError("Response status forbids a body")
        pairs = tuple((name, value) for name, value in (headers.items() if isinstance(headers, Mapping) else headers))
        if sum(len(name) + len(value) for name, value in pairs) > 65536: raise ValueError("Response headers are too large")
        for name, value in pairs:
            if not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", name) or any(ord(char) < 32 and char != "\t" or ord(char) > 255 or ord(char) == 127 for char in value):
                raise ValueError("Invalid response header")
            if name.lower() in _TRANSPORT_HEADERS or name.lower().startswith("access-control-"):
                raise ValueError("Response header is owned by the host")
        self._body, self._status, self._headers = body, status, pairs
        self._closed = False

    @property
    def body(self) -> bytes | AsyncIterator[bytes]: return self._body

    @property
    def status(self) -> int: return self._status

    @property
    def headers(self) -> tuple[tuple[str, str], ...]: return self._headers

    @classmethod
    def file(cls, body: bytes | AsyncIterator[bytes], filename: str, *, content_type: str = "application/octet-stream", inline: bool = False) -> RawResponse:
        fallback = "".join(char if 32 <= ord(char) < 127 and char not in '\\"/;' else "_" for char in filename)
        disposition = ("inline" if inline else "attachment") + '; filename="' + fallback + '"; filename*=UTF-8\'\'' + quote(filename, safe="")
        return cls(body, headers={"content-type": content_type, "content-disposition": disposition})

    async def aclose(self) -> None:
        if self._closed: return
        self._closed = True
        close = getattr(self.body, "aclose", None)
        if close is not None: await close()


class RawHandler(HandlerInputs[Params, Query, Headers, Body], Generic[Params, Query, Headers, Body]):
    is_raw = True
    response_schema = None

    def __init__(self, run: Callable[[HandlerContext[Params, Query, Headers, Body]], RawResponse | Awaitable[RawResponse]], *,
                 params: av.BaseSchema[Params] | None = None, query: av.BaseSchema[Query] | None = None,
                 headers: av.BaseSchema[Headers] | None = None, request: av.BaseSchema[Body] | None = None):
        super().__init__(params=params, query=query, headers=headers, request=request)
        if not callable(run): raise TypeError("A raw handler function is required")
        self.run = run

    async def invoke(self, context: RequestContext, values: Mapping[str, Any]) -> RawResponse:
        result = self.run(self.prepare(context, values))
        if inspect.isawaitable(result): result = await result
        if not isinstance(result, RawResponse): raise TypeError("Raw handlers must return RawResponse")
        return result
