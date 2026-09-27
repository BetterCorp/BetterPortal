import { createNoopObservability } from "@betterportal/framework";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonAuthStorage } from "../src/storage.js";
import { IdentityService, SecretCipher } from "../src/identity.js";
import { MailQueue } from "../src/mail.js";

test("Postal uses the documented payload and treats a 200 error as a retryable failure", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-mail-")); const path = join(dir, "users.json"); const storage = new JsonAuthStorage(path);
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  const queue = new MailQueue(identity, () => ({ transport: "postal", url: "https://postal.test", from: "auth@example.com", apiKey: "test-key" }));
  const scope = { tenantId: "tenant", appId: "app" };
  await storage.transaction(scope, tx => queue.enqueue(tx, scope, "alice@example.com", "Verify", "private one-use link"));
  assert.ok(!readFileSync(path, "utf8").includes("private one-use link"));
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++; assert.equal(url, "https://postal.test/api/v1/send/message");
    assert.equal(new Headers(init.headers).get("X-Server-API-Key"), "test-key");
    assert.deepEqual(JSON.parse(String(init.body)), { from: "auth@example.com", to: ["alice@example.com"], subject: "Verify", plain_body: "private one-use link", html_body: "" });
    return Response.json({ status: calls === 1 ? "error" : "success" });
  });
  await queue.drain();
  const [pending] = await storage.transaction(scope, tx => tx.list("mail", scope));
  assert.equal(pending.state, "pending"); assert.equal(pending.attempts, 1);
  await storage.transaction(scope, tx => tx.put("mail", scope, { ...pending, nextAttempt: 0 }));
  await Promise.all([queue.drain(), queue.drain()]);
  const [sent] = await storage.transaction(scope, tx => tx.list("mail", scope));
  assert.equal(calls, 2); assert.equal(sent.state, "sent"); assert.equal(sent.encrypted, "");
});

test("queued mail revalidates changed delivery configuration before exposing secrets", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-mail-url-")); const storage = new JsonAuthStorage(join(dir, "users.json"));
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  const config = { transport: "http" as const, url: "https://mail.test", from: "auth@example.com" };
  const queue = new MailQueue(identity, () => config); const scope = { tenantId: "tenant", appId: "app" };
  await storage.transaction(scope, tx => queue.enqueue(tx, scope, "alice@example.com", "Reset", "private reset proof"));
  let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("ok"); });
  config.url = "http://mail.test";
  await queue.drain(); assert.equal(calls, 0);
  const [job] = await storage.transaction(scope, tx => tx.list("mail", scope));
  assert.equal(job.state, "pending"); assert.equal(job.attempts, 1);
  config.url = "https://mail.test";
  await storage.transaction(scope, tx => tx.put("mail", scope, { ...job, nextAttempt: 0 }));
  await queue.drain(); assert.equal(calls, 1);
});

test("mail resumes request trace and logs safe retry and terminal outcomes", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bp-mail-trace-")); const storage = new JsonAuthStorage(join(dir, "users.json"));
  t.after(async () => { await storage.close(); rmSync(dir, { recursive: true, force: true }); });
  const identity = new IdentityService(storage, new SecretCipher(Buffer.alloc(32, 7)));
  const scope = { tenantId: "tenant", appId: "app" };
  const obs = createNoopObservability();
  const events: unknown[] = [];
  let ended = 0;
  t.mock.method(obs, "startSpan", () => obs);
  t.mock.method(obs, "setAttributes", attributes => { events.push(attributes); return obs; });
  t.mock.method(obs, "end", () => { ended++; });
  t.mock.method(obs, "error", (error, attributes) => events.push({ error: error.message, attributes }));
  for (const level of ["info", "warn", "error"] as const) t.mock.method(obs.logger, level, (...args: unknown[]) => { events.push(args); });
  const config = () => ({ transport: "postal" as const, url: "https://mail.test", from: "sender@example.com", apiKey: "private-key" });
  await storage.transaction(scope, tx => new MailQueue(identity, config).enqueue(tx, scope, "private@example.com", "Private subject", "private verification token", obs));
  const queue = new MailQueue(identity, config, parent => { assert.deepEqual(parent, obs.trace); return obs; });
  t.mock.method(globalThis, "fetch", async () => new Response("private provider response", { status: 401 }));
  for (let attempt = 1; attempt <= 5; attempt++) {
    await queue.drain();
    const [row] = await storage.transaction(scope, tx => tx.list("mail", scope));
    assert.equal(row.attempts, attempt);
    assert.equal(row.state, attempt === 5 ? "failed" : "pending");
    await storage.transaction(scope, tx => tx.put("mail", scope, { ...row, nextAttempt: 0 }));
  }
  assert.equal(ended, 6);
  const output = JSON.stringify(events);
  assert.match(output, /exhausted retries/);
  assert.match(output, /http_error/);
  assert.match(output, /401/);
  for (const secret of ["private", "sender@example.com", "Private subject"]) assert.ok(!output.includes(secret));
});
