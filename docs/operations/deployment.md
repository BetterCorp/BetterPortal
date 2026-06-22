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
