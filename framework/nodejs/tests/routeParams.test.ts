import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildManifestFromRegistry,
  buildServiceViewUrl,
  resolveAppRoute,
  type BetterPortalApp,
  type BetterPortalRegistry,
  type RegisteredRoute
} from "../src/index.js";
import { scanRoutes } from "../src/codegen/scanner.js";

function writeRoute(base: string, segments: string[]): void {
  const directory = join(base, "bp-routes", ...segments);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "index.ts"), 'export const title = "Route";\n');
}

test("filesystem params publish canonical required and optional variants", () => {
  const base = mkdtempSync(join(tmpdir(), "bp-route-params-"));
  writeRoute(base, ["plans", "[planId]"]);
  writeRoute(base, ["reports", "[[reportId]]"]);
  const routes = scanRoutes(base).routes;
  assert.deepEqual(
    routes.filter((route) => route.viewId === "plans.$planId.index").map((route) => route.path),
    ["/plans/:planId"]
  );
  assert.deepEqual(
    routes.filter((route) => route.viewId === "reports.$reportId.index").map((route) => route.path),
    ["/reports", "/reports/:reportId"]
  );
});

test("catch-all filesystem params fail codegen", () => {
  const base = mkdtempSync(join(tmpdir(), "bp-route-catchall-"));
  writeRoute(base, ["files", "[...path]"]);
  assert.throws(() => scanRoutes(base), /catch-all params are not supported/);
});

test("filesystem parameter names must be canonical identifiers", () => {
  const base = mkdtempSync(join(tmpdir(), "bp-route-invalid-param-"));
  writeRoute(base, ["files", "[1path]"]);
  assert.throws(() => scanRoutes(base), /Unsupported route segment/);
});

function registeredRoute(path: string, paramNames: string[]): RegisteredRoute {
  return {
    viewId: "reports.$reportId.index",
    path,
    methods: ["GET"],
    paramNames,
    schemas: {},
    handlers: {},
    title: "Reports",
    description: "",
    auth: { required: false, permissions: [] },
    renderers: {},
    demoScenarios: [],
    cacheHints: { ttlSeconds: 0, varyBy: [] }
  };
}

test("manifest groups runtime variants without losing their paths", () => {
  const registry: BetterPortalRegistry = {
    routes: [
      registeredRoute("/reports", []),
      registeredRoute("/reports/:reportId", ["reportId"])
    ]
  };
  const manifest = buildManifestFromRegistry(registry, { version: "1.0.0" }, {
    pluginId: "example.reports",
    title: "Reports",
    description: "Reports"
  });
  assert.equal(manifest.views.length, 1);
  assert.equal(manifest.views[0].path, "/reports/:reportId");
  assert.deepEqual(manifest.views[0].pathVariants, ["/reports/:reportId", "/reports"]);
});

function app(routes: BetterPortalApp["routes"]): BetterPortalApp {
  return {
    id: "019f0000-0000-7000-8000-000000000001",
    tenantId: "019f0000-0000-7000-8000-000000000002",
    slug: "app",
    title: "App",
    hostnames: ["https://example.test"],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/",
    routes,
    menu: [],
    slots: [],
    fragments: {},
    shellFragments: {}
  };
}

const dynamicRoute = {
  id: "019f0000-0000-7000-8000-000000000003",
  kind: "page" as const,
  path: "/plans/:planId",
  serviceId: "019f0000-0000-7000-8000-000000000004",
  viewId: "plans.index",
  enabled: true,
  methods: ["GET" as const]
};

test("static app routes win and fixed service params resolve without leaking placeholders", () => {
  const staticRoute = { ...dynamicRoute, id: "019f0000-0000-7000-8000-000000000005", path: "/plans" };
  assert.equal(resolveAppRoute(app([dynamicRoute, staticRoute]), "/plans")?.id, staticRoute.id);

  const mounted = {
    ...staticRoute,
    resolvedServicePath: "/plans/:planId",
    fixedParams: { planId: "default1" }
  };
  assert.equal(
    buildServiceViewUrl({ hostname: "https://plans.example" }, mounted, "/plans"),
    "https://plans.example/plans/default1"
  );
  assert.equal(
    buildServiceViewUrl({ hostname: "https://plans.example" }, { ...mounted, fixedParams: undefined }, "/plans"),
    null
  );
});
