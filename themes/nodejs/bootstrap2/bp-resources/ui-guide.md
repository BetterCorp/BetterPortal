# Bootstrap2 UI guide

Bootstrap2 uses Bootstrap 5 classes and server-rendered JSX/HTMX. Services own page content and data; the theme owns navigation, top bar, alert outlet, visible URL, global assets, component lifecycle, and offline framework cache.

## Structure

- Return a fragment for `#bp-main`; never emit `<html>`, `<head>`, persistent navigation, global scripts, or another shell.
- Bootstrap2 supplies a forced 1rem inset around `#bp-main`, including below the critical-alert outlet. Start pages with `.container-fluid px-0`; do not duplicate the shell padding.
- The configured app route title owns the shell top bar and browser-title prefix. Use normal heading order inside service content; the theme does not scrape or hide service headings.
- Use 4px/8px spacing, compact controls, borders, and Bootstrap semantic colors. Avoid gradients, glass, large shadows, oversized headings, floating cards, and icon-only status.
- Use `.bp-split-pane`, `.bp-split-pane__content`, and `.bp-split-pane__detail` for queue/detail workflows. Give the pane `data-bp-split-pane-key`, rows `data-bp-row-key`, and focusable controls `data-bp-focus-key`. `data-bp-detail-toggle` and `data-bp-detail-close` use the shared runtime. Component swaps preserve queue scroll, the selected row, detail-open state, and focus by those stable keys.
- Use responsive table wrappers; do not shrink record text to fit.

## HTMX and routes

- Plain internal `<a href="/route">` links and GET/POST forms are automatically upgraded to HTMX and routed through the owning service. A bare `<form>` posts to the current service view. Use `bp-no-override` or `data-bp-no-override` on an element or ancestor only when native browser behavior is intentional.
- Renderer functions receive `ViewRenderContext` as their second argument. Type it directly; the framework populates it server-side, so presentation URLs and app/tenant labels do not belong in response schemas.
- `ctx.url.route(viewId, { component: "active" })` is for service requests: named components, `hx-get`, `hx-post`, forms, and downloads. Use `{ sse: true, fragment: "body.live" }` for SSE. `ctx.url.current({ component: "active" })` selects a component on the current route.
- `ctx.url.uiRoute(viewId)` is only for mounted GET browser navigation.
- Mutations return the updated active component directly. Use `HX-Trigger` only for passive regions such as totals or a queue the user is not actively editing.
- Wrap mutation UI in `data-bp-mutation-scope` and include one `[data-bp-mutation-error]` outlet. Non-success HTML is rendered there and focused; it never replaces the active component or opens a global overlay.
- A fragment may target only itself or descendants inside its `data-bp-fragment` container.
- Use `BPElement` for declared cross-service dependencies. Never hardcode service UUIDs, titles, hostnames, or internal paths.

## Critical alerts

The shell declares an ordered `critical-alerts` block immediately below the top bar. It has no default items and no built-in data source. Configure one or more service fragments in Config Manager.

A service renderer may return an empty element. SSE can later swap alert markup into that element and clear it by sending an empty element again. Normal refresh uses:

```http
HX-Trigger: bp:fragment:critical-alerts.active
```

Alert content should use `.alert`, include readable severity text, and avoid forcing a fixed height.

## Components

- One obvious `.btn-primary` action per action group; destructive actions use `.btn-danger` or `.btn-outline-danger`.
- Forms use real `<form>`, visible `<label>`, `.form-control`, `.form-select`, `.invalid-feedback`, and `.form-text`.
- Comparable records use `.table`; short status collections use `.list-group`.
- Status uses Bootstrap badges plus text; color is never the only signal.
- Use `data-bp-sidebar` / `data-bp-sidebar-open` for task panels. The theme converts them to Bootstrap offcanvas.
- Bootstrap modals and offcanvas elements may be teleported; do not rely on their original DOM parent.

## Required states

Every data view covers loading, empty, forbidden, validation, service-unavailable and mutation-failure states. Disable only the control issuing a request. Keep errors visible and dismissible.

## Live queue updates

Load the initial queue through the normal GET operation, then use SSE only for deltas. Upsert one stable row/component at a time with HTMX out-of-band markup; never resend the whole queue. Coalesce bursts by record id in the producer so only the newest pending state is emitted. SSE is not durable: after reconnect, refresh the normal GET snapshot before applying new deltas.

## Accessibility

Preserve heading order, native controls, visible focus, table headers, labels, keyboard operation, and focus return for overlays. Every icon-only action requires an accessible name.

## Offline contract

Bootstrap2 caches only versioned theme assets and a generic offline shell. Service HTML, JSON, SSE, WebSocket messages, authentication and tenant/user host HTML remain network-owned. A service must define its own explicit cache contract if its business data is safe and useful offline.
