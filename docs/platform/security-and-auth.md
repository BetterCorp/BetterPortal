# Security and Auth

BetterPortal keeps browser cookies on the theme origin and sends runtime auth context to services through request headers.

This avoids cross-origin cookie problems while preserving independent service origins.

## BP header state

Services set browser-managed BP headers with response directives:

- `BP-SetHeader` tells the shell/client to store a named header value, expiry, owner, and scope.
- `BP-RemoveHeader` tells the shell/client to remove a stored header.

The shell owns expiry and refresh behavior. Service fragments should not manipulate local storage directly for auth/header state.

Automation and AI clients must preserve these directives too: apply `BP-SetHeader`, apply `BP-RemoveHeader`, and send the current live BP headers on later BP API calls for the same discovered app/service context.

`Referer` and `Origin` are context hints used to resolve tenant/app when explicit context is absent. They are not an authorization boundary. Prefer discovered URLs, `tenantUrl`, `appId`, and BP headers for API calls.

## Auth model

Auth is optional at the platform layer. `auth-default` provides a JWT-based provider with JWKS discovery, and `auth-authress-io` integrates Authress. Apps bind a provider through `app.auth.serviceId`, which points at a tenant service id or shared-service activation id.

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

Provider credentials such as Authress API keys belong in the auth service's encrypted app-scoped service config. Platform config stores bindings and non-secret auth metadata, not provider secrets.

## CORS

Services only allow configured app origins. If a service cannot resolve the calling app from `bp-config.yaml`, HTML requests may fail because the service cannot infer the active theme.

When adding a service, make sure its `sec-config.yaml` points to the correct repo-level `bp-config.yaml`.
