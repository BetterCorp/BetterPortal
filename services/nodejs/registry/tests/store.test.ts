import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BpSchemaOutputSchema } from "@betterportal/framework";
import { ContractRegistryStore } from "../src/plugins/service-betterportal-registry/store.js";

function contract(version: string, description = "Registry test") {
  return BpSchemaOutputSchema.parse({
    manifest: {
      protocolVersion: 2,
      pluginId: "org.betterportal.test",
      title: "Test",
      description,
      version,
      category: "service",
      deploymentModes: ["self-hosted"],
      views: []
    },
    routes: []
  });
}

test("registry versions are immutable and identical retries are idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-registry-"));
  try {
    const store = new ContractRegistryStore(dir);
    assert.equal(store.publish("betterportal/test", contract("1.0.0")).status, "created");
    assert.equal(store.publish("betterportal/test", contract("1.0.0")).status, "unchanged");
    assert.equal(store.publish("betterportal/test", contract("1.0.0", "changed")).status, "version_conflict");
    assert.equal(store.publish("community/test", contract("1.1.0")).status, "identity_conflict");
    assert.equal(store.publish("betterportal/test", contract("2.0.0-rc.1")).status, "created");
    assert.equal(store.publish("betterportal/test", contract("1.1.0")).status, "created");
    assert.equal(store.publish("betterportal/test", contract("2.0.0")).status, "created");
    assert.equal(store.get("betterportal/test", "latest")?.version, "2.0.0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("registry does not read a JSON file outside a published package", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-registry-traversal-"));
  try {
    const store = new ContractRegistryStore(dir);
    store.publish("betterportal/test", contract("1.0.0"));
    const secret = "private-contract-canary";
    writeFileSync(join(dir, "private.json"), JSON.stringify({
      digest: "private", registryRef: "private", contract: { secret }
    }));

    assert.equal(store.get("betterportal/test", "../../../private"), null);
    assert.equal(store.getByPluginId("org.betterportal.test", "../../../private"), null);
    assert.equal(store.get("betterportal/test", "1.0.0")?.version, "1.0.0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
