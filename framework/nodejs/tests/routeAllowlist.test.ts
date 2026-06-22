import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import * as av from "anyvali";
import { createH3Router } from "../src/adapters/h3.js";
import type { BetterPortalRegistry, RegisteredRoute } from "../src/contracts/registry.js";
import { createHandler, createRawHandler } from "../src/runtime/handler.js";
import type { RouteHandler } from "../src/contracts/route.js";
import type { BetterPortalApp, BetterPortalTenant } from "../src/contracts/platformConfig.js";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "../src/runtime/h3.js";
import { uuidv7 } from "../src/runtime/uuid.js";

const tenant: BetterPortalTenant = {
  id: uuidv7(),
  slug: "tenant",
  title: "Tenant",
  active: true,
  branding: {},
  services: [],
  activatedPlatformServices: []
};

function route(path: string, viewId: string, handler: RouteHandler = () => ({ ok: true }), response = av.object({ ok: av.bool() })): RegisteredRoute {
  return {
    viewId,
    path,
    methods: ["GET"],
    paramNames: [],
    schemas: { response },
    handlers: { GET: handler },
    title: viewId,
    description: "",
    auth: { required: false, permissions: [] },
    cacheHints: {},
    demoScenarios: [],
    themeRenderers: {}
  };
}

test("typed route factories expose plugin and BP service config context", async () => {
  class TestPlugin {
    label(): string {
      return "typed";
    }
  }

  type TestServiceConfig = {
    enabled: boolean;
  };

  const ResponseSchema = av.object({
    label: av.string().minLength(1),
    enabled: av.bool()
  });

  const handle = createHandler.forContext<TestPlugin, TestServiceConfig>()(
    { response: ResponseSchema },
    (ctx) => ({
      label: ctx.plugin?.label() ?? "missing",
      enabled: ctx.config?.enabled ?? false
    })
  );

  const result = await handle({
    config: { enabled: true },
    plugin: new TestPlugin()
  } as Parameters<typeof handle>[0]);

  assert.deepEqual(result, { label: "typed", enabled: true });
});

async function withServer(
  app: BetterPortalApp,
  registry: BetterPortalRegistry,
  handler: (baseUrl: string) => Promise<void>,
  options: { tenant?: BetterPortalTenant; serviceId?: string } = {}
): Promise<void> {
  const h3 = createBetterPortalApp();
  createH3Router(registry, h3, { resolveContext: () => ({ tenant: options.tenant ?? tenant, app }), serviceId: options.serviceId });
  const server: Server = createServer(createBetterPortalNodeHandler(h3));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  try {
    await handler(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("allows only app-mounted generated routes", async () => {
  const serviceId = uuidv7();
  const app: BetterPortalApp = {
    id: uuidv7(),
    tenantId: tenant.id,
    slug: "app",
    title: "App",
    hostnames: ["app.local"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/allowed",
    routes: [{
      id: uuidv7(),
      path: "/my/allowed",
      serviceId,
      viewId: "allowed.index",
      enabled: true,
      methods: ["GET"]
    }],
    menu: [],
    slots: [],
    fragments: {}
  };

  await withServer(app, {
    routes: [
      route("/allowed", "allowed.index"),
      route("/hidden", "hidden.index")
    ]
  }, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/allowed`, { headers: { accept: "application/json" } });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { ok: true });

    const hidden = await fetch(`${baseUrl}/hidden`, { headers: { accept: "application/json" } });
    assert.equal(hidden.status, 404);
    assert.deepEqual(await hidden.json(), { error: "Route not found" });
  });
});

test("raw routes return file responses without ResponseSchema negotiation", async () => {
  const serviceId = uuidv7();
  const app: BetterPortalApp = {
    id: uuidv7(),
    tenantId: tenant.id,
    slug: "app",
    title: "App",
    hostnames: ["app.local"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/download",
    routes: [{
      id: uuidv7(),
      path: "/download",
      serviceId,
      viewId: "download.index",
      enabled: true,
      methods: ["GET"]
    }],
    menu: [],
    slots: [],
    fragments: {}
  };

  await withServer(app, {
    routes: [{
      viewId: "download.index",
      path: "/download",
      methods: ["GET"],
      paramNames: [],
      schemas: {},
      handlers: {
        GET: createRawHandler({}, (ctx) => ctx.file(new Uint8Array([1, 2, 3]), {
          filename: "report.pdf",
          contentType: "application/pdf",
          size: 3
        }))
      },
      raw: true,
      title: "Download",
      description: "",
      auth: { required: false, permissions: [] },
      cacheHints: {},
      demoScenarios: [],
      themeRenderers: {}
    }]
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-length"), "3");
    assert.equal(response.headers.get("content-disposition"), 'attachment; filename="report.pdf"');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  });
});

test("builds service and app route URLs for the current plugin service", async () => {
  const pluginId = "service.test.reports";
  const serviceInstanceId = uuidv7();
  const scopedTenant: BetterPortalTenant = {
    ...tenant,
    services: [{
      id: serviceInstanceId,
      hostname: "http://service.local",
      serviceId: pluginId,
      capabilities: [],
      deploymentMode: "self-hosted",
      createdAt: new Date(0).toISOString(),
      enabled: true
    }]
  };
  const app: BetterPortalApp = {
    id: uuidv7(),
    tenantId: scopedTenant.id,
    slug: "app",
    title: "App",
    hostnames: ["https://app.local"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/reports/:reportId",
    routes: [{
      id: uuidv7(),
      path: "/reports/:reportId",
      serviceId: serviceInstanceId,
      viewId: "reports.detail.index",
      enabled: true,
      methods: ["GET"]
    }, {
      id: uuidv7(),
      path: "/self",
      serviceId: serviceInstanceId,
      viewId: "self.index",
      enabled: true,
      methods: ["GET"]
    }],
    menu: [],
    slots: [],
    fragments: {}
  };

  await withServer(app, {
    routes: [
      route("/reports/:reportId", "reports.detail.index"),
      route(
        "/self",
        "self.index",
        (ctx) => ({
          serviceUrl: ctx.routeUrl?.("reports.detail.index", { absolute: true, params: { reportId: "r1" }, query: { token: "t1" } }) ?? null,
          uiUrl: ctx.uiRouteUrl?.("reports.detail.index", { absolute: true, params: { reportId: "r1" }, query: { token: "t1" } }) ?? null
        }),
        av.object({ serviceUrl: av.string(), uiUrl: av.string() })
      )
    ]
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/self`, { headers: { accept: "application/json" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      serviceUrl: "http://service.local/reports/r1?token=t1",
      uiUrl: "https://app.local/reports/r1?token=t1"
    });
  }, { tenant: scopedTenant, serviceId: pluginId });
});
