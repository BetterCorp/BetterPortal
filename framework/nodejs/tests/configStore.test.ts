import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
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

test("secret values are written in the aes256gcm2 envelope with a 96-bit IV", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-cfg-iv-"));
  const filePath = join(dir, "store.json");
  const store = new FileBackedServiceConfigStore({
    filePath,
    configSchemas: [{ serviceId: "service.test", fields: [{ key: "token", visibility: "secret" }] }] as never,
    encryptionKey: "bp_cek_unit_test_key_material_0000000000"
  });
  store.write("tenant-a", undefined, { token: "s3cret" }, ticket("tenant-a"));

  const stored = JSON.parse(readFileSync(filePath, "utf8")).tenants["tenant-a"].tenant.token as string;
  assert.ok(stored.startsWith("enc:aes256gcm2:"), `unexpected envelope: ${stored.slice(0, 20)}`);

  const payload = Buffer.from(stored.slice("enc:aes256gcm2:".length), "base64");
  // payload is iv || authTag(16) || ciphertext, and GCM ciphertext matches
  // plaintext length, so the IV is whatever remains.
  assert.equal(payload.length - 16 - "s3cret".length, 12);
  assert.equal(store.read(ticket("tenant-a")).tenant.token, "s3cret");
});

test("legacy aes256gcm secrets stay readable after the envelope change", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-cfg-legacy-"));
  const filePath = join(dir, "store.json");
  const encryptionKey = "bp_cek_unit_test_key_material_0000000000";
  const configSchemas = [{ serviceId: "service.test", fields: [{ key: "token", visibility: "secret" }] }] as never;

  // Reproduce a v1 value exactly as the previous implementation wrote it:
  // 16-byte IV and scrypt at node's default cost.
  const legacyKey = scryptSync(encryptionKey, "bp-config-store", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", legacyKey, iv);
  const body = Buffer.concat([cipher.update("legacy-secret", "utf8"), cipher.final()]);
  const legacy = "enc:aes256gcm:" + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");

  writeFileSync(filePath, JSON.stringify({ tenants: { "tenant-a": { tenant: { token: legacy }, app: {} } } }));

  const store = new FileBackedServiceConfigStore({ filePath, configSchemas, encryptionKey });
  assert.equal(store.read(ticket("tenant-a")).tenant.token, "legacy-secret");
});

test("all JSON secret types are encrypted and survive reopening", () => {
  const filePath = join(mkdtempSync(join(tmpdir(), "bp-json-secrets-")), "store.json");
  const values = { object: { token: "hidden-object-token" }, array: ["hidden-array-token"], number: 42, bool: true, nil: null };
  const options = { filePath, encryptionKey: "test-key-min16chars", configSchemas: [{ fields: Object.keys(values).map(key => ({ key, visibility: "secret" })) }] as never };
  new FileBackedServiceConfigStore(options).write("tenant-a", undefined, values, ticket("tenant-a"));
  const raw = readFileSync(filePath, "utf8");
  assert.ok(!raw.includes("hidden-object-token") && !raw.includes("hidden-array-token"));
  for (const value of Object.values(JSON.parse(raw).tenants["tenant-a"].tenant)) assert.match(value as string, /^enc:aes256gcm3:/);
  assert.deepEqual(new FileBackedServiceConfigStore(options).read(ticket("tenant-a")).tenant, values);
});

test("loading migrates plaintext secrets in every bucket without losing legacy data or double encryption", () => {
  const values = { text: "hidden", object: { token: "secret" }, array: ["secret"], number: 42, bool: false, nil: null };
  for (const legacy of [false, true]) {
    const filePath = join(mkdtempSync(join(tmpdir(), "bp-migrate-secrets-")), "store.json");
    const bucket = { tenant: { ...values, public: "visible" }, app: { app: values } };
    writeFileSync(filePath, JSON.stringify(legacy ? bucket : { tenants: { "tenant-a": bucket, "tenant-b": bucket } }));
    const options = { filePath, encryptionKey: "test-key-min16chars", configSchemas: [{ fields: Object.keys(values).map(key => ({ key, visibility: "secret" })) }] as never };
    new FileBackedServiceConfigStore(options);
    const migrated = readFileSync(filePath, "utf8");
    assert.doesNotMatch(migrated, /"hidden"|"secret"/);
    const reopened = new FileBackedServiceConfigStore(options);
    assert.equal(readFileSync(filePath, "utf8"), migrated, "already encrypted values are untouched");
    assert.deepEqual(reopened.read(ticket("tenant-a")), bucket);
    if (!legacy) assert.deepEqual(reopened.read(ticket("tenant-b")), bucket);
    reopened.write("tenant-a", undefined, { unrelated: true }, ticket("tenant-a"));
    assert.deepEqual(new FileBackedServiceConfigStore(options).read(ticket("tenant-a")).app.app, values);
  }
});
