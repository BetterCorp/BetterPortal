import assert from "node:assert/strict";
import test from "node:test";
import { Plugin } from "../src/plugins/service-betterportal-registry/index.js";

test("registry rejects unauthorized publishers before reading their body and honors ETags", async () => {
  const plugin = Object.create(Plugin.prototype) as any;
  Object.defineProperty(plugin, "config", { value: { publishers: { example: { token: "publisher-secret", pluginIdPrefixes: ["org.example."] } } } });
  plugin.body = () => { throw new Error("Body must not be read"); };
  let status = 0;
  let payload: string | undefined;
  let headers: Record<string, string> = {};
  const reply = { writeHead(code: number, values: Record<string, string>) { status = code; headers = values; }, end(body?: string) { payload = body; } };
  await plugin.handle({ method: "POST", url: "/v1/packages/example/service", headers: {} }, reply);
  assert.equal(status, 403);
  plugin.store = { get: () => ({ digest: "digest", registryRef: "example/service", contract: {} }) };
  await plugin.handle({ method: "GET", url: "/v1/packages/example/service/latest/schema.json", headers: { "if-none-match": '"other", W/"digest"' } }, reply);
  assert.equal(status, 304);
  assert.equal(payload, undefined);
  assert.equal(headers.ETag, '"digest"');
  assert.equal(headers["BP-Registry-Ref"], "example/service");
  assert.equal(headers["cache-control"], "public, no-cache");
  plugin.body = async () => ({
    manifest: { protocolVersion: 2, pluginId: "org.other.service", title: "Test", description: "Test", version: "1.0.0", category: "service", deploymentModes: ["self-hosted"], views: [] },
    routes: []
  });
  plugin.store.publish = () => { assert.fail("Wrong-prefix contract must not be published"); };
  await plugin.handle({ method: "POST", url: "/v1/packages/example/service", headers: { authorization: "Bearer publisher-secret" } }, reply);
  assert.equal(status, 403);
  assert.match(payload!, /Publisher cannot publish/);
});
