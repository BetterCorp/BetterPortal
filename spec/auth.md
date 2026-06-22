# Authentication & Authorization

**Version:** `bp-protocol/1`

BetterPortal has two authentication surfaces:

1. **View auth** — protecting user-facing routes. Standards-based (OIDC + JWT + JWKS).
2. **Config ticket** — protecting `/.well-known/bp/config*` admin endpoints. BetterPortal-specific (see `config.md` § 3).

Both use HTTP `Authorization: Bearer <token>` headers. **Neither uses cookies for cross-origin auth** — see `protocol.md` § 8.

---

## 1. View auth (user sessions)

### 1.1 Why standards-based

A BetterPortal-issued auth service is OPTIONAL. Any OIDC-compliant identity provider (Auth0, Keycloak, Authentik, Okta, custom) MAY be used, provided it emits ID tokens with the required claims (§ 1.3).

### 1.2 Token transport

Browser → service requests carry:

```
Authorization: Bearer <id-token>
```

The token is injected by the theme via HTMX `hx-headers` on the shell root, so every descendant fragment request inherits it. Browsers never store it in a cookie that crosses origins.

```html
<div data-bp-shell-root="" hx-headers='{"Authorization":"Bearer <id-token>"}'>
  ...
</div>
```

The theme is responsible for:
- Obtaining the ID token (via OIDC code flow against the IdP).
- Storing it (same-origin theme cookie, `localStorage`, or in-memory) — implementation choice.
- Refreshing it before expiry (using refresh tokens or silent re-auth).
- Setting the `hx-headers` attribute on the shell root.

### 1.3 ID token claims (RS256 JWT)

Required claims:

| Claim | Type | Meaning |
|---|---|---|
| `iss` | string | Issuer URL; MUST match the IdP's `issuer` from OIDC discovery. |
| `sub` | string | Subject (user) identifier. |
| `aud` | string \| string[] | Audience(s); MUST include the calling service's `pluginId` OR a configured audience. |
| `exp` | int | Expiration, unix seconds. |
| `iat` | int | Issued-at, unix seconds. |

Optional / BetterPortal-recognized claims:

| Claim | Type | Meaning |
|---|---|---|
| `realm` | string | Logical realm. Common values: `runtime` (end-user), `control-plane` (admin). |
| `tier` | string | User tier. Free-form; common: `public`, `user`, `admin`. |
| `permissions` | string[] | Permission tokens (see service manifest `permissions[]`). |
| `email`, `name`, etc. | string | Standard OIDC profile claims; optional. |

### 1.4 JWKS

The IdP exposes:

```
GET /.well-known/jwks.json
GET /.well-known/openid-configuration
```

Services verify ID tokens by fetching JWKS (cached, with TTL ≥ 5 minutes). The reference SDK uses `JwksVerifier` (see `framework/nodejs/src/runtime/jwksVerifier.ts`); other SDKs use their stack's equivalent (`jose`, `firebase/php-jwt + web-token`, `golang-jwt`, etc.).

### 1.5 Per-route policy: `ViewAuthRequirement`

Every view declares an `auth` block in its manifest:

```jsonc
{
  "required":   false,             // true → handler MUST see a verified claim set
  "realm":      "runtime",
  "minimumTier":"public",          // "public" | "user" | "admin" | <custom>
  "audiences":  [],                // additional required aud values
  "permissions":[]                 // required permission tokens
}
```

This is **declarative metadata only**. The protocol does not mandate enforcement; the SDK does it. A service MAY use a middleware that reads `auth.required` from the view's registry and rejects with `401` if no valid token, or `403` if a token is present but fails `realm` / `minimumTier` / `audiences` / `permissions` checks.

### 1.6 Tier ordering

If used, tiers form a total order. Reference order:

```
public  <  user  <  admin
```

A view's `minimumTier` MUST be satisfied by the token's `tier` (or implicitly inferred from `permissions`). Custom tiers MAY be added by extending the order; the order is configured globally (typically in `bp-config.yaml`'s admin section, TBD).

### 1.7 Failure responses

| Failure | Status | Body |
|---|---|---|
| No `Authorization` header | 401 | `{ "error": "unauthorized", "message": "Missing bearer token" }` |
| Token signature invalid | 401 | `{ "error": "invalid_token", "message": "Signature verification failed" }` |
| Token expired | 401 | `{ "error": "invalid_token", "message": "Token expired" }` |
| Audience mismatch | 401 | `{ "error": "invalid_token", "message": "Audience mismatch" }` |
| Auth context unavailable because scoped config has not synced | 503 | `{ "error": "service_unavailable", "message": "Auth context unavailable" }` |
| Insufficient tier | 403 | `{ "error": "forbidden", "message": "Required tier: admin" }` |
| Missing permission | 403 | `{ "error": "forbidden", "message": "Missing permission: orders.refund" }` |

For HTMX requests with `Accept: text/html`, the response MAY be HTML with `HX-Trigger: bp:auth-required` so the theme can show a login redirect.

### 1.8 Refresh

Services MAY return a hint header to nudge clients to refresh:

```
HX-Trigger: bp:auth-refresh-needed
```

The theme is responsible for refreshing the token and retrying. For BetterPortal-managed auth, the auth service URL is authoritative: derive the refresh request from the configured auth/login service origin, not from the theme origin or the service that returned 401. If refresh succeeds, retry the original safe request once; if it fails, clear the stored access token and show login.

---

## 2. Config tickets

Distinct from view auth. Used only on `/.well-known/bp/config*` endpoints. See `config.md` § 3 for the full spec.

Summary:

- Issued by the admin service (or a designated authority).
- JWT (RS256) with BetterPortal-specific claims: `tenantId`, `appId`, `serviceId`, `actions[]`.
- Verified by target services against the issuer's JWKS.
- Short-lived (≤ 5 minutes recommended).

---

## 3. Optional auth provider services

Reference auth services are provided under `services/nodejs/auth-default/` and `services/nodejs/auth-authress-io/`. `auth-default` is an OIDC-compliant identity provider that:

- Issues ID + refresh tokens (RS256 JWT).
- Exposes `POST /token` (credentials → tokens), `POST /refresh` (refresh → ID), `POST /revoke` (token → 204).
- Exposes `GET /.well-known/openid-configuration` and `GET /.well-known/jwks.json`.

Apps bind an auth provider through `app.auth.serviceId`. That value points at a tenant service id or shared-service activation id. Shared providers are registered in `sharedServiceCatalog` and bound through `sharedServiceActivations`; app config should not point directly at a plugin id or shared catalog id.

Auth provider implementations are not part of the protocol. A BetterPortal deployment that uses Authress, Auth0, Keycloak, or another provider is fully conformant when tokens and JWKS validation satisfy the app's auth metadata.

### 3.1 Custom claim shape (when using the reference auth service)

```jsonc
{
  "iss": "<auth-service-origin>",
  "sub": "<user-id>",
  "aud": ["<target-service-pluginId>", ...],
  "exp": <unix-seconds>,
  "iat": <unix-seconds>,
  "jti": "<unique-id>",

  "realm": "runtime",
  "tier": "user",
  "permissions": ["orders.read", ...],
  "tenant_id": "<tenantId>",                // optional; constrains the token's scope
  "app_id": "<appId>",                      // optional
  "email": "...",
  "name": "..."
}
```

---

## 4. Service-to-service auth

When a service needs to call another service's API directly (rare; the protocol prefers fragment composition):

- Use the **calling service's** API key (`apiKeyHash` in `bp-config.yaml`) to mint a short-lived service-to-service token via the auth service.
- OR use a configured shared secret with mTLS.

The protocol does not currently mandate a wire format for service-to-service tokens. SDKs MAY use OAuth2 client-credentials grant or any standards-based equivalent.

---

## 5. Cookies (theme-origin only)

Themes MAY use HttpOnly, Secure, SameSite=Lax cookies for **same-origin** purposes:

- Storing the refresh token (so a page reload survives without a re-login).
- Storing UI preferences (chosen theme mode, sidebar collapsed state).

These cookies are set on the theme's origin and are invisible to services. They are NOT a substitute for the `Authorization` header on service calls.

The reference SDK exports `parseCookieHeader`, `serializeCookie`, `serializeClearCookie` for this purpose.

---

## 6. Conformance

A service implementing view auth:

- MUST honor `Authorization: Bearer` on protected routes.
- MUST verify token signatures against the IdP's JWKS.
- MUST validate `exp`, `iat`, and `aud`.
- MUST emit `401` for missing/invalid tokens, `403` for scope failures.
- MUST NOT accept tokens via cookies on view routes.

A service implementing config endpoints:

- MUST follow `config.md` § 3 for ticket verification.

An IdP (whether the reference auth service or a third party):

- MUST serve `/.well-known/openid-configuration` and `/.well-known/jwks.json`.
- MUST issue RS256-signed JWTs with the required claims (§ 1.3).
- SHOULD support refresh tokens.

See `conformance.md` for the test matrix.
