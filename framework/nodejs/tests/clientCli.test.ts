import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BpSchemaOutputSchema, type BpSchemaOutput } from "../src/contracts/manifest.js";
import { PluginIdSchema } from "../src/contracts/common.js";
import { emitTypeScriptClient, installClient, syncClients } from "../src/cli/client.js";
import { parseDependencySelector } from "../src/cli/project.js";

function contract(responseField = "message"): BpSchemaOutput {
  return BpSchemaOutputSchema.parse({
    manifest: {
      protocolVersion: 2,
      pluginId: "org.betterportal.config",
      title: "Config",
      description: "Config service",
      version: "1.2.3",
      category: "service",
      deploymentModes: ["self-hosted"],
      views: [{
        viewId: "config.index",
        title: "Config",
        description: "Read config",
        path: "/",
        paramsSchema: {},
        operations: [{
          operationId: "config.read",
          method: "GET",
          title: "Read config",
          description: "Read config",
          querySchema: {},
          headersSchema: {},
          bodySchema: {},
          jsonResponseSchema: {
            root: { kind: "object", properties: { [responseField]: { kind: "string" } }, required: [responseField] }
          },
          metadataResponseSchema: {},
          html: { renderers: {} },
          auth: { required: false, permissions: [] },
          demoScenarios: [],
          cacheHints: { ttlSeconds: 0, varyBy: [] }
        }]
      }]
    },
    routes: [{ viewId: "config.index", path: "/", operations: [{ operationId: "config.read", method: "GET" }], paramNames: [], renderers: [], hasFragments: false, fragments: [], components: [] }]
  });
}

test("dependency selectors accept plugin IDs, registry refs, and defaulted short names", () => {
  assert.equal(parseDependencySelector("org.betterportal.config").pluginId, "org.betterportal.config");
  assert.equal(parseDependencySelector("betterportal/config@1.2.3").registryRef, "betterportal/config");
  assert.equal(parseDependencySelector("config", "betterportal").registryRef, "betterportal/config");
});

test("plugin IDs use reverse-domain identity", () => {
  assert.equal(PluginIdSchema.parse("org.betterportal.config"), "org.betterportal.config");
  assert.throws(() => PluginIdSchema.parse("service.config"));
  assert.throws(() => PluginIdSchema.parse("org.betterportal.bad-"));
});

test("client install prefers an explicit local contract and syncs changed types", async () => {
  const root = mkdtempSync(join(tmpdir(), "bp-client-"));
  const consumer = join(root, "consumer");
  const producer = join(root, "external", "producer");
  const previousCwd = process.cwd();
  try {
    mkdirSync(join(producer, "lib", "bp-contracts"), { recursive: true });
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", version: "1.0.0" }));
    writeFileSync(join(consumer, "betterportal.json"), JSON.stringify({ defaultNamespace: "betterportal", dependencies: {} }));
    writeFileSync(join(producer, "betterportal.json"), JSON.stringify({ registryRef: "betterportal/config" }));
    const contractFile = join(producer, "lib", "bp-contracts", "org.betterportal.config.json");
    writeFileSync(contractFile, JSON.stringify(contract()));

    process.chdir(consumer);
    const installed = await installClient("config", { path: "../external/producer" });
    assert.equal(installed.pluginId, "org.betterportal.config");
    const clientFile = join(consumer, "src", ".bp-generated", "clients", "config.ts");
    assert.match(readFileSync(clientFile, "utf8"), /"message": string/);

    writeFileSync(contractFile, JSON.stringify(contract("updated")));
    await syncClients();
    assert.match(readFileSync(clientFile, "utf8"), /"updated": string/);
  } finally {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated clients accept runtime S2S headers", () => {
  const output = emitTypeScriptClient("reports", contract());
  assert.match(output, /runtimeHeaders/);
  assert.match(output, /headers\?: Record<string, string>/);
});

test("generated clients keep GET and POST contracts separate for one view", () => {
  const value = contract();
  value.manifest.views[0].operations.push({
    operationId: "config.create",
    method: "POST",
    title: "Create config",
    description: "Create config",
    querySchema: {},
    headersSchema: {},
    bodySchema: { root: { kind: "object", properties: { name: { kind: "string" } }, required: ["name"] } },
    jsonResponseSchema: { root: { kind: "object", properties: { id: { kind: "string" } }, required: ["id"] } },
    metadataResponseSchema: {},
    renderable: true,
    html: { renderers: {} },
    auth: { required: false, permissions: [], callers: ["user"] },
    robots: [],
    dependencies: [],
    apiContracts: [],
    demoScenarios: [],
    cacheHints: { ttlSeconds: 0, varyBy: [] }
  });
  value.routes[0].operations.push({ operationId: "config.create", method: "POST" });
  const output = emitTypeScriptClient("config", value);
  assert.match(output, /export const configRead/);
  assert.match(output, /export const configCreate/);
  assert.match(output, /body\?: \{ "name": string \}/);
  assert.match(output, /export type ConfigCreateResponse/);
});

test("generated clients preserve recursive JSON value contracts", () => {
  const value = contract();
  value.manifest.views[0].operations[0].jsonResponseSchema = {
    root: { kind: "record", valueSchema: { kind: "ref", ref: "#/definitions/BetterPortalJsonValue" } },
    definitions: {
      BetterPortalJsonValue: {
        kind: "union",
        variants: [
          { kind: "null" },
          { kind: "bool" },
          { kind: "string" },
          { kind: "number" },
          { kind: "array", items: { kind: "ref", ref: "#/definitions/BetterPortalJsonValue" } },
          { kind: "record", valueSchema: { kind: "ref", ref: "#/definitions/BetterPortalJsonValue" } }
        ]
      }
    }
  };

  const output = emitTypeScriptClient("config", value);
  assert.match(output, /export type JsonValue = string \| number/);
  assert.match(output, /export type ConfigReadResponse = Record<string, JsonValue>/);
});
