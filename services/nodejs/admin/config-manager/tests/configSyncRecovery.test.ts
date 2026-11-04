import assert from "node:assert/strict";
import { test } from "node:test";
import { H3 } from "h3";
import { BetterPortalConfigSchema } from "@betterportal/framework";
import { Plugin } from "../src/plugins/service-betterportal-config-manager/index.js";
import { registerSyncEndpoint } from "../src/plugins/service-betterportal-config-manager/syncApi.js";

test("BSB subscription refreshes current config and propagates cache failures to BSB", async () => {
  const plugin = Object.create(Plugin.prototype) as any;
  const config = BetterPortalConfigSchema.parse({});
  let changed!: (obs: unknown, input: { revision: number }) => Promise<void>;
  let reads = 0;
  let fail = false;
  Object.assign(plugin, {
    storage: {
      invalidate() {},
      async loadConfig() { reads++; if (fail) { fail = false; throw new Error("temporary read failure"); } return config; }
    },
    authCacheGeneration: 0,
    authConfigCache: new Map(),
    selfClient: { async onPlatformConfigChanged(_obs: unknown, listener: typeof changed) { changed = listener; } }
  });
  await plugin.subscribeConfigChanges({ log: { warn() {} } });
  assert.equal(reads, 1);
  fail = true;
  await assert.rejects(changed(undefined, { revision: 20 }), /temporary read failure/);
  await changed(undefined, { revision: 20 });
  assert.equal(reads, 3, "BSB redelivery can retry the refresh");
  await changed(undefined, { revision: 19 });
  assert.equal(reads, 4, "out-of-order commits still invalidate caches");
});

test("failed sync refreshes close the stream and reconnect reads the latest config", { timeout: 5000 }, async t => {
  const app = new H3();
  const listeners = new Set<() => void>();
  let fail = true;
  let origins: string[] = [];
  let reads = 0;
  registerSyncEndpoint(app, {
    onChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    async validateApiKey() { return { scope: "platform", serviceId: "service", service: {} }; },
    async getScopedConfig() {
      reads++;
      if (fail) { fail = false; throw new Error("temporary projection failure"); }
      return { managementOrigins: origins, tenants: [], apps: [] };
    }
  } as never);
  const connect = async () => {
    const response = await app.request("/.well-known/bp/sync", { headers: { authorization: "Bearer key" } });
    const reader = response.body!.getReader();
    t.after(() => reader.cancel().catch(() => {}));
    return reader;
  };
  assert.equal((await (await connect()).read()).done, true, "failed initial projection closes instead of heartbeating stale config");
  for (const next of [[], ["https://granted.example"], []]) {
    origins = next;
    const reader = await connect();
    const chunk = new TextDecoder().decode((await reader.read()).value);
    assert.match(chunk, /event: config/);
    assert.deepEqual(JSON.parse(chunk.split("data: ")[1]).managementOrigins, next);
    fail = true;
    for (const listener of listeners) listener();
    assert.equal((await reader.read()).done, true, "failed updates close the existing stream");
  }
  assert.equal(reads, 7);
  assert.equal(listeners.size, 1, "closed streams release subscriptions");
});

test("new sync connections and polls read current configuration even when no broadcast was received", { timeout: 5000 }, async t => {
  const app = new H3();
  let origins: string[] = [];
  let reads = 0;
  registerSyncEndpoint(app, {
    onChange() { return () => {}; },
    async validateApiKey() { return { scope: "platform", serviceId: "service", service: {} }; },
    async getScopedConfig() { reads++; return { managementOrigins: origins, tenants: [], apps: [] }; }
  } as never);
  const headers = { authorization: "Bearer key" };
  const connect = async () => {
    const response = await app.request("/.well-known/bp/sync", { headers });
    const reader = response.body!.getReader();
    t.after(() => reader.cancel().catch(() => {}));
    return new TextDecoder().decode((await reader.read()).value);
  };
  assert.doesNotMatch(await connect(), /granted.example/);
  origins = ["https://granted.example"];
  assert.match(await connect(), /granted.example/);
  origins = [];
  assert.deepEqual((await (await app.request("/.well-known/bp/sync/poll", { headers })).json()).managementOrigins, []);
  assert.equal(reads, 3);
});
