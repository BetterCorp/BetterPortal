import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BetterPortalConfigSchema, ServiceManifestCacheEntrySchema, createBetterPortalApp, encryptPreviewConfigValue,
  generatePreviewConfigKey, uuidv7, type ConfigSchemaDescriptor
} from "@betterportal/framework";
import { FileStorage } from "../src/plugins/service-betterportal-config-manager/storage/file.js";
import { provisionPreviewDeployment, reconcilePreviewService } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { handleGet, handlePost, resolvePreviewConfigSchemas } from "../src/plugins/service-betterportal-config-manager/previewEnvironmentManagement.js";
import { setConfigManagerRouteContext } from "../src/plugins/service-betterportal-config-manager/routeContext.js";
import { configEditor, configEditorScript, render } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/GET.js";
import { chromium } from "@playwright/test";

const descriptors: ConfigSchemaDescriptor[] = [{
  id: "settings.tenant", title: "Tenant settings", description: "Tenant settings", scope: "tenant",
  jsonSchema: { endpoint: "string", token: "string" },
  fields: [
    { key: "endpoint", title: "Endpoint", description: "Endpoint", scope: "tenant", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", required: true, defaultValue: "https://default.example" },
    { key: "token", title: "Token", description: "Token", scope: "tenant", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", required: true }
  ]
}, {
  id: "settings.app", title: "App settings", description: "App settings", scope: "app",
  jsonSchema: { label: "string" },
  fields: [{ key: "label", title: "Label", description: "Label", scope: "app", visibility: "public", ownership: "bp", sourceOfTruth: "bp", required: false, defaultValue: "Preview" }]
}];

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "bp-preview-definitions-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const storage = new FileStorage(join(directory, "config.yaml"));
  const tenantId = uuidv7(), appId = uuidv7(), instanceId = uuidv7();
  const config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services: [
      { id: instanceId, serviceId: "org.example.known", hostname: "https://known.example", title: "Known", apiKeyHash: "source-hash", createdAt: new Date().toISOString() }
    ] }],
    apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["source.example"], themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} } }],
    manifestCache: [{ serviceId: instanceId, manifestVersion: "1", fetchedAt: new Date().toISOString(), viewIndex: {}, configSchemas: descriptors }]
  });
  await storage.saveConfig(config);
  setConfigManagerRouteContext({ storage, serviceBaseUrl: "https://config.example" } as Parameters<typeof setConfigManagerRouteContext>[0]);
  const app = createBetterPortalApp();
  app.post("/preview", async event => handlePost({ rawEvent: event, request: await event.req.json() } as Parameters<typeof handlePost>[0]));
  app.get("/preview", event => handleGet({ rawEvent: event, query: Object.fromEntries(event.url.searchParams) } as Parameters<typeof handleGet>[0]));
  const post = async (request: Record<string, unknown>) => (await app.fetch(new Request("https://config.example/preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request)
  }))).json();
  const create = async () => post({ action: "create-group", name: "Feature previews", sourceTenantId: tenantId, sourceAppId: appId, expiresInDays: "7", pluginIds: "org.example.known, org.example.new\norg.example.new" });
  const editor = async (groupId: string) => (await app.fetch(new Request("https://config.example/preview?_c=config&groupId=" + groupId))).json();
  return { storage, post, create, editor, instanceId };
}

test("BP plugin IDs and uploaded tenant/app schemas configure a PVE before deployment", async t => {
  const { storage, post, create, editor, instanceId } = await fixture(t);
  const created = await create();
  assert.equal(created.notice, "Preview group created.");
  const groupId = created.groups[0].id;
  let config = await storage.loadConfig();
  assert.deepEqual(config.previewEnvironmentGroups[0].services.map(s => s.serviceId), ["org.example.known", "org.example.new"]);
  assert.equal(config.tenants.length, 1);
  assert.equal(config.tenants[0].services.length, 1);
  assert.equal(config.previewEnvironmentDeployments.length, 0);
  const production = structuredClone(config.manifestCache);
  const initial = await editor(groupId);
  assert.equal(initial.groups[0].services[0].schemaSource, "synced");
  assert.equal(initial.groups[0].services[1].schemaSource, "unavailable");
  const upload = await post({ action: "save-service", groupId, serviceId: "org.example.new", schemas: JSON.stringify({ pluginId: "org.example.new", configSchemas: descriptors }) });
  assert.equal(upload.notice, "BP plugin definition saved.");
  const data = await editor(groupId);
  assert.equal(data.groups[0].services[1].schemaSource, "uploaded");
  assert.deepEqual(data.groups[0].services[1].fields.map((field: { scope: string }) => field.scope), ["tenant", "tenant", "app"]);
  const html = String(configEditor(data.groups[0], "/preview", "/ticket"));
  assert.match(html, /data-service-id="org.example.new"[^>]*data-scope="tenant"/);
  assert.match(html, /data-service-id="org.example.new"[^>]*data-scope="app"/);
  assert.match(html, /value="https:\/\/default.example"/);

  const key = generatePreviewConfigKey();
  const token = encryptPreviewConfigValue(key, "tenant", ["token"], "preview-secret");
  const values = { tenant: { endpoint: "https://preview-endpoint.example", token }, app: { label: "Feature" } };
  const save = await post({ action: "save-config", groupId, configs: JSON.stringify({ "org.example.known": values, "org.example.new": values }) });
  assert.equal(save.notice, "Encrypted preview config saved.");
  config = await storage.loadConfig();
  assert.deepEqual(config.manifestCache, production);
  assert.equal(config.manifestCache[0].serviceId, instanceId);
  const group = config.previewEnvironmentGroups[0];
  assert.deepEqual(group.services[1].config, values);
  const { deployment, credentials } = provisionPreviewDeployment(config, groupId, {
    key: "feature", hostname: "feature.example", services: [{ serviceId: "org.example.new", url: "https://new-preview.example" }]
  }, "https://config.example");
  assert.equal(credentials.length, 1);
  assert.deepEqual(deployment.effectiveConfig!.services.find(s => s.serviceId === "org.example.new")!.config, values);
  await storage.saveConfig(config);
  const scoped = await storage.getScopedConfig(credentials[0].instanceId, "tenant", deployment.tenantId);
  assert.deepEqual(scoped.previewConfig?.tenant, values.tenant);
  assert.deepEqual(scoped.previewConfig?.app, values.app);

  config = await storage.loadConfig();
  const snapshot = structuredClone(config.previewEnvironmentDeployments[0].effectiveConfig);
  const live = { ...config.manifestCache[0], serviceId: credentials[0].instanceId, configSchemas: structuredClone(descriptors) };
  live.configSchemas[0].fields[0].defaultValue = "https://changed.example";
  config.manifestCache.push(live);
  reconcilePreviewService(config, credentials[0].instanceId, live);
  await storage.saveConfig(config);
  const synced = await editor(groupId);
  assert.match(synced.groups[0].services[1].schemaWarning, /differ/);
  assert.equal(synced.groups[0].services[1].schemaSource, "uploaded");
  assert.equal(resolvePreviewConfigSchemas(config, config.previewEnvironmentGroups[0], "org.example.new")![0].fields[0].defaultValue, "https://default.example");
  assert.deepEqual((await storage.loadConfig()).previewEnvironmentDeployments[0].effectiveConfig, snapshot);
  assert.equal(JSON.stringify(await editor(groupId)).includes("preview-secret"), false);
});

test("invalid uploads and incompatible replacements leave BP configuration intact", async t => {
  const { storage, post, create } = await fixture(t);
  const groupId = (await create()).groups[0].id;
  const upload = (schemas: unknown, serviceId = "org.example.new") => post({ action: "save-service", groupId, serviceId, schemas: typeof schemas === "string" ? schemas : JSON.stringify(schemas) });
  for (const invalid of ["{", {}, [], { configSchemas: [{}] }, { pluginId: "org.example.other", configSchemas: descriptors }]) {
    const before = await storage.loadConfig();
    assert.ok((await upload(invalid)).error);
    assert.deepEqual(await storage.loadConfig(), before);
  }
  assert.match((await upload(descriptors, "bad id")).error, /BP plugin ID/);
  const duplicates = structuredClone(descriptors);
  duplicates[0].fields.push(duplicates[0].fields[0]);
  assert.match((await upload(duplicates)).error, /unique keys/);
  assert.equal((await upload(descriptors)).error, undefined);
  const config = await storage.loadConfig();
  const service = config.previewEnvironmentGroups[0].services[1];
  service.config.tenant = { endpoint: "https://example.test", token: encryptPreviewConfigValue(generatePreviewConfigKey(), "tenant", ["token"], "secret") };
  await storage.saveConfig(config);
  const before = await storage.loadConfig();
  const replacement = structuredClone(descriptors);
  replacement[0].fields[1].visibility = "public";
  assert.match((await upload(replacement)).error, /configured field/);
  replacement[0].fields.pop();
  assert.match((await upload(replacement)).error, /configured field/);
  assert.deepEqual(await storage.loadConfig(), before);
});

test("CI adds declared BP plugins without changing existing preview credentials or settings", async t => {
  const { storage, create } = await fixture(t);
  const groupId = (await create()).groups[0].id;
  const config = await storage.loadConfig();
  const services = [{ serviceId: "org.example.known", url: "https://known-preview.example" }];
  const first = provisionPreviewDeployment(config, groupId, { key: "ci", hostname: "ci.example", services }, "https://config.example");
  const before = structuredClone(first.deployment.effectiveConfig);
  const appBefore = structuredClone(config.apps.find(a => a.id === first.deployment.appId));
  const existing = structuredClone(config.tenants.find(tenant => tenant.id === first.deployment.tenantId)!.services[0]);
  const definition = config.previewEnvironmentGroups[0].services[1];
  definition.configSchemas = descriptors;
  definition.config.app = { label: "New defaults" };
  const expanded = [...services, { serviceId: "org.example.new", url: "https://new-preview.example" }];
  const added = provisionPreviewDeployment(config, groupId, { key: "ci", hostname: "ci.example", services: expanded }, "https://config.example");
  assert.equal(added.created, false);
  assert.deepEqual(added.credentials.map(c => c.serviceId), ["org.example.new"]);
  assert.deepEqual(config.tenants.find(tenant => tenant.id === first.deployment.tenantId)!.services[0], existing);
  assert.deepEqual(config.apps.find(a => a.id === first.deployment.appId), appBefore);
  assert.deepEqual(added.deployment.effectiveConfig!.services[0], before!.services[0]);
  assert.deepEqual(added.deployment.effectiveConfig!.services[1].config.app, { label: "New defaults" });
  assert.equal(provisionPreviewDeployment(config, groupId, { key: "ci", hostname: "ci.example", services: expanded }, "https://config.example").credentials.length, 0);
  assert.throws(() => provisionPreviewDeployment(config, groupId, { key: "ci", hostname: "ci.example", services }, "https://config.example"), /must be retained/);
});

for (const delayedProviders of [true, false]) {
  test(`CI restores delayed source-app bindings with ${delayedProviders ? "late" : "existing"} shell and auth services`, async t => {
    const { storage, create, instanceId } = await fixture(t);
    const groupId = (await create()).groups[0].id;
    let config = await storage.loadConfig();
    const [shellId, authId, contentId] = [uuidv7(), uuidv7(), uuidv7()];
    config.tenants[0].services.push(...[shellId, authId, contentId].map((id, index) => ({
      ...config.tenants[0].services[0], id, serviceId: "org.example." + ["shell", "auth", "content"][index]
    })));
    const source = config.apps[0];
    source.shell = { serviceId: shellId };
    source.routes = [instanceId, contentId].map((serviceId, index) => ({
      id: uuidv7(), serviceId, viewId: index ? "content" : "known", operations: [index ? "content.read" : "known.read"],
      path: index ? "/custom-content" : "/known", enabled: true
    }));
    source.slots = ["available", "occupied"].map(slotId => ({ slotId, serviceId: contentId, viewId: "content", enabled: true }));
    source.fragments = { header: [{ serviceId: contentId, fragmentId: "banner", targetPath: "/banner", enabled: true }] };
    const item = { source: "service" as const, serviceId: contentId, fragmentId: "banner", targetPath: "/banner" };
    source.shellFragments = { [shellId]: {
      header: { mode: "override", item },
      blocked: { mode: "override", item },
      footer: { mode: "items", items: [{ source: "shell", fragmentId: "footer" }, { ...item, serviceId: instanceId }, item] }
    } };
    source.auth = {
      serviceId: authId, expectedIssuer: "source", expectedAudience: "source", jwksUri: "https://auth.source.example/jwks",
      publicKeys: { keys: [{ kty: "RSA", use: "sig", alg: "RS256", kid: "source", n: "modulus", e: "AQAB" }] },
      redirects: { afterLogin: { serviceId: contentId, viewId: "content" }, afterLogout: { serviceId: instanceId, viewId: "known" } },
      roles: [{ id: "reader", title: "Reader", permissions: [instanceId, contentId].map((serviceId, index) => ({ serviceId, viewId: index ? "content" : "known", permissions: ["read"] })) }]
    };
    config = BetterPortalConfigSchema.parse(config);
    const originalSource = structuredClone(config.apps[0]);
    const requested = ["known", ...(!delayedProviders ? ["shell", "auth"] : [])].map(name => ({ serviceId: "org.example." + name, url: `https://${name}.preview.example` }));
    const deploy = () => provisionPreviewDeployment(config, groupId, { key: "bindings", hostname: "bindings.example", services: requested }, "https://config.example");
    const first = deploy();
    const app = config.apps.find(candidate => candidate.id === first.deployment.appId)!;
    const idFor = (name: string) => first.deployment.services.find(service => service.serviceId === "org.example." + name)!.instanceId;
    if (delayedProviders) {
      assert.equal(app.shell, undefined);
      assert.equal(app.auth, undefined);
      requested.push(...["shell", "auth"].map(name => ({ serviceId: "org.example." + name, url: `https://${name}.preview.example` })));
      assert.deepEqual(deploy().credentials.map(credential => credential.serviceId), ["org.example.shell", "org.example.auth"]);
    }
    assert.deepEqual(app.shell, { serviceId: idFor("shell") });
    assert.equal(app.auth!.serviceId, idFor("auth"));
    assert.equal(app.auth!.publicKeys, undefined);
    assert.deepEqual(app.auth!.redirects, { afterLogout: { serviceId: idFor("known"), viewId: "known" } });
    assert.equal(app.auth!.roles[0].permissions.length, 1);
    assert.deepEqual(app.shellFragments[idFor("shell")].footer, {
      mode: "items", items: [{ source: "shell", fragmentId: "footer" }, { ...item, serviceId: idFor("known") }]
    });
    app.title = "Edited preview";
    app.routes[0].path = "/edited-known";
    app.slots.push({ slotId: "occupied", serviceId: idFor("known"), viewId: "known", enabled: true });
    app.fragments.header = [{ serviceId: idFor("known"), fragmentId: "custom", targetPath: "/custom", enabled: true }];
    app.shellFragments[idFor("shell")].blocked = { mode: "none" };
    app.auth!.roles[0].title = "Edited role";
    app.auth!.redirects!.afterLogout!.viewId = "edited-logout";
    const existingServices = structuredClone(config.tenants.find(tenant => tenant.id === first.deployment.tenantId)!.services);
    requested.push({ serviceId: "org.example.content", url: "https://content.preview.example" });
    assert.deepEqual(deploy().credentials.map(credential => credential.serviceId), ["org.example.content"]);
    assert.deepEqual(config.tenants.find(tenant => tenant.id === first.deployment.tenantId)!.services.slice(0, existingServices.length), existingServices);
    assert.equal(app.title, "Edited preview");
    assert.equal(app.routes[0].path, "/edited-known");
    const route = app.routes.find(candidate => candidate.serviceId === idFor("content"))!;
    assert.equal(route.path, "/custom-content");
    assert.equal(route.enabled, false);
    assert.deepEqual(app.slots.map(slot => [slot.slotId, slot.serviceId]), [["occupied", idFor("known")], ["available", idFor("content")]]);
    assert.deepEqual(app.fragments.header.map(fragment => fragment.serviceId), [idFor("known"), idFor("content")]);
    assert.deepEqual(app.shellFragments[idFor("shell")].header, { mode: "override", item: { ...item, serviceId: idFor("content") } });
    assert.deepEqual(app.shellFragments[idFor("shell")].blocked, { mode: "none" });
    assert.deepEqual(app.shellFragments[idFor("shell")].footer, {
      mode: "items", items: [{ source: "shell", fragmentId: "footer" }, { ...item, serviceId: idFor("known") }, { ...item, serviceId: idFor("content") }]
    });
    assert.equal(app.auth!.roles[0].title, "Edited role");
    assert.deepEqual(app.auth!.roles[0].permissions.map(permission => permission.serviceId), [idFor("known"), idFor("content")]);
    assert.deepEqual(app.auth!.redirects, { afterLogin: { serviceId: idFor("content"), viewId: "content" }, afterLogout: { serviceId: idFor("known"), viewId: "edited-logout" } });
    const beforeRetry = structuredClone(app);
    assert.equal(deploy().credentials.length, 0);
    assert.deepEqual(app, beforeRetry);
    reconcilePreviewService(config, idFor("content"), ServiceManifestCacheEntrySchema.parse({
      serviceId: "org.example.content", manifestVersion: "1", fetchedAt: new Date().toISOString(),
      viewIndex: { content: { viewId: "content", title: "Content", description: "Content", path: "/content", operations: [{
        operationId: "content.read", method: "GET", title: "Content", description: "Content", renderable: true, renderModes: ["page"], authRequired: false
      }] } }
    }));
    assert.equal(app.routes.find(candidate => candidate.id === route.id)!.path, "/custom-content");
    assert.equal(app.routes.find(candidate => candidate.id === route.id)!.enabled, true);
    assert.deepEqual(config.apps[0], originalSource);
    await storage.saveConfig(config);
    const saved = (await storage.loadConfig()).apps.find(candidate => candidate.id === app.id)!;
    for (const key of ["shell", "slots", "fragments", "shellFragments"] as const) assert.deepEqual(saved[key], app[key]);
    assert.deepEqual(saved.auth!.redirects, app.auth!.redirects);
    assert.deepEqual(saved.auth!.roles, app.auth!.roles);
    assert.equal(saved.auth!.publicKeys, undefined);
    assert.equal(saved.routes.find(candidate => candidate.id === route.id)!.path, "/custom-content");
  });
}

test("BP schema file upload populates JSON before submission on desktop and mobile", async t => {
  const { create, post, editor } = await fixture(t);
  const groupId = (await create()).groups[0].id;
  await post({ action: "save-service", groupId, serviceId: "org.example.new", schemas: JSON.stringify(descriptors) });
  const data = await editor(groupId);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const css = readFileSync(new URL("../../../../../node_modules/bootstrap/dist/css/bootstrap.min.css", import.meta.url), "utf8");
    await page.setContent("<html><head><style>" + css + "</style></head><body class='p-3'>" + String(configEditor(data.groups[0], "/preview", "/ticket")) + "<script>" + String(configEditorScript()) + "</script></body></html>");
    await page.locator("details").evaluateAll(elements => elements.forEach(element => element.setAttribute("open", "")));
    const form = page.locator('[data-bp-schema-form]').last();
    await form.locator('input[type=file]').setInputFiles({ name: "bp-schemas.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(descriptors)) });
    await page.waitForFunction(() => document.querySelectorAll<HTMLTextAreaElement>('[name=schemas]')[1].value.length > 0);
    assert.deepEqual(JSON.parse(await form.locator('[name=schemas]').inputValue()), descriptors);
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    if (process.env.BP_PVE_SCREENSHOT_DIR) {
      mkdirSync(process.env.BP_PVE_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.BP_PVE_SCREENSHOT_DIR, "pve-" + viewport.width + ".png"), fullPage: true });
    }
    await form.locator('input[type=file]').setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{") });
    await page.waitForFunction(() => !document.querySelectorAll<HTMLInputElement>('input[type=file]')[1].validity.valid);
    assert.equal(await form.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.validity.valid), false);
    await form.locator('[name=schemas]').fill(JSON.stringify(descriptors));
    assert.equal(await form.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.validity.valid), true);
    await page.close();
  }
  assert.match(String(render(data)), /name="pluginIds"/);
});
