"""Typed handlers; hosting supplies an already resolved and authorized context."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import inspect
from types import MappingProxyType
from typing import Any, Awaitable, Callable, Generic, Iterable, Mapping, TYPE_CHECKING, TypeVar, cast

import anyvali as av
from .authorization import AuthorizedCaller
from .context import ScopedContext
from .contracts import contract, export, object_document
from .generated_types import HttpMethod, MultipartRequest
from .urls import Urls
if TYPE_CHECKING:
    from .rendering import Renderer
    from .clients import RequestClients

Params = TypeVar("Params")
Query = TypeVar("Query")
Headers = TypeVar("Headers")
Body = TypeVar("Body")
Result = TypeVar("Result")


class HandlerInputError(ValueError):
    status = 400
    def __init__(self, field: str, cause: av.ValidationError):
        super().__init__("Invalid request " + field)
        self.field, self.validation = field, cause


class HandlerOutputError(ValueError):
    status = 500


class ResponseState:
    """Per-request status and application headers; transport/CORS stay host-owned."""
    def __init__(self) -> None: self._status = 200; self._headers: list[tuple[str, str]] = []
    @property
    def status(self) -> int: return self._status
    @status.setter
    def status(self, value: int) -> None:
        from .response import RawResponse
        RawResponse(status=value)
        self._status = value
    @property
    def headers(self) -> tuple[tuple[str, str], ...]: return tuple(self._headers)
    def set_header(self, name: str, value: str, *, append: bool = False) -> None:
        from .response import RawResponse
        RawResponse(headers=[(name, value)])
        if name.lower() in ("content-encoding", "cache-control"): raise ValueError("Response header requires a raw response")
        if not append: self.remove_header(name)
        self._headers.append((name, value))
    def remove_header(self, name: str) -> None:
        self._headers = [(key, value) for key, value in self._headers if key.lower() != name.lower()]


@dataclass(frozen=True)
class RequestContext:
    scope: ScopedContext
    caller: AuthorizedCaller
    method: HttpMethod
    path: str
    config: Mapping[str, Any] = field(default_factory=dict)
    multipart: MultipartRequest | None = None
    response: ResponseState = field(default_factory=ResponseState)
    url_context: Urls | None = None
    client_context: RequestClients | None = field(default=None, repr=False, compare=False)
    _retired: asyncio.Event | None = field(default=None, repr=False, compare=False)
    @property
    def urls(self) -> Urls: return self.url_context or Urls(self.scope, None, None, self.path)
    @property
    def clients(self) -> RequestClients:
        if self.client_context is None: raise RuntimeError("Clients require a service request context")
        return self.client_context


@dataclass(frozen=True)
class HandlerContext(Generic[Params, Query, Headers, Body]):
    request_context: RequestContext
    params: Params
    query: Query
    headers: Headers
    request: Body
    @property
    def response(self) -> ResponseState: return self.request_context.response
    @property
    def urls(self) -> Urls: return self.request_context.urls


@dataclass(frozen=True)
class Invocation(Generic[Result]):
    value: Result
    params: Any
    query: Any


class HandlerInputs(Generic[Params, Query, Headers, Body]):
    def __init__(self, *, params: av.BaseSchema[Params] | None = None, query: av.BaseSchema[Query] | None = None,
                 headers: av.BaseSchema[Headers] | None = None, request: av.BaseSchema[Body] | None = None):
        if any(schema is not None and not isinstance(schema, av.BaseSchema) for schema in (params, query, headers, request)):
            raise TypeError("Handler inputs must use AnyVali schemas")
        self.schemas: Mapping[str, av.BaseSchema[Any]] = MappingProxyType({name: schema for name, schema in
            (("params", params), ("query", query), ("headers", headers), ("request", request)) if schema is not None})

    @property
    def input_document(self) -> dict[str, Any]:
        # The same documents feed native type generation and runtime validation.
        return object_document({name: export(self.schemas.get(name, contract("JsonObjectSchema")))
            for name in ("params", "query", "headers", "request")}, unknown_keys="reject")

    def prepare(self, context: RequestContext, values: Mapping[str, Any]) -> HandlerContext[Params, Query, Headers, Body]:
        parsed = {}
        for name in ("params", "query", "headers", "request"):
            try:
                parsed[name] = self.schemas.get(name, contract("JsonObjectSchema")).parse(values.get(name, {}))
            except av.ValidationError as error:
                raise HandlerInputError(name, error) from error
        return HandlerContext(context, parsed["params"], parsed["query"], parsed["headers"], parsed["request"])

class Handler(HandlerInputs[Params, Query, Headers, Body], Generic[Params, Query, Headers, Body, Result]):
    is_raw = False

    def __init__(self, response: av.BaseSchema[Result],
                 run: Callable[[HandlerContext[Params, Query, Headers, Body]], Result | Awaitable[Result]], *,
                 params: av.BaseSchema[Params] | None = None, query: av.BaseSchema[Query] | None = None,
                 headers: av.BaseSchema[Headers] | None = None, request: av.BaseSchema[Body] | None = None,
                 renderers: Iterable[Renderer[Result]] = ()):
        super().__init__(params=params, query=query, headers=headers, request=request)
        if not isinstance(response, av.BaseSchema) or not callable(run):
            raise TypeError("An AnyVali response schema and handler function are required")
        self.response_schema, self.run = response, run
        from .rendering import renderers as unique_renderers
        self.renderers = unique_renderers(renderers)

    async def execute(self, context: RequestContext, values: Mapping[str, Any]) -> Invocation[Result]:
        prepared = self.prepare(context, values)
        result = self.run(prepared)
        if inspect.isawaitable(result):
            result = await result
        from .response import RawResponse
        if isinstance(result, RawResponse):
            await result.aclose()
            raise TypeError("Raw responses require a RawHandler")
        try:
            return Invocation(self.response_schema.parse(cast(Result, result)), prepared.params, prepared.query)
        except av.ValidationError as error:
            raise HandlerOutputError("Response validation failed") from error

    async def invoke(self, context: RequestContext, values: Mapping[str, Any]) -> Result:
        return (await self.execute(context, values)).value
