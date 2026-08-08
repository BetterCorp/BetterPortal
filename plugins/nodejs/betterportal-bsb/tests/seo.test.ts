import assert from "node:assert/strict";
import test from "node:test";
import type { BetterPortalResolvedApp } from "@betterportal/framework";
import { buildSeoDocuments, buildSitemapChunks, buildSitemapIndex } from "../src/seo.js";

function app(): BetterPortalResolvedApp {
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
    seo: { visibility: "auto", serviceFailure: "omit-service", serviceCache: "24h" },
    routes: [
      {
        id: "019f0000-0000-7000-8000-000000000003",
        kind: "page",
        path: "/plans",
        serviceId: "019f0000-0000-7000-8000-000000000004",
        viewId: "plans.index",
        enabled: true,
        methods: ["GET"],
        authRequired: false,
        sitemap: { kind: "default" }
      },
      {
        id: "019f0000-0000-7000-8000-000000000005",
        kind: "page",
        path: "/plans/:planId",
        serviceId: "019f0000-0000-7000-8000-000000000004",
        viewId: "plans.detail",
        enabled: true,
        methods: ["GET"],
        authRequired: false,
        sitemap: { kind: "provider" }
      },
      {
        id: "019f0000-0000-7000-8000-000000000006",
        kind: "page",
        path: "/private",
        serviceId: "019f0000-0000-7000-8000-000000000004",
        viewId: "private.index",
        enabled: true,
        methods: ["GET"]
      }
    ],
    menu: [],
    slots: [],
    fragments: {},
    shellFragments: {}
  };
}

test("shell SEO includes anonymous static and provider routes while unknown auth stays private", () => {
  const documents = buildSeoDocuments(app(), "https://example.test", [{
    routeId: "019f0000-0000-7000-8000-000000000005",
    entries: [{ params: { planId: "starter" }, priority: 0.8 }]
  }]);
  assert.deepEqual(documents.sitemap.map((entry) => entry.loc), [
    "https://example.test/plans",
    "https://example.test/plans/starter"
  ]);
  assert.match(documents.robots, /Disallow: \/private/);
  assert.match(documents.robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});

test("omit-service removes known URLs and disallows the service paths", () => {
  const documents = buildSeoDocuments(
    app(),
    "https://example.test",
    [],
    new Set(["019f0000-0000-7000-8000-000000000004"])
  );
  assert.equal(documents.sitemap.length, 0);
  assert.match(documents.robots, /Disallow: \/plans/);
});

test("legacy apps fail closed and sitemap exclusion does not become a robots disallow", () => {
  const base = app();
  const legacy = {
    ...base,
    seo: undefined,
    routes: base.routes.map((route) => route.path === "/plans"
      ? { ...route, sitemap: { kind: "exclude" as const } }
      : route)
  } as BetterPortalResolvedApp;
  const available = buildSeoDocuments(legacy, "https://example.test", []);
  assert.doesNotMatch(available.sitemap.map((entry) => entry.loc).join("\n"), /\/plans$/m);
  assert.match(available.robots, /Allow: \/plans/);

  const unavailable = buildSeoDocuments(
    legacy,
    "https://example.test",
    [],
    new Set(["019f0000-0000-7000-8000-000000000004"])
  );
  assert.equal(unavailable.sitemap.length, 0);
  assert.match(unavailable.robots, /Disallow: \/plans/);
});

test("sitemap XML is escaped and index uses chunk routes", () => {
  const chunks = buildSitemapChunks([{ loc: "https://example.test/a?x=1&y=2" }]);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0], /x=1&amp;y=2/);
  assert.match(buildSitemapIndex("https://example.test", 2), /\/sitemaps\/2\.xml/);
});
