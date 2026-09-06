import { object } from "anyvali";
import { createHandler } from "../nodejs/lib/runtime/handler.js";
import { createBetterPortalApp } from "../nodejs/lib/runtime/h3.js";
import { createH3Router } from "../nodejs/lib/adapters/h3.js";
import { ScopedServiceConfigSchema } from "../nodejs/lib/contracts/scopedConfig.js";

export async function accessRequest(body) {
  const snapshot = ScopedServiceConfigSchema.parse(body.snapshot);
  const tenant = snapshot.tenants.find(item => item.id === body.tenantId && item.active);
  const context = snapshot.apps.find(item => item.id === body.appId && item.tenantId === body.tenantId);
  if (!tenant || !context) return { allowed: false };
  const schemas = { response: object({}) };
  const handler = createHandler(schemas, () => ({}));
  const methods = ["GET", "POST"];
  const route = { viewId: "check", path: body.path ?? "/check/:key", paramNames: ["key"], methods, schemas,
    handlers: Object.fromEntries(methods.map(method => [method, handler])),
    methodRoutes: Object.fromEntries(methods.map(method => [method, { operationId: "check." + method.toLowerCase(),
      method, title: "Check", description: "Check", schemas, handler, auth: { required: false, callers: ["user"], permissions: [] }, cacheHints: {}, demoScenarios: [] }])),
    title: "Check", description: "Check", renderers: {} };
  const app = createBetterPortalApp();
  createH3Router({ routes: [route] }, app, { resolveContext: () => ({ tenant, app: context }) });
  const url = new URL("http://service.test" + route.path.replace(":key", "item"));
  if (body.fragment) url.searchParams.set("_f", body.fragment);
  const response = await app.fetch(new Request(url, { method: body.method ?? "GET", headers: { accept: "application/json" } }));
  if (![200, 404].includes(response.status)) throw new Error("Unexpected access result: " + response.status + " " + await response.text());
  return { allowed: response.status === 200 };
}
