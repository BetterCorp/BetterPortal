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

Use `docker-compose.coolify.yaml` for repo-sync deployments. It runs the BSB runtime image directly and uses a dedicated BSB plugin watcher container to install/update BetterPortal plugin packages into a shared plugin volume. Runtime service containers mount that shared plugin volume read-only and do not run package installation on startup. The compose does not build the local workspace inside Coolify. The default BSB image is `code.bettercorp.dev/bettercorp/service-base:node-latest`; set `BSB_IMAGE` to override it.

The compose includes PostgreSQL 18 for config-manager production storage. Set `BP_POSTGRES_PASSWORD`; optional `BP_POSTGRES_DB` and `BP_POSTGRES_USER` default to `betterportal`.

Coolify services use the BSB runtime-provided vault config plugin instead of writing `sec-config.yaml` or injecting full config JSON into the container. The compose file selects that plugin for each BP service and sets:

```text
vaultUrl=${BP_VAULT_URL:-https://vault.eu.core.betterportal.net}
BSB_WRITABLE_PATHS=/data
BSB_PLUGIN_DIRS=/mnt/plugins
BSB_SHOW_PACKAGES=${BSB_SHOW_PACKAGES:-false}
```

`BP_VAULT_URL` is optional and defaults to the BetterPortal EU core vault URL. Each service must have its own vault API credentials in Coolify; do not reuse one key across containers unless that is an intentional vault policy decision.

The `bsb-plugin-watcher` service is the only container that sets `BSB_PLUGINS` and `BSB_PLUGIN_UPDATE`. It mounts `bp-plugins` read/write, runs with `BSB_PLUGIN_WATCHER=true`, and syncs these packages into `/mnt/plugins`:

```text
@betterportal/config-manager@10.0
@betterportal/theme-bootstrap1@10.0
@betterportal/theme-embedded@10.0
@betterportal/auth-default@10.0
@betterportal/auth-authress-io@10.0
@betterportal/hello-view@10.0
@bsb/observable-opentelemetry@9.6
@bsb/observable-axiom@9.6
```

The plugin selectors are hardcoded in compose because releases update this file alongside package publishing. Do not use bare/latest selectors in Coolify; the BSB watcher expects explicit `major.minor` or `major.minor.patch` selectors. `BSB_PLUGIN_UPDATE` is defined only on the watcher and defaults to `true` there. Runtime service containers must not set `BSB_PLUGIN_UPDATE`. `BSB_PLUGIN_WATCH_INTERVAL_SECONDS` defaults to `3600`. `BSB_SHOW_PACKAGES` defaults to `false`; set it to `true` only when debugging package resolution/startup in Coolify logs.

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
BP_HELLO_VIEW_VAULT_API_KEY_ID
BP_HELLO_VIEW_VAULT_API_SECRET
```

The compose file maps those envs into the names expected by the BSB vault config plugin: `apiKeyId` and `apiSecret`. The Coolify image exposes container port `80` and the compose file does not declare host port mappings; set each bundled service profile's plugin `config.port` to `80` for Coolify deployments.

Do not set Compose `working_dir` or an `APP_DIR` env for BSB containers. The BSB image owns its cwd/runtime layout. Set `betterportal.bootstrapStatePath` and `betterportal.scopedConfigCachePath` explicitly under `/data` in each vault-backed service profile. Config-manager accepts this same `betterportal` block even though its primary platform storage is configured separately under `storage`.

Each vault-backed service profile still sets `package: "@betterportal/..."`; BSB resolves that package from `/mnt/plugins` first, then runtime `node_modules`. The runtime containers do not set `BSB_PLUGINS`; package sync is owned by `bsb-plugin-watcher`. The BSB runtime image provides its built-in config plugins, including config-vault.

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
- `bp-plugins`: shared BSB plugin package cache.
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
