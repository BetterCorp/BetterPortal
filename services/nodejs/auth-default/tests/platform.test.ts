import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { createBpTokenIssuer, generateKeyPair, uuidv7 } from "@betterportal/framework";
import { AuthError, IdentityService, SecretCipher, type IdentityPolicy, type User } from "../src/identity.js";
import { JsonAuthStorage, openAuthStorage } from "../src/storage.js";
import { UserStore } from "../src/userStore.js";
import { Factors } from "../src/factors.js";
import { generate } from "otplib";

const policy: IdentityPolicy = { isolation: "app", registration: "public", requireMfa: false, defaultRoleIds: [], allowedRoleIds: ["reader", "editor"] };
const issuer = createBpTokenIssuer({ keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "test", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "bp-auth-platform-"));
  const path = join(dir, "users.json"); const storage = new JsonAuthStorage(path);
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  return { path, storage, identity, scope: { tenantId: uuidv7(), appId: uuidv7() } };
}

test("app directories isolate identical emails; first account locks tenant isolation", async t => {
  const { identity, scope } = fixture(t); const other = { ...scope, appId: uuidv7() };
  const a = await identity.createUser(scope, policy, { username: "alice@example.com", email: "alice@example.com", verified: true });
  const b = await identity.createUser(other, policy, { username: "alice@example.com", email: "alice@example.com", verified: true });
  assert.notEqual(a.id, b.id);
  assert.equal(await identity.findUser(other, policy, a.id, true), undefined);
  await assert.rejects(identity.createUser(scope, { ...policy, isolation: "tenant" }, { username: "bob" }), /isolation is locked/);
  await assert.rejects(identity.createUser({ tenantId: uuidv7(), appId: uuidv7() }, policy, { username: "bob" }), /one tenant/);
});

test("account provisioning, invitations and email changes use bounded email validation", async t => {
  const { identity, scope, storage } = fixture(t);
  const { accountPost } = await import("../src/account.js");
  const { default: manage } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/users/POST.js");
  const actor = await identity.createUser(scope, policy, { username: "admin", email: "  Admin+Test@Example.COM  ", verified: true });
  assert.equal(actor.email, "admin+test@example.com");
  const session = await identity.issueSession(scope, policy, actor, issuer, 3600);
  const normal = await issuer.verifier().verify(session.accessToken, scope);
  const now = Math.floor(Date.now() / 1000);
  const user = await issuer.verifier().verify(issuer.signElevatedAccessToken(normal, { assurance: "mfa", verifiedAt: now, expiresAt: now + 300 }, 300), scope);
  const recipients: string[] = [];
  const runtime = { identity, policy: async () => policy, factors: new Factors(identity), mail: { enqueue: async (_tx: unknown, _scope: unknown, to: string) => { recipients.push(to); } } };
  let status = 200;
  const ctx = { plugin: { runtime }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, user,
    rawEvent: { req: new Request("https://auth.test/account"), url: new URL("https://auth.test/account") },
    uiRouteUrl: () => "https://app.test/account", request: {} as Record<string, unknown>, setStatus: (code: number) => { status = code; } };
  const boundary = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(61);
  assert.equal(boundary.length, 254);
  for (const email of ["alice@example..com", "alice@-example.com", "alice@example.com\r\nBcc: other@example.com", "   ", "a" + boundary, "!@!." + "!.".repeat(100_000)]) {
    await assert.rejects(identity.createUser(scope, policy, { username: "new-user", email }), /valid account identifier and email/);
    ctx.request = { action: "invite", email };
    assert.equal((await manage(ctx as never)).status, "error"); assert.equal(status, 400);
    ctx.request = { action: "email.change", email };
    await assert.rejects(accountPost(ctx as never), /valid email/);
  }
  assert.deepEqual(recipients, []);
  assert.equal((await storage.transaction(scope, tx => tx.list("user", scope))).length, 1);
  assert.equal((await storage.transaction(scope, tx => tx.list("challenge", scope))).length, 0);
  await identity.createUser(scope, policy, { username: "boundary", email: boundary });
  ctx.request = { action: "invite", email: "  Invite+Test@Example.COM  " };
  assert.equal((await manage(ctx as never)).status, "ok");
  ctx.request = { action: "email.change", email: "  New+Test@Example.COM  " };
  assert.equal((await accountPost(ctx as never)).status, "ok");
  assert.deepEqual(recipients, ["invite+test@example.com", "new+test@example.com", "admin+test@example.com"]);
});

test("tenant directory shares accounts while roles and sessions stay app-bound", async t => {
  const { identity, scope } = fixture(t); const tenantPolicy = { ...policy, isolation: "tenant" as const }; const other = { ...scope, appId: uuidv7() };
  const user = await identity.createUser(scope, tenantPolicy, { username: "alice", verified: true }, ["editor"]);
  assert.equal((await identity.findUser(other, tenantPolicy, "alice"))?.id, user.id);
  const a = await identity.issueSession(scope, tenantPolicy, user, issuer, 3600);
  const b = await identity.issueSession(other, tenantPolicy, user, issuer, 3600);
  assert.deepEqual((await issuer.verifier().verify(a.accessToken, scope)).roles, ["editor"]);
  assert.deepEqual((await issuer.verifier().verify(b.accessToken, other)).roles, []);
  await assert.rejects(issuer.verifyRefreshToken({ refreshToken: a.refreshToken!, ...other }), /different tenant\/app/);
});

test("login account limits normalize padding and case across different peers", async t => {
  const { identity, scope } = fixture(t);
  const { handlePost } = await import("../src/plugins/service-betterportal-auth-default/loginFlow.js");
  const authenticate = t.mock.method(identity, "authenticate", async () => undefined);
  let status = 0;
  for (let i = 0; i < 11; i++) {
    const req = new Request("https://auth.test/login"); Object.assign(req, { ip: `192.0.2.${i + 1}` });
    await handlePost({ tenant: { id: scope.tenantId }, app: { id: scope.appId }, rawEvent: { req }, request: { username: " ".repeat(i) + "Alice@Example.COM" + " ".repeat(i), password: "incorrect" },
      plugin: { runtime: { identity, policy: async () => policy } }, setStatus: (value: number) => { status = value; } } as never);
    assert.equal(status, i < 10 ? 401 : 429);
  }
  assert.equal(authenticate.mock.callCount(), 10);
});

test("credential-sharing apps share login limits while separate directories retain separate budgets", async t => {
  const { handlePost } = await import("../src/plugins/service-betterportal-auth-default/loginFlow.js");
  for (const isolation of ["tenant", "app"] as const) {
    const { identity, scope } = fixture(t);
    const apps = [scope.appId, uuidv7()];
    const authenticate = t.mock.method(identity, "authenticate", async () => undefined);
    const attempt = async (tenantId: string, appId: string, n: number) => {
      const req = new Request("https://auth.test/login"); Object.assign(req, { ip: `192.0.2.${n + 1}` });
      let status = 0;
      await handlePost({ tenant: { id: tenantId }, app: { id: appId }, rawEvent: { req }, request: { username: " Alice@Example.COM ", password: "incorrect" },
        plugin: { runtime: { identity, policy: async () => ({ ...policy, isolation }) } }, setStatus: (value: number) => { status = value; } } as never);
      return status;
    };
    for (let i = 0; i < 20; i++) assert.equal(await attempt(scope.tenantId, apps[i % 2], i), isolation === "tenant" && i >= 10 ? 429 : 401);
    assert.equal(authenticate.mock.callCount(), isolation === "tenant" ? 10 : 20);
    assert.equal(await attempt(scope.tenantId, apps[0], 21), 429);
    assert.equal(await attempt(uuidv7(), apps[0], 22), 401);
  }
});

test("social configuration is rejected before writes and legacy malformed config returns a safe 503", async t => {
  const { identity, scope } = fixture(t);
  const { Plugin } = await import("../src/plugins/service-betterportal-auth-default/index.js");
  const { default: getSocial } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/social/GET.js");
  const { default: postSocial } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/social/POST.js");
  const service = Object.create(Plugin.prototype) as any; service.identity = identity;
  const connection = { id: "test", kind: "google", clientId: "client", clientSecret: "do-not-expose-secret" };
  let writes = 0;
  const write = (value: unknown) => service.mutateServiceConfiguration(scope.tenantId, scope.appId, { socialConnections: value }, () => { writes++; return "saved"; });
  const invalid = ["{invalid-json", "null", "[null]", JSON.stringify([{ id: "test" }]), JSON.stringify([{ ...connection, clientId: 123 }]), JSON.stringify([{ ...connection, kind: "microsoft" }]), JSON.stringify([{ ...connection, kind: "microsoft", tenantId: "common" }]), JSON.stringify([connection, connection]), JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ ...connection, id: String(i) })))];
  for (const configured of invalid) {
    await assert.rejects(write(configured), (error: any) => error.status === 400 && !error.message.includes(connection.clientSecret));
    let status = 0;
    const ctx = { plugin: { runtime: { identity, policy: async () => policy, configuration: () => ({ socialConnections: configured }) } }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, query: {}, request: { action: "start" }, setStatus: (value: number) => { status = value; } };
    const result = await getSocial(ctx as never);
    assert.equal(status, 503); assert.equal(result.status, "error"); assert.deepEqual(result.connections, []);
    assert.equal((await postSocial(ctx as never)).status, "error"); assert.equal(status, 503);
  }
  assert.equal(writes, 0);
  assert.equal(await write(JSON.stringify([connection, { ...connection, id: "ms", kind: "microsoft", tenantId: uuidv7() } ])), "saved");
  assert.equal(await write("[]"), "saved");
  assert.equal(await write(""), "saved");
  assert.equal(writes, 3);
});

test("session issuance and refresh preserve the current profile picture", async t => {
  const { identity, scope } = fixture(t);
  const original = await identity.createUser(scope, policy, { username: "alice", verified: true });
  await identity.updateUser(scope, policy, original.id, async u => { u.picture = "https://images.test/avatar.png"; });
  const pair = await identity.issueSession(scope, policy, original, issuer, 3600);
  assert.equal((await issuer.verifier().verify(pair.accessToken, scope)).picture, "https://images.test/avatar.png");
  const claims = await issuer.verifyRefreshToken({ ...scope, refreshToken: pair.refreshToken! });
  const refreshed = await identity.refresh(scope, policy, claims, issuer);
  assert.equal((await issuer.verifier().verify(refreshed!.accessToken, scope)).picture, "https://images.test/avatar.png");
});

test("Advanced startup refuses a replica-local generated bootstrap secret", async () => {
  const { Plugin } = await import("../src/plugins/service-betterportal-auth-default/index.js");
  const service = Object.create(Plugin.prototype);
  Object.defineProperty(service, "config", { value: { mode: "advanced", setupToken: "" } });
  await assert.rejects(service.init({} as never), /setupToken shared by all replicas/);
});

test("concurrent registrations cannot exceed ten stored accounts, including disabled accounts", async t => {
  const { identity, scope, storage } = fixture(t);
  const created = await Promise.allSettled(Array.from({ length: 15 }, (_, i) => identity.createUser(scope, policy, { username: `user${i}` })));
  assert.equal(created.filter(r => r.status === "fulfilled").length, 10);
  const first = (await storage.transaction(scope, tx => tx.list<User>("user", scope)))[0];
  await identity.updateUser(scope, policy, first.id, async u => { u.enabled = false; });
  await assert.rejects(identity.createUser(scope, policy, { username: "another" }), /10 stored users/);
});

test("default role initialization is once-only, including empty and revoked assignments", async t => {
  const { identity, scope, storage } = fixture(t);
  const user = await identity.createUser(scope, policy, { username: "alice", verified: true });
  const defaults = { ...policy, defaultRoleIds: ["reader"] };
  const issue = () => identity.issueSession(scope, defaults, user, issuer, 3600);
  assert.deepEqual((await issuer.verifier().verify((await issue()).accessToken, scope)).roles, ["reader"]);
  await storage.transaction(scope, tx => tx.put("roles", scope, { id: user.id, roles: [], initialized: true }));
  assert.deepEqual((await issuer.verifier().verify((await issue()).accessToken, scope)).roles, []);
  const empty = await identity.createUser(scope, policy, { username: "empty", verified: true });
  await identity.issueSession(scope, policy, empty, issuer, 3600);
  assert.deepEqual((await issuer.verifier().verify((await identity.issueSession(scope, defaults, empty, issuer, 3600)).accessToken, scope)).roles, []);
  const invalid = await identity.createUser(scope, policy, { username: "invalid", verified: true });
  await assert.rejects(identity.issueSession(scope, { ...policy, defaultRoleIds: ["*"] }, invalid, issuer, 3600), /Default roles/);
});

test("refresh rotates and replay revokes the family; access elevation never refreshes", async t => {
  const { identity, scope } = fixture(t);
  const user = await identity.createUser(scope, policy, { username: "alice", verified: true });
  const first = await identity.issueSession(scope, policy, user, issuer, 3600);
  const claims = await issuer.verifyRefreshToken({ refreshToken: first.refreshToken!, ...scope });
  const next = await identity.refresh(scope, policy, claims, issuer); assert.ok(next?.refreshToken);
  assert.notEqual(first.refreshToken, next.refreshToken);
  assert.equal(await identity.refresh(scope, policy, claims, issuer), undefined);
  assert.equal(await identity.refresh(scope, policy, await issuer.verifyRefreshToken({ refreshToken: next.refreshToken!, ...scope }), issuer), undefined);
  const access = await issuer.verifier().verify(first.accessToken, scope);
  await assert.rejects(identity.storage.transaction(scope, tx => identity.assertActiveSession(tx, scope, access, user)), /Session changed/);
});

test("failed challenge callbacks roll back changes but persist attempts; consumption is exclusive", async t => {
  const { identity, scope, storage } = fixture(t); const ticket = await identity.challenge(scope, "reset", {});
  for (let i = 0; i < 5; i++) await assert.rejects(identity.consume(scope, "reset", ticket.id, ticket.secret, async (_c, tx) => { await tx.put("sentinel", scope, { id: "bad" }); throw new AuthError("Invalid factor"); }), /Invalid factor/);
  assert.equal(await storage.transaction(scope, tx => tx.get("sentinel", "bad", scope)), undefined);
  await assert.rejects(identity.consume(scope, "reset", ticket.id, ticket.secret, async () => true), /expired or unavailable/);
  const once = await identity.challenge(scope, "reset", {});
  const results = await Promise.allSettled([1, 2].map(() => identity.consume(scope, "reset", once.id, once.secret, async () => true)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
});

test("TOTP enrollment and recovery enforce replay protection", async t => {
  const { identity, scope, storage } = fixture(t); const factors = new Factors(identity);
  const user = await identity.createUser(scope, policy, { username: "alice", verified: true });
  const prepared = await factors.prepare(user, "https://app.test", true);
  const code = await generate({ secret: String(prepared.public.totpSecret) });
  const codes = await storage.transaction(scope, tx => factors.complete(tx, scope, user, prepared.private, { method: "totp", code }));
  assert.equal(codes?.length, 10); assert.ok(await factors.hasFactors(user));
  await assert.rejects(storage.transaction(scope, tx => factors.complete(tx, scope, user, { ...prepared.private, enroll: false }, { method: "totp", code })), /reused/);
  await storage.transaction(scope, tx => factors.complete(tx, scope, user, { enroll: false }, { method: "recovery", code: codes![0] }));
  await assert.rejects(storage.transaction(scope, tx => factors.complete(tx, scope, user, { enroll: false }, { method: "recovery", code: codes![0] })), /Invalid recovery/);
});

test("legacy migration preserves bcrypt credentials and roles while locking tenant scope", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-legacy-")); const path = join(dir, "users.json");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const old = new UserStore(path); const tenantId = uuidv7(); const appId = uuidv7();
  const oldUser = await old.createUser({ username: "alice", password: "a long legacy password", email: "alice@example.com", tenantId, appRoles: { [appId]: ["editor"] } });
  const usernameOnly = await old.createUser({ username: "legacy-local", password: "legacy-password", tenantId, appRoles: { [appId]: [] } });
  const storage = await openAuthStorage({ mode: "simple", path, installationId: "test", appIds: { [tenantId]: [appId] } }); t.after(() => storage.close());
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7))); const scope = { tenantId, appId }; const migratedPolicy = { ...policy, isolation: "tenant" as const };
  const user = await identity.authenticate(scope, migratedPolicy, "alice@example.com", "a long legacy password");
  assert.equal(user?.id, oldUser.id); assert.ok(user?.passwordHash?.startsWith("$argon2id$"));
  assert.deepEqual(await storage.transaction(scope, tx => identity.roles(tx, scope, user!, migratedPolicy)), ["editor"]);
  const { handlePost } = await import("../src/plugins/service-betterportal-auth-default/loginFlow.js");
  const login = await handlePost({
    tenant: { id: tenantId }, app: { id: appId }, request: { username: "legacy-local", password: "legacy-password" }, query: {},
    rawEvent: { req: new Request("https://auth.test/login") }, responseHeaders: new Headers(),
    plugin: { runtime: { identity, tokenIssuer: issuer, refreshTokenSeconds: 3600, factors: new Factors(identity), isManagement: () => false, policy: async () => migratedPolicy } }
  } as never);
  assert.equal(login.status, "ok");
  assert.equal((await issuer.verifier().verify(login.accessToken!, scope)).sub, usernameOnly.id);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 2); assert.ok(existsSync(`${path}.v1.backup`));
});

test("Advanced markers prevent silent downgrade, even when no active JSON file remains", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-downgrade-")); const path = join(dir, "users.json"); t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(`${path}.mode.json`, JSON.stringify({ mode: "advanced", state: "migrating" }));
  await assert.rejects(openAuthStorage({ mode: "simple", path, installationId: "test", appIds: {} }), /downgrade/);
});

test("JSON storage recovers a dead writer and refuses a live concurrent writer", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-lock-")); const path = join(dir, "users.json");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(`${path}.lock`, JSON.stringify({ host: hostname(), pid: 2147483647, nonce: "dead" }));
  const first = new JsonAuthStorage(path);
  assert.throws(() => new JsonAuthStorage(path), /lock|writer/i);
  await first.close();
  const second = new JsonAuthStorage(path);
  await first.close(); // Closing the previous owner again must not remove this lock.
  assert.throws(() => new JsonAuthStorage(path), /lock|writer/i);
  await second.close();
});

test("social linking survives an elevation redirect but remains bound to its active app session", async t => {
  const { identity, scope, storage } = fixture(t);
  const { socialPost, socialAdapter } = await import("../src/social.js");
  const user = await identity.createUser(scope, policy, { username: "alice", email: "alice@example.com", verified: true });
  const pair = await identity.issueSession(scope, policy, user, issuer, 3600);
  const normal = await issuer.verifier().verify(pair.accessToken, scope);
  const now = Math.floor(Date.now() / 1000);
  const elevated = await issuer.verifier().verify(issuer.signElevatedAccessToken(normal, { assurance: "confirmed", verifiedAt: now, expiresAt: now + 300 }, 300), scope);
  assert.notEqual(normal.jti, elevated.jti);
  t.mock.method(socialAdapter, "authorize", async () => "https://provider.test/authorize");
  let exchanges = 0;
  t.mock.method(socialAdapter, "exchange", async () => { exchanges++; return { issuer: "https://provider.test", subject: "provider-user", emailVerified: false }; });
  const runtime = { identity, policy: async () => policy, configuration: () => ({ socialConnections: [{ id: "test", kind: "google", clientId: "client", clientSecret: "secret" }] }) };
  const ctx = { plugin: { runtime }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, user: elevated,
    rawEvent: { req: new Request("https://auth.test/social", { headers: { Origin: "https://app.test" } }), url: new URL("https://auth.test/social") },
    uiRouteUrl: () => "https://app.test/social", request: { action: "link", connection: "test" } as Record<string, unknown> };
  const ticket = await socialPost(ctx as never);
  ctx.request = { action: "complete", id: ticket.id, secret: ticket.secret, code: "test-code" };
  const otherSession = await identity.issueSession(scope, policy, user, issuer, 3600);
  ctx.user = await issuer.verifier().verify(otherSession.accessToken, scope);
  await assert.rejects(socialPost(ctx as never), /Sign in again/);
  assert.equal(exchanges, 0);
  const refreshed = await identity.refresh(scope, policy, await issuer.verifyRefreshToken({ ...scope, refreshToken: pair.refreshToken! }), issuer);
  ctx.user = await issuer.verifier().verify(refreshed!.accessToken, scope);
  assert.equal((await socialPost(ctx as never)).message, "Provider linked to your account.");
  assert.equal((await storage.transaction(scope, tx => tx.list("external", scope))).length, 1);
  await assert.rejects(socialPost(ctx as never), /expired or unavailable/);
  ctx.user = elevated; ctx.request = { action: "link", connection: "test" };
  const next = await socialPost(ctx as never);
  await identity.revokeSession(scope, await issuer.verifyRefreshToken({ ...scope, refreshToken: refreshed!.refreshToken! }));
  ctx.user = normal; ctx.request = { action: "complete", id: next.id, secret: next.secret, code: "unused-code" };
  await assert.rejects(socialPost(ctx as never), /Session changed/);
  assert.equal(exchanges, 1);
});

test("registration and verification keep proof out of URLs sent to the server and enforce app binding", async t => {
  const { identity, scope, storage, path } = fixture(t);
  const { accountPost } = await import("../src/account.js");
  const { MailQueue } = await import("../src/mail.js");
  const mail = new MailQueue(identity, () => ({ transport: "http", url: "https://mail.test/send", from: "auth@example.com" }));
  const runtime = { identity, mail, factors: new Factors(identity), tokenIssuer: issuer, refreshTokenSeconds: 3600, policy: async () => ({ ...policy, defaultRoleIds: ["reader"] }) };
  const ctx = {
    plugin: { runtime }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, responseHeaders: new Headers(),
    rawEvent: { req: new Request("https://auth.test/account", { headers: { Origin: "https://app.test" } }), url: new URL("https://auth.test/account") },
    routeUrl: () => "https://auth.test/account", uiRouteUrl: () => "https://app.test/account",
    request: { action: "signup", email: "alice@example.com", password: "a secure test password" } as Record<string, unknown>
  };
  const response = await accountPost(ctx as never); assert.equal(response.status, "ok");
  let user = await identity.findUser(scope, policy, "alice@example.com"); assert.equal(user?.emailVerified, false);
  assert.equal(await storage.transaction(scope, tx => tx.get("roles", user!.id, scope)), undefined);
  const [job] = await storage.transaction(scope, tx => tx.list("mail", scope));
  const message = JSON.parse(identity.cipher.decrypt(String(job.encrypted)));
  const url = new URL(message.text.match(/https:\/\/app\.test\/account\S+/)[0]);
  assert.equal(url.search, "");
  const proof = JSON.parse(decodeURIComponent(url.hash.slice(9)));
  assert.ok(!readFileSync(path, "utf8").includes(proof.secret));
  ctx.request = proof;
  await assert.rejects(accountPost({ ...ctx, app: { id: uuidv7() } } as never), /expired or unavailable/);
  assert.equal((await accountPost(ctx as never)).status, "ok");
  await assert.rejects(accountPost(ctx as never), /expired or unavailable/);
  user = await identity.findUser(scope, policy, "alice@example.com"); assert.equal(user?.emailVerified, true);
  assert.equal(await storage.transaction(scope, tx => tx.get("roles", user!.id, scope)), undefined);
  // Duplicate public registration has the same outward response as new registration.
  ctx.request = { action: "signup", email: "alice@example.com", password: "another secure password" };
  assert.deepEqual(await accountPost(ctx as never), response);
});

test("app administrators cannot mutate shared tenant accounts; direct roles stay separate from groups", async t => {
  const { identity, scope, storage } = fixture(t);
  const { default: manage } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/users/POST.js");
  const { default: list } = await import("../src/plugins/service-betterportal-auth-default/bp-routes/users/GET.js");
  const shared = { ...policy, isolation: "tenant" as const, canManageDirectory: false };
  const actor = await identity.createUser(scope, shared, { username: "actor", verified: true });
  const target = await identity.createUser(scope, shared, { username: "target", verified: true });
  const signed = await identity.issueSession(scope, shared, actor, issuer, 3600);
  const user = await issuer.verifier().verify(signed.accessToken, scope);
  const runtime = { identity, policy: async () => shared };
  let status = 200;
  const ctx = { plugin: { runtime }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, user,
    request: { action: "disable", id: target.id } as Record<string, unknown>, setStatus: (code: number) => { status = code; } };
  for (const action of ["disable", "sessions.revoke", "group.save", "group.delete"]) {
    ctx.request.action = action;
    assert.equal((await manage(ctx as never)).status, "error"); assert.equal(status, 403);
  }
  assert.equal((await identity.findUser(scope, shared, target.id, true))?.enabled, true);
  ctx.request = { action: "roles", id: target.id, roles: ["reader"] };
  assert.equal((await manage(ctx as never)).status, "ok");
  await storage.transaction(scope, tx => tx.put("group", { tenantId: scope.tenantId, appId: "" }, { id: uuidv7(), members: [target.id], appRoles: { [scope.appId]: ["editor"] } }));
  const data = await list(ctx as never);
  const listed = (data.users as Array<Record<string, unknown>>).find(u => u.id === target.id)!;
  assert.deepEqual(listed.roles, ["reader"]); assert.deepEqual(listed.effectiveRoles, ["reader", "editor"]);
  shared.canManageDirectory = true;
  ctx.request = { action: "disable", id: target.id };
  assert.equal((await manage(ctx as never)).status, "ok");
  assert.equal((await identity.findUser(scope, shared, target.id, true))?.enabled, false);
});
