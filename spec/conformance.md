# Conformance

**Version:** `bp-protocol/2`

A BetterPortal-conformant **service**, **theme**, **IdP**, or **SDK** passes the relevant tests below. The runnable HTTP schema gate is in [framework/conformance](../framework/conformance/README.md). The [capability ledger](../framework/conformance/CAPABILITIES.md) records the remaining port gates; the schema harness alone is not full protocol conformance.

## 1. Service conformance (minimum)

### 1.1 Well-known endpoints

| Test | Pass criteria |
|---|---|
| `GET /.well-known/bp/manifest` | 200, `application/json`, body matches `manifest.md`. |
| `GET /.well-known/bp/health` after ready | 200, `application/json`, public body is exactly `{ "ok": true }`. |
| `GET /.well-known/bp/health` before successful manifest synchronization | 503, public body is exactly `{ "ok": false }`, unless in setup mode. |
| Health diagnostics | Only setup mode or a verified access-token user bound to the active management tenant/app; private, no-store; Vary includes Authorization. |
| `GET /.well-known/bp/schema.json` | 200, `application/json`, body matches `schema-json.md`. |

### 1.2 CORS

| Test | Pass criteria |
|---|---|
| `OPTIONS <any-view-path>` with `Origin` and `Access-Control-Request-Method: POST` | 204, returns the headers listed in `protocol.md` section 2. |
| `GET <view-path>` cross-origin | Response includes `Access-Control-Allow-Origin` and `Access-Control-Expose-Headers` including the HX-* family. |

### 1.3 Content negotiation

| Test | Pass criteria |
|---|---|
| `GET <view-path>` with `Accept: application/json` | 200, JSON body matching the view's `jsonResponseSchema`. |
| `GET <view-path>` with `Accept: text/html` | 200, HTML body; no `<html>` wrappers unless `mode=page`. |
| `GET <view-path>?_f=loc.id` with `Accept: text/html; mode=fragment` | 200, only the fragment HTML for `loc.id`. |
| `GET <view-path>` with `Accept: application/vnd.unknown+json` | 406. |

### 1.4 Fragment HTML rules

| Test | Pass criteria |
|---|---|
| Inspect any fragment response for `href` / `hx-get` / `hx-sse:connect` | All values are root-relative (`/`-prefixed). No absolute URLs. |
| Inspect any fragment with cross-service links | Has `data-bp-service="<own-binding>"` ancestor in the rendered output, OR is documented as relying on theme placeholder context. |

### 1.5 Schema validation

| Test | Pass criteria |
|---|---|
| `GET <view-path>?<invalid-query>` | 400 with a validation error representation; no handler invocation. Do not require a universal machine-code string. |
| Response body validated against `jsonResponseSchema` | Matches the schema exactly. Unknown keys are stripped by default or rejected when the schema explicitly selects `"reject"`; passthrough is forbidden. |

### 1.6 Error shape

| Test | Pass criteria |
|---|---|
| 4xx/5xx responses | Match the negotiated JSON/HTML/empty-body representation in protocol.md section 4. Streaming failures use terminal frames. |

## 2. Service with dynamic config

Add these tests if the service exposes managed settings (`mode: bp-managed` or `mode: hybrid`):

| Test | Pass criteria |
|---|---|
| `GET /.well-known/bp/config/schema` | 200, body matches `config.md` section 2.1. |
| `GET /.well-known/bp/config` without ticket | 401. |
| `GET /.well-known/bp/config` with expired ticket | 401. |
| `GET /.well-known/bp/config` with valid ticket, scope mismatch | 403. |
| `GET /.well-known/bp/config` with valid ticket | 200, `values` includes only fields per the schema; secret fields = `"__redacted__"`. |
| `POST /.well-known/bp/config` with secret = `"__redacted__"` | Existing secret value preserved (not overwritten). |
| `POST /.well-known/bp/config` with secret = `"<plaintext>"` | Persisted encrypted (verify by reading storage). |
| Successful write | Response includes `HX-Trigger: bp:config-saved` (RECOMMENDED). |

## 3. Service with view auth

Add these tests if any view declares `auth.required = true`:

| Test | Pass criteria |
|---|---|
| `GET <protected-path>` without Authorization | 401. |
| `GET <protected-path>` with `Authorization: Bearer <invalid>` | 401. |
| `GET <protected-path>` with `Authorization: Bearer <expired>` | 401. |
| `GET <protected-path>` with valid token, missing required permission | 403. |
| `GET <protected-path>` with valid token + permissions | 200. |

## 4. Service with SSE

Add these tests if the service declares an SSE endpoint:

| Test | Pass criteria |
|---|---|
| `GET <route.path>/__sse` | 200, `Content-Type: text/event-stream`, first event within 1s. |
| Stream format | Valid SSE per WHATWG (LF or CRLF, blank-line separators). |
| `GET <route.path>/__sse?_f=loc.id` for a fragment with `renderTick` | `data:` payload is HTML matching the fragment renderer. |
| `GET <route.path>/__sse` (no `_f`) | `data:` payload matches `EventSchema`. |
| Event renderer throws | Stream stays open; `event: error` emitted. |
| Event-driven publish validation | Invalid `InputSchema` data and invalid mapped `EventSchema` data are rejected. |
| Event-driven scope isolation | A tenant/app publication reaches only matching subscribers. |
| Client disconnects | Server releases resources (verify with metrics). |

## 4a. Streaming views

Add these tests if any view declares a `streaming` block in the manifest (see `streaming.md`):

| Test | Pass criteria |
|---|---|
| `GET <view-path>` with `Accept: application/json` | 200, body is `{ items: [...], summary? }` matching the derived `jsonResponseSchema`. |
| `GET <view-path>` with `Accept: application/x-ndjson` | 200, `application/x-ndjson`; one frame per line; legal order (items -> summary? -> terminal). |
| Every `item` frame payload | Validates against the view's `itemSchema`. |
| Terminal frame | Exactly one `end` (with correct `count`) or `error`; nothing after it. |
| Mid-stream failure | `error` frame emitted in-band; stream closes; no `end`. |
| `GET <view-path>/__sse?<query>` with theme context | Named events `item`/`summary`/`end`; `data:` payloads are rendered HTML per `fragment-html.md`. |
| `GET <view-path>/__sse?<query>` without theme context | `data:` payloads are frame JSON. |
| `GET <non-streaming-view>` with `Accept: application/x-ndjson` | 406. |

## 4b. Search provider (`search.v1`)

Add these tests if the manifest declares the `search.v1` capability (see `search.md`):

| Test | Pass criteria |
|---|---|
| `GET /.well-known/bp/search?q=ab` | 200, results match the pinned item schema. |
| `GET /.well-known/bp/search?q=a` | 400. |
| `GET /.well-known/bp/search` (no `q`) | 400. |
| Results with `Authorization` forwarded | Only results the bearer may see. |
| Results without `Authorization` | Only anonymous-visible results. |
| Every result | Canonical fields complete; meaningful without `html`. |

## 5. Theme conformance

In addition to section 1, themes:

| Test | Pass criteria |
|---|---|
| Serve `/.well-known/bp/theme/nav` | 200, HTML; emits only relative URLs. |
| Serve `/.well-known/bp/shell/fragment/<id>` | 200 HTML, 204 for explicit empty, or 404 when unavailable; emits relative URLs. |
| Serve `/.well-known/bp/theme/style` (if reloadable) | 200, CSS or `<style>` element. |
| Page response includes `data-bp-services="{...}"` on shell root | JSON map of `bindingId -> origin`. |
| Page response includes `<meta name="htmx-config" content="...">` with `selfRequestsOnly:false` | Allows cross-origin HTMX requests. |
| Page response loads htmx + any required extensions | Including `hx-sse` if any view uses SSE. |

## 6. IdP conformance (for non-default auth providers)

| Test | Pass criteria |
|---|---|
| `GET /.well-known/openid-configuration` | 200, JSON discovery doc per OIDC. |
| `GET /.well-known/jwks.json` | 200, JWKS. |
| BP-issued tokens | RS256 JWTs satisfying JwtClaimsSchema, access/refresh purpose enforced, tenant/app binding and scoped roles checked. External OIDC credentials require an explicit exchange. |
| Refresh-token grant | Supported (RECOMMENDED). |

## 7. SDK conformance

Beyond servicing the wire protocol, an SDK SHOULD:

| Capability | Notes |
|---|---|
| Codegen for file-based routing | Optional but RECOMMENDED. Match the Node SDK's `bp-routes/` convention. |
| Manifest auto-derivation | Build the manifest from declared route handlers; avoid hand-written manifests. |
| Schema interchange | AnyVali native import/export and sensitive APIs; shared documents generate native types. No second validation system. |
| Bearer auth middleware | Provide a helper that wraps `JwksVerifier`-equivalent for the language. |
| Encrypted config store | AES-256-GCM with scrypt key derivation per `config.md` section 4. |
| `BPService` base | A language-idiomatic base class / interface that hides h3/express/etc. plumbing. |

## 8. Filing claims

A service or SDK that passes the relevant sections MAY publish:

```
BetterPortal-Protocol-Version: 2
BetterPortal-Conformance: service, dynamic-config, view-auth, sse
```

...in its README and on its `User-Agent` header. The list is comma-separated and matches the section headers above.

## 9. Out of scope (for now)

These are documented but not yet tested by conformance:

- Individual auth-provider implementations (framework service/delegated auth remains a required port gate).
- Embedded mode (`Accept: text/html; mode=embed`).
- Plugin marketplace metadata.
- Internationalization of UI strings.

Future protocol revisions MAY promote these to required surface.
