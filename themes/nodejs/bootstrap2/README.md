# BetterPortal Bootstrap2 Theme

Compact Bootstrap 5 and HTMX shell for operations-heavy BetterPortal apps.

## Design

- dark-first, flat control-room presentation
- dense 184px navigation and compact top bar
- service-owned work queues and split-pane inspectors
- empty-by-default `critical-alerts` shell fragment block
- responsive Bootstrap offcanvas navigation

The shell identity is `bootstrap2`; the renderer compatibility key remains `bootstrap5`, so existing Bootstrap 5 service renderers continue to work.

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
