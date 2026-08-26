# Routes and Views

BetterPortal routes are file-based inside each service.

Codegen scans `bp-routes/` and creates the service registry. Do not hand-write the registry.

## File convention

```text
bp-routes/
  docs/
    index.ts              # metadata only
    GET.ts                # GET handler + schemas
    POST.ts               # POST handler + schemas
    _renderer.bootstrap5/
      GET.tsx
      POST.tsx
      POST.422.tsx
  docs/
    [section]/
      [page]/
        index.ts
        GET.ts
        _renderer.bootstrap5/
          GET.tsx
```

Directory names become service paths. Bracketed names become params.

For service route files, use bracketed directory names for path params:

```text
bp-routes/
  tenants/
    [tenantId]/
      services/
        index.ts
        GET.ts
```

That registers the service path `/tenants/:tenantId/services`; handlers read the value from `ctx.params.tenantId`.

Use double brackets for optional params:

```text
bp-routes/
  tenants/
    [[tenantId]]/
      services/
        index.ts
        GET.ts
```

That registers both `/tenants/services` and `/tenants/:tenantId/services` against the same view. `ctx.params.tenantId` is `undefined` on the list route and populated on the tenant-specific route.

Required folders use `[id]`; optional whole-segment folders use `[[id]]`. Catch-all parameters are not supported. Generated manifests use `:id` exclusively. Legacy app configuration containing `{id}` is migrated once by Config Manager, and new brace-style paths are rejected.

Declare route parameter validation in the metadata `index.ts` with `ParamsSchema`:

```ts
import * as av from "anyvali";

export const ParamsSchema = av.object({
  planId: av.string().minLength(1).maxLength(40)
});
```

Pass that same exported schema to the method's handler factory so `ctx.params` receives its precise inferred type:

```ts
import { ParamsSchema } from "./index.js";
import { createHandler } from "../../../.bp-generated/route-runtime.js";

export default createHandler(
  { response: ResponseSchema, params: ParamsSchema },
  (ctx) => ({ planId: ctx.params.planId })
);
```

The adapter validates `ctx.params` before the handler runs. Every supplied path parameter must be non-empty and at most 100 characters; `ParamsSchema` may apply stricter validation. Path params are strings. As with other API schemas, `av.object` already strips unknown keys; do not add `{ unknownKeys: "strip" }`.

Optional filesystem routes remain separate runtime patterns but are one manifest view. The view's canonical `path` is the most specific pattern and `pathVariants` lists every concrete pattern. Config Manager's Route Designer lets an app mount select the intended service variant.

## Metadata and method files

`index.ts` defines the shared view group: stable view identity, service path, path parameters, and presentation label.

```ts
export const viewId = "example.index";
export const title = "Example View";
export const description = "Example BetterPortal view";
```

Keep `index.ts` declarative. It may export `viewId`, `title`, `description`, and `ParamsSchema`. It must not export handlers, method schemas, `operationId`, auth, chrome, dependencies, API contracts, cache hints, demos, request URL parsing, or service calls.

Each method is a distinct operation under that view. The method file owns its stable `operationId`, label, schemas, auth/permission requirements, dependencies, render policy, chrome, SEO declarations, API contracts, cache hints, and demos. A service-wide `operationId` must be unique and must not be derived from a title.

Each HTTP method has its own file and default-exports its handler:

```ts
// GET.ts
import * as av from "anyvali";
import { createHandler } from "../.bp-generated/route-runtime.js";

export const operationId = "example.read";
export const title = "Read example";
export const description = "Returns the example view model.";
export const auth = { required: false, permissions: [] };

export const ResponseSchema = av.object({
  title: av.string().minLength(1)
});

export default createHandler(
  { response: ResponseSchema },
  async () => ({ title: "Example View" })
);
```

Method files are service API boundaries. They validate inputs, build typed response models, and return JSON/HTML-negotiable data through `createHandler`.

Method files are named exactly by HTTP method: `GET.ts`, `POST.ts`, `PUT.ts`, `PATCH.ts`, `DELETE.ts`, and `OPTIONS.ts`. Every method file must export `operationId`, `title`, `description`, and `auth`; it may also export `QuerySchema`, `HeadersSchema`, `RequestSchema`, `MultipartSchema`, `ResponseSchema`, `chrome`, `dependencies`, `sitemap`, `robots`, `role`, `cacheHints`, `apiContracts`, and `demoScenarios`, plus one default handler.

`viewId` groups methods that share one service path and path-parameter schema. `operationId` identifies the method-specific contract. A GET and POST may share `viewId = "reports.index"` while publishing independent operations such as `reports.search` and `reports.create`, each with its own request, response, auth, and generated client types.

The optional `role` is provider-neutral discovery metadata. Auth services use `auth.roles.sync.view` for the GET fragment that renders provider-owned role controls, `auth.permissions.sync` for permission synchronization, and `auth.roles.sync` for the POST operation that synchronizes roles. Consumers resolve the operation's published `view.path`; they must not copy a provider's route path.

Only a GET operation with a page renderer is eligible for Visual Routes and browser navigation. A POST, PUT, PATCH, or DELETE operation remains a Service/API route even when it has an HTML renderer for form results or validation errors. Rendering capability does not change the HTTP operation's routing role.

`av.object` strips unknown keys by default. Omit `{ unknownKeys: "strip" }`; codegen warns because it is redundant. Use `{ unknownKeys: "reject" }` when extra fields must fail validation. `unknownKeys: "allow"` is forbidden because it bypasses the declared schema; model extensible keys with a typed `av.record(...)` instead.

All production BetterPortal schemas must be concrete at every nesting level. Codegen and contract generation reject `av.any()`, `av.unknown()`, and unknown-key passthrough, including values hidden inside arrays, records, unions, imported aliases, or re-exports. For deliberately arbitrary JSON, import `JsonValueSchema` or `JsonObjectSchema` from `@betterportal/framework`; these recursively validate JSON primitives, arrays, and objects and publish a portable recursive contract. They reject functions, `undefined`, non-finite numbers, class instances, and circular structures. TypeScript `unknown` remains appropriate before parsing and is unrelated to `av.unknown()`.

BetterPortal service APIs do not support cookies. Do not read `Cookie` or emit `Set-Cookie` from route handlers; use `ctx.bpHeaders.set(...)` and `ctx.bpHeaders.remove(...)` for browser-managed state that must accompany later BP requests.

Every final status outside 200-399 receives an HTTP outcome diagnostic. Framework validation, authorization, negotiation, rendering, CORS, config, and discovery failures already use stable core codes. When a handler returns a service-specific error response, set a domain code and concise reason first:

```ts
ctx.diagnostic({
  code: "orders.version_conflict",
  reason: "The order was changed by another request",
  attributes: { "orders.id": orderId }
});
return ctx.response(JSON.stringify({ error: "Order changed; reload and retry" }), {
  status: 409,
  headers: { "content-type": "application/json" }
});
```

Use stable lowercase dotted codes. Reasons and attributes are observability data, so never include credentials, tokens, secrets, or avoidable personal data. If a custom failure is not annotated, the runtime derives a bounded reason from `reason`, `error`, `message`, or `detail` in a JSON body, then from text content, and finally from the HTTP status. Body inspection is capped at 2 KiB and occurs on a cloned response.

Route handlers can import handler factories from two places:

- `@betterportal/framework` is runtime-neutral: `ctx.plugin` does not exist and `ctx.config` is `Record<string, unknown>`.
- `../.bp-generated/route-runtime.js` or the correct relative path to it is BSB-bound: `ctx.plugin` is required and exposes only the service's exported `PluginFeature`; `ctx.config` uses `ServiceConfig`.

Prefer the generated route runtime when a handler needs `ctx.plugin` or BP service config:

```ts
import { createHandler } from "../.bp-generated/route-runtime.js";

export const ResponseSchema = av.object({ enabled: av.bool() });

export default createHandler(
  { response: ResponseSchema },
  (ctx) => ({
    enabled: ctx.config?.enabled ?? false
  })
);
```

Codegen creates that runtime from exports on the plugin `index.ts`. Export only the route-safe feature and service config types:

```ts
export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  public findIncident(id: string) { /* ... */ }
}

export type PluginFeature = Pick<Plugin, "findIncident">;

export interface MyBpServiceConfig {
  enabled: boolean;
}

export type ServiceConfig = MyBpServiceConfig;
```

`PluginFeature` is optional. When omitted, generated BSB handlers still receive a required `ctx.plugin`, but its exposed feature type is empty. Normal handler context such as tenant, app, config, URLs, headers, and observability remains available. `ctx.config` is the BetterPortal-managed service configuration resolved for the current tenant/app scope. It is not the BSB plugin startup config from `this.config`. Use `ctx.config` for customer/tenant/app runtime settings, and use `ctx.plugin` when a route needs an explicitly published feature on the running plugin instance. Never export the full `Plugin` as the feature, recast `ctx`, or make `plugin` optional; generated BSB handlers guarantee it and intentionally hide BSB lifecycle/runtime internals.

Export `viewId` for any view referenced by app configuration, permissions, or code. If omitted, codegen derives it from the file path, which changes when files move. Build validation fails on duplicate view ids and duplicate operation ids.

Use the exported `viewId` in UI code instead of duplicating strings:

```ts
import { viewId as submitViewId } from "../submit/index.js";

export function render(data: ResponseData): HtmlRenderable {
  return <form hx-post={`{${submitViewId}}`} method="post">...</form>;
}
```

Route chrome is operation-owned presentation metadata. Export `chrome = { fullScreen: true }` from the relevant method file when that operation should use a full-workspace presentation. Config Manager copies the selected operation's default chrome into scoped app routes; an explicit app-route chrome value overrides it.

Route dependencies are explicit operation references that must be mounted with the source operation. Export `{ operationId, method }` from the method that calls the operation, adding a dependency alias as `serviceId` for cross-service calls. Renderer route tokens never declare dependencies. Config Manager auto-adds one dependency mount per operation.

`apps[].routes[]` stores both browser-visible page routes and service/API allowlist routes:

- `kind: "page"` routes are visual app routes. Their app path, title, query, chrome, and menu usage are app-owned.
- `kind: "api"` routes are service-locked allowlist routes. Config-manager mounts them under `/_bp/service/{service-slug}/{service-path}` and keeps `targetPath`/`resolvedServicePath` pointed at the service-owned path from the manifest.

App and service paths are separate mappings. Every service parameter must be supplied by a same-named `:param` segment in the app path or by a fixed value:

```ts
{
  path: "/plans",
  viewId: "plans.$planId.index",
  servicePathVariant: "/plans/:planId",
  fixedParams: { planId: "default1" }
}
```

The Route Designer shows each required service parameter. A dynamic app-path match is green; an unresolved parameter is red and blocks saving until a fixed value is valid. Fixed values are limited to 1–100 characters and also honor stricter compatible `ParamsSchema` string constraints from the manifest. Static app routes take precedence over dynamic patterns regardless of configuration order. Synthetic path groups are presentation only and are never stored or submitted.

By default, a user-facing capability should be one renderable route that provides both its API contract/handlers and its HTML renderer. Content negotiation serves JSON to API clients and HTML to the UI. Do not create a separate API-only route when the renderable route can own the operation.

Use `kind: "api"` only when there is a specific reason the endpoint has no UI: provider callbacks, webhooks, machine-only/internal dependencies, raw files, streams, or similar protocol endpoints. An API route is never an application navigation destination, and the user must never be left viewing it. Browser-mediated protocol endpoints such as OAuth callbacks must immediately redirect to an enabled page route after completing their work.

An internal, root-relative `<a href>` is browser-visible navigation and must resolve to an enabled GET `kind: "page"` route backed by a renderable view. Generate it with `ctx.uiRouteUrl`. Do not put a service path, `kind: "api"` route, or `ctx.routeUrl` result in an anchor `href`. API routes are invoked through form actions, `hx-*` requests, `fetch`, SSE, downloads, callbacks, and other non-page operations.

For OAuth, the user-facing "Continue with ..." anchor should target a mounted page/view route. That view may initiate the external provider redirect with the normal BP response/header flow. The provider callback can remain an API route, but it must redirect back to a mounted page route after completing authentication. `data-bp-no-route` is not a workaround for service links: it disables routing entirely and leaves a root-relative URL pointed at the theme origin.

Config-manager owns Service/API route mounts as a synchronized projection of each active service manifest. Newly published API-only operations are added to every applicable app disabled by default; operations declared as dependencies of a mounted operation use automatic enablement. Administrators may pin a mount on or off, but cannot create, edit, or delete it manually. Sync updates its path, operation identity, and derived method, removes API operations that disappear, and moves an operation into Visual Routes disabled if it gains a page renderer.

Visual routes remain administrator-owned. If a page view disappears from a service manifest, config-manager disables its app route and preserves its app path, title, menu references, and auth redirect references for repair instead of deleting it.

Routes can declare API contracts for explicit service-to-service binding. Machine callers are opt-in at the route boundary; omitting `auth.callers` means user-only.

```ts
export const auth = {
  required: true,
  callers: ["service", "delegated"],
  permissions: [
    { serviceId: "com.example.pricing", viewId: "pricing.quote", permissions: ["create"] }
  ]
};

export const apiContracts = [{
  id: "pricing.quote",
  title: "Pricing quote",
  version: "1.0.0",
  capabilities: ["pricing.quote"],
  permissions: ["create"],
  modes: ["service", "delegated"]
}];
```

Codegen attaches the owning `viewId` and method to each method-owned API contract. Manifest construction rejects a contract mode absent from that operation's `auth.callers`; declaring a contract never makes a user-only operation callable by a service.

Service-level manifests declare outbound `m2mRequests`. A request chooses exactly one mode and describes the minimum contract it needs:

```ts
m2mRequests: [{
  id: "pricing.quote",
  title: "Request a pricing quote",
  contractId: "pricing.quote",
  version: "1.0.0",
  requiredCapabilities: ["pricing.quote"],
  methods: ["POST"],
  permissions: ["create"],
  mode: "delegated",
  optional: false
}]
```

Requests are not grants. An administrator approves a compatible provider in Config Manager's Services page, which creates an app-scoped binding and least-privilege grant. Multiple compatible providers require an explicit choice. Revoking deletes the binding/grant; a later request returns to pending and receives fresh IDs when approved again.

Use `this.m2mClient(requestId, ctx)` for a pure-service call made inside a route handler. It creates a child `bp.s2s.request` span and propagates W3C trace context to the target. Use `this.m2mClient(requestId, tenantId, appId)` only for background automation where no request parent exists. For a user-initiated operation, use `this.delegatedM2mClient(requestId, ctx)` so the generated client sends the original BP user JWT plus a fresh service proof while preserving the same distributed trace. The target verifies both credentials. Do not manually construct auth or trace headers.

Handlers that need to request a service view should use `ctx.routeUrl(viewId, options)`. With no `serviceId`, it resolves the current service registry. For another service, pass its declared dependency alias/key; BetterPortal maps the alias through `betterportal.lock.json`, then resolves the active concrete service and service path from the synced application route index. A plugin ID or concrete service-instance UUID is also accepted for platform-owned dynamic references, but application code should prefer declared dependency aliases. The target route must be mounted in the app. When `absolute: true`, the result uses the target service hostname/base URL. Use it for HTMX requests, form actions, `fetch`, SSE, and downloads.

```ts
const url = ctx.routeUrl?.("reports.detail.index", {
  serviceId: "reports",
  absolute: true,
  params: { reportId },
  query: { token }
});
```

Use `ctx.uiRouteUrl(viewId, options)` only for GET browser navigation through the app shell, such as links and `HX-Location` redirects. It uses the same dependency-alias resolution against the synced application route index, resolves enabled GET page mounts, and when `absolute: true` uses the app hostname/base URL. It returns `null` for API and mutation-only routes.

```ts
const submitUrl = ctx.routeUrl?.("reports.update", { serviceId: "reports" }); // hx-post, form action, fetch
const pageUrl = ctx.uiRouteUrl?.("reports.detail", { serviceId: "reports" }); // href or GET navigation
```

Both URL helpers choose a service path variant that can be completely filled by the supplied parameters. They return `null` when a placeholder remains or when more than one app mount is ambiguous; they never emit a literal `:param` URL.

Do not use `uiRouteUrl` for HTMX requests, form actions, `fetch`, SSE, or downloads. Those requests would target the app/theme origin instead of the service and can return 404.

For a reusable UI fragment from another declared service dependency, use the typed `BPElement` helper and pass the renderer `ctx`:

```tsx
import { BPElement } from "@betterportal/framework";

<BPElement
  ctx={ctx}
  service="crm"
  path="/customers/:customerId"
  fragment="profile.summary"
  args={{ params: { customerId }, query: { compact: true } }}
>
  <bp-loading>Loading profile…</bp-loading>
  <bp-status code="404">Customer not found.</bp-status>
  <bp-status code="5xx">CRM is unavailable.</bp-status>
  <bp-nok>Profile unavailable.</bp-nok>
</BPElement>
```

`service` is the dependency alias/key from `betterportal.json`; codegen records its canonical plugin id from `betterportal.lock.json`, and the server resolves the concrete app-mounted service UUID. Authors do not use service titles, hostnames, runtime UUIDs, or `absolute: true`. The dependency must be active and the path must be app-allowlisted. Use `service="shell"` with no `path` to reference an active-shell singular fragment, for example `fragment="theme-selector"`.

The shared HTMX pipeline performs the request and adds managed BetterPortal headers. `bp-loading` is the initial state. Omit `bp-ok` for the normal case: a successful response is inserted directly, exactly as if `<bp-ok><template /></bp-ok>` had been supplied. Add `bp-ok` only to wrap or decorate success content; when present it must contain exactly one empty `<template />` insertion point. `bp-status` accepts exact codes, `40x`, or `4xx`, in that priority order. `bp-nok` handles unavailable dependencies, unmatched errors, and network failures. Omitted states render nothing. A 204 response is successful empty content.

Use `routeUrl` for service actions and `uiRouteUrl` for mounted GET navigation. Both accept a declared dependency alias in `serviceId`; omit it for the current service. Use `BPElement` for UI components from another service or the active shell; do not parse cross-service references into arbitrary `hx-*` attributes.

Raw app routes and tenant services are intentionally absent from renderer context. Use `ctx.url` for route resolution and `BPElement` for dependency or shell fragments.

App routes persist selected `operationId` values. HTTP methods are derived from those manifest operations and are never user-editable.

An app route is an operation allowlist, not a second copy of the service contract. Config Manager normally creates one managed Service/API mount per non-page operation and one administrator-owned Visual Route for a selected renderable GET operation. Existing multi-method mounts migrate to an `operations` set without flattening their contracts.

Role grants deliberately remain `serviceId + viewId + action`. Each operation's own `auth.permissions` declares which CRUD actions it requires, so methods sharing a view can require different grants: a GET can require `read`, while POST requires `create`. `operationId` is the routing, dependency, telemetry, and generated-client identity; titles are labels only.

### Protocol 2 migration

This operation model is a breaking protocol change. To migrate a service:

1. Leave only `viewId`, the shared label/description, and optional `ParamsSchema` in `index.ts`.
2. Give every method file a stable, service-unique `operationId`.
3. Move that method's title, description, auth, schemas, dependencies, chrome, SEO, contracts, cache hints, and demos into the method file.
4. Replace dependency strings with explicit `{ operationId, method }` references.
5. Regenerate the registry and client contract.

Config Manager converts persisted legacy `methods` arrays to temporary method-qualified operation references while loading old configuration. The next manifest sync resolves those references to the service's published operation ids and splits a legacy multi-method mount into separate operation mounts, keeping only a renderable GET in Visual Routes. New configuration and protocol-2 manifests must use `operations`; runtime code must not publish or depend on flattened method contracts.

## Sitemap and robots

Shell services serve `/robots.txt`, `/sitemap.xml`, and sitemap chunks centrally. Themes do not implement these endpoints. Config Manager syncs route auth and SEO metadata into the app route index; old entries without an explicit `auth.required` value are treated as private until the service resyncs.

An anonymous static GET page is included automatically unless the app or operation excludes it. Dynamic routes declare a provider in the relevant `GET.ts` operation file:

```ts
import {
  RobotsAgent,
  type RouteSitemapProvider,
  type RouteRobotsPolicy
} from "@betterportal/framework";
import { listPublicPlans } from "../../plans.js";

export const sitemap: RouteSitemapProvider = async ({ tenant, app, signal }) =>
  (await listPublicPlans({ tenantId: tenant.id, appId: app.id, signal })).map((plan) => ({
    params: { planId: plan.id },
    lastModified: plan.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7
  }));

export const robots: RouteRobotsPolicy = [
  { userAgent: RobotsAgent.All, access: "allow" },
  { userAgent: RobotsAgent.GPTBot, access: "disallow" }
];
```

`sitemap` may also be `true`, `false`, or a static metadata object containing `lastModified`, `changeFrequency`, and `priority`. `false` omits the route from sitemap output but does not create a robots disallow; declare `robots` separately when both are intended. Providers return parameter values and metadata only; the shell owns the mounted app path, canonical origin, encoding, deduplication, sorting, XML escaping, and 50,000-URL/50 MB chunking. Provider parameter values are limited to 100 characters unless the service applies stricter validation.

`robots` is advisory crawler policy, never authorization. Authenticated, disabled, API-only, non-GET, unmounted, and unresolved dynamic routes do not enter the sitemap. Authentication remains enforced even when a route supplies SEO metadata.

Services expose app-scoped provider data at `GET /.well-known/bp/seo`. It is resolved through the normal trusted Origin/host context and is not global public discovery. Shells probe every service with an anonymous mounted GET page, deduplicate in-flight work, cache successes according to the app setting, cache failures for five minutes, and clear the cache after scoped-config updates. Services whose mounted routes are all authenticated or have unknown legacy auth metadata are not probed.

App SEO settings are:

- `visibility`: `auto` (default), `public`, or `private`.
- `serviceFailure`: `omit-service` (default), `known-routes`, or `error`.
- `serviceCache`: `none`, `1h`, `24h` (default), or `7d`.
- `canonicalOrigin`: optional explicit HTTP(S) origin; otherwise the shell uses the configured app hostname matched by the request.

`omit-service` removes an inaccessible service's URLs and disallows its mounted prefixes. `known-routes` retains concrete static URLs already known to Config Manager but omits failed dynamic expansion. `error` returns 503 for the entire SEO response. The shell checks every service with an anonymous mounted GET page, not only dynamic providers, and requires its probe response to permit the app origin through CORS; services that contain only authenticated or unknown-auth routes are not probed. Expired success data is never served stale after a failed refresh.

## UI renderers

HTML renderers live under `_renderer.<renderer>/` and are method/status-specific. The suffix matches `ctx.app.shell.renderer`, not the shell service identity. There is no runtime fallback between renderers.

```text
bp-routes/example/
  GET.ts
  POST.ts
  _renderer.bootstrap5/
    GET.tsx
    POST.tsx
    POST.422.tsx
    _nav.profile.GET.tsx
    card.GET.tsx
```

Rules:

- `GET.tsx` renders successful GET HTML.
- `POST.tsx` renders successful POST HTML.
- `POST.422.tsx` renders a POST-specific 422 response.
- If no matching renderer exists, BP returns JSON/API output.
- Shared UI is explicit: import or re-export a helper from both renderers.
- `index.tsx` and `index.GET.tsx` are not valid page renderer names. Use `GET.tsx`, `POST.tsx`, or `METHOD.STATUS.tsx`.
- Bootstrap1 already renders the shell/header context for the active route. Do not add duplicate top-level page headings like `<h1 class="h4 mb-3">...</h1>` in Bootstrap1 renderers unless the heading is part of the service content itself.

```tsx
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";
import type { ResponseData } from "../GET.js";

export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  return <section>{data.title}</section>;
}
```

Renderer `data` must be typed from the matching method response. Codegen rejects missing, `any`, or `unknown` render parameters, and the generated registry type-checks page, component, fragment, SSE tick, and streaming renderers against their handlers. Status renderers are method-specific (`POST.422.tsx`), so their response type is unambiguous.

Do not create `route.impl.ts`. Each HTTP method file owns its operation id, schemas, auth, permissions, dependencies, metadata, and handler boundary. Shared business logic belongs in an intentionally named domain module outside the route directory, not in a route god-module.

## Operation dependencies

Dependencies are explicit operation references exported by the method that uses them:

```ts
export const dependencies = [
  { operationId: "sync.status.read", method: "GET" },
  { serviceId: "reports", operationId: "reports.read", method: "GET" }
] as const;
```

Omit `serviceId` for the current service. For another service, `serviceId` is the dependency alias declared in `betterportal.json` and locked by `betterportal.lock.json`; it is not a runtime UUID, title, hostname, or plugin id. Codegen rejects unknown aliases and manifest construction rejects unavailable local operations. Renderer `{view.id}` tokens only resolve URLs and never declare dependencies.

A fragment-only route still has a normal method operation. For example, `/sync/status/GET.ts` owns `sync.status.read`, while `_body.status.GET.tsx` is its fragment representation. Any `/sync` GET or POST operation that uses it must explicitly declare `{ operationId: "sync.status.read", method: "GET" }`. Fragment-only operations are API mounts, participate in permissions, and are never browser navigation pages.

## Fragment, stream, and SSE selection

- Use a normal fragment for one finite request/response region such as `/sync/status`.
- Use `createStreamHandler` for a finite validated sequence that must support buffered JSON, NDJSON, or progressively rendered HTML.
- Use SSE for a long-lived server-push feed such as notifications or live status.

SSE and streamed HTML use `<path>/__sse` but do not define a second operation. They inherit the owning GET operation's id, params/query schemas, auth, permissions, dependencies, tenant/app context, and app allowlist.

## Do not patch the platform from a consumer

In a service or theme repository, BetterPortal framework/runtime packages, Config Manager, generated registries/clients/contracts, and `node_modules` are immutable. Do not patch them, hardcode runtime UUIDs or hostnames, bypass auth/allowlists, or hide contract failures behind casts. Stop, inspect this documentation and the generated contract, and re-plan with supported APIs. If support is missing, propose a separate upstream BetterPortal change rather than adding consumer-side duct tape.

`ViewRenderContext` is the renderer's server-populated second argument and is never serialized automatically. Type it directly so an added `ctx` cannot silently become `any`; codegen rejects untyped, `any`, and `unknown` context parameters.

```tsx
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";

export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  return <a href={ctx.url.uiRoute("incidents.index") ?? "#"}>{ctx.app.title}</a>;
}
```

Its limited `tenant` projection contains `id`, `slug`, `title`, and `branding`. Its limited `app` projection contains `id`, `tenantId`, `slug`, `title`, `defaultRoute`, resolved `shell`, and navigation-only auth references (`serviceId`, `loginViewId`, and `logoutViewId`). It intentionally excludes services, routes, hostnames, origin policy, theme configuration, auth verification metadata, roles, permissions, keys, and M2M configuration. Authorization and business logic remain in the route handler.

Renderer URL helpers are `ctx.url.route()` and `ctx.url.uiRoute()`, corresponding to handler `ctx.routeUrl()` and `ctx.uiRouteUrl()`. Both accept a declared dependency alias as `serviceId` and resolve it from the server-only application route index; the raw index is not exposed to renderer code. `ctx.url.route(viewId, { component: "detail" })` selects a named component on any resolved service route; `ctx.url.current({ component: "detail" })` is the current-route shorthand. Use `{ sse: true, fragment: "body.live" }` for the route's typed `/__sse` fragment URL.

Auth references are stable view IDs, never URL paths. Resolve browser navigation through the app mount:

```tsx
const loginHref = ctx.app.auth
  ? ctx.url.uiRoute(ctx.app.auth.loginViewId ?? "login.index", {
      serviceId: ctx.app.auth.serviceId,
      query: { returnTo: ctx.url.current() }
    })
  : null;

const loginAttributes = loginHref ? ctx.routeUi.link(loginHref) : {};
```

Do not add renderer-only links or platform context to the route response schema merely to make HTML rendering possible. JSON/API clients do not need that presentation plumbing.

Service-rendered HTML can reference service routes with `{view.id}` tokens:

```html
<form hx-post="{example.submit}" method="post">
<a hx-get="{profile.summary}">Profile</a>
<button hx-download="{reports.download}">Download</button>
```

The framework rewrites tokens server-side only in service-route attributes: `href`, `action`, `hx-get`, `hx-post`, `hx-put`, `hx-patch`, `hx-delete`, and `hx-download`. UI/app route mapping is not done here; themes and the shell own browser-visible paths.

## Downloads

Use normal BP routes for file and binary downloads. Services can return any binary body with `Content-Disposition`; the theme shell handles browser delivery.

For authenticated downloads from service-rendered HTML, use `hx-download`:

```html
<a hx-download="/reports/download?reportId=123" download="report.pdf">Download</a>
<button hx-download="/reports/download?reportId=123">Download</button>
<span hx-download="/reports/download?reportId=123" hx-trigger="load"></span>
```

`hx-download` is resolved like `hx-get`: root-relative paths are rewritten to the owning service origin. Unlike `hx-headers`, headers are not serialized into HTML; the shell attaches fresh BP headers at request time, fetches the response as a blob, applies any BP header directives, and saves the file. `Content-Disposition` filename wins, then the element `download` attribute, then the URL basename. Use `hx-accept` only when the endpoint needs a specific `Accept` value; otherwise the shell sends `application/octet-stream`.

Plain `href` downloads are browser-native and do not receive BP headers. Use `hx-download` for BP-authenticated files.

Raw/file endpoints use `createRawHandler`. Raw routes return a Web `Response`, skip JSON/HTML response-schema negotiation, and are always API-only/non-renderable. They still get normal BP route behavior: auth, app allowlist checks, params/query/header/body validation, tracing, `ctx.routeUrl`, and BP header directives.

```ts
import { createRawHandler } from "@betterportal/framework";

export const viewId = "reports.download";
export const title = "Report Download";

export const QuerySchema = av.object({
  reportId: av.string().minLength(1)
});

export default createRawHandler(
  { query: QuerySchema },
  async (ctx) => {
    const pdf = await loadPdf(ctx.query.reportId);
    return ctx.file(pdf, {
      filename: "report.pdf",
      contentType: "application/pdf",
      size: pdf.byteLength
    });
  }
);
```

Do not export `ResponseSchema` or HTML renderers for raw routes; codegen rejects both. Use `ctx.response(body, init)` for custom raw responses and `ctx.file(body, options)` for downloadable/inline files. `ctx.file` accepts standard `Response` bodies, including `Uint8Array`, `ArrayBuffer`, `Blob`, and `ReadableStream`.

For multipart uploads, export the framework's concrete `MultipartRequestSchema` as `MultipartSchema` and use `createRawHandler({ multipart: MultipartSchema }, ...)`. First-pass multipart support is buffered in memory and capped at 25 MiB total file bytes per request.

```ts
import { MultipartRequestSchema } from "@betterportal/framework";

export const MultipartSchema = MultipartRequestSchema;

export default createRawHandler(
  { multipart: MultipartSchema },
  async (ctx) => {
    const file = ctx.multipart.files.document;
    return ctx.response(null, { status: file ? 204 : 400 });
  }
);
```

`ctx.multipart.files` values are `{ fieldName, filename, contentType, size, data }`. Repeated form keys become arrays. Oversized requests return `413`. Use streaming/resumable upload protocols only when buffered uploads are too small for the use case.

Do not put shell/UI routing assumptions in a view file. UI paths, browser-visible hostnames, and pushed URL state belong to the HTML renderer under `_renderer.<renderer>/`. A service-side view path is not the same thing as a UI path, and a service hostname is not the same thing as the shell hostname. If the UI needs a selected tab, tenant filter, or other URL state, handle that in the renderer or through explicit schema fields supplied by the service/API model.

Service-rendered HTMX must stay in its lane. Main content may target `#bp-main` or elements owned by that content. Fragment content must target itself or descendants inside its own `data-bp-fragment` container. Do not let service HTML target `body`, theme nav, menu, or unrelated fragments; the bootstrap shell sanitizes incoming targets and request-time targets to enforce this.

## Streaming views

A GET operation that produces data incrementally (fan-out aggregation, slow upstreams) exports `ItemSchema` (+ optional `SummarySchema`) from `GET.ts` instead of `ResponseSchema`, and builds its handler with `createStreamHandler`. The handler is an async generator; its yields are validated per item and its `return` value becomes the summary.

```ts
export const ItemSchema = av.object({ id: av.string().minLength(1) });
export const SummarySchema = av.object({ total: av.int().min(0) });

export default createStreamHandler(
  { item: ItemSchema, summary: SummarySchema, query: QuerySchema },
  async function* (ctx) {
    for await (const row of slowSource(ctx.query)) yield row;
    return { total: n };
  }
);
```

One handler, negotiated representations (see [`spec/streaming.md`](../../spec/streaming.md)):

- `Accept: application/json` - buffered `{ items, summary? }` (response schema derived, never hand-written).
- `Accept: application/x-ndjson` - one frame per line as data is produced (`item`/`summary`/`error`/`end`).
- `Accept: text/html` - streamed: an instant shell wired to `<path>/__sse`, which pushes server-rendered rows per frame. With `mode=page` and a matching method renderer present, a buffered full render instead.

Streaming HTML renderers live in `_renderer.<renderer>/index.stream.tsx` exporting `renderShell`, `renderItem`, and optionally `renderSummary` / `renderError`. The shell receives `ctx.sseConnectPath` and wires `hx-ext="sse"` / `sse-swap` itself; a matching method renderer such as `GET.tsx` over `{ items, summary }` provides the buffered page render. See `bp-routes/delayed/` in the hello-view example.

## SSE files

SSE is always HTTP GET, so the handler name is `sse.ts`. Method-qualified names such as `GET.sse.ts` fail codegen.

```text
bp-routes/hello/
  GET.ts
  sse.ts
  _renderer.bootstrap5/
    _nav.clock.GET.tsx
    _nav.clock.sse.tsx
```

An event-driven SSE route has three conventional exports: `InputSchema`, `EventSchema`, and a default `createSse(...)` contract. `InputSchema` validates what service code emits. The contract maps that input to `EventSchema`, which validates and types what the connected view receives.

```ts
import * as av from "anyvali";
import { createSse } from "../../.bp-generated/route-runtime.js";

export const InputSchema = av.object({
  id: av.string().minLength(1)
});

export const EventSchema = av.object({
  id: av.string(),
  title: av.string(),
  status: av.string()
});

export default createSse(
  { input: InputSchema, event: EventSchema },
  async (input, ctx) => ctx.plugin.findIncident(input.id)
);
```

Codegen maps the route's stable `viewId` to `InputSchema`, so service/plugin code emits without importing the route module:

```ts
this.betterPortal.sse.emit(
  "incidents.index",
  { tenantId, appId },
  { id: incident.id }
);
```

The view id and input are compile-time checked; BetterPortal validates again at runtime and isolates subscribers by tenant/app. Browser-to-service events are not part of SSE; use normal validated POST/PUT/PATCH operations.

A fragment tick renderer uses `_<location>.<id>.sse.tsx` and exports `renderTick`; its GET method is inferred. Load the durable/current snapshot through normal GET, then emit individual row/component deltas. Use stable DOM ids with HTMX out-of-band upserts, coalesce bursts by record id before emitting, and refresh GET after reconnect instead of replacing the complete queue on every event.

```tsx
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";

export function renderTick(data: IncidentEvent, ctx: ViewRenderContext): HtmlRenderable {
  const detailUrl = ctx.url.route("incidents.index", {
    component: "incident-detail",
    query: { incidentId: data.incidentId }
  });
  return <tr id={`incident-${data.incidentId}`} data-detail-url={detailUrl ?? ""}></tr>;
}
```

SSE tick renderers receive the same server-populated `ViewRenderContext` as normal renderers. The context represents the underlying view route, not its `/__sse` transport endpoint.

Codegen rejects manual `handleSSE`/`tickSchema` generators and method-qualified SSE handler or renderer filenames. All SSE routes use the schema-owned `createSse(...)` contract and receive publications through `this.betterPortal.sse.emit(...)`.

Only actual renderer files should live inside `_renderer.<renderer>/`. Shared helpers should live elsewhere, because codegen treats `.tsx` files in renderer directories as renderers.

## App routes

The app route maps the visible URL to the service view:

```yaml
- id: docs
  path: /docs
  serviceId: docs-site
  viewId: docs.index
  targetPath: /docs
  title: Docs
  enabled: true
  methods:
    - GET
```

App route paths may also define params. Prefer `{name}` in `bp-config.yaml` because it is visually distinct from service-side h3 paths:

```yaml
- id: tenant-services
  path: /tenants/{tenantId}/services
  serviceId: config-manager
  viewId: services.index
  targetPath: /tenants/{tenantId}/services
  title: Tenant Services
  enabled: true
```

`{tenantId}` is matched from the visible UI path and interpolated into `targetPath` before the browser calls the service. Legacy `:tenantId` is also accepted. Keep this in the theme/app routing layer; do not parse browser URLs inside the view file to recover the same value.
