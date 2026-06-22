# BetterPortal Protocol

**Status:** Draft. Version `bp-protocol/1`.

This directory is the **normative specification** for BetterPortal as a wire protocol. SDKs (`@betterportal/framework` for Node, future siblings for other languages) are implementations of these specs.

If you are writing a service in a language other than TypeScript, this is your source of truth. If the spec disagrees with any SDK source, the spec wins; file a bug.

## Documents

| File | Purpose |
|---|---|
| [protocol.md](protocol.md) | HTTP surface, well-known endpoints, CORS, content negotiation, error shape, versioning. |
| [manifest.md](manifest.md) | `/.well-known/bp/manifest` JSON schema — plugin id, views, config schemas, cache hints. |
| [schema-json.md](schema-json.md) | `/.well-known/bp/schema.json` — flattened route catalog with theme renderers, fragments, components. |
| [fragment-html.md](fragment-html.md) | HTML conventions for fragments and view bodies: required attributes, relative URLs, HTMX patterns the client rewriter expects. |
| [config.md](config.md) | `bp-config.yaml` (platform), per-service config schemas, `/.well-known/bp/config*` endpoints. |
| [auth.md](auth.md) | View auth (OIDC-compliant JWT + JWKS), config ticket claims, `ViewAuthRequirement` semantics. |
| [sse.md](sse.md) | Server-Sent Events conventions: per-view streams (`/__sse`), per-theme tick renderers, control-plane config sync. |
| [streaming.md](streaming.md) | Partial responses: frame envelope, NDJSON streaming, per-frame validation, streamed HTML rendering, deferred components. |
| [search.md](search.md) | Federated search: `search.v1` capability, provider endpoint, pinned result schema, aggregator rules (viewId link resolution, hiding, custom result HTML). |
| [conformance.md](conformance.md) | Minimum surface an SDK or service must implement to claim `bp-protocol/1` compliance. |
| [contracts/media-types.md](contracts/media-types.md) | Negotiated media types and the rules between them (existing v10 doc, still normative). |

## Versioning

The protocol is versioned via the `bp-protocol` token in:
- `Server` and `User-Agent` headers (informational): `bp-protocol/1`
- The manifest's `protocolVersion` field (normative): `"protocolVersion": 1`

Breaking changes bump the integer. Additive changes (new optional fields, new endpoints under `/.well-known/bp/`) do not.

Conformance tests target a single version. Services SHOULD advertise the highest version they support; clients SHOULD downgrade if needed.

## Principles

These rules constrain every spec in this directory:

- **HTML is API.** Services emit semantic HTML fragments. Clients consume them as-is. No client-side templating or reparsing.
- **Each service is its own origin.** Browsers call services directly, not through a proxy. CORS-correctness is mandatory.
- **Schema-first.** Every input and output is validated against a declared schema. Schemas are language-neutral (JSON Schema-style); SDKs map them to their native validators.
- **No client framework.** The protocol assumes HTMX as the client runtime. If your SDK emits markup that does not work in plain HTMX, it is non-conformant.
- **Server emits relative URLs.** All `href`, `hx-get`, `hx-post`, `hx-sse:connect`, etc. are root-relative. The client rewrites them to absolute service origins using service context (`data-bp-service`, `bp-service-id`, or `data-bp-config="service=<id>"`).
- **Cookies are theme-origin only.** Cross-origin auth uses bearer tokens via `hx-headers`. See `auth.md`.
- **No iframes.** Composition is fragment swaps. Iframes break theming, navigation, accessibility, CSS variables, and the URL bar.

## Status of the Node SDK

`@betterportal/framework` (in `framework/nodejs/`) is the reference implementation. Where this spec is ambiguous, the Node SDK's behavior is **descriptive, not prescriptive** — file a spec issue and the spec will be updated to match (or the SDK will be fixed).

The SDK is **not the protocol**. A PHP, Go, Python, or Rust service that implements these specs is a first-class BetterPortal service.

## How to add a new SDK

1. Implement the well-known endpoints (`protocol.md`).
2. Emit a conformant manifest (`manifest.md`) and `schema.json` (`schema-json.md`).
3. Serve fragments and views per `fragment-html.md`.
4. Implement service config read/write per `config.md` (or declare you do not support dynamic config).
5. Implement bearer auth verification per `auth.md` for any route declaring `auth.required = true`.
6. Pass the conformance suite (`conformance.md`).

Reference the Node SDK source freely but do not copy idiomatic Node code; copy the wire behavior.
