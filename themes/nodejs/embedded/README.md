# BetterPortal Embedded Theme for Node.js

Minimal BetterPortal v10 embed theme.

This package renders a thin wrapper for embedded use cases. It uses the backend-assembled `@betterportal/theme-runtime` shell and supplies only Embedded-specific loading and error presentation.

Its adapter is type-checked TSX built with `jsx-htmx` `js()` and passed directly to the runtime builder as safe `RawText`. Initial and swapped route chrome are managed by the shared runtime; Embedded does not duplicate chrome or HTMX lifecycle handlers.
