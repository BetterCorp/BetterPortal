import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IdentityService, SecretCipher, type IdentityPolicy } from "../src/identity.js";
import { JsonAuthStorage } from "../src/storage.js";
import { UserStore } from "../src/userStore.js";
import { createBpTokenIssuer, generateKeyPair, uuidv7 } from "@betterportal/framework";
import refresh from "../src/plugins/service-betterportal-auth-default/bp-routes/refresh/POST.js";
import { handlePost as logout } from "../src/plugins/service-betterportal-auth-default/logoutFlow.js";

test("login rejects a password change or disable during password verification", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bp-login-race-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new UserStore(join(dir, "users.json"));
  const user = await store.createUser({ username: "admin", password: "old-password", tenantId: "tenant" });
  assert.equal((await store.authenticate("tenant", "app", "admin", "old-password"))?.refreshVersion, 0);
  let finish!: (ok: boolean) => void;
  t.mock.method(bcrypt, "compare", () => new Promise<boolean>(resolve => { finish = resolve; }));
  const changing = store.authenticate("tenant", "app", "admin", "old-password");
  await store.setPassword(user.id, "new-password");
  finish(true);
  assert.equal(await changing, null);
  const disabling = store.authenticate("tenant", "app", "admin", "new-password");
  store.setEnabled(user.id, false);
  finish(true);
  assert.equal(await disabling, null);
});

test("first-admin creation is exclusive and refresh revocation survives restart", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bp-users-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "users.json");
  const store = new UserStore(path);
  const results = await Promise.allSettled(["alice", "bob"].map(username => store.createUser({ username, password: "test-password", tenantId: "tenant" }, true)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(new UserStore(path).userCount(), 1);
  const result = results.find(result => result.status === "fulfilled")!;
  if (result.status !== "fulfilled") throw new Error("No admin");
  const id = result.value.id;
  store.revokeRefreshToken("session", Math.floor(Date.now() / 1000) + 60);
  assert.equal(new UserStore(path).isRefreshTokenRevoked("session"), true);
  assert.equal(store.isRefreshTokenRevoked("other"), false);
  await store.setPassword(id, "new-password");
  assert.equal(new UserStore(path).findById(id)?.refreshVersion, 1);
  store.setEnabled(id, false);
  assert.equal(new UserStore(path).findById(id)?.refreshVersion, 2);
});

test("logout and password changes prevent signed refresh tokens from being reused", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "bp-sessions-"));
  const storage = new JsonAuthStorage(join(dir, "users.json"));
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 1)));
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  const tenantId = uuidv7(); const appId = uuidv7(); const scope = { tenantId, appId };
  const policy: IdentityPolicy = { isolation: "app", registration: "public", defaultRoleIds: [], allowedRoleIds: [], requireMfa: false };
  const user = await identity.createUser(scope, policy, { username: "admin", password: "a secure test password", verified: true });
  const issuer = createBpTokenIssuer({ keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "test", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
  const issue = async () => (await identity.issueSession(scope, policy, user, issuer, 3600)).refreshToken!;
  const token = await issue(); const otherSession = await issue();
  const context = {
    plugin: { runtime: { identity, tokenIssuer: issuer, policy: async () => policy } },
    tenant: { id: tenantId }, app: { id: appId }, request: {}, headers: { "x-bp-refresh": token }
  };
  const refreshed = await refresh(context as never);
  assert.equal(refreshed.status, "ok");
  context.headers["x-bp-refresh"] = refreshed.refreshToken!;
  await logout(context as never);
  assert.equal((await refresh(context as never)).status, "error");
  context.headers["x-bp-refresh"] = otherSession;
  const next = await refresh(context as never);
  assert.equal(next.status, "ok"); context.headers["x-bp-refresh"] = next.refreshToken!;
  await identity.updateUser(scope, policy, user.id, async u => { u.refreshVersion++; });
  assert.equal((await refresh(context as never)).status, "error");
});
