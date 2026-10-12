# BPRoute and service-owned destinations

Use **BPRoute** for service-rendered links, action controls, forms and embedded components/fragments. Use **ctx.route()** only when a destination value is specifically required. APIs return domain data, IDs and cursors; renderers resolve their own controls. An API must not compute internal destinations merely to send them to a view.

Service renderers target service endpoints. The theme translates these destinations to enabled UI mounts and owns browser history. Never choose `uiPath` as the ordinary service-renderer `href`, even though the control is used in a browser. `uiPath` belongs to explicit shell navigation/history; `absoluteUiPath` is for public links, emails and callbacks.

This is a breaking replacement for `ctx.routeUrl`, `ctx.uiRouteUrl`, `ctx.url`, `ctx.routeUi` and `BPElement`. Old exports/usages fail type checking and routing authoring validation. Current route presentation metadata is `ctx.routeInfo`, leaving `ctx.route` exclusively callable.

## Ordinary links and failure content

```tsx
/** @jsxImportSource @betterportal/framework */
import { BPRoute } from "@betterportal/framework";

<BPRoute ctx={ctx} viewId="invops.batches.detail" params={{ batchId: batch.batchId }}>
  <bp-ok>{batch.batchId}</bp-ok>
  <bp-error>{batch.batchId}</bp-error>
</BPRoute>
```

Success produces an anchor with a service-view destination such as `/batches/1`. The theme maps it to a configured mount such as `/installed-service-id/batches/1`. Missing or ambiguous navigation mounts select `bp-error`; there is no guessed prefix, API-link fallback or page-rendering exception.

The outer `as` is the default rendered element. A state's `as` overrides it. State attributes override matching outer HTML attributes. `as="none"` renders only children. Without `as`, ordinary success defaults to an anchor and failure/loading states have no wrapper. State changes replace the active root rather than nesting a label/image inside the previous button.

```tsx
<BPRoute ctx={ctx} as="button" viewId="items.detail" params={{ itemId }}>
  <bp-ok>Show item</bp-ok>
  <bp-error as="label" id="item-unavailable">Item unavailable</bp-error>
</BPRoute>

<BPRoute ctx={ctx} as="button" viewId="items.detail" params={{ itemId }}>
  <bp-ok>Show item</bp-ok>
  <bp-error disabled>Item unavailable</bp-error>
</BPRoute>

<BPRoute ctx={ctx} viewId="items.detail" params={{ itemId }}>
  <bp-ok>Show item</bp-ok>
  <bp-error><img src="/assets/unavailable.svg" alt="Item unavailable" /></bp-error>
</BPRoute>
```

Resolver properties (`ctx`, `viewId`, `path`, params/query and renderer selectors) are consumed server-side, never serialized as HTML attributes. State `class`, `id`, `disabled`, `aria-*` and presentation attributes pass through. Generated URL/request attributes never leak into fallback controls.

## HTMX methods and overrides

Valueless `hx-get`, `hx-post`, `hx-put`, `hx-patch` and `hx-delete` select the operation method and receive the resolved service-view destination. The selected method participates in resolution and access checks. A DELETE marker must not resolve GET and merely reuse its path. An explicit method marker overrides the outer method. Multiple method attributes on one control are invalid authoring.

```tsx
<BPRoute ctx={ctx} viewId="items.detail" params={{ itemId }}>
  <bp-ok as="a" hx-delete hx-confirm="Delete this item?">Delete</bp-ok>
  <bp-error as="span">Delete unavailable</bp-error>
</BPRoute>
```

Success receives `hx-delete` with the resolved service address and no automatically generated `href`. The JSX boolean marker is consumed; it is never emitted as `hx-delete="true"`. Other HTMX attributes, such as `hx-target`, `hx-swap`, `hx-confirm` and `hx-include`, pass through.

A supplied URL value is an explicit request override, including a target outside the known route registry. Such a target has no inferred preflight permission guarantee; actual request authorization and runtime origin/header policies still apply.

```tsx
<BPRoute ctx={ctx} as="button" viewId="items.detail" params={{ itemId }}>
  <bp-ok hx-post="/special-action" hx-target="#result">Run special action</bp-ok>
  <bp-error as="span">Action unavailable</bp-error>
</BPRoute>
```

Use `target`/`swap` on BPRoute or ordinary `hx-target`/`hx-swap` on a state. Buttons default to `type="button"`; forms preserve explicit submit buttons and native HTML validation. Rendering, loading a component, history restoration and preload must never execute a mutation.

```tsx
<BPRoute ctx={ctx} as="form" viewId="items.update" params={{ itemId }} method="POST">
  <bp-ok>
    <input name="title" required />
    <button type="submit">Save</button>
  </bp-ok>
  <bp-noperm>You cannot edit this item.</bp-noperm>
  <bp-error>Saving is unavailable.</bp-error>
</BPRoute>
```

## Embedded components and fragments

Supplying `component` or `fragment` selects embedding, never an actionable link/button/form. Select one, never both. Embedding uses GET and the normal BP HTML request pipeline. It preserves declared dependency aliases and the active `shell` fragment capability previously provided by BPElement.

```tsx
<BPRoute ctx={ctx} viewId="invops.batches.detail" params={{ batchId }} component="summary">
  <bp-loading>Loading summary…</bp-loading>
  <bp-ok as="div" class="p-3" />
  <bp-noauth>Sign in to see the summary.</bp-noauth>
  <bp-noperm />
  <bp-error as="span">Summary unavailable</bp-error>
</BPRoute>

<BPRoute ctx={ctx} service="crm" path="/customers/:customerId"
  params={{ customerId }} fragment="profile.summary">
  <bp-status code="404">Customer not found.</bp-status>
  <bp-error>Profile unavailable.</bp-error>
</BPRoute>

<BPRoute ctx={ctx} service="shell" fragment="theme-selector" />
```

Fetched HTML supplies success content. `bp-ok` optionally provides a wrapper via `as` and HTML attributes. Its authored children and routing attributes are ignored. No authored `<template />` insertion placeholder is needed. Without a wrapper, insert the response directly. Loading and failure states retain authored children. A 204 embed response is successful empty content.

To keep a clickable control that requests a component into another target, use an explicit destination override without an embedding selector on BPRoute itself:

```tsx
<BPRoute ctx={ctx} as="button" viewId="items.detail" params={{ itemId }} target="#summary"
  hx-get={ctx.route({ viewId: "items.detail", params: { itemId } })?.component("summary")?.viewPath}>
  <bp-ok>Show summary</bp-ok>
  <bp-error as="span">Summary unavailable</bp-error>
</BPRoute>
```

This is a specific reason to use the low-level resolver: a control requests component HTML while remaining an action control, rather than an automatically loaded embed.

## Authentication, permissions and request states

`bp-noauth` means authentication is required. `bp-noperm` means verified access is denied. `bp-error` covers resolution/configuration, provider, network and other failures. A null destination is never interpreted as a permission denial. `bp-status` accepts exact HTTP codes, then patterns such as `40x`, then `4xx`.

Known local operations reuse validated user claims and the existing authorization configuration for presentation checks. Unknown dependency/override access remains unknown until the request; rendering links does not send per-link authorization requests. The backend always enforces authentication, operation allowlists, permissions and elevation. Expired credentials may be refreshed for an embed GET; failed mutations are never automatically replayed.

## Low-level ctx.route()

API handlers and renderers have the same input signature. `path` always denotes a service path; `viewId` identifies a view. Omit both for self. Self inherits current method, params and query; explicit targets default to GET. Override query values are encoded once; null removes a key. Supply a declared dependency alias as `serviceId`, and `mountId` when a public destination has multiple mount aliases.

| Field | Specific use |
| --- | --- |
| `apiPath` | Relative service API endpoint for JSON/data actions. |
| `viewPath` | Relative service HTML endpoint; default for direct values used by service views. |
| `uiPath` | Explicit relative mounted theme path for shell navigation/history. Not the preferred service-view href. |
| `absoluteApiPath` | Absolute service API address. |
| `absoluteViewPath` | Absolute service HTML address, retaining service deployment prefixes. |
| `absoluteUiPath` | Absolute public app/theme link for sharing, email or callbacks. |

Results stringify to **apiPath in API context** and **viewPath in view context**, never a UI field. `.component(id)` and `.fragment(id)` return new destinations without mutating the original. Methods are not serialized; portable destination data contains only six fields. Invalid resolution returns null, so use optional chaining for explicit value consumers.

```tsx
const summary = ctx.route({ viewId: "items.detail", params: { itemId } })?.component("summary");
// A specifically required direct value; ordinary controls should use BPRoute.
<button hx-get={summary} hx-target="#summary">Show summary</button>
```

Use `@betterportal/framework` as `jsxImportSource` for typed route values, state attributes and HTMX markers. It delegates rendering/escaping to JSX-HTMX. Python uses `context.route()` and `str(destination)`; .NET uses `context.Route()` and `destination.ToString()`, with the same API/view distinction and six-field wire contract. Renderer metadata becomes `route_info`/`RouteInfo`.

See [routing lint and build validation](routing-lint.md) for invalid examples, diagnostics and supported exceptions.

BPRoute success controls make browser user requests. An authenticated user sees bp-noperm for a known required operation whose callers exclude user (service/delegated-only), even if that user holds a platform-root role. Presentation checks do not widen the backend caller policy.
