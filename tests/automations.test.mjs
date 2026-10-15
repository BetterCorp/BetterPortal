import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { discover } = createRequire(import.meta.url)("../automations/shared/bp-client.js");

test("automation discovery normalizes long URLs without blocking the event loop", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ services: [] }), { status: 200 }));
  const tenantUrl = `https://tenant.test/${"/".repeat(50_000)}path`;
  const started = performance.now();
  await discover({ tenantUrl, configManagerUrl: "https://manager.test" });
  assert.ok(performance.now() - started < 250, "automation URL normalization must stay linear");
});
