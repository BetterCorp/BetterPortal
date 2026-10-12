# Routing lint and build validation

Use BPRoute for ordinary service JSX and ctx.route() for specifically required destination values. The theme owns UI mounting/history. This rule is enforced in types, ESLint and the fatal `bp run check-routes` authoring gate; do not remove the gate from prebuild scripts.

```js
import betterportal from "@betterportal/framework/eslint";
export default [{
  files: ["**/*.{ts,tsx,mts,cts}"],
  plugins: { betterportal },
  rules: { "betterportal/routing-contract": "error" },
}];
```

Use a TypeScript-capable ESLint parser/config alongside this plugin. The repository enables the rule and `tsdoc/syntax` with zero warnings. ESLint and codegen/prebuild share the routing authoring checker. Source scanning includes configured route/shell roots outside src. Generated/build output is excluded from ESLint; source helper folders remain included in the authoring check.

## Removed interfaces

```tsx
// Invalid: removed helpers/components.
ctx.routeUrl({ viewId: "items.detail" });
ctx.routeUi.link(destination);
<BPElement ctx={ctx} service="crm" fragment="profile.summary" />;

// Valid: BPRoute owns the control.
<BPRoute ctx={ctx} viewId="items.detail"><bp-ok>Item</bp-ok></BPRoute>;
```

Diagnostics identify the removed interface and direct authors to BPRoute or ctx.route(). Imported aliases, any-typed handler contexts and statically traceable context/resolver aliases are checked. Unrelated provider APIs with similarly named methods are not BP helpers.

## Service destination ownership

```tsx
// Invalid in a service renderer: uiPath is not the preferred service href.
<a href={ctx.route({ viewId: "items.detail" })?.uiPath}>Item</a>;

// Valid preferred control.
<BPRoute ctx={ctx} viewId="items.detail"><bp-ok>Item</bp-ok></BPRoute>;

// Valid explicit value use; context-specific stringification yields viewPath.
<a href={ctx.route({ viewId: "items.detail" })}>Item</a>;
```

The diagnostic names service ownership and the theme's mounting responsibility. Explicit `uiPath` for shell navigation/history and `absoluteUiPath` for public links remain supported. BPRoute preference is not a blanket ban on ctx.route() when a destination value is required.

## Conflicting actions and embedding selectors

```tsx
// Invalid: one active control cannot request two methods.
<bp-ok as="a" hx-get hx-delete>Delete</bp-ok>;

// Valid: DELETE selects and resolves the DELETE operation.
<bp-ok as="a" hx-delete>Delete</bp-ok>;

// Invalid: select one embedding renderer.
<BPRoute ctx={ctx} component="summary" fragment="body.live" />;

// Valid: component response fills the wrapper; no link or authored placeholder.
<BPRoute ctx={ctx} component="summary"><bp-ok as="div" class="p-3" /></BPRoute>;
```

An explicit hx-* URL is an intentional override. It remains subject to runtime origin/header policy and backend authorization; the authoring checker does not claim to validate arbitrary external destinations.

## API payloads and legacy tokens

```ts
// Invalid: internal renderer destinations must not be forwarded as API data.
return { detailUrl: String(ctx.route({ viewId: "items.detail" })) };

// Valid: domain state; the renderer resolves its own BPRoute.
return { itemId: item.id };

// Valid when actually needed for a public email/callback link.
const publicLink = ctx.route({ viewId: "items.detail", params: { itemId } })?.absoluteUiPath;
```

The existing provenance checker follows documented static response construction patterns, including aliases, selected fields, common factories/transforms and promise callbacks. Stringification does not bypass internal-destination checks. It is not proof of arbitrary JavaScript semantics. Legacy route tokens, positional resolver calls, old options and removed renderer URL payload fields remain build errors.

## Documentation checks

TSDoc/ESDoc must explain the service/UI distinction, contextual string conversion, method selection and state/embedding behaviour. Current Markdown, generated LLM documents, theme resources and executable examples must show BPRoute first. Historical release APIs are explicitly marked superseded rather than silently treated as current guidance.

See [BPRoute examples and full contract](bp-route.md).

JSX diagnostics report the actual source location of conflicting method/selector attributes and renderer UI-path usage. ESLint preserves the offsets produced by the shared authoring checker.
