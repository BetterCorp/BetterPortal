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
- fragment locations
- presentation hooks for loading, errors, swaps, and component lifecycle

It does not own service page content.

## Shared Node theme runtime

Node themes use `@betterportal/theme-runtime` for shell behavior. The package owns service and tenant URL rewriting, managed BP headers, the header-aware preload implementation, HTMX request/response handling, SSE, history, auth failures, downloads, and background fragments.

The runtime is assembled on the backend into one JavaScript asset in deterministic order: HTMX core, the theme adapter, the BetterPortal shell, and the bundled SSE extension. Browsers never discover or dynamically load HTMX extensions. A missing required asset fails during backend bundle creation.

Theme packages keep their public asset URLs and provide only presentation hooks. Bootstrap1 owns Bootstrap modal/offcanvas and component lifecycle behavior; Embedded owns its loading and error presentation. The required HTMX extension allowlist is `bp-shell, sse`. BetterPortal's header-aware preload is part of `bp-shell`; do not also load the stock preload extension.

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
