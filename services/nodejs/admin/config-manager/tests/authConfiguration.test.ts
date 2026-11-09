import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { BetterPortalConfigSchema, uuidv7 } from "@betterportal/framework";
import { AuthConfigSchemas } from "../../../auth-default/src/config.js";
import { renderConfigClientShell } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
import { setConfigManagerRouteContext } from "../src/plugins/service-betterportal-config-manager/routeContext.js";
import { getManifestCache, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { handlePost, handlePut } from "../src/plugins/service-betterportal-config-manager/tenantManagement.js";

test("new apps mount public account and social pages with their POST operations", async t => {
  const tenantId = uuidv7(), authServiceId = uuidv7();
  let config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "tenant", title: "Tenant", services: [{
    id: authServiceId, serviceId: "org.betterportal.auth.default", hostname: "https://auth.example", capabilities: ["auth"], createdAt: new Date().toISOString()
  }] }] });
  const viewIndex = Object.fromEntries(["login", "logout", "refresh", "register", "account", "social"].map(name => [name + ".index", {
    viewId: name + ".index", path: "/" + name, title: name, description: name, pathVariants: [], fragments: [],
    operations: ["GET", "POST"].map(method => ({
      operationId: "auth." + name + (method === "GET" ? ".view" : ""), method, title: name,
      ...(name === "social" || (name === "account" && method === "POST") ? {} : { role: "auth." + name }),
      renderModes: method === "GET" ? ["page"] : [], dependencies: []
    }))
  }]));
  const cache = getManifestCache() as Map<string, CachedManifest>;
  cache.set(authServiceId, { serviceId: "org.betterportal.auth.default", viewIndex } as unknown as CachedManifest);
  t.after(() => cache.delete(authServiceId));
  setConfigManagerRouteContext({ storage: {
    loadConfig: async () => structuredClone(config), saveConfig: async candidate => { config = structuredClone(candidate); }
  }, serviceBaseUrl: "https://config.example" } as Parameters<typeof setConfigManagerRouteContext>[0]);
  await handlePost({ request: { entity: "app", tenantId, title: "New app", authServiceId } } as never);
  const app = config.apps[0];
  assert.ok(app);
  for (const name of ["account", "social"]) {
    const page = app.routes.find(route => route.operations.includes("auth." + name + ".view"));
    const api = app.routes.find(route => route.operations.includes("auth." + name));
    assert.equal(page?.kind, "page"); assert.equal(page?.path, "/org.betterportal.auth.default/" + name); assert.equal(page?.enabled, true);
    assert.equal(api?.kind, "api"); assert.equal(api?.targetPath, "/" + name); assert.equal(api?.enabled, true);
  }
  assert.ok(app.routes.some(route => route.operations.includes("auth.register.view")));
  const routeCount = app.routes.length;
  await handlePut({ request: { entity: "app", appId: app.id, authServiceId } } as never);
  assert.equal(config.apps[0].routes.length, routeCount);
  // Editing an app created before these mounts existed repairs its missing pages.
  config.apps[0].routes = config.apps[0].routes.filter(route => !["account.index", "social.index"].includes(route.viewId));
  await handlePut({ request: { entity: "app", appId: app.id, authServiceId } } as never);
  assert.equal(config.apps[0].routes.length, routeCount);
  const pages = () => config.apps[0].routes.filter(route => ["auth.account.view", "auth.social.view"].some(id => route.operations.includes(id)));
  const ids = pages().map(route => route.id);
  for (const route of pages()) {
    route.kind = "api"; route.enablement = "auto"; route.path = "/_bp/service/org.betterportal.auth.default" + route.targetPath;
  }
  await handlePut({ request: { entity: "app", appId: app.id, authServiceId } } as never);
  assert.deepEqual(pages().map(route => route.id), ids);
  assert.ok(pages().every(route => route.kind === "page" && route.enabled && route.path === "/org.betterportal.auth.default" + route.targetPath));
  for (const route of pages()) { route.enabled = false; route.path = "/custom" + route.targetPath; }
  await handlePut({ request: { entity: "app", appId: app.id, authServiceId } } as never);
  assert.ok(pages().every(route => route.enabled && route.path === "/custom" + route.targetPath));
  for (const route of pages()) { route.enabled = false; route.enablement = "disabled"; }
  await handlePut({ request: { entity: "app", appId: app.id, authServiceId } } as never);
  assert.ok(pages().every(route => !route.enabled));
  assert.equal(config.apps[0].routes.length, routeCount);
});

test("app config saves, resets and imports omit tenant-only fields and preserve booleans", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const tenantValues = { userIsolation: "tenant", directoryAdminAppId: "admin-app", registration: "public", defaultRoleIds: "[]", requireMfa: false };
  const appValues: Record<string, unknown> = {};
  const writes: Array<{ appId?: string; values: Record<string, unknown>; clearKeys?: string[] }> = [];
  const shell = renderConfigClientShell({ hostname: "https://config.example", tenantId: "tenant-a", appId: "app-a",
    serviceId: "org.betterportal.auth.default", serviceTitle: "Default Auth", adminApiBase: "/admin", tenantApps: [{ id: "app-a", title: "App A" }] });
  await page.addInitScript("window.BetterPortalAuth = { fetch: (...args) => window.fetch(...args) };");
  await page.route("https://config.example/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/admin/config-ticket") return json({ token: "test-ticket" });
    if (url.pathname.endsWith("/schema")) return json({ configSchemas: AuthConfigSchemas });
    if (url.pathname === "/.well-known/bp/config") {
      if (request.method() === "POST") {
        const body = request.postDataJSON(); writes.push(body);
        const keys = [...Object.keys(body.values), ...(body.clearKeys ?? [])];
        if (body.appId && keys.some(key => ["directoryAdminAppId", "userIsolation"].includes(key))) {
          return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Directory administration can only be configured at tenant scope." }) });
        }
        const target = body.appId ? appValues : tenantValues;
        for (const key of body.clearKeys ?? []) delete target[key];
        Object.assign(target, body.values);
        return json({ ok: true });
      }
      return json({ values: request.headers()["x-bp-app-id"] ? appValues : tenantValues });
    }
    return route.fulfill({ contentType: "text/html", body: "<!doctype html>" + shell });
  });
  await page.goto("https://config.example/editor");
  const status = page.locator("[data-bp-config-status]");
  await page.waitForFunction(() => document.querySelector("[data-bp-config-status]")?.textContent === "Configuration loaded.");
  assert.equal(await page.locator('[name="directoryAdminAppId"], [data-bp-override-key="userIsolation"]').count(), 0);
  assert.equal(await page.locator('[name="registration"]').inputValue(), "public");
  await page.locator('[data-bp-override-key="defaultRoleIds"]').check();
  await page.locator('[name="defaultRoleIds"]').fill('["reader"]');
  await page.locator('[data-bp-override-key="requireMfa"]').check();
  await page.locator('[name="requireMfa"]').check();
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await page.waitForFunction(() => document.querySelector("[data-bp-config-status]")?.textContent === "Configuration saved.");
  assert.deepEqual(appValues, { defaultRoleIds: '["reader"]', requireMfa: true });
  assert.equal(tenantValues.directoryAdminAppId, "admin-app");
  await page.locator('[data-bp-override-key="defaultRoleIds"]').uncheck();
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await page.waitForFunction(() => document.querySelector("[data-bp-config-status]")?.textContent === "Configuration saved.");
  assert.equal(await page.locator('[name="defaultRoleIds"]').inputValue(), "[]");
  page.on("dialog", dialog => dialog.accept());
  const importValues = async (values: Record<string, unknown>) => page.locator("[data-bp-config-import-file]").setInputFiles({
    name: "app.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      format: "betterportal.service-config", version: 1, serviceId: "org.betterportal.auth.default", scope: "app", values
    }))
  });
  await importValues({ defaultRoleIds: '["editor"]', registration: "closed", requireMfa: false });
  await page.waitForFunction(() => document.querySelector("[data-bp-config-status]")?.textContent === "Configuration imported.");
  assert.deepEqual(appValues, { defaultRoleIds: '["editor"]', registration: "closed", requireMfa: false });
  const saves = writes.length;
  await importValues({ directoryAdminAppId: "untrusted-app" });
  await page.waitForFunction(() => document.querySelector("[data-bp-config-status]")?.textContent?.includes("Unknown config fields"));
  assert.equal(writes.length, saves);
  await page.locator("[data-bp-config-scope]").selectOption("tenant");
  await page.locator('[name="directoryAdminAppId"]').waitFor();
  assert.equal(await page.locator('[name="directoryAdminAppId"]').inputValue(), "admin-app");
  assert.equal(await page.locator('[name="requireMfa"]').isChecked(), false);
  assert.equal(await status.textContent(), "Configuration loaded.");
  for (const write of writes) {
    assert.equal(write.appId, "app-a");
    assert.ok(![...Object.keys(write.values), ...(write.clearKeys ?? [])].some(key => ["userIsolation", "directoryAdminAppId"].includes(key)));
  }
  assert.deepEqual(errors, []);
});
