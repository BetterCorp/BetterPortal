# Configuration

BetterPortal configuration starts in `bp-config.yaml` by default. The same platform config shape can also be stored in PostgreSQL for deployments where a local file is not a good operational source of truth.

The config manager provides a UI for editing tenants, apps, services, routes, menus, fragments, and theme settings.

## Main sections

| Section | Purpose |
|---|---|
| `themes` | Available themes and theme hostnames. |
| `platformServices` | Shared services that tenants can activate. |
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
| `configApiToken` | Token used for config API calls. |
| `configEncryptionKey` | Key for encrypted service config values. |

## Common mistakes

- Wrong `storage.configPath` in `sec-config.yaml` when using the file backend.
- App route points to the wrong `viewId`.
- Service is running on a different port than the tenant service binding.
- New route files were added without running `bp-codegen`.
- Menu item references a missing or disabled route.
