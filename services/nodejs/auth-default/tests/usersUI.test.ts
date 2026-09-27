import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { toHtmlString } from "@betterportal/framework/lib/runtime/http.js";
import { render } from "../src/plugins/service-betterportal-auth-default/bp-routes/users/_renderer.bootstrap5/GET.js";
import { RequestSchema } from "../src/plugins/service-betterportal-auth-default/bp-routes/users/POST.js";

test("user management submits multiple and empty role arrays and preserves off-page group members", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(`window.submitted = [];
    window.BetterPortalAuth = { fetch: async (_url, init) => {
      window.submitted.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ message: "Saved." }), { headers: { "Content-Type": "application/json" } });
    } };`);
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" + toHtmlString(render({
    endpoint: "https://auth.test/users", registration: "invite", roleIds: ["reader", "editor"], canManageDirectory: true,
    users: [{ id: "alice", email: "alice@example.test", roles: ["reader"], effectiveRoles: ["reader"], enabled: true },
      { id: "root", username: "root", roles: ["*"], effectiveRoles: ["*"], protected: true, enabled: true }],
    groups: [{ id: "team", name: "Team", members: ["alice", "off-page"], roles: ["reader"] }]
  })) }));
  await page.goto("https://app.test/users");
  const form = page.locator('form:has(input[name="action"][value="roles"])');
  assert.equal(await form.count(), 1);
  await form.getByRole("checkbox", { name: "editor", exact: true }).check();
  await form.getByRole("button", { name: "Save roles" }).click();
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('[role="status"]').textContent(), "Saved.");
  await page.waitForFunction(() => (window as any).submitted.length === 1);
  let payload = await page.evaluate(() => (window as any).submitted[0]);
  assert.deepEqual(payload.roles, ["reader", "editor"]);
  assert.deepEqual(RequestSchema.parse(payload).roles, ["reader", "editor"]);
  await form.getByRole("checkbox", { name: "reader", exact: true }).uncheck();
  await form.getByRole("checkbox", { name: "editor", exact: true }).uncheck();
  await form.getByRole("button", { name: "Save roles" }).click();
  await page.waitForFunction(() => (window as any).submitted.length === 2);
  assert.deepEqual(await page.evaluate(() => (window as any).submitted[1].roles), []);
  const group = page.locator('form:has(input[name="id"][value="team"]):has(input[value="group.save"])');
  await group.getByRole("checkbox", { name: "alice@example.test" }).uncheck();
  await group.getByRole("checkbox", { name: "editor", exact: true }).check();
  await group.getByRole("button", { name: "Save group" }).click();
  await page.waitForFunction(() => (window as any).submitted.length === 3);
  payload = await page.evaluate(() => (window as any).submitted[2]);
  assert.deepEqual(payload.members, ["off-page"]);
  assert.deepEqual(payload.roles, ["reader", "editor"]);
  assert.deepEqual(errors, []);
  assert.equal(await page.getByRole("heading", { name: "User management" }).count(), 1);
});
