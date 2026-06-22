import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileBackedServiceConfigStore, InMemoryServiceConfigStore } from "../src/runtime/configStore.js";
import type { ServiceConfigTicketClaims } from "../src/contracts/serviceConfig.js";

function ticket(tenantId: string): ServiceConfigTicketClaims {
  return {
    iss: "test",
    aud: "test",
    sub: "test",
    exp: 9999999999,
    iat: 1,
    jti: tenantId,
    realm: "control-plane",
    tenantId,
    serviceId: "service.test",
    actions: ["config.read", "config.write"]
  };
}

test("service config store isolates tenant defaults", () => {
  const store = new InMemoryServiceConfigStore();
  store.write("tenant-a", undefined, { issuer: "a" }, ticket("tenant-a"));
  store.write("tenant-b", undefined, { issuer: "b" }, ticket("tenant-b"));
  store.write("tenant-a", "app-a", { audience: "app-a" }, ticket("tenant-a"));

  assert.deepEqual(store.read(ticket("tenant-a")), {
    tenant: { issuer: "a" },
    app: { "app-a": { audience: "app-a" } }
  });
  assert.deepEqual(store.read(ticket("tenant-b")), {
    tenant: { issuer: "b" },
    app: {}
  });
});

test("file-backed service config migrates legacy tenant shape into the first tenant", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-config-store-"));
  const filePath = join(dir, "state.json");
  writeFileSync(filePath, JSON.stringify({ tenant: { issuer: "legacy" }, app: {} }), "utf8");

  const store = new FileBackedServiceConfigStore({ filePath, configSchemas: [], encryptionKey: "test-key-min16chars" });
  assert.deepEqual(store.read(ticket("tenant-a")), { tenant: { issuer: "legacy" }, app: {} });

  const persisted = JSON.parse(readFileSync(filePath, "utf8"));
  assert.deepEqual(persisted, {
    tenants: {
      "tenant-a": { tenant: { issuer: "legacy" }, app: {} }
    }
  });
});
