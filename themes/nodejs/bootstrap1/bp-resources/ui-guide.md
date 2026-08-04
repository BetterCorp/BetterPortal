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
