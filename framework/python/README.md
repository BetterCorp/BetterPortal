# BetterPortal Python port

Python 3.10+. This is an in-progress port, **not yet a service runtime**.
Starlette/ASGI hosting, configuration, authoring and generated clients remain in
the [capability ledger](../conformance/CAPABILITIES.md).

Implemented: embedded canonical AnyVali 1.1.1 contracts, RS256 keys and token
purposes, tenant/app-bound refresh pairs, config-ticket scope/action checks, and
service authorization against current scoped bindings and grants, static JWKS
imports and a cancellable remote JWKS cache. Cryptography
uses PyJWT/OpenSSL; validation uses AnyVali exclusively. Service authorization in
delegated mode validates only the service envelope; a host must separately
authorize the user token before allowing the request.

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
