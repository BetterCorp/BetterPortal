import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BpSchemaOutputSchema } from "@betterportal/framework";
import { ContractRegistryStore } from "../src/plugins/service-betterportal-registry/store.js";

function contract(version: string, description = "Registry test") {
  return BpSchemaOutputSchema.parse({
    manifest: {
      protocolVersion: 1,
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
