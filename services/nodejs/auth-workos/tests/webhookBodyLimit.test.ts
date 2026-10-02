import assert from "node:assert/strict";
import { test } from "node:test";
import { createBetterPortalApp } from "@betterportal/framework";
import { Plugin } from "../src/plugins/service-betterportal-auth-workos/index.js";

const webhookPath = "/.well-known/workos/webhooks";

function webhookApp(candidates: Array<{ config: { webhookSecret: string } }> = []) {
  const app = createBetterPortalApp();
  const plugin = {
    matchingConfiguredApps: () => candidates,
    client: () => ({ webhooks: { constructEvent: async ({ payload }: { payload: string }) => {
      assert.equal(payload, "{\"event\":\"ok\"}");
      return { event: "unrelated.event" };
    } } })
  };
  const handle = Reflect.get(Plugin.prototype, "handleWorkOSWebhook") as (this: typeof plugin, event: unknown) => Promise<Response>;
  app.post(webhookPath, event => handle.call(plugin, event));
  return app;
}

function bodyStream(chunkBytes: number) {
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (reads === 6) { controller.close(); return; }
      reads++;
      controller.enqueue(new Uint8Array(chunkBytes));
    },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  return { body, get reads() { return reads; }, get cancelled() { return cancelled; } };
}

test("unsigned WorkOS webhooks are rejected without reading their body", async () => {
  const stream = bodyStream(256 * 1024);
  const request = new Request(`https://workos.example${webhookPath}`, {
    method: "POST", body: stream.body, duplex: "half"
  } as RequestInit & { duplex: "half" });
  const response = await webhookApp().fetch(request);
  assert.equal(response.status, 401);
  assert.equal(stream.reads, 0);
  assert.equal(stream.cancelled, true);
});

test("declared oversized WorkOS webhooks are rejected before streaming", async () => {
  const stream = bodyStream(256 * 1024);
  const request = new Request(`https://workos.example${webhookPath}`, {
    method: "POST", body: stream.body, duplex: "half",
    headers: { "workos-signature": "attacker", "content-length": String(2 * 1024 * 1024) }
  } as RequestInit & { duplex: "half" });
  const response = await webhookApp().fetch(request);
  assert.equal(response.status, 413);
  assert.equal(stream.reads, 0);
  assert.equal(stream.cancelled, true);
});

test("chunked WorkOS webhooks stop reading at the byte limit", async () => {
  const stream = bodyStream(256 * 1024);
  const request = new Request(`https://workos.example${webhookPath}`, {
    method: "POST", body: stream.body, duplex: "half",
    headers: { "workos-signature": "attacker" }
  } as RequestInit & { duplex: "half" });
  const response = await webhookApp().fetch(request);
  assert.equal(response.status, 413);
  assert.ok(stream.reads <= 6, `read ${stream.reads} chunks`);
  assert.equal(stream.cancelled, true);
});

test("small signed WorkOS webhooks still reach signature verification", async () => {
  const response = await webhookApp([{ config: { webhookSecret: "secret" } }]).fetch(new Request(`https://workos.example${webhookPath}`, {
    method: "POST", headers: { "workos-signature": "signature" }, body: "{\"event\":\"ok\"}"
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: true });
});
