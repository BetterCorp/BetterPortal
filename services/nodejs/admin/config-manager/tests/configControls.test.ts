import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { renderConfigClientShell } from "../src/plugins/service-betterportal-config-manager/adminApi.js";

test("boolean config controls save typed values and preserve app inheritance", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const tenant: Record<string, unknown> = { requireMfa: true };
  const app: Record<string, unknown> = {};
  const writes: { values: Record<string, unknown>; clearKeys?: string[] }[] = [];
  await page.route("https://service.test/**", async route => {
    const request = route.request();
    if (request.url().endsWith("/schema")) return route.fulfill({ json: { configSchemas: [
      { jsonSchema: { requireMfa: "boolean" }, fields: [{ key: "requireMfa", title: "MFA", defaultValue: false }] },
      { jsonSchema: { type: "object", properties: { enabled: { type: "boolean" } } }, fields: [{ key: "enabled", title: "Enabled" }] },
      { fields: [{ key: "fallback", title: "Fallback", defaultValue: false }] }
    ] } });
    const values = request.headers()["x-bp-app-id"] ? app : tenant;
    if (request.method() === "POST") {
      const payload = request.postDataJSON();
      writes.push(payload);
      Object.assign(values, payload.values);
      for (const key of payload.clearKeys || []) delete values[key];
    }
    return route.fulfill({ json: { values } });
  });
  const editor = renderConfigClientShell({ hostname: "https://service.test", tenantId: "tenant", serviceId: "auth", serviceTitle: "Auth", adminApiBase: "/admin", tenantApps: [{ id: "app", title: "App" }] });
  await page.addInitScript({ content: 'window.BetterPortalAuth = { fetch: async () => new Response(JSON.stringify({token: "test-ticket"}), {headers: {"Content-Type": "application/json"}}) };' });
  await page.route("https://editor.test/**", route => route.fulfill({ contentType: "text/html", body: editor }));
  await page.goto("https://editor.test/");
  const mfa = page.locator('[name="requireMfa"]');
  await mfa.waitFor();
  assert.equal(await mfa.getAttribute("type"), "checkbox");
  assert.equal(await mfa.isChecked(), true);
  assert.equal(await page.locator('[name="enabled"]').getAttribute("type"), "checkbox");
  assert.equal(await page.locator('[name="fallback"]').getAttribute("type"), "checkbox");
  const save = async () => {
    await page.locator('button[type="submit"]').click();
    await page.locator('[data-bp-config-status]').getByText("Configuration saved.", { exact: true }).waitFor();
  };
  await mfa.uncheck();
  await save();
  assert.deepEqual(writes.at(-1)?.values, { requireMfa: false, enabled: false, fallback: false });
  await mfa.check();
  await save();
  assert.equal(writes.at(-1)?.values.requireMfa, true);
  await page.locator('[data-bp-config-scope]').selectOption("app");
  await page.waitForFunction(() => (document.querySelector('[name="requireMfa"]') as HTMLInputElement)?.disabled);
  assert.equal(await mfa.isChecked(), true);
  await page.locator('[data-bp-override-key="requireMfa"]').check();
  await mfa.uncheck();
  await save();
  assert.equal(writes.at(-1)?.values.requireMfa, false);
  assert.equal(await mfa.isChecked(), false);
  await page.locator('[data-bp-override-key="requireMfa"]').uncheck();
  await save();
  assert.deepEqual(writes.at(-1)?.values, {});
  assert.ok(writes.at(-1)?.clearKeys?.includes("requireMfa"));
  assert.equal(await mfa.isChecked(), true);
  assert.equal(await mfa.isDisabled(), true);
});
