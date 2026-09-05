# Authentication and authorization

**Version:** bp-protocol/2

BP has separate user, installed-service, and configuration-ticket credentials.
They are not interchangeable. Canonical wire contracts are the exported
[AnyVali documents](../framework/conformance/contracts/), derived from
framework/nodejs/src/contracts/auth.ts, m2m.ts, and serviceConfig.ts.

## 1. User access and refresh tokens

Ordinary service requests carry Authorization: Bearer followed by a BP access
token. These are RS256 JWTs with typ=JWT and a trusted kid:

| Claim | Contract |
|---|---|
| iss | Nonempty string, exactly the configured expected issuer. |
| aud | Nonempty string or nonempty string array containing the configured expected audience. |
| sub, jti | Nonempty strings. |
| exp | Positive integer Unix seconds, unexpired. |
| iat | Nonnegative integer Unix seconds. Future issuance is invalid, subject to clock tolerance. |
| nbf | Optional nonnegative integer Unix seconds; not in the future beyond tolerance. |
| tenantId, appId | Lowercase UUIDv7 strings; both must match resolved request scope. |
| realm | runtime or control-plane. User token helpers issue runtime. |
| roles | Array of nonempty role IDs; schema default is an empty array. |
| tokenType | Ordinary routes require access; refresh helpers require refresh. |
| authProvider, providerSubject, profile fields | Optional; see JwtClaimsSchema. |
| refreshContext | Optional recursive JSON object; required by the refresh-pair issuance helper. |

Setup, install, and CP-envelope credentials have distinct purposes and dedicated
contracts. There is no tier, minimumTier, flat JWT permissions, tenant_id, or
app_id authorization model.

External OIDC tokens are verified by the external-provider helper and exchanged
by an auth provider for BP-scoped tokens. An OIDC ID token with only standard
claims does not satisfy the BP access-token contract. Provider login/refresh
paths come from its manifest, not a universal /token endpoint.

### 1.1 Verification and key discovery

Pin RS256 and the expected token purpose; validate the complete claims contract.
Reject malformed headers, unknown kid, and untrusted jku/x5u references.
A kid is 1–256 ASCII letters, digits, underscore, or hyphen.
Use configured static JWKS, a local resolver, or a trusted configured JWKS URL;
never fetch a URL supplied by a token.

App auth metadata contains expectedIssuer, expectedAudience, jwksUri, and
optional pushed publicKeys. The CP verifies with pushed keys to avoid a
CP-to-provider fetch. Runtime JWKS helpers cache keys and support invalidation.
Snapshot key changes must invalidate dependent verifier caches.

### 1.2 Method-specific authorization

Each operation declares ApiAuthRequirement: required (default false), callers
(default user only), and permissions (default empty).
Permission requirements bind a serviceId (plugin ID), viewId, and an array of
read/create/update/delete actions. Enforcement precedes the handler and uses
the selected HTTP operation, including SSE's GET policy.

Expand token role IDs through the current app's auth.roles[].permissions.
Each role grant binds a concrete service instance and view to allowed actions.
Resolve aliases only through trusted tenant/app configuration. Every required
action must be granted. Applying a changed snapshot therefore revokes role
permissions even while a signed token remains unexpired.

The reserved platform-root role elevates only inside the configured management
tenant/app. Preview and ordinary tenant requests cannot acquire management
authority by supplying that role or claiming a different tenant.

Optional auth may yield an anonymous context for invalid user credentials;
it must never attach partial or unverified claims. Protected routes return
401 for absent/invalid credentials, 403 for insufficient permissions, and 503
when required verification context is unavailable. HTTP representations are
defined in [protocol.md](protocol.md), not a separate universal auth error format.

### 1.3 Refresh

The token-pair helper issues access and refresh tokens with the same pair jti.
Refresh tokens carry roles=[] and require authProvider, refreshContext, and a
configured refresh lifetime. Verify refresh purpose and tenant/app binding
before the provider re-evaluates the user and issues another pair.
Session persistence, revocation, and rotation policy remain provider concerns.

The browser refreshes through the configured auth service origin, never an
arbitrary service returning 401. All server SDKs reuse the existing browser
JavaScript runtime.

## 2. Config tickets

Config endpoints use CP-signed RS256 JWTs with typ=JWT. The canonical
ServiceConfigTicketClaimsSchema requires iss, aud, sub, exp, iat, jti,
realm=control-plane, tenantId, serviceId, and nonempty actions. bindingId is
optional. There is no appId claim.

The audience is betterportal-service-config and the issuer is the configured
control-plane issuer. The target serviceId matches the service's configuration
API identity. Actions are schema.read, config.read, and config.write.
The reference schema endpoint is public. App authorization uses the scoped
configApps index, or runtime apps when absent, within the ticket tenant.
See [config.md](config.md).

## 3. Installed-service and delegated authentication

Installed services sign their own short-lived RS256 credentials. The CP API key
is control-plane-only and grants no data-plane access. Each service persists
its keypair and submits its public key and kid during authenticated sync.
A mismatched key requires explicit recovery/rotation.

Service tokens have typ=BP-S2S-JWT and tokenType=service. Claims bind iss and
sub to the same source instance, aud to the exact target instance, plus
tenantId, appId, bindingId, iat, exp, and jti. Lifetime is positive and at most
60 seconds. nbf is optional.

Both machine modes require X-BP-Service-Id, X-BP-Tenant-Id, and X-BP-App-Id:

| Mode | Credentials |
|---|---|
| service | Service bearer token in Authorization. |
| delegated | Original BP user bearer in Authorization; service bearer in X-BP-Service-Authorization. |

The operation must explicitly allow the selected mode. A complete service
envelope takes precedence over browser origin resolution. Partial, malformed,
or mismatched envelopes fail without browser fallback.

Verify the source key from the current snapshot, source header, local target
instance, tenant/app, enabled binding, binding mode and target view, enabled
grant, exact HTTP method, and required permissions. Caller-supplied permissions
are never authoritative. Delegated calls independently satisfy both user
policy and delegated service grant. Provisioned identity alone grants nothing.

Binding/grant creation requires administrator approval. Revocation must not
silently reactivate an old binding. Services use last-known-good snapshots
during CP outages; revocations become effective at each target when it
atomically applies the updated snapshot.

## 4. Browser transport and helpers

The shell passes access tokens through BP-managed headers and HTMX hx-headers.
Cross-origin service authentication does not use cookies. Same-origin theme
cookies may hold refresh state or preferences with appropriate Secure, HttpOnly,
and SameSite settings. Theme/auth SDKs provide cookie, redirect, issuance, and
verification building blocks; provider service implementations are outside
the runtime ports.

## 5. Acceptance

The [capability ledger](../framework/conformance/CAPABILITIES.md) records
implementation and acceptance ownership. Compatibility must not preserve known
validation defects. AnyVali import must retain sensitive metadata and ciphertext
tampering must fail before encrypted configuration is enabled.
