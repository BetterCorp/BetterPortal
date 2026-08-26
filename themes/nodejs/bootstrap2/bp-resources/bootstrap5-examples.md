# Bootstrap2 Bootstrap 5 examples

These examples are service-renderer fragments, never full documents.

## Compact action row

```tsx
<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
  <h1 class="h5 mb-0">Incidents</h1>
  <div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary">Export</button><button class="btn btn-primary">New incident</button></div>
</div>
```

## Filters and validation

```tsx
<form class="row g-2" hx-get={ctx.url.route("incidents.index")} hx-target="#incident-results">
  <div class="col-sm-4"><label class="form-label" for="query">Search</label><input class="form-control form-control-sm" id="query" name="query" /></div>
  <div class="col-sm-3"><label class="form-label" for="status">Status</label><select class="form-select form-select-sm" id="status" name="status"><option value="">All</option><option>Open</option></select></div>
  <div class="col-auto align-self-end"><button class="btn btn-sm btn-primary" type="submit">Apply</button></div>
</form>
<div class="invalid-feedback">Enter a valid value.</div>
```

## Status and responsive table

```tsx
<div class="table-responsive border">
  <table class="table table-sm table-hover align-middle mb-0">
    <thead><tr><th scope="col">Priority</th><th scope="col">Incident</th><th scope="col">Status</th></tr></thead>
    <tbody><tr><td><span class="badge text-bg-danger">P1 · Critical</span></td><td>Gate breach</td><td>Open</td></tr></tbody>
  </table>
</div>
```

## Mutation and passive reload

```tsx
<section data-bp-mutation-scope>
<form hx-post={ctx.url.route("incidents.index", { component: "active" })} hx-target="#incident-active" hx-swap="outerHTML">
  <button class="btn btn-sm btn-success" type="submit">Resolve</button>
</form>
<div class="alert alert-danger mt-2" data-bp-mutation-error role="alert" aria-live="polite" hidden></div>
</section>
```

Return the updated `active` component. Send `HX-Trigger: incidents:changed` only when a passive queue/count must reload, and subscribe that region with `hx-trigger="load, incidents:changed from:body"`.

## Task sidebar

```tsx
<button class="btn btn-sm btn-primary" type="button" data-bp-sidebar-open="assign-incident">Assign</button>
<section data-bp-sidebar="assign-incident" data-bp-sidebar-title="Assign incident">
  <form class="vstack gap-2"><label class="form-label" for="owner">Owner</label><select class="form-select" id="owner" name="owner"></select></form>
</section>
```

## Cross-service fragment

```tsx
import { BPElement } from "@betterportal/framework";
<BPElement ctx={ctx} service="people" path="/operators/:id" fragment="profile.summary" args={{ params: { id } }}>
  <bp-loading>Loading operator…</bp-loading>
  <bp-status code="404">Operator not found.</bp-status>
  <bp-status code="5xx">People service unavailable.</bp-status>
  <bp-nok>Operator unavailable.</bp-nok>
</BPElement>
```

## Loading, empty and error states

```tsx
<div class="placeholder-glow" aria-label="Loading"><span class="placeholder col-8"></span></div>
<div class="text-center text-body-secondary p-4">No incidents match these filters.</div>
<div class="alert alert-danger" role="alert">The request failed. Try again.</div>
```

## SSE fragment

```tsx
<div id="live-alert" hx-ext="sse" sse-connect={ctx.url.route("alerts.stream")} sse-swap="message"></div>
```

The corresponding SSE tick renderer returns either a Bootstrap alert or an empty `<div id="live-alert"></div>` to clear the strip.
