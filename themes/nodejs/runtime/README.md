# @betterportal/theme-runtime

Shared browser-shell runtime for BetterPortal Node theme packages.

The package assembles one JavaScript asset on the backend in this order:

1. HTMX core from the installed `htmx.org` package.
2. The theme's presentation adapter.
3. The BetterPortal `bp-shell` runtime.
4. The bundled HTMX SSE extension.

The browser never discovers or loads extensions dynamically. Required assets are resolved by the backend and missing assets fail bundle creation.

```ts
import { buildBetterPortalThemeRuntimeAsset } from "@betterportal/theme-runtime";

const asset = await buildBetterPortalThemeRuntimeAsset({
  themeId: "my-theme",
  adapterSource
});
```

The shared shell owns service/app URL rewriting, native API allowlist links, managed BP headers, header-aware preload, HTMX lifecycle handling, downloads, history, authentication failures, SSE, and background fragments. The fixed HTMX extension allowlist is `bp-shell, sse`.

Theme adapters are presentation-only. They may implement loading/error UI, component initialization and disposal, overlay cleanup, and scrolling. Do not bundle the stock preload extension: BetterPortal's preload implementation is part of `bp-shell` so it can attach scoped BP headers and reuse the prefetched response.
