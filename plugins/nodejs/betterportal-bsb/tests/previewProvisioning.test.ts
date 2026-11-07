import assert from "node:assert/strict";
import test from "node:test";
import { Plugin as Vault } from "@bsb/config-vault";
import { InMemoryServiceConfigStore, encryptPreviewConfigValue, uuidv7 } from "@betterportal/framework";
import { BPService, BetterPortalConfigSchema, BetterPortalPreviewOverridePaths } from "../src/service.js";
import { execute } from "../../../../.github/actions/preview-environment/index.mjs";

const id = "org.example.orders";
const key = `bp_pck_${Buffer.alloc(32, 1).toString("base64url")}`;
const obs = { trace: {}, log: { info() {}, warn() {} } };

function published(authorized = true) {
  return { application: "preview", group: "services", profile: "pr-123", version: 1, config: {
    "pr-123": { services: { orders: { enabled: true, plugin: "orders", package: "example", version: "1", config: {
      port: 8080, database: { name: "published-db" }, betterportal: { trustedProxyIps: ["10.0.0.1"] }
    }, ...(authorized ? { envOverridePaths: BetterPortalPreviewOverridePaths } : {}) } } }
  } };
}

function loadVault(overrides: unknown, authorized = true) {
  const vault = Object.create(Vault.prototype) as any;
  vault.config = { BSB_CONFIG_OVERRIDES: JSON.stringify(overrides) };
  const source = published(authorized);
  vault.applyResolved(source, obs);
  assert.equal(source.config["pr-123"].services.orders.config.betterportal.controlPlaneUrl, undefined,
    "runtime credentials must not modify published/cache configuration");
  return vault.appConfig["pr-123"].services.orders.config;
}

test("fresh preview action → authorized Vault → manifest acceptance and decrypted scoped config exits setup", async t => {
  const outputs = new Map();
  let calls = 0;
  await execute({
    "INPUT_CONTROL-PLANE-URL": "https://config.example", "INPUT_GROUP-ID": "group", "INPUT_KEY": "123",
    "INPUT_AUDIENCE": "preview", "INPUT_HOSTNAME": "app.example", "INPUT_SERVICES-JSON": JSON.stringify({ [id]: "https://orders.example" }),
    "INPUT_BSB-PROVISIONING-JSON": JSON.stringify({ [id]: { alias: "orders", overrides: { services: { orders: { database: { name: "preview-db" } } } } } }),
    "INPUT_PREVIEW-CONFIG-KEY": key,
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com/token", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token"
  }, {
    command() {}, setOutput: (name: string, value: string) => outputs.set(name, value),
    fetchImpl: async (_url: string, init: RequestInit) => {
      assert.ok(!JSON.stringify(init).includes(key));
      if (++calls === 1) return Response.json({ value: "oidc" });
      if (init.method === "GET") return new Response(null, { status: 404 });
      return Response.json({ created: true, preview: {}, credentials: [{ serviceId: id,
        environment: { BP_CONTROL_PLANE_URL: "https://config.example", BP_SERVICE_API_KEY: "preview-key" } }] });
    }
  });
  const overrides = JSON.parse(outputs.get("bsb-overrides-json"))[id];
  assert.throws(() => loadVault(overrides, false), /does not allow environment overrides/);
  assert.throws(() => loadVault({ services: { orders: { database: { name: "not-authorized" } } } }), /not declared as overrideable/);
  // Preserve the published database value; it has no CI override authorization.
  delete overrides.services.orders.database;
  const config = loadVault(overrides);
  assert.equal(config.database.name, "published-db");
  assert.deepEqual(config.betterportal.trustedProxyIps, ["10.0.0.1"]);
  config.betterportal = BetterPortalConfigSchema.parse(config.betterportal);

  const tenantId = uuidv7(), appId = uuidv7();
  const service = Object.create(BPService.prototype) as any;
  Object.assign(service, {
    config: { ...config, betterportal: BetterPortalConfigSchema.parse({}) }, bootstrapState: { read: () => ({}) }, requireBetterPortalConfigSource: true,
    manifestSync: { state: "pending" },
    manifest: { pluginId: id, version: "11.0.8", views: [], configSchemas: [{ id: "tenant", title: "Tenant", description: "Preview", scope: "tenant",
      jsonSchema: { token: "string" }, fields: [{ key: "token", title: "Token", description: "Preview token", scope: "tenant", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", required: true }] }] },
    scopedConfigCache: { write() {} }, seoProbeCache: new Map(), server: { listening: false }, configStore: new InMemoryServiceConfigStore(),
    updateS2SIdentityState() {}, logScopedConfigDebug() {}
  });
  t.after(() => service.dispose());
  service.resolveCredentials(obs);
  const waiting = await service.renderHealth().json();
  assert.equal(waiting.ok, true, "discovery health alone cannot prove preview readiness");
  assert.equal(waiting.setupMode, true);
  service.config = config;
  service.resolveCredentials(obs);
  assert.equal(service.inSetupMode, false);
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push(url);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer preview-key");
    if (init.method === "POST") {
      const submission = JSON.parse(init.body as string);
      assert.equal(submission.manifestVersion, "11.0.8");
      assert.equal(submission.configSchemas[0].id, "tenant");
      return Response.json({ serviceIdentity: { id }, managementOrigins: [], tenants: [{ id: tenantId, slug: "preview", title: "Preview", services: [] }],
        apps: [{ id: appId, tenantId, slug: "preview", title: "Preview", hostnames: ["app.example"] }],
        previewConfig: { revision: "1", tenant: { token: encryptPreviewConfigValue(key, "tenant", ["token"], "decrypted-secret") }, app: {} } });
    }
    return new Response(new ReadableStream({ start(controller) {
      init.signal?.addEventListener("abort", () => controller.error(new DOMException("Disposed", "AbortError")), { once: true });
    } }));
  });
  const connected = await service.connectToControlPlane(obs);
  assert.equal(connected, true, JSON.stringify(service.manifestSync));
  assert.deepEqual(requests, ["https://config.example/.well-known/bp/sync/poll", "https://config.example/.well-known/bp/sync"]);
  assert.equal(service.manifestSync.state, "synced");
  assert.equal(service.effectiveServiceConfig(tenantId).token, "decrypted-secret");
  const health = await service.renderHealth(true).json();
  assert.equal(health.setupMode, false);
  assert.equal(health.config.synced, true);
  assert.equal(health.sync.state, "synced");
});
