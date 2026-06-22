# Configuration

BetterPortal configuration starts in `bp-config.yaml` by default. The same platform config shape can also be stored in PostgreSQL for deployments where a local file is not a good operational source of truth.

The config manager provides a UI for editing tenants, apps, services, routes, menus, fragments, and theme settings.

## Main sections

| Section | Purpose |
|---|---|
| `themes` | Available themes and theme hostnames. |
| `platformServices` | Shared services that tenants can activate. |
| `sharedServiceCatalog` | Platform-managed service definitions that can be activated for tenants/apps. |
| `sharedServiceActivations` | Concrete shared-service instance bindings referenced by apps. |
| `tenants` | Tenant records, branding, and registered services. |
| `apps` | User-facing apps with hostnames, routes, menu, fragments, and theme config. |

## Config management metadata

The root `configManagement` section is optional metadata for the admin surface:

```yaml
configManagement:
  adminTenantId: betterportal
  auth:
    mechanism: none # none | dev-token | jwt | oidc
    issuer: https://idp.example.com/
    audience: betterportal-admin
    requiredPermissions:
      - config.write
```

`adminTenantId` identifies the tenant that owns the admin experience. `auth` records the intended admin authentication mechanism. Today this is configuration metadata for deployments and future enforcement; it does not by itself make the current admin routes multi-tenant isolated.

## Shared services

Tenant services live under `tenants[].services[]` and are owned by one tenant. Shared services are split into:

- `sharedServiceCatalog[]`: the shared provider definition, including plugin id, browser-visible base URL, API key hash, category, and tags.
- `sharedServiceActivations[]`: the tenant/app binding. The activation `id` is the service instance id used by `app.shell.serviceId`, `app.auth.serviceId`, routes, fragments, slots, and role grants.

The bootstrap process keeps config-manager as a direct tenant service because it is the control plane. It creates the default auth service and Bootstrap1 theme as shared catalog entries with activations for the admin tenant/app.

The Services UI can convert an existing tenant service to a shared service. The migration creates or reuses a catalog entry, creates an activation, rewrites app references from the tenant service id to the activation id, then removes the old tenant service only when no references remain.

Service config has two layers. Tenant scope stores the service defaults for that tenant. App scope stores overrides for a specific app and is allowed even before the app uses the service in routes, shell, fragments, or auth. Unchecked app override fields fall back to tenant scope.

Service config schemas can group fields with `groups[]` and `field.groupId`. Use `field.order` for stable display order and `field.defaultValue` for visible defaults when no tenant/app value exists. Optional groups allow the generic app-scope editor to enable or clear a related set of overrides together.

Fields can also provide generic UI hints. These only affect the generated editor; validation still belongs to the service schema.

```ts
{
  key: "brandColor",
  title: "Brand color",
  scope: "tenant",
  visibility: "protected",
  ownership: "bp",
  sourceOfTruth: "bp",
  defaultValue: "#2563eb",
  ui: { control: "color" }
}
```

Supported `field.ui.control` values use native browser controls: `text`, `textarea`, `password`, `number`, `checkbox`, `select`, `multiselect`, `color`, `date`, `time`, `datetime-local`, `url`, and `email`. `ui.options` supplies `{ value, label }` entries for selects. `ui.placeholder`, `ui.min`, `ui.max`, `ui.step`, and `ui.rows` are passed through where the control supports them.

## Platform config storage

The config manager supports modular storage backends.

### File backend

This is the default and keeps current local development behavior, so it can be omitted:

```yaml
config:
  host: 0.0.0.0
  port: 3300
```

To use a different file path, set `storage` explicitly:

```yaml
config:
  storage:
    backend: file
    configPath: /etc/betterportal/bp-config.yaml
```

### PostgreSQL backend

For production, the config manager can store the validated platform config as JSONB in PostgreSQL:

```yaml
config:
  storage:
    backend: postgres
    connectionString: postgres://betterportal:betterportal@localhost:5432/betterportal
    tableName: bp_platform_config
    rowId: default
```

The framework creates this table if it does not exist:

```sql
create table if not exists bp_platform_config (
  id text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
```

Install the `pg` package in the runtime service that uses the PostgreSQL backend. The code path is compatible with PostgreSQL 18, but it only uses standard `jsonb`, `timestamptz`, and `on conflict` features.

## Service config

Each service also has `sec-config.yaml`. This is runtime configuration for the BSB process.

Common fields:

| Field | Purpose |
|---|---|
| `host` | Bind host. Usually `0.0.0.0` locally. |
| `port` | Service port. |
| `storage` | Config-manager storage backend. Defaults to `backend: file` and `configPath: ./bp-config.yaml` relative to the BSB service cwd. Use `backend: postgres` with `connectionString` for PostgreSQL. |
| `configApiToken` | **Dev only.** Static bearer for the local config-API fallback. Inert unless `BP_ALLOW_DEV_CONFIG_TOKEN=true` is also set in the environment. Production verifies CP-signed tickets via the CP JWKS and needs no token - do **not** set this in production. |
| `configEncryptionKey` | Key for encrypted service config values. |

## Common mistakes

- Wrong `storage.configPath` in `sec-config.yaml` when using the file backend.
- App route points to the wrong `viewId`.
- Service is running on a different port than the tenant service binding.
- New route files were added without running `bp-codegen`.
- Menu item references a missing or disabled route.
