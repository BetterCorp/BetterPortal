# BetterPortal Bootstrap2 Theme

Compact Bootstrap 5 and HTMX shell for operations-heavy BetterPortal apps.

## Design

- dark-first, flat control-room presentation
- dense 184px navigation and compact top bar
- service-owned work queues and split-pane inspectors
- empty-by-default `critical-alerts` shell fragment block
- responsive Bootstrap offcanvas navigation

The shell identity is `bootstrap2`; the renderer compatibility key remains `bootstrap5`, so existing Bootstrap 5 service renderers continue to work.

## App theme configuration

Bootstrap2 reads its app-scoped service configuration for `brandName`, `documentTitle`, light/dark logo URLs, favicon URL, default mode, and semantic palette colors. Empty browser title falls back to the app title; empty brand falls back through tenant branding to the service default. The configured browser title is the stable suffix, while the promoted service page heading becomes the active tab prefix after HTMX navigation.

Configure these through the theme settings view instead of embedding product names, logos, favicon links, colors, or `<title>` elements in service renderers. Service renderers receive `ctx.app.title` and `ctx.tenant.branding` for presentation text that belongs inside page content.

## Distribution

Bootstrap2 is a private, source-run workspace. Release CI builds it and may publish its BSB/BP metadata, but excludes it from npm publication and the npm-backed Coolify watcher.

## Offline boundary

Bootstrap2 uses a native service worker to precache its versioned Bootstrap CSS/JS, BetterPortal HTMX runtime, images, registration code, and generic offline shell. Dynamic host HTML remains `no-store`. Service HTMX, SSE, WebSocket, authentication, health, and download traffic is never stored by the theme cache.

After one successful online load, an offline navigation can render the cached framework and a reconnect message. Service content still requires its service unless that service defines its own cache contract.

## Development

```sh
npm run build --workspace @betterportal/theme-bootstrap2
npm test --workspace @betterportal/theme-bootstrap2
npm run dev --workspace @betterportal/theme-bootstrap2
```

The development service uses port `3126`.

Theme guidance is published through `/.well-known/bp/resources` and `/llms-ui.txt`.
The published resources include the compact UI guide, page template, Bootstrap examples, critical-alert pattern, and a complete queue/detail named-component workflow.
