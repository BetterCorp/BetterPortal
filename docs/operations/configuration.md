# Configuration

BetterPortal configuration starts in `bp-config.yaml`.

The config manager provides a UI for editing tenants, apps, services, routes, menus, fragments, and theme settings.

## Main sections

| Section | Purpose |
|---|---|
| `themes` | Available themes and theme hostnames. |
| `platformServices` | Shared services that tenants can activate. |
| `tenants` | Tenant records, branding, and registered services. |
| `apps` | User-facing apps with hostnames, routes, menu, fragments, and theme config. |

## Service config

Each service also has `sec-config.yaml`. This is runtime configuration for the BSB process.

Common fields:

| Field | Purpose |
|---|---|
| `host` | Bind host. Usually `0.0.0.0` locally. |
| `port` | Service port. |
| `bpConfigPath` | Relative path to repo-level `bp-config.yaml`. |
| `configApiToken` | Token used for config API calls. |
| `configEncryptionKey` | Key for encrypted service config values. |

## Common mistakes

- Wrong `bpConfigPath` in `sec-config.yaml`.
- App route points to the wrong `viewId`.
- Service is running on a different port than the tenant service binding.
- New route files were added without running `bp-codegen`.
- Menu item references a missing or disabled route.
