# `/.well-known/bp/schema.json`

**Version:** `bp-protocol/1`
**Endpoint:** `GET /.well-known/bp/schema.json`
**Content-Type:** `application/json`

A flattened, machine-readable catalog of a service's routes, themes, fragments, and components. Tools (theme nav builder, fragment editor, route designer) read this instead of crawling the manifest.

## Shape

```jsonc
{
  "manifest": { <full manifest as published at /.well-known/bp/manifest> },
  "routes": [
    {
      "viewId": "hello.index",
      "path": "/hello",
      "methods": ["GET"],
      "paramNames": [],
      "themes": ["bootstrap1", "embedded"],
      "hasFragments": true,
      "fragments": [
        { "fragmentLocation": "nav", "fragmentId": "clock",   "themes": ["bootstrap1"] },
        { "fragmentLocation": "nav", "fragmentId": "profile", "themes": ["bootstrap1"] }
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
| `routes[].methods` | Same as `manifest.views[].methods`. |
| `routes[].paramNames` | Ordered list of `:param` names extracted from `path`. |
| `routes[].themes` | Themes that have at least one renderer for this view. |
| `routes[].hasFragments` | `true` iff the route has any fragment renderer. |
| `routes[].fragments` | Per-fragment record. `themes[]` lists which themes implement this fragment. |
| `routes[].components` | Named component renderers (queryable via `?_c=<id>`). |

## Why have this in addition to the manifest?

- The manifest is rich and nested. `schema.json` is a flat shape better suited to admin tooling traversal.
- It guarantees `fragments[]` and `components[]` are advertised explicitly. The manifest's `themeRenderers` structure requires extracting them by walking renderer slot IDs.
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
