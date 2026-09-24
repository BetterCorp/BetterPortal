import assert from "node:assert/strict";
import { test } from "node:test";
import { BetterPortalConfigSchema, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage, ConfigRevisionConflictError } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { createPreviewGroup } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { registerPreviewDeploymentApi } from "../src/plugins/service-betterportal-config-manager/previewApi.js";

class ConflictStorage extends BaseStorage {
  cached?: BetterPortalConfig;
  saves = 0;
  invalidations = 0;
  conflict?: (candidate: BetterPortalConfig) => void;
  constructor(public current: BetterPortalConfig) { super(); }
  async loadConfig() { return structuredClone(this.cached ??= structuredClone(this.current)); }
  async saveConfig(candidate: BetterPortalConfig) {
    this.saves++;
    if (this.conflict) {
      this.conflict(candidate);
      throw new ConfigRevisionConflictError(1, 2);
    }
    this.current = structuredClone(candidate);
    this.cached = undefined;
  }
  override invalidate() { this.invalidations++; this.cached = undefined; super.invalidate(); }
}

function fixture() {
  const tenantId = uuidv7();
  const appId = uuidv7();
  const instanceId = uuidv7();
  const config = BetterPortalConfigSchema.parse({
    tenants: [{
      id: tenantId,
      slug: "source",
      title: "Source",
      branding: {},
      services: [{
        id: instanceId,
        hostname: "https://source-service.example",
        apiKeyHash: "source-hash",
        serviceId: "org.example.service",
        title: "Example service",
        createdAt: new Date().toISOString()
      }]
    }],
    apps: [{
      id: appId,
      tenantId,
      slug: "source-app",
      title: "Source app",
      hostnames: ["source.example"],
      themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: [{ id: uuidv7(), kind: "page", path: "/", serviceId: instanceId, viewId: "home", enabled: true, operations: ["home.view"] }]
    }]
  });
  const { group, apiKey } = createPreviewGroup(config, {
    name: "Pull requests",
    sourceTenantId: tenantId,
    sourceAppId: appId,
    expiresInDays: 30
  });
  const storage = new ConflictStorage(config);
  const handlers = new Map<string, (event: never) => Promise<Response>>();
  registerPreviewDeploymentApi({
    app: Object.fromEntries(["get", "post", "delete"].map(method => [method,
      (_path: string, handler: (event: never) => Promise<Response>) => handlers.set(method, handler)
    ])) as never,
    storage, controlPlaneUrl: "https://config.example", replayEncryptionKey: "test-key"
  });
  const call = (method = "post") => handlers.get(method)!({
    req: new Request("https://config.example/preview", {
      method: method.toUpperCase(), headers: { authorization: `Bearer ${apiKey}` },
      ...(method === "post" ? { body: JSON.stringify({ hostname: "pr.example", services: { "org.example.service": "https://service-pr.example" } }) } : {})
    }),
    context: { params: { groupId: group.id, key: "123" } }
  } as never);
  return { storage, call };
}

test("preview retries discard stale cache and preserve unrelated writes and credential replay", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.apps[0].title = "Concurrent edit";
    storage.conflict = undefined;
  };
  const response = await call();
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(storage.saves, 2);
  assert.equal(storage.invalidations, 1);
  assert.equal(storage.current.apps[0].title, "Concurrent edit");
  assert.equal(storage.current.previewEnvironmentDeployments.length, 1);
  assert.deepEqual(await (await call()).json(), payload);
  assert.equal(storage.saves, 2, "replay must not rotate credentials or write again");
});

test("a competing identical preview request replays the winner's committed credentials", async () => {
  const { storage, call } = fixture();
  storage.conflict = candidate => {
    storage.current = structuredClone(candidate);
    storage.conflict = undefined;
  };
  const response = await call();
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), await (await call()).json());
  assert.equal(storage.saves, 1, "retry must find the winner's replay instead of saving");
});

test("preview retries reauthenticate against the latest group credentials", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {
    storage.current.previewEnvironmentGroups[0].apiKeyHash = "revoked";
    storage.conflict = undefined;
  };
  assert.equal((await call()).status, 401);
  assert.equal(storage.saves, 1);
  assert.equal(storage.current.previewEnvironmentDeployments.length, 0);
});

test("persistent preview contention returns bounded retryable 503", async () => {
  const { storage, call } = fixture();
  storage.conflict = () => {};
  const response = await call();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(storage.saves, 5);
  assert.equal(storage.current.previewEnvironmentDeployments.length, 0);
});

test("preview DELETE and GET expiry cleanup retry conflicts", async () => {
  for (const method of ["delete", "get"]) {
    const { storage, call } = fixture();
    assert.equal((await call()).status, 201);
    if (method === "get") storage.current.previewEnvironmentDeployments[0].expiresAt = "2000-01-01T00:00:00.000Z";
    storage.conflict = () => {
      storage.current.apps[0].title = "Concurrent edit";
      storage.conflict = undefined;
    };
    assert.equal((await call(method)).status, method === "get" ? 404 : 204);
    assert.equal(storage.saves, 3);
    assert.equal(storage.current.previewEnvironmentDeployments.length, 0);
    assert.equal(storage.current.apps[0].title, "Concurrent edit");
  }
});
