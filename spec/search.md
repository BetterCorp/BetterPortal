# Federated Search

**Version:** `bp-protocol/1`
**Status:** Draft
**Capability:** `search.v1`

BetterPortal search is federated: a dedicated **search aggregator service** fans a query out to every registered service that opts in, merges the results, and renders them. Services opt in by implementing one well-known endpoint. The aggregator - not the providers - owns ranking presentation, link resolution, and result visibility.

## 1. Opting in (provider side)

A service that supports search:

1. Declares the capability token `search.v1` in its manifest `capabilities[]`.
2. Exposes `GET /.well-known/bp/search` (allowed as a service-specific well-known path per `protocol.md` section 1).

Aggregators discover providers by scanning manifests of the services registered for the current app - no other registration step exists.

## 2. Search endpoint

```
GET /.well-known/bp/search?q=<query>&limit=<n>
```

| Input | Where | Rules |
|---|---|---|
| `q` | query | required, MUST be >= 2 characters after trim; shorter -> `400` |
| `limit` | query | optional, max results to return; default 10, providers MAY cap lower |
| `X-BP-Tenant-Id` | header | tenant scope (see `protocol.md` section 6) |
| `X-BP-App-Id` | header | app scope |
| `Authorization` | header | optional bearer, **forwarded** from the originating user request |

**Permission filtering is the provider's job.** A provider MUST NOT return results the bearer (or anonymous caller) is not allowed to see. The aggregator forwards the user's token verbatim and does no auth reasoning beyond pass-through.

### 2.1 Response

The endpoint is a **streaming view** per `streaming.md`: it MUST support buffered JSON (section 2.1 there) and SHOULD support NDJSON frames (section 2.2) so aggregators can consume results as they are found. The item schema is **pinned by this spec** - aggregators need no manifest lookup to validate:

```jsonc
// itemSchema - one search result
{
  "id": "order-1042",                  // required; unique within this provider's response
  "title": "Invoice #1042",            // required
  "snippet": "...matched text...",         // optional, plain text - no markup
  "icon": "receipt",                   // optional, icon token (theme interprets)
  "score": 0.92,                       // optional, 0..1, provider-relative
  "viewId": "orders.detail",           // optional - see section 3.1
  "params": { "orderId": "1042" },     // optional, fills :params in the resolved route path
  "html": "<div>...</div>"               // optional - see section 3.2
}
```

```jsonc
// summarySchema
{ "total": 12 }                        // total matches known to the provider (may exceed limit)
```

Field rules:

- The canonical fields (`id`, `title`, `snippet`, `icon`, `score`, `viewId`, `params`) MUST fully describe the result. JSON consumers MUST be able to ignore `html` entirely.
- `score` values are provider-relative. Aggregators MUST NOT compare scores across providers as if normalized.
- Providers SHOULD answer within 500 ms at p95; aggregators WILL drop slower providers from interactive results (section 3.3).

## 3. Aggregator behavior

These rules are normative for any service presenting itself as a BetterPortal search aggregator.

### 3.1 Link resolution via `viewId` - match or hide

A result carrying `viewId` is a link to a view of the **providing service**. The aggregator resolves it against the current app's route mounts (`routeId`/`serviceId`/`viewId` in the platform config):

1. Find a route mount whose `serviceId` matches the provider and whose `viewId` matches the result's.
2. Found -> link the result to the mount's public path, substituting `:param` segments from `params`.
3. Not found -> the result is **hidden by default** (the view is not mounted for this app, so the user cannot navigate to it). Aggregators MAY offer a per-app config flag to show such results unlinked instead.

Results without `viewId` are rendered unlinked.

### 3.2 Custom result rendering via `html`

When a result carries `html`, the aggregator MAY use it as the result row body instead of its default `title`/`snippet`/`icon` template. The fragment MUST follow `fragment-html.md` (relative URLs only); the aggregator MUST wrap it in an element carrying the provider's `data-bp-service` binding so the theme rewriter resolves URLs to the provider's origin. Link resolution and hiding (section 3.1) still apply to the wrapping row - `html` decorates a result, it does not bypass visibility.

### 3.3 Fan-out

- The aggregator queries providers in parallel, preferring NDJSON, and SHOULD surface results as frames arrive (its own search view is itself a streaming view per `streaming.md`).
- Per-provider timeout (recommended 800 ms interactive): on expiry, drop the provider's remaining results, log, continue. A provider failure MUST NOT fail the search.
- Invalid frames from a provider are dropped per `streaming.md` section 3.2 without aborting that provider's stream.
- The aggregator MUST forward `Authorization`, `X-BP-Tenant-Id`, and `X-BP-App-Id` unmodified.

### 3.4 Ordering

Cross-provider ordering is presentation, not protocol. Recommended: group by provider in app service-registration order; order within a provider by `score` descending when present, else provider order. Aggregator HTML SHOULD tag rows with machine-readable hints (e.g. `data-bp-score`) so client-side code may reorder progressively-arriving rows.

## 4. Conformance

Provider declaring `search.v1`:

- MUST serve `GET /.well-known/bp/search` with CORS per `protocol.md` section 2.
- MUST return `400` for missing/short `q`.
- MUST validate results against the pinned item schema (section 2.1) before emission.
- MUST filter results by the forwarded bearer's permissions.
- MUST support buffered JSON; SHOULD support NDJSON.
- Results MUST be complete without `html`.

Aggregator:

- MUST hide results whose `viewId` resolves to no route mount in the current app (unless configured to show unlinked).
- MUST sandbox provider `html` inside the provider's `data-bp-service` context.
- MUST survive provider timeout/failure with partial results.
