# BetterPortal Python port

Python 3.10+. This is an in-progress framework with prototype Starlette/ASGI
hosting for JSON, HTML, raw, finite streams and subscriber feeds. It is **not ready for production**:
full theme helpers, route tooling and streaming dependency clients
remain in the [capability ledger](../conformance/CAPABILITIES.md).

Install `betterportal[asgi]` and an ASGI server such as Uvicorn. `create_app(service)`
in `betterportal.asgi` owns the `Service` lifespan. A service combines a registry,
manifest declaration and optional validated `ScopedConfig`. With no snapshot its
public health endpoint returns only `{"ok": false}` with status 503; a local
snapshot enables request handling. `ControlPlaneSync` supplies automatic managed
synchronization, described below. Authorized health diagnostics remain pending.

The host resolves scope, checks local operation mounts and CORS, and verifies user
or delegated/service credentials before invoking handlers. It preserves repeated
query/form values and field-name case. `RequestContext.multipart` contains the
canonical parsed form fields and uploads (file data is an array of byte values).
Body buffering defaults to 1 MiB, configurable through `max_body_bytes`; forms
permit at most 1,000 fields and 100 files, with 1 MiB per text field. File resources
close after parsing. Disconnects cancel handler waits.

JSON and BP metadata negotiation are supported. Metadata requires the operation's
authorization and does not execute its handler. Health, manifest and schema JSON
discovery are public. Finite handlers also support NDJSON and SSE, described below. Configure trusted
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

`Operation`, `Route` and `Registry` register JSON/raw/finite handlers and derive canonical
manifests and discovery schemas from their AnyVali schemas. Every operation needs
an explicit `auth` declaration and a unique stable ID. Methods share the view's
params schema; their query, headers, body, response and policy remain separate.
Dependency aliases resolve to plugin IDs, and local dependencies must exist with
the declared method. Path variants belong to one view and publish API contracts
once. Directory discovery remains pending.

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
a generic 500. Disconnects cancel async callbacks. Theme resources and global
status renderers remain pending.

Handlers and renderers receive `context.urls`. `route(view_id, options)` builds
service request URLs; `ui_route(...)` builds navigation links only for enabled
mounted GET pages. Both resolve declared dependency aliases, plugin IDs and exact
instance IDs. Missing params or ambiguous destinations return `None`. Local
optional routes select the most specific satisfiable path. Cross-service requests
merge fixed mount params with explicit params; navigation uses public path params.
`absolute=True` resolves a trusted service/app origin. These helpers neither send
requests nor attach credentials; every destination still authorizes its callers.

```python
from betterportal.urls import Urls

url = Urls.path("/items", {"query": {"name": "Hi BP", "omit": None}, "fragment": "nav.profile"})
assert url == "/items?name=Hi+BP&_f=nav.profile"
assert Urls.form("/items", {"method": "POST", "target": "#items"})["hx-post"] == "/items"
```

`current`, `path`, `link`, `form` and `current_ui` support query encoding,
components, fragments, SSE URLs and HTMX attribute maps. Escape attribute values
when writing HTML. `element(reference)` resolves a single app-mounted service
fragment or a shell fragment, returning `url`/`serviceId` or an `unavailable`
reason. URL helpers retain only navigation data. They ignore credential-bearing
or non-HTTP service origins and reject path traversal/network-path references.
Rendered HTML rewrites quoted `{view.id}` tokens in supported request attributes;
unresolved tokens remain unchanged. Use `ui_route` for internal page anchors.

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

AnyVali 1.1.2 treats explicit null as present and applies defaults only to omitted
input. Snapshot validation therefore rejects `active: null`; BP still uses AnyVali
as its only validator.

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
when stopping early. `SseFeed` supplies operation authorization and renderer selection
through the host, as shown below.
`encode_event` also supports bounded event names/IDs, retry, empty data and multiline
text per [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).
The default data bound is 1 MiB before SSE line prefixes; names/IDs are limited to
1 KiB. Hosts set `Content-Type: text/event-stream`, disable response caching and
flush each message; the codec does not schedule heartbeats or keep replay history.

`SseFeed` binds that contract to an existing GET handler. Register it as `Route(...,
sse=feed)` to expose `<path>/__sse`, including optional path variants. The connection
inherits GET input schemas, authentication, permissions and tenant/app mounts without
executing the GET function. Publish with `await feed.publish(trusted_scope, value)`.
The transport belongs to the application; disconnects and service shutdown release
request subscriptions without closing a shared transport.

Tick renderers must match a success fragment on the owning GET handler. `_f=nav.clock`
selects that tick and the resolved app's shell selects the theme. Missing ticks return
406; a fragment-only mount cannot expose raw events through a missing tick or an
Accept header. Components are unavailable on feeds. Without `_f`, strings are text
and other values are JSON. Mapping/validation failures close the connection; renderer
failures emit a safe error and allow subsequent events. HEAD opens no subscription.

```python
import asyncio
from html import escape
from typing import Any
import anyvali as av
from betterportal.feeds import SseFeed
from betterportal.handler import Handler, HandlerContext
from betterportal.registry import Operation, Route, Registry
from betterportal.rendering import Renderer
from betterportal.sse import LocalEvents, SseRoute

async def example():
    transport = LocalEvents()
    try:
        fragment = Renderer[str]({"renderer": "bootstrap5", "kind": "fragment", "key": "nav.clock"},
                                 lambda value, context: f"<span>{escape(value)}</span>")
        handler = Handler[Any, Any, Any, Any, str](av.string(), lambda context: "Waiting", renderers=[fragment])
        contract = SseRoute[str, str, HandlerContext[Any, Any, Any, Any]]("clock.index", av.string(), av.string(),
            lambda value, context: value, transport=transport)
        feed = SseFeed(handler, contract, renderers=[fragment])
        registry = Registry([Route("clock.index", "/clock", [Operation(handler, {
            "operationId": "clock.get", "method": "GET", "title": "Clock", "description": "Live clock", "auth": {}
        })], sse=feed)])
        assert registry.routes[0].sse is feed
    finally:
        await transport.aclose()

asyncio.run(example())
```

The existing BP browser assets consume `/clock/__sse?_f=nav.clock` with
`hx-sse:connect`. No template engine, replay history or external broker is added.

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

`FiniteHandler` registers the same producer as a GET `Operation`. JSON and
page/fragment/component renderers consume its bounded buffered result. NDJSON
streams validated JSON frames; a GET operation also owns `/<path>/__sse`, with the
same tenant/app, origin, operation and authentication checks. Stream connections
reject fragment/component selectors. Metadata and streamed HEAD requests never
start the producer. Hosts pull one chunk at a time and close it on disconnect.

`StreamRenderers` selects the exact app shell renderer. Its shell receives the
canonical `StreamShellContext` and returns HTML with a connection URL; it never
runs the producer. SSE item/summary/error callbacks receive validated values and
the safe `RenderContext`. Callbacks return HTML strings and URL tokens are
rewritten through the existing helpers. A matching page renderer buffers full
page requests; fragment mode selects the stream shell. Without a matching stream
renderer SSE carries JSON frames. Each consuming request creates its own stream.

```python
from html import escape
from betterportal.contracts import contract
from betterportal.finite import FiniteHandler, StreamRenderers
from betterportal.registry import Operation, Route, Registry
from betterportal.streaming import Summary

async def rows(context):
    yield "First row"
    yield Summary(1)

handler = FiniteHandler(contract("JsonValueSchema"), rows,
    summary=contract("JsonValueSchema"), stream_renderers=[StreamRenderers("bootstrap5",
        shell=lambda data, context: '<div hx-ext="sse" hx-sse:connect="' + escape(data["sseConnectPath"], quote=True) + '"><div sse-swap="item" hx-swap="beforeend"></div></div>',
        item=lambda value, context: "<p>" + escape(value) + "</p>")])
registry = Registry([Route("rows", "/rows", [Operation(handler, {
    "operationId": "rows.get", "method": "GET", "title": "Rows", "description": "Stream rows", "auth": {}})])])
assert registry.routes[0].operations[0].handler is handler
```

Mount this registry with `Service` and `create_app` as above. The consuming shell
loads BP's existing HTMX/SSE browser assets; the runtime does not add a template
engine. Global theme helpers remain pending.

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

Implemented: embedded canonical contracts validated with AnyVali 1.1.2, RS256 keys and token
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
`SettingsSchema` compiles config descriptors whose `jsonSchema` contains an
AnyVali object document. Descriptor fields must match its properties; field scopes
control writes. The native document owns defaults, coercion, required fields and
nested unknown-key behavior. A descriptor `defaultValue`, when present, must match
that native field default. Partial stored overrides never materialize defaults;
`effective(tenant, app)` applies tenant defaults followed by app overrides.

```python
import anyvali as av
from betterportal.encryption import ConfigCipher
from betterportal.settings import SettingsSchema, ServiceSettings
import asyncio

policy = SettingsSchema([{"id": "settings", "title": "Settings", "description": "Settings", "scope": "tenant",
    "jsonSchema": av.export_schema(av.object_({"secret": av.string()}, required=[])),
    "fields": [{"key": "secret", "title": "Secret", "description": "Service credential", "scope": "tenant",
        "visibility": "secret", "ownership": "bp", "sourceOfTruth": "bp"}]}])
cipher = ConfigCipher(ConfigCipher.generate_key())
stored = policy.encode("tenant", {"secret": "example"}, cipher)
assert stored["secret"].startswith("enc:aes256gcm2:")
assert policy.decode("tenant", stored, cipher) == {"secret": "example"}
assert policy.redact("tenant", {"secret": "example"}) == {"secret": "__redacted__"}
assert policy.merge("tenant", {"secret": "example"}, {"secret": "__redacted__"}) == {"secret": "example"}
assert policy.values("tenant", {}) == {}

async def main():
    async with ServiceSettings(policy, cipher) as settings:
        await settings.write("tenant", {"secret": "example"})
        assert settings.values("tenant", redacted=True) == {"secret": "__redacted__"}
        assert settings.effective("tenant", "app") == {"secret": "example"}

asyncio.run(main())
```

Native AnyVali sensitive APIs perform encryption/decryption and redaction traversal.
Top-level sensitive fields preserve Node's `enc:` envelopes; nested sensitive fields
retain the native `encrypted:` prefix around a BP envelope. Ordinary strings are
never rewritten. `merge` validates field scopes, explicit clears and secret
placeholders, including nested arrays. A placeholder cannot create a missing secret
or move an existing secret into a public union branch. Real replacement values win
over `clear_keys`; a cleared secret cannot simultaneously use a preserve placeholder.
AnyVali 1.1.2 applies native transforms, redaction and encrypted-storage validation
to direct sensitive ref nodes at the ref's value path. BP's descriptor visibility
annotates native fields directly without changing their requiredness.

`ServiceSettings` serializes writes and owns encrypted tenant/app state. Supply a
`FileStateStore(path)` as its third argument for persistence; omission uses memory.
Call `initialize()` before reads/writes, or use its async context manager. Loading
validates the whole cache before publishing it. A failed save or cancellation before
commit preserves both disk and active values. Writes combine clears and replacements
in one commit. `values` returns stored overrides; `effective` adds native defaults.
Reads return owned copies. Closing cancels pending writes and rejects further access.

The portable cache reads Node's encrypted tenant/app files. Bare legacy buckets or
the `legacy` envelope require `initialize(legacy_tenant_id=...)`; migration persists
that explicit owner before becoming ready and rejects an existing owner bucket.
Unmarked plaintext secrets and tampered ciphertext are rejected. Keep the encryption
key in protected storage. One instance owns each file; shared replicas need a
configured repository/transport.

Pass `ConfigApi(settings, issuer=cp_url, jwks_uri=cp_jwks_uri)` to the service's
`config_api` argument. Its settings descriptors must match the manifest. The host
initializes settings before serving and owns their shutdown. For example, this
factory returns an unready managed service to connect with `ControlPlaneSync`:

```python
from betterportal.config_api import ConfigApi
from betterportal.contracts import parse
from betterportal.encryption import ConfigCipher
from betterportal.registry import Registry
from betterportal.service import Service
from betterportal.settings import SettingsSchema, ServiceSettings
from betterportal.storage import FileStateStore

def configured_service(registry: Registry, declaration: dict, cp_url: str, jwks_uri: str, key: str, settings_path: str):
    manifest = parse("ManifestDeclarationSchema", declaration)
    settings = ServiceSettings(SettingsSchema(manifest["configSchemas"]), ConfigCipher(key), FileStateStore(settings_path))
    return Service(registry, manifest, managed=True,
        config_api=ConfigApi(settings, issuer=cp_url, jwks_uri=jwks_uri))
```

`GET /.well-known/bp/config/schema` is public. GET/POST on `/.well-known/bp/config`
require CP-signed `config.read`/`config.write` tickets for the manifest plugin ID.
The ticket supplies the tenant. GET's optional `X-BP-App-Id` selects stored app
overrides; POST uses the canonical tenant/app/values/clearKeys body. Active tenants
and `configApps` (or `apps` when absent) restrict access. Conflicting scope headers
are rejected. Responses redact secrets and disable caching. Preflights authorize
only management origins, before ticket verification. HEAD follows GET policy.

`mode`, `custom_ui_path` and `writable` describe API capabilities; ownership mode
does not grant access. Missing read/write support returns 501. Invalid field input
returns 400; storage failures return 500 and preserve previous values. Shutdown
cancels pending writes. A snapshot change during ticket verification rejects the
request; a committed write finishes before a queued snapshot replacement.

Handlers receive stored settings plus native defaults and preview overrides.
Preview values validate before snapshot publication and never overwrite the settings
file. Missing required effective values return 503 on operations while the config
API remains available to supply them. Public health reflects initialized state and
managed manifest acknowledgment. HTTP provisioning remains work; protected key storage is described below.

`dev_token` is accepted only when explicitly supplied and
`BP_ALLOW_DEV_CONFIG_TOKEN=true` at construction. It requires an explicit tenant
header and the same scope checks; it is a local-development option. Without pinned
CP trust or this explicit opt-in, the API rejects every ticket.

`Service.apply_snapshot` validates a complete scoped document and preview values,
persists it through the supplied `StateStore`, then replaces active policy. Failed
validation, decryption, saving or cancellation before commit preserves the previous
snapshot. Requests capture one snapshot; an update during authentication returns
503. Successful updates retire old JWKS caches and rebuild URL and access policy.

`FileStateStore` writes a sibling file, flushes it, then atomically replaces its
target. The default limit is 16 MiB. Use one writer per file; replicated services
need a configured transactional store. Files use POSIX mode 0600 or the directory's
Windows ACL. The store does not supply key management or cross-replica delivery.

```python
import asyncio
from pathlib import Path
import tempfile
from betterportal.registry import Registry
from betterportal.service import Service
from betterportal.storage import FileStateStore

async def main():
    declaration = {"pluginId": "com.example.service", "title": "Example", "description": "Example", "version": "1.0.0"}
    with tempfile.TemporaryDirectory() as directory:
        store = FileStateStore(Path(directory) / "snapshot.json")
        async with Service(Registry([]), declaration, state_store=store, managed=True) as service:
            await service.apply_snapshot({"managementOrigins": [], "tenants": [], "apps": []})
            assert service.snapshot() is not None and not service.ready
        async with Service(Registry([]), declaration, state_store=store, managed=True) as restored:
            assert await restored.restore_snapshot()
            assert not restored.ready

asyncio.run(main())
```

Managed readiness additionally requires `manifest_submitted=True` on an update
from an acknowledged manifest POST. Restoring a cache cannot supply that proof;
`ControlPlaneSync` supplies it after a successful POST and persisted snapshot. `preview_key` decrypts preview
settings only for one unambiguous active tenant/app. Both scopes must validate
before publication. Their merged values appear in `RequestContext.config`; only
the encrypted snapshot is persisted. Removing preview config removes that overlay.

`ControlPlaneSync` owns manifest submission, scoped SSE updates and reconnect/poll
fallback. Pass a managed service and its provisioned CP URL/API key. HTTPS is required;
plain HTTP permits only exact `localhost`, `127.0.0.1` and `[::1]` hosts. Redirects
are rejected. Each connection starts with a manifest POST; a failed first attempt
leaves health at 503 and retries after five seconds. Poll requests and idle stream
reads time out after 30 seconds. Payloads and individual SSE frames are bounded to
16 MiB. Invalid updates preserve the last accepted snapshot; 401/403/409/412 revoke
readiness until a new manifest is accepted. Transient failures retain valid policy.

```python
from betterportal.asgi import create_app
from betterportal.registry import Registry
from betterportal.service import Service
from betterportal.storage import FileStateStore
from betterportal.sync import ControlPlaneSync

def managed_app(cp_url: str, api_key: str, cache_path: str):
    service = Service(Registry([]), {"pluginId": "com.example.service", "title": "Example",
        "description": "Example", "version": "1.0.0"}, managed=True, state_store=FileStateStore(cache_path))
    sync = ControlPlaneSync(service, cp_url, api_key)
    return create_app(service, sync=sync)
```

Use your operation registry in this factory, and expose its returned app to your
ASGI server. The host starts synchronization and closes it before the service at
shutdown. Without a host, use `async with service` and `async with sync`, in that
order. `await sync.start()` returns the first bootstrap result; `await sync.aclose()`
cancels pending requests/retries and clears managed readiness. `sync.status` returns
safe counters/error codes; protect any endpoint exposing them. `sync.submission()`
returns the portable typed manifest projection. Optional `key_pair` registers a
previously persisted RSA public key, and `auth_provider` advertises issuer metadata.
Provisioning/install ticket hosting remains separate work.

`BootstrapStateStore` protects provisioned credentials and a persistent RSA signing
identity with the Node-compatible authenticated bootstrap envelope. Supply its
master key from a protected host secret. Generate that key once with
`BootstrapCipher.generate_key()` and retain it separately; generating a new master
key on every startup makes existing state unreadable.

```python
import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
from betterportal.bootstrap import BootstrapCipher, BootstrapStateStore
from betterportal.storage import FileStateStore

async def bootstrap_example():
    with TemporaryDirectory() as directory:
        master_key = BootstrapCipher.generate_key()  # Example only: retain securely in production.
        file = FileStateStore(Path(directory) / "bootstrap.json")
        state = BootstrapStateStore(file, master_key)
        await state.write({"cpUrl": "https://cp.example", "apiKey": "bp_sk_t_example"})
        identity = await state.identity()
        restarted = BootstrapStateStore(file, master_key)
        assert (await restarted.identity()).kid == identity.kid
        assert (await restarted.read(redacted=True))["apiKey"] == "__redacted__"

asyncio.run(bootstrap_example())
```

`write` atomically merges a validated patch; `read` returns owned state. `identity`
loads or atomically creates one RSA key inside that encrypted state. `clear`
explicitly removes both credentials and identity. Corrupt files, invalid master
keys and mismatched public/private keys fail without replacement. Keep one owner
per store; use a transactional implementation for shared storage. No plaintext
cache or background tasks are retained. Caller cancellation propagates before
commit. Pass the returned identity to `ControlPlaneSync(key_pair=...)` or
`TokenIssuer`, or let `ServiceInstallation` own it.

`ServiceInstallation` supplies the setup-token installation endpoint and public
JWKS, restores protected credentials, activates ticket-protected settings and owns
manifest synchronization. Configure CP trust and the public service origin in the
host; forwarded headers and the setup body cannot select either. The installer
requires a fresh managed `Service` and owns its sync lifecycle.

```python
from pathlib import Path
from betterportal.asgi import create_app
from betterportal.bootstrap import BootstrapStateStore
from betterportal.installation import ServiceInstallation
from betterportal.registry import Registry
from betterportal.service import Service
from betterportal.storage import FileStateStore

def installable_app(cp_url: str, public_origin: str, master_key: str, state_directory: str):
    directory = Path(state_directory)
    service = Service(Registry([]), {"pluginId": "com.example.service", "title": "Example",
        "description": "Example", "version": "1.0.0"}, managed=True,
        state_store=FileStateStore(directory / "snapshot.json"))
    installation = ServiceInstallation(service,
        BootstrapStateStore(FileStateStore(directory / "bootstrap.json"), master_key), cp_url, public_origin,
        settings_store=FileStateStore(directory / "settings.json"))
    return create_app(service, installation=installation)
```

Use your operation registry and separately protected master key in this factory;
serve its returned ASGI app. Startup without credentials exposes public keys and
health 503. POST `{"setupToken":"...","cpUrl":"https://cp.example"}` to
`/.well-known/bp/install`. A successful installation returns 200 after the manifest
and scoped snapshot are accepted. Failed first sync returns 503 with `installed:
true` and retries using durable credentials. Redemption/persistence failures never
make the service ready. Native responses omit the API key.

Replaying the same setup JTI reuses committed credentials; a new signed token may
rotate credentials for the same instance. Tenant-scoped installation stores its
signed tenant as `tenantLock`; operation requests for another tenant return 426,
and config tickets for another tenant are denied. Platform installation without a
tenant scope can serve the CP's permitted tenants. Existing tenant locks survive
reconfiguration and restart. An existing Node bootstrap file can be loaded with
its master key; reconfiguration requires a synchronized matching instance.
Optional `cp_jwks_uri` pins an alternate JWKS endpoint; `auth_provider` advertises
provider metadata. Config descriptors require a settings store. `config_mode`,
`custom_ui_path`, and `writable` configure the existing `ConfigApi` policy.
Shutdown cancels and drains installation/sync before closing the service. Keep one
owner per state store; these file stores do not coordinate replicas.

To change the public hostname, keep the same protected state, configure the new
`service_url`, and restart. A stored-address mismatch leaves health 503 until
POST `{"changeToken":"bp_hc_..."}` to `/.well-known/bp/hostname-change` confirms
the CP-issued token. The runtime method is `await installation.change_hostname(body)`.
The configured origin supplies the new address; forwarded headers cannot change
it. Confirmation checks the CP's current instance/address projection before
atomically updating the binding and restarting sync. Credentials, signing identity
and tenant lock are preserved. If CP confirmation succeeds but local persistence
fails, obtain a fresh token and retry; if local persistence succeeded, restart can
resume sync. See [the hostname protocol](../../spec/config.md#23-standalone-hostname-changes).

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
definitions and extensions and rejecting conflicting names or document versions.
AnyVali 1.1.2 native-parent export also preserves recursive definitions; the helper
remains useful for portable extension and version checks.

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
ephemeral key. Use `BootstrapStateStore.identity()` for persistent signing material.
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
scenarios across Node, Python and .NET. The Windows [schema gate](../conformance/README.md)
passes 1,446/1,446 scenarios with AnyVali 1.1.2, including all 30 former SDK
compatibility failures. See the conformance ledger for runtime results and remaining
capabilities. Do not treat package builds as evidence that the full framework plan
is complete. Nothing is published.

## Scoped dependency clients

Load a dependency's exported `BpSchemaOutput` with `ClientContract(document)`.
Inside a handler, `context.request_context.clients.user(contract, service_id)`
selects an enabled instance or registry alias and forwards the verified original
user bearer. Its selected operation must be mounted in the current app; public
operations can be called anonymously. Credentials are absent from render contexts.
Call `await client.request(operation_id, {"params": ..., "query": ..., "headers": ..., "body": ...})`.
AnyVali validates each method's inputs and JSON output. Omit unused input keys;
an explicit body null remains a JSON null when its schema permits it.

Use `context.request_context.clients.m2m(request_id, contract)` for a declared
service or delegated dependency. The manifest request selects the mode. Each call
checks current bindings, grants, methods, permissions and capabilities, then mints
a service token lasting at most 60 seconds. Delegated calls retain the original
user bearer as well. Background work uses `service.clients.scope(tenant_id, app_id)`
and supports service mode only. Supply `signing_key` to a locally configured service;
installation/control-plane sync supplies its persisted key automatically. The
scoped snapshot must confirm the public key and key ID before tokens can be sent.

```python
import asyncio
import anyvali as av
from betterportal.clients import ClientContract, ClientError
from betterportal.handler import Handler
from betterportal.registry import Operation, Route, Registry
from betterportal.service import Service

async def check():
    declaration = {"pluginId": "com.example.peer", "title": "Peer", "description": "Example", "version": "1.0.0"}
    registry = Registry([Route("value", "/value", [Operation(Handler(av.string(), lambda context: "value"),
        {"operationId": "value.get", "method": "GET", "title": "Value", "description": "Read value", "auth": {}})])])
    contract = ClientContract(registry.schema(declaration))
    async with Service(Registry([]), declaration) as service:
        client = service.clients.scope("01952200-0000-7000-8000-000000000001",
                                       "01952200-0000-7000-8000-000000000002").m2m("read", contract)
        try:
            await client.request("value.get")
            raise AssertionError("An unready service made an outbound call")
        except ClientError as error:
            assert error.status == 503

asyncio.run(check())
```

Destinations require HTTPS, with the same exact-loopback HTTP exceptions as sync.
Clients reject redirects, cookie replay and caller overrides of BP routing/auth
headers. JSON requests/responses are bounded to 16 MiB, URLs to 8,192 characters,
and transport waits to 30 seconds; unsolicited compressed responses are rejected.
Snapshot replacement invalidates captured request clients and pending responses;
background clients resolve policy again on each call. Cancellation and service
shutdown stop pending HTTP work. `ClientError` exposes the upstream status with a
generic message; upstream error bodies are never included. Raw/streaming dependency
responses remain delivery work.

Generate a typed JSON client from the dependency's exported BP schema:

```sh
bp-python client --contract contracts/peer.json --output dependencies/peer.py --class-name PeerClient
bp-python client --contract contracts/peer.json --output dependencies/peer.py --class-name PeerClient --check
```

Import `PeerClient` from that generated module and construct it with
`PeerClient(context.request_context.clients, service_id="peer")` for user calls,
or `PeerClient(context.request_context.clients, request_id="read-item")` for a
declared service/delegated request. An operation `check.get` becomes
`await client.check_get({"params": {"key": "item"}})`. Input TypedDicts preserve
required fields, defaults and nullable values; return types describe validated
JSON. Undeclared schemas remain generic JSON mappings. Each generated module embeds
the contract and uses the runtime's policy, transport and shutdown handling.
`--check` detects stale generated code without writing files. Neither command
requires Node or BSB. AnyVali 1.1.2 preserves Python's empty and from-string
coercion configurations through export and reimport.

## Local dependencies and frozen builds

Keep registry identity and dependency selectors in `betterportal.json`. Install
an exported service project without Node or BSB:

```sh
bp-python deps add example/service@1.0.0 --path ../service --alias peer --project .
bp-python deps sync --frozen --project .
bp-python deps sync --frozen --check --project .
```

The provider directory contains `bp-contract.json` or `lib/bp-contracts/*.json`.
Its `betterportal.json` supplies `registryRef`; a full reference in the selector
can supply it when absent. Exact versions and identities must match, and ambiguous
exports fail. The generated client is `bp_dependencies/dep_peer.py`, with class
`DependencyClient`. Its constructor and methods use the scoped client API above.
Aliases that collide in native filenames are rejected before files change.

The lock retains `registryRef`, `pluginId`, `version` and `digest`, adding
`digestFormat: "json-bytes"`. The SHA-256 digest covers the exact cached UTF-8
document. Frozen builds use that cache, verify the configured identity/version,
and validate every dependency before updating generated sources. They perform no
network lookup or local override discovery; `--check` performs no writes.
Explicit installation can migrate a legacy Node lock. Native frozen builds reject
legacy locale-dependent digests; Node's CLI supports both formats. Automatic local
discovery and route scaffolding remain delivery work.

## Registry installation and publishing

```sh
bp-python deps add example/service@1.0.0 --alias peer
bp-python deps add com.example.service@1.0.0 --alias peer
bp-python publish --contract bp-contract.json --project .
```

Without `--path`, installation uses `BP_REGISTRY_URL` (default
`https://io.betterportal.org`); `--registry URL` overrides it. Short names use
`defaultNamespace` or require a unique registry match. An explicit version is
fetched after short-name resolution; omitted versions and `latest` resolve the
registry's current version. Installation pins the exact response bytes and uses
the same offline frozen-build commands above.

Publishing requires the project's `registryRef` and a `BP_REGISTRY_TOKEN`
environment variable. It submits an existing exported contract; the registry
enforces publisher prefixes, permanent identity bindings and immutable versions.
Identical retries return `unchanged: true`. Running `publish` writes to the
selected registry. These tools do not build or export your service implicitly.

Both commands require HTTPS with exact-loopback HTTP exceptions, reject
redirects and compressed/non-JSON responses, and enforce 16 MiB payload limits
and a 30-second total deadline per request. They send no environment proxy
credentials or stored cookies; publisher credentials are never sent on lookups
or included in upstream error messages.

## Export an application contract

Define a synchronous factory in your application module, using the same registry
and manifest declaration as the host:

```python
import anyvali as av
from betterportal.generated_types import BpSchemaOutput
from betterportal.handler import Handler
from betterportal.registry import Operation, Registry, Route

def contract() -> BpSchemaOutput:
    handler = Handler(av.string(), lambda context: "Hello")
    registry = Registry([Route("hello.index", "/hello", [Operation(handler, {
        "operationId": "hello.get", "method": "GET", "title": "Hello",
        "description": "Hello operation", "auth": {}
    })])])
    return registry.schema({"pluginId": "com.example.hello", "title": "Hello",
                            "description": "Example service", "version": "1.0.0"})

assert contract()["manifest"]["pluginId"] == "com.example.hello"
```

For a factory in `my_service/definition.py`:

```sh
bp-python export --module my_service.definition:contract --project . --output bp-contract.json
bp-python export --module my_service.definition:contract --project . --output bp-contract.json --check
```

The command imports that explicitly selected module with the project directory on
the Python import path. Module initialization and the factory execute as application
code; keep host startup under its normal entry-point guard. The factory takes no
arguments and returns the registry's contract. Export uses AnyVali validation,
limits the document to 16 MiB and atomically replaces the output. `--check` detects
drift without writing. Output paths are relative to `--project`. No request handler
or host lifecycle is invoked by the exporter. Route-directory discovery remains
delivery work.
