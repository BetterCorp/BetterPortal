# BetterPortal Hello View Example for Node.js

Reference business plugin for BetterPortal v10.

This package demonstrates:

- a single canonical view endpoint
- `application/json` and `text/html` negotiation
- metadata representation
- schema-first validation
- support for the `bootstrap1` and `embedded` themes

The API examples return domain data and stream items. They do not generate internal URL fields for the view. Renderers receive `ViewRenderContext` as their second argument and resolve navigation, actions and pagination locally with `ctx.routeUrl(input?)`; see the `hello` showcase renderer for cursor-based fragment pagination. Select `uiPath` for page navigation, `absoluteViewPath` for HTML/HTMX requests and `absoluteApiPath` for JSON actions. Specify the action method; omit the target to resolve self. See the [routing contract and paired API/view example](../../../../docs/building/routes-and-views.md).

For collections, return domain items, IDs and cursors from the API, then resolve links in the renderer. `ctx.routeUrl()` preserves repeated query values such as `?tag=a&tag=b`; a scalar override replaces the complete key and null removes it.

Select renderers with the explicit `component` or `fragment` option. Reserved `_c`/`_f` query keys in input paths or the current request are removed; only view destinations receive an explicit selector. Service base metadata preserves non-root prefixes and omits a root trailing slash.

The fatal prebuild check covers source helpers under `src/lib` and `src/dist`, and follows statically traceable response helpers, aliases, callbacks, promises and collection transformations. Avoid returning internal destinations through these response paths. Public links, scalar counts and domain-client results remain valid. Import BP handler factories from `@betterportal/framework` or the generated `.bp-generated/route-runtime.js`; unrelated provider helpers retain their own semantics.
