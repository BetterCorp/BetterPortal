> Routing contract: prefer `BPRoute` for links, actions, forms and embedded components/fragments. Use `ctx.route()` only when a destination value is specifically required. Service-view defaults use `viewPath`; the theme owns UI mounting/history. See [the detailed BPRoute contract](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/bp-route.md).

---
name: betterportal-bootstrap1-ui
description: Build BetterPortal service UI that fits the active Bootstrap1 shell.
---

# BetterPortal Bootstrap1 UI

1. Read the active app's `/llms-api.txt`, `/llms-ui.txt` and this theme's UI guide.
2. Identify the service view, methods, schemas, required permissions and stable `viewId`.
3. Render server-side JSX/HTMX for the `bootstrap1` theme. Return only service content, never the shell.
4. Use the same `ctx.route(input?)` in API handlers and renderers. Omit the target for self. Select `apiPath`/`absoluteApiPath` for API requests, `viewPath`/`absoluteViewPath` for HTML requests, and `uiPath` only for explicit shell navigation/history and `absoluteUiPath` for public links; never prefer UI fields in service-renderer controls. Pass a declared dependency alias in `serviceId`; renderers resolve links from domain data and cursors. API handlers must not add internal URL fields to their response for views. Resolve POST/PUT/DELETE destinations with the corresponding method in the renderer, and use `sse: true` with `absoluteViewPath` for HTML streams.
5. Use the framework `BPRoute` JSX helper with `ctx` for cross-service or active-shell fragments. Reference the dependency alias/key declared in `betterportal.json`, never a title, service UUID, hostname, or absolute URL. Omit `bp-ok` for direct success insertion; an explicit wrapping `bp-ok` uses its attributes as a wrapper and ignores authored children.
6. Prefer Bootstrap components and native HTML controls. Use scoped CSS or typed local JavaScript for service-specific presentation; report broken or missing platform behavior through project issue/reporting tools instead of patching it in the view.
7. Include loading, empty, validation, forbidden and service-unavailable states.
8. Check keyboard operation, visible labels, heading order and responsive wrapping.
9. Verify JSON and HTML representations against the published schemas.

For side tasks, use `data-bp-sidebar` and `data-bp-sidebar-open`. For authenticated downloads, use `hx-download`. For live refresh, emit an `HX-Trigger` event and subscribe with `hx-trigger="event from:body"`.

Read the UI guide's colors/appearance section and linked BetterPortal documentation; use the active theme's semantic roles and installed API version. Before delivery, follow its view boundaries and defect-reporting rules. Keep domain work in handlers, never submit during initialization or draft restoration, and never register HTMX extensions from service markup. Preserve schema-backed HTML5 constraints: use native submission or `requestSubmit()`, gate custom triggers with `reportValidity()`, and never disable validation to post an invalid form. Use project reporting tools for reproducible theme/framework defects. Verify failed POST followed by navigation, preload, history and repeated swaps without mutation replay or duplicate listeners.

BPRoute specifics: outer `as` supplies a default; each state can override `as` and HTML/HTMX attributes. Use bp-ok/bp-loading/bp-noauth/bp-noperm/bp-error; failures replace the active root and do not inherit generated actions. Valueless hx-get/post/put/patch/delete selects the effective method and resolved service destination; explicit values override it. Component or fragment selects GET embedding, never a link; bp-ok attributes optionally wrap fetched HTML, its children/URL actions are ignored, and no authored template placeholder is needed. Use @betterportal/framework as jsxImportSource. See docs/building/bp-route.md and routing-lint.md for complete examples and invalid usages.
