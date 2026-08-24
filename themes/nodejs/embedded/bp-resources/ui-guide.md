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
