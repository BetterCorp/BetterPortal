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

After-login and after-logout navigation belongs to the app, not the provider's addon config. Store each target in `app.auth.redirects` as `{ serviceId, viewId }`; Config Manager resolves it to the app's unique enabled GET page path. If manifest sync makes the view stale, the reference is preserved for repair and runtime safely falls back to `app.defaultRoute`. Explicit request return paths take precedence.

Services declare route-level auth requirements in view metadata.

The selected auth service owns the BP runtime verifier metadata for the app:

- `expectedIssuer`
- `expectedAudience`
- `jwksUri`
- `publicKeys`

Auth services publish those values and their public JWKS with `registerAsAuthProvider({ issuer, audience, jwksUri, jwks })` during install/redeem and every service sync. Config-manager stores the non-secret keys on the service registration/shared service and copies them onto app auth bindings regardless of whether installation or app selection happened first. Services prefer `app.auth.publicKeys`; `jwksUri` is the network fallback and must be reachable even when the issuer is a synthetic stable identifier.

Role ids are provider-facing identifiers. For Authress, the value emitted in the configured role claim path must match the BP role id exactly; the BP role title is display text only. Role ids may use letters, numbers, `.`, `_`, `:`, and `-`, must start with a letter or number, and are limited to 64 characters.

`*` is a reserved platform-root role id. It is not creatable through the normal role UI/API. A token containing `roles: ["*"]` bypasses route permission grants only when the request tenant and app exactly match `configManagement.adminTenantId` and `configManagement.managementAppId`. If `*` appears on any other tenant/app, BP logs an error and treats it as non-granting.

Default-auth assigns `*` to the first locally registered admin for the management app because it owns the local user store. External auth providers must assign the same provider-facing role id themselves; BP only verifies the emitted claim.

When a service denies access with `403 Insufficient permissions`, HTML clients receive a rendered permission message that includes the required `serviceId`, `viewId`, and permission actions. JSON clients receive the same details in the response body.

## Service-to-service auth

Provisioning creates service identity only. A service key/public key proves which installed service is calling; it grants no API access by itself.

Every route has an explicit caller policy:

- `user` verifies the BetterPortal user bearer token. This is the default when `auth.callers` is omitted.
- `service` verifies a short-lived service token and requires an approved service binding/grant.
- `delegated` verifies both the original BetterPortal user token and a service token. The target independently checks the user permissions and the service grant.

A provider route must opt into machine access with `auth.callers: ["service"]`, `auth.callers: ["delegated"]`, or both. Publishing an `apiContract` for a mode the route does not allow fails manifest construction. Existing routes remain user-only unless they explicitly opt in.

Providers declare `apiContracts` with supported `modes`, methods, capabilities, and permissions. Callers declare `m2mRequests` with one requested `mode`. Config-manager's Services page shows compatible app-scoped requests and creates one `m2m.binding` plus one least-privilege `m2m.grant` only after an administrator approves the request. Provisioning and manifest sync never approve access automatically.

For machine callers, the approved service binding and exact view/method grant
supply baseline route authorization. Authored additional permission actions still
apply. Delegated calls additionally require the user's automatic route grant and
all authored requirements; a service grant never substitutes for user authority.

Pure service calls use:

```http
Authorization: Bearer <service-token>
X-BP-Service-Id: <source-service-instance-uuid>
X-BP-Tenant-Id: <tenant-uuid>
X-BP-App-Id: <app-uuid>
```

Delegated calls preserve the original user credential and put the service proof in a second header:

```http
Authorization: Bearer <original-bp-user-jwt>
X-BP-Service-Authorization: Bearer <service-token>
X-BP-Service-Id: <source-service-instance-uuid>
X-BP-Tenant-Id: <tenant-uuid>
X-BP-App-Id: <app-uuid>
```

A complete service envelope resolves tenant/app from these headers before `Origin` or `Referer`. A partial, malformed, or mismatched envelope is rejected and never falls back to browser context resolution. For delegated mode, the target verifies the user JWT again against its configured app verifier and then checks the service token against the delegated binding and grant.

Each installed service owns an RS256 private key generated after installation. Config-manager stores its public key and distributes relevant bindings and grants in scoped snapshots; it does not mint S2S tokens. Tokens are short-lived and target-bound.

Inside a request handler, use `this.m2mClient(requestId, ctx)` as the runtime for a generated pure-service client so the outbound span inherits the active request trace. Use `this.m2mClient(requestId, tenantId, appId)` only for background automation without a request context. In a user-initiated handler, use `this.delegatedM2mClient(requestId, ctx)`; it preserves the inbound BP user token, signs a fresh secondary service token, and propagates the active W3C trace context.

`traceparent`, `tracestate`, and `baggage` are observability metadata, not security credentials. A syntactically valid remote parent may join a trace, but it never establishes tenant/app context or caller identity. `bp.session_id` baggage must be a UUIDv7 and remains untrusted even when it originated from a BetterPortal shell.

Revocation removes the binding and grant. Already-issued tokens fail after the target receives the next scoped sync. If the same dependency is needed later, it returns to pending approval and approval creates fresh binding/grant IDs; revoked records are never silently reactivated. When config-manager is unavailable, the last-known-good snapshot remains active, so revocation enforcement occurs when each target next syncs.

## Route policy

Protected operations (`required: true`, or an elevation requirement) always require
an app role grant for their own service instance, view and HTTP action: GET and
explicit OPTIONS require `read`, POST requires `create`, PUT/PATCH require `update`,
and DELETE requires `delete`. Framework-handled CORS preflight runs separately.
SSE, streamed HTML and HEAD inherit the owning GET policy. The baseline matches
the concrete installation exactly; plugin aliases apply only to authored
additional requirements. A shared host resolves tenant activations through the
trusted `sharedServiceId` catalog relationship, with ambiguous matches denied.

`auth.permissions` contains **additional** service/view/action requirements. Every
additional action must be granted as well as the baseline. An empty or omitted
list never disables baseline authorization. For example, this protected GET needs
its own `read` grant and the extra report-update grant:


```ts
export const auth = {
  required: true,
  callers: ["user"],
  permissions: [
    { serviceId: "com.example.reports", viewId: "reports.update", permissions: ["update"] }
  ]
};
```

The manifest advertises this policy so themes, admin tools, and gateways can reason about access.

Methods sharing one `viewId` do not share policy. Their unique `operationId` values
select the correct allowlist and contract, while role grants remain
`serviceId + viewId + action`. Additional requirements cannot replace the baseline.
A POST representing an update still needs its baseline `create` grant; declare
`update` as an additional requirement when the business action requires it.

`required: false` retains public/optional user authentication. Explicitly review
public declarations; setting `permissions` does not make optional auth mandatory.
With required auth, missing credentials return 401, missing grants return 403, and
missing verification configuration returns 503 before the handler.

This change preserves the `permissions` field and shape but tightens access:
existing routes that used `required: true, permissions: []` for login-only access
now require route grants. Assign the intended grants through role administration;
do not turn protected routes public to retain access. Existing explicit own-route
requirements can remain in the additional list.

Themes receive selected operation policies through Config Manager and verify the
user token before rendering permission-required menus. Unauthorized items and empty
groups are omitted from server output; client route metadata is projected separately
by access, including allowed routes absent from menus. Missing operation policy is
not treated as public. An explicit always-show menu setting remains a presentation
choice and grants no API authority. The full trusted service-origin map remains
available for credential routing, auth refresh and service fragments; filtering
route metadata does not promise to conceal service origins or public discovery.

The initial document can only use credentials in that request. With browser-managed
header authentication, the shell subsequently requests an authenticated navigation
projection. Login/logout and header changes replace both menus and route metadata;
late responses from an earlier auth state are discarded. Projections are `no-store`.
API checks remain authoritative for direct URLs and stale clients.

## Secrets

Service config fields can be marked as public, protected, or secret.

Secret values should be stored through service config APIs. They are encrypted at rest with a per-service key the service generates at install (256-bit, CSPRNG) and holds in its bootstrap state - it is not operator-configurable.

Provider credentials such as Authress API keys or WorkOS API keys belong in the auth service's encrypted app-scoped service config. Platform config stores bindings and non-secret auth metadata, not provider secrets.

Authress and WorkOS app config expose `loginUI` with `default`, `clean`, and `redirect`. `clean` only changes the BP-rendered login presentation; `redirect` auto-starts the same provider redirect flow from that clean presentation. It is not a WorkOS custom in-app credential flow.

For WorkOS, application/client credentials and webhook secrets are app-scoped service config. Tenant-level WorkOS defaults must not contain app/client credentials. WorkOS permission slugs use short `bp_<shortId>_<permission>` keys backed by the service's `workosStatePath` mapping file; labels include service title, app path, service path, route kind, methods, view id, and action. BP runtime authorization still reads mirrored `app.auth.roles`. WorkOS permission webhook events are not processed.

Service API keys are service identities, not admin identities. Config Manager accepts them only on explicit service-facing endpoints. Authoritative services may self-mutate only their own app binding: auth services can replace `app.auth.roles` for apps whose `app.auth.serviceId` is their tenant service id or shared activation id, and shell services can update visual theme config for apps whose `app.shell.serviceId` is their tenant service id or shared activation id. Every synced auth permission must reference an enabled route mounted on that app.

## CORS

Services only allow configured app origins. Normal browser context is resolved from Origin/Referer/effective host; standalone `X-BP-Tenant-Id` and `X-BP-App-Id` are ignored. Those headers establish context only in a verified S2S/delegated envelope. If the calling app or its shell manifest cannot be resolved, HTML requests return 406 rather than accepting a client-selected renderer.

Genuine browser preflight requests are handled by the shared `BPService` CORS middleware before route authentication. A valid preflight therefore does not require a user token. A denied preflight returns 403 with a stable diagnostic classification:

- `cors.context_unresolved` when no active app matches the Origin, Referer, or trusted host candidates;
- `cors.origin_denied` when an app resolves but does not allow the Origin;
- `cors.management_origin_denied` when a config-management request is not from a configured management origin;
- `cors.origin_missing` when an OPTIONS preflight has no Origin header.

Request spans include the Origin, requested method/headers, candidate hosts, configured app hosts, and allowed origins where applicable. These values explain why CORS failed without treating client-supplied tenant/app headers as trusted context. Do not move authentication ahead of this middleware or add a route-level OPTIONS handler merely to bypass a CORS failure.

When adding a service, make sure its `sec-config.yaml` points to the correct repo-level `bp-config.yaml`.

### Separate native protocol policies

Node BSB services may register independently authenticated protocol handlers through `registerProtocolEndpoint` in `onRegistered`; see [the service guide](../building/services.md#independently-authenticated-protocol-endpoints). Its explicit path/method/origin policy applies only to those handlers. It cannot shadow generated BP routes or BP authentication/management endpoints and never constructs a BP user or service context. Public non-credentialed wildcard CORS is limited to literal well-known GET/HEAD metadata. Other protocol origins are explicit; denied origins and unsupported preflights fail before invoking the native handler. Protocol credential validation and grant checks remain the handler owner's responsibility.

This is not a mechanism to allow an external assistant as a BP app origin, forward its token as a BP token, or weaken ordinary service CORS. Existing unregistered native callbacks retain the ordinary BP transport behavior; absence of a readable CORS response does not by itself prove that a simple cross-origin request was never handled. Protect native effects with their own authentication, resource and request checks.
