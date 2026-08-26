---
name: betterportal-bootstrap2-ui
description: Build dense Bootstrap 5 service UI for the active Bootstrap2 shell.
---

# BetterPortal Bootstrap2 UI

1. Read the active app's `/llms-api.txt`, `/llms-ui.txt`, and Bootstrap2 resources.
2. Identify the view, methods, schemas, permissions, stable `viewId`, and empty/error states.
3. Return server-rendered JSX/HTMX service content only. Never emit the shell, sidebar, top bar, global assets, service worker, or browser cache code.
4. Use `ctx.url.route()` for HTMX, forms, downloads and SSE. Use `ctx.url.uiRoute()` only for mounted GET navigation.
5. Use `BPElement` with declared dependency aliases for cross-service fragments; use `service="shell"` only for singular shell fragments.
6. Prefer Bootstrap 5 and native HTML. Use the documented split-pane classes for queue/detail workflows.
7. Include loading, empty, validation, forbidden, unavailable and offline-safe failure states.
8. Keep status labels textual, controls keyboard-operable, headings ordered, and tables responsive.
9. For queue/detail pages, use named components, stable split-pane/row/focus keys, and a local `data-bp-mutation-error` outlet. Return the active component from mutations; reserve `HX-Trigger` for passive regions.
10. Load a normal GET snapshot before SSE. Emit validated row/component deltas and coalesce by record id; never replace the complete queue for one changed record.

For the global alert bar, publish a service fragment such as `critical-alerts.active` and assign it to the shell's `critical-alerts` block. The fragment may return an empty `<div>` and populate itself through SSE. Emit `HX-Trigger: bp:fragment:critical-alerts.active` when a normal reload is sufficient.

The theme cache never stores service responses. Do not register another service worker from a service renderer.
