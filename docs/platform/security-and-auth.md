# Security and Auth

BetterPortal service APIs do not support cookies. Runtime auth and other browser-managed state travel to services through request headers.

This avoids cross-origin cookie problems while preserving independent service origins.

## BP header state

Services set browser-managed BP headers with response directives:

- `BP-SetHeader` tells the shell/client to store a named header value, expiry, owner, and scope.
- `BP-RemoveHeader` tells the shell/client to remove a stored header.

Route handlers use `ctx.bpHeaders.set(...)` and `ctx.bpHeaders.remove(...)`; the framework emits the directives. Do not read `Cookie`, emit `Set-Cookie`, or build service login/session flows around browser cookies.

The shell owns expiry and refresh behavior. Service fragments should not manipulate local storage directly for auth/header state.

Automation and AI clients must preserve these directives too: apply `BP-SetHeader`, apply `BP-RemoveHeader`, and send the current live BP headers on later BP API calls for the same discovered app/service context.

`Referer` and `Origin` are context hints used to resolve tenant/app when explicit context is absent. They are not an authorization boundary. Prefer discovered URLs, `tenantUrl`, `appId`, and BP headers for API calls.

## Auth model

Auth is optional at the platform layer. `auth-default` provides a JWT-based provider with JWKS discovery, `auth-authress-io` integrates Authress, and `auth-workos` integrates WorkOS AuthKit. Apps bind a provider through `app.auth.serviceId`, which points at a tenant service id or shared-service activation id.

Services declare route-level auth requirements in view metadata.

The selected auth service owns the BP runtime verifier metadata for the app:

- `expectedIssuer`
- `expectedAudience`
- `jwksUri`

Auth services publish those values with `registerAsAuthProvider({ issuer, audience, jwksUri, jwks })` during install/redeem and service sync. Config-manager stores the non-secret metadata on the service registration/shared service and copies it onto app auth bindings. Users should choose the auth provider, not manually edit BP token issuer/audience/JWKS fields.

Role ids are provider-facing identifiers. For Authress, the value emitted in the configured role claim path must match the BP role id exactly; the BP role title is display text only. Role ids may use letters, numbers, `.`, `_`, `:`, and `-`, must start with a letter or number, and are limited to 64 characters.

`*` is a reserved platform-root role id. It is not creatable through the normal role UI/API. A token containing `roles: ["*"]` bypasses route permission grants only when the request tenant and app exactly match `configManagement.adminTenantId` and `configManagement.managementAppId`. If `*` appears on any other tenant/app, BP logs an error and treats it as non-granting.

Default-auth assigns `*` to the first locally registered admin for the management app because it owns the local user store. External auth providers must assign the same provider-facing role id themselves; BP only verifies the emitted claim.

When a service denies access with `403 Insufficient permissions`, HTML clients receive a rendered permission message that includes the required `serviceId`, `viewId`, and permission actions. JSON clients receive the same details in the response body.

## Service-to-service auth

Provisioning creates service identity only. A service key/public key lets config-manager know which service is talking; it does not grant arbitrary API access.

M2M access is explicit and denied by default:

- Providers declare `apiContracts` in route or manifest metadata.
- Callers declare `m2mRequests` by contract id, version, capabilities, methods, and permissions.
- Config-manager stores tenant/app `m2m.bindings` to choose the concrete target service/view.
- Config-manager stores `m2m.grants` to approve methods/permissions for that binding.

Each installed service owns an RS256 private key generated after installation.
Config-manager stores the public key and distributes the relevant bindings and
grants; it does not mint S2S tokens. Targets verify short-lived, target-bound
service JWTs locally and deny access unless the current binding and grant match
the tenant, app, view, method, and route permissions.

Use `this.m2mClient(requestId, tenantId, appId)` from a `BPService` implementation
as the runtime passed to a generated BP client. It resolves the target URL from
the last-known-good snapshot, adds the tenant/app headers, and signs a fresh
service token for each request.

If config-manager cannot be reached, the cached snapshot remains active without
an automatic expiry. Consequently, a revocation is enforced per target after
that target next syncs; config-manager unavailability never becomes a live
dependency for existing calls.

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

Provider credentials such as Authress API keys or WorkOS API keys belong in the auth service's encrypted app-scoped service config. Platform config stores bindings and non-secret auth metadata, not provider secrets.

Authress and WorkOS app config expose `loginUI` with `default`, `clean`, and `redirect`. `clean` only changes the BP-rendered login presentation; `redirect` auto-starts the same provider redirect flow from that clean presentation. It is not a WorkOS custom in-app credential flow.

For WorkOS, application/client credentials and webhook secrets are app-scoped service config. Tenant-level WorkOS defaults must not contain app/client credentials. WorkOS permission slugs use short `bp_<shortId>_<permission>` keys backed by the service's `workosStatePath` mapping file; labels include service title, app path, service path, route kind, methods, view id, and action. BP runtime authorization still reads mirrored `app.auth.roles`. WorkOS permission webhook events are not processed.

Service API keys are service identities, not admin identities. Config Manager accepts them only on explicit service-facing endpoints. Authoritative services may self-mutate only their own app binding: auth services can replace `app.auth.roles` for apps whose `app.auth.serviceId` is their tenant service id or shared activation id, and theme services can update theme config for apps whose `app.shell.serviceId` is their tenant service id or shared activation id. Every synced auth permission must reference an enabled route mounted on that app.

## CORS

Services only allow configured app origins. If a service cannot resolve the calling app from `bp-config.yaml`, HTML requests may fail because the service cannot infer the active theme.

When adding a service, make sure its `sec-config.yaml` points to the correct repo-level `bp-config.yaml`.
