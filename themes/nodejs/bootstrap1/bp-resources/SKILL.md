---
name: betterportal-bootstrap1-ui
description: Build BetterPortal service UI that fits the active Bootstrap1 shell.
---

# BetterPortal Bootstrap1 UI

1. Read the active app's `/llms-api.txt`, `/llms-ui.txt` and this theme's UI guide.
2. Identify the service view, methods, schemas, required permissions and stable `viewId`.
3. Render server-side JSX/HTMX for the `bootstrap1` theme. Return only service content, never the shell.
4. In renderers, use `ctx.url.route()` for service requests and `ctx.url.uiRoute()` only for GET page navigation. Pass a declared dependency alias as `serviceId` for another service.
5. Use the framework `BPElement` JSX helper with `ctx` for cross-service or active-shell fragments. Reference the dependency alias/key declared in `betterportal.json`, never a title, service UUID, hostname, or absolute URL. Omit `bp-ok` for direct success insertion; an explicit wrapping `bp-ok` must have exactly one `<template />`.
6. Prefer Bootstrap components and native HTML controls. Use scoped CSS or typed local JavaScript for service-specific presentation; report broken or missing platform behavior through project issue/reporting tools instead of patching it in the view.
7. Include loading, empty, validation, forbidden and service-unavailable states.
8. Check keyboard operation, visible labels, heading order and responsive wrapping.
9. Verify JSON and HTML representations against the published schemas.

For side tasks, use `data-bp-sidebar` and `data-bp-sidebar-open`. For authenticated downloads, use `hx-download`. For live refresh, emit an `HX-Trigger` event and subscribe with `hx-trigger="event from:body"`.

Read the UI guide's colors/appearance section and linked BetterPortal documentation; use the active theme's semantic roles and installed API version. Before delivery, follow its view boundaries and defect-reporting rules. Keep domain work in handlers, never submit during initialization or draft restoration, and never register HTMX extensions from service markup. Preserve schema-backed HTML5 constraints: use native submission or `requestSubmit()`, gate custom triggers with `reportValidity()`, and never disable validation to post an invalid form. Use project reporting tools for reproducible theme/framework defects. Verify failed POST followed by navigation, preload, history and repeated swaps without mutation replay or duplicate listeners.
