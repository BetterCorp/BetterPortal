import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BetterPortalConfigSchema, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { BaseStorage, ConfigRevisionConflictError } from "../src/plugins/service-betterportal-config-manager/storage/core.js";
import { FileStorage } from "../src/plugins/service-betterportal-config-manager/storage/file.js";
import { PostgresStorage } from "../src/plugins/service-betterportal-config-manager/storage/postgres.js";
import { registerSyncEndpoint } from "../src/plugins/service-betterportal-config-manager/syncApi.js";
import { createPreviewGroup, provisionPreviewDeployment, reconcilePreviewService } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { buildPreviewDiagnostics, PreviewDiagnosticsSchema, previewServiceStatus } from "../src/plugins/service-betterportal-config-manager/previewDiagnostics.js";
import { render as renderDebug } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/debug.GET.js";
import { auth } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/GET.js";
import { render as renderList } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/GET.js";
import { demoScenarios, ResponseSchema } from "../src/plugins/service-betterportal-config-manager/previewEnvironmentManagement.js";
import { chromium } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "@betterportal/theme-runtime";

function fixture() {
  const tenantId = uuidv7(), appId = uuidv7();
  const names = ["tools", "auth", "crm", "reports", "theme"];
  const services = names.map(name => ({ id: uuidv7(), hostname: `https://${name}.source.example`, apiKeyHash: "DO-NOT-EXPOSE", serviceId: `org.example.${name}`, title: name, createdAt: new Date().toISOString() }));
  const config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services }],
    apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["source.example"],
      themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: services.filter(s => s.title !== "theme").map(s => ({ id: uuidv7(), path: "/" + s.title, serviceId: s.id, viewId: s.title + ".index", operations: [s.title + ".read"], enabled: true }))
    }]
  });
  const { group } = createPreviewGroup(config, { name: "Preview", sourceTenantId: tenantId, sourceAppId: appId, expiresInDays: 7 });
  const { deployment } = provisionPreviewDeployment(config, group.id, { key: "race", hostname: "race.example", services: names.map(n => ({ serviceId: "org.example." + n, url: `https://${n}.race.example` })) }, "https://config.example");
  return { config, deployment, names };
}

test("file storage rejects stale snapshots without discarding the accepted manifest", async t => {
  const directory = mkdtempSync(join(tmpdir(), "bp-preview-sync-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new FileStorage(join(directory, "config.yaml"));
  const first = await store.loadConfig();
  const stale = await store.loadConfig();
  first.manifestCache.push({ serviceId: "org.example.tools", manifestVersion: "1", fetchedAt: new Date().toISOString(), viewIndex: {} } as any);
  await store.saveConfig(first);
  await assert.rejects(store.saveConfig(stale), ConfigRevisionConflictError);
  assert.equal((await store.loadConfig()).manifestCache[0].manifestVersion, "1");
  const fresh = await store.loadConfig();
  fresh.manifestCache[0].manifestVersion = "2";
  await store.saveConfig(fresh);
  assert.equal((await store.loadConfig()).manifestCache[0].manifestVersion, "2");
});

test("Postgres readiness uses its own clock for manifests and delivery despite Node clock skew", async () => {
  const { config, deployment } = fixture();
  let persisted = config;
  let delivered = false;
  const instanceId = deployment.services[0].instanceId;
  const databaseTime = new Date("2020-01-01T00:00:00.000Z");
  const query = async (sql: string, params?: any[]) => {
    if (sql.startsWith("select config")) return { rows: [{ config: persisted, revision: 1 }] };
    if (sql.startsWith("select clock_timestamp")) return { rows: [{ now: databaseTime }] };
    if (sql.startsWith("select service_id")) return { rows: delivered ? [{ service_id: instanceId, last_sync_at: databaseTime, last_seen_at: null }] : [] };
    if (sql.startsWith("insert into") && sql.includes("_activity")) delivered = true;
    if (sql.includes("set config =")) persisted = JSON.parse(params![1]);
    return { rows: [], rowCount: 1 };
  };
  const store = new PostgresStorage({ connectionString: "postgres://unused" });
  Object.assign(store, { schemaReady: Promise.resolve(), pool: { query, connect: async () => ({ query, release() {} }) } });
  const snapshot = await store.loadConfig();
  snapshot.manifestCache.push({ serviceId: instanceId, manifestVersion: "1", fetchedAt: "2030-01-01T00:00:00.000Z", viewIndex: {} } as any);
  await store.saveConfig(snapshot);
  assert.equal(snapshot.manifestCache[0].fetchedAt, databaseTime.toISOString());
  await store.touchServiceActivity(instanceId, "lastSyncAt");
  store.invalidate();
  assert.equal(previewServiceStatus(await store.loadConfig(), deployment, instanceId).state, "configured");
});

test("concurrent preview manifests retry fresh snapshots and commit reconciliation atomically", async () => {
  const { config, deployment, names } = fixture();
  class RevisionStore extends BaseStorage {
    value = config;
    revision = 0;
    conflicts = 0;
    snapshots = new WeakMap<BetterPortalConfig, number>();
    async loadConfig() {
      const copy = structuredClone(this.value);
      this.snapshots.set(copy, this.revision);
      return copy;
    }
    async saveConfig(copy: BetterPortalConfig) {
      await setImmediate();
      const revision = this.snapshots.get(copy)!;
      if (revision !== this.revision) { this.conflicts++; throw new ConfigRevisionConflictError(revision, this.revision); }
      // Every accepted manifest's page is mounted in this same committed snapshot.
      const app = copy.apps.find(a => a.id === deployment.appId)!;
      for (const manifest of copy.manifestCache) for (const view of Object.values(manifest.viewIndex)) {
        assert.ok(app.routes.some(r => r.enabled && r.serviceId === manifest.serviceId && r.viewId === view.viewId));
      }
      this.value = structuredClone(copy);
      this.revision++;
      this.notifyListeners();
    }
    async validateApiKey(key: string) {
      return { scope: "tenant" as const, tenantId: deployment.tenantId, serviceId: deployment.services[Number(key)].instanceId };
    }
    async touchServiceActivity(id: string, field: "lastSeenAt" | "lastSyncAt") {
      this.value.tenants.find(t => t.id === deployment.tenantId)!.services.find(s => s.id === id)![field] = new Date().toISOString();
    }
  }
  const store = new RevisionStore();
  const handlers = new Map<string, (event: any) => Promise<Response>>();
  registerSyncEndpoint({ get: (path: string, handler: any) => handlers.set("GET " + path, handler), post: (path: string, handler: any) => handlers.set("POST " + path, handler) } as never, store, {
    onManifestUpdated: (snapshot, ids, manifest) => { for (const id of ids) reconcilePreviewService(snapshot, id, manifest); }
  });
  const responses = await Promise.all(names.map((name, i) => handlers.get("POST /.well-known/bp/sync/poll")!({ req: new Request("https://config.example/.well-known/bp/sync/poll", {
    method: "POST", headers: { authorization: "Bearer " + i, "content-type": "application/json" },
    body: JSON.stringify({ manifestVersion: "1", viewIndex: name === "theme" ? {} : {
      [name + ".index"]: { viewId: name + ".index", title: name, path: "/" + name, pathVariants: [], operations: [{ operationId: name + ".read", method: "GET", title: name, renderable: true, renderers: ["bootstrap5"], renderModes: ["page"], authRequired: false }] }
    } })
  }) })));
  assert.ok(store.conflicts > 0);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(store.revision, 5, "one atomic commit per manifest, no extra reconciliation write");
  assert.equal(store.value.apps.find(a => a.id === deployment.appId)!.routes.filter(r => r.enabled).length, 4);
  assert.equal(store.value.manifestCache.length, 5);
});

test("PVE readiness requires a persisted manifest, matching mounts and subsequent delivery; debug excludes secrets", () => {
  const { config, deployment } = fixture();
  const instanceId = deployment.services[0].instanceId;
  const registration = config.tenants.find(t => t.id === deployment.tenantId)!.services.find(s => s.id === instanceId)!;
  registration.lastSyncAt = "2026-09-05T00:00:00.000Z";
  assert.equal(previewServiceStatus(config, deployment, instanceId).state, "waiting-manifest");
  const manifest = { serviceId: instanceId, manifestVersion: "test", fetchedAt: "2026-09-05T00:01:00.000Z", viewIndex: {
    "tools.index": { viewId: "tools.index", title: "Tools", path: "/tools", pathVariants: [], operations: [{ operationId: "tools.read", method: "GET", renderable: true, renderModes: ["page"] }] }
  } } as any;
  config.manifestCache.push(manifest);
  assert.equal(previewServiceStatus(config, deployment, instanceId).state, "needs-reconciliation");
  const app = config.apps.find(a => a.id === deployment.appId)!;
  app.routes.find(r => r.serviceId === instanceId)!.enabled = true;
  assert.equal(previewServiceStatus(config, deployment, instanceId).state, "waiting-config");
  registration.lastSyncAt = "2026-09-05T00:02:00.000Z";
  assert.equal(previewServiceStatus(config, deployment, instanceId).state, "configured");
  const diagnostics = PreviewDiagnosticsSchema.parse(buildPreviewDiagnostics(config, deployment.id));
  assert.equal(diagnostics.services.length, 5);
  assert.match(diagnostics.routes[0].menu, /No enabled menu item/);
  const text = String(renderDebug({ diagnostics } as never));
  assert.match(text, /needs|waiting|configured/);
  assert.doesNotMatch(JSON.stringify(diagnostics) + text, /DO-NOT-EXPOSE|apiKeyHash|credentialReplay|encryptedTenantConfig/);
  assert.equal(auth.required, true);
  assert.deepEqual(auth.permissions[0].permissions, ["read"]);
  assert.equal(buildPreviewDiagnostics(config, "missing"), undefined);
});

test("Debug loads on demand into its drawer without navigating or replacing the PVE list", async t => {
  const { config, deployment } = fixture();
  const group = config.previewEnvironmentGroups[0];
  const data = ResponseSchema.parse({ ...demoScenarios[0].response, previewPath: "https://config.test/preview-environments", groups: [{
    ...group, sourceLabel: "Source", services: [], deployments: [{ ...deployment, ready: false,
      services: deployment.services.map(service => ({ ...service, ready: false, status: previewServiceStatus(config, deployment, service.instanceId) }))
    }]
  }] });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const require = createRequire(import.meta.url);
  const runtime = await buildBetterPortalShellRuntimeAsset({});
  let requests = 0;
  await page.route(/https:\/\/(config|app)\.test\//, route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("_c") === "debug") {
      requests++;
      assert.equal(url.searchParams.get("deploymentId"), deployment.id);
      return route.fulfill({ contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: String(renderDebug({ diagnostics: buildPreviewDiagnostics(config, deployment.id) } as never)) });
    }
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'><style>${readFileSync(require.resolve("bootstrap/dist/css/bootstrap.min.css"), "utf8")}</style></head><body><div data-bp-shell-root data-bp-menu-health="false" data-bp-services='{"config":"https://config.test"}'><main id="bp-main" data-bp-service="config">${renderList(data)}</main></div><script>${readFileSync(require.resolve("bootstrap/dist/js/bootstrap.bundle.min.js"), "utf8")}</script><script>${runtime.body}</script></body></html>` });
  });
  await page.goto("https://app.test/preview-environments");
  assert.equal(requests, 0);
  await page.getByRole("button", { name: "Debug", exact: true }).click();
  await page.waitForSelector("#bp-preview-debug.show #bp-preview-debug-body section");
  assert.equal(requests, 1);
  assert.equal(await page.getByRole("button", { name: "Debug", exact: true }).count(), 1);
  assert.equal(page.url(), "https://app.test/preview-environments");
  await page.locator('#bp-preview-debug button[aria-label="Close"]').click();
  await page.waitForSelector("#bp-preview-debug.show", { state: "hidden" });
  assert.deepEqual(errors, []);
});
