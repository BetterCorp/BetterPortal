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
