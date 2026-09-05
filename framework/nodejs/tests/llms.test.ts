import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { DeveloperResourceSchema, PluginManifestSchema, type DeveloperResource } from "../src/contracts/manifest.js";
import { registerBpWellKnownRoutes } from "../src/adapters/h3.js";
import { createBetterPortalApp, createBetterPortalNodeHandler } from "../src/runtime/h3.js";
import {
  buildThemeAiManifest,
  renderThemeLlmsApi,
  renderThemeLlmsDev,
  renderThemeLlmsIndex,
  renderThemeLlmsUi,
  type ThemeLlmsContext
} from "../src/runtime/llms.js";

const context: ThemeLlmsContext = {
  tenant: { id: "tenant-1", title: "Acme" },
  app: { id: "app-1", title: "Portal", url: "https://portal.example.com", routes: [] },
  services: [{
    id: "orders",
    pluginId: "com.example.orders",
    title: "Orders",
    url: "https://orders.example.com"
  }],
  configManagerUrl: "https://config.example.com",
  catalogUrl: "https://config.example.com/.well-known/bp/automation/catalog?tenantUrl=portal",
  apiGuideUrl: "https://config.example.com/.well-known/bp/automation/llms-api.txt?tenantUrl=portal",
  management: {
    appUrl: "https://manage.example.com",
    discoveryUrl: "https://config.example.com/.well-known/bp/management"
  }
};

const resource: DeveloperResource = {
  id: "ui.skill",
  kind: "skill",
  title: "UI skill",
  description: "Theme-specific UI workflow.",
  mediaType: "text/markdown; charset=utf-8",
  content: "# UI skill"
};

test("theme LLM documents provide concise task-specific discovery", () => {
  const index = renderThemeLlmsIndex(context);
  const api = renderThemeLlmsApi(context);
  const dev = renderThemeLlmsDev(context);
  const ui = renderThemeLlmsUi(context, [resource]);

  assert.match(index, /\/llms-api\.txt/);
  assert.match(index, /\/llms-dev\.txt/);
  assert.match(index, /\/llms-ui\.txt/);
  assert.match(api, /https:\/\/orders\.example\.com\/\.well-known\/bp\/schema\.json/);
  assert.match(api, /automation\/llms-api\.txt/);
  assert.match(dev, /ViewRenderContext/);
  assert.match(dev, /view IDs, not paths/);
  assert.match(dev, /declared dependency alias/);
  assert.match(ui, /\.well-known\/bp\/resources\/ui\.skill/);
  assert.match(ui, /dependency alias\/key/);
  assert.match(ui, /Omit `bp-ok`/);
});

test("theme LLM documents hide unavailable root management links", () => {
  const tenantContext: ThemeLlmsContext = {
    ...context,
    configManagerUrl: undefined,
    catalogUrl: undefined,
    apiGuideUrl: undefined,
    management: {}
  };

  assert.doesNotMatch(renderThemeLlmsIndex(tenantContext), /Optional|Automation catalog|Management discovery/);
  assert.doesNotMatch(renderThemeLlmsApi(tenantContext), /Complete catalog|unavailable/);
});

test("AI manifest links resources without duplicating their content", () => {
  const manifest = buildThemeAiManifest(context, [resource]) as Record<string, unknown>;
  const resources = manifest.resources as Array<Record<string, unknown>>;

  assert.equal(manifest.protocol, "betterportal-ai.v1");
  assert.equal(resources[0]?.url, "https://portal.example.com/.well-known/bp/resources/ui.skill");
  assert.equal("content" in (resources[0] ?? {}), false);
});

test("developer resource ids are safe URL segments", () => {
  assert.equal(DeveloperResourceSchema.parse(resource).id, "ui.skill");
  assert.throws(() => DeveloperResourceSchema.parse({ ...resource, id: "ui/skill" }));
  assert.throws(() => DeveloperResourceSchema.parse({ ...resource, mediaType: "text/plain\r\nx-unsafe: true" }));
});

test("well-known resource routes expose descriptors and inert content", async () => {
  const manifest = PluginManifestSchema.parse({
    protocolVersion: 2,
    pluginId: "com.example.theme",
    title: "Theme",
    description: "Test theme",
    version: "1.0.0",
    category: "theme",
    deploymentModes: ["self-hosted"],
    views: [],
    developerResources: [resource]
  });
  const app = createBetterPortalApp();
  registerBpWellKnownRoutes(app, manifest, { manifest, routes: [] });
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const healthResponse = await fetch(`${base}/.well-known/bp/health`);
    assert.deepEqual(await healthResponse.json(), { ok: true });
    assert.equal(healthResponse.headers.get("cache-control"), "no-store");
    const indexResponse = await fetch(`${base}/.well-known/bp/resources`);
    const index = await indexResponse.json() as { resources: Array<Record<string, unknown>> };
    const contentResponse = await fetch(`${base}/.well-known/bp/resources/ui.skill`);

    assert.equal(index.resources[0]?.url, "/.well-known/bp/resources/ui.skill");
    assert.equal("content" in (index.resources[0] ?? {}), false);
    assert.equal(await contentResponse.text(), "# UI skill");
    assert.equal(contentResponse.headers.get("content-security-policy"), "sandbox; default-src 'none'");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
