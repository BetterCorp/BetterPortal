import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { uuidv7 } from "@betterportal/framework";
import { toHtmlString } from "@betterportal/framework/lib/runtime/http.js";
import { Factors } from "../src/factors.js";
import { IdentityService, SecretCipher, type IdentityPolicy } from "../src/identity.js";
import { JsonAuthStorage } from "../src/storage.js";
import { renderAccount } from "../lib/accountUI.js";
import { render as renderUsers } from "../lib/plugins/service-betterportal-auth-default/bp-routes/users/_renderer.bootstrap5/GET.js";

test("browser passkey registration and authentication validate origin, ownership and replay", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-passkey-"));
  const storage = new JsonAuthStorage(join(dir, "users.json"));
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  const policy: IdentityPolicy = { isolation: "app", registration: "public", requireMfa: false, defaultRoleIds: [], allowedRoleIds: [] };
  const scope = { tenantId: uuidv7(), appId: uuidv7() };
  const user = await identity.createUser(scope, policy, { username: "alice", verified: true });
  const factors = new Factors(identity);
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Passkey test</title>" }));
  await page.goto("https://app.test/account");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const enroll = await factors.prepare(user, "https://app.test", true);
  const registration = await page.evaluate(async options => {
    const credential = await navigator.credentials.create({ publicKey: (PublicKeyCredential as any).parseCreationOptionsFromJSON(options) });
    return (credential as any).toJSON();
  }, enroll.public.options);
  const complete = (data: Record<string, unknown>, credential: unknown, account = user) => storage.transaction(scope, tx => factors.complete(tx, scope, account, data, { method: "passkey", credential }));
  await assert.rejects(complete({ ...enroll.private, origin: "https://other.test" }, registration), /verification failed/);
  assert.equal((await complete(enroll.private, registration))?.length, 10);
  const challenge = await factors.prepare(user, "https://app.test");
  const assertion = await page.evaluate(async options => {
    const credential = await navigator.credentials.get({ publicKey: (PublicKeyCredential as any).parseRequestOptionsFromJSON(options) });
    return (credential as any).toJSON();
  }, challenge.public.options);
  const other = await identity.createUser(scope, policy, { username: "bob", verified: true });
  await assert.rejects(complete(challenge.private, assertion, other), /unavailable/);
  await assert.rejects(complete({ ...challenge.private, challenge: "incorrect" }, assertion), /verification failed/);
  await complete(challenge.private, assertion);
  await assert.rejects(complete(challenge.private, assertion), /verification failed/);
});

test("email verification omits password controls and redirects to the mounted login after confirmation", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const proof = { action: "verify", id: "ticket", secret: "private-proof" };
  const submitted: unknown[] = []; await page.exposeFunction("recordSubmission", (body: unknown) => { submitted.push(body); });
  await page.addInitScript(`window.BetterPortalAuth = { fetch: async (_url, init) => {
    await window.recordSubmission(JSON.parse(init.body)); return Response.json({ status: "ok", message: "Email verified." });
  } };`);
  await page.route("https://app.test/**", route => {
    if (new URL(route.request().url()).pathname === "/sign-in") return route.fulfill({ contentType: "text/html", body: '<h1>Sign in</h1>' });
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><style>.d-block { display: block !important; }</style>' + toHtmlString(renderAccount({ registration: "public", signedIn: false }, { request: { query: {} }, app: { defaultRoute: "/" }, route: (input: any) => input.path === "/login" ? { absoluteUiPath: "https://app.test/sign-in?next=%2F" } : { absoluteApiPath: "https://auth.test/account" } } as never)) });
  });
  await page.goto("https://app.test/account#bp-auth=" + encodeURIComponent(JSON.stringify(proof)));
  assert.equal(new URL(page.url()).hash, ""); assert.deepEqual(submitted, []);
  assert.equal(await page.locator('#bp-link-verification input[name="password"]').count(), 0);
  assert.equal(await page.getByText('New password (at least 12 characters)', { exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.waitForURL("https://app.test/sign-in?next=%2F");
  assert.deepEqual(submitted, [proof]); assert.deepEqual(errors, []);
});

for (const action of ["reset", "invite.accept"] as const) test(`${action} links still provide an editable password when needed`, async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close()); const page = await browser.newPage();
  await page.addInitScript(`window.BetterPortalAuth = { fetch: async (_url, init) => { window.submitted = JSON.parse(init.body); return Response.json({ status: "ok", message: "Saved." }); } };`);
  await page.route('https://app.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' + toHtmlString(renderAccount({ registration: "public", signedIn: false }, { request: { query: {} }, app: { defaultRoute: "/" }, route: (input: any) => input.path === "/login" ? null : { absoluteApiPath: "https://auth.test/account" } } as never)) }));
  const proof = { action, id: 'ticket', secret: 'secret' };
  await page.goto('https://app.test/account#bp-auth=' + encodeURIComponent(JSON.stringify(proof)));
  const input = page.locator('#bp-link-verification input[name="password"]');
  assert.equal(await input.isEditable(), true); assert.equal(await input.isVisible(), true); assert.equal(await input.getAttribute('required'), '');
  await input.fill('a secure test password'); await page.locator('#bp-link-verification button').click();
  await page.waitForFunction(() => !!(window as any).submitted);
  assert.deepEqual(await page.evaluate(() => (window as any).submitted), { ...proof, password: 'a secure test password' });
});

test("failed verification stays on the confirmation page without asking for another password", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close()); const page = await browser.newPage();
  await page.addInitScript(`window.BetterPortalAuth = { fetch: async () => Response.json({ status: "error", message: "Verification expired. Request a new link." }, { status: 400 }) };`);
  await page.route('https://app.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' + toHtmlString(renderAccount({ signedIn: false }, { request: { query: {} }, app: { defaultRoute: "/" }, route: (input: any) => input.path === "/login" ? { absoluteUiPath: 'https://app.test/sign-in' } : { absoluteApiPath: 'https://auth.test/account' } } as never)) }));
  await page.goto('https://app.test/account#bp-auth=' + encodeURIComponent(JSON.stringify({ action: 'verify', id: 'ticket', secret: 'secret' })));
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByRole('status').getByText('Verification expired. Request a new link.').waitFor();
  assert.equal(new URL(page.url()).pathname, '/account'); assert.equal(await page.locator('#bp-link-verification input[name="password"]').count(), 0);
});

test("users page generates, displays and copies verification links for eligible accounts", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const link = "https://app.test/account#bp-auth=" + encodeURIComponent(JSON.stringify({ action: "verify", id: "ticket", secret: "private-proof" }));
  await page.addInitScript(`window.submitted = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async value => { window.copied = value; } } });
    window.BetterPortalAuth = { fetch: async (_url, init) => {
      window.submitted.push(JSON.parse(init.body));
      return Response.json({ status: "ok", message: "Verification link ready.", verificationLink: ${JSON.stringify(link)} });
    } };`);
  const base = { id: "eligible", username: "alice", email: "alice@example.com", enabled: true, emailVerified: false, roles: [] };
  const data = { canManageDirectory: true, registration: "closed", users: [base,
    { ...base, id: "verified", emailVerified: true }, { ...base, id: "disabled", enabled: false },
    { ...base, id: "protected", protected: true }, { ...base, id: "no-email", email: "" }] };
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" + toHtmlString(renderUsers(data, { request: { query: {} }, route: () => ({ absoluteApiPath: "https://auth.test/users" }) } as never)) }));
  await page.goto("https://app.test/users");
  const generate = page.getByRole("button", { name: "Generate verification link" });
  assert.equal(await generate.count(), 1);
  assert.equal(await page.getByRole("button", { name: "Mark as verified", exact: true }).count(), 1);
  assert.equal(await page.locator('[data-verification-output]').isVisible(), false);
  assert.deepEqual(await page.evaluate(() => (window as any).submitted), []);
  assert.deepEqual(errors, []);
  await generate.click();
  await page.locator('[data-verification-output]').waitFor({ state: "visible", timeout: 3000 });
  assert.equal(await page.locator('[data-verification-value]').inputValue(), link);
  assert.equal(await page.getByRole("link", { name: "Open verification link" }).getAttribute("href"), link);
  await page.getByRole("button", { name: "Copy link" }).click();
  assert.equal(await page.evaluate(() => (window as any).copied), link);
  assert.deepEqual(await page.evaluate(() => (window as any).submitted), [{ action: "verification.link", id: "eligible" }]);
  assert.deepEqual(errors, []);
  await page.route("https://readonly.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" + toHtmlString(renderUsers({ ...data, canManageDirectory: false }, { request: { query: {} }, route: () => ({ absoluteApiPath: "https://auth.test/users" }) } as never)) }));
  await page.goto("https://readonly.test/users");
  assert.equal(await page.getByRole("button", { name: "Generate verification link" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Mark as verified", exact: true }).count(), 0);
});


test("user management presents people, delivery errors and local times and verifies users immediately", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ timezoneId: "Africa/Johannesburg", locale: "en-GB" });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(`window.submitted = []; window.BetterPortalAuth = { fetch: async (_url, init) => { window.submitted.push(JSON.parse(init.body)); return Response.json({ status: "ok", message: "Saved." }); } };`);
  const actor = { id: "actor", name: "Alex Admin", email: "alex@example.com", username: "alex" };
  const target = { id: "target", name: "Sam User", email: "sam@example.com", username: "sam", enabled: true, emailVerified: false, roles: ["reader"] };
  const data = { canManageDirectory: true, registration: "closed", users: [target],
    mail: [{ id: "mail-id", to: "sam@example.com", subject: "Verify your email", state: "failed", attempts: 5, updatedAt: Date.parse("2026-11-14T10:00:00Z"), lastDelivery: { at: Date.parse("2026-11-14T10:00:00Z"), reason: "provider_access_denied", status: 200, providerCode: "AccessDenied", transport: "postal" } }],
    audit: [{ id: "event-id", actor: "actor", actorUser: actor, targetUser: target, event: "admin.verification.link", at: Date.parse("2026-11-14T10:00:00Z"), data: { id: "target" } }] };
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" + toHtmlString(renderUsers(data, { request: { query: {} }, route: () => ({ absoluteApiPath: "https://auth.test/users" }) } as never)) }));
  await page.goto("https://app.test/users");
  const activity = page.locator('#bp-users-activity');
  assert.match(await activity.textContent(), /Alex Admin/); assert.match(await activity.textContent(), /alex@example.com/); assert.match(await activity.textContent(), /Sam User/);
  assert.match(await activity.locator('time').textContent(), /12:00/); assert.match(await activity.locator('time').getAttribute('title') || '', /Africa\/Johannesburg/);
  const mail = page.locator('#bp-users-mail'); assert.match(await mail.textContent(), /sam@example.com/); assert.match(await mail.textContent(), /Verify your email/); assert.match(await mail.textContent(), /rejected the API key/); assert.match(await mail.textContent(), /HTTP 200/); assert.match(await mail.textContent(), /AccessDenied/);
  await page.getByRole('button', { name: 'Mark as verified', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-email-status]')?.textContent === 'Email verified');
  assert.equal(await page.getByRole('button', { name: 'Generate verification link' }).count(), 0);
  assert.deepEqual(await page.evaluate(() => (window as any).submitted[0]), { action: 'verification.mark', id: 'target' });
  await page.getByRole('button', { name: 'Retry delivery' }).click(); await page.waitForFunction(() => document.querySelector('[data-mail-state]')?.textContent === 'Queued');
  assert.deepEqual(await page.evaluate(() => (window as any).submitted[1]), { action: 'mail.retry', id: 'mail-id' });
  await page.getByRole('searchbox').fill('missing'); assert.equal(await page.locator('[data-user-row]').isVisible(), false);
  assert.equal(await page.locator('[data-no-user-matches]').isVisible(), true);
  await page.getByRole('searchbox').fill('Sam'); assert.equal(await page.locator('[data-user-row]').isVisible(), true);
  assert.deepEqual(errors, []);
});
