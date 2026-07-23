---
name: betterportal-embedded-ui
description: Build compact BetterPortal service UI for the Embedded theme.
---

# BetterPortal Embedded UI

1. Read `/llms-api.txt` and the Embedded UI guide.
2. Keep the view single-column and self-contained.
3. Use semantic HTML and server-rendered HTMX fragments.
4. Use `ctx.routeUrl()` for service calls and `ctx.uiRouteUrl()` only for GET navigation.
5. Include loading, empty, validation and failure states.
6. Verify keyboard use, labels, responsive wrapping and the published schemas.

Do not recreate Bootstrap components or a second app shell. Recommend Bootstrap1 when the requested interface genuinely needs those primitives.
