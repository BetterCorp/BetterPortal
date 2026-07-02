# Auth Flow

Specification for BetterPortal authentication and authorization across services, apps, and themes.

This document supersedes `docs/platform/security-and-auth.md` once Phase 2 lands. Until then it is the design of record.

---

## Goals

- **Route-level, fail-safe**: auth is declared on the API route. If a route requires auth and the app forgets to configure an auth provider, the route does not run. Missing/invalid user credentials return 401; unavailable synced auth context returns 503 until the service is ready.
- **Stateless**: no server-side sessions. JWT in `Authorization: Bearer` header. Works across service boundaries with no shared state.
- **Theme-agnostic**: themes never read tokens or claims. They react to HTTP status. Auth providers are themselves services with views.
- **Provider-agnostic**: built-in default service is one option. Auth0, Keycloak, custom OIDC providers are interchangeable as long as they expose JWKS.
- **Strict tenant/app scope**: tokens are bound to a single (tenantId, appId) pair. Cross-binding requests always 401, even with a valid signature.
- **Defense in depth**: library verification is wrapped in a manual re-validation layer to neutralize known JWT library bugs.

## Non-goals

- Cross-app SSO. Apps live on separate hostnames; localStorage is per-origin. Cross-app navigation re-authenticates.
- Cookie-based session storage. Cross-origin cookies are blocked by browsers; we never rely on them.
- Centralized session revocation. Short token TTL + refresh flow handles revocation latency.

---

## Architecture overview

```
+------------+    Authorization: Bearer <jwt>   +--------------+
|  Browser   | ------------------------------- |   Service    |
|  + BP shim |                                  |   (any)      |
+------------+                                  +------+-------+
      |                                                |
      | (token in localStorage,                        | verifyJwt via JWKS
      |  attached per request)                         v
      |                                         +--------------+
      |  POST /auth/login                       |  Auth        |
      +----------------------------------------|  Provider    |
         BP-SetHeader: Authorization=...        |  Service     |
         (theme stores, attaches to next reqs)  +--------------+
                                                       |
                                          GET /.well-known/jwks.json
                                                       |
                                                  (RS256 pubkey)
```

- App config in config-manager declares `app.auth.serviceId` - which service issues tokens for this app.
- Login is a view on the auth service. Form is themed by the app's theme.
- Login handler signs a JWT (RS256, private key local to auth service), returns it via `BP-SetHeader` response header.
- Client-side BP shim stores the header in localStorage and attaches it to all subsequent requests on this origin.
- Each service verifies the JWT against the auth service's JWKS endpoint. Service enforces route-level requirements.

---

## 0.1 JWT claims

Required claims:

| Claim | Type | Purpose |
|-------|------|---------|
| `iss` | string | Issuer URL. Verifier checks against app config `expectedIssuer`. |
| `aud` | string \| string[] | Audience. Verifier checks against app config `expectedAudience`, which is derived from the selected BP auth service runtime metadata. |
| `exp` | number (unix seconds) | Expiry. Verifier rejects if `exp <= now`. |
| `iat` | number | Issued-at. |
| `nbf` | number (optional) | Not-before. Verifier rejects if `nbf > now`. |
| `sub` | string | User id. Opaque to framework. |
| `tenantId` | string | Tenant binding. Must match request tenant. |
| `appId` | string | App binding. Must match request app. |
| `roles` | string[] | Role names. Resolved via `app.auth.roles[]` to permissions. |

Optional claims:

| Claim | Type | Purpose |
|-------|------|---------|
| `jti` | string | Token id. Used for refresh-token revocation lists. |
| `name` | string | Display name. For UI convenience. |
| `email` | string | Display email. For UI convenience. |
| `picture` | string | Avatar URL. For UI convenience. |

**Algorithm**: RS256 only. HS256 is rejected. `alg: none` is rejected. The verifier hardcodes the allowed algorithm list and never reads `alg` from the token header to choose verification mode.

---

## 0.2 App config schema

Added to `framework/nodejs/src/contracts/platformConfig.ts`:

```ts
export const AppAuthRoleSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  permissions: av.array(av.object({
    serviceId: av.string().minLength(1),
    viewId: av.string().minLength(1),
    permissions: av.array(av.enum(["read", "create", "update", "delete"])).minItems(1)
  }))
});
export type AppAuthRole = Infer<typeof AppAuthRoleSchema>;

export const AppAuthConfigSchema = av.object({
  serviceId: av.string().minLength(1),         // which service is the auth provider
  loginViewId: av.optional(av.string()),       // view id on the auth service (not a path)
  logoutViewId: av.optional(av.string()),
  refreshViewId: av.optional(av.string()),
  expectedIssuer: av.string().minLength(1),
  expectedAudience: av.string().minLength(1),
  roles: av.array(AppAuthRoleSchema).default([])
});
export type AppAuthConfig = Infer<typeof AppAuthConfigSchema>;
```

`loginViewId` / `logoutViewId` / `refreshViewId` are **view ids**, not URL paths. The framework resolves them to paths at render time via the synced route registry. This is so admins can rename URLs without touching auth config. The view-id resolver is a separate refactor tracked outside this spec.

Roles store permissions as `[{ serviceId, viewId, permissions: [crud...] }]`. Each permission entry binds a specific role grant to a specific API endpoint and CRUD action set. Services receive these via app config sync and use them to authorize requests.

`expectedIssuer`, `expectedAudience`, and `jwksUri` are internal verifier fields. Auth provider services publish them through `registerAsAuthProvider({ issuer, audience, jwksUri, jwks })`, and config-manager writes them onto app auth bindings when the service is installed, synced, or selected. UI users should not manually configure those BP-token verifier values. Provider-specific settings, such as Authress API URL, application id, API keys, and external token settings, remain service config and are separate from BP runtime token verification.

**Config-manager is dumb storage.** It does not understand permissions, roles, or users. It serializes the schema as-is. Mutations come from auth-service admin UI via HTTP POST to config-manager.

---

## 0.3 Service responsibilities

### Every service

- Verify JWT on incoming requests when `route.auth.required === true`.
- Enforce tenant/app match against request context.
- Enforce route permissions against `app.auth.roles[]` map.
- Strip unknown request headers (already default via `unknownKeys: "strip"` on header schema).

### Auth provider service

- Expose `/.well-known/jwks.json` returning current public keys (RS256, jwks-rsa format).
- Expose login view. Returns `BP-SetHeader: Authorization=Bearer <jwt>` on success.
- Expose logout view. Returns `BP-RemoveHeader: Authorization`.
- Expose refresh view on the auth service origin. It returns `BP-SetHeader: Authorization=...` so the shell can refresh without auth-specific JSON handling.
- Provide a nav fragment that includes JavaScript to schedule auto-refresh before token expiry.
- Sign JWTs with RS256 private key held locally. Never share the private key.
- Optionally expose `/.well-known/openid-configuration` for OIDC discovery.

### Permission Manager UI (admin app)

- Reads service manifests via control plane to assemble the canonical permission catalog (`PluginManifest.permissions[]` + per-view CRUD declarations).
- Renders UI for an admin to define `app.auth.roles[]` and assign permissions.
- POSTs role definitions to config-manager as part of app config.
- **Display-only catalog**. Not stored as canonical truth - services own their manifest, this UI just aggregates.

### Auth service admin UI (out-of-tree)

- Manages user records. Owned entirely by the auth service.
- Fetches role list from config-manager (the canonical app role registry).
- Stores per-user role assignments in the auth service's own database.
- At login: looks up user -> reads role assignments -> builds JWT with `roles: [...]` claim.

---

## 0.4 Header transport

### Context API

Handlers manipulate response headers via `ctx.bpHeaders`:

```ts
ctx.bpHeaders.set("Authorization", "Bearer eyJ...", {
  locked: true,                    // only this service may overwrite or remove
  expiresInSeconds: 900,           // client auto-removes after this many seconds
  refreshPath: "/refresh",         // optional service endpoint for shell refresh
  refreshBeforeSeconds: 60         // optional pre-expiry refresh window
});

ctx.bpHeaders.set("X-Feature-Flag", "on", {
  locked: false                    // any service may overwrite
});

ctx.bpHeaders.set("X-Service-Scope", "tenant-abc", {
  scopeServiceId: ctx.serviceId    // sent only to this service, not globally
});

ctx.bpHeaders.remove("Authorization");
```

### Wire format

Framework emits as HTTP response headers (multiple `BP-SetHeader` allowed):

```
BP-SetHeader: Authorization=Bearer eyJ...; locked=true; expires=1735689600; refresh=/refresh; refreshBefore=60
BP-SetHeader: X-Feature-Flag=on
BP-SetHeader: X-Service-Scope=tenant-abc; scope=service.foo
BP-RemoveHeader: Authorization
```

- `expires` is unix seconds (absolute, computed framework-side from `expiresInSeconds`). Client auto-removes when `Date.now()/1000 >= expires`.
- `locked=true` means only the setting service may remove or overwrite.
- `scope=service.foo` means the header is only attached to subsequent requests to that service.
- `refresh=/path` means the shell may POST that service-relative endpoint before expiry, with current live BP headers attached, and apply any returned `BP-SetHeader`/`BP-RemoveHeader` directives.
- `refreshBefore=60` controls how many seconds before expiry the shell attempts proactive refresh. If absent, the shell uses its default policy.
- Absent `expires` = persists until logout, page reload that clears localStorage, or explicit removal.

### Client storage

```js
localStorage["bp.headers"] = {
  "Authorization": {
    value: "Bearer ...",
    owner: "service.auth.default",   // service id from request response origin
    locked: true,
    expires: 1735689600,
    scope: null,                     // null = global to this app
    refresh: "/refresh",
    refreshBefore: 60
  },
  "X-Service-Scope": {
    value: "tenant-abc",
    owner: "service.foo",
    locked: false,
    expires: null,
    scope: "service.foo"
  }
}
```

### Client per-request logic

On every BP-managed fetch/HTMX request:

1. Walk stored headers.
2. Drop any where `expires !== null && expires <= now`. Update localStorage.
3. Proactively refresh headers with refresh metadata before expiry by POSTing the owning service.
4. Filter by `scope === null || scope === targetServiceId`.
5. Attach as request headers.

### Removal rules

- `BP-RemoveHeader: X` in a response -> check `stored[X].owner === responseServiceId || stored[X].locked === false`. Drop if condition holds. Ignore otherwise (logged as warning).
- Manual logout flow always succeeds because the auth service is the owner.
- BSB framework client can force-remove any header (e.g., on session reset).

### Cross-cutting concerns

- **CORS**: services allow the `BP-*` prefix wildcard in `Access-Control-Allow-Headers` and expose it in `Access-Control-Expose-Headers`. Standard headers (`Authorization` etc.) are added via the route's declared `headers` schema, which feeds the per-route preflight allowance.
- **localStorage budget**: total stored headers capped at ~8KB per app (cookie-equivalent). Exceed -> oldest non-locked headers dropped.
- **localStorage race**: last-write-wins. Concurrent requests are fine because services should not race on the same header name. Locking prevents the case that matters (auth).
- **BP UI knows nothing about tokens**. It manages the header store as opaque key/value pairs. Token expiry timing and refresh scheduling are driven by JavaScript provided by the auth service's nav fragment.

---

## 0.5 Validation order

The adapter (`framework/nodejs/src/adapters/h3.ts`) inserts an auth resolver step between input parsing and handler invocation:

```
1. Read Authorization header.
   absent + route.auth.required=false -> ctx.user = null, continue to handler
   absent + route.auth.required=true  -> 401, render status view, stop

2. Resolve auth context from synced app config.
   unavailable + route.auth.required=false -> ctx.user = null, continue to handler
   unavailable + route.auth.required=true  -> 503, render status view, stop

3. Verify JWT signature via JWKS for app.auth.serviceId.
   Hardcoded algorithms: ["RS256"]. Never read alg from token.
   fail -> 401 if required else ctx.user = null, continue

4. Verify standard claims (exp, nbf, iss, aud).
   fail -> 401 if required else ctx.user = null, continue

5. Double-verify (defense in depth; see 0.7).
   Re-parse header, re-check alg/typ, re-check exp/nbf/iss/aud, re-check required custom claims.
   fail -> 401 if required else ctx.user = null, continue

6. Verify claims.tenantId === request __bpTenantId.
   fail -> 401 if required else ctx.user = null, continue

7. Verify claims.appId === request __bpAppId.
   fail -> 401 if required else ctx.user = null, continue

8. Resolve route.auth.permissions[] against claims.roles via app.auth.roles[].
   Each route.auth.permissions[] entry is { serviceId, viewId, permissions: [...] }.
   For required permissions, check at least one of claims.roles maps to that entry.
   fail -> 403 if required else ctx.user = null, continue

9. Attach ctx.user = validated claims. Invoke handler.
```

**Critical invariant**: `ctx.user` is either fully populated or `null`. Never partial. Handlers using `ctx.user` can trust every field is present and validated.

**Optional auth pattern**: `route.auth.required = false` lets handlers run for both anonymous and authenticated users. The handler checks `if (ctx.user) { ... }`. Useful for views that show different content based on login state.

---

## 0.6 Status views

A view file named `view.{code}.tsx` adjacent to `view.tsx` is rendered when the route returns that status code. Any HTTP status code is supported - 401, 403, 404, 418, 500, anything.

Resolution order on status code N:

```
1. route.viewRenderers[N] for current theme (i.e., adjacent file view.N.tsx with matching theme)
   present -> render, return body with status N

2. app.statusViewIds[N] (optional app config - points to a view on any service)
   present -> fetch that view, render, return body with status N

3. theme default status renderer for N (themes ship 401/403/404/500 generics)
   present -> render, return body with status N

4. framework JSON fallback
   { error: "Status N" } with status N
```

For 401 specifically, themes may also redirect:

```
If route.viewRenderers[401] absent
   AND app.statusViewIds[401] absent
   AND theme has 401 renderer
   AND request is an HTMX/page navigation (not JSON/SSE)
   AND app.auth.loginViewId is configured
-> respond with HTMX redirect (HX-Redirect header) to loginViewId resolved path with ?next=<current>
```

This lets the theme auto-redirect to login when no service-specific or app-specific 401 page exists. Pure-JSON clients (mobile, API consumers) always get JSON 401, never redirects.

On a 401 from a main-content request, the shell attempts a forced refresh for stored headers that advertise refresh metadata, then retries the original GET once. The refresh endpoint is owned by the service that set the header, receives the currently live BP headers, and returns normal `BP-SetHeader`/`BP-RemoveHeader` directives. Only if refresh fails does the shell clear `Authorization` and load the login view into `#bp-main`.

Fragments must not manage BP header storage directly. They can render navigation/profile UI, but header lifecycle belongs to the shell.

---

## 0.7 Attack mitigations

### `alg: none`

Library configured with `algorithms: ["RS256"]` only. Manual re-parse rejects anything else as a second layer.

### Algorithm confusion (HS256 with RS256 pubkey)

Same mitigation. The verifier never reads `alg` from the token to choose verification mode - the algorithm is hardcoded by the caller's config.

### `kid` injection / path traversal

JWKS lookup is performed only via jwks-rsa client against the configured JWKS URL. The verifier never uses `kid` as a filesystem path or arbitrary URL. `kid` format is validated against `^[A-Za-z0-9_-]+$` before lookup.

### `jku` / `x5u` header trust

Both are ignored. JWKS URL is derived solely from `app.auth.serviceId` resolved to the service's published JWKS endpoint at the host known via control-plane sync.

### Weak HMAC secret brute force

RS256 only. No HS256 code path in production verifiers.

### Missing or future expiry

Manual layer rejects tokens with missing `exp`, with `exp <= now`, or with `nbf > now`. Library does this too - manual layer is defense in depth.

### Token replay (window before exp)

Short access-token TTL (default 15 minutes). Refresh token JWT with separate `jti` and 7-day TTL. Auth services may maintain a `jti` revocation list for forced logout.

### Public claims tampering

JWT payload is signed but not encrypted. Design: never put secrets in claims. Role names, ids, and display fields only.

### CSRF

Not applicable - no cookies, no session. Bearer header is immune to CSRF since browsers do not auto-attach `Authorization` headers cross-origin.

### Double verification (the meta-mitigation)

After library verification succeeds, the framework re-parses the JWT header and payload from scratch and re-checks every constraint. Catches library bugs, downgrade attacks the lib missed, and ensures required custom claims exist with the right types. Cheap insurance.

```ts
function safeVerifyJwt(token, jwksClient, opts) {
  // Layer 1: library verify
  const claims = jwt.verify(token, getKey(jwksClient), {
    algorithms: ["RS256"],
    issuer: opts.issuer,
    audience: opts.audience,
    complete: false
  });

  // Layer 2: manual header re-parse
  const [headerB64] = token.split(".");
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  if (header.alg !== "RS256") throw new Error("alg mismatch");
  if (header.typ !== "JWT") throw new Error("typ mismatch");

  // Layer 3: manual claim re-check
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("expired");
  if (claims.nbf && claims.nbf > now) throw new Error("not yet valid");
  if (claims.iss !== opts.issuer) throw new Error("iss mismatch");
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(opts.audience)) throw new Error("aud mismatch");

  // Layer 4: required custom claims present + typed
  if (typeof claims.tenantId !== "string") throw new Error("tenantId missing");
  if (typeof claims.appId !== "string") throw new Error("appId missing");
  if (!Array.isArray(claims.roles)) throw new Error("roles missing");
  if (claims.roles.some(r => typeof r !== "string")) throw new Error("roles invalid");

  return claims;
}
```

---

## 0.8 Permission Manager UI

Lives in the admin app (probably `services/nodejs/admin/config-manager` or a sibling service).

### Reads

- All service manifests via control-plane sync (`PluginManifest.permissions[]` and per-view CRUD declarations from `route.auth.permissions[]`).
- Current `app.auth.roles[]` for the app being edited.

### Writes

- Mutates app config in config-manager via existing config write API.
- Config-manager stores opaque payload. No interpretation.

### UI flow

1. Admin selects an app.
2. UI shows available services and per-service available views with CRUD permissions.
3. Admin defines roles by name and assigns `{ serviceId, viewId, permissions: [crud...] }` entries.
4. POST to config-manager.
5. Services sync the updated app config; new role definitions take effect on next request (per-service cache TTL).

### Auth service admin UI (separate concern)

The auth provider's own admin UI manages users and assigns role names. It fetches the canonical role list from config-manager's read API and stores per-user role assignments in the auth service's own database.

---

## Phase plan

### Phase 0 - Spec (this document)

Lock the contract before any code lands. Done when this file is reviewed and signed off.

### Phase 1 - Token verifier core

Files:

- `services/nodejs/auth-default/src/tokens.ts` - rewrite for RS256 + `jsonwebtoken` + `jwks-rsa` + manual double-verify layer. Remove HS256 path.
- `services/nodejs/auth-default/src/jwks.ts` - per-(issuer, jwksUri) cached jwks-rsa client with kid format validation.
- `services/nodejs/auth-default/src/keypair.ts` - helper to generate/load RS256 keypairs (PEM) for auth provider services.
- `services/nodejs/auth-default/src/index.ts` - export `verifyJwt`, `signJwt`, `JwtClaimsSchema`, `generateKeyPair`.
- `services/nodejs/auth-default/tests/tokens.test.ts` - exhaustive JWT validation tests (see test list below).

Adds dependencies to `services/nodejs/auth-default/package.json`: `jsonwebtoken`, `jwks-rsa`, `bcrypt`, `@types/jsonwebtoken`, `@types/bcrypt`.

#### JWT validation test list

- Valid RS256 token -> returns claims.
- `alg: none` token -> rejected.
- HS256 token signed with RS256 pubkey as secret -> rejected.
- Wrong RSA signature -> rejected.
- Expired token (`exp <= now`) -> rejected.
- Future token (`nbf > now`) -> rejected.
- Missing `exp` claim -> rejected.
- Missing `iss` claim -> rejected (or wrong `iss`).
- Wrong `aud` -> rejected.
- Missing `tenantId` claim -> rejected.
- `tenantId` not a string -> rejected.
- Missing `appId` claim -> rejected.
- Missing `roles` claim -> rejected.
- `roles` not an array -> rejected.
- `roles[N]` not a string -> rejected.
- Tampered payload (signature mismatch) -> rejected.
- Malformed JWT (not three parts) -> rejected.
- `kid` with traversal characters -> rejected before JWKS lookup.
- Token with `jku` header pointing to attacker URL -> ignored, default JWKS used.
- Token with `typ` field absent or wrong -> rejected.

### Phase 2 - Route auth contract + adapter enforcement

Files:

- `framework/nodejs/src/contracts/route.ts` - add `ApiAuthRequirement` separate from `ViewAuthRequirement`. `permissions` field shape: `[{ serviceId, viewId, permissions: ("read"|"create"|"update"|"delete")[] }]`.
- `framework/nodejs/src/contracts/platformConfig.ts` - add `AppAuthConfigSchema` + `AppAuthRoleSchema` (see 0.2).
- `framework/nodejs/src/adapters/h3.ts:handleRouteRequest` - insert auth resolver between input parse and handler invoke. Implements steps 1-8 from section 0.5.
- `framework/nodejs/src/contracts/route.ts:RouteHandlerContext` - add `user?: ValidatedClaims` and `bpHeaders: BpHeadersApi` and `serviceId: string`.
- `framework/nodejs/src/runtime/statusViews.ts` - status view resolver per section 0.6.

Tests:

- `required:false` + no token -> handler runs, `ctx.user` null.
- `required:false` + invalid token -> handler runs, `ctx.user` null (not partial).
- `required:true` + valid token wrong tenant -> 401.
- `required:true` + valid token wrong app -> 401.
- `required:true` + valid token missing permission -> 403.
- 401 with `view.401.tsx` present -> renders themed page with 401 status.
- 401 with no view + HTMX request + loginViewId set -> 200 OK with HX-Redirect header.
- 401 with no view + JSON request -> JSON 401.

### Phase 3 - Header transport

Files:

- `framework/nodejs/src/runtime/bpHeaders.ts` - implements the `BpHeadersApi` (set/remove with options).
- `framework/nodejs/src/adapters/h3.ts` - collect bpHeaders from ctx after handler, emit `BP-SetHeader`/`BP-RemoveHeader` response headers.
- `framework/nodejs/src/runtime/cors.ts` - auto-add `BP-*` wildcard to allowed/exposed headers.
- `themes/nodejs/bootstrap1/src/.../client-headers.js` - client-side shim: storage, attachment, removal, expiry checks.

Tests:

- Service A locks Authorization -> service B's response with `BP-RemoveHeader: Authorization` is ignored.
- Scoped header only attached to declared service requests.
- Expired header dropped on next request.
- Unknown response header from service stripped (not stored).

### Phase 4 - Auth provider helper

Files:

- `plugins/nodejs/betterportal-bsb/src/service.ts` - `registerAsAuthProvider({ issuer, audience, jwksUri, jwks })` publishes BP runtime verifier metadata and exposes `/.well-known/jwks.json` on the service's H3 app.

### Phase 5 - Basic auth service (reference implementation)

Replaces scaffold `services/nodejs/auth-default/src/plugins/service-betterportal-auth-default/`.

Files:

- `service.ts` - extends BPService, calls `registerAsAuthProvider`, mounts user db + login/logout/refresh views.
- `userStore.ts` - file-backed user store with bcrypt password hashing. Pluggable via service config.
- `bp-routes/login/index.ts` metadata, `GET.ts` login form model, `POST.ts` login submit handler, `_theme.bootstrap1/GET.tsx` renderer.
- `bp-routes/logout/index.ts` metadata plus `GET.ts`/`POST.ts` handlers clearing `Authorization` via `BP-RemoveHeader`.
- `bp-routes/refresh/index.ts` metadata plus `POST.ts` handler verifying refresh token and issuing a new access token.
- `bp-routes/login/_theme.bootstrap1/_nav.profile.GET.tsx` - nav fragment with user display.

Tests:

- Login with valid creds -> 200 + `BP-SetHeader: Authorization=...`.
- Login with wrong password -> 401.
- Login with unknown user -> 401 (same message, no enumeration).
- Refresh with valid refresh token -> 200 + new access token.
- Refresh with expired refresh token -> 401.

### Phase 6 - Permission Manager UI (admin)

New routes in `services/nodejs/admin/config-manager` or sibling service. Aggregates perms from control-plane manifests; UI to compose roles; POSTs to config-manager app config.

### Deferred - View-id resolver

Separate refactor. App config + theme rendering switch from URL paths to view ids. Tracked but not in auth scope.

---

## Order rationale

- Phase 0 first: changes after code = pain.
- Phase 1 standalone - verifier + tests land without integration risk.
- Phase 2 needs Phase 1. Once enforcement is wired, auth gates work.
- Phase 3 independent of auth - general-purpose header transport. Auth is the first consumer.
- Phase 4 thin wrapper over Phase 1 sign path.
- Phase 5 end-to-end reference. Validates the full flow.
- Phase 6 admin tooling - needs the rest working.

---

## Open items (deferred)

- Multi-app SSO within same tenant. Not in V1 because apps live on separate origins.
- Cross-service refresh-token revocation. Per-service jti revocation lists are out of scope; rely on short TTL.
- Optional auth providers exposing `/.well-known/openid-configuration` for OIDC discovery. Useful for third-party clients but not required for BetterPortal-internal flows.
- View-id refactor (paths -> ids in app config). Required for cleanest `loginViewId`/`logoutViewId` UX. Tracked separately.
