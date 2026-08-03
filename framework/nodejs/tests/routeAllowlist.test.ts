import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import * as av from "anyvali";
import { createH3Router, type H3RouterObservabilityOptions } from "../src/adapters/h3.js";
import type { JwtClaims } from "../src/contracts/auth.js";
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
    renderers: {}
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
  options: { tenant?: BetterPortalTenant; serviceId?: string; router?: H3RouterObservabilityOptions } = {}
): Promise<void> {
  const h3 = createBetterPortalApp();
  createH3Router(registry, h3, {
    ...options.router,
    resolveContext: options.router?.resolveContext ?? (() => ({ tenant: options.tenant ?? tenant, app })),
    serviceId: options.serviceId
  });
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

test("authenticated BP well-known routes use route-aware auth and skip app activation", async () => {
  const app: BetterPortalApp = {
    id: uuidv7(),
    tenantId: tenant.id,
    slug: "management",
    title: "Management",
    hostnames: ["root.local"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/",
    routes: [],
    menu: [],
    slots: [],
    fragments: {}
  };
  const managementRoute = {
    ...route("/.well-known/bp/config/example", "config.example"),
    auth: { required: true, permissions: [] }
  } satisfies RegisteredRoute;
  let activationChecks = 0;
  const claims: JwtClaims = {
    iss: "https://auth.local",
    aud: "management",
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv7(),
    realm: "runtime",
    tenantId: tenant.id,
    appId: app.id,
    roles: ["*"],
    tokenType: "access"
  };

  await withServer(app, { routes: [managementRoute] }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/.well-known/bp/config/example`, {
      headers: { authorization: "Bearer management-token", accept: "application/json" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(activationChecks, 0);
  }, {
    router: {
      resolveAuth: (_event, resolvedRoute) => {
        assert.equal(resolvedRoute, managementRoute);
        return {
          verifier: { verify: async (token) => {
            assert.equal(token, "management-token");
            return claims;
          } },
          tenantId: tenant.id,
          appId: app.id,
          platformRoot: { tenantId: tenant.id, appId: app.id }
        };
      },
      validateTenantApp: () => {
        activationChecks++;
        return { allowed: false };
      }
    }
  });
});

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
      renderers: {}
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

test("absolute app route URLs prefer the matched request origin", async () => {
  const pluginId = "service.test.auth";
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
    hostnames: ["https://betterportal.cloud", "https://my.betterportal.app"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/login-2",
    routes: [{
      id: uuidv7(),
      path: "/login-2",
      serviceId: serviceInstanceId,
      viewId: "login.index",
      enabled: true,
      methods: ["GET"]
    }],
    menu: [],
    slots: [],
    fragments: {}
  };

  await withServer(app, {
    routes: [
      route(
        "/login",
        "login.index",
        (ctx) => ({ uiUrl: ctx.uiRouteUrl?.("login.index", { absolute: true }) ?? null }),
        av.object({ uiUrl: av.string() })
      )
    ]
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      headers: { accept: "application/json", origin: "https://my.betterportal.app" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      uiUrl: "https://my.betterportal.app/login-2"
    });
  }, { tenant: scopedTenant, serviceId: pluginId });
});

test("uiRouteUrl only resolves GET page mounts", async () => {
  const pluginId = "service.test.routes";
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
    defaultRoute: "/page",
    routes: [
      { id: uuidv7(), kind: "page", path: "/page", serviceId: serviceInstanceId, viewId: "page.index", enabled: true, methods: ["GET"] },
      { id: uuidv7(), kind: "api", path: "/_bp/service/test/api", serviceId: serviceInstanceId, viewId: "api.index", enabled: true, methods: ["GET"] },
      { id: uuidv7(), kind: "page", path: "/mutate", serviceId: serviceInstanceId, viewId: "mutation.index", enabled: true, methods: ["POST"] },
      { id: uuidv7(), kind: "page", path: "/self", serviceId: serviceInstanceId, viewId: "self.index", enabled: true, methods: ["GET"] }
    ],
    menu: [],
    slots: [],
    fragments: {}
  };

  await withServer(app, {
    routes: [
      route("/page", "page.index"),
      route("/api", "api.index"),
      route("/mutate", "mutation.index"),
      route("/self", "self.index", (ctx) => ({
        uiPage: ctx.uiRouteUrl?.("page.index") ?? null,
        uiApi: ctx.uiRouteUrl?.("api.index") ?? null,
        uiMutation: ctx.uiRouteUrl?.("mutation.index") ?? null,
        serviceApi: ctx.routeUrl?.("api.index") ?? null,
        serviceMutation: ctx.routeUrl?.("mutation.index") ?? null
      }), av.any())
    ]
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/self`, { headers: { accept: "application/json" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      uiPage: "/page",
      uiApi: null,
      uiMutation: null,
      serviceApi: "/api",
      serviceMutation: "/mutate"
    });
  }, { tenant: scopedTenant, serviceId: pluginId });
});
test("route caller modes default to user and delegated calls verify both credentials", async () => {
  const serviceId = uuidv7();
  const sourceServiceId = uuidv7();
  const app: BetterPortalApp = {
    id: uuidv7(),
    tenantId: tenant.id,
    slug: "caller-modes",
    title: "Caller modes",
    hostnames: ["caller.local"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/delegated",
    routes: [
      { id: uuidv7(), path: "/delegated", serviceId, viewId: "delegated.action", enabled: true, methods: ["GET"] },
      { id: uuidv7(), path: "/user", serviceId, viewId: "user.action", enabled: true, methods: ["GET"] }
    ],
    menu: [],
    slots: [],
    fragments: {}
  };
  const responseSchema = av.object({ mode: av.string(), user: av.bool(), service: av.bool() });
  const delegatedRoute = {
    ...route("/delegated", "delegated.action", (ctx) => ({
      mode: ctx.callerMode ?? "none",
      user: Boolean(ctx.user),
      service: Boolean(ctx.serviceCaller)
    }), responseSchema),
    auth: { required: true, callers: ["delegated"], permissions: [] }
  } satisfies RegisteredRoute;
  const userRoute = {
    ...route("/user", "user.action"),
    auth: { required: true, permissions: [] }
  } satisfies RegisteredRoute;
  const now = Math.floor(Date.now() / 1000);
  const userClaims: JwtClaims = {
    iss: "https://auth.local",
    aud: "caller-modes",
    sub: "user",
    exp: now + 60,
    iat: now,
    jti: uuidv7(),
    realm: "runtime",
    tenantId: tenant.id,
    appId: app.id,
    roles: [],
    tokenType: "access"
  };
  const serviceToken = `${Buffer.from(JSON.stringify({ alg: "RS256", typ: "BP-S2S-JWT", kid: "test" })).toString("base64url")}.${Buffer.from("{}").toString("base64url")}.signature`;

  await withServer(app, { routes: [delegatedRoute, userRoute] }, async (baseUrl) => {
    const headers = {
      authorization: "Bearer user-token",
      "x-bp-service-authorization": `Bearer ${serviceToken}`,
      "x-bp-service-id": sourceServiceId,
      "x-bp-tenant-id": tenant.id,
      "x-bp-app-id": app.id,
      accept: "application/json"
    };
    const delegated = await fetch(`${baseUrl}/delegated`, { headers });
    assert.equal(delegated.status, 200);
    assert.deepEqual(await delegated.json(), { mode: "delegated", user: true, service: true });

    assert.equal((await fetch(`${baseUrl}/delegated`, { headers: { authorization: "Bearer user-token" } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/delegated`, { headers: { ...headers, "x-bp-tenant-id": uuidv7() } })).status, 401);
    assert.equal((await fetch(`${baseUrl}/user`, {
      headers: { ...headers, authorization: `Bearer ${serviceToken}`, "x-bp-service-authorization": "" }
    })).status, 403);
  }, {
    serviceId,
    router: {
      resolveAuth: () => ({
        verifier: { verify: async (token) => {
          assert.equal(token, "user-token");
          return userClaims;
        } },
        serviceVerifier: { verify: async (token, context) => {
          assert.equal(token, serviceToken);
          assert.equal(context.mode, "delegated");
          assert.equal(context.sourceServiceId, sourceServiceId);
          return {
            iss: sourceServiceId,
            sub: sourceServiceId,
            aud: serviceId,
            tenantId: tenant.id,
            appId: app.id,
            bindingId: uuidv7(),
            iat: now,
            exp: now + 60,
            jti: uuidv7(),
            tokenType: "service"
          };
        } },
        tenantId: tenant.id,
        appId: app.id
      })
    }
  });
});
