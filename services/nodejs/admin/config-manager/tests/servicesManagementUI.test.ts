import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { toHtmlString } from "@betterportal/framework";
import { ResponseSchema } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/GET.js";
import { render } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_renderer.bootstrap5/GET.js";

test("service registration authenticates management calls without sending admin credentials to the installed service", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = [];
  const management: Array<{ path: string; authorization?: string }> = [];
  const external: Array<{ path: string; authorization?: string }> = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(`window.BetterPortalAuth = { fetch: (url, options = {}) => {
    const headers = new Headers(options.headers); headers.set("Authorization", "Bearer management-test");
    return fetch(url, { ...options, headers });
  } };`);
  const data = ResponseSchema.parse({ title: "Services", services: [], tenants: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "https://manager.test/prefix" });
  await page.route("https://manager.test/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === "/services") return route.fulfill({ contentType: "text/html", body: "<!doctype html><main id='bp-main'>" + toHtmlString(render(data)) + "</main>" });
    management.push({ path, authorization: request.headers().authorization });
    if (request.headers().authorization !== "Bearer management-test") return route.fulfill({ status: 401, json: { error: "Missing token" } });
    if (path.endsWith("/shared-services")) return route.fulfill({ json: { id: "shared-service" } });
    if (path.endsWith("/services/begin-install")) return route.fulfill({ json: { setupToken: "setup-test", cpUrl: "https://manager.test" } });
    return route.fulfill({ contentType: "text/html", body: "<p id='refreshed'>Refreshed</p>" });
  });
  await page.route("https://external.test/**", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    external.push({ path, authorization: request.headers().authorization });
    const headers = { "access-control-allow-origin": "https://manager.test", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path.endsWith("/manifest")) return route.fulfill({ json: { pluginId: "org.example.external", title: "External", version: "1.0.0", capabilities: [] }, headers });
    assert.deepEqual(request.postDataJSON(), { setupToken: "setup-test", cpUrl: "https://manager.test" });
    return route.fulfill({ json: { status: "ok" }, headers });
  });
  await page.goto("https://manager.test/services");
  await page.locator('#bp-shared-service-form input[name="baseUrl"]').fill("https://external.test");
  await page.locator('#bp-shared-service-form button[type="submit"]').click();
  try { await page.waitForSelector("#refreshed", { timeout: 5000 }); }
  catch (error) { throw new Error(JSON.stringify({ errors, management, external, alerts: await page.locator("#bp-services-alerts").textContent() }), { cause: error }); }
  assert.deepEqual(management.map(request => request.path), ["/prefix/.well-known/bp/admin/shared-services", "/prefix/.well-known/bp/admin/services/begin-install", "/prefix/services"]);
  assert.ok(management.every(request => request.authorization === "Bearer management-test"));
  assert.ok(external.some(request => request.path.endsWith("/install")));
  assert.ok(external.every(request => request.authorization === undefined));
  assert.deepEqual(errors, []);
});

test("Bootstrap theme Configure uses the ticketed configuration client", () => {
  for (const serviceId of ["org.betterportal.theme.bootstrap1", "org.betterportal.theme.bootstrap2"]) {
    const data = ResponseSchema.parse({
      title: "Services", adminApiBase: "/.well-known/bp/admin",
      tenants: [{ id: "tenant", title: "Tenant" }],
      apps: [{ id: "app", tenantId: "tenant", title: "App" }],
      tenantApps: { tenant: [{ id: "app", title: "App" }] },
      services: [{
        id: "instance", hostname: "https://theme.example", serviceId,
        title: "Theme", createdAt: new Date().toISOString(), enabled: true,
        scope: "tenant", tenantId: "tenant", pushBase: "/theme", capabilities: [],
        supportsCustomUi: true, customUiPath: "/.well-known/bp/config/ui",
        configManifestKnown: true, hasConfigurableOptions: true
      }]
    });
    const html = toHtmlString(render(data));
    assert.match(html, /hx-get="\/\.well-known\/bp\/admin\/configure\?/);
    assert.doesNotMatch(html, /hx-get="https:\/\/theme\.example\/\.well-known\/bp\/config\/ui\?/);
  }
});
