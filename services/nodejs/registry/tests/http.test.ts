import assert from "node:assert/strict";
import test from "node:test";
import { Plugin } from "../src/plugins/service-betterportal-registry/index.js";

test("registry rejects unauthorized publishers before reading their body and honors ETags", async () => {
  const plugin = Object.create(Plugin.prototype) as any;
  Object.defineProperty(plugin, "config", { value: { publishers: { example: { token: "publisher-secret", pluginIdPrefixes: ["org.example."] } } } });
  plugin.body = () => { throw new Error("Body must not be read"); };
  let status = 0;
  let payload: string | undefined;
  const reply = { writeHead(code: number) { status = code; }, end(body?: string) { payload = body; } };
  await plugin.handle({ method: "POST", url: "/v1/packages/example/service", headers: {} }, reply);
  assert.equal(status, 403);
  plugin.store = { get: () => ({ digest: "digest", registryRef: "example/service", contract: {} }) };
  await plugin.handle({ method: "GET", url: "/v1/packages/example/service/latest/schema.json", headers: { "if-none-match": '"other", W/"digest"' } }, reply);
  assert.equal(status, 304);
  assert.equal(payload, undefined);
});
