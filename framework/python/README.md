# BetterPortal Python port

Python 3.10+. This is an in-progress framework with prototype Starlette/ASGI
hosting for JSON, HTML and raw operations. It is **not ready for production**: the AnyVali
snapshot gate below still fails. Control-plane synchronization, full theme helpers, route
tooling and clients remain in the [capability ledger](../conformance/CAPABILITIES.md).

Install `betterportal[asgi]` and an ASGI server such as Uvicorn. `create_app(service)`
in `betterportal.asgi` owns the `Service` lifespan. A service combines a registry,
manifest declaration and optional validated `ScopedConfig`. With no snapshot its
public health endpoint returns only `{"ok": false}` with status 503; a local
snapshot enables request handling. Automatic control-plane synchronization and
authorized health diagnostics remain pending.

The host resolves scope, checks local operation mounts and CORS, and verifies user
or delegated/service credentials before invoking handlers. It preserves repeated
query/form values and field-name case. `RequestContext.multipart` contains the
canonical parsed form fields and uploads (file data is an array of byte values).
Body buffering defaults to 1 MiB, configurable through `max_body_bytes`; forms
permit at most 1,000 fields and 100 files, with 1 MiB per text field. File resources
close after parsing. Disconnects cancel handler waits.

JSON and BP metadata negotiation are supported. Metadata requires the operation's
authorization and does not execute its handler. Health, manifest and schema JSON
discovery are public. Validated finite/SSE stream hosting remains pending. Configure trusted
proxies in the ASGI server; raw forwarding and HTMX context headers confer no
authority. Renderer selection is bound to the resolved app's shell renderer.

```python
import asyncio
from betterportal.asgi import create_app
from betterportal.registry import Registry
from betterportal.service import Service

async def check():
    async with Service(Registry([]), {"pluginId": "com.example.hello", "title": "Hello",
                                     "description": "Example service", "version": "1.0.0"}) as service:
        app = create_app(service)
        assert not service.ready  # Supply a validated local snapshot to enable operations.

asyncio.run(check())
```

`Handler[Params, Query, Headers, Body, Result]` accepts native AnyVali schemas and
a sync or async function receiving `HandlerContext`. `invoke` parses all four
input fields before calling the function and validates its response. A host supplies
`RequestContext` with the resolved scope, verified caller, method/path and config;
this low-level helper does not authorize calls. `HandlerInputError` identifies the
invalid field (400), while `HandlerOutputError` reports invalid output (500).
Absent input containers become `{}`; explicit null remains present. The
`input_document` property exports the four parsed handler input fields for native
type generation. Full handler/render context helpers remain delivery work.

`Operation`, `Route` and `Registry` register JSON/raw handlers and derive canonical
manifests and discovery schemas from their AnyVali schemas. Every operation needs
an explicit `auth` declaration and a unique stable ID. Methods share the view's
params schema; their query, headers, body, response and policy remain separate.
Dependency aliases resolve to plugin IDs, and local dependencies must exist with
the declared method. Path variants belong to one view and publish API contracts
once. Directory discovery and finite-stream registration remain pending.

`Renderer[Result]` accepts a sync/async function returning an HTML string. Register
it on the typed handler; the adapter selects the exact method, app renderer,
kind/key and response status. Page is the default kind; fragments require a
`location.id` key and components require an ID. `_f` overrides an Accept fragment
parameter; `_c` selects a component. Ambiguous selectors fail. Render modes are
page, fragment and embed. Metadata and manifests derive from these registrations.

```python
from html import escape
from typing import Any
from betterportal.contracts import contract
from betterportal.generated_types import TokenLifetimeConfig
from betterportal.handler import Handler, HandlerContext
from betterportal.rendering import Renderer, RenderContext
from betterportal.registry import Operation

def handle(context: HandlerContext[Any, Any, Any, Any]) -> TokenLifetimeConfig:
    context.response.status = 201
    context.response.set_header("HX-Trigger", "bp:created")
    return {"accessTokenSeconds": 900, "refreshTokenSeconds": 604800}

def render(value: TokenLifetimeConfig, context: RenderContext) -> str:
    return f'<p>{escape(context.tenant["title"])}: {value["accessTokenSeconds"]}</p>'

renderer = Renderer[TokenLifetimeConfig]({"renderer": "bootstrap5", "status": 201}, render)
handler = Handler[Any, Any, Any, Any, TokenLifetimeConfig](
    contract("TokenLifetimeConfigSchema"), handle, renderers=[renderer])
operation = Operation(handler, {"operationId": "lifetimes.get", "method": "GET",
    "title": "Lifetimes", "description": "Render token lifetimes", "auth": {}})
assert operation.handler.renderers[0].identity == ("bootstrap5", "page", None, 201)
```

`RenderContext` exposes canonical presentation fields for tenant/app, parsed
params/query and route selection. Secrets, roles, auth settings and headers are
excluded. Escape dynamic HTML with `html.escape`; no template engine is required.
`context.response` controls status and application headers (`append=True` preserves
multiple cookies). The adapter owns Content-Type/CORS/transport headers. A changed
HTML status needs an exact status renderer; otherwise the response is empty.
204/205/304 always have no body.

`Operation(..., error_renderers=[Renderer[ViewRenderError](...)])` registers
callbacks for errors, separately from successful handler results. Their canonical
data contains only `error` and `status`; declarations require status 400–599.
The selected fragment/component is preserved on errors. Callback failures return
a generic 500. Disconnects cancel async callbacks. URL/element helpers, theme
resources and global status renderers remain pending.

`RawHandler[Params, Query, Headers, Body]` shares input validation and host
authorization with JSON handlers. It must return `RawResponse`; JSON handlers
reject and close raw results. Raw operations publish `raw: true` and bypass
representation negotiation, including a metadata Accept header. Their metadata
remains available through discovery. GET registrations also serve HEAD using the
same policy; a raw HEAD closes the response without pulling its stream.

```python
from typing import Any
from betterportal.response import RawHandler, RawResponse
from betterportal.registry import Operation

download = RawHandler[Any, Any, Any, Any](
    lambda context: RawResponse.file(b"Hello BP\n", "report.txt", content_type="text/plain"))
operation = Operation(download, {"operationId": "report.get", "method": "GET",
    "title": "Report", "description": "Download a report", "auth": {"required": True}})
assert operation.handler.is_raw
```

A raw body is bytes or an async iterator yielding bytes. The ASGI host awaits
each send before requesting the next chunk and calls `aclose()` when available
on completion, disconnect or failure. Stream failures after headers terminate the
response. Supply file content, not a filesystem path, to `RawResponse.file`;
it builds safe ASCII/UTF-8 download headers. Header pairs retain repeated cookies;
the host owns CORS and transport headers, computes byte-body length, and rejects
header injection. Status 204/205/304 forbids a body; 206 and redirects may carry one.

```python
from betterportal.contracts import contract
from betterportal.handler import Handler
from betterportal.registry import Operation, Route, Registry

operation = Operation(Handler(contract("JsonObjectSchema"), lambda context: {"hello": "world"}), {
    "operationId": "hello.get", "method": "GET", "title": "Hello",
    "description": "Return a greeting", "auth": {},
})
registry = Registry([Route("hello.index", "/hello", [operation])])
manifest = registry.manifest({"pluginId": "com.example.hello", "title": "Hello",
                              "description": "Example service", "version": "1.0.0"})
assert manifest["views"][0]["operations"][0]["operationId"] == "hello.get"
```

`betterportal.context.ScopedConfig` imports a canonical scoped snapshot and checks
tenant/app references, duplicate identities and ambiguous hostnames. Browser
resolution distinguishes scheme/host/port and copies each request's tenant/app
data. `by_id` supports looking up a claimed machine scope before authentication;
lookup alone never authorizes a request. Configuration-management app indexes
are separate from runtime app lookup.

`AppAccess(scope, snapshot.local_service_ids)` in `betterportal.access` checks
the registered operation against enabled inbound app mounts. Pass the matched
registered path to `allows` for a view with path variants. GET fragment selectors
and slot mounts are supported; `appRoutes`/`appFragments` are catalogs, not inbound
allowlists. `permission_aliases()` restricts role aliases to enabled local service
instances referenced by this app; pass the route and method to restrict aliases
to its mounted operation. `Service` always applies this restriction. Hosts must still run caller authorization and
representation selection. Well-known routes use their own declared auth policy.

Raw proxy and HTMX context headers are ignored. `resolve(..., trusted_addresses=...)`
accepts only addresses already verified by host proxy middleware; the host also
supplies the effective scheme. `OriginPolicy` normalizes configured HTTP origins
and preserves exact path/query restrictions on referer overrides. Atomic
persistent replacement and host proxy middleware remain pending.

**Snapshot validation is blocked by [AnyVali #127](https://github.com/BetterCorp/AnyVali/issues/127):**
Python 1.1.1 accepts `active: null` as the default `true`. The conformance test
requires rejection and remains failing. Do not deploy this context prototype at
a trust boundary until the SDK defect is fixed; BP adds no alternate validator.

```python
from betterportal.context import ScopedConfig, http_origin

assert http_origin("HTTPS://Example.com:443") == "https://example.com"
snapshot = ScopedConfig({"managementOrigins": [], "tenants": [], "apps": []})
assert snapshot.resolve({"host": "unknown.example"}) is None
```

`betterportal.cors.Cors` produces response/preflight headers from a trusted
`OriginPolicy` and the route's allowed methods. Hosts call `preflight` before
authentication/dispatch, returning empty 204 on success or 403 for `CorsDenied`.
Allowed origins can request custom operation headers; their values still pass
through operation schemas. The policy exposes BP/HTMX response headers, uses a
600-second preflight cache and includes Vary fields. Hosts merge Vary with their
existing Accept/cache policy. No credential-cookie CORS flag is emitted.

```python
from betterportal.context import OriginPolicy
from betterportal.cors import Cors

policy = OriginPolicy(frozenset(["https://app.example"]), frozenset(["https://app.example"]))
headers = Cors(policy, ["GET"]).preflight("https://app.example", "GET", "Authorization, X-App-Filter")
assert headers["access-control-allow-origin"] == "https://app.example"
```

`betterportal.sse.SseRoute` validates publication input, maps it with subscriber
context, and validates the resulting event. `EventScope` comes from the trusted
request context. `EventTransport` is replaceable; the supplied `LocalEvents`
serves one event loop with no history or cross-replica delivery. It separates
view/tenant/app addresses, bounds each queue to 256 pending events, and closes
overflowing subscribers. Payloads default to 1 MiB; all limits are configurable.
Subscriptions are async context managers. The application closes its transport
at shutdown, releasing idle subscribers; request cancellation stops pending reads
and mapper I/O. Publication bytes prevent mutable values leaking across subscribers.

```python
import asyncio
import anyvali as av
from betterportal.sse import LocalEvents, SseRoute, EventScope

async def example():
    transport = LocalEvents()
    try:
        route = SseRoute("clock.index", av.string(), av.string(), lambda value, context: value, transport=transport)
        scope = EventScope("tenant-from-context", "app-from-context")
        async with route.subscribe(scope, None) as events:
            await route.publish(scope, "tick")
            assert await events.__anext__() == "tick"
    finally:
        await transport.aclose()

asyncio.run(example())
```

`route.wire(scope, context, render=...)` owns the subscription and yields UTF-8 SSE
messages. The optional async or sync renderer returns HTML; failures emit a generic
`error` event and later events continue. Without a renderer, strings are sent as
text and other values as JSON. Close the generator with `contextlib.aclosing`
when stopping early. Operation authorization and renderer selection remain host work.
`encode_event` also supports bounded event names/IDs, retry, empty data and multiline
text per [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).
The default data bound is 1 MiB before SSE line prefixes; names/IDs are limited to
1 KiB. Hosts set `Content-Type: text/event-stream`, disable response caching and
flush each message; the codec does not schedule heartbeats or keep replay history.

`betterportal.streaming.StreamHandler` validates each item and optional `Summary`
before delivery. Its response schema is derived from the item/summary AnyVali
documents, preserving recursive definitions. `frames`, `ndjson` and `sse` pull only as
the consumer advances; `buffered` defaults to 10,000 items and 8 MiB, and each
frame defaults to 1 MiB. Limits are configurable. Cancellation propagates and
closes the producer; buffered cancellation never returns partial success. Close
iterators with `contextlib.aclosing` when leaving early. Producer I/O must be
cancellation-aware. Errors expose generic messages without producer secrets.

```python
import asyncio
from betterportal.contracts import contract
from betterportal.streaming import StreamHandler, Summary

async def produce(context):
    yield {"result": [None, 1]}
    yield Summary({"total": 1})

handler = StreamHandler(contract("JsonValueSchema"), produce, contract("JsonValueSchema"))
assert asyncio.run(handler.buffered(None))["summary"] == {"total": 1}

async def wire():
    return [message async for message in handler.sse(None)]
messages = asyncio.run(wire())
assert messages[-1] == b'event: end\ndata: {"kind":"end","count":1}\n\n'
```

These helpers do not yet supply operation hosting or themed stream renderers.

`betterportal.media.negotiate` selects JSON, HTML (page/fragment/embed), metadata,
or NDJSON from Accept and the operation's available representations. It honors
specific exclusions, q=0 and request-order ties, and raises `NotAcceptable` (406)
when no representation is acceptable. Theme parameters never select a renderer.
The host must supply availability after resolving the exact app shell renderer.

```python
from betterportal.media import negotiate

assert negotiate("text/html;mode=fragment").mode == "fragment"
assert negotiate("application/x-ndjson,application/json;q=0.5", ["json"]).kind == "json"
```

Implemented: embedded canonical AnyVali 1.1.1 contracts, RS256 keys and token
purposes, tenant/app-bound refresh pairs, config-ticket scope/action checks, and
service authorization against current scoped bindings and grants, static JWKS
imports and a cancellable remote JWKS cache. Cryptography
uses PyJWT/OpenSSL; validation uses AnyVali exclusively.

`betterportal.authorization.authorize_request` accepts a trusted `AuthContext`
from one scoped snapshot and enforces user/service/delegated caller policy.
User role IDs expand through current app grants, with trusted service aliases.
Root elevation requires the configured management tenant/app. Delegated requests
must satisfy both user permissions and the current delegated service grant.
The lower-level `security.authorize_service` checks only the machine half.
Optional invalid user auth yields an anonymous result; malformed/revoked machine
envelopes fail closed. Tenant/app hints never establish request scope.

```python
import asyncio
from betterportal.authorization import AuthContext, authorize_request
from betterportal.security import KeyPair, TokenIssuer, uuid7

async def example():
    key, tenant, app = KeyPair.generate(), uuid7(), uuid7()
    trusted_keys = {key.kid: key.public_key_pem}
    pair = TokenIssuer(key, "https://auth.example", "app").issue_pair(
        {"sub": "user-1", "tenantId": tenant, "appId": app, "roles": []}, include_refresh=False)
    context = AuthContext(tenant, app, {"serviceId": uuid7(), "expectedIssuer": "https://auth.example",
        "expectedAudience": "app", "jwksUri": "https://auth.example/jwks", "roles": []}, trusted_keys.__getitem__)
    caller = await authorize_request({"authorization": "Bearer " + pair["accessToken"]}, {"required": True},
        context, view_id="hello", method="GET")
    assert caller.user is not None and caller.user["sub"] == "user-1"
asyncio.run(example())
```

Configuration encryption supports existing BP v1 reads, v2 strings, v3 typed JSON,
and authenticated preview envelopes. `preview_schema` builds scoped field schemas
from canonical descriptors; `encrypt_preview`/`decrypt_preview` use AnyVali's native
sensitive traversal. Optional fields remain omitted; public/protected fields are
unchanged. Values have a 1 MiB UTF-8 byte limit, and malformed encodings fail closed.

```python
from betterportal.encryption import ConfigCipher, generate_preview_key, encrypt_preview_value, decrypt_preview_value

cipher = ConfigCipher(ConfigCipher.generate_key())
assert cipher.decrypt(cipher.encrypt({"enabled": True, "value": None})) == {"enabled": True, "value": None}
key = generate_preview_key()
encrypted = encrypt_preview_value(key, "tenant", ["token"], "")
assert decrypt_preview_value(key, "tenant", ["token"], encrypted) == ""
```

Persist generated keys with the service's protected bootstrap state. The cipher
holds only two derived keys per instance; it has no global cache of secrets.
Persistent settings, legacy-marker adaptation, redaction and atomic preview
snapshot application are the next configuration gate.

```sh
python -m pip install -r framework/conformance/requirements.txt
python -m build framework/python
python -m mypy framework/python/betterportal --follow-imports=silent --follow-untyped-imports
```

Wheels and source distributions embed the shared contract corpus. Building a
wheel from its source distribution and importing it require neither Node nor BSB.
The repository build copies those documents; there is no independently maintained
Python schema definition. `betterportal.contracts.document` returns a portable
document; `contract` imports it natively, including when selecting a named field.
`object_document` composes portable roots before importing, retaining recursive
definitions and rejecting conflicting definition names.

Native input/output typing is generated from those documents:

```sh
bp-python types --contracts ./contracts --output ./generated_types.py
bp-python types --contracts ./contracts --output ./generated_types.py --check
```

`python -m betterportal` is equivalent to `bp-python`. Use `--platform` instead of
`--contracts` to regenerate the embedded BP types. `betterportal.generated_types`
exports `TypedDict` declarations, enums as `Literal`, and recursive aliases.
Input types allow omitted defaults; output types require materialized defaults.
Nullable fields remain distinct from optional fields. AnyVali performs all runtime
validation. Python represents AnyVali tuples as lists; positional constraints,
general intersections and coercion inputs cannot always be expressed precisely by
Python typing and remain in the AnyVali document.

```python
from betterportal.contracts import parse
from betterportal.security import KeyPair, TokenIssuer, uuid7

settings = parse("JsonObjectSchema", {"feature": {"enabled": True}})
issuer = TokenIssuer(KeyPair.generate(), "https://auth.example", "my-app")
pair = issuer.issue_pair({
    "sub": "user-1", "tenantId": uuid7(), "appId": uuid7(), "roles": ["reader"],
    "authProvider": "example", "refreshContext": {"subject": "user-1"},
})
```

Use persistent signing material for a real issuer; this example generates an
ephemeral key. Key persistence is not provided yet.
`verify_token` requires an explicit purpose, trusted key resolver, issuer and
audience (setup tokens have no audience). Setup claims still need binding to the
intended installation; accepting a valid signature alone is insufficient.

`betterportal.keys.JwksClient(issuer, uri)` is an async context manager; pass its
`resolve` method as the trusted key resolver. It coalesces concurrent refreshes,
caches for 30 minutes, throttles unknown-key refreshes for two seconds, and
supports `invalidate()` on scoped key changes. Closing cancels outstanding
refreshes. HTTPS is required except exact localhost/127.0.0.1/[::1] HTTP URLs.
Redirects are rejected; complete responses have a five-second deadline and
1 MiB limit. A configured JWKS query is allowed. The `secure_endpoint` helper
defaults to rejecting queries for control-plane base URLs.

The shared [security HTTP suite](../conformance/security_cases.py) passes 459
scenarios across Node, Python and .NET. The [schema gate](../conformance/README.md)
still exposes two AnyVali 1.1.1 compatibility issues. Do not treat package builds
as evidence that the full framework plan is complete. Nothing is published.
