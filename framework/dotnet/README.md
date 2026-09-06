# BetterPortal .NET port

.NET 10. This is an in-progress framework with prototype ASP.NET Core hosting
for JSON, HTML, raw, finite streams and subscriber feeds. Full theme helpers, native route
tooling and generated clients remain in the [capability ledger](../conformance/CAPABILITIES.md).
The cross-language snapshot gate is still blocked by the Python SDK defect below.

Reference `BetterPortal.AspNetCore` for the `MapBetterPortal` WebApplication
extension. A `Service` combines the registry, manifest declaration and optional
validated `ScopedConfig`; dispose it with `await using`. With no snapshot, public
health returns only `{"ok": false}` and status 503. A local snapshot enables
request handling. `ControlPlaneSync` supplies automatic managed synchronization,
described below. Authorized diagnostics remain pending; this prototype must not
replace a deployed full BP runtime.

The adapter enforces scope, local operation mounts, CORS and caller authentication,
then decodes and validates handler inputs. Repeated query/form values and field-name
case survive. `RequestContext.Multipart` is generated from the canonical multipart
contract, including file byte arrays. Body buffering defaults to 1 MiB through
`maxBodyBytes`; form limits are 1,000 fields, 100 files and 1 MiB per text field.
Client cancellation reaches input reads, authentication and handler waits.

JSON and BP metadata negotiation are supported; metadata authorizes the operation
without executing its handler. Health, manifest and schema JSON discovery are
public. Finite handlers also support NDJSON and SSE, described below. Configure ASP.NET Core's trusted
proxy middleware before BP; forwarding headers alone confer no authority.

```csharp
using BetterPortal;
using BetterPortal.AspNetCore;
using Microsoft.AspNetCore.Builder;

await using var service = new Service(new Registry([]), new() {
    PluginId = "com.example.hello", Title = "Hello", Description = "Example service", Version = "1.0.0"
});
var builder = WebApplication.CreateBuilder();
await using var app = builder.Build();
app.MapBetterPortal(service);
if (service.Ready) throw new Exception("A snapshot is required before readiness");
```

After supplying local configuration, start the mapped application with
`await app.RunAsync()`. Build/package the adapter with
`dotnet build framework/dotnet/BetterPortal.AspNetCore` and `dotnet pack` on that
project. No Node or BSB runtime/build hook is required.

`Handler<TParams, TQuery, THeaders, TBody, TResult>` accepts native AnyVali schemas
and a function returning `ValueTask<TResult>`. `Invoke` parses all four inputs
before calling the function and validates its response. The host supplies a
`RequestContext` containing the resolved scope, verified caller, method/path and
config; the helper does not authorize calls. `HandlerInputException` identifies
the invalid field (400), and `HandlerOutputException` reports invalid output (500).
Omitted input containers become `{}`; explicit null stays present. `InputDocument`
exports the four parsed input fields for native type generation. The cancellation
token reaches the handler and cancels its wait. Full handler/render context
helpers remain delivery work.

`Operation`, `Route` and `Registry` register JSON/raw/finite handlers and derive canonical
manifests and discovery schemas from their AnyVali schemas. Operations require
explicit auth and unique stable IDs. Each view shares one params schema across
methods; query, headers, body, response and policy are method-specific. Registry
generation resolves dependency aliases and checks local operation/method targets.
Path variants publish API contracts once per view. Directory discovery remains pending.

`Renderer<TResult>` accepts a function returning HTML as `string` or
`ValueTask<string>`. Register it on the typed handler; ASP.NET Core selects the
exact method, app shell renderer, kind/key and response status. Page is the
default kind; fragments require a `location.id` key and components require an ID.
`_f` overrides an Accept fragment parameter; `_c` selects a component. Ambiguous
selectors fail. Modes are page, fragment and embed. Metadata and manifests derive
from these registrations.

```csharp
using System.Net;
using BetterPortal;
using BetterPortal.Generated;

var renderer = new Renderer<TokenLifetimeConfig>(new() { Renderer = "bootstrap5", Status = 201 },
    (value, context) => $"<p>{WebUtility.HtmlEncode(context.Tenant.Title)}: {value.AccessTokenSeconds}</p>");
var handler = new Handler<object?, object?, object?, object?, TokenLifetimeConfig>(
    Contracts.Get("TokenLifetimeConfigSchema"), context => {
        context.Response.Status = 201;
        context.Response.SetHeader("HX-Trigger", "bp:created");
        return ValueTask.FromResult(new TokenLifetimeConfig { AccessTokenSeconds = 900, RefreshTokenSeconds = 604800 });
    }, renderers: [renderer]);
var operation = new Operation(handler, new OperationDeclarationInput {
    OperationId = "lifetimes.get", Method = HttpMethodInput.GET, Title = "Lifetimes",
    Description = "Render token lifetimes", Auth = new()
});
if (operation.Handler.Renderers[0].Identity.Status != 201) throw new Exception("Missing renderer");
```

`RenderContext` exposes canonical tenant/app presentation fields, parsed
params/query and route selection. Secrets, roles, auth settings and headers are
excluded. Escape dynamic HTML with `WebUtility.HtmlEncode`; no template engine is
required. `context.Response` controls status and application headers
(`append: true` preserves multiple cookies). The adapter owns Content-Type/CORS/
transport headers. Changed HTML statuses require an exact status renderer;
otherwise the response is empty. 204/205/304 always have no body.

`Operation(..., errorRenderers: [new Renderer<ViewRenderError>(...)])` registers
error callbacks separately from successful handler results. Their canonical data
contains only `Error` and `Status`; declarations require status 400–599. Errors
preserve the selected fragment/component. Callback failures return a generic 500.
`context.Cancellation` cancels callback waits; pass it to async I/O. Theme resources
and global status renderers remain pending.

Handlers and renderers receive `context.Urls`. `Route(viewId, options)` builds
service request URLs; `UiRoute(...)` builds navigation links only for enabled
mounted GET pages. Both resolve dependency aliases, plugin IDs and exact instance
IDs. Missing params and ambiguous destinations return `null`. Local optional
routes select the most specific satisfiable path. Cross-service requests merge
fixed mount params with explicit params; navigation uses public path params.
`Absolute = true` resolves a trusted service/app origin. These helpers neither send
requests nor attach credentials; destinations still authorize their callers.

```csharp
using BetterPortal;
using BetterPortal.Generated;

var url = Urls.Path("/items", new() { Fragment = "nav.profile",
    Query = new Dictionary<string, BetterPortalRouteChromeValueInput?> { ["name"] = "Hi BP", ["omit"] = null } });
if (url != "/items?name=Hi+BP&_f=nav.profile") throw new Exception("Query changed");
if (Urls.Form("/items", new() { Method = RouteUiOptionsInputMethod.POST, Target = "#items" })["hx-post"] != "/items") throw new Exception("Form changed");
```

`Current`, `Path`, `Link`, `Form` and `CurrentUi` support query encoding,
components, fragments, SSE URLs and HTMX attribute maps. Escape attribute values
when writing HTML. `Element(reference)` resolves a single mounted service fragment
or shell fragment, returning `Url`/`ServiceId` or an `Unavailable` reason. URL helpers
retain only navigation data; credential-bearing/non-HTTP service origins and path
traversal/network-path references are rejected. Rendered HTML rewrites quoted
`{view.id}` tokens in supported request attributes; unresolved tokens remain.
Use `UiRoute` for internal page anchors.

`RawHandler<TParams, TQuery, THeaders, TBody>` shares input validation and host
authorization with JSON handlers. It returns `ValueTask<RawResponse>`; JSON
handlers reject and dispose raw results. Raw operations publish `raw: true` and
bypass representation negotiation, including a metadata Accept header. Their
metadata remains available through discovery. HEAD uses its GET registration and
policy; the adapter disposes a raw HEAD body without reading it.

```csharp
using BetterPortal;
using BetterPortal.Generated;

var download = new RawHandler<object?, object?, object?, object?>(context =>
    ValueTask.FromResult(RawResponse.File("Hello BP\n"u8.ToArray(), "report.txt", "text/plain")));
var operation = new Operation(download, new OperationDeclarationInput {
    OperationId = "report.get", Method = HttpMethodInput.GET, Title = "Report",
    Description = "Download a report", Auth = new() { Required = true }
});
if (!operation.Handler.IsRaw) throw new Exception("Raw operation was not registered");
```

`RawResponse` accepts bytes or a readable `Stream`; ASP.NET Core owns the returned
stream and asynchronously disposes it on completion, disconnect or failure. Reads
wait for writes, and failures after headers abort delivery. Raw handlers must honor
`context.Cancellation`; the runtime awaits ownership transfer so an abandoned
result cannot leak an open file. `RawResponse.File` accepts content and creates
safe ASCII/UTF-8 download headers. Header pairs preserve repeated cookies. The host
owns CORS/transport headers, computes byte-body length and rejects header injection.
Status 204/205/304 forbids a body; 206 and redirects may carry one.

```csharp
using BetterPortal;
using BetterPortal.Generated;

var handler = new Handler<object?, object?, object?, object?, object?>(
    Contracts.Get("JsonObjectSchema"), context => ValueTask.FromResult<object?>(new { hello = "world" }));
var operation = new Operation(handler, new OperationDeclarationInput {
    OperationId = "hello.get", Method = HttpMethodInput.GET, Title = "Hello",
    Description = "Return a greeting", Auth = new()
});
var registry = new Registry([new Route("hello.index", "/hello", [operation])]);
var manifest = registry.Manifest(new ManifestDeclarationInput {
    PluginId = "com.example.hello", Title = "Hello", Description = "Example service", Version = "1.0.0"
});
if (manifest.Views[0].Operations[0].OperationId != "hello.get") throw new Exception("Operation ID changed");
```

`ScopedConfig` imports the canonical scoped snapshot and checks tenant/app
references, duplicate identities and ambiguous hostnames. Browser lookup compares
scheme/host/port and returns owned tenant/app copies. `ById` resolves a claimed
machine scope before authentication; lookup alone never authorizes a request.
Config-management app indexes do not become runtime app lookups.

`AppAccess(scope, snapshot.LocalServiceIds)` checks operation IDs against enabled
inbound app mounts, with GET-only fragment and slot support. Pass the matched
registered path to `Allows` when a view has path variants. `PermissionAliases()`
includes only enabled local service instances referenced by this app; pass the
route and method to restrict aliases to its mounted operation. `Service` always
applies this restriction. Cross-service
`appRoutes`/`appFragments` catalogs confer no inbound access. Hosts still enforce
caller authorization and representation selection; well-known routes use their
own declared auth policy independently of app page mounts.

Raw proxy and HTMX context headers are ignored. `Resolve(..., trustedAddresses: ...)`
accepts addresses already verified by host proxy middleware; the host supplies
the effective scheme. `OriginPolicy` normalizes HTTP origins and preserves exact
path/query restrictions on referer overrides. Host proxy middleware, full policy
reference validation remain pending. The shared
context gate exposes Python's [AnyVali #127](https://github.com/BetterCorp/AnyVali/issues/127)
null/default defect; .NET rejects the corresponding invalid snapshot.

```csharp
using BetterPortal;

if (HttpAddress.Origin("HTTPS://Example.com:443") != "https://example.com") throw new Exception("Wrong origin");
var snapshot = new ScopedConfig(new Dictionary<string, object?> { ["managementOrigins"] = Array.Empty<object>(),
    ["tenants"] = Array.Empty<object>(), ["apps"] = Array.Empty<object>() });
if (snapshot.Resolve(new Dictionary<string, string> { ["host"] = "unknown.example" }) is not null) throw new Exception("Unexpected scope");
```

`Cors` builds response/preflight headers from a trusted `OriginPolicy` and the
route's allowed methods. Hosts call `Preflight` before authentication/dispatch
and return empty 204 on success or 403 for `CorsDeniedException`. Custom operation
headers are allowed from trusted origins; operation schemas validate their
values. BP/HTMX response headers are exposed, preflight caching lasts 600 seconds,
and Vary includes the relevant request fields. Hosts merge Vary with existing
Accept/cache policy. No credential-cookie CORS flag is emitted.

```csharp
using System.Collections.Frozen;
using BetterPortal;

var origins = new[] { "https://app.example" }.ToFrozenSet(StringComparer.Ordinal);
var headers = new Cors(new OriginPolicy(origins, origins), ["GET"]).Preflight("https://app.example", "GET", "Authorization, X-App-Filter");
if (headers["access-control-allow-origin"] != "https://app.example") throw new Exception("Wrong origin");
```

`SseRoute<TInput, TEvent, TContext>` validates publication input and mapped events.
`EventScope` comes from the trusted request context. Supply `IEventTransport`;
the included `LocalEvents` provides thread-safe in-process fan-out, with no history
or cross-replica delivery. It isolates view/tenant/app addresses and closes a
subscriber after 256 pending events. Input/event byte limits default to 1 MiB;
limits are configurable. Own subscriptions with `await using`, and close the
transport at shutdown to release idle readers. Cancellation propagates to pending
reads and mapper work; mappers must pass their token to I/O. Each subscriber
decodes its own publication snapshot before mapping.

```csharp
using AnyVali;
using BetterPortal;

await using var transport = new LocalEvents();
var route = new SseRoute<string, string, object?>("clock.index", V.String(), V.String(),
    (value, context, cancellation) => ValueTask.FromResult(value), transport);
var scope = new EventScope("tenant-from-context", "app-from-context");
await using var subscription = await route.Subscribe(scope, null);
await route.Publish(scope, "tick");
await using var events = subscription.Read().GetAsyncEnumerator();
if (!await events.MoveNextAsync() || events.Current != "tick") throw new Exception("Missing tick");
```

`route.WriteSse(scope, context, destination, render: ...)` owns the subscription.
The optional async renderer returns HTML; failures emit a generic `error` event
and later events continue. Without a renderer, strings are sent as text and other
values as JSON. `SseFeed` supplies operation authorization and renderer selection
through the host, as shown below. `Wire` exposes the same messages as an owned async
byte sequence for hosting adapters.
`SseWire.Write` uses .NET's `SseItem<string>` and `SseFormatter` for UTF-8 multiline
messages, IDs and retry. It bounds data to 1 MiB before SSE line prefixes and names/IDs
to 1 KiB, validates UTF-8 and flushes each event before requesting another. Hosts
set `Content-Type: text/event-stream` and disable response caching; the codec does
not schedule heartbeats or keep replay history.

`SseFeed<TInput, TEvent>.Bind` attaches that contract to an existing typed GET handler.
Register it as `new Route(..., sse: feed)` to expose `<path>/__sse`, including optional
path variants. Connections inherit GET input schemas, authentication, permissions
and tenant/app mounts without executing the GET function. Publish with
`await feed.Publish(trustedScope, value, cancellation)`.
The application owns its transport. Disconnects, service disposal and host stop
cancel request subscriptions without closing a shared transport. Mapper/renderer
I/O must honor the supplied cancellation token.

Tick renderers must match a success fragment on the owning GET handler. `_f=nav.clock`
selects that tick; the resolved app shell selects the theme. Missing ticks return
406; a fragment-only mount cannot expose raw events through a missing tick or an
Accept header. Components are unavailable on feeds. Without `_f`, strings are text
and other values are JSON. Mapping/validation failures close the connection; renderer
failures emit a safe error and allow subsequent events. HEAD opens no subscription.

```csharp
using System.Net;
using AnyVali;
using BetterPortal;
using BetterPortal.Generated;

await using var transport = new LocalEvents();
var fragment = new Renderer<string>(new() { Renderer = "bootstrap5", Kind = RendererDeclarationInputKind.Fragment, Key = "nav.clock" },
    (value, context) => $"<span>{WebUtility.HtmlEncode(value)}</span>");
var handler = new Handler<object?, object?, object?, object?, string>(V.String(),
    context => ValueTask.FromResult("Waiting"), renderers: [fragment]);
var contract = new SseRoute<string, string, HandlerContext<object?, object?, object?, object?>>(
    "clock.index", V.String(), V.String(), (value, context, cancellation) => ValueTask.FromResult(value), transport);
var feed = SseFeed<string, string>.Bind(handler, contract, [fragment]);
var registry = new Registry([new Route("clock.index", "/clock", [new Operation(handler, new() {
    OperationId = "clock.get", Method = HttpMethodInput.GET, Title = "Clock", Description = "Live clock", Auth = new()
})], sse: feed)]);
if (registry.Routes[0].Sse != feed) throw new Exception("Missing subscriber feed");
```

The existing BP browser assets consume `/clock/__sse?_f=nav.clock` with
`hx-sse:connect`. No template engine, replay history or external broker is added.

`StreamHandler<TItem, TSummary, TContext>` validates each `StreamValue.Item` or
`StreamValue.Summary` before delivery and derives the buffered AnyVali schema.
`Frames`/`Ndjson`/`Sse` use async enumeration for backpressure; `Buffered` defaults to
10,000 items and 8 MiB, and frames to 1 MiB. Limits are configurable. Cancellation
never emits a terminal frame or returns partial buffered success. A pending
producer releases the caller immediately and is disposed once its I/O settles;
producers must pass cancellation to I/O to release resources promptly.
Dispose async enumerators when leaving early. Errors expose generic messages.

```csharp
using BetterPortal;

async IAsyncEnumerable<StreamValue<int, int>> Produce(object? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellation)
{
    await Task.CompletedTask;
    cancellation.ThrowIfCancellationRequested();
    yield return StreamValue<int, int>.Item(1);
    yield return StreamValue<int, int>.Summary(1);
}
var handler = new StreamHandler<int, int, object?>(Contracts.Get("JsonValueSchema"), Produce, Contracts.Get("JsonValueSchema"));
if (Convert.ToInt32((await handler.Buffered(null))["summary"]) != 1) throw new Exception("Wrong summary");
using var output = new MemoryStream();
await SseWire.Write(handler.Sse(null), output);
output.Position = 0;
var kinds = new List<string>();
await foreach (var item in System.Net.ServerSentEvents.SseParser.Create(output).EnumerateAsync()) kinds.Add(item.EventType);
if (!kinds.SequenceEqual(new[] { "item", "summary", "end" })) throw new Exception("Wrong SSE events");
```

`FiniteHandler` registers this producer as a GET `Operation`. JSON and
page/fragment/component renderers consume its bounded buffered result. NDJSON
streams validated JSON frames; a GET operation also owns `/<path>/__sse`, with the
same tenant/app, origin, operation and authentication checks. Stream connections
reject fragment/component selectors. Metadata and streamed HEAD requests never
start the producer. Hosts pull one chunk at a time and dispose the enumerator on
disconnect; producer I/O must observe its cancellation token.

`StreamRenderers<TItem, TSummary>` selects the exact app shell renderer. Its shell
receives the generated `StreamShellContext` and returns HTML with a connection
URL; it never runs the producer. SSE item/summary/error callbacks receive validated
typed values and the safe `RenderContext`. Callbacks return HTML strings and URL
tokens are rewritten through the existing helpers. A matching page renderer
buffers full page requests; fragment mode selects the stream shell. Without a
matching stream renderer SSE carries JSON frames. Each consuming request creates
its own stream.

```csharp
using BetterPortal;
using System.Net;

async IAsyncEnumerable<StreamValue<string, int>> Rows(HandlerContext<object?, object?, object?, object?> context,
    [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellation)
{
    await Task.CompletedTask;
    cancellation.ThrowIfCancellationRequested();
    yield return StreamValue<string, int>.Item("First row");
    yield return StreamValue<string, int>.Summary(1);
}
var handler = new FiniteHandler<object?, object?, object?, object?, string, int>(Contracts.Get("JsonValueSchema"), Rows,
    summary: Contracts.Get("JsonValueSchema"), streamRenderers: [new("bootstrap5",
        (data, context) => ValueTask.FromResult("<div hx-ext=\"sse\" hx-sse:connect=\"" + WebUtility.HtmlEncode(data.SseConnectPath)
            + "\"><div sse-swap=\"item\" hx-swap=\"beforeend\"></div></div>"),
        (value, context) => ValueTask.FromResult("<p>" + WebUtility.HtmlEncode(value) + "</p>"))]);
var registry = new Registry([new BetterPortal.Route("rows", "/rows", [new Operation(handler, new() {
    OperationId = "rows.get", Method = BetterPortal.Generated.HttpMethodInput.GET,
    Title = "Rows", Description = "Stream rows", Auth = new() })])]);
if (registry.Routes[0].Operations[0].Handler != handler) throw new Exception("Missing stream operation");
```

Mount this registry with `Service` and `MapBetterPortal` as above. The consuming
shell loads BP's existing HTMX/SSE browser assets; the runtime does not add a
template engine. Global theme helpers remain pending.

`Media.Negotiate` selects JSON, HTML (page/fragment/embed), metadata, or NDJSON
from Accept and the operation's available representations. Specific exclusions,
q=0 and request-order ties are honored; no acceptable representation raises
`NotAcceptableException` (406). Theme parameters never select a renderer.
The host supplies availability after resolving the exact app shell renderer.

```csharp
using BetterPortal;

if (Media.Negotiate("text/html;mode=fragment").Mode != "fragment") throw new Exception("Wrong mode");
if (Media.Negotiate("application/x-ndjson,application/json;q=0.5", ["json"]).Kind != "json") throw new Exception("Wrong offer");
```

Implemented: embedded canonical AnyVali 1.1.1 contracts, RSA keys, RS256 token
purposes through IdentityModel, tenant/app-bound refresh pairs, config-ticket
scope/action checks, and service authorization against current scoped bindings
and grants, static JWKS imports and a cancellable remote JWKS cache.

`RequestAuthorization.AuthorizeAsync` enforces complete user/service/delegated
policy using a trusted `AuthContext` from one scoped snapshot. It expands user role
IDs through current app grants and trusted aliases; root elevation requires the
configured management tenant/app. Delegated calls must satisfy both user and
service policy. The lower-level `Authorization.AuthorizeServiceAsync` checks only
the machine half. Optional invalid user auth yields an anonymous result;
malformed/revoked machine envelopes fail closed. Tenant/app hints do not establish
scope. Cancellation propagates to key lookup and token verification.

```csharp
using BetterPortal;

var key = KeyPair.Generate();
var tenant = Guid.CreateVersion7().ToString();
var app = Guid.CreateVersion7().ToString();
var pair = new TokenIssuer(key, "https://auth.example", "app").IssuePair(new Dictionary<string, object?>()
    { ["sub"] = "user-1", ["tenantId"] = tenant, ["appId"] = app, ["roles"] = Array.Empty<object>() }, includeRefresh: false);
var context = new AuthContext(tenant, app, new() { ["serviceId"] = Guid.CreateVersion7().ToString(),
    ["expectedIssuer"] = "https://auth.example", ["expectedAudience"] = "app", ["jwksUri"] = "https://auth.example/jwks" },
    (kid, _) => Task.FromResult(kid == key.Kid ? key.PublicKeyPem : throw new TokenException("Unknown key")));
var caller = await RequestAuthorization.AuthorizeAsync(new Dictionary<string, string> { ["authorization"] = "Bearer " + pair["accessToken"] },
    new() { ["required"] = true }, context, "hello", "GET");
if (caller.User?["sub"] is not "user-1") throw new Exception("Expected an authenticated user");
```

`ConfigCipher` reads legacy BP v1 envelopes and writes v2 strings/v3 typed JSON.
`PreviewConfig` implements authenticated preview envelopes and builds scoped
schemas from canonical field descriptors; its `Encrypt`/`Decrypt` methods use
AnyVali's native sensitive APIs. Values have a 1 MiB UTF-8 byte limit. Bounded key
derivation and legacy 16-byte IV support use the official
[Bouncy Castle package](https://www.nuget.org/packages/BouncyCastle.Cryptography/2.7.0).

```csharp
using BetterPortal;

var cipher = new ConfigCipher(ConfigCipher.GenerateKey());
if (cipher.Decrypt(cipher.Encrypt("")) is not "") throw new Exception("Empty secret changed");
var key = PreviewConfig.GenerateKey();
var encrypted = PreviewConfig.EncryptValue(key, "tenant", ["token"], "");
if (PreviewConfig.DecryptValue(key, "tenant", ["token"], encrypted) != "") throw new Exception("Preview changed");
```

Persist generated keys with the service's protected bootstrap state. Each cipher
holds two derived keys; there is no global secret cache.

`SettingsSchema` compiles config descriptors whose `jsonSchema` is a portable
AnyVali object document. Fields must match its properties; scopes control writes.
Native schemas own defaults, coercion, required fields and nested unknown-key
policy. A descriptor `defaultValue` must match the native field default. Partial
overrides preserve omission; `Effective(tenant, app)` applies tenant defaults and
app overrides.

```csharp
using AnyVali;
using BetterPortal;
using BetterPortal.Generated;

var descriptor = Contracts.Parse<ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", new {
    id = "settings", title = "Settings", description = "Settings", scope = "tenant",
    jsonSchema = V.Export(V.Object(new() { ["secret"] = V.String() })),
    fields = new[] { new { key = "secret", title = "Secret", description = "Service credential",
        scope = "tenant", visibility = "secret", ownership = "bp", sourceOfTruth = "bp" } }
});
var policy = new SettingsSchema([descriptor]);
var cipher = new ConfigCipher(ConfigCipher.GenerateKey());
var values = new Dictionary<string, object?> { ["secret"] = "example" };
var stored = policy.Encode("tenant", values, cipher);
if (!((string)stored["secret"]!).StartsWith("enc:aes256gcm2:")) throw new Exception("Expected ciphertext");
if (!Equals(policy.Decode("tenant", stored, cipher)["secret"], "example")) throw new Exception("Wrong decrypted value");
var redacted = policy.Redact("tenant", values);
if (!Equals(redacted["secret"], "__redacted__")) throw new Exception("Secret was exposed");
if (!Equals(policy.Merge("tenant", values, redacted)["secret"], "example")) throw new Exception("Secret was overwritten");
if (policy.Values("tenant", new Dictionary<string, object?>()).Count != 0) throw new Exception("Overrides must retain omission");
await using var settings = new ServiceSettings(policy, cipher);
await settings.Initialize();
await settings.Write("tenant", values);
if (!Equals(settings.Values("tenant", redacted: true)["secret"], "__redacted__")) throw new Exception("Secret was exposed");
if (!Equals(settings.Effective("tenant", "app")["secret"], "example")) throw new Exception("Wrong effective setting");
```

Native sensitive APIs own transforms and redaction traversal. Top-level sensitive
fields use Node's `enc:` envelopes; nested sensitive values retain `encrypted:`
around a BP envelope. Ordinary strings stay unchanged. `Merge` validates scopes,
clears and placeholders, including nested arrays. A placeholder cannot create a
missing secret or move it into a public union branch. Replacement values win over
`clearKeys`; a cleared secret cannot also use a preserve placeholder.
Direct sensitive annotations on ref nodes are rejected because every SDK bypasses
them ([AnyVali #128](https://github.com/BetterCorp/AnyVali/issues/128)). Use a native
wrapper or sensitive definition. Descriptor visibility annotates native fields and
wraps bare refs without changing requiredness.
`ServiceSettings` serializes writes and owns encrypted tenant/app state. Supply a
`FileStateStore(path)` as its third argument for persistence; omission uses memory.
Call `Initialize()` before reads/writes and dispose with `await using`. Loading
validates the entire cache before publication. Failure or cancellation before commit
preserves disk and active state. Writes combine clears and replacements in one
commit. `Values` returns stored overrides; `Effective` applies native defaults.
Reads return owned copies. Disposal cancels pending writes and rejects further access.

The portable cache reads Node's encrypted tenant/app files. Bare legacy buckets or
the `legacy` envelope require `Initialize(legacyTenantId: ...)`; migration persists
that explicit owner before readiness and rejects an existing owner bucket. Unmarked
plaintext secrets and tampered ciphertext are rejected. Keep encryption keys in
protected storage. One instance owns each file; shared replicas need a configured
repository/transport.

Pass `ConfigApi(settings, issuer: cpUrl, jwksUri: cpJwksUri)` through the service's
`configApi` argument. Settings descriptors must match the manifest. `AddBetterPortal`
initializes settings before hosting and owns shutdown; standalone callers invoke
`Service.Initialize` and dispose the service. This factory returns a managed service
to connect with `ControlPlaneSync`:

```csharp
using BetterPortal;
using BetterPortal.Generated;

static Service ConfiguredService(Registry registry, ManifestDeclarationInput declaration,
    string cpUrl, string jwksUri, string key, string settingsPath)
{
    var manifest = registry.Manifest(declaration);
    var descriptors = manifest.ConfigSchemas.Select(item =>
        Contracts.Parse<ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", item));
    var settings = new ServiceSettings(new SettingsSchema(descriptors), new ConfigCipher(key), new FileStateStore(settingsPath));
    return new Service(registry, declaration, managed: true,
        configApi: new ConfigApi(settings, issuer: cpUrl, jwksUri: jwksUri));
}
Func<Registry, ManifestDeclarationInput, string, string, string, string, Service> factory = ConfiguredService;
```

GET `/.well-known/bp/config/schema` is public. GET/POST on `/.well-known/bp/config`
require CP-signed `config.read`/`config.write` tickets for the manifest plugin ID.
The ticket supplies the tenant. GET's optional `X-BP-App-Id` selects stored app
overrides; POST accepts the canonical tenant/app/values/clearKeys body. Active tenants
and `configApps` (or `apps` when absent) restrict access. Conflicting scope headers
are rejected. Responses redact secrets and disable caching. Preflights check only
management origins before ticket verification. HEAD follows GET policy.

`mode`, `customUiPath` and `writable` describe capabilities; ownership mode grants
no permission. Unsupported reads/writes return 501. Invalid field input returns 400;
storage errors return 500 and retain previous values. Snapshot changes during ticket
verification reject the request. A settings commit completes before a queued snapshot
replacement, while shutdown cancels pending writes.

Handlers receive effective settings with defaults and preview overrides. Preview
values validate before snapshot publication and do not overwrite the settings file.
Missing required values return 503 on operations while configuration remains
available. Health reflects initialization and managed manifest acknowledgment.
HTTP provisioning remains delivery work; protected key persistence is described below.

`devToken` requires both an explicitly supplied token and
`BP_ALLOW_DEV_CONFIG_TOKEN=true` at construction. This local-development option
requires an explicit tenant header and normal scope checks. Without pinned CP trust
or this opt-in, the API rejects every ticket.

`Service.ApplySnapshot` validates the complete scoped document and preview values,
persists through `IStateStore`, then replaces active policy. Failure or cancellation
before commit preserves the previous snapshot. Requests capture one snapshot;
updates during authentication return 503. Successful updates retire old JWKS
caches and rebuild URL and access policy.

`FileStateStore` flushes a sibling file before atomic replacement, with a default
16 MiB limit. Use one writer per file; replicas need a configured transactional
store. Files use POSIX mode 0600 or the directory's Windows ACL. Key management
and cross-replica delivery are separate responsibilities.

```csharp
using BetterPortal;
using BetterPortal.Generated;

var declaration = new ManifestDeclarationInput { PluginId = "com.example.service", Title = "Example", Description = "Example", Version = "1.0.0" };
var directory = Directory.CreateTempSubdirectory("bp-example-");
try
{
    var store = new FileStateStore(Path.Combine(directory.FullName, "snapshot.json"));
    await using (var service = new Service(new Registry([]), declaration, stateStore: store, managed: true))
    {
        await service.ApplySnapshot(Json.Read("{\"managementOrigins\":[],\"tenants\":[],\"apps\":[]}")!);
        if (service.Snapshot() is null || service.Ready) throw new Exception("Unexpected readiness");
    }
    await using var restored = new Service(new Registry([]), declaration, stateStore: store, managed: true);
    if (!await restored.RestoreSnapshot() || restored.Ready) throw new Exception("Cache must not establish readiness");
}
finally { directory.Delete(recursive: true); }
```

Managed readiness also requires `manifestSubmitted: true` on an update from an
acknowledged manifest POST. Cache restoration cannot supply that proof; standalone
`ControlPlaneSync` supplies it after a successful POST and persisted snapshot. `previewKey` decrypts settings only for an
unambiguous active tenant/app. Both scopes validate before publication; merged
values appear in `RequestContext.Config`. Only encrypted snapshots are persisted.
Removing preview config removes that overlay.

`ControlPlaneSync` owns manifest submission, scoped SSE updates and reconnect/poll
fallback. It requires a managed service and provisioned CP URL/API key. HTTPS is
required; plain HTTP permits only exact `localhost`, `127.0.0.1` and `[::1]` hosts.
Redirects are rejected. Every connection starts with a manifest POST. A failed
first attempt leaves health at 503 and retries after five seconds. Poll requests
and idle stream reads time out after 30 seconds. Snapshots and individual SSE frames
are bounded to 16 MiB. Invalid updates preserve accepted state; 401/403/409/412 revoke
readiness until a fresh manifest succeeds. Transient failures retain valid policy.

```csharp
using BetterPortal;
using BetterPortal.AspNetCore;
using BetterPortal.Generated;
using Microsoft.AspNetCore.Builder;

static WebApplication ManagedApp(string cpUrl, string apiKey, string cachePath)
{
    var service = new Service(new Registry([]), new ManifestDeclarationInput {
        PluginId = "com.example.service", Title = "Example", Description = "Example", Version = "1.0.0"
    }, managed: true, stateStore: new FileStateStore(cachePath));
    var sync = new ControlPlaneSync(service, cpUrl, apiKey);
    var builder = WebApplication.CreateBuilder();
    builder.Services.AddBetterPortal(service, sync);
    var app = builder.Build();
    app.MapBetterPortal(service);
    return app;
}
// Use your registry in the factory, then await the returned app's RunAsync().
Func<string, string, string, WebApplication> factory = ManagedApp;
```

`AddBetterPortal` starts synchronization and closes it before the service at host
shutdown. Without a host, dispose the sync before its service with `await using`.
`StartAsync` returns the first bootstrap result; disposal cancels pending requests
and retries and clears managed readiness. `Status` contains only safe counters and
error codes; protect any endpoint exposing them. `Submission()` returns the portable
typed manifest projection. Optional `keyPair` registers a previously persisted RSA
public key; `authProvider` advertises issuer metadata. Provisioning/install ticket
hosting remains separate work.

`BootstrapStateStore` protects credentials and a persistent RSA signing identity
inside the Node-compatible authenticated bootstrap envelope. Supply its master
key from a protected host secret. Call `BootstrapCipher.GenerateKey()` once and
retain the result separately; a different master key cannot read existing state.

```csharp
using BetterPortal;

var directory = Path.Combine(Path.GetTempPath(), "bp-bootstrap-example-" + Guid.NewGuid().ToString("N"));
try
{
    var masterKey = BootstrapCipher.GenerateKey(); // Example only: retain securely in production.
    var file = new FileStateStore(Path.Combine(directory, "bootstrap.json"));
    var state = new BootstrapStateStore(file, masterKey);
    await state.Write(new Dictionary<string, object?> { ["cpUrl"] = "https://cp.example", ["apiKey"] = "bp_sk_t_example" });
    var identity = await state.Identity();
    var restarted = new BootstrapStateStore(file, masterKey);
    if ((await restarted.Identity()).Kid != identity.Kid) throw new Exception("Identity changed");
    if (!Equals((await restarted.Read(redacted: true))["apiKey"], "__redacted__")) throw new Exception("Secret leaked");
}
finally
{
    if (!Path.GetFullPath(directory).StartsWith(Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("Invalid temporary directory");
    if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
}
```

`Write` atomically merges a validated patch; `Read` returns owned state. `Identity`
loads or atomically creates an RSA key inside that encrypted state. `Clear`
explicitly removes credentials and identity. Corrupt files, invalid master keys
and mismatched RSA keys fail without replacement. Keep one owner per store; use a
transactional implementation for shared storage. There is no plaintext cache or
background work. Calls accept cancellation before commit. Use the returned key
with `ControlPlaneSync(keyPair: ...)` or `TokenIssuer`, or let `ServiceInstallation`
own it.

`ServiceInstallation` supplies the setup-token installation endpoint and public
JWKS, restores protected credentials, activates ticket-protected settings and owns
manifest synchronization. CP trust and the public service origin come from host
configuration. The installer requires a fresh managed `Service`.

```csharp
using BetterPortal;
using BetterPortal.AspNetCore;
using BetterPortal.Generated;
using Microsoft.AspNetCore.Builder;

static WebApplication InstallableApp(string cpUrl, string publicOrigin, string masterKey, string stateDirectory)
{
    var service = new Service(new Registry([]), new ManifestDeclarationInput {
        PluginId = "com.example.service", Title = "Example", Description = "Example", Version = "1.0.0"
    }, managed: true, stateStore: new FileStateStore(Path.Combine(stateDirectory, "snapshot.json")));
    var installation = new ServiceInstallation(service,
        new BootstrapStateStore(new FileStateStore(Path.Combine(stateDirectory, "bootstrap.json")), masterKey), cpUrl, publicOrigin,
        settingsStore: new FileStateStore(Path.Combine(stateDirectory, "settings.json")));
    var builder = WebApplication.CreateBuilder();
    builder.Services.AddBetterPortal(service, installation: installation);
    var app = builder.Build();
    app.MapBetterPortal(service, installation: installation);
    return app;
}
Func<string, string, string, string, WebApplication> factory = InstallableApp;
```

Supply your registry and separately protected master key, then run the returned
app. Pass the same installer to both hosting helpers. Startup without credentials
exposes public keys and health 503. POST `{"setupToken":"...","cpUrl":"https://cp.example"}`
to `/.well-known/bp/install`. Success returns 200 only after manifest submission and
scoped snapshot persistence. Failed first sync returns 503 with `installed: true`
and retries using durable credentials. Native responses omit the API key.

Same-JTI replay reuses committed credentials; a new signed token may rotate them
for the same instance. Tenant-scoped setup stores its signed tenant as `tenantLock`:
other-tenant operation requests return 426 and config tickets are denied. Platform
installation without tenant scope can serve the CP's permitted tenants. Existing
locks survive restart/reconfiguration. Existing Node bootstrap files can be loaded
with their master key; reconfiguration requires a synchronized matching instance.
`cpJwksUri` pins alternate JWKS, `authProvider` supplies provider metadata, and
`configMode`, `customUiPath`, `writable` configure the existing config API. Config
descriptors require a settings store. Disposal cancels and drains installation/sync
before closing the service. Keep one owner per state store; file stores do not
coordinate replicas.

To change the public hostname, keep the same protected state, configure the new
`serviceUrl`, and restart. A stored-address mismatch leaves health 503 until POST
`{"changeToken":"bp_hc_..."}` to `/.well-known/bp/hostname-change` confirms the
CP-issued token. The runtime method is `await installation.ChangeHostname(body, cancellation)`.
The configured origin supplies the new address; forwarded headers cannot change
it. Confirmation checks the CP's current instance/address projection before
atomically updating the binding and restarting sync. Credentials, signing identity
and tenant lock are preserved. If CP confirmation succeeds but local persistence
fails, obtain a fresh token and retry; if local persistence succeeded, restart can
resume sync. See [the hostname protocol](../../spec/config.md#23-standalone-hostname-changes).

```sh
dotnet restore framework/dotnet/Conformance --locked-mode
dotnet build framework/dotnet/Conformance --no-restore
dotnet pack framework/dotnet/BetterPortal --no-restore
```

The package embeds the shared contract corpus. Native NuGet consumers require
neither Node nor BSB. `Contracts.Document` returns a portable document;
`Contracts.Get` imports it natively, also supporting named field selection with
the original recursive definitions. JSON conversion retains missing dictionary
keys versus null. AnyVali remains the only schema validator.
`Contracts.ObjectDocument` composes portable roots while retaining definitions and
rejecting conflicting names. The core package has no ASP.NET hosting dependency.

The native .NET tool generates types for application contracts:

```sh
bp-dotnet types --contracts ./contracts --output ./GeneratedTypes.cs --namespace MyService.Contracts
bp-dotnet types --contracts ./contracts --output ./GeneratedTypes.cs --namespace MyService.Contracts --check
```

Build the tool with `dotnet build framework/dotnet/BetterPortal.Tool`; package it
with `dotnet pack framework/dotnet/BetterPortal.Tool`. Until publication, install
that package from a local NuGet source. `--platform` selects embedded BP contracts.
`BetterPortal.Generated` contains generated input/output records, enums and unions.
`Optional<T>` distinguishes omission from present null. Input defaults are optional;
output defaults are materialized by `Contracts.Parse<T>`, which validates with
AnyVali before typed decoding. Recursive JSON uses the native JSON DOM. Tuple
positions, arbitrary intersections and coercion constraints remain in AnyVali;
their CLR projections are intentionally broader.

```csharp
using BetterPortal;
using BetterPortal.Generated;

var input = new ApiAuthRequirementInput();
var policy = Contracts.Parse<ApiAuthRequirement>("ApiAuthRequirementSchema", input);
if (policy.Required || policy.Permissions.Count != 0) throw new Exception("Unexpected defaults");
```

```csharp
using BetterPortal;

var key = KeyPair.Generate();
var issuer = new TokenIssuer(key, "https://auth.example", "my-app");
var pair = issuer.IssuePair(new Dictionary<string, object?>
{
    ["sub"] = "user-1", ["tenantId"] = Guid.CreateVersion7().ToString(),
    ["appId"] = Guid.CreateVersion7().ToString(), ["roles"] = new List<object?> { "reader" },
    ["authProvider"] = "example", ["refreshContext"] = new Dictionary<string, object?> { ["subject"] = "user-1" }
});
```

This example uses an ephemeral key. Use `BootstrapStateStore.Identity()` for persistent keys.
`Tokens.VerifyAsync` requires a trusted resolver, issuer,
audience and explicit purpose. Setup tokens have no audience and must additionally
be bound to the intended installation before use.

Use `await using` with `JwksClient(issuer, uri)` and pass its `ResolveAsync` method
as the trusted resolver. It coalesces concurrent refreshes, caches for 30 minutes,
throttles unknown-key refreshes for two seconds and supports `Invalidate()` on
scoped key changes. Disposal cancels outstanding refreshes. HTTPS is required
except exact localhost/127.0.0.1/[::1] HTTP URLs. Redirects are rejected; complete
responses have a five-second deadline and 1 MiB limit. Configured JWKS queries are
allowed; `TrustedKeys.SecureEndpoint` rejects queries by default for CP base URLs.

The shared [security HTTP suite](../conformance/security_cases.py) passes 459
scenarios across Node, Python and .NET. The [schema gate](../conformance/README.md)
retains failing AnyVali compatibility probes. Compilation or NuGet packaging is
not evidence that the full framework plan is complete. Nothing is published.

## Scoped dependency clients

Load a dependency's exported `BpSchemaOutput` with `new ClientContract(document)`.
Inside a handler, `context.RequestContext.Clients.User(contract, serviceId)` selects
an enabled instance or registry alias and forwards the verified original user
bearer. Its operation must be mounted in the current app; public operations can be
called anonymously. Credentials are absent from render contexts. Invoke
`await client.RequestAsync(operationId, values, cancellation)` with `params`, `query`,
`headers` and `body` fields; unused keys can be omitted. AnyVali validates each
method's inputs and JSON output. `RequestAsync<T>` decodes the validated result to
a native generated type. Explicit body null remains JSON null when permitted.

`context.RequestContext.Clients.M2m(requestId, contract)` uses the mode in a declared
manifest request. Every call checks current bindings, grants, methods, permissions
and capabilities, then mints a service token lasting at most 60 seconds. Delegated
calls also retain the original user bearer. Background work uses
`service.Clients.Scope(tenantId, appId)` and supports service mode only. Supply
`signingKey` to a locally configured service; installation/control-plane sync
supplies its persisted key automatically. The snapshot must confirm its public key
and key ID before outbound tokens can be sent.

```csharp
using BetterPortal;
using AnyVali;

var declaration = new BetterPortal.Generated.ManifestDeclarationInput {
    PluginId = "com.example.peer", Title = "Peer", Description = "Example", Version = "1.0.0"
};
var registry = new Registry([new Route("value", "/value", [new Operation(
    new Handler<object?, object?, object?, object?, string>(V.String(), _ => ValueTask.FromResult("value")),
    new() { OperationId = "value.get", Method = BetterPortal.Generated.HttpMethodInput.GET,
        Title = "Value", Description = "Read value", Auth = new() })])]);
var contract = new ClientContract(registry.Schema(declaration));
await using var service = new Service(new Registry([]), declaration);
var client = service.Clients.Scope("01952200-0000-7000-8000-000000000001",
    "01952200-0000-7000-8000-000000000002").M2m("read", contract);
try { await client.RequestAsync("value.get"); throw new Exception("An unready service made an outbound call"); }
catch (ClientException error) when (error.Status == 503) { }
```

Destinations require HTTPS, with the same exact-loopback HTTP exceptions as sync.
Clients reject redirects, cookie replay and caller overrides of BP routing/auth
headers. JSON requests/responses are bounded to 16 MiB, URLs to 8,192 characters,
and transport waits to 30 seconds; unsolicited compressed responses are rejected.
Snapshot replacement invalidates captured request clients and pending responses;
background clients resolve policy again on each call. Request cancellation and
service shutdown stop pending HTTP work. `ClientException` exposes the upstream
status with a generic message, without its error body. Raw/streaming dependency
responses remain delivery work.

Generate a typed JSON client from the dependency's exported BP schema:

```sh
bp-dotnet client --contract contracts/peer.json --output Dependencies/Peer.cs --class-name PeerClient --namespace MyService.Dependencies
bp-dotnet client --contract contracts/peer.json --output Dependencies/Peer.cs --class-name PeerClient --namespace MyService.Dependencies --check
```

Construct `new PeerClient(context.RequestContext.Clients, serviceId: "peer")`
for user calls, or pass `requestId: "read-item"` for a declared service/delegated
request. An operation `check.get` becomes `CheckGetAsync(inputs, cancellation)`.
Generated records preserve required fields, omission through `Optional<T>` and
nullable values; return records decode validated JSON. Undeclared schemas remain
generic JSON mappings. Each generated file embeds the contract and delegates
policy, transport and cancellation to the runtime. `--check` detects stale output
without writing files. Neither command requires Node or BSB. Cross-language
coercion export remains gated by [AnyVali #134](https://github.com/BetterCorp/AnyVali/issues/134).

## Local dependencies and frozen builds

Keep registry identity and dependency selectors in `betterportal.json`. Install
an exported service project without Node or BSB:

```sh
bp-dotnet deps add example/service@1.0.0 --path ../service --alias peer --project .
bp-dotnet deps sync --frozen --project .
bp-dotnet deps sync --frozen --check --project .
```

The provider directory contains `bp-contract.json` or `lib/bp-contracts/*.json`.
Its `betterportal.json` supplies `registryRef`; a full reference in the selector
can supply it when absent. Exact versions and identities must match, and ambiguous
exports fail. The generated file is `BpDependencies/peer.cs`, with class
`BetterPortal.Dependencies.peer.DependencyClient`. Its constructor and methods use
the scoped client API above. Aliases that collide in native filenames are rejected
before files change.

The lock retains `registryRef`, `pluginId`, `version` and `digest`, adding
`digestFormat: "json-bytes"`. SHA-256 covers the exact cached UTF-8 document.
Frozen builds use that cache, check the configured identity/version, and validate
all dependencies before updating generated files. They perform no network lookup
or local override discovery; `--check` performs no writes. Explicit installation
can migrate a legacy Node lock. Native frozen builds reject legacy locale-dependent
digests; Node's CLI supports both formats. Automatic local discovery and route
scaffolding remain delivery work.

## Registry installation and publishing

```sh
bp-dotnet deps add example/service@1.0.0 --alias peer
bp-dotnet deps add com.example.service@1.0.0 --alias peer
bp-dotnet publish --contract bp-contract.json --project .
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
and a 30-second total deadline per request. Ctrl+C cancels pending HTTP work.
They send no environment proxy credentials or stored cookies; publisher
credentials are never sent on lookups or included in upstream error messages.
Contract export commands remain delivery work.
