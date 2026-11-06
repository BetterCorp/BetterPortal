> Routing contract: prefer `BPRoute` for links, actions, forms and embedded components/fragments. Use `ctx.route()` only when a destination value is specifically required. Service-view defaults use `viewPath`; the theme owns UI mounting/history. See [the detailed BPRoute contract](https://github.com/BetterCorp/BetterPortal/blob/master/docs/building/bp-route.md).

---
name: betterportal-embedded-ui
description: Build compact BetterPortal service UI for the Embedded theme.
---

# BetterPortal Embedded UI

1. Read `/llms-api.txt`, `/llms-ui.txt` and the Embedded UI guide.
2. Keep the view single-column and self-contained.
3. Use semantic HTML and server-rendered HTMX fragments.
4. Use the same `ctx.route(input?)` in API handlers and renderers. Omit the target for self. Select `apiPath`/`absoluteApiPath` for API requests, `viewPath`/`absoluteViewPath` for HTML requests, and `uiPath` only for explicit shell navigation/history and `absoluteUiPath` for public links; never prefer UI fields in service-renderer controls. Pass a declared dependency alias in `serviceId`; renderers resolve links from domain data and cursors. API handlers must not add internal URL fields to their response for views. Resolve POST/PUT/DELETE destinations with the corresponding method in the renderer, and use `sse: true` with `absoluteViewPath` for HTML streams.
5. Include loading, empty, validation and failure states.
6. Verify keyboard use, labels, responsive wrapping and the published schemas.

Do not recreate Bootstrap components or a second app shell. Recommend Bootstrap1 when the requested interface genuinely needs those primitives.

Read the UI guide's colors/appearance section and linked BetterPortal documentation; use the active theme's semantic roles and installed API version. Before delivery, follow its view boundaries and defect-reporting rules. Keep domain work in handlers, never submit during initialization or draft restoration, and never register HTMX extensions from service markup. Preserve schema-backed HTML5 constraints: use native submission or `requestSubmit()`, gate custom triggers with `reportValidity()`, and never disable validation to post an invalid form. Use project reporting tools for reproducible theme/framework defects. Verify failed POST followed by navigation, preload, history and repeated swaps without mutation replay or duplicate listeners.

BPRoute specifics: outer `as` supplies a default; each state can override `as` and HTML/HTMX attributes. Use bp-ok/bp-loading/bp-noauth/bp-noperm/bp-error; failures replace the active root and do not inherit generated actions. Valueless hx-get/post/put/patch/delete selects the effective method and resolved service destination; explicit values override it. Component or fragment selects GET embedding, never a link; bp-ok attributes optionally wrap fetched HTML, its children/URL actions are ignored, and no authored template placeholder is needed. Use @betterportal/framework as jsxImportSource. See docs/building/bp-route.md and routing-lint.md for complete examples and invalid usages.
