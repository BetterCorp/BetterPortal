import assert from "node:assert/strict";
import { createBpTokenIssuer, generateKeyPair, uuidv7 } from "@betterportal/framework";
import { IdentityService, SecretCipher, type IdentityPolicy } from "../src/identity.js";
import type { AuthStorage, Scope } from "../src/storage.js";
import { accountGet } from "../src/account.js";
import usersGet from "../src/plugins/service-betterportal-auth-default/bp-routes/users/GET.js";

export async function checkSessionAndMailPages(storage: AuthStorage, scope: Scope) {
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  const policy: IdentityPolicy = { isolation: "app", registration: "public", requireMfa: false, defaultRoleIds: [], allowedRoleIds: [] };
  const user = await identity.createUser(scope, policy, { username: "history-owner", verified: true });
  const issuer = createBpTokenIssuer({ keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "test", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
  const expired = await identity.issueSession(scope, policy, user, issuer, -1);
  const expiredClaims = await issuer.verifyRefreshToken({ ...scope, refreshToken: expired.refreshToken! });
  const revoked = await identity.issueSession(scope, policy, user, issuer, 3600);
  const revokedClaims = await issuer.verifyRefreshToken({ ...scope, refreshToken: revoked.refreshToken! });
  await identity.revokeSession(scope, revokedClaims);
  const others = [{ ...scope, appId: uuidv7() }, { ...scope, tenantId: uuidv7() }];
  const now = Date.now();
  await storage.transaction(scope, async tx => {
    for (let i = 0; i < 105; i++) {
      const id = `page-${String(i).padStart(3, "0")}`;
      for (const target of [scope, ...others]) {
        await tx.put("session", target, { id, userId: user.id, createdAt: now, expiresAt: now + 3600000, revoked: false });
        await tx.put("mail", target, { id, state: "failed", attempts: 5 });
      }
    }
    for (let i = 0; i < 250; i++) {
      await tx.put("session", scope, { id: `other-user-${i}`, userId: "another-user", expiresAt: now + 3600000, revoked: false });
      await tx.put("session", scope, { id: `expired-${i}`, userId: user.id, expiresAt: now - 1, revoked: false });
      await tx.put("session", scope, { id: `revoked-${i}`, userId: user.id, expiresAt: now + 3600000, revoked: true });
      await tx.put("mail", scope, { id: `sent-${i}`, state: "sent" });
    }
    for (const target of others) await tx.put("session", target, { id: "expired-sentinel", expiresAt: 0, revoked: true });
  });
  await identity.issueSession(scope, policy, user, issuer, 3600);
  assert.equal(await identity.refresh(scope, policy, expiredClaims, issuer), undefined);
  assert.equal(await identity.refresh(scope, policy, revokedClaims, issuer), undefined);
  await storage.transaction(scope, async tx => {
    const sessions = await tx.list("session", scope);
    assert.equal(sessions.length, 356); // 105 own, 250 other users, one newly issued.
    assert.ok(sessions.every(s => s.revoked === false && Number(s.expiresAt) > now));
    for (const target of others) assert.ok(await tx.get("session", "expired-sentinel", target));
  });
  const ctx = { plugin: { runtime: { identity, policy: async () => policy } }, tenant: { id: scope.tenantId }, app: { id: scope.appId }, user: { sub: user.id }, query: {},
    routeUrl: (_route: string, options: any) => "https://auth.test/account?" + new URLSearchParams(options.query).toString() };
  const first = await accountGet(ctx as never);
  assert.equal((first.sessions as any[]).length, 100);
  const second = await accountGet({ ...ctx, query: { sessionAfter: new URL(String(first.sessionNextUrl)).searchParams.get("sessionAfter") } } as never);
  assert.equal((second.sessions as any[]).length, 6);
  assert.equal(second.sessionNextUrl, "");
  assert.equal(new Set([...(first.sessions as any[]), ...(second.sessions as any[])].map(s => s.id)).size, 106);
  const mailFirst = await usersGet(ctx as never);
  assert.equal((mailFirst.mail as any[]).length, 100);
  assert.ok((mailFirst.mail as any[]).every(m => m.state === "failed"));
  const mailSecond = await usersGet({ ...ctx, query: { mailAfter: new URL(String(mailFirst.mailNextUrl)).searchParams.get("mailAfter") } } as never);
  assert.equal((mailSecond.mail as any[]).length, 5);
  assert.equal(mailSecond.mailNextUrl, "");
  assert.equal(new Set([...(mailFirst.mail as any[]), ...(mailSecond.mail as any[])].map(m => m.id)).size, 105);
}
