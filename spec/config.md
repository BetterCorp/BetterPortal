# Configuration

**Version:** bp-protocol/2

Platform configuration, scoped runtime snapshots, and per-service settings are
different documents. Their portable AnyVali contracts are checked into
[framework/conformance/contracts](../framework/conformance/contracts/).

## 1. Platform and scoped configuration

The config manager owns bp-config.yaml or its configured storage backend.
Ordinary services never share or write this file. Local configuration providers
may read and validate a platform document without BSB. Storage backends preserve
the JSON-after-parse contract, BetterPortalConfigSchema.

Tenant, app, service-instance, activation, and route IDs are lowercase UUIDv7.
Slugs and reverse-DNS plugin IDs are distinct identifiers. Apps reference concrete
instances/activations, including shell.serviceId and auth.serviceId. A shared
catalog identity is not an activation identity.

The CP returns a **bare scoped snapshot**, not an envelope containing config:

| Field | Meaning |
|---|---|
| managementOrigins | Management request origins. |
| tenants | Relevant tenants with branding and redacted service registrations; no API-key hashes. |
| apps | Runtime apps; routes and fragments are scoped inbound mounts. |
| configApps (optional) | Apps whose settings may be managed, potentially broader than runtime apps. |
| serviceIdentity (optional) | Authenticated installed-service ID, public key and key ID. |
| m2m (optional) | Local service IDs, relevant peer public keys, bindings and grants. |
| configManagement (optional) | Management tenant/app IDs and minimal management context. |
| previewConfig (optional) | Revision and encrypted tenant/app settings. |

ScopedServiceConfigSchema derives fields from the platform schemas. Apps receive
resolved shell context containing serviceId, service, and renderer.
Optional appRoutes and appFragments contain the full app index for outgoing
URL resolution; they **must never become the inbound allowlist**.

Resolve browser context from trusted addressing and active tenant/app bindings.
Standalone tenant/app headers and HX-Current-URL do not establish scope.
Proxy headers require explicit trust. Ports must compare host and port correctly
and must not inherit Node's historical same-host port fallback when it makes
app selection ambiguous.

Route operations select stable manifest operation IDs. Schemas, methods, auth,
rendering, and dependencies remain operation-owned. Only renderable GET mounts
are shell navigation. Service requests use resolvedServicePath, then
servicePathVariant, then targetPath, not the shell navigation path.

## 2. Standalone control-plane synchronization

These are BP responsibilities even though Node currently implements them in
plugins/nodejs/betterportal-bsb/src/service.ts.

1. Validate the CP destination before attaching credentials. Require absolute
   HTTPS without userinfo, query, or fragment. HTTP exceptions are exactly
   localhost, 127.0.0.1, and [::1]. Reject credential-bearing redirects.
2. POST /.well-known/bp/sync/poll with the CP API key as bearer and JSON containing
   manifestVersion, title, capabilities, configSchemas, webhooks, apiContracts,
   m2mRequests, developerResources, optional shell/authProvider,
   publicKeyPem/keyId when provisioned, and viewIndex.
3. viewIndex is keyed by view ID. Entries include view metadata, path variants,
   params schema, method-specific operations, and fragment descriptors.
   Operations include IDs/methods, renderers/modes, authRequired, permissions,
   schemas (query, headers, request, response, metadataResponse), dependencies,
   API contracts, demos, and declared raw/SEO/chrome metadata.
   This submits the manifest, not just a heartbeat.
4. Validate the complete returned snapshot, scope references, and preview
   decryption before atomic replacement. Persist through a replaceable store;
   invalidate policy, URL, and verifier caches on a successful update. Invalid
   updates preserve the old snapshot. Failed preview decryption/persistence must
   not partially clear existing config.
5. GET /.well-known/bp/sync with Accept: text/event-stream. Apply complete
   event: config JSON messages through the same replacement path. Support LF,
   CRLF, multiline data, bounded input, reconnects, and polling fallback.
   Re-submit the manifest on reconnect/bootstrap. Node retries after five seconds
   and uses a 30-second bootstrap request timeout.
6. Readiness requires successful manifest submission and a valid snapshot.
   Restored cache is last-known-good data, not proof of current manifest sync.
   Cancel fetches, retry timers, streams, and subscribers on shutdown.

Public health is only ok=true at 200 or ok=false at 503; authorized diagnostics
are a separate representation. See [protocol.md](protocol.md).

## 3. Per-service settings API

GET /.well-known/bp/config/schema is public and returns serviceId, configSchemas,
mode (static, bp-managed, or hybrid), supportsCustomUi, optional customUiPath,
and supportsWrite. Modes describe ownership; actual read/write availability
follows supplied callbacks. Unsupported reads/writes return 501.

GET /.well-known/bp/config requires config.read. The ticket establishes the
tenant; optional X-BP-App-Id selects app overrides. Authorize that app against
configApps (or runtime apps when absent) and the active tenant. Return serviceId,
tenantId, optional appId, and values. An app read returns stored overrides, not
merged effective config. Secret values are replaced with __redacted__.

POST /.well-known/bp/config requires config.write. Its body is
ServiceConfigWriteRequestSchema: tenantId, optional appId, values, and clearKeys
(default empty array). appId is optional but not nullable. clearKeys explicitly
removes overrides; empty strings and null are values when the field schema
permits them, not alternate clear operations. tenantId must match the ticket.

Ports must validate declared field names/scopes and preserve existing secrets
when redaction placeholders are resubmitted. The current low-level Node store
does not implement all these field-policy checks; this is not permission to
discard validation in a new SDK.

Success returns ok=true, serviceId, tenantId, optional appId, and redacted values.
HX-Trigger: bp:config-saved is optional. Runtime settings merge tenant defaults
followed by app overrides. Store operations and event delivery have small
replaceable interfaces. In-process publication does not supply cross-replica
delivery.

Custom configuration UI uses the same authorized API. Public field visibility
is descriptor metadata, not a bypass for ticket-protected reads.

## 4. Config tickets

Tickets are CP-signed RS256 JWTs. Verify configured issuer/key, typ=JWT, safe kid,
expiry/issuance time, audience betterportal-service-config, realm=control-plane,
target serviceId, and requested action. Reject untrusted jku/x5u URLs.

ServiceConfigTicketClaimsSchema includes tenantId and optional bindingId, but no
appId. Authorize app scope from the snapshot. Actions are schema.read,
config.read, and config.write. Invalid tickets return 401; an authorized
credential with denied tenant/app scope returns 403.

Node's development static-token path requires explicit BP_ALLOW_DEV_CONFIG_TOKEN=true
and a configured token. No known default token grants access. Production services
fail closed before provisioning.

## 5. Encryption and redaction

Use AnyVali sensitive metadata and native sensitive traversal APIs. An imported
schema must retain that metadata: supplying an encryption callback is insufficient
when the importer discarded sensitive=true.

Persist a service-generated CSPRNG key of at least 256 bits with bootstrap state;
do not substitute an operator password. State writes must be atomic.

| Envelope | Encoding and key derivation |
|---|---|
| enc:aes256gcm2: | String UTF-8; Base64 of 12-byte IV, 16-byte tag, ciphertext. scrypt salt bp-config-store, N=32768, r=8, p=1, 32-byte output. |
| enc:aes256gcm3: | Same as v2, but plaintext is JSON, retaining non-string secret types. |
| enc:aes256gcm: | Legacy read compatibility: 16-byte IV and N=16384. Upgrade on a subsequent write. |

The native AnyVali encrypted-value marker is encrypted:. A storage adapter must
explicitly bridge that marker to legacy BP envelopes when using native sensitive
APIs; unrecognized envelopes are not authenticated ciphertext. Do not log
plaintext or keys. Config API reads always redact secrets.

### 5.1 Preview config

Preview keys are bp_pck_ followed by base64url of exactly 32 bytes.
Preview values use encrypted:bp-aes256gcm-v1: followed by IV-base64url,
a colon, and ciphertext-with-appended-tag-base64url. AES-GCM uses a 12-byte IV
and 16-byte tag. Associated data is the UTF-8 concatenation of
betterportal.preview-config.v1, newline, tenant or app, newline, and the
dot-joined field path.

Scope/path/key tampering must fail authentication. Decrypt and validate both
scopes before applying a revision. Keep the prior revision on failure.
Empty strings are valid encrypted values where the schema permits them. A
tag-only AES-GCM payload still requires successful authentication.
Preview settings confer no management permissions.
Because the preview payload has no explicit target IDs, the native runtimes
require exactly one active tenant and one app belonging to that tenant before
applying it. An ambiguous target is rejected instead of selecting by array order.
Preview values are an in-memory overlay derived from the persisted encrypted
snapshot; removal clears the overlay without rewriting ordinary settings.

## 6. Acceptance

The [capability ledger](../framework/conformance/CAPABILITIES.md) tracks schema,
crypto, sync, persistence, readiness, and isolation gates. Compilation alone
does not establish interoperability.
