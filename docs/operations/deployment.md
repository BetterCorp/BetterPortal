# Deployment

BetterPortal deploys as multiple independently running services.

At minimum, a deployment needs a theme service and at least one business service. Admin and auth services can be added as needed.

## Deployment units

| Unit | Example |
|---|---|
| Theme | `@betterportal/theme-bootstrap1` |
| Admin service | `@betterportal/config-manager` |
| Docs service | `@betterportal/docs-site` |
| Business service | `@betterportal/hello-view` |
| Auth service | `@betterportal/auth-default` or `@betterportal/auth-authress-io` |

## Hostnames

The app hostnames in `bp-config.yaml` must match the public hostnames users visit.

Service hostnames must be reachable by the browser, because the theme does not proxy page content.

During first bootstrap, config-manager is registered as the direct control-plane tenant service. The default auth service and Bootstrap1 theme are registered as shared services and activated for the admin tenant/app. Existing tenant services can later be converted to shared services from the Services UI; the migration rewrites app references to the new shared activation id.

## Build

Build the workspace before deployment:

```bash
npm run build
```

For services with route changes, make sure codegen has run:

```bash
npm run bp-codegen
```

## Coolify

Use `docker-compose.coolify.yaml` for repo-sync deployments. It builds the workspace, then runs each process on the BSB runtime image `betterweb/service-base:node`.

The compose includes PostgreSQL 18 for config-manager production storage. Set `BP_POSTGRES_PASSWORD`; optional `BP_POSTGRES_DB` and `BP_POSTGRES_USER` default to `betterportal`.

Coolify services use BSB's core `config-env` plugin instead of writing `sec-config.yaml` at startup. Each service sets `BSB_CONFIG_PLUGIN=config-env` and a `BSB_CONFIG_JSON` value with the same profile shape as `sec-config.yaml`. Do not set `BSB_CONFIG_PLUGIN_PACKAGE` for core BSB config plugins.

Override service config by setting the service-specific JSON env in Coolify:

```text
BP_CONFIG_MANAGER_BSB_CONFIG_JSON
BP_BOOTSTRAP1_BSB_CONFIG_JSON
BP_EMBEDDED_BSB_CONFIG_JSON
BP_AUTH_DEFAULT_BSB_CONFIG_JSON
BP_AUTHRESS_BSB_CONFIG_JSON
BP_DOCS_BSB_CONFIG_JSON
BP_HELLO_BSB_CONFIG_JSON
```

Each value is passed through as `BSB_CONFIG_JSON` for that one BSB process. Port envs such as `BP_BOOTSTRAP1_PORT` only control Docker port publishing and health checks; the matching plugin `config.port` still belongs inside that service's JSON.

Do not set Compose `working_dir` or an `APP_DIR` env for BSB containers. The BSB image owns its cwd/runtime layout; use absolute paths under `/data` in each service's `BSB_CONFIG_JSON` for persistent files.

The image also stages built BP packages into the BSB external plugin layout:

```text
/bp/plugins/@betterportal/<package>/<major>/<minor>/<patch>/
  package.json
  bsb-plugin.json
  lib/plugins/<plugin>/index.js
```

Each `BSB_CONFIG_JSON` service entry sets `package: "@betterportal/..."` and the container sets `BSB_PLUGIN_DIRS=/bp/plugins`. Do not point `BSB_PLUGIN_DIRS` at `src/plugins`, an unversioned workspace package, or a flat plugin folder; BSB resolves package plugins from the versioned package root and then loads `lib/plugins/<plugin>`.

Set the config-manager issuer/public URL inside `BP_CONFIG_MANAGER_BSB_CONFIG_JSON`. Do not set service API keys or control-plane URLs for first deploy; non-CM services should start in setup mode and learn the control-plane URL during browser-driven install/bootstrap.

For the bundled database, config-manager storage should use the `postgres` compose hostname:

```json
{
  "storage": {
    "backend": "postgres",
    "connectionString": "postgres://betterportal:<BP_POSTGRES_PASSWORD>@postgres:5432/betterportal"
  }
}
```

Persistent data lives in named volumes:

- `bp-postgres`: PostgreSQL data.
- `bp-config-manager`: platform config, CP signing keys, webhook delivery state.
- service data volumes: bootstrap/install state, last scoped config snapshot, and service-specific stores such as auth signing keys/users. Point those paths at `/data/...` in the relevant service JSON.

## Operational checks

Every service should expose:

```text
/.well-known/bp/health
/.well-known/bp/manifest
/.well-known/bp/schema.json
```

Use these endpoints for health checks and manifest validation.

`/.well-known/bp/health` is a readiness check, not just a process-liveness check. A service running in control-plane sync mode should return `503` until it has applied its first scoped config snapshot. Configure load balancers and startup checks to wait for `200` before sending user traffic.

Setup mode is different: a not-yet-adopted service may report healthy for bootstrap/install endpoints while still returning `503` for normal view traffic until installation and sync complete.
