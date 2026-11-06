> Routing contract: prefer `BPRoute` for links, actions, forms and embedded components/fragments. Use `ctx.route()` only when a destination value is specifically required. Service-view defaults use `viewPath`; the theme owns UI mounting/history. See [the detailed BPRoute contract](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/bp-route.md).

---
name: betterportal-bootstrap2-ui
description: Build dense Bootstrap 5 service UI for the active Bootstrap2 shell.
---

# BetterPortal Bootstrap2 UI

1. Read the active app's `/llms-api.txt`, `/llms-ui.txt`, and Bootstrap2 resources.
2. Identify the view, methods, schemas, permissions, stable `viewId`, and empty/error states.
3. Return server-rendered JSX/HTMX service content only. Never emit the shell, sidebar, top bar, global assets, service worker, or browser cache code. Check the active layout and omit page titles and Back/Up buttons or links supplied by the theme; keep meaningful section headings and task-specific actions.
4. Use the same `ctx.route(input?)` in API handlers and renderers. Omit the target for self. Select `apiPath`/`absoluteApiPath` for API requests, `viewPath`/`absoluteViewPath` for HTML requests, and `uiPath` only for explicit shell navigation/history and `absoluteUiPath` for public links; never prefer UI fields in service-renderer controls. Pass a declared dependency alias in `serviceId`; renderers resolve links from domain data and cursors. API handlers must not add internal URL fields to their response for views. Resolve POST/PUT/DELETE destinations with the corresponding method in the renderer, and use `sse: true` with `absoluteViewPath` for HTML streams.
5. Use `BPRoute` with declared dependency aliases for cross-service fragments; use `service="shell"` only for singular shell fragments.
6. Prefer Bootstrap 5 and native HTML. Use the documented split-pane classes for queue/detail workflows.
7. Include loading, empty, validation, forbidden, unavailable and offline-safe failure states.
8. Keep status labels textual, controls keyboard-operable, headings ordered, and tables responsive.
9. For queue/detail pages, use named components, stable split-pane/row/focus keys, and a local `data-bp-mutation-error` outlet. Return the active component from mutations; reserve `HX-Trigger` for passive regions.
10. Load a normal GET snapshot before SSE. Emit validated row/component deltas and coalesce by record id; never replace the complete queue for one changed record.

For the global alert bar, publish a service fragment such as `critical-alerts.active` and assign it to the shell's `critical-alerts` block. The fragment may return an empty `<div>` and populate itself through SSE. Emit `HX-Trigger: bp:fragment:critical-alerts.active` when a normal reload is sufficient.

The theme cache never stores service responses. Do not register another service worker from a service renderer.

Read the UI guide's colors/appearance section and linked BetterPortal documentation; use the active theme's semantic roles and installed API version. Before delivery, follow its view boundaries and defect-reporting rules. Keep domain work in handlers, never submit during initialization or draft restoration, and never register HTMX extensions from service markup. Preserve schema-backed HTML5 constraints: use native submission or `requestSubmit()`, gate custom triggers with `reportValidity()`, and never disable validation to post an invalid form. Use project reporting tools for reproducible theme/framework defects. Verify failed POST followed by navigation, preload, history and repeated swaps without mutation replay or duplicate listeners.

BPRoute specifics: outer `as` supplies a default; each state can override `as` and HTML/HTMX attributes. Use bp-ok/bp-loading/bp-noauth/bp-noperm/bp-error; failures replace the active root and do not inherit generated actions. Valueless hx-get/post/put/patch/delete selects the effective method and resolved service destination; explicit values override it. Component or fragment selects GET embedding, never a link; bp-ok attributes optionally wrap fetched HTML, its children/URL actions are ignored, and no authored template placeholder is needed. Use @betterportal/framework as jsxImportSource. See docs/building/bp-route.md and routing-lint.md for complete examples and invalid usages.
