# Security and Auth

BetterPortal keeps browser cookies on the theme origin and sends runtime auth context to services through request headers.

This avoids cross-origin cookie problems while preserving independent service origins.

## Auth model

Auth is optional at the platform layer. The default auth package provides a JWT-based platform service with JWKS discovery.

Services declare route-level auth requirements in view metadata.

## Route policy

Each view can declare:

```ts
export const auth = {
  required: false,
  realm: "runtime",
  minimumTier: "public",
  audiences: [],
  permissions: []
};
```

The manifest advertises this policy so themes, admin tools, and gateways can reason about access.

## Secrets

Service config fields can be marked as public, protected, or secret.

Secret values should be stored through service config APIs and encrypted with a configured `configEncryptionKey`.

## CORS

Services only allow configured app origins. If a service cannot resolve the calling app from `bp-config.yaml`, HTML requests may fail because the service cannot infer the active theme.

When adding a service, make sure its `sec-config.yaml` points to the correct repo-level `bp-config.yaml`.
