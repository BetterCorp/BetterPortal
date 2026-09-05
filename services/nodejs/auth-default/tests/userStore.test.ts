import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserStore } from "../src/userStore.js";
import { createBpTokenIssuer, generateKeyPair, uuidv7 } from "@betterportal/framework";
import refresh from "../src/plugins/service-betterportal-auth-default/bp-routes/refresh/POST.js";
import { handlePost as logout } from "../src/plugins/service-betterportal-auth-default/logoutFlow.js";

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
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new UserStore(join(dir, "users.json"));
  const tenantId = uuidv7();
  const appId = uuidv7();
  const user = await store.createUser({ username: "admin", password: "test-password", tenantId });
  const issuer = createBpTokenIssuer({ keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "test", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
  const issue = () => issuer.issueTokenPair({ sub: user.id, tenantId, appId, roles: [], authProvider: "betterportal.default", refreshContext: { version: 0 } }).refreshToken!;
  const token = issue();
  const otherSession = issue();
  const context = {
    plugin: { runtime: { userStore: store, tokenIssuer: issuer } },
    tenant: { id: tenantId }, app: { id: appId }, request: {}, headers: { "x-bp-refresh": token }
  };
  assert.equal((await refresh(context as never)).status, "ok");
  await logout(context as never);
  assert.equal((await refresh(context as never)).status, "error");
  context.headers["x-bp-refresh"] = otherSession;
  assert.equal((await refresh(context as never)).status, "ok");
  await store.setPassword(user.id, "new-password");
  assert.equal((await refresh(context as never)).status, "error");
});
