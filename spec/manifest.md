# BetterPortal Manifest

**Version:** `bp-protocol/2`
**Endpoint:** `GET /.well-known/bp/manifest`
**Content-Type:** `application/json`

The manifest is a service's self-description. Themes and admin tooling read it to discover routes, views, fragments, components, config schemas, and capabilities.

## Top-level shape

```jsonc
{
  "protocolVersion": 2,
  "pluginId": "org.betterportal.<name>",
  "title": "<human title>",
  "description": "<short description>",
  "version": "1.0.0",
  "category": "service" | "theme" | "auth" | "<custom>",
  "deploymentModes": ["self-hosted", "bp-hosted", "customer-hosted"],
  "capabilities": ["<capability-token>", ...],
  "supportedRenderers": ["bootstrap5", "embedded"],
  "shell": {
    "service": "bootstrap1",
    "renderer": "bootstrap5",
    "fragments": []
  },
  "supportedRenderModes": ["page", "fragment", "embed"],
  "views": [ <view>, ... ],
  "configSchemas": [ <configSchema>, ... ],
  "permissions": [ <permission>, ... ],
  "adminApis": [ <adminApi>, ... ],
  "developerResources": [ <developerResource>, ... ],
  "cacheHints": {
    "metadataTtlSeconds": 300
  }
}
```

### Required fields

| Field | Type | Notes |
|---|---|---|
| `protocolVersion` | int | Match this document's version. |
| `pluginId` | string | Reverse-DNS, lowercase. See `protocol.md` section 5.1. |
| `title` | string | Display title. |
| `version` | semver string | Service version, NOT protocol version. |
| `views` | array | Empty array if no views (e.g., a pure auth service). |

### Optional fields

| Field | Type | Notes |
|---|---|---|
| `description` | string | Markdown allowed but tooling MAY treat as plain text. |
| `category` | string | Free-form. Common values: `service`, `theme`, `auth`. |
| `deploymentModes` | string[] | Where this service can run. |
| `capabilities` | string[] | Free-form capability tokens (e.g., `theme.shell`, `theme.htmx`, `view.json`). |
| `supportedRenderers` | string[] | Renderer compatibility keys implemented by this service's views. |
| `shell` | object | Present only for shell services. Declares stable shell `service`, view `renderer`, and fragment definitions. |
| `supportedRenderModes` | string[] | `page`, `fragment`, `embed`. |
| `configSchemas` | array | Per-service config descriptors (see section 3). |
| `permissions` | array | Permission strings this service defines (see `auth.md`). |
| `adminApis` | array | Admin-only endpoints surfaced for tooling. |
| `developerResources` | array | Public guides, templates, skills, or examples (see section 7). |
| `cacheHints.metadataTtlSeconds` | int | How long clients MAY cache this manifest. |

## 1. View shape

Each entry in `views[]`:

```jsonc
{
  "viewId": "hello.index",
  "title": "Hello View",
  "description": "...",
  "path": "/hello",
  "paramsSchema": { ... },            // anyvali-style JSON descriptor
  "operations": [{
    "operationId": "hello.read",
    "method": "GET",
    "title": "Read hello",
    "description": "...",
    "querySchema": { ... },
    "headersSchema": { ... },
    "bodySchema": { ... },
    "jsonResponseSchema": { ... },
    "metadataResponseSchema": { ... },
    "html": { "renderers": { ... } },
    "auth": { <ApiAuthRequirement> },
    "dependencies": [],
    "demoScenarios": [ <demo>, ... ],
    "cacheHints": { "ttlSeconds": 60, "varyBy": ["accept", "origin"] }
  }]
}
```

### View field rules

- `viewId` is unique per service. Convention: `<routeDir>.<filename>` (e.g., `hello.index`).
- `path` MUST start with `/`. Path parameters use `:name` syntax: `/orders/:orderId`.
- `operations` contains at least one method-specific contract. Every `operationId` is unique across the service.
- `viewId` and the service path group operations; `operationId` is the identity used by app allowlists, dependencies, and generated client functions.
- Query/header/body/response schemas, auth, renderers, dependencies, chrome, SEO, contracts, and cache policy are operation-owned. They MUST NOT be flattened across methods.
- Titles are display metadata and MUST NOT be used as identity.

### Renderer slot semantics

| slotId pattern | meaning |
|---|---|
| `"main"` | Primary content area. Inserted into the theme's `#bp-main` element. |
| `"<location>.<fragmentId>"` | Fragment for the given shell location (e.g., `nav.profile`, `footer.copyright`). |
| `"<componentId>"` (no dot) | Named component, addressable via `?_c=<componentId>`. |

## 2. cacheHints

```jsonc
{
  "ttlSeconds": 60,
  "varyBy": ["accept", "origin", "referer"]
}
```

`ttlSeconds: 0` disables caching. `varyBy` lists request facets that affect the response; clients translate this into a `Vary` response header.

## 3. configSchemas

Per-service descriptors for the config UI. Each schema describes a settings surface (tenant- or app-scoped).

```jsonc
{
  "id": "hello.tenant",
  "title": "Hello Tenant Config",
  "description": "Tenant-scoped settings for the hello service.",
  "scope": "tenant" | "app",
  "jsonSchema": { ... },              // flat key->type map (informational)
  "groups": [
    {
      "id": "connection",
      "title": "Connection",
      "description": "...",
      "order": 10,
      "optional": false
    }
  ],
  "fields": [
    {
      "key": "apiKey",
      "title": "API Key",
      "description": "...",
      "scope": "tenant",
      "visibility": "secret" | "protected" | "public",
      "ownership": "plugin" | "bp" | "mixed",
      "sourceOfTruth": "plugin" | "bp",
      "groupId": "connection",
      "order": 10,
      "defaultValue": "",
      "required": false
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `visibility: secret` | Value is encrypted at rest and redacted on read (`"__redacted__"`). |
| `visibility: protected` | Value is plaintext but only readable with a valid config ticket. |
| `visibility: public` | Anyone can read. |
| `ownership: plugin` | The service controls the value; bp-config holds a reference only. |
| `ownership: bp` | bp-config is the source of truth; the service mirrors it. |
| `ownership: mixed` | Either side can write. |
| `groups[]` | Optional UI grouping metadata. Unknown `field.groupId` values are rendered as their own group. |
| `group.optional` | Admin UIs MAY expose one control that enables/disables app overrides for every field in the group. |
| `field.order` | Optional deterministic display order within its group. |
| `field.defaultValue` | Optional UI/default fallback when no tenant/app value exists. |

See `config.md` for the read/write protocol.

## 4. Schema descriptor format

Schemas in the manifest (`paramsSchema`, `querySchema`, `headersSchema`, `bodySchema`, `jsonResponseSchema`, `metadataResponseSchema`) use a small, portable JSON descriptor. The Node SDK derives these from `anyvali` schemas; other SDKs derive them from their native validators.

Top-level wrapper:

```jsonc
{
  "anyvaliVersion": "1.0",
  "schemaVersion": "1",
  "root": <node>,
  "definitions": {},
  "extensions": {}
}
```

`anyvaliVersion` exists for historical reasons (the Node SDK uses anyvali); other SDKs MAY ignore it but MUST emit it.

### Node shapes

```jsonc
// Object
{ "kind": "object",
  "properties": { "name": <node>, ... },
  "required": ["name"],
  "unknownKeys": "strip" | "passthrough" | "strict" }

// Array
{ "kind": "array", "items": <node>, "minItems": 1, "default": [] }

// Scalars
{ "kind": "string", "minLength": 1, "maxLength": 100, "format": "url" | "email" | ..., "default": "..." }
{ "kind": "int",    "min": 0, "max": 99, "default": 0 }
{ "kind": "bool",   "default": false }

// Optional / nullable
{ "kind": "optional", "inner": <node> }
{ "kind": "nullable", "inner": <node> }

// Union
{ "kind": "enum", "values": ["a", "b"] }
{ "kind": "union", "options": [<node>, ...] }

// Record (map with string keys)
{ "kind": "record", "valueSchema": <node>, "default": {} }
```

SDKs MUST be able to round-trip a schema through this format (parse the manifest's descriptor, validate input against it). They MAY support additional `kind` values via `extensions`, but those are non-normative.

## 5. permissions

Free-form strings the service understands. Surfaced so admin tooling can assign them to roles.

```jsonc
[
  { "id": "config.write",    "title": "Edit configuration",     "description": "..." },
  { "id": "orders.refund",   "title": "Refund orders",          "description": "..." }
]
```

Per-view requirements reference these IDs in `auth.permissions` (see `auth.md`).

## 6. adminApis

Endpoints that exist outside the main view set, surfaced for admin tooling discovery:

```jsonc
[
  {
    "id": "config.schema",
    "title": "Config Schema",
    "description": "...",
    "path": "/.well-known/bp/config/schema",
    "methods": ["GET"],
    "supportsCustomUi": false
  },
  {
    "id": "config.values",
    "title": "Config Values",
    "description": "...",
    "path": "/.well-known/bp/config",
    "methods": ["GET", "POST"],
    "supportsCustomUi": true,
    "customUiPath": "/.well-known/bp/config/ui"
  }
]
```

`supportsCustomUi: true` tells admin tooling to navigate to `customUiPath` instead of generating a form from `configSchemas`.

## 7. developerResources

Developer resources make service- or theme-specific implementation guidance discoverable without inventing another package format:

```jsonc
[
  {
    "id": "ui.guide",
    "kind": "guide",
    "title": "Bootstrap1 UI guide",
    "description": "Layout, component, and accessibility rules.",
    "mediaType": "text/markdown; charset=utf-8",
    "content": "# Bootstrap1 UI guide\n..."
  },
  {
    "id": "ui.page-template",
    "kind": "template",
    "title": "Page renderer template",
    "mediaType": "text/plain; charset=utf-8",
    "language": "typescript",
    "content": "..."
  }
]
```

| Field | Rules |
|---|---|
| `id` | Stable lowercase dotted identifier; URL-safe and unique within the service. |
| `kind` | `guide`, `template`, `skill`, or `example`. |
| `title` | Human-readable resource name. |
| `description` | Optional short summary. |
| `mediaType` | Response content type, including charset for text where appropriate. |
| `language` | Optional language identifier such as `typescript`, `php`, or `python`. |
| `content` | Public resource body, 1 byte to 512 KiB. |

The framework serves the index and content routes defined in [ai.md](ai.md). Published registry contracts and Config Manager's synced manifest cache preserve the same resources. Because the manifest and resource endpoints are public, content MUST NOT contain secrets or private operational instructions.

## 8. Conformance

A conformant manifest:

- MUST be served at `GET /.well-known/bp/manifest` with `Content-Type: application/json`.
- MUST include `protocolVersion`, `pluginId`, `title`, `version`, `views` (possibly empty).
- MUST NOT include service-internal fields (database URLs, secrets, etc.).
- MUST be stable for the lifetime of the running process; changes require a restart or a new `version`.

See `conformance.md` for the test matrix.
