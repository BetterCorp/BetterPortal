import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { toHtmlString } from "@betterportal/framework";
import { renderWizardStep2, renderWizardStep3 } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
import { render as renderServices } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_renderer.bootstrap5/GET.js";
import { render as renderAuth } from "../src/plugins/service-betterportal-config-manager/bp-routes/auth/_renderer.bootstrap5/GET.js";
import { ResponseSchema as ServicesResponseSchema } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/GET.js";

test("a service URL cannot escape the wizard's inline scripts", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const hostileUrl = 'https://service.test/</script><script>window.__adminXss = true</script>';
  const pages = [
    renderWizardStep2({ tenantId: "tenant", hostname: hostileUrl, pluginId: "plugin", version: "1", viewCount: 0, title: "Service", schema: "{}", adminApiBase: "https://manager.test/admin" }),
    renderWizardStep3({ apiKey: "", deploymentMode: "self-hosted", title: "Service", tenantId: "tenant", serviceInstanceId: "service", serviceUrl: hostileUrl, adminApiBase: "https://manager.test/admin" })
  ];
  for (const [index, wizard] of pages.entries()) {
    await page.route(`https://manager.test/wizard-${index}`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>${wizard}</body></html>` }));
    await page.goto(`https://manager.test/wizard-${index}`);
    assert.equal(await page.evaluate(() => (window as any).__adminXss), undefined, `wizard step ${index + 2} executed the service URL`);
  }
});

test("an external install error is shown as text in the admin wizard", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const payload = '<img src=x onerror="window.__adminXss = true">';
  const wizard = renderWizardStep3({
    apiKey: "", deploymentMode: "self-hosted", title: "Test service",
    tenantId: "tenant", serviceInstanceId: "service", serviceUrl: "https://service.test",
    adminApiBase: "https://manager.test/admin"
  });
  await page.route("https://manager.test/admin/services/begin-install", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ setupToken: "setup", cpUrl: "https://manager.test" })
  }));
  await page.route("https://manager.test/admin/wizard/cleanup-provisional-service", route => route.fulfill({
    contentType: "application/json", body: "{}"
  }));
  await page.route("https://service.test/.well-known/bp/install", route => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ error: payload })
  }));
  await page.route("https://manager.test/wizard", route => route.fulfill({
    contentType: "text/html", body: `<!doctype html><html><body>${wizard}</body></html>`
  }));
  await page.goto("https://manager.test/wizard");
  await page.getByText("Install Failed").waitFor();
  assert.equal(await page.locator("#bp-install-status img").count(), 0);
  assert.equal(await page.evaluate(() => (window as any).__adminXss), undefined);
  assert.match(await page.locator("#bp-install-status").innerText(), /<img src=x onerror=/);
});

test("admin views cannot execute service metadata inside scripts", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const hostile = 'https://manager.test/</script><script>window.__adminXss = true</script>';
  const pages = [
    toHtmlString(renderServices(ServicesResponseSchema.parse({
      title: "Services", services: [], tenants: [], adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: hostile
    }))),
    toHtmlString(renderAuth({
      title: "Permission Manager", apps: [], authConfigured: false, servicePermissions: [], currentRoles: [],
      adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: hostile
    }))
  ];
  for (const [index, html] of pages.entries()) {
    await page.route(`https://manager.test/admin-${index}`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>${html}</body></html>` }));
    await page.goto(`https://manager.test/admin-${index}`);
    assert.equal(await page.evaluate(() => (window as any).__adminXss), undefined, `admin view ${index + 1} executed service metadata`);
  }
});
