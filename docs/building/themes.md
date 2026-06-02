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
  index.tsx
```

If a view does not provide a renderer for the active app theme, the service returns a 406 response.

## Navigation belongs to the app

Service pages should not create their own persistent side navigation when the BP shell already provides navigation.

Use the app menu in `bp-config.yaml` for product-level navigation, and keep service pages focused on content and workflows.

## Root-relative URLs

Service HTML should emit root-relative links and HTMX paths. The shell runtime rewrites service links based on `data-bp-service`.

Do not emit absolute service URLs from renderers.
