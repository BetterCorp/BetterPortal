import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { uuidv7 } from "@betterportal/framework";
import { IdentityService, SecretCipher, type IdentityPolicy, type User } from "../src/identity.js";
import { openAuthStorage } from "../src/storage.js";
import { UserStore } from "../src/userStore.js";
const connectionString = process.env.BP_AUTH_TEST_POSTGRES;
const policy: IdentityPolicy = { isolation: "app", registration: "public", requireMfa: false, allowedRoleIds: [], defaultRoleIds: [] };

test("PostgreSQL imports once, verifies leftovers, preserves keys, and serializes replica mutations", { skip: !connectionString }, async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-auth-pg-")); const path = join(dir, "users.json"); const installationId = uuidv7(); const tenantId = uuidv7(); const appId = uuidv7();
  const old = new UserStore(path); const user = await old.createUser({ username: "legacy", email: "shared@example.com", password: "a legacy test password", tenantId, appRoles: { [appId]: ["reader"] } });
  const collision = await old.createUser({ username: "Legacy", email: "shared@example.com", password: "another legacy test password", tenantId, appRoles: { [appId]: ["editor"] } });
  const emailUser = await old.createUser({ username: "email-user", email: "unique@example.com", password: "email legacy test password", tenantId, appRoles: { [appId]: [] } });
  writeFileSync(join(dir, "keys.json"), "signing material sentinel");
  const source = readFileSync(path, "utf8");
  const options = { mode: "advanced" as const, path, connectionString, installationId, appIds: { [tenantId]: [appId] } };
  const first = await openAuthStorage(options); const second = await openAuthStorage({ ...options, path: join(dir, "replica-users.json") });
  t.after(async () => { await first.close(); await second.close(); const pool = new Pool({ connectionString }); await pool.query("DELETE FROM bp_auth_records WHERE installation=$1", [installationId]); await pool.end(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(existsSync(path), false); assert.ok(existsSync(`${path}.advanced.backup`));
  assert.equal(readFileSync(join(dir, "keys.json"), "utf8"), "signing material sentinel");
  const imported = await first.transaction({ tenantId, appId }, tx => tx.get("user", user.id, { tenantId, appId: "" }));
  assert.equal(imported?.passwordHash, user.passwordHash);
  // Simulate a crash after the import committed but before source cleanup.
  writeFileSync(path, source);
  const resumed = await openAuthStorage(options); await resumed.close(); assert.equal(existsSync(path), false);
  assert.equal((await first.transaction({ tenantId, appId }, tx => tx.list("user"))).length, 3);
  writeFileSync(path, JSON.stringify({ version: 1, users: [] }));
  await assert.rejects(openAuthStorage(options), /differs from the committed import/);
  assert.ok(existsSync(path));
  await assert.rejects(openAuthStorage({ ...options, mode: "simple" }), /downgrade/);
  const a = new IdentityService(first, new SecretCipher(Buffer.alloc(32, 7))); const b = new IdentityService(second, new SecretCipher(Buffer.alloc(32, 7)));
  const legacyScope = { tenantId, appId }; const legacyPolicy = { ...policy, isolation: "tenant" as const };
  assert.equal((await a.authenticate(legacyScope, legacyPolicy, "legacy", "a legacy test password"))?.id, user.id);
  assert.equal((await b.authenticate(legacyScope, legacyPolicy, "Legacy", "another legacy test password"))?.id, collision.id);
  assert.equal(await b.findUser(legacyScope, legacyPolicy, "shared@example.com"), undefined);
  const retainedEmailUser = (await b.authenticate(legacyScope, legacyPolicy, "email-user", "email legacy test password"))!;
  assert.equal(retainedEmailUser.id, emailUser.id);
  assert.equal(retainedEmailUser.email, "unique@example.com");
  assert.equal(retainedEmailUser.emailVerified, false);
  assert.equal(retainedEmailUser.legacyUsernameLogin, true);

  const scope = { tenantId: uuidv7(), appId: uuidv7() };
  const creates = await Promise.allSettled([a, b].map(identity => identity.createUser(scope, policy, { username: "unique@example.com", email: "unique@example.com" })));
  assert.equal(creates.filter(r => r.status === "fulfilled").length, 1);
  await a.createUser(scope, policy, { username: "second" });
  await b.createUser(scope, policy, { username: "third" });
  await a.createUser({ ...scope, appId: uuidv7() }, policy, { username: "separate-app" });
  const page = await first.transaction(scope, tx => tx.page<User>("user", scope, { limit: 2 }));
  const rest = await second.transaction(scope, tx => tx.page<User>("user", scope, { limit: 2, after: page.at(-1)!.id }));
  assert.equal(page.length, 2); assert.equal(rest.length, 1);
  assert.equal(new Set([...page, ...rest].map(u => u.id)).size, 3);
  assert.ok(page[0].id < page[1].id && page[1].id < rest[0].id);
  assert.equal(await b.findUser({ tenantId: uuidv7(), appId: scope.appId }, policy, "unique@example.com"), undefined);
  await assert.rejects(b.createUser(scope, { ...policy, isolation: "tenant" }, { username: "another" }), /isolation is locked/);

  // Customer accounts, including an account in the management app, cannot claim bootstrap.
  const management = { tenantId: uuidv7(), appId: uuidv7() };
  await a.createUser(management, policy, { username: "customer", verified: true });
  assert.equal(await a.bootstrapAvailable(management), true);
  const roots = await Promise.allSettled([a, b].map((identity, i) => identity.createUser(management, policy, { username: `root-${i}` }, ["*"], true)));
  assert.equal(roots.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await b.bootstrapAvailable(management), false);
  await assert.rejects(a.createUser(management, policy, { username: "root-again" }, ["*"], true), /Bootstrap already completed/);

  await first.transaction(scope, async tx => {
    for (let i = 0; i < 300; i++) await tx.put("mail", scope, { id: `history-${i}`, scope, state: "sent", nextAttempt: 0 });
    for (let i = 0; i < 105; i++) await tx.put("mail", scope, { id: `due-${String(i).padStart(3, "0")}`, scope, state: i % 2 ? "sending" : "pending", nextAttempt: i });
    await tx.put("mail", scope, { id: "future", scope, state: "sending", nextAttempt: 9999 });
    await tx.put("mail", scope, { id: "failed", scope, state: "failed", nextAttempt: 0 });
  });
  const due = await second.transaction(scope, tx => tx.dueMail(1000, 100));
  assert.equal(due.length, 100);
  assert.deepEqual(due.map(row => row.id), Array.from({ length: 100 }, (_, i) => `due-${String(i).padStart(3, "0")}`));
  const inspection = new Pool({ connectionString });
  try {
    const client = await inspection.connect();
    try {
      await client.query("SET enable_seqscan=off");
      const plan = await client.query("EXPLAIN SELECT value FROM bp_auth_records WHERE installation=$1 AND kind='mail' AND value->>'state' IN ('pending','sending') AND (value->>'nextAttempt')::bigint <= $2 ORDER BY (value->>'nextAttempt')::bigint,id LIMIT 100", [installationId, 1000]);
      assert.match(plan.rows.map(r => r["QUERY PLAN"]).join("\n"), /bp_auth_mail_due/);
    } finally { client.release(); }
  } finally { await inspection.end(); }
});
