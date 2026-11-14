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
    registration: "invite", roleIds: ["reader", "editor"], canManageDirectory: true,
    users: [{ id: "alice", email: "alice@example.test", roles: ["reader"], effectiveRoles: ["reader"], enabled: true },
      { id: "root", username: "root", roles: ["*"], effectiveRoles: ["*"], protected: true, enabled: true }],
    groups: [{ id: "team", name: "Team", members: ["alice", "off-page"], roles: ["reader"] }]
  }, { request: { query: {} }, route: () => ({ absoluteApiPath: "https://auth.test/users" }) } as never)) }));
  await page.goto("https://app.test/users");
  const form = page.locator('form:has(input[name="action"][value="roles"])');
  assert.equal(await form.count(), 1);
  await form.locator("..").locator("summary").click();
  await form.getByRole("checkbox", { name: "editor", exact: true }).check();
  await form.getByRole("button", { name: "Save roles" }).click();
  assert.deepEqual(errors, []);
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === "Saved.");
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
  await group.locator("../..").locator("summary").click();
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


test("closed registration stays in the users response and hides invitations", async () => {
  const { default: users } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/users/GET.js");
  const tx = { failedMail: async () => [], page: async () => [], list: async () => [] };
  const ctx = {
    plugin: { runtime: { policy: async () => ({ registration: "closed", isolation: "app", allowedRoleIds: [] }),
      identity: { storage: { mode: "json", transaction: async (_scope: unknown, callback: (value: typeof tx) => unknown) => callback(tx) } } } },
    tenant: { id: "tenant" }, app: { id: "app" }, query: {}
  };
  const result = await users(ctx as never) as Record<string, unknown>;
  assert.equal(result.registration, "closed");
  const markup = toHtmlString(render(result, { request: { query: {} }, route: () => ({ absoluteApiPath: "https://auth.test/users" }) } as never));
  assert.doesNotMatch(markup, /value="invite"/);
});


test("concurrent audit rows share in-flight identity lookups, including missing users", async () => {
  const { default: users } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/users/GET.js");
  const lookups: string[] = [];
  const tx = {
    page: async (kind: string) => kind === "audit" ? Array.from({ length: 100 }, (_, i) => ({ id: String(i), actor: "actor", event: "admin.verification.mark", at: 1, data: { id: "missing-target" } })) : [],
    list: async () => [],
    get: async (_kind: string, id: string) => {
      lookups.push(id); await new Promise(resolve => setImmediate(resolve));
      return id === "actor" ? { id, username: "alex", name: "Alex", email: "alex@example.com" } : undefined;
    }
  };
  const ctx = { plugin: { runtime: { policy: async () => ({ registration: "closed", isolation: "app", allowedRoleIds: [] }), identity: { storage: { mode: "simple", transaction: async (_scope: unknown, work: (value: typeof tx) => unknown) => work(tx) } } } }, tenant: { id: "tenant" }, app: { id: "app" }, query: {} };
  const response = await users(ctx as never);
  assert.deepEqual(lookups, ["actor", "missing-target"]);
  assert.equal((response.audit as Array<Record<string, any>>).length, 100);
  assert.ok((response.audit as Array<Record<string, any>>).every(event => event.actorUser.name === "Alex" && event.targetUser === null));
});
