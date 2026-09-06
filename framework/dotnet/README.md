# BetterPortal .NET port

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

.NET 10. This is an in-progress port, **not yet a service runtime**. ASP.NET Core
operation hosting, configuration, route tooling and generated clients remain in the
[capability ledger](../conformance/CAPABILITIES.md).

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
