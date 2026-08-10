# `/.well-known/bp/schema.json`

**Version:** `bp-protocol/2`
**Endpoint:** `GET /.well-known/bp/schema.json`
**Content-Type:** `application/json`

A flattened, machine-readable catalog of a service's routes, renderer contracts, fragments, and components. Tools read this instead of crawling the manifest.

All AnyVali documents published through the manifest or this endpoint MUST be concrete. The `any` and `unknown` node kinds and object `unknownKeys: "allow"` are forbidden at every nesting level because they cannot provide cross-SDK validation or useful generated client types. Deliberately arbitrary JSON uses the portable recursive `BetterPortalJsonValue` definition published by the framework. Object schemas default to `unknownKeys: "strip"`; source declarations omit that redundant option and use `"reject"` when extra keys must fail validation.

## Shape

```jsonc
{
  "manifest": { <full manifest as published at /.well-known/bp/manifest> },
  "routes": [
    {
      "viewId": "hello.index",
      "path": "/hello",
      "operations": [{ "operationId": "hello.read", "method": "GET" }],
      "paramNames": [],
      "renderers": ["bootstrap5", "embedded"],
      "hasFragments": true,
      "fragments": [
        { "fragmentLocation": "nav", "fragmentId": "clock",   "renderers": ["bootstrap5"] },
        { "fragmentLocation": "nav", "fragmentId": "profile", "renderers": ["bootstrap5"] }
      ],
      "components": ["showcase-cards", "showcase-forms", ...]
    },
    ...
  ]
}
```

### Field semantics

| Field | Notes |
|---|---|
| `manifest` | Identical to `/.well-known/bp/manifest`. Duplicated here so callers fetch once. |
| `routes[].viewId` | Matches `manifest.views[].viewId`. |
| `routes[].path` | Public path. `:param` syntax intact. |
| `routes[].operations` | Operation id/method pairs from the matching manifest view. |
| `routes[].paramNames` | Ordered list of `:param` names extracted from `path`. |
| `routes[].renderers` | Renderer compatibility keys implemented by this view. |
| `routes[].hasFragments` | `true` iff the route has any fragment renderer. |
| `routes[].fragments` | Per-fragment record. `renderers[]` lists which renderer contracts implement this fragment. |
| `routes[].components` | Named component renderers (queryable via `?_c=<id>`). |

## Why have this in addition to the manifest?

- The manifest is rich and nested. `schema.json` is a flat shape better suited to admin tooling traversal.
- It guarantees `fragments[]` and `components[]` are advertised explicitly. The manifest's `renderers` structure requires extracting them by walking renderer slot IDs.
- It can include cross-cutting fields that don't belong on the manifest (computed aggregates, link tables).

## Caching

- The response SHOULD include `Cache-Control: public, max-age=<manifest.cacheHints.metadataTtlSeconds>`.
- The response MUST include the same `protocolVersion` discoverable via `manifest.protocolVersion`.

## Empty case

A service with no views returns:

```json
{
  "manifest": { ... },
  "routes": []
}
```
