# Routes and Views

BetterPortal routes are file-based inside each service.

Codegen scans `bp-routes/` and creates the service registry. Do not hand-write the registry.

## File convention

```text
bp-routes/
  docs/
    index.ts
    _theme.bootstrap1/
      index.tsx
  docs/
    [section]/
      [page]/
        index.ts
        _theme.bootstrap1/
          index.tsx
```

Directory names become service paths. Bracketed names become params.

For service route files, use bracketed directory names for path params:

```text
bp-routes/
  tenants/
    [tenantId]/
      services/
        index.ts
```

That registers the service path `/tenants/:tenantId/services`; handlers read the value from `ctx.params.tenantId`.

Use double brackets for optional params:

```text
bp-routes/
  tenants/
    [[tenantId]]/
      services/
        index.ts
```

That registers both `/tenants/services` and `/tenants/:tenantId/services` against the same view. `ctx.params.tenantId` is `undefined` on the list route and populated on the tenant-specific route.

## View files

A view file exports schemas, metadata, and handlers.

```ts
export const ResponseSchema = av.object({
  title: av.string().minLength(1)
});

export const title = "Example View";
export const description = "Example BetterPortal view.";
export const viewId = "example.index";
export const chrome = { fullScreen: false };
export const dependencies = ["example.detail.index"];

export const handleGet = createHandler(
  { response: ResponseSchema },
  async () => ({ title: "Example View" })
);
```

View files are service API boundaries. They should validate inputs, build the typed response model, and return JSON/HTML-negotiable data through `createHandler`.

Route handlers can import handler factories from two places:

- `@betterportal/framework` keeps `ctx.plugin` as `unknown` and `ctx.config` as `Record<string, unknown>`.
- `../.bp-generated/route-runtime.js` or the correct relative path to it types those fields for the current service plugin.

Prefer the generated route runtime when a handler needs `ctx.plugin` or BP service config:

```ts
import { createHandler } from "../.bp-generated/route-runtime.js";

export const ResponseSchema = av.object({ enabled: av.bool() });

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => ({
    enabled: ctx.config?.enabled ?? false
  })
);
```

Codegen creates that runtime from exports on the plugin `index.ts`. Export `Plugin` for `ctx.plugin` and export `ServiceConfig` for `ctx.config`.

```ts
export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  // ...
}

export interface MyBpServiceConfig {
  enabled: boolean;
}

export type ServiceConfig = MyBpServiceConfig;
```

`ctx.config` is the BetterPortal-managed service configuration resolved for the current tenant/app scope. It is not the BSB plugin startup config from `this.config`. Use `ctx.config` for customer/tenant/app runtime settings, and use `ctx.plugin` when a route needs methods or state on the running plugin instance.

Export `viewId` for any route referenced by app config, permissions, dependencies, or code. If omitted, codegen derives it from the file path, which is fine for throwaway views but changes when files move. Build validation fails on duplicate view ids.

Route chrome is service-declared metadata that themes may use before loading the route content and after HTMX responses. Use `export const chrome = { fullScreen: true }` for routes such as login/setup screens that should render without the normal app shell. Chrome is a flat object; values must be `string`, `number`, or `boolean`. The framework serializes those values onto HTML response content types as `bp-chrome-*` parameters, e.g. `text/html; theme=bootstrap1; mode=page; bp-chrome-full-screen=true; charset=utf-8`. The value is also emitted into the service manifest and copied into app route config during sync; an explicit `apps[].routes[].chrome` value overrides the service default.

Route dependencies are service-declared view ids that must be mounted with a route for API/detail flows. Use `export const dependencies = ["clients.detail.index"]` when a rendered view calls another service view such as `/clients/:clientId`. Config-manager auto-adds those dependency routes when the parent route is mounted. Dependency/API routes use the same `apps[].routes[]` model, but the Route Designer disables UI-only fields such as mount path, display title, and query string for non-renderable views.

Handlers that need a service-facing URL for another view should use `ctx.routeUrl(viewId, options)`. It resolves the registered service route and, when `absolute: true`, uses the service hostname/base URL.

```ts
const url = ctx.routeUrl?.("reports.detail.index", {
  absolute: true,
  params: { reportId },
  query: { token }
});
```

Handlers that need the browser-visible app route should use `ctx.uiRouteUrl(viewId, options)`. It resolves tenant service ids, shared-service activation ids, and the current plugin id before returning the app route path; when `absolute: true`, it uses the app hostname/base URL.

Do not manually scan `ctx.app.routes` and `ctx.tenant.services` unless the framework helper cannot express the case. App routes store service-instance UUIDs; `ctx.serviceId` is usually the plugin id.

HTTP methods are service manifest metadata. Do not make route methods user-editable; config-manager sync updates persisted route methods from the latest manifest. If a view disappears from a service manifest, config-manager disables matching app routes instead of deleting them.

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

export const handleGet = createRawHandler(
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

Do not export `ResponseSchema` or theme renderers for raw routes; codegen rejects both. Use `ctx.response(body, init)` for custom raw responses and `ctx.file(body, options)` for downloadable/inline files. `ctx.file` accepts standard `Response` bodies, including `Uint8Array`, `ArrayBuffer`, `Blob`, and `ReadableStream`.

For multipart uploads, export `MultipartSchema` and use `createRawHandler({ multipart: MultipartSchema }, ...)`. First-pass multipart support is buffered in memory and capped at 25 MiB total file bytes per request.

```ts
export const MultipartSchema = av.object({
  fields: av.record(av.any()),
  files: av.record(av.any())
});

export const handlePost = createRawHandler(
  { multipart: MultipartSchema },
  async (ctx) => {
    const file = ctx.multipart.files.document;
    return ctx.response(null, { status: file ? 204 : 400 });
  }
);
```

`ctx.multipart.files` values are `{ fieldName, filename, contentType, size, data }`. Repeated form keys become arrays. Oversized requests return `413`. Use streaming/resumable upload protocols only when buffered uploads are too small for the use case.

Do not put theme/UI routing assumptions in a view file. UI paths, browser-visible hostnames, and pushed URL state belong to the active theme renderer under `_theme.<themeId>/`. A service-side view path is not the same thing as a UI path, and a service hostname is not the same thing as the theme hostname. If a themed UI needs a selected tab, tenant filter, or other URL state, handle that in the themed renderer or through explicit schema fields supplied by the service/API model.

Service-rendered HTMX must stay in its lane. Main content may target `#bp-main` or elements owned by that content. Fragment content must target itself or descendants inside its own `data-bp-fragment` container. Do not let service HTML target `body`, theme nav, menu, or unrelated fragments; the bootstrap shell sanitizes incoming targets and request-time targets to enforce this.

## Streaming views

A view that produces data incrementally (fan-out aggregation, slow upstreams) exports `ItemSchema` (+ optional `SummarySchema`) instead of `ResponseSchema`, and builds its handler with `createStreamHandler`. The handler is an async generator; its yields are validated per item and its `return` value becomes the summary.

```ts
export const ItemSchema = av.object({ id: av.string().minLength(1) });
export const SummarySchema = av.object({ total: av.int().min(0) });

export const handleGet = createStreamHandler(
  { item: ItemSchema, summary: SummarySchema, query: QuerySchema },
  async function* (ctx) {
    for await (const row of slowSource(ctx.query)) yield row;
    return { total: n };
  }
);
```

One handler, negotiated representations (see [`spec/streaming.md`](../../spec/streaming.md)):

- `Accept: application/json` — buffered `{ items, summary? }` (response schema derived, never hand-written).
- `Accept: application/x-ndjson` — one frame per line as data is produced (`item`/`summary`/`error`/`end`).
- `Accept: text/html` — streamed: an instant shell wired to `<path>/__sse`, which pushes server-rendered rows per frame. With `mode=page` and a page renderer present, a buffered full render instead.

Streaming HTML renderers live in `_theme.<themeId>/index.stream.tsx` exporting `renderShell`, `renderItem`, and optionally `renderSummary` / `renderError`. The shell receives `ctx.sseConnectPath` and wires `hx-ext="sse"` / `sse-swap` itself; a plain `index.tsx` page renderer over `{ items, summary }` provides the buffered fallback. See `bp-routes/delayed/` in the hello-view example.

## Theme renderers

HTML renderers live under `_theme.<themeId>/`.

```tsx
export function render(data: ResponseData): HtmlRenderable {
  return <section>{data.title}</section>;
}
```

Only actual renderer files should live inside `_theme.<themeId>/`. Shared helpers should live elsewhere, because codegen treats `.tsx` files in theme directories as renderers.

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
