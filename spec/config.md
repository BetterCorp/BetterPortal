# Configuration

**Version:** `bp-protocol/1`

BetterPortal has **two** kinds of config:

1. **Platform config (`bp-config.yaml`)** — global state managed by the admin (`config-manager`) service. Defines tenants, apps, themes, routes, menus, fragments, service bindings. Read by every service that needs to resolve a request to a tenant/app.
2. **Per-service config** — settings each service exposes for tenants/apps to customize (e.g., an API key, a default greeting). Served via `/.well-known/bp/config*` endpoints.

This document specifies both.

---

## 1. Platform config

### 1.1 File location and discovery

The default file backend is referenced by each SDK's storage configuration. SDKs that support another backend MUST implement an equivalent provider that yields the same JSON-after-parse shape.

YAML is RECOMMENDED for human-edited deployments. JSON is allowed. The conformance suite uses YAML.

### 1.2 Top-level shape

```yaml
themes:           [<theme>, ...]
platformServices: [<platformService>, ...]
tenants:          [<tenant>, ...]
apps:             [<app>, ...]
configManagement: <configManagement>        # optional
```

### 1.2.1 Storage backends

The platform config store is modular. Backends MUST validate data against the same platform config schema before returning it.

| Backend | Behavior |
|---|---|
| `file` | Reads/writes the parsed YAML document at the configured file path. |
| `postgres` | Reads/writes one JSONB platform config document from a PostgreSQL table. |

Stores SHOULD read from their backing storage on each `loadConfig()` call. They MUST NOT depend on polling or filesystem watchers for correctness. Config changes are propagated by the config manager emitting a change event after a successful write; subscribers then reload from storage when they need the latest config.

The reference PostgreSQL backend stores one row:

```sql
create table if not exists bp_platform_config (
  id text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
```

The default row id is `default`. This is not full multi-tenant storage isolation; tenancy remains represented inside the platform config document until a finer-grained tenant store is introduced.

### 1.2.2 Config management metadata

`configManagement` is optional metadata for the admin/control-plane surface:

```yaml
configManagement:
  adminTenantId: betterportal
  auth:
    mechanism: none        # none | dev-token | jwt | oidc
    issuer: https://idp.example.com/
    audience: betterportal-admin
    requiredPermissions:
      - config.write
```

`adminTenantId` identifies the tenant that owns the admin surface. `auth` records the intended authentication mechanism. SDKs MAY enforce this metadata, but the metadata itself is not a tenant isolation model.

### 1.3 Theme

```yaml
themes:
  - id: bootstrap1                          # opaque id, [a-z0-9-]+
    hostname: http://localhost:3100         # absolute URL with scheme
    title: Bootstrap 1
    description: HTMX + Bootstrap 5 theme
    enabled: true
```

### 1.4 Shared services

`sharedServiceCatalog` defines platform-managed services that can be activated for tenants or apps. `sharedServiceActivations` creates the concrete service instance ids that apps reference.

The catalog id is stable for the shared provider. The activation id is the service instance id used by `app.shell.serviceId`, `app.auth.serviceId`, routes, slots, fragments, and role grants.

```yaml
sharedServiceCatalog:
  - id: service.betterportal.auth.default       # shared provider id
    serviceId: service.betterportal.auth.default # pluginId
    title: BetterPortal Default Auth
    baseUrl: http://localhost:3210
    apiKeyHash: <sha256 hex>                    # filled by install/redeem
    category: auth
    tags: [auth]
    enabled: true

sharedServiceActivations:
  - id: 019...                                  # activation/service instance id
    tenantId: betterportal
    appId: 019...                               # optional; absent = tenant-wide
    sharedServiceId: service.betterportal.auth.default
    activatedAt: 2026-05-20T00:00:00.000Z
    enabled: true
```

Legacy `platformServices` and `tenant.activatedPlatformServices` still exist for older platform bindings, but new shared auth/theme-style services SHOULD use `sharedServiceCatalog` plus `sharedServiceActivations`.

### 1.5 Tenant

```yaml
tenants:
  - id: betterportal                         # [a-z0-9][a-z0-9-]*, max 64
    slug: betterportal                       # URL-safe variant
    title: BetterPortal
    active: true
    branding:
      brandName: BetterPortal                # free-form key/value
    services:                                # tenant-scoped service bindings
      - id: hello-view                       # binding id (NOT pluginId)
        hostname: http://localhost:3200
        apiKeyHash: ""                       # sha256 hex; empty for dev
        serviceId: service.betterportal.hello-view   # pluginId
        title: Hello View
        deploymentMode: self-hosted | bp-hosted | customer-hosted
        createdAt: <iso>
        lastSeenAt: <iso>                    # optional
        enabled: true
    activatedPlatformServices: []            # legacy platformServices[] binding ids
```

### 1.6 App

```yaml
apps:
  - id: betterportal-web                     # [a-z0-9][a-z0-9-]*, max 64
    tenantId: betterportal
    slug: web
    title: BetterPortal Web
    hostnames: [localhost:3100]              # host(:port) values matched against Host header
    originOverrides: []
    refererOverrides: []
    themeId: bootstrap1
    themeConfig:                             # arbitrary; theme defines schema
      mode: system
      bootstrap: {...}
    defaultRoute: /
    routes:                                  # public path → service.view binding
      - id: hello                            # opaque
        path: /
        serviceId: hello-view                # tenant.services[].id or sharedServiceActivations[].id
        viewId: hello.index                  # pluginId-scoped viewId
        targetPath: /hello                   # path on the service
        title: Hello
        enabled: true
        methods: [GET]
    menu:                                    # tree; see fragment-html.md § 4 for events
      - id: m-hello
        type: link | group | external | section | divider
        title: Hello
        routeId: hello
        enabled: true
        children: []                         # only for type=group
    fragments:                               # location → list of fragment bindings
      nav:
        - serviceId: hello-view
          fragmentId: profile
          targetPath: /hello                 # public path on the service
          enabled: true
      footer: []
    slots: []                                # LEGACY — prefer fragments
```

### 1.7 Resolution rules

- A request's tenant+app is resolved by matching the `Host` header against `apps[].hostnames` (or `originOverrides`).
- The matched app's `routes[]` are searched in order; longest prefix wins.
- `routes[].targetPath` is the path the service is hit at; `route.path` is the public path.
- Services do not write `bp-config.yaml`. Only the admin service (`config-manager`) writes it.

---

## 2. Per-service config

Each service declares one or more **config schemas** in its manifest. Tenants and apps store values per schema via the config endpoints.

### 2.1 `GET /.well-known/bp/config/schema`

Returns the service's config surface:

```jsonc
{
  "serviceId": "<pluginId>",
  "mode": "static" | "dynamic" | "hybrid",
  "configSchemas": [ <ConfigSchemaDescriptor>, ... ],
  "supportsCustomUi": false,
  "customUiPath": "/.well-known/bp/config/ui",   // only if supportsCustomUi=true
  "supportsWrite": true
}
```

| Field | Meaning |
|---|---|
| `mode: static` | Schema is fixed; values come from `bp-config.yaml` directly. No read/write endpoints. |
| `mode: dynamic` | Schema is fixed but values live in the service. Read/write via the endpoints below. |
| `mode: hybrid` | Both — some fields static, some dynamic. |
| `supportsCustomUi` | Admin tooling SHOULD navigate to `customUiPath` instead of generating a form. |
| `supportsWrite` | If `false`, the POST endpoint returns `501`. |

`ConfigSchemaDescriptor` is defined in `manifest.md` § 3.

Config schema descriptors MAY include `groups[]` plus per-field `groupId`, `order`, and `defaultValue` metadata. These fields are UI metadata and do not change storage semantics: writes still persist only declared `fields[].key` values. Admin UIs SHOULD use `field.order` for deterministic display, render grouped fields together, and use `field.defaultValue` as the visible fallback when neither tenant nor app scope has a value. For app scope, `group.optional` MAY be rendered as a group-level override toggle that clears all fields in that group when disabled.

### 2.2 `GET /.well-known/bp/config`

Read tenant- and/or app-scoped values.

Request headers:

```
Authorization: Bearer <ticket>     ← see § 3
X-BP-Tenant-Id: <tenantId>
X-BP-App-Id: <appId>               ← optional; presence determines scope
```

Response:

```jsonc
{
  "serviceId": "<pluginId>",
  "tenantId": "<tenantId>",
  "appId": "<appId>",                  // present iff request included X-BP-App-Id
  "values": {
    "key": "value",
    "secretKey": "__redacted__"        // secret fields are always redacted on read
  }
}
```

Status codes:

- `200` — success.
- `401` — missing or invalid ticket.
- `403` — ticket valid but tenant/app scope mismatch.
- `404` — service does not implement `mode: dynamic` or `hybrid`.

### 2.3 `POST /.well-known/bp/config`

Write tenant- or app-scoped values.

Request body:

```jsonc
{
  "tenantId": "<must match X-BP-Tenant-Id and ticket>",
  "appId": "<optional; must match X-BP-App-Id if present>",
  "values": { "key": "value", ... }
}
```

- Only keys declared in the matching `ConfigSchemaDescriptor.fields[]` are persisted; unknown keys are silently dropped (or rejected with `400` at the service's discretion).
- Secret fields are encrypted at rest. The wire value is plaintext (TLS-protected) and the service encrypts on persist.
- An empty string value means "clear the field". To set a literal empty string, use `null` (and adjust the schema to allow null).
- A value of `"__redacted__"` for a secret field is interpreted as "keep existing"; the service does not overwrite.

Response on success:

```jsonc
{
  "ok": true,
  "serviceId": "<pluginId>",
  "tenantId": "<tenantId>",
  "appId": "<appId>",                  // if applicable
  "values": { ... }                    // current values after write, with secrets redacted
}
```

Services SHOULD emit `HX-Trigger: bp:config-saved` on successful writes so admin UIs can refresh.

### 2.4 Custom UI

If `supportsCustomUi: true`, the admin tooling navigates the user to `customUiPath` (rendered by the service) instead of generating a form from `configSchemas`.

Custom UI request:

```
GET <serviceOrigin><customUiPath>?tenantId=<id>&appId=<id>
```

The service returns a full HTML fragment ready to swap into `#bp-main`. The fragment is responsible for its own form posting (typically back to a service-internal save endpoint that wraps `POST /.well-known/bp/config`).

---

## 3. Config tickets

The `Authorization: Bearer` value used on `/.well-known/bp/config*` endpoints is a **config ticket**, NOT the user's session token.

Tickets are short-lived JWTs (or opaque equivalents) issued by the admin service on the user's behalf, scoped to:

- a `serviceId` (the target service)
- a `tenantId` and optional `appId`
- one or more `actions` from: `config.read`, `config.write`

### 3.1 Ticket claim shape (JWT)

```jsonc
{
  "iss": "<admin-service-pluginId>",
  "aud": ["<target-pluginId>"],
  "sub": "<user-or-admin-id>",
  "exp": <unix-seconds>,
  "iat": <unix-seconds>,
  "jti": "<unique-id>",
  "realm": "control-plane" | "runtime" | "<custom>",

  // BetterPortal-specific
  "tenantId": "<tenantId>",
  "appId": "<appId>",                       // optional
  "serviceId": "<target-pluginId>",
  "actions": ["config.read", "config.write"]
}
```

### 3.2 Verification

A service verifying a config ticket MUST:

1. Verify the JWT signature against the admin service's JWKS (`<admin-origin>/.well-known/jwks.json` or a configured static key in dev).
2. Check `exp > now` and `iat <= now`.
3. Check `aud` includes its own `pluginId`.
4. Check `serviceId` equals its own `pluginId`.
5. Check the requested action (`config.read` for GET, `config.write` for POST) is in `actions`.
6. Check `tenantId` and `appId` match the request's `X-BP-Tenant-Id` and `X-BP-App-Id` headers (and the body's `tenantId`/`appId` for POST).

Any failure → `401` (signature/exp/iat/aud) or `403` (scope mismatch).

### 3.3 Dev tokens

Config tickets are RS256 JWTs signed by the control plane's key and verified against its JWKS (§3.1). There is no shared signing secret — only the control plane can mint a ticket.

For local development a service MAY additionally accept a static bearer string equal to a configured `configApiToken`. This path is OFF by default and MUST be explicitly enabled with the environment variable `BP_ALLOW_DEV_CONFIG_TOKEN=true`; with it disabled (the default) the service rejects every request until it has been provisioned by the control plane. Because the static token lets the caller name an arbitrary tenant via `X-BP-Tenant-Id`, production deployments MUST NOT set `BP_ALLOW_DEV_CONFIG_TOKEN`. The reference SDKs ship no default `configApiToken`; the legacy world-known value `bp-dev-config-token` is no longer a signing key and grants nothing on its own.

---

## 4. Encryption at rest

Secret fields (`visibility: "secret"`) MUST be encrypted before persistence.

### 4.1 Algorithm

- Cipher: AES-256-GCM
- IV: 96 bits, random per encryption (NOT per service)
- Auth tag: 128 bits
- Key derivation: scrypt(`<encryptionKey>`, salt=`"bp-config-store"`, N=32768, r=8, p=1, len=32)
- Encoding: `enc:aes256gcm:<base64(iv || authTag || ciphertext)>`

### 4.2 Key management

The encryption key is per-service, configured via `configEncryptionKey` in `sec-config.yaml` (or the SDK's equivalent). It MUST be at least 16 characters. Rotation requires re-encrypting all stored values.

### 4.3 Redaction on read

`GET /.well-known/bp/config` returns `"__redacted__"` for secret fields regardless of caller. Admin tooling never sees the cleartext after write.

---

## 5. Conformance

A service implementing dynamic config:

- MUST serve `GET /.well-known/bp/config/schema`.
- MUST serve `GET /.well-known/bp/config` and `POST /.well-known/bp/config` (or return `501` if write-only or read-only).
- MUST validate tickets per § 3.2.
- MUST encrypt secret fields per § 4.
- MUST redact secrets on read.
- MUST NOT log cleartext values for secret fields.

See `conformance.md` for the test matrix.
