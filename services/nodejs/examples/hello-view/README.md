# BetterPortal Hello View Example for Node.js

Reference business plugin for BetterPortal v10.

This package demonstrates:

- a single canonical view endpoint
- `application/json` and `text/html` negotiation
- metadata representation
- schema-first validation
- support for the `bootstrap1` and `embedded` themes

The API examples return domain data and stream items. They do not generate internal URL fields for the view. Renderers receive `ViewRenderContext` as their second argument and resolve navigation, actions and pagination locally with `ctx.routeUrl(input?)`; see the `hello` showcase renderer for cursor-based fragment pagination. Select `uiPath` for page navigation, `absoluteViewPath` for HTML/HTMX requests and `absoluteApiPath` for JSON actions. Specify the action method; omit the target to resolve self. See the [routing contract and paired API/view example](../../../../docs/building/routes-and-views.md).
