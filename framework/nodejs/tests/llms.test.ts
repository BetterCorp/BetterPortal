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
  renderThemeLlmsDrop,
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
  assert.match(index, /Full LLM drop.*\/llms-drop\.txt/);
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

test("discovery normalizes long trailing slash sequences without regex backtracking", () => {
  const suffix = "/".repeat(100_000);
  const input: ThemeLlmsContext = {
    ...context,
    app: { ...context.app, url: context.app.url + suffix },
    services: context.services.map(service => ({ ...service, url: service.url + suffix }))
  };
  const api = renderThemeLlmsApi(input);
  assert.match(api, /https:\/\/orders\.example\.com\/\.well-known\/bp\/schema\.json/);
  assert.ok(api.length < 5000);
  const manifest = buildThemeAiManifest(input, []) as Record<string, unknown>;
  assert.equal((manifest.documents as Record<string, string>).drop, "https://portal.example.com/llms-drop.txt");
});

test("AI manifest links resources without duplicating their content", () => {
  const manifest = buildThemeAiManifest(context, [resource]) as Record<string, unknown>;
  const resources = manifest.resources as Array<Record<string, unknown>>;

  assert.equal(manifest.protocol, "betterportal-ai.v1");
  assert.equal((manifest.documents as Record<string, string>).drop, "https://portal.example.com/llms-drop.txt");
  assert.equal(resources[0]?.url, "https://portal.example.com/.well-known/bp/resources/ui.skill");
  assert.equal("content" in (resources[0] ?? {}), false);
});

test("full LLM drop preserves every local guide and resource with provenance and expiry", () => {
  const example: DeveloperResource = {
    ...resource,
    id: "ui.example",
    kind: "example",
    title: "Nested code example",
    content: "# Example\n\n````tsx\n<script>example()</script>\n````\n" + "complete content\n".repeat(1000)
  };
  const manifest = PluginManifestSchema.parse({
    protocolVersion: 2,
    pluginId: "com.example.theme",
    title: "Example theme",
    description: "Theme export fixture",
    version: "2.3.4",
    category: "theme",
    deploymentModes: ["self-hosted"],
    views: [],
    developerResources: [resource, example],
    cacheHints: { metadataTtlSeconds: 1800 }
  });
  const schema = { manifest, routes: [] };
  const drop = renderThemeLlmsDrop(context, schema, new Date("2026-09-10T12:00:00.000Z"));

  assert.match(drop, /Exported at: 2026-09-10T12:00:00\.000Z/);
  assert.match(drop, /Expires at: 2026-09-10T12:30:00\.000Z/);
  assert.match(drop, /Framework version: @betterportal\/framework@\d+\.\d+\.\d+/);
  assert.match(drop, /Theme version: com\.example\.theme@2\.3\.4/);
  assert.match(drop, /Protocol version: bp-protocol\/2/);
  for (const [path, content] of [
    ["/llms.txt", renderThemeLlmsIndex(context)],
    ["/llms-api.txt", renderThemeLlmsApi(context)],
    ["/llms-dev.txt", renderThemeLlmsDev(context)],
    ["/llms-ui.txt", renderThemeLlmsUi(context, [resource, example])],
    ["/.well-known/bp/manifest", JSON.stringify(manifest, null, 2)],
    ["/.well-known/bp/schema.json", JSON.stringify(schema, null, 2)],
    ...[resource, example].map(item => [`/.well-known/bp/resources/${item.id}`, item.content])
  ]) {
    assert.ok(drop.includes(`Source URL: https://portal.example.com${path}\n`), path);
    assert.ok(drop.includes(content), `Complete content of ${path}`);
  }
  assert.ok(drop.includes("`````\n" + example.content + "\n`````"));
  assert.match(drop, /Source URL: https:\/\/portal\.example\.com\/\.well-known\/bp\/ai\.json/);
  assert.match(drop, /Source URL: https:\/\/portal\.example\.com\/\.well-known\/bp\/resources\n/);
  assert.match(drop, /https:\/\/orders\.example\.com\/\.well-known\/bp\/schema\.json/);
  assert.match(drop, /remote contents are not fetched or embedded/);
  assert.match(drop, /Schemas can change with versions/);
});

test("drop freshness honors zero TTL and caps long-lived metadata at one day", () => {
  const manifest = PluginManifestSchema.parse({
    protocolVersion: 2,
    pluginId: "com.example.theme",
    title: "Theme",
    description: "Freshness fixture",
    version: "1.0.0",
    category: "theme",
    deploymentModes: ["self-hosted"],
    views: []
  });
  const now = new Date("2026-12-31T23:30:00.000Z");
  for (const [ttl, expiry] of [[0, "2026-12-31T23:30:00.000Z"], [604800, "2027-01-01T23:30:00.000Z"]] as const) {
    const schema = { manifest: { ...manifest, cacheHints: { metadataTtlSeconds: ttl } }, routes: [] };
    const drop = renderThemeLlmsDrop({ ...context, services: [], management: {}, catalogUrl: undefined, apiGuideUrl: undefined }, schema, now);
    assert.ok(drop.includes(`Expires at: ${expiry}`));
    assert.match(drop, /Theme route schemas/);
    assert.doesNotMatch(drop, /undefined|https:\/\/orders\.example\.com/);
  }
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
  registerBpWellKnownRoutes(app, manifest, { manifest, routes: [] }, { llmsContext: () => context });
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/llms-drop.txt`)).status, 404); // ordinary services are not shells
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


test("shell drop route uses the shared public schema and rejects missing app context", async () => {
  const manifest = PluginManifestSchema.parse({
    protocolVersion: 2, pluginId: "com.example.shell", title: "Shell", description: "HTTP fixture",
    version: "3.2.1", category: "theme", deploymentModes: ["self-hosted"], views: [],
    shell: { service: "custom", renderer: "bootstrap5", fragments: [] }, developerResources: [resource]
  });
  const app = createBetterPortalApp();
  let activeContext: ThemeLlmsContext | null = context;
  const schema = { manifest, routes: [] };
  registerBpWellKnownRoutes(app, manifest, schema, { llmsContext: () => activeContext });
  app.get("/**", () => new Response("page catchall"));
  const server = createServer(createBetterPortalNodeHandler(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/llms-drop.txt`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const drop = await response.text();
    const publishedSchema = await (await fetch(`${base}/.well-known/bp/schema.json`)).json();
    assert.ok(drop.includes(JSON.stringify(publishedSchema, null, 2)));
    assert.ok(drop.includes(resource.content));
    assert.match(drop, /Theme version: com.example.shell@3.2.1/);
    activeContext = null;
    const missing = await fetch(`${base}/llms-drop.txt`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await missing.text(), /tenant-1|App URL|full LLM drop/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
