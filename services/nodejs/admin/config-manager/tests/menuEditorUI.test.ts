import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { BetterPortalConfigSchema, createBetterPortalApp, uuidv7 } from "@betterportal/framework";
import { registerMenuEditorRoutes } from "../src/plugins/service-betterportal-config-manager/menuEditor.js";
import { getManifestCache, type CachedManifest } from "../src/plugins/service-betterportal-config-manager/syncApi.js";

const require = createRequire(import.meta.url);
test("menu audiences are visible in light/dark themes and persist through the actual HTMX form", async t => {
  const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7(), routeId = uuidv7(), itemId = uuidv7();
  let config = BetterPortalConfigSchema.parse({ tenants: [{ id: tenantId, slug: "tenant", title: "Tenant", services: [{
    id: serviceId, serviceId: "org.example.archive", hostname: "https://archive.test", apiKeyHash: "test-only", createdAt: new Date().toISOString()
  }] }], apps: [{ id: appId, tenantId, slug: "app", title: "App", hostnames: ["app.test"],
    auth: { serviceId, expectedIssuer: "issuer", expectedAudience: "audience", jwksUri: "https://auth.test/jwks", roles: [
      { id: "reader", title: "Archive reader", permissions: [{ serviceId, viewId: "archive", permissions: ["read"] }] }
    ] }, routes: [{ id: routeId, kind: "page", path: "/archive", serviceId, viewId: "archive", operations: ["archive.get"] }],
    menu: [{ id: itemId, type: "link", routeId, title: "Archive", rolesAnyOf: ["obsolete-role"] }]
  }] });
  getManifestCache().set(serviceId, { serviceId: "org.example.archive", viewIndex: { archive: {
    viewId: "archive", path: "/archive", pathVariants: [], operations: [{ operationId: "archive.get", method: "GET",
      renderModes: ["page"], authRequired: true, robots: [], dependencies: [],
      permissions: [{ serviceId, viewId: "archive", permissions: ["read"] }] }]
  } } } as unknown as CachedManifest);
  t.after(() => getManifestCache().delete(serviceId));
  const app = createBetterPortalApp();
  registerMenuEditorRoutes(app, { loadConfig: async () => structuredClone(config), saveConfig: async value => { config = value; } } as never);
  const css = readFileSync(require.resolve("bootstrap/dist/css/bootstrap.min.css"), "utf8");
  const htmx = readFileSync(require.resolve("htmx.org/dist/htmx.min.js"), "utf8");
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.route("https://config.test/**", async intercepted => {
    const req = intercepted.request();
    const response = await app.fetch(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined }));
    const body = await response.text();
    await intercepted.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: req.method() === "GET"
      ? `<!doctype html><html data-bs-theme="dark"><head><style>${css}</style><script>${htmx}</script></head><body><main class="container py-4">${body}</main></body></html>` : body });
  });
  await page.goto(`https://config.test/.well-known/bp/admin/menu-editor?appId=${appId}`);
  assert.equal(await page.locator('input[name="rolesAnyOf"]').count(), 0);
  assert.equal(await page.getByText("Roles with access: Archive reader.", { exact: false }).count(), 1);
  for (const theme of ["light", "dark"]) {
    await page.locator("html").evaluate((element, value) => element.setAttribute("data-bs-theme", value), theme);
    for (const label of ["Automatic", "Everyone", "Signed in", "Only signed out", "Has permission"]) {
      assert.equal(await page.locator("label").filter({ hasText: new RegExp(`^${label}$`) }).isVisible(), true);
    }
  }
  await page.locator(`label[for="bp-audience-${itemId}-hide-unauthenticated"]`).click();
  await page.getByRole("button", { name: "Save visibility" }).click();
  await page.waitForFunction(() => document.querySelector('[name="authStatus"][value="hide-unauthenticated"]')?.hasAttribute("checked"));
  await page.waitForFunction(() => !document.querySelector(".htmx-settling, .htmx-request"));
  assert.equal(await page.locator('[name="authStatus"][value="hide-unauthenticated"]').isChecked(), true);
  assert.equal(config.apps[0].menu[0].authStatus, "hide-unauthenticated");
  assert.equal(config.apps[0].menu[0].rolesAnyOf, undefined);
  if (process.env.BP_MENU_SCREENSHOT) await page.screenshot({ path: process.env.BP_MENU_SCREENSHOT, fullPage: true });
});
