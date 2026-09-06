# BetterPortal Protocol - HTTP Surface

**Version:** `bp-protocol/2`
**Status:** Draft

## 1. Well-known endpoints

Every BetterPortal service MUST expose these paths under `/.well-known/bp/`. They are all HTTP/1.1 or HTTP/2.

| Path | Method | Purpose | Auth |
|---|---|---|---|
| `/.well-known/bp/manifest` | GET | Plugin manifest JSON. | none |
| `/.well-known/bp/health` | GET | Liveness/readiness probe. | none |
| `/.well-known/bp/schema.json` | GET | Flattened route catalog (manifest + routes). | none |
| `/.well-known/bp/config/schema` | GET | Per-service config schema descriptor. | none |
| `/.well-known/bp/config` | GET | Read tenant/app config values. | Bearer ticket |
| `/.well-known/bp/config` | POST | Write tenant/app config values. | Bearer ticket |
| `/.well-known/bp/resources` | GET | Public developer-resource index. | none |
| `/.well-known/bp/resources/<id>` | GET | Public guide, template, skill, or example content. | none |

Services MAY expose additional well-known paths under `/.well-known/bp/` for SDK-specific or service-specific needs (e.g., theme `/theme/nav`, `/theme/style`). These are not part of the core protocol but MUST NOT collide with the table above.

Theme services additionally expose the app-level AI and developer discovery endpoints described in [ai.md](ai.md), including `/llms.txt`, its task-specific guides, and `/.well-known/bp/ai.json`.

### 1.1 Health response

`GET /.well-known/bp/health` returns JSON. A service that is ready to receive normal view traffic returns `200`:

```json
{ "ok": true }
```

Before successful manifest submission and valid scoped config, return `503` with only `{ "ok": false }`. Public probes must not disclose identities, versions, tenant/app counts, configuration, or sync diagnostics. Load balancers use readiness, not only process liveness. A restored snapshot alone does not prove current manifest synchronization.

Setup mode is the exception: a service with no sync credentials may expose bootstrap diagnostics at 200 with `setupMode: true`. Normal view routes remain unavailable. Outside setup, diagnostics require a verified access-token user bound to the active configured management tenant/app. Diagnostic fields include pluginId, version, config counts, and manifestSync state. Every health response uses `Cache-Control: private, no-store` and `Vary: Authorization`; invalid or ordinary-tenant credentials receive only the public representation.

Before a service has synced or loaded local config, only core bootstrap/discovery paths should respond normally: health, manifest, schema, install/adoption, bootstrap, service redemption, and JWKS. View routes and tenant/app config endpoints SHOULD return `503`.

### 1.2 Service routes

In addition to well-known endpoints, services expose view routes declared in the manifest. A view advertises its path and contains one contract per method in `operations[]`. Routes outside `/.well-known/bp/*` are the service's view surface.

A view route MUST accept content negotiation (see section 3) and respond with either:
- `application/json` (the canonical response shape per the view's schema)
- `text/html` (rendered with the app shell's server-resolved renderer compatibility key)

A view route MAY also support `application/vnd.betterportal.metadata+json` for tooling.

## 2. CORS

Services are cross-origin from the theme that loads them. CORS MUST be enabled on all view routes and `/.well-known/bp/*` paths.

Required CORS surface:

```
Access-Control-Allow-Origin:      <reflect an explicitly allowed origin>
Access-Control-Allow-Methods:     GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers:     Accept, Authorization, Content-Type,
                                  HX-Current-URL, HX-Request, HX-Target,
                                  HX-Trigger, HX-Trigger-Name,
                                  X-BP-Tenant-Id, X-BP-App-Id,
                                  X-BP-Service-Id, X-BP-Service-Authorization,
                                  BP-SetHeader, BP-RemoveHeader,
                                  traceparent, tracestate, baggage
Access-Control-Expose-Headers:    HX-Trigger, HX-Trigger-After-Swap,
                                  HX-Trigger-After-Settle, HX-Location,
                                  HX-Push-Url, HX-Redirect, HX-Refresh,
                                  HX-Replace-Url, HX-Reswap, HX-Retarget,
                                  BP-SetHeader, BP-RemoveHeader
Access-Control-Max-Age:           86400 (recommended)
```

Allowed preflight `OPTIONS` returns `204` with these headers and an empty body, without invoking a handler or demanding a browser bearer token. Reject disallowed origins and methods. Wildcard development policies must not weaken production origin checks.

If `Access-Control-Allow-Origin` is reflected per-request, the response MUST include `Vary: Origin`.

### 2.1 Why expose `HX-*` headers

HTMX read `HX-Trigger`, `HX-Location`, etc. from response headers. Browsers strip non-CORS-safelisted response headers by default. The list above is the minimum set that enables BetterPortal's live-refresh patterns (see `fragment-html.md` section 4) across origins.

## 3. Content negotiation

### 3.1 Accept header

A view route inspects the `Accept` header ([RFC 9110 section 12.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1)):

- `application/json` -> JSON response per the view's `ResponseSchema`.
- `text/html` -> HTML response (themed; see section 3.3).
- `application/vnd.betterportal.metadata+json` -> metadata about the view (optional).
- `application/x-ndjson` -> streamed frame-per-line response, streaming views only (see `streaming.md`). Non-streaming views return `406`.
- Multiple types -> highest acceptable q-weight wins; ties preserve request order. A q=0 representation is unacceptable.
- No `Accept` header or `*/*` -> service default (RECOMMENDED: JSON).

Unsupported types return `406 Not Acceptable`.

### 3.2 HTML mode parameter

HTMX requests SHOULD include a `mode` parameter on the HTML Accept type:

```
Accept: text/html; mode=page       - full-page render (initial load)
Accept: text/html; mode=fragment   - fragment render (HTMX swap)
Accept: text/html; mode=embed      - embedded render (third-party iframe-substitute)
```

If `mode` is omitted, the server SHOULD respond as `mode=page`.

### 3.3 Shell and renderer resolution

The control plane persists `app.shell.serviceId`. During scoped config delivery it resolves the selected shell manifest and supplies the read-only app context `shell: { serviceId, service, renderer }`. `service` is the shell contract identity (for example `bootstrap1`); `renderer` is the service-view compatibility key (for example `bootstrap5`).

Browser requests resolve the app from trusted request addressing such as `Origin`, `Referer`, and the effective host. The service uses only the resolved app shell renderer. Client-supplied `theme` Accept parameters, `X-BP-Theme`, `_theme` query values, and standalone `X-BP-Tenant-Id` / `X-BP-App-Id` headers do not select app or renderer context and are silently ignored.

`X-BP-Tenant-Id` and `X-BP-App-Id` establish context only inside a verified S2S or delegated envelope that also supplies the required service identity and service token. If the app shell is unresolved, or the view has no exact renderer match, the service returns `406`; there is no renderer fallback.

### 3.4 Fragment / component selectors

For HTML responses, the query string MAY include:

- `?_f=<location>.<fragmentId>` - render only that fragment (location and id MUST match the manifest).
- `?_c=<componentId>` - render only that component.

These selectors MUST be honored on **any** view route, not only the canonical view path. They are how the theme pulls fragments without needing per-fragment endpoints.

When `_f` or `_c` is present, preserve the handler/error status and return only the selected fragment/component HTML (no document wrappers), with `Content-Type: text/html; mode=fragment`. Status renderers use the selected method, renderer, kind, and key. Selectors never bypass the operation allowlist or auth policy.

### 3.5 Raw responses

An operation declared `raw: true` returns its own status, headers and byte or
stream body. It still enforces the operation's input schemas, scope, allowlist
and caller policy. Raw output bypasses representation negotiation, including a
metadata Accept header; discovery remains available for its operation metadata.
JSON handlers must not use raw responses to evade output validation.

The host owns transport and CORS headers and rejects response-header injection.
Repeated `Set-Cookie` values remain separate. A HEAD response contains no body;
the host closes an owned response stream without reading it. Final statuses are
200–599. Status 204, 205 and 304 forbids a body; 206 and redirects may carry one.
Stream producers advance only after the previous write completes. Completion,
disconnect and failure close the owned stream, including a result returned after
cancellation. A raw stream failure after headers aborts delivery; the host must
not append a JSON error to arbitrary binary content.

## 4. Error shape

JSON framework errors contain a human-readable `error` string, with optional `detail`, `status`, or validation `issues`. Existing Node endpoints do not expose one universal machine-code/message pair. Diagnostic codes belong to the observability outcome. Clients must use HTTP status and declared response contracts, not parse English error strings.

```json
{
  "error": "Invalid query",
  "issues": [           // optional, present for 400-class validation failures
    {
      "code": "<av-error-code>",
      "path": "a.b.c",
      "message": "..."
    }
  ]
}
```

HTML errors use a matching status renderer when available. The existing adapter may return an empty body for an HTML error without a renderer. Status codes that forbid a body remain empty. SSE/NDJSON errors after streaming starts are in-band terminal frames. Do not replace these representations with JSON unconditionally or disclose exception internals to unauthenticated callers.

Status codes follow HTTP conventions:

| Code | Use |
|---|---|
| 400 | Schema validation failed; include `issues`. |
| 401 | Missing or invalid bearer token (see `auth.md`). |
| 403 | Authenticated but lacks scoped role permissions, caller mode, or service grant. |
| 404 | Path not registered or `fragmentId`/`componentId` unknown. |
| 406 | Accept type, shell renderer, or render mode unsupported. |
| 409 | Resource conflict (e.g., tenant already exists). |
| 422 | Semantically invalid (vs. 400 for shape failures). |
| 503 | Service is not ready, commonly because scoped config has not synced yet. |
| 500 | Unhandled server error; SHOULD log the cause server-side. |
| 501 | Endpoint exists but feature is not implemented (e.g., config write on a read-only service). |

## 5. Identifiers

### 5.1 `pluginId`

Reverse-DNS, lowercase, with at least three dot-separated labels. Labels may contain non-leading/trailing hyphens. The identifier describes runtime identity and is independent of the registry namespace:

```
org.betterportal.<name>             - BetterPortal-owned service
org.betterportal.theme.<name>       - BetterPortal-owned theme
org.betterportal.community.<name>   - community identity delegated by BetterPortal
<reversed-company-domain>.<name>    - third-party service
```

Examples: `org.betterportal.hello-view`, `org.betterportal.theme.bootstrap1`, `com.example.invoicing`.

Registry references are distribution coordinates, not runtime IDs. For example, `betterportal/config` can publish the runtime plugin ID `org.betterportal.config`. Namespace ownership is assigned by the BetterPortal registry and a plugin ID is permanently bound to one registry reference after its first publish.

### 5.2 Paths

- Route paths use `:param` syntax for path parameters: `/orders/:orderId`.
- Path parameter names use `[a-z][a-zA-Z0-9]*`.

### 5.3 Tenant + app identifiers

`tenantId`, `appId`, `routeId`, and service-instance/activation IDs are lowercase UUIDv7 strings. Slugs and reverse-DNS plugin IDs are distinct identifiers. The canonical AnyVali contracts preserve the few compatibility surfaces that still accept general nonempty strings, such as config-ticket tenant/service identifiers.

## 6. Standard request headers

| Header | When | Meaning |
|---|---|---|
| `Accept` | every view request | content negotiation (section 3) |
| `Authorization: Bearer <token>` | protected routes, config endpoints | see `auth.md` |
| `X-BP-Tenant-Id` | verified S2S/delegated calls; service config | tenant scope; ignored for normal browser context resolution |
| `X-BP-App-Id` | verified S2S/delegated calls; service config | app scope; ignored for normal browser context resolution |
| `X-BP-Service-Id` | S2S/delegated calls | source service instance identity |
| `X-BP-Service-Authorization` | delegated calls | service bearer token; the normal `Authorization` header retains the original user JWT |
| `HX-*` | HTMX requests | per htmx.org spec; servers MAY use to detect HTMX swaps |

## 7. Standard response headers

| Header | Purpose |
|---|---|
| `HX-Trigger: <event>[,<event>...]` | Fire DOM event(s) on `body` after swap. Live-refresh primitive. |
| `HX-Trigger-After-Settle` | Same, fired after settle phase. |
| `HX-Location: <url or JSON>` | Navigate (HTMX-aware client). |
| `HX-Push-Url: <path>` | Push URL into history without navigating. |
| `HX-Redirect: <url>` | Full-page redirect. |
| `Vary: Origin, Accept` | Required when responses differ per origin or accept type. |
| `Cache-Control` | Per the view's declared `cacheHints` (manifest). |

## 8. Cookies

Services MUST NOT rely on cookies for auth. Cookies are theme-origin-only by design (cross-origin cookies break in modern browsers without SameSite=None;Secure, which forces HTTPS and other coupling).

Services MAY set cookies scoped to their own origin for non-auth purposes (e.g., view preferences). These are invisible to the theme and other services.

## 9. Optional: SSE endpoints

Services MAY expose Server-Sent Events streams for views (see `sse.md` and section 11 below). The conventional path is `<route.path>/__sse`. SSE responses have `Content-Type: text/event-stream`; ext-aware clients (HTMX `hx-sse` ext) consume them inline.

## 10. Versioning

The protocol version is an integer in the manifest's `protocolVersion` field. Version 2 is this document. Version 2 introduces method-specific operation contracts and does not flatten schemas or policy at view level. Protocol-1 manifests and app routes must be migrated by the control plane; protocol-2 producers emit stable `operationId` values and operation allowlists only.

A service MAY advertise multiple versions by exposing multiple manifests at versioned paths (`/.well-known/bp/manifest?v=2`); the unversioned path returns the highest supported.

Clients SHOULD send `BP-Protocol-Version: 2` on requests. If absent, servers assume the latest version they support. If the version is unsupported, return `400` with `error: "unsupported_protocol_version"`.

## 11. Out-of-band conventions

These are not protocol-level requirements but every conformant service is expected to follow them:

- Routes serving fragment HTML MUST provide service context, normally via a `data-bp-service="<serviceBindingId>"` ancestor, so the client URL rewriter can resolve relative paths (see `fragment-html.md`).
- Routes that emit `HX-Trigger` cross-origin MUST have the trigger name in `Access-Control-Expose-Headers`.
- Routes that perform mutations and want to trigger live-refresh on the page MUST emit `HX-Trigger: <event>` on success.

See `fragment-html.md` for full HTML conventions and `sse.md` for SSE conventions.
