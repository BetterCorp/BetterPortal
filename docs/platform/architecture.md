# Platform Architecture

BetterPortal composes a portal from a theme plus independent services.

The browser talks to the theme for the shell and to services for page content. The theme provides navigation and layout, but page bodies are loaded directly from the service that owns the route.

## Request flow

1. A user opens an app URL on the theme origin.
2. The theme resolves the tenant and app from `bp-config.yaml`.
3. The theme renders the shell and identifies the active route.
4. HTMX requests the route content from the owning service origin.
5. The service validates inputs, runs the handler, validates output, and renders HTML for the active theme.
6. HTMX swaps the service response into the main outlet.

## Why services are separate origins

Each service runs independently. This keeps deployment, scaling, ownership, and failure boundaries clear.

The tradeoff is that CORS must be correct. BetterPortal handles this through app hostnames, origin policy, and service-side BP config resolution.

## Why the theme does not proxy content

Proxying page bodies through the theme would make the theme a bottleneck and blur service boundaries.

BetterPortal instead makes the browser the composition point. The shell stays stable, while services own their own HTML APIs.

## Configuration source of truth

`bp-config.yaml` defines:

- themes
- tenants
- tenant services
- apps
- routes
- menu
- fragments

The config manager can edit this file through BetterPortal APIs.

## Runtime contracts

Every service route is schema-first:

| Contract | Purpose |
|---|---|
| Query schema | Validates URL query input. |
| Headers schema | Validates selected request headers. |
| Request schema | Validates write request bodies. |
| Response schema | Validates handler output before JSON or HTML rendering. |

This keeps service boundaries explicit and inspectable.
