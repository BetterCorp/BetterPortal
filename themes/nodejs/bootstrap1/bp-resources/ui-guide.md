# Bootstrap1 UI guide

Use Bootstrap 5 classes and server-rendered JSX/HTMX. BetterPortal service renderers return fragments; the theme owns the shell, navigation, visible URL and global assets.

## Layout

- Render primary content for the `main` slot. Never emit another page shell, `<html>`, `<head>`, sidebar navigation or top bar.
- Start pages with a semantic heading and a short action row when actions exist.
- Use `.container-fluid`, Bootstrap grid classes and responsive gaps. Avoid fixed widths except a declared `data-bp-sidebar-width`.
- Use cards for grouped settings, tables for comparable records and list groups for short navigation or status collections.
- Keep primary actions on the right of desktop action rows and allow them to wrap on small screens.

## Forms and mutations

- Use real `<form>` elements and labelled controls. Validation text uses `.invalid-feedback` or `.form-text`.
- Plain internal `<a href="/route">` links and GET/POST forms are automatically upgraded to HTMX and routed through the owning service. A bare `<form>` posts to the current service view. Use `bp-no-override` or `data-bp-no-override` on an element or ancestor only when native browser behavior is intentional.
- In renderers, use `ctx.url.route()` for form actions, HTMX calls, downloads and SSE. `ctx.url.uiRoute()` is only for GET navigation through a mounted page route. For another service, pass its declared dependency alias as `serviceId`; both helpers resolve the active app-mounted provider. Handler equivalents are `ctx.routeUrl()` and `ctx.uiRouteUrl()`.
- Use `<BPElement ctx={ctx} service="dependency-alias" path="/contract/path" fragment="location.id">` for cross-service UI fragments. `service` is the dependency alias/key declared in `betterportal.json`; never put service titles, UUIDs, hostnames, or absolute URLs in renderer code. The server consumes `ctx` and resolves the active app-mounted provider.
- Use `service="shell"` and a singular shell fragment id to reuse active-shell UI such as `theme-selector`. Add `bp-loading`, status-specific `bp-status`, and `bp-nok` states as needed. Omit `bp-ok` to insert successful content directly; add it only to wrap success content, with exactly one `<template />`.
- The renderer's second argument is `ViewRenderContext`. Use its limited `tenant`/`app` presentation projections and `ctx.url` helpers; keep authorization and business data in the handler. Auth navigation fields are view IDs and must be resolved with `ctx.url.uiRoute()`.
- Mutations should return a useful fragment and emit an `HX-Trigger` event for passive regions that need to reload.
- Disable buttons only while their own request is active. Keep a visible loading indicator and an error fragment.

## Components

- Buttons: `.btn`, with one obvious `.btn-primary` action per group.
- Status: Bootstrap badges with text; never communicate state by colour alone.
- Destructive actions: `.btn-outline-danger` or `.btn-danger`, with confirmation proportional to impact.
- Side panels: wrap content in `data-bp-sidebar`, add `data-bp-sidebar-title`, and open it with `data-bp-sidebar-open`. The theme converts it to an offcanvas.
- Modals and offcanvas content may be teleported by the shell. Do not depend on a specific DOM parent after activation.

## Accessibility

- Preserve heading order, visible labels, keyboard focus and native controls.
- Every icon-only action needs an accessible name.
- Tables need headers; use a responsive wrapper instead of shrinking text.
- Focus the first meaningful control when opening a task panel and return focus to its trigger when it closes.

## Avoid

- No SPA framework, client router, iframe, client state store or hardcoded service hostname.
- No inline copy of Bootstrap or shell JavaScript.
- No theme-origin mutation URL. Service requests go to service URLs.
- No custom colour that bypasses the app palette when a Bootstrap semantic token exists.

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

The backend input schema is the source of truth. Render its applicable HTML5 constraints (`type`, `required`, `min`, `max`, `step`, `minlength`, `maxlength`, `pattern`) and preserve them after swaps. The browser validates the returned HTML controls; it does not execute AnyVali/JSON schema automatically. Numeric inputs use range/step constraints, not `pattern`.

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
