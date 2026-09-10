# Embedded theme UI guide

The Embedded theme renders BetterPortal service content inside a lightweight host without an iframe. Keep UI narrow, self-contained and dependent only on native HTML, HTMX and the theme's existing variables.

## Rules

- Return service content only; the theme owns the host document and main outlet.
- Use semantic HTML, visible labels, keyboard-operable controls and responsive wrapping.
- Prefer one column. Avoid persistent navigation, wide tables, fixed positioning and viewport-sized panels.
- In renderers, use `ctx.url.route()` for service requests. Use `ctx.url.uiRoute()` only for GET page navigation. Pass a declared dependency alias as `serviceId` when resolving another app-mounted service. Handler equivalents are `ctx.routeUrl()` and `ctx.uiRouteUrl()`.
- Plain internal `<a href="/route">` links and GET/POST forms are automatically upgraded to HTMX and routed through the owning service. A bare `<form>` posts to the current service view. Use `bp-no-override` or `data-bp-no-override` on an element or ancestor only when native browser behavior is intentional.
- Use normal forms and HTMX swaps. Provide loading, empty, validation and error states.
- Use `hx-download` for authenticated files and `HX-Trigger` events for passive refresh.
- Do not add a SPA framework, iframe, client router, state library or hardcoded service URL.

The Embedded theme deliberately offers fewer visual primitives than Bootstrap1. If a workflow needs a complex application shell, use Bootstrap1 instead of recreating a shell inside service content.

## Colors and appearance

Embedded is a minimal host with a transparent document background. It does not declare the Bootstrap1/2 palette configuration or their `--bp-*` token contract. A `bootstrap5` component example or a brand hex value from another theme is not a portable Embedded styling API.

Use native controls and inherit available host typography/colors; keep necessary service-specific CSS local to the component. Do not load Bootstrap, add global branding, redefine document colors or install a separate appearance controller. If a richer palette/component contract is required, implement it in the owning theme or select a suitable theme, rather than reproducing its shell in a view.

Read the [BetterPortal theme contract](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/themes.md), [routes/views](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/routes-and-views.md) and active `/llms-ui.txt`. Match documentation examples to installed package versions; master may describe newer APIs.

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
