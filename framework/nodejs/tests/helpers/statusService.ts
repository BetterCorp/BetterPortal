import * as av from "anyvali";
import { createH3Router } from "../../src/adapters/h3.js";
import type { BetterPortalApp, BetterPortalTenant } from "../../src/contracts/platformConfig.js";
import type { RegisteredRoute, RegisteredViewRenderer } from "../../src/contracts/registry.js";
import { createHandler } from "../../src/runtime/handler.js";
import { createBetterPortalApp } from "../../src/runtime/h3.js";
import { jsx } from "../../src/jsx-runtime.js";

const ResponseSchema = av.object({ message: av.string() });
const RequestSchema = av.object({ name: av.string().minLength(1) }).unknownKeys("reject");
export function statusService(options: {
  render?: RegisteredViewRenderer["render"]; statusRenderer?: boolean; authRequired?: boolean;
} = {}) {
  let calls = 0;
  const handler = createHandler({ request: RequestSchema, response: ResponseSchema }, ctx => {
    calls++;
    ctx.setStatus(422);
    ctx.diagnostic({ code: "form.invalid_pair", reason: "The supplied record requires correction" });
    return { message: "Choose a different related record." };
  });
  const method = { method: "POST" as const, operationId: "form.save", title: "Save", description: "Validate a form",
    schemas: { request: RequestSchema, response: ResponseSchema }, handler,
    auth: { required: options.authRequired ?? false, permissions: [] }, cacheHints: {}, demoScenarios: [] };
  const render: RegisteredViewRenderer["render"] = options.render ?? (data => jsx("p", { id: "service-validation", children: ResponseSchema.parse(data).message }));
  const page = { rendererId: "default", type: "page" as const, method: "POST" as const, render };
  const route: RegisteredRoute = {
    ...method, viewId: "form.index", path: "/save", methods: ["POST"], paramNames: [], handlers: { POST: handler }, methodRoutes: { POST: method },
    renderers: { bootstrap5: { pages: [], components: [], fragments: [] } },
    statusRenderers: { bootstrap5: {
      ...(options.statusRenderer === false ? {} : { 422: {
        pages: [page], components: { errors: { ...page, rendererId: "errors", type: "component" as const } },
        fragments: { "body.errors": { ...page, rendererId: "errors", type: "fragment" as const, fragmentLocation: "body", fragmentId: "errors" } }
      } }),
      400: { pages: [{ ...page, render: () => jsx("main", { id: "framework-error", children: "Invalid request" }) }] },
      401: { pages: [{ ...page, render: () => jsx("main", { id: "auth-error", children: "Sign in required" }) }] }
    } }
  };
  const appConfig = {
    id: "app", tenantId: "tenant", slug: "app", title: "Form", hostnames: ["app.test"], originOverrides: [], refererOverrides: [],
    defaultRoute: "/save", shell: { serviceId: "service", service: "test", renderer: "bootstrap5" },
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} }, menu: [], slots: [], fragments: {}, shellFragments: {},
    routes: [{ id: "save", kind: "api", path: "/save", serviceId: "service", viewId: route.viewId, enabled: true, operations: [method.operationId] }]
  } satisfies BetterPortalApp;
  const tenant: BetterPortalTenant = { id: "tenant", slug: "tenant", title: "Tenant", active: true, branding: {}, services: [], activatedPlatformServices: [] };
  const app = createBetterPortalApp();
  app.use("/**", event => { (event as unknown as { __bpApp: BetterPortalApp }).__bpApp = appConfig; });
  createH3Router({ routes: [route] }, app, { serviceId: "service", resolveContext: () => ({ tenant, app: appConfig }) });
  return { app, calls: () => calls, request: (accept: string, query = "", name = "Synthetic") => app.fetch(new Request(`https://service.test/save${query}`, {
    method: "POST", headers: { accept, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name })
  })) };
}
