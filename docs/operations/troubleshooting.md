# Troubleshooting

This page covers common BetterPortal failures and what to check first.

## 406 Not Acceptable

A service returns 406 when it cannot render the requested representation.

Common causes:

- The app shell or its manifest cannot be resolved.
- The view does not have an exact renderer match for the app shell.
- A fragment or component renderer was requested but does not exist.
- The request used an invalid `Accept` header.

Check:

- Service `sec-config.yaml` has the right `bpConfigPath`.
- App `shell.serviceId` references a synced shell service.
- The shell manifest's `renderer` matches the renderer folder suffix.
- Renderer folder exists, such as `_renderer.bootstrap5`.
- The app route points to the correct `viewId`.

## 404 from the theme

The app route may not exist or may be disabled.

Check `bp-config.yaml` under `apps[].routes`.

## Empty navigation

The app menu may be empty, disabled, or pointing at missing route ids.

Check `apps[].menu` and confirm every `routeId` exists.

## New route not visible

Run codegen and rebuild the service:

```bash
npm run bp-codegen
npm run build
```

## CORS errors

Services allow origins from the app config. Confirm the app hostname matches the browser origin and the service can read `bp-config.yaml`.
