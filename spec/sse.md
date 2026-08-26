# Server-Sent Events

**Version:** `bp-protocol/2`

BetterPortal uses Server-Sent Events (SSE) for two purposes:

1. **Per-view streams** - a route can push data to a connected client (e.g., a live clock, ticker, notification feed).
2. **Control-plane config sync** - services subscribe to a control-plane SSE stream to receive scoped config updates.

This document specifies both. WebSockets are NOT used by the protocol; if bidirectional comms are needed, define a separate endpoint.

SSE is a transport of the owning GET operation, not a separate route contract. The SSE endpoint inherits the GET operation id, params/query schemas, auth, permissions, dependencies, tenant/app context, service availability checks, and app route allowlist. A normal fragment-only GET is not SSE: it is a finite HTTP response with a fragment renderer. A `createStreamHandler` stream is also finite; its HTML transport may use SSE while preserving the same GET operation identity.

---

## 1. Per-view SSE streams

### 1.1 Endpoint convention

A view with SSE support exposes its stream at:

```
GET <route.path>/__sse
```

Examples:

- View at `/hello` -> SSE at `/hello/__sse`
- View at `/orders/:orderId` -> SSE at `/orders/:orderId/__sse` (path parameters preserved)

The endpoint MUST respond with `Content-Type: text/event-stream`.

### 1.2 Wire format

Standard SSE per WHATWG (`event:`, `data:`, `id:`, `retry:`, blank-line separator). Each message MAY have an `event` name (for typed dispatch) or be unnamed (default message).

Example stream:

```
event: status
data: 12:34:56

event: status
data: 12:34:57

event: error
data: {"code":"render_failed","message":"..."}

data: A plain text message

```

### 1.3 Validation and themed rendering

A view MAY associate each event with a renderer-specific HTML fragment. Clients select the fragment id by passing `?_f=<location>.<fragmentId>` on the SSE connect URL; the renderer compatibility key still comes exclusively from the resolved app shell:

```
GET /hello/__sse?_f=nav.clock
```

For an event-driven route created with `createSse(...)`:

- `InputSchema` validates the value passed by service code to `this.betterPortal.sse.emit(...)`.
- The route mapper resolves that input into an event, and `EventSchema` validates the mapper result before delivery.
- Tenant and app scope isolate each publication from other subscribers.

When `_f` is present:

- The service applies the matching fragment's `renderTick(event)` and emits the rendered HTML as the SSE `data:` field.

When `_f` is absent:

- The service emits the `EventSchema`-validated value as the `data:` field, encoded as JSON unless it is already a string.

This dual mode lets the same stream feed both HTML-rendering browsers and JSON-consuming non-browser clients.

Manual generators are unsupported. Every per-view SSE route uses `InputSchema`, `EventSchema`, and `createSse(...)`; codegen rejects `handleSSE`/`tickSchema` modules.

### 1.4 HTMX consumption

The HTMX `hx-sse` extension consumes the stream:

```html
<span hx-ext="sse" hx-sse:connect="/hello/__sse?_f=nav.clock">--:--:--</span>
```

- Unnamed messages auto-swap into the element's innerHTML (htmx 4 default).
- Named events fire as DOM events; bind via `hx-on:sse:<eventname>="..."` or any HTMX trigger.

The `hx-sse:close="<eventname>"` attribute closes the connection on that event.

### 1.5 Lifecycle

- A client closing the connection (browser tab closed, `EventSource.close()`) MUST cause the server to release resources.
- Reconnection is the client's responsibility. The HTMX ext auto-reconnects with backoff.
- A server MAY send `retry: <ms>` to control reconnect delay.
- A server MAY close the connection cleanly by ending the stream with a final blank line.

### 1.6 Errors

If an event render fails:

- The connection SHOULD stay open.
- The server SHOULD emit a `event: error` message with a JSON `data:` payload describing the failure.
- The server MUST NOT crash the stream because of a single bad event.

If the generator itself errors (a fatal condition):

- The server logs the error.
- The stream closes.
- The client reconnects.

### 1.7 Route contract

A service-authored event-driven SSE module exports `InputSchema`, `EventSchema`, and a default `createSse(...)` contract:

```ts
import * as av from "anyvali";
import { createSse } from "../../.bp-generated/route-runtime.js";

export const InputSchema = av.object({
  id: av.string().minLength(1)
});

export const EventSchema = av.object({
  id: av.string(),
  title: av.string(),
  status: av.string()
});

export default createSse(
  { input: InputSchema, event: EventSchema },
  async (input, ctx) => ctx.plugin.findIncident(input.id)
);
```

Codegen registers the input/event schemas and any `_<location>.<fragmentId>.sse.tsx` renderer exporting `renderTick`. Developers do not hand-edit the generated route registry or manifest.

Service/plugin code emits by stable view id without importing the route module:

```ts
this.betterPortal.sse.emit(
  "incidents.index",
  { tenantId, appId },
  { id: incident.id }
);
```

Codegen makes the view id and input compile-time safe. BetterPortal validates the input and mapped event again at runtime. Browser-to-service messages use normal validated POST/PUT/PATCH operations; SSE remains server-to-browser only.

### 1.8 CORS

SSE endpoints follow the same CORS rules as view routes (see `protocol.md` section 2). The `Access-Control-Allow-Credentials` header is not used - auth tokens travel via `Authorization`, not cookies.

---

## 2. Control-plane config sync

The admin service (or any service acting as a control plane) pushes scoped config to services via SSE. This avoids polling and keeps services in sync with `bp-config.yaml` changes.

### 2.1 Endpoint

```
GET <control-plane-origin>/.well-known/bp/sync
```

Auth: `Authorization: Bearer <service-api-key>` (the calling service's `apiKeyHash` round-tripped through a token exchange; the simplest impl uses the raw API key as the bearer).

Node BSB services should place sync credentials under their nested BetterPortal config block:

```yaml
betterportal:
  controlPlaneUrl: http://localhost:3300
  serviceApiKey: <raw-service-api-key>
```

The raw key is shown once during service registration; the platform config stores only `apiKeyHash`.

### 2.2 Wire format

The control plane emits one event per refresh:

```
event: config
data: {<ScopedServiceConfig JSON>}

```

`ScopedServiceConfig` shape:

```jsonc
{
  "tenants": [
    {
      "tenantId": "betterportal",
      "appIds": ["betterportal-web"],
      "allowedOrigins": ["http://localhost:3100"],
      "config": { ... }                    // values for this service, this tenant
    }
  ],
  "apps": [
    {
      "appId": "betterportal-web",
      "tenantId": "betterportal",
      "shell": {
        "serviceId": "019f0000-0000-7000-8000-000000000001",
        "service": "bootstrap1",
        "renderer": "bootstrap5"
      },
      "config": { ... }                    // values for this service, this app
    }
  ]
}
```

Only tenants/apps that bind this service (per `bp-config.yaml`) are included. The service uses this to resolve incoming requests without reading the full `bp-config.yaml`.

Each scoped app keeps service-owned `routes` and `fragments` as the inbound allowlist. It also carries read-only `appRoutes` and `appFragments` indexes for application-wide cross-service lookup. URL and fragment resolvers may read the application indexes, but MUST NOT use them to authorize an incoming route for the current service. Older cached snapshots may omit the application indexes; runtimes fall back to service-local lookup until the next sync.

### 2.3 Reconnection

The connecting service is responsible for reconnecting on close (with a 5-second delay or backoff). The control plane MAY close idle connections after a long timeout.

Startup readiness is tied to the first scoped config snapshot. A service in control-plane sync mode SHOULD return `503` for view routes and tenant/app config endpoints until one of these is true:

- a scoped config snapshot has been applied from bootstrap poll or SSE
- a local file config provider is explicitly configured
- the service is in setup mode and is only serving bootstrap/install endpoints

The long-lived SSE log should make the state obvious. Log the bootstrap poll result, log when config is applied, and log the SSE connection as an update stream that is connected and awaiting changes. A final "connecting" line without a later "connected/awaiting updates" line is ambiguous and should be avoided.

### 2.4 Conformance

A service consuming control-plane sync:

- MUST treat the stream as advisory; the authoritative `bp-config.yaml` is still the source of truth.
- MUST handle `ScopedServiceConfig` updates atomically (no partial state visible to handlers).
- SHOULD expose sync/readiness state through `/.well-known/bp/health`.

A control plane emitting the stream:

- MUST emit a `config` event on every connection open (full snapshot).
- MUST emit a `config` event on any change (incremental snapshot, full shape).
- MUST authenticate the requester (API key check).

---

## 3. Conformance tests

See `conformance.md` for the test matrix. Key tests:

- A per-view SSE endpoint responds with `Content-Type: text/event-stream` and emits the first message within 1 second.
- `?_f=loc.id` returns themed HTML; absence returns `EventSchema`-validated JSON.
- Invalid emitted input or mapped event data is rejected by its declared schema.
- Publications are isolated by tenant and app.
- A render error emits `event: error` and keeps the stream open.
- Control-plane sync emits a snapshot on connect.
