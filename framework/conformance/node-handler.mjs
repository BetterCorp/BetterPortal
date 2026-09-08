import { importSchema } from "anyvali";
import { createHandler } from "../nodejs/lib/runtime/handler.js";
import { createBetterPortalApp } from "../nodejs/lib/runtime/h3.js";
import { createH3Router } from "../nodejs/lib/adapters/h3.js";

export async function handlerRequest(body) {
  let invoked = false;
  const schemas = { response: importSchema(body.response), ...Object.fromEntries(Object.entries(body.schemas).map(([key, value]) => [key, importSchema(value)])) };
  const handler = createHandler(schemas, ctx => {
    invoked = true;
    return Object.hasOwn(body, "result") ? body.result : Object.fromEntries(["params", "query", "headers", "request"].map(key => [key, ctx[key]]));
  });
  const auth = { required: false, callers: ["user"], permissions: [] };
  const operation = { operationId: "check", method: "POST", title: "Check", description: "Check", schemas, handler, auth, cacheHints: {}, demoScenarios: [] };
  const route = { viewId: "check", path: "/check/:key", paramNames: ["key"], methods: ["POST"], schemas,
    handlers: { POST: handler }, methodRoutes: { POST: operation }, title: "Check", description: "Check", renderers: {} };
  const app = createBetterPortalApp();
  createH3Router({ routes: [route] }, app, { resolveContext: () => ({ tenant: { id: body.tenantId, services: [] },
    app: { id: body.appId, routes: [{ viewId: "check", operations: ["check"], targetPath: "/check/:key" }], fragments: {}, slots: [] } }) });
  const values = body.values;
  const url = new URL("http://service.test/check/" + encodeURIComponent(values.params?.key ?? "item"));
  for (const [key, value] of Object.entries(values.query ?? {}))
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
  const response = await app.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...values.headers }, body: JSON.stringify(values.request ?? {}) }));
  return { status: response.status, invoked, ...(response.status === 200 ? { output: await response.json() } : {}) };
}
