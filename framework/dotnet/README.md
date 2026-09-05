# BetterPortal .NET port

.NET 10. This is an in-progress port, **not yet a service runtime**. ASP.NET Core
operation hosting, configuration, authoring and generated clients remain in the
[capability ledger](../conformance/CAPABILITIES.md).

Implemented: embedded canonical AnyVali 1.1.1 contracts, RSA keys, RS256 token
purposes through IdentityModel, tenant/app-bound refresh pairs, config-ticket
scope/action checks, and service authorization against current scoped bindings
and grants, static JWKS imports and a cancellable remote JWKS cache. Delegated
mode validates only the service envelope; a host must also
authorize its user token. Signature verification alone does not authorize a call.

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
