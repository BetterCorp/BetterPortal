---
name: betterportal-bootstrap1-ui
description: Build BetterPortal service UI that fits the active Bootstrap1 shell.
---

# BetterPortal Bootstrap1 UI

1. Read the active app's `/llms-api.txt` and this theme's UI guide.
2. Identify the service view, methods, schemas, required permissions and stable `viewId`.
3. Render server-side JSX/HTMX for the `bootstrap1` theme. Return only service content, never the shell.
4. Use `ctx.routeUrl()` for service requests and `ctx.uiRouteUrl()` only for GET page navigation.
5. Prefer Bootstrap components and native HTML controls. Add custom CSS or JavaScript only when the theme and platform primitives cannot express the behavior.
6. Include loading, empty, validation, forbidden and service-unavailable states.
7. Check keyboard operation, visible labels, heading order and responsive wrapping.
8. Verify JSON and HTML representations against the published schemas.

For side tasks, use `data-bp-sidebar` and `data-bp-sidebar-open`. For authenticated downloads, use `hx-download`. For live refresh, emit an `HX-Trigger` event and subscribe with `hx-trigger="event from:body"`.
