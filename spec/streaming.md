# Streaming & Partial Responses

**Version:** `bp-protocol/1`
**Status:** Draft

Some views produce data incrementally — fan-out aggregation (search), slow upstreams, long result sets. This document specifies how a view streams **partial responses** so consumers (other services, aggregators, browsers) can act on data as it arrives instead of waiting for the slowest part.

> **API-first.** The canonical streamed artifact is a sequence of validated **data frames**. Every other representation — buffered JSON, streamed HTML — is a derivation of that frame stream. A streaming view MUST be fully consumable as data with zero HTML awareness.

## 1. Frame envelope

Every streamed message is a **frame** — a JSON object with a `kind` discriminator. The envelope is protocol-defined and identical for every service; the `data` payload schemas are view-defined (declared in the manifest, § 5).

```jsonc
{ "kind": "item",    "data": { ... } }                 // one element; payload per itemSchema
{ "kind": "summary", "data": { ... } }                 // optional, at most once, before "end"; per summarySchema
{ "kind": "error",   "error": "<code>", "message": "<detail>", "issues": [ ... ] }   // terminal
{ "kind": "end",     "count": 12 }                     // terminal; count = item frames emitted
```

Rules:

- A stream is zero or more `item` frames, then at most one `summary` frame, then exactly one terminal frame (`end` or `error`).
- `error` is **terminal**: consumers MUST stop reading and MUST treat already-received items as valid but the stream as incomplete. No `end` follows an `error`.
- `end.count` MUST equal the number of `item` frames emitted. Consumers MAY use it to detect truncation.
- `issues` on `error` follows the error shape of `protocol.md` § 4.
- Unknown `kind` values MUST be ignored by consumers (forward compatibility). Producers MUST NOT invent kinds outside an `x-` prefix.

## 2. Representations

A streaming view supports multiple representations of the same frame stream, selected by standard content negotiation (`protocol.md` § 3). The handler runs **once per request**; representation only changes encoding and delivery.

| `Accept` | Delivery | Body |
|---|---|---|
| `application/json` | buffered | `{ "items": [...], "summary": ... }` (§ 2.1) |
| `application/x-ndjson` | streamed | one frame per line (§ 2.2) |
| `text/html` | buffered or streamed | rendered HTML (§ 4) |
| `application/vnd.betterportal.metadata+json` | buffered | view metadata, as any view |

### 2.1 Buffered JSON

The service runs the stream to completion and responds with the assembled object:

```jsonc
{
  "items": [ <item payload>, ... ],
  "summary": { ... }        // omitted if the view declares no summarySchema
}
```

The schema of this object derives **mechanically** from the declared frame schemas: `items` is `array(itemSchema)`; `summary` is `summarySchema`. The manifest's `jsonResponseSchema` for a streaming view MUST be this derived schema — there is no second hand-authored response schema to drift.

Because nothing is sent until the stream completes, buffered mode uses **real HTTP status codes**: a failure mid-stream returns a standard 4xx/5xx error body per `protocol.md` § 4, not an `error` frame.

### 2.2 NDJSON

`Accept: application/x-ndjson` responds with:

- `Content-Type: application/x-ndjson; charset=utf-8`
- Chunked/streamed transfer; the service SHOULD flush after every frame.
- Exactly one frame (§ 1) per line, newline-terminated.

The HTTP status is `200` once streaming begins; failures after the first byte are reported in-band via an `error` frame. A failure **before** the first frame MAY still use a real HTTP error status.

A non-streaming view receiving `Accept: application/x-ndjson` returns `406 Not Acceptable`.

### 2.3 SSE

The view's existing SSE convention (`sse.md` § 1, `<route.path>/__sse`) carries the same frames for browser delivery, with frame kinds as SSE event names. See § 4.2 for themed HTML; without a theme context, each event's `data:` is the frame's JSON:

```
event: item
data: {"kind":"item","data":{...}}

event: end
data: {"kind":"end","count":3}
```

The SSE request MUST validate the same `querySchema` as the view route and MUST run the view's stream itself — the stream is produced by whichever request consumes it; servers MUST NOT stash pending stream state between a shell request and an SSE connect (it breaks multi-instance deployments).

## 3. Validation

Validation shifts from whole-response to per-frame:

1. **Producer-side (primary gate).** The service MUST validate every `item` payload against `itemSchema` and the `summary` payload against `summarySchema` **before** writing the frame. An invalid payload is a bug in the producing service: emit an `error` frame (streamed) or return `500` (buffered) and terminate.
2. **Consumer-side.** Consumers MUST validate the envelope of every frame and SHOULD validate payloads against the schema from the producer's manifest (or a spec-pinned schema, e.g. `search.md`). Per-frame failure policy is the consumer's: an aggregator SHOULD drop the bad frame and keep reading rather than abort.
3. **Cross-item invariants.** Constraints spanning multiple items (`minItems`, uniqueness, totals) cannot be checked per frame. Streaming views SHOULD NOT rely on them; aggregate facts belong in the `summary` frame, which is validated once at end of stream. A producer MAY verify count-type constraints itself at end-of-stream and emit `error` before the terminal frame on violation.

## 4. HTML representation

The HTML representation of a streaming view is a **rendering of its frame stream**. The browser never receives frame JSON in HTML mode — every byte over the wire is server-rendered HTML obeying `fragment-html.md` (relative URLs, `data-bp-service` context, no document wrappers).

### 4.1 Two-phase delivery (streamed)

**Phase 1 — shell.** `GET <path>` with `Accept: text/html; mode=fragment` returns a static shell immediately. The stream does NOT run. The shell contains SSE wiring pointing at `<path>/__sse` with the **same query string**, e.g.:

```html
<div data-bp-service="search">
  <ul hx-ext="sse" hx-sse:connect="/search/__sse?q=inv"
      sse-swap="item" hx-swap="beforeend">
    <li class="bp-spinner">Searching…</li>
  </ul>
  <footer sse-swap="summary"></footer>
</div>
```

**Phase 2 — frames as rendered HTML.** The SSE request runs the stream. Each frame is rendered server-side and pushed as a named event:

```
event: item
data: <li><a href="/orders/1042">Invoice #1042</a></li>

event: summary
data: <footer>12 results</footer>

event: end
data:
```

- `item` events are typically appended (`hx-swap="beforeend"`); `summary` replaces its slot.
- `error` events SHOULD carry a rendered error fragment when an error renderer exists, otherwise frame JSON.
- The `end` event MUST be emitted so clients can distinguish completion from a dropped connection. A client that misses `end` SHOULD treat the region as incomplete and MAY re-request.
- A dropped connection re-runs the whole stream on reconnect — streaming views MUST be safe to re-execute (idempotent reads).

### 4.2 Buffered HTML

A streaming view SHOULD also render buffered HTML (`mode=page`, no-SSE clients, crawlers): run the stream to completion and render the derived `{ items, summary }` object like any non-streaming view. Same renderer source, same validated data, delivered at once.

### 4.3 Deferred components (non-normative alternative)

When a *view* is slow in distinct regions (dashboard panels) rather than producing a homogeneous item stream, prefer **deferred components** over streaming: each slow region is its own component (own response schema, addressable via `?_c=` per `protocol.md` § 3.4) and the shell lazy-loads it:

```html
<div hx-get="/dashboard?_c=stats" hx-trigger="load" hx-swap="outerHTML">…spinner…</div>
```

This stays API-first by construction (every region is a schema'd endpoint), needs no protocol additions, and parallelizes per region. Streaming is for sequences; deferral is for slow regions.

## 5. Manifest declaration

A streaming view adds a `streaming` block to its manifest view entry (`manifest.md` § 1):

```jsonc
{
  "viewId": "search.index",
  "path": "/search",
  "methods": ["GET"],
  ...,
  "jsonResponseSchema": { ... },        // the DERIVED buffered shape (§ 2.1)
  "streaming": {
    "itemSchema": { ... },              // anyvali-style descriptor, per manifest.md § 4
    "summarySchema": { ... }            // optional
  }
}
```

Service-level `capabilities` advertise support:

| Token | Meaning |
|---|---|
| `stream.ndjson` | At least one view streams NDJSON frames. |
| `view.sse-render` | At least one view streams themed HTML frames over SSE. |

Streaming views in protocol version 1 are **GET only**.

## 6. Conformance

A conformant streaming view:

- MUST serve the buffered JSON representation (§ 2.1) for `application/json`, with `jsonResponseSchema` matching the derived shape.
- MUST serve NDJSON frames (§ 2.2) for `application/x-ndjson`, terminal frame included.
- MUST validate every frame payload before emission (§ 3.1).
- MUST emit frames in legal order (§ 1) — items, optional summary, exactly one terminal.
- MUST run the stream in the request that consumes it (§ 2.3 — no cross-request stream state).
- If it advertises themed HTML, the SSE events MUST carry rendered HTML conforming to `fragment-html.md` and MUST end with an `end` event.

See `conformance.md` for the test matrix.
