import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BootstrapStateStore } from "../src/bootstrapState.js";
import { BPService, BetterPortalConfigSchema, type BetterPortalConfig } from "../src/service.js";

function runtime(config: BetterPortalConfig = {}, stored: Record<string, string> = {}) {
  const service = Object.create(BPService.prototype) as any;
  Object.assign(service, {
    requireBetterPortalConfigSource: true,
    config: { betterportal: config },
    bootstrapState: { read: () => stored },
    manifest: { pluginId: "org.example.service" }
  });
  return service;
}

const observer = { log: { info() {} } };

test("first startup waits for pairing and an optional BSB URL pins the candidate", () => {
  const config = BetterPortalConfigSchema.parse({});
  assert.equal(config?.controlPlaneUrl, undefined);
  assert.equal(config?.allowDevConfigToken, false);
  const service = runtime(config);
  service.resolveCredentials(observer);
  assert.equal(service.inSetupMode, true);
  assert.equal(service.resolvedCpUrl, null);
  assert.equal(service.resolvedApiKey, null);
  service.config.betterportal.controlPlaneUrl = "https://pinned.test";
  service.resolveCredentials(observer);
  assert.equal(service.inSetupMode, true);
  assert.equal(service.resolvedCpUrl, "https://pinned.test");
});

test("saved pairing takes precedence over BSB provisioning credentials on restart", () => {
  const service = runtime({ controlPlaneUrl: "https://configured.test", serviceApiKey: "configured" });
  service.resolveCredentials(observer);
  assert.equal(service.inSetupMode, false);
  assert.equal(service.resolvedCpUrl, "https://configured.test");
  service.bootstrapState.read = () => ({ cpUrl: "https://paired.test", apiKey: "paired" });
  service.resolveCredentials(observer);
  assert.equal(service.inSetupMode, false);
  assert.equal(service.resolvedCpUrl, "https://paired.test");
  assert.equal(service.resolvedApiKey, "paired");
});

test("development config tokens require explicit BSB opt-in and the configured secret", () => {
  const service = runtime({ configApiToken: "local-token" });
  const event = { req: new Request("https://service.test", { headers: { "x-bp-tenant-id": "local-tenant" } }) };
  const validate = (token = "local-token") => service.validateDevConfigToken(token, event, "config.read");
  assert.equal(validate(), null);
  service.config.betterportal.allowDevConfigToken = true;
  assert.equal(validate("wrong-token"), null);
  assert.equal(validate()?.tenantId, "local-tenant");
  service.config.betterportal.allowDevConfigToken = false;
  assert.equal(validate(), null);
});

test("offline pairing migration preserves encryption and tenant state while accepting rotated BSB credentials", t => {
  const directory = mkdtempSync(join(tmpdir(), "bp-pairing-migration-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filePath = join(directory, "bootstrap.json");
  const store = new BootstrapStateStore({ filePath });
  store.write({ apiKey: "paired-key", cpUrl: "https://config.test", cpId: "control-plane", cpJwksUri: "https://config.test/jwks",
    configEncryptionKey: "retain-encryption-key", tenantLock: "retain-tenant", installedAt: "2026-11-07T00:00:00Z",
    installation: { jti: "old-installation" } as any });
  const localKey = readFileSync(`${filePath}.key`, "utf8");
  const service = runtime({ controlPlaneUrl: "https://config.test", serviceApiKey: "rotated-key" });
  service.bootstrapState = store;
  service.resolveCredentials(observer);
  assert.equal(service.resolvedApiKey, "paired-key");
  store.clearPairing();
  const restored = new BootstrapStateStore({ filePath });
  assert.deepEqual(restored.read(), { version: 1, configEncryptionKey: "retain-encryption-key", tenantLock: "retain-tenant" });
  assert.equal(readFileSync(`${filePath}.key`, "utf8"), localKey);
  assert.ok(!readFileSync(filePath, "utf8").includes("retain-encryption-key"));
  service.bootstrapState = restored;
  service.resolveCredentials(observer);
  assert.equal(service.resolvedApiKey, "rotated-key");
  assert.equal(service.resolvedCpUrl, "https://config.test");
  assert.equal(service.inSetupMode, false);
});
