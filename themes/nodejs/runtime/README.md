# @betterportal/theme-runtime

Shared backend and browser-shell runtime for BetterPortal Node shell packages.

The package assembles one JavaScript asset on the backend in this order:

1. HTMX core from the installed `htmx.org` package.
2. The shell's typed presentation adapter.
3. The BetterPortal `bp-shell` runtime.
4. The bundled HTMX SSE extension.

The browser never discovers or loads extensions dynamically. Required assets are resolved by the backend and missing assets fail bundle creation.

Shell adapters are authored as TSX with `jsx-htmx`'s `js()` helper:

```tsx
/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import {
  buildBetterPortalShellRuntimeAsset,
  type BetterPortalShellAdapter
} from "@betterportal/theme-runtime";

const adapterSource = js(() => {
  window.BetterPortalShellAdapter = {
    setLoading(loading, outlet) {
      outlet?.toggleAttribute("data-bp-loading", loading);
    }
  } satisfies BetterPortalShellAdapter;
});

const asset = await buildBetterPortalShellRuntimeAsset({
  adapterSource
});
```

`js()` returns safe `RawText`. Pass it directly to the runtime builder or place it directly inside a `<script>` element. Do not call `.toString()` and do not wrap it with `raw()`.

The shared runtime owns service/app URL rewriting, managed BP headers, header-aware preload, HTMX lifecycle handling, downloads, history, authentication failures, SSE, `bp-element` states, and route chrome state. It never discovers service schemas in the browser.

For initial shell rendering, spread `betterPortalChromeAttributes(route.chrome)` onto the element marked `data-bp-shell-root`. After route responses, the runtime parses every `bp-chrome-*` content-type parameter, updates the corresponding `data-bp-chrome-*` attributes, removes stale attributes, and calls the optional typed `applyChrome(chrome, previousChrome, root)` adapter hook. Themes should normally use CSS against the data attributes and reserve `applyChrome` for presentation that cannot be expressed in CSS. Themes must not register duplicate HTMX chrome listeners or infer authentication state from chrome values.

Shell adapters are presentation-only. They may implement loading/error UI, component initialization and disposal, overlay cleanup, scrolling, and optional chrome presentation. A shell package does not add `htmx.org`; this runtime owns and bundles it. This runtime also imports `jsx-htmx`, but a shell that imports `jsx-htmx` directly for TSX must declare it as its own dependency. Do not bundle the stock preload extension: BetterPortal's preload implementation is part of `bp-shell` so it can attach scoped BP headers and reuse the prefetched response. The fixed HTMX extension allowlist is `bp-shell, sse`.
