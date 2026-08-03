# Themes

Themes render the BetterPortal shell and provide the visual system for service views.

The default theme is `bootstrap1`.

## Theme responsibilities

A theme owns:

- shell layout
- navigation
- brand display
- theme assets
- theme configuration UI
- theme fragments and fragment blocks
- presentation hooks for loading, errors, swaps, and component lifecycle

It does not own service page content.

## Theme configuration ownership

Each theme owns its configuration schema and defaults. `apps[].themeConfig.bootstrap` is a Bootstrap1 compatibility palette whose meanings and fallback values are hardcoded by Bootstrap1; it is not a portable theme contract. A new theme must not copy those values as its defaults or require that palette. Define theme-specific fields and defaults in the new theme's service configuration schema, and map Bootstrap palette values only when deliberate compatibility is desired.

## Shared Node theme runtime

Node themes use `@betterportal/theme-runtime` for shell behavior. The package owns service and tenant URL rewriting, managed BP headers, header-aware preload, HTMX request/response handling, generic route chrome state, SSE, history, auth failures, downloads, and `bp-element` lifecycle states.

The runtime is assembled on the backend in deterministic order: HTMX core, the theme adapter, the BetterPortal shell, and the bundled SSE extension. Browsers never discover or dynamically load HTMX extensions. A missing required asset fails during backend bundle creation.

Write adapters as TSX and use `jsx-htmx`'s typed `js()` helper:

```tsx
import { js } from "jsx-htmx";
import type { BetterPortalThemeAdapter } from "@betterportal/theme-runtime";

export const MyThemeAdapterSource = js(() => {
  window.BetterPortalThemeAdapter = {
    setLoading(loading, outlet) {
      outlet?.classList.toggle("is-loading", loading);
    }
  } satisfies BetterPortalThemeAdapter;
});
```

`js()` returns safe `RawText`. Pass it directly as `adapterSource` or place it directly in a `<script>` element; do not call `.toString()` or wrap it with `raw()`.

The server emits initial chrome with `betterPortalChromeAttributes(currentRoute?.chrome)`. The browser runtime applies response `bp-chrome-*` values as `data-bp-chrome-*`, removes stale values, and calls the optional typed `applyChrome` hook. Prefer theme CSS for chrome presentation; use the hook only when the theme needs imperative behavior. Chrome is presentation state and never implies authentication.

Theme packages keep their public asset URLs and provide only presentation hooks. Bootstrap1 owns Bootstrap modal/offcanvas and component lifecycle behavior; Embedded owns its loading and error presentation. The required HTMX extension allowlist is `bp-shell, sse`. BetterPortal's header-aware preload is part of `bp-shell`; do not also load the stock preload extension.

In a theme's `package.json`, declare `@betterportal/theme-runtime` but not `htmx.org`; the runtime owns and bundles the browser HTMX package. The runtime imports `jsx-htmx`, but a theme that directly imports `jsx-htmx` for TSX must declare it directly rather than relying on a transitive dependency.

## Theme fragments

Declare the theme directory in `package.json`:

```json
{ "betterportal": { "themes": ["src/plugins/my-theme/theme"] } }
```

Codegen recognizes only these top-level forms:

```text
theme/
  _theme-selector.tsx  # singular, independently addressable fragment
  _nav/
    index.tsx          # ordered fragment block
```

A singular file exports `title`, `description`, and `render(ctx)`. A block also exports `defaultItems`, and its `render(ctx)` places `ctx.items`. Missing app configuration uses the theme default; `mode: "none"` is an explicit empty value; singular overrides and block items may reference service fragments. Settings are stored under the active theme service-instance UUID, so changing themes changes the available definitions without destroying the previous theme's dormant settings. An app with no active shell theme has no theme fragments.

```tsx
import type { HtmlRenderable, ThemeFragmentRenderContext } from "@betterportal/framework";

export const title = "Topbar fragments";
export const description = "Ordered content shown in the topbar.";
export const defaultItems = ["theme-selector"];

export function render(ctx: ThemeFragmentRenderContext): HtmlRenderable {
  return ctx.items.map(String).join("");
}
```

`ThemeFragmentRenderContext` supplies the tenant, app, theme service configuration, request URL, fragment id, and server-resolved block items. Cross-service URLs are not constructed by theme code. Service views reuse a singular active-theme fragment with `<BPElement ctx={ctx} service="theme" fragment="theme-selector">`; see [Routes and views](./routes-and-views.md).

There is no reserved `background` location and no browser-side fragment discovery. A theme that needs a background block declares `_background/index.tsx` explicitly.

## Service renderers

Each service view chooses which themes it supports by adding renderer folders:

```text
_theme.bootstrap1/
  GET.tsx
  POST.tsx
  POST.422.tsx
```

Renderers are method/status-specific. If a view does not provide a matching renderer for the active app theme and request method/status, the service returns JSON/API output or a JSON error.

For Bootstrap1, the shell already provides the route header context. Service renderers should not add duplicate top-level page headings such as `<h1 class="h4 mb-3">Templates</h1>` unless that heading is part of the service content itself.

## Navigation belongs to the app

Service pages should not create their own persistent side navigation when the BP shell already provides navigation.

Use the app menu in `bp-config.yaml` for product-level navigation, and keep service pages focused on content and workflows.

## Service route links

Service HTML should use `{view.id}` tokens for service-owned links and HTMX paths:

```html
<a hx-get="{profile.summary}">Profile</a>
```

The framework rewrites those tokens to service route paths before sending HTML. Do not emit absolute service URLs from renderers.
