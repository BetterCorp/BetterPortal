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

## Release publishing

Tag releases publish npm packages and then publish BSB registry schemas for every workspace that contains `bsb-plugin.json`. The tag is the release version: pushing `v10.0.2` makes CI set every workspace package to `10.0.2` before build/publish. Master builds and tests only; it does not publish.

Each publishable BetterPortal plugin package must set:

```json
{
  "bsb": {
    "orgId": "betterportal"
  }
}
```

The BSB registry uses that `orgId` as the namespace, so BetterPortal plugins publish under `betterportal/<plugin-id>`. This intentionally matches the npm package scope `@betterportal/...`. The GitHub release workflow publishes core packages first, then publishes each plugin package in a matrix and runs `npm run publish:client` for plugin workspaces after their npm publish step.

BetterPortal BSB plugins should declare the registry logo in their `createConfigSchema()` metadata:

```ts
image: "./betterportal-logo.png"
```

Keep that PNG at the package root and include it in `package.json` `files`. The BSB registry image upload path accepts PNG assets. `bsb-plugin.json` is generated during build, so do not hand-edit it to add registry imagery.

## Coolify

Use `docker-compose.coolify.yaml` for repo-sync deployments. It builds the workspace, then runs each process on the BSB runtime image `betterweb/service-base:node`.

The compose includes PostgreSQL 18 for config-manager production storage. Set `BP_POSTGRES_PASSWORD`; optional `BP_POSTGRES_DB` and `BP_POSTGRES_USER` default to `betterportal`.

Coolify services use the BSB runtime-provided vault config plugin instead of writing `sec-config.yaml` or injecting full config JSON into the container. The compose file selects that plugin for each BP service and sets:

```text
vaultUrl=${BP_VAULT_URL:-https://vault.eu.core.betterportal.net}
BSB_WRITABLE_PATHS=/data
```

`BP_VAULT_URL` is optional and defaults to the BetterPortal EU core vault URL. Each service must have its own vault API credentials in Coolify; do not reuse one key across containers unless that is an intentional vault policy decision.

Required per-service secret envs:

```text
BP_CONFIG_MANAGER_VAULT_API_KEY_ID
BP_CONFIG_MANAGER_VAULT_API_SECRET
BP_BOOTSTRAP1_VAULT_API_KEY_ID
BP_BOOTSTRAP1_VAULT_API_SECRET
BP_EMBEDDED_VAULT_API_KEY_ID
BP_EMBEDDED_VAULT_API_SECRET
BP_AUTH_DEFAULT_VAULT_API_KEY_ID
BP_AUTH_DEFAULT_VAULT_API_SECRET
BP_AUTHRESS_VAULT_API_KEY_ID
BP_AUTHRESS_VAULT_API_SECRET
BP_DOCS_VAULT_API_KEY_ID
BP_DOCS_VAULT_API_SECRET
BP_HELLO_VAULT_API_KEY_ID
BP_HELLO_VAULT_API_SECRET
```

The compose file maps those envs into the names expected by the BSB vault config plugin: `apiKeyId` and `apiSecret`. Port envs such as `BP_BOOTSTRAP1_PORT` only control Docker port publishing and health checks; the matching plugin `config.port` belongs in the vault-backed service profile.

Do not set Compose `working_dir` or an `APP_DIR` env for BSB containers. The BSB image owns its cwd/runtime layout. Set `betterportal.bootstrapStatePath` and `betterportal.scopedConfigCachePath` explicitly under `/data` in each vault-backed service profile.

The image also stages built BP packages into the BSB external plugin layout:

```text
/bp/plugins/@betterportal/<package>/<major>/<minor>/<patch>/
  package.json
  bsb-plugin.json
  lib/plugins/<plugin>/index.js
```

Each vault-backed service profile sets `package: "@betterportal/..."` and the container sets `BSB_PLUGIN_DIRS=/bp/plugins`. Do not point `BSB_PLUGIN_DIRS` at `src/plugins`, an unversioned workspace package, or a flat plugin folder; BSB resolves package plugins from the versioned package root and then loads `lib/plugins/<plugin>`.

The BSB runtime image provides its built-in config plugins. The Coolify image only adds the BetterPortal packages and the observable packages declared in the root workspace dependencies, currently `@bsb/observable-opentelemetry` and `@bsb/observable-axiom`.

Set the config-manager issuer/public URL inside the config-manager vault profile. Do not set service API keys or control-plane URLs for first deploy; non-CM services should start in setup mode and learn the control-plane URL during browser-driven install/bootstrap.

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
- service data volumes: bootstrap/install state, last scoped config snapshot, and service-specific stores such as auth signing keys/users. Point BP state and service-specific stores at `/data/...` in the relevant service JSON.

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
