# Bootstrap1 Asset Ownership

The browser-runtime migration is complete.

- `@betterportal/theme-runtime` owns HTMX, service URL rewriting, BP headers, preload, request lifecycle, route chrome state, history, SSE, downloads, auth failures, and background fragments.
- `Bootstrap1AdapterSource` is typed TSX produced by `js()` and contains presentation hooks only.
- Bootstrap1 owns Bootstrap assets, modal/offcanvas lifecycle, component initialization, error/loading presentation, and CSS for `data-bp-chrome-*`.
- Route chrome is generic presentation state. It never implies authentication.
- Theme adapters must not register duplicate HTMX lifecycle listeners.
