# Platform Architecture

BetterPortal composes a portal from a shell service plus independent services.

The browser talks to the shell service for the host page and to services for page content. The shell provides navigation and layout, but page bodies are loaded directly from the service that owns the route.

## Request flow

1. A user opens an app URL on the shell origin.
2. The shell resolves the tenant and app from scoped config.
3. The shell renders the host page and identifies the active route.
4. HTMX requests the route content from the owning service origin.
5. The service validates inputs, runs the handler, validates output, and renders HTML for the resolved app shell renderer.
6. HTMX swaps the service response into the main outlet.

## Why services are separate origins

Each service runs independently. This keeps deployment, scaling, ownership, and failure boundaries clear.

The tradeoff is that CORS must be correct. BetterPortal handles this through app hostnames, origin policy, and service-side BP config resolution.

## Why the shell does not proxy content

Proxying page bodies through the shell would make it a bottleneck and blur service boundaries.

BetterPortal instead makes the browser the composition point. The shell stays stable, while services own their own HTML APIs.

## Configuration source of truth

`bp-config.yaml` defines:

- tenants
- tenant services
- shared service catalog entries
- shared service activations
- apps
- routes
- menu
- fragments

The config manager can edit this file through BetterPortal APIs.

Scoped service snapshots keep authorization and lookup separate. `routes` and `fragments` contain the current service's allowlisted records; `appRoutes` and `appFragments` contain read-only application-wide indexes used to resolve mounted dependency services. Application indexes never authorize an inbound service request.

Tenant services are direct one-tenant bindings. Shared services are registered once in the shared catalog and activated into tenants/apps. Apps reference the activation id for shell, auth, routes, fragments, slots, and role grants. This keeps a shared provider such as auth or a shell reusable while preserving a concrete per-tenant/app service instance id.

## Runtime contracts

Every service route is schema-first:

| Contract | Purpose |
|---|---|
| Query schema | Validates URL query input. |
| Headers schema | Validates selected request headers. |
| Request schema | Validates write request bodies. |
| Response schema | Validates handler output before JSON or HTML rendering. |

This keeps service boundaries explicit and inspectable.
