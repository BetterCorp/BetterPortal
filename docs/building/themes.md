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
- service link rewriting
- HTMX request behavior

It does not own service page content.

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
