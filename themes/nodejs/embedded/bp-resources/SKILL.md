---
name: betterportal-embedded-ui
description: Build compact BetterPortal service UI for the Embedded theme.
---

# BetterPortal Embedded UI

1. Read `/llms-api.txt`, `/llms-ui.txt` and the Embedded UI guide.
2. Keep the view single-column and self-contained.
3. Use semantic HTML and server-rendered HTMX fragments.
4. In renderers, use `ctx.url.route()` for service calls and `ctx.url.uiRoute()` only for GET navigation. Pass a declared dependency alias as `serviceId` for another service.
5. Include loading, empty, validation and failure states.
6. Verify keyboard use, labels, responsive wrapping and the published schemas.

Do not recreate Bootstrap components or a second app shell. Recommend Bootstrap1 when the requested interface genuinely needs those primitives.

Read the UI guide's colors/appearance section and linked BetterPortal documentation; use the active theme's semantic roles and installed API version. Before delivery, follow its view boundaries and defect-reporting rules. Keep domain work in handlers, never submit during initialization or draft restoration, and never register HTMX extensions from service markup. Preserve schema-backed HTML5 constraints: use native submission or `requestSubmit()`, gate custom triggers with `reportValidity()`, and never disable validation to post an invalid form. Use project reporting tools for reproducible theme/framework defects. Verify failed POST followed by navigation, preload, history and repeated swaps without mutation replay or duplicate listeners.
