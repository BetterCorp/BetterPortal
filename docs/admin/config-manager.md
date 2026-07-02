# Config Manager

The config manager is the admin service for BetterPortal.

It edits the platform configuration and provides admin views for tenants, apps, services, routes, menus, fragments, and preview.

Config-manager has two surfaces:

- Platform admin views and `/.well-known/bp/admin/*` APIs for operators.
- User/app management discovery and `/.well-known/bp/manage/*` APIs for tenant/app tasks.

AI agents and automation tools must not use platform admin for user-owned tenant/app tasks. They should discover the management app and manage endpoints from the theme `/.well-known/bp/ai.json` or config-manager `/.well-known/bp/management`.

## What it manages

- tenant records
- tenant service registrations
- shared service catalog entries and tenant/app activations
- app hostnames
- app routes
- shell menu
- fragments
- theme config

## Local URL

The service runs on:

```text
http://localhost:3300
```

It is mounted into the default app under `/settings`.

## Route designer

The route designer maps app URLs to service views.

Use it when adding a service page to the portal without editing YAML by hand.

The user-facing settings route is `settings.index`. It exposes current tenant/app IDs, shared service activation, and links to management endpoints. Raw UUIDv7 IDs are intentionally visible for API, automation, and AI workflows.

## AI and automation discovery

Themes expose:

- `GET /.well-known/bp/ai.json`
- `GET /.well-known/bp/public`
- `GET /llms.txt`

Config-manager exposes:

- `GET /.well-known/bp/management`
- `GET /.well-known/bp/automation/catalog?tenantUrl=...`
- `GET /.well-known/bp/manage/current`
- `GET /.well-known/bp/manage/services`
- `POST /.well-known/bp/manage/services/activate`
- `GET|POST /.well-known/bp/manage/routes`
- `GET /.well-known/bp/manage/fragments`
- `GET|POST /.well-known/bp/manage/theme`
- `GET|POST /.well-known/bp/manage/webhooks/targets`
- `GET /.well-known/bp/manage/webhooks/events`

The automation catalog is built from cached service manifests pushed by services during sync/poll. Config-manager must not fetch service manifests server-side because it cannot assume network reachability to services.

## Webhooks

Webhook events are declared by service developers in the service manifest. Users/admins cannot edit payload schemas; they only configure delivery targets for declared events.

Config-manager receives service events at `POST /.well-known/bp/webhooks/events` using the service API key, queues matching targets, signs each POST, and retries failed delivery up to the target's `maxAttempts`. Disabled tenants are skipped.

The test endpoint sends a config-manager generated `{ "test": true }` payload directly to the target. It is useful for local callback URLs, but it does not ask the service to generate a real domain event.

## Services

Tenant services are direct bindings under one tenant. Shared services are platform-managed providers activated into tenants/apps. App references point at the activation id, not the shared catalog id.

Adding tenant services and shared services is URL-first and browser-mediated. The browser loads `/.well-known/bp/manifest` and `/.well-known/bp/schema.json` from the service, posts metadata to config-manager, asks config-manager for a setup token with `begin-install`, then calls the service `/.well-known/bp/install` directly. Config-manager must not fetch manifests/schema server-side, and rendered UI must not use the control-plane issuer as a browser form/action URL.

Scoped sync includes shared service activations as entries in `tenant.services` with public metadata only: activation `id`, `serviceId`, `hostname`/`baseUrl`, title, description, capabilities/tags, logo/category, deployment mode, and `source: "shared"`. Secrets stay out of scoped sync.

The Services view can convert a tenant service to a shared service. Conversion creates or reuses the shared catalog entry, creates a shared activation, rewrites routes, fragments, shell, auth, slots, and role grants from the old tenant service id to the activation id, then removes the tenant service only when no references remain.

Service configuration is independent from service usage. A tenant service or shared activation can be configured for the tenant before any app routes, shell, fragments, or auth bindings use it. The config editor opens on tenant defaults first; app scope is an explicit override layer where unchecked fields fall back to the tenant value.

Config Manager itself remains a direct tenant service during bootstrap because it is the control plane. The default auth service and Bootstrap1 theme are bootstrapped as shared services.

## Menu editor

The menu editor controls the BP shell navigation.

Prefer shell menu entries over building persistent inner menus inside services.
