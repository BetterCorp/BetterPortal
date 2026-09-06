# BetterPortal .NET port

.NET 10. This is an in-progress port, **not yet a service runtime**. ASP.NET Core
operation hosting, configuration, route tooling and generated clients remain in the
[capability ledger](../conformance/CAPABILITIES.md).

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

`Operation`, `Route` and `Registry` register JSON handlers and derive canonical
manifests and discovery schemas from their AnyVali schemas. Operations require
explicit auth and unique stable IDs. Each view shares one params schema across
methods; query, headers, body, response and policy are method-specific. Registry
generation resolves dependency aliases and checks local operation/method targets.
Path variants publish API contracts once per view. Directory discovery and
renderer/raw/stream registration remain pending.

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
includes only enabled local service instances referenced by this app. Cross-service
`appRoutes`/`appFragments` catalogs confer no inbound access. Hosts still enforce
caller authorization and representation selection; well-known routes use their
own declared auth policy independently of app page mounts.

Raw proxy and HTMX context headers are ignored. `Resolve(..., trustedAddresses: ...)`
accepts addresses already verified by host proxy middleware; the host supplies
the effective scheme. `OriginPolicy` normalizes HTTP origins and preserves exact
path/query restrictions on referer overrides. Host proxy middleware, full policy
reference validation and atomic persistent replacement remain pending. The shared
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
values as JSON. Operation authorization and renderer selection remain host work.
`SseWire.Write` uses .NET's `SseItem<string>` and `SseFormatter` for UTF-8 multiline
messages, IDs and retry. It bounds data to 1 MiB before SSE line prefixes and names/IDs
to 1 KiB, validates UTF-8 and flushes each event before requesting another. Hosts
set `Content-Type: text/event-stream` and disable response caching; the codec does
not schedule heartbeats or keep replay history.

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

These helpers do not yet supply operation hosting or themed stream renderers.

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
holds two derived keys; there is no global secret cache. Persistent settings,
legacy-marker adaptation, redaction and atomic preview application remain pending.

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

This example uses an ephemeral key. Key persistence is not implemented yet.
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
