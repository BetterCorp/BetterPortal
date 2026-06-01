# Server-Sent Events

**Version:** `bp-protocol/1`

BetterPortal uses Server-Sent Events (SSE) for two purposes:

1. **Per-view streams** — a route can push data to a connected client (e.g., a live clock, ticker, notification feed).
2. **Control-plane config sync** — services subscribe to a control-plane SSE stream to receive scoped config updates.

This document specifies both. WebSockets are NOT used by the protocol; if bidirectional comms are needed, define a separate endpoint.

---

## 1. Per-view SSE streams

### 1.1 Endpoint convention

A view with SSE support exposes its stream at:

```
GET <route.path>/__sse
```

Examples:

- View at `/hello` → SSE at `/hello/__sse`
- View at `/orders/:orderId` → SSE at `/orders/:orderId/__sse` (path parameters preserved)

The endpoint MUST respond with `Content-Type: text/event-stream`.

### 1.2 Wire format

Standard SSE per WHATWG (`event:`, `data:`, `id:`, `retry:`, blank-line separator). Each message MAY have an `event` name (for typed dispatch) or be unnamed (default message).

Example stream:

```
event: tick
data: 12:34:56

event: tick
data: 12:34:57

event: error
data: {"code":"render_failed","message":"…"}

data: A plain text message

```

### 1.3 Themed rendering

A view MAY associate each tick's data with a per-theme HTML renderer. Clients select that renderer by passing `?_f=<location>.<fragmentId>` on the SSE connect URL:

```
GET /hello/__sse?_f=nav.clock
```

When `_f` is present:

- The service validates the data per its `tickSchema` (if declared in the manifest under the SSE entry).
- The service applies the matching theme's `sseRender(data)` and emits the rendered HTML as the SSE `data:` field.

When `_f` is absent:

- The service emits raw JSON (per `tickSchema`) as the `data:` field, one tick per JSON object.

This dual mode lets the same stream feed both HTML-rendering browsers and JSON-consuming non-browser clients.

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

If a tick render fails:

- The connection SHOULD stay open.
- The server SHOULD emit a `event: error` message with a JSON `data:` payload describing the failure.
- The server MUST NOT crash the stream because of a single bad tick.

If the generator itself errors (a fatal condition):

- The server logs the error.
- The stream closes.
- The client reconnects.

### 1.7 Manifest declaration

A view declares SSE support in its manifest entry:

```jsonc
{
  "viewId": "hello.index",
  "path": "/hello",
  ...,
  "sse": {
    "path": "/hello/__sse",
    "tickSchema": { ... },               // optional anyvali-style descriptor
    "themedRenderers": {
      "bootstrap1": ["nav.clock"]        // fragments that have sseRender support
    }
  }
}
```

`themedRenderers` lists `<location>.<fragmentId>` keys that have a per-theme `renderTick` function defined.

### 1.8 CORS

SSE endpoints follow the same CORS rules as view routes (see `protocol.md` § 2). The `Access-Control-Allow-Credentials` header is not used — auth tokens travel via `Authorization`, not cookies.

---

## 2. Control-plane config sync

The admin service (or any service acting as a control plane) pushes scoped config to services via SSE. This avoids polling and keeps services in sync with `bp-config.yaml` changes.

### 2.1 Endpoint

```
GET <control-plane-origin>/.well-known/bp/sync
```

Auth: `Authorization: Bearer <service-api-key>` (the calling service's `apiKeyHash` round-tripped through a token exchange; the simplest impl uses the raw API key as the bearer).

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
      "themeId": "bootstrap1",
      "config": { ... }                    // values for this service, this app
    }
  ]
}
```

Only tenants/apps that bind this service (per `bp-config.yaml`) are included. The service uses this to resolve incoming requests without reading the full `bp-config.yaml`.

### 2.3 Reconnection

The connecting service is responsible for reconnecting on close (with a 5-second delay or backoff). The control plane MAY close idle connections after a long timeout.

### 2.4 Conformance

A service consuming control-plane sync:

- MUST treat the stream as advisory; the authoritative `bp-config.yaml` is still the source of truth.
- MUST handle `ScopedServiceConfig` updates atomically (no partial state visible to handlers).

A control plane emitting the stream:

- MUST emit a `config` event on every connection open (full snapshot).
- MUST emit a `config` event on any change (incremental snapshot, full shape).
- MUST authenticate the requester (API key check).

---

## 3. Conformance tests

See `conformance.md` for the test matrix. Key tests:

- A per-view SSE endpoint responds with `Content-Type: text/event-stream` and emits the first message within 1 second.
- `?_f=loc.id` returns themed HTML; absence returns raw JSON.
- A render error emits `event: error` and keeps the stream open.
- Control-plane sync emits a snapshot on connect.
