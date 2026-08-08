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
- `GET /llms-api.txt`
- `GET /llms-dev.txt`
- `GET /llms-ui.txt`

Config-manager exposes:

- `GET /.well-known/bp/management`
- `GET /.well-known/bp/automation/catalog?tenantUrl=...`
- `GET /.well-known/bp/automation/llms-api.txt?tenantUrl=...`
- `GET /.well-known/bp/manage/current`
- `GET /.well-known/bp/manage/services`
- `POST /.well-known/bp/manage/services/activate`
- `GET|POST /.well-known/bp/manage/routes`
- `GET /.well-known/bp/manage/fragments`
- `GET|POST /.well-known/bp/manage/theme`
- `GET|POST /.well-known/bp/manage/webhooks/targets`
- `GET /.well-known/bp/manage/webhooks/events`

The automation catalog is built from cached service manifests pushed by services during sync/poll. Config-manager must not fetch service manifests server-side because it cannot assume network reachability to services.

The text API guide and JSON catalog are two representations of the same app-scoped cached metadata. The guide expands actions, permissions, schemas, and demo scenarios for an LLM or human; the catalog remains the stable input for automation clients. Both continue to require normal route authentication when a discovered action is called.

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

## Service connections

The Services view includes an app selector and an app-scoped Service Connections panel. It derives pending requests from each available source service's cached `m2mRequests` and matches them to available providers' cached `apiContracts` by contract id, exact requested version, mode, methods, capabilities, and permissions.

- `pending` has one compatible provider and can be approved directly.
- `choice` has multiple compatible providers; the administrator must choose a concrete service instance and view.
- `unavailable` has no compatible provider.
- `connected` has one valid binding and active grant.
- `stale` preserves a stored binding whose request, provider contract, mode, or grant no longer matches current manifests.

Approval creates one UUIDv7 app-scoped binding and one least-privilege grant. It never groups providers by display title; duplicate titles are distinguished by plugin id and service-instance UUID. Revocation removes the binding and its grants. If the source requests the dependency again, it appears as pending and a later approval creates fresh IDs rather than restoring the revoked record.

The admin API is `GET|POST /.well-known/bp/admin/apps/{appId}/m2m/connections` and `DELETE /.well-known/bp/admin/apps/{appId}/m2m/connections/{bindingId}`. Manifest sync and service identity provisioning never auto-approve a connection.

## Roles and permissions

Role ids are explicit and should match the values emitted by the selected auth provider. For Authress, configure the Authress role claim so it contains BP role ids such as `admin`, `finance.viewer`, or `tenant-manager`; BP does not map Authress display names to BP role ids.

When the selected auth service advertises both role authorities, Tenants & Apps exposes a Role management selector. Provider management remains the default: Config Manager renders the provider's sync fragment, disables local role editing, and mirrors provider role ids into `app.auth.roles`. BetterPortal management enables the normal Permission Manager editor and reconciles its role definitions and BP grants up to the provider. Provider roles that do not yet exist in BP are imported with no BP grants before reconciliation.

Tenants & Apps also owns post-auth navigation. After selecting an auth provider, administrators may select an after-sign-in and after-sign-out target as a service + view pair. Config Manager stores these under `app.auth.redirects`; they are not provider addon fields. The selector includes only enabled GET page views with one unique app path. If a later manifest sync makes a selected view unavailable, Config Manager preserves and labels the stale target for repair; runtime navigation falls back to `app.defaultRoute`. Blank targets also use `app.defaultRoute`.

Tenants & Apps also owns app-wide robots and sitemap policy. Visibility defaults to `auto`; an inaccessible service is omitted and its mounted paths are disallowed by default; successful service data defaults to a 24-hour cache; canonical origin defaults to the configured hostname matched by the request. A private app emits a root disallow and an empty sitemap.

The Route Designer understands service `pathVariants` and `:param` segments. Every service parameter must either appear with the same name in the app mount path or have a validated fixed value. Unresolved parameters block saving in both the UI and admin API. Fixed mappings are stored in `route.fixedParams`; a non-primary optional path is stored in `route.servicePathVariant`. Config Manager migrates legacy `{param}` route paths to `:param` once and rejects brace syntax on new writes.

For WorkOS-backed apps, BP permissions sync to short WorkOS permission slugs as `bp_<shortId>_<permission>`; the WorkOS service stores the tenant/service/view mapping in its `workosStatePath` JSON file. WorkOS permission webhook events are intentionally ignored to avoid sync loops. Role webhook events follow the app's selected role authority: WorkOS -> BP in provider mode and BP -> WorkOS in BetterPortal mode.

The normal role API rejects reserved ids, including `root` and `*`. The reserved `*` role is maintained only on the configured management tenant/app as the platform-root wildcard. It grants every route permission only when the request is for `configManagement.adminTenantId` and `configManagement.managementAppId`; outside that exact scope, it is logged as misuse and does not grant access.

Default-auth first-admin setup writes `appRoles[managementAppId] = ["*"]` for the local user. Authress, WorkOS, and other external providers must assign a provider role whose emitted role claim is exactly `*`; config-manager does not manage external-provider user membership.

## Menu editor

The menu editor controls the BP shell navigation.

Prefer shell menu entries over building persistent inner menus inside services.

Menus should link only to app page routes backed by service page renderers. API, raw, dependency, and fragment-only routes can exist in app route allowlists, but they should not be generated or selected as menu entries.

## Theme fragment editor

The fragment editor is driven by the selected shell's cached manifest. With no shell there are no shell fragment controls. A `shell/_name.tsx` definition is one replaceable fragment; `shell/_name/index.tsx` is an ordered fragment block. Settings are stored under the shell service-instance UUID, so switching shells switches both the available definitions and their saved choices.

An unset value uses the theme default. `none` is the explicit empty value. Service fragments are selected from synced manifest metadata and the app route allowlist; the editor never fetches service or theme manifests from the browser.

Legacy `app.fragments` and `app.slots` values remain read-only fallbacks until an administrator saves an explicit setting for that theme fragment. New edits write only `app.shellFragments`.
