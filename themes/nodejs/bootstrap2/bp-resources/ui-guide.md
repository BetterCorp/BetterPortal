# Bootstrap2 UI guide

Bootstrap2 uses Bootstrap 5 classes and server-rendered JSX/HTMX. Services own page content and data; the theme owns navigation, top bar, alert outlet, visible URL, global assets, component lifecycle, and offline framework cache.

## Structure

- Return a fragment for `#bp-main`; never emit `<html>`, `<head>`, persistent navigation, global scripts, or another shell.
- Bootstrap2 supplies a forced 1rem inset around `#bp-main`, including below the critical-alert outlet. Start pages with `.container-fluid px-0`; do not duplicate the shell padding.
- The configured app route title owns the shell top bar and browser-title prefix. Do not repeat that title as another page header or heading banner. Start with content/actions and use accessible headings for distinct sections; the theme does not scrape or hide duplicate service headings.
- The theme supplies app navigation. Do not duplicate it with navigation cards, link grids or another menu inside service content; local workflow navigation must serve a distinct need.
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

## Colors and appearance

The theme owns typography, palette and light/dark/system preference. Its declared defaults are overridden by tenant values and then app values through BetterPortal service configuration in Config Manager. The shell maps the effective configuration and mode into CSS variables and component styles; service views inherit them. Do not copy configuration colors into view data or load another Bootstrap/font asset.

Use semantic roles: `.btn-primary` for the main action, `.alert-warning` for a warning, `.btn-danger` for a destructive action and `.text-body-secondary` / `.form-text` for supporting text. Primary is not a fixed hue; the secondary brand color is not the muted-text role. Keep a textual status label.

Prefer complete components such as `.form-control`, `.form-select` and `.card` so their foreground, surface, border, hover, focus and disabled states stay coordinated. Custom component-scoped CSS may consume these theme tokens:

| Role | Token |
| --- | --- |
| Page / primary / alternate surface | `--bp-bg` / `--bp-surface` / `--bp-surface-alt` |
| Main / supporting text | `--bp-text` / `--bp-text-soft` |
| Border | `--bp-border` |
| Primary / secondary accent | `--bp-accent` / `--bp-accent-secondary` |
| Status accents | `--bp-accent-success`, `--bp-accent-info`, `--bp-accent-warning`, `--bp-accent-danger` |

These variables describe this theme; do not assume every `bootstrap5` renderer or Embedded exports the same contract. Bootstrap semantic variables and shell component rules both affect the final style. Do not redefine root tokens or assume white text is readable on every configured brand color.

The shell sets `data-bs-theme` and owns appearance preference. Reuse its declared `theme-selector` fragment; do not add a service theme switch, storage key or media-query controller. Verify light/dark modes, options, placeholders, disabled/read-only fields and keyboard focus. Report unreadable defaults with effective configuration and computed styles instead of hardcoded palettes or `!important` fixes.

Research the [BetterPortal theme contract](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/themes.md) and [routes/views](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/routes-and-views.md) alongside the active `/llms-ui.txt`. Master docs may be newer than installed packages; match the deployed version before using an API.

## Form validation before requests

The backend input schema is the source of truth. Render its applicable HTML5 constraints (`type`, `required`, `min`, `max`, `step`, `minlength`, `maxlength`, `pattern`) and preserve them after swaps. The browser validates the returned HTML controls; it does not execute AnyVali/JSON schema automatically. Numeric inputs use range/step constraints, not `pattern`. Hidden inputs and controls barred from constraint validation are not checked by these APIs; validate computed payloads against the published input contract and always on the server.

Prefer native submit buttons or `form.requestSubmit(submitter)`. For a necessary custom trigger, stop if `form.reportValidity()` is false; `form.checkValidity()` checks without showing validation messages. Never bypass invalid controls with `form.submit()`, synthetic submit events, custom fetch/HTMX posts, `noValidate`/`formNoValidate`, `novalidate`/`formnovalidate` or disabled HTMX validation. Recalculation that accepts fewer fields needs a separate non-nested form/component with its own constraints, not a bypass on the full form. The backend validates every submission, including rules HTML cannot express.

Check invalid submissions by button, Enter and custom triggers: no POST is sent; a valid form submits once. See [HTML form validation and view guidance](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/themes.md#preserve-html5-form-validation).

## View boundaries and defect reporting

Read the shared `/llms-ui.txt` rules before implementing a view.

- Render typed handler data. Keep business defaults, validation, calculations, persistence and report generation in handlers/domain helpers; HTML constraints are presentation hints.
- Initialization, history navigation, prefetched insertion and draft restoration must not submit forms or replay mutations. Keep recalculation and final submission explicit; do not retain one-shot action flags after failure or cancellation.
- The shell owns HTMX 4 and its bundled `bp-shell, sse` extensions. Do not inject extension assets, register extensions or add unsupported `hx-ext` values. Use supported form encoding and report schema/serialization gaps upstream.
- Prefer native controls, HTMX triggers, `hx-indicator` and HTMX 4 `hx-disable`. Necessary local scripts use typed `js(() => ...)`, component-scoped selectors, idempotent binding and cleanup on removal. Do not add global submit functions or repeated document-wide listeners. HTMX 2 camelCase lifecycle events are incompatible with the installed HTMX 4 runtime.
- Browser drafts require an explicit schema, allowed fields, tenant/app/service/user scope, version, expiry and clearing rules. Validate restoration, exclude action/auth fields, and never generate hidden inputs from arbitrary stored keys. Restore without submitting; browser owner metadata is not authorization.
- Use project issue/reporting tools for reproducible theme/framework defects. Include versions, minimal reproduction, expected/actual behavior and relevant request initiators or computed styles without credentials or customer data. Check existing reports; if access is unavailable, provide a ready-to-file report. Do not replace theme defaults with hardcoded palettes, `!important` patches, duplicate navigation or runtime workarounds.
- Service errors use handler-side `ctx.diagnostic({ code, reason, attributes? })` before responses outside HTTP 200-399; the view displays a safe error state. Diagnostics do not replace upstream defect reports.
- Verify failed POST then navigation, Back/Forward, preload, repeated swaps and stale drafts. Inspect request initiators and confirm navigation/restoration never mutates or leaves controls disabled.
