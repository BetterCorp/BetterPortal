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

test("account email fragment is cleared and submitted only after explicit confirmation", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const proof = { action: "verify", id: "ticket", secret: "private-proof" };
  await page.addInitScript(`window.submitted = [];
    window.BetterPortalAuth = { fetch: async (_url, init) => {
      window.submitted.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ message: "Email verified." }), { headers: { "Content-Type": "application/json" } });
    } };`);
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" + toHtmlString(renderAccount({ accountUrl: "https://auth.test/account", registration: "public", signedIn: false })) }));
  await page.goto("https://app.test/account#bp-auth=" + encodeURIComponent(JSON.stringify(proof)));
  assert.equal(new URL(page.url()).hash, "");
  assert.deepEqual(await page.evaluate(() => (window as any).submitted), []);
  assert.equal(await page.locator('#bp-link-verification input[name="password"]').isDisabled(), true);
  await page.locator('#bp-link-verification button').click();
  await page.waitForFunction(() => !!document.querySelector('[role="status"]')?.textContent, undefined, { timeout: 3000 });
  assert.equal(await page.locator('[role="status"]').textContent(), "Email verified.");
  assert.deepEqual(await page.evaluate(() => (window as any).submitted), [proof]);
  assert.deepEqual(errors, []);
});
