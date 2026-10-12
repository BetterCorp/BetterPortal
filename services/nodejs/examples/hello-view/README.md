# BetterPortal Hello View Example for Node.js

Reference business plugin for BetterPortal v10.

This package demonstrates:

- a single canonical view endpoint
- `application/json` and `text/html` negotiation
- metadata representation
- schema-first validation
- support for the `bootstrap1` and `embedded` themes

The API examples return domain data and stream items. They do not generate internal URL fields for the view. Renderers receive `ViewRenderContext` as their second argument and resolve navigation, actions and pagination locally with `ctx.routeUrl(input?)`; see the `hello` showcase renderer for cursor-based fragment pagination. Select `uiPath` for page navigation, `absoluteViewPath` for HTML/HTMX requests and `absoluteApiPath` for JSON actions. Specify the action method; omit the target to resolve self. See the [routing contract and paired API/view example](../../../../docs/building/routes-and-views.md).

For collections, filter/sort or incrementally collect domain items and IDs in the API, then resolve each link in the renderer. Avoid arrays (including `Array.from`/`Array.of`), object/JSON copies or incrementally constructed response objects containing internal route destinations. Provider clients/constructors may consume service destinations to return domain data.

Import BP handler factories from `@betterportal/framework` or the generated `.bp-generated/route-runtime.js`. The authoring validator follows these imports and aliases; unrelated SDK factories with the same names retain their own semantics.

For a request such as `?tag=a&tag=b`, `ctx.routeUrl()` preserves both tags; `ctx.routeUrl({ query: { tag: "latest" } })` replaces them. APIs can return domain cursors/filter state and leave the view to resolve navigation. Standard entry collections such as Map/Set must not forward internal destinations through serialization.

Renderer selection uses the explicit `component` or `fragment` option. Reserved `_c`/`_f` keys in query input, supplied paths, or the current request are removed before resolution; only view destinations receive an explicit selector. API and mounted page destinations remain free of renderer selectors.

The authoring gate checks response-producing promise continuations as well as synchronous returns. Framework auth redirect helpers are identified by their imports and aliases; unrelated provider helpers may use the same name. Keep internal destinations out of these API response paths and resolve them in the view.

Destructuring a handler context does not bypass the routing migration check. Returned reduction accumulators and their initial values are checked for internal destinations; domain clients may consume those destinations without returning them to views.

Response callback checks follow local named functions and lexical aliases. Transparent iterable constructors such as URLSearchParams/Headers retain destination provenance when serialized; public links and unrelated provider constructors remain valid.

HTML/HTMX forms select `absoluteViewPath`; JSON requests select `absoluteApiPath`. Public service base metadata strips a root trailing slash while preserving non-root prefixes. Source helpers under `src/lib` and `src/dist` use the same authoring gate.

Returned local response factories and immediately invoked helpers receive the same URL payload checks. String/array lengths and standard collection sizes are derived scalar state and remain valid API response data.

Named response callbacks retain the provenance of caller-supplied parameters, including Array.from/map inputs and fulfilled promise values. Local response helpers follow passed handler contexts too; scalar state and opaque domain-client results remain valid.

`sse: true` resolves only a known registered GET SSE/finite-stream endpoint on the current service. Ordinary routes, non-GET methods and dependency mounts without streaming capability return null instead of a guessed stream URL.

Embedded query values may contain raw question marks, for example `/items?q=what?x&next=/a?b`; the resolver preserves and encodes the complete values before applying query overrides.

Array element selection retains destination provenance. Explicit string-typed replacement receivers are checked even when initialized dynamically; unrelated provider methods and public links remain valid.

Array destructuring retains element provenance, including aliases and rest values. Character selection from route strings is scalar state; selecting a complete path from an array remains an internal destination.

A dependency mount without a resolved service path cannot identify a service endpoint, so resolution returns null rather than guessing or throwing.

Prebuild and generation both inspect configured `betterportal.routes` and `betterportal.shells` folders, including locations outside `src`, as well as default source helpers. Nested roots are deduplicated.

Standard reversible URI/base64 encoders retain destination provenance. Numeric indexing into known strings is character state; indexing into arrays can select a complete internal path.

Streamed API items emitted by `yield` or `yield*` follow the same destination checks as returned payloads. Streams return domain items/public links; renderers resolve internal navigation locally.

Destructuring assignments into existing variables or response properties retain destination provenance just like declarations; public links and domain-client request building remain valid.

Standard Object.defineProperty/defineProperties response mutations retain descriptor value provenance; public links and objects consumed by domain clients remain valid.

The authoring check recognizes statically named computed properties in destructuring assignments and follows the selected field of known objects. Selecting domain data from an object that also contains an internal destination remains valid; returning the internal destination fails the build. Object property descriptor mutations are checked too.
