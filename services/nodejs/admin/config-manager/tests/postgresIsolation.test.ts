import { deleteApp, deleteTenant } from "../src/plugins/service-betterportal-config-manager/tenantManagement.js";
import { setConfigManagerRouteContext } from "../src/plugins/service-betterportal-config-manager/routeContext.js";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Pool } from "pg";
import { BetterPortalConfigSchema, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { PostgresStorage, ConfigRevisionConflictError } from "../src/plugins/service-betterportal-config-manager/storage/postgres.js";
import { entityKey, splitConfig } from "../src/plugins/service-betterportal-config-manager/storage/entities.js";
import { createPreviewGroup, provisionPreviewDeployment } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { collectServiceDeleteBlockers, purgeServiceReferences, registerAdminApiRoutes } from "../src/plugins/service-betterportal-config-manager/adminApi.js";

const connectionString = process.env.BP_CONFIG_TEST_POSTGRES;
const pgTest = (name: string, fn: (t: TestContext) => Promise<void>) => test(name, { skip: !connectionString, timeout: 20000 }, fn);
function fixture(): BetterPortalConfig {
  const tenants = [0, 1].map(index => ({ id: uuidv7(), slug: `tenant-${index}`, title: `Tenant ${index}`,
    services: [0, 1].map(service => ({ id: uuidv7(), serviceId: `org.example.service${service}`, hostname: `https://service${service}.tenant${index}.example`,
      apiKeyHash: `test-hash-${index}-${service}`, createdAt: new Date().toISOString() })) }));
  return BetterPortalConfigSchema.parse({ tenants, apps: tenants.flatMap(tenant => tenant.services.map((service, index) => ({
    id: uuidv7(), tenantId: tenant.id, slug: `app-${index}`, title: `App ${index}`, hostnames: [`app${index}.${tenant.slug}.example`],
    auth: { serviceId: service.id, expectedIssuer: "issuer", expectedAudience: "audience", jwksUri: "https://auth.example/jwks", roles: [] },
    routes: [{ id: uuidv7(), path: "/", serviceId: service.id, viewId: "home", operations: ["home.view"], enabled: true }]
  }))) });
}
async function database(t: TestContext, config = fixture()) {
  const admin = new Pool({ connectionString });
  const schema = `bp_test_${uuidv7().replaceAll("-", "")}`;
  await admin.query(`create schema ${schema}`);
  const url = new URL(connectionString!);
  url.searchParams.set("options", `-csearch_path=${schema} -cstatement_timeout=10000`);
  const scopedUrl = url.toString();
  const pool = new Pool({ connectionString: scopedUrl });
  const stores: PostgresStorage[] = [];
  t.after(async () => {
    await Promise.all(stores.map(store => store.close())); await pool.end();
    await admin.query(`drop schema ${schema} cascade`); await admin.end();
  });
  await pool.query("create table bp_platform_config (id text primary key, config jsonb not null, revision bigint not null default 0, updated_at timestamptz not null default now())");
  await pool.query("insert into bp_platform_config (id, config, revision) values ('default', $1, 4197)", [JSON.stringify(config)]);
  const makeStore = () => { const store = new PostgresStorage({ backend: "postgres", connectionString: scopedUrl }); stores.push(store); return store; };
  return { pool, makeStore, config };
}
pgTest("migration preserves independent records, fences legacy writers and resumes without reimporting", async t => {
  const { pool, makeStore, config } = await database(t);
  const a = makeStore(), b = makeStore(); await Promise.all([a.initialize(), b.initialize()]);
  const loaded = await a.loadConfig(); assert.deepEqual([...splitConfig(loaded).keys()], [...splitConfig(config).keys()]);
  assert.deepEqual(loaded.tenants, config.tenants);
  assert.deepEqual(loaded.apps.map(app => [app.id, app.title, app.auth?.roles, app.routes.map(route => [route.id, route.path, route.serviceId])]),
    config.apps.map(app => [app.id, app.title, app.auth?.roles, app.routes.map(route => [route.id, route.path, route.serviceId])]));
  assert.equal((await pool.query("select count(*)::int as count from bp_platform_config_entities where kind = 'apps'")).rows[0].count, 4);
  await assert.rejects(pool.query("update bp_platform_config set revision = revision + 1"), /upgrade all config-manager replicas/);
  await assert.rejects(pool.query("delete from bp_platform_config"), /upgrade all config-manager replicas/);
  loaded.apps[0].title = "After migration"; await a.saveConfig(loaded);
  assert.equal((await makeStore().loadConfig()).apps[0].title, "After migration");
  assert.equal((await pool.query("select revision from bp_platform_config")).rows[0].revision, "4197");
  assert.deepEqual((await pool.query("select version from bp_platform_config_migrations order by version")).rows.map(row => row.version), [1, 2, 3]);
  await assert.rejects(a.saveConfig(structuredClone(loaded)), /must be loaded/);
});
pgTest("stale snapshots of apps in the same and different tenants save without lost updates", async t => {
  const { makeStore, pool } = await database(t);
  const stores = [makeStore(), makeStore(), makeStore()];
  const snapshots = await Promise.all(stores.map(store => store.loadConfig()));
  snapshots.forEach((snapshot, i) => { snapshot.apps[i].title = `Changed ${i}`; });
  await Promise.all(stores.map((store, i) => store.saveConfig(snapshots[i])));
  assert.deepEqual((await makeStore().loadConfig()).apps.slice(0, 3).map(app => app.title), ["Changed 0", "Changed 1", "Changed 2"]);
  assert.equal((await pool.query("select count(*)::int as count from bp_platform_config_outbox")).rows[0].count, 3);
  await stores[0].saveConfig(snapshots[0]);
  assert.equal((await pool.query("select count(*)::int as count from bp_platform_config_outbox")).rows[0].count, 3);
});
pgTest("locking one app does not block adding a role in another app of the same tenant", async t => {
  const { makeStore, pool, config } = await database(t); const store = makeStore(); await store.initialize();
  const blocker = await pool.connect(); await blocker.query("begin");
  await blocker.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify(["bp_platform_config", "default", entityKey("apps", config.apps[0].id)])]);
  try {
    const handlers = new Map<string, (event: never) => Promise<Response>>();
    registerAdminApiRoutes(Object.fromEntries(["use", "get", "post", "put", "delete"].map(method => [method,
      (path: string, handler: (event: never) => Promise<Response>) => handlers.set(`${method} ${path}`, handler)
    ])) as never, store, {} as never);
    const response = await handlers.get("post /.well-known/bp/admin/apps/:appId/auth/roles")!({
      context: { params: { appId: config.apps[1].id } }, req: new Request("https://config.example/roles", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "editor", title: "Editor" })
      })
    } as never);
    assert.equal(response.status, 201); assert.equal((await makeStore().loadConfig()).apps[1].auth?.roles[0].id, "editor");
  } finally { await blocker.query("rollback"); blocker.release(); }
});
pgTest("same-app conflicts and delete/recreate cannot overwrite an accepted mutation", async t => {
  const { makeStore } = await database(t); const a = makeStore(), b = makeStore();
  const first = await a.loadConfig(), stale = await b.loadConfig();
  first.apps[0].title = "Winner"; stale.apps[0].title = "Loser"; await a.saveConfig(first);
  await assert.rejects(b.saveConfig(stale), ConfigRevisionConflictError);
  assert.equal((await b.loadConfig()).apps[0].title, "Winner");
  const original = structuredClone(first.apps[0]); first.apps.splice(0, 1); await a.saveConfig(first);
  first.apps.push(original); await a.saveConfig(first); await assert.rejects(b.saveConfig(stale), ConfigRevisionConflictError);
});
pgTest("tenant, service and manifest writes do not conflict with unrelated apps", async t => {
  const { makeStore } = await database(t); const a = makeStore(), b = makeStore();
  const first = await a.loadConfig(), second = await b.loadConfig();
  first.tenants[0].title = "Tenant update"; second.tenants[1].title = "Other tenant update";
  await Promise.all([a.saveConfig(first), b.saveConfig(second)]);
  const serviceEdit = await a.loadConfig(), appEdit = await b.loadConfig();
  serviceEdit.tenants[0].services[0].title = "Service metadata update"; appEdit.apps[1].title = "Other app still saves";
  await a.saveConfig(serviceEdit); await b.saveConfig(appEdit);
  const manifest = await a.loadConfig(), role = await b.loadConfig();
  manifest.manifestCache.push({ serviceId: "org.example.service0", manifestVersion: "1", fetchedAt: new Date().toISOString(), viewIndex: {} } as never);
  role.apps[1].auth!.roles.push({ id: "reader", title: "Reader", permissions: [] });
  await Promise.all([a.saveConfig(manifest), b.saveConfig(role)]);
  assert.equal((await makeStore().loadConfig()).apps[1].auth!.roles[0].id, "reader");
});
pgTest("cross-entity writes roll back on conflict and foreign keys protect referenced parents", async t => {
  const { makeStore, pool } = await database(t); const a = makeStore(), b = makeStore();
  const first = await a.loadConfig(), stale = await b.loadConfig(); first.apps[0].title = "Accepted"; await a.saveConfig(first);
  stale.apps[0].title = "Rejected"; stale.apps[1].title = "Must roll back";
  await assert.rejects(b.saveConfig(stale), ConfigRevisionConflictError);
  assert.equal((await b.loadConfig()).apps[1].title, "App 1");
  await assert.rejects(pool.query("delete from bp_platform_config_entities where kind = 'tenants'"), /foreign key/);
  const invalid = await b.loadConfig(); invalid.tenants.splice(0, 1);
  await assert.rejects(b.saveConfig(invalid), /missing tenant/);
  assert.equal((await makeStore().loadConfig()).tenants.length, 2);
});
pgTest("concurrent hostname claims cannot create ambiguous frontend routing", async t => {
  const { makeStore } = await database(t); const a = makeStore(), b = makeStore();
  const first = await a.loadConfig(), second = await b.loadConfig();
  first.apps.push({ ...structuredClone(first.apps[0]), id: uuidv7(), slug: "one", hostnames: ["claimed.example"] });
  second.apps.push({ ...structuredClone(second.apps[0]), id: uuidv7(), slug: "two", hostnames: ["claimed.example"] });
  const results = await Promise.allSettled([a.saveConfig(first), b.saveConfig(second)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await makeStore().loadConfig()).apps.filter(app => app.hostnames.includes("claimed.example")).length, 1);
});
pgTest("PVE migration freezes effective settings and app edits are independent of source and template", async t => {
  const config = fixture();
  const { group } = createPreviewGroup(config, { name: "PRs", sourceTenantId: config.tenants[0].id, sourceAppId: config.apps[0].id, expiresInDays: 30 });
  group.services.push({ serviceId: "org.example.service0", config: { tenant: { key: "original" }, app: {} } });
  const provision = (key: string) => provisionPreviewDeployment(config, group.id, { key, hostname: `${key}.example`,
    services: [{ serviceId: "org.example.service0", url: `https://service.${key}.example` }] }, "https://config.example").deployment;
  const pveA = provision("pve-a"), pveB = provision("pve-b"); delete pveA.effectiveConfig;
  const { makeStore, pool } = await database(t, config); const a = makeStore(), b = makeStore();
  const original = await a.loadConfig(), sibling = await b.loadConfig();
  const previousRevision = (await b.getScopedConfig(pveA.services[0].instanceId, "tenant", pveA.tenantId)).previewConfig?.revision;
  assert.equal(original.previewEnvironmentDeployments[0].effectiveConfig?.services[0].config.tenant.key, "original");
  original.previewEnvironmentGroups[0].services[0].config.tenant.key = "template changed"; original.apps[0].title = "Source changed";
  await a.saveConfig(original);
  sibling.apps.find(app => app.id === pveA.appId)!.title = "Own PVE app";
  sibling.previewEnvironmentDeployments.find(deployment => deployment.id === pveA.id)!.effectiveConfig!.services[0].config.tenant.key = "own setting";
  await b.saveConfig(sibling);
  const latest = await makeStore().loadConfig();
  assert.equal(latest.previewEnvironmentDeployments.find(deployment => deployment.id === pveA.id)!.effectiveConfig!.services[0].config.tenant.key, "own setting");
  assert.equal(latest.previewEnvironmentDeployments.find(deployment => deployment.id === pveB.id)!.effectiveConfig!.services[0].config.tenant.key, "original");
  const scoped = await b.getScopedConfig(pveA.services[0].instanceId, "tenant", pveA.tenantId);
  assert.equal(scoped.previewConfig?.tenant.key, "own setting");
  assert.notEqual(scoped.previewConfig?.revision, previousRevision);
  await pool.query("delete from bp_platform_config_references where kind = 'previewConfigs' and entity_id = $1", [pveA.id]);
  await pool.query("delete from bp_platform_config_entities where kind = 'previewConfigs' and entity_id = $1", [pveA.id]);
  // A lost/corrupt snapshot must never silently revert to inheriting the template.
  await assert.rejects(makeStore().loadConfig(), /missing its effective configuration/);
});

pgTest("pending action completion rolls back with a stale entity and requires its live lease", async t => {
  const { makeStore, pool } = await database(t); const a = makeStore(), b = makeStore();
  const input = { kind: "setup" as const, key: "setup-test", secretHash: "test-hash", owner: "owner" };
  await a.createPendingAction({ ...input, payload: {}, expiresAt: new Date(Date.now() + 60000).toISOString() });
  assert.equal((await a.claimPendingAction(input)).state, "claimed");
  const original = await a.loadConfig(), stale = await b.loadConfig();
  original.apps[0].title = "Accepted"; stale.apps[0].title = "Rejected"; await a.saveConfig(original);
  const completion = { ...input, result: { ok: true } };
  await assert.rejects(b.completePendingAction(completion, stale), ConfigRevisionConflictError);
  assert.equal((await pool.query("select status from bp_platform_config_actions")).rows[0].status, "processing");
  const fresh = await b.loadConfig(); fresh.apps[0].title = "Completed";
  await b.completePendingAction(completion, fresh);
  assert.equal((await pool.query("select status from bp_platform_config_actions")).rows[0].status, "completed");
  fresh.apps[0].title = "Cannot reuse lease";
  await assert.rejects(b.completePendingAction(completion, fresh), /lease was lost/);
  assert.equal((await makeStore().loadConfig()).apps[0].title, "Completed");
});

pgTest("presence is independent, rotation clears it, and manifests use the PostgreSQL clock", async t => {
  const { makeStore, pool } = await database(t); const a = makeStore(), b = makeStore();
  const initial = await a.loadConfig(); const serviceId = initial.tenants[0].services[0].id;
  await a.touchServiceActivity(serviceId, "lastSeenAt"); await a.touchServiceActivity(serviceId, "lastSyncAt");
  const before = (await pool.query("select revision from bp_platform_config_entities where kind = 'tenantServices' and entity_id = $1", [serviceId])).rows[0].revision;
  assert.ok((await b.loadConfig()).tenants[0].services[0].lastSeenAt);
  const old = await a.loadConfig(); old.manifestCache.push({ serviceId, manifestVersion: "1", fetchedAt: "2099-01-01T00:00:00.000Z", viewIndex: {} } as never);
  await a.saveConfig(old);
  const clock = (await pool.query("select clock_timestamp() as now")).rows[0].now as Date;
  assert.ok(Math.abs(Date.parse(old.manifestCache[0].fetchedAt) - clock.getTime()) < 5000);
  assert.equal((await pool.query("select revision from bp_platform_config_entities where kind = 'tenantServices' and entity_id = $1", [serviceId])).rows[0].revision, before);
  const rotated = await a.loadConfig(); rotated.tenants[0].services[0].apiKeyHash = "rotated";
  await a.saveConfig(rotated); b.invalidate();
  assert.equal((await b.loadConfig()).tenants[0].services[0].lastSyncAt, undefined);
  assert.equal((await pool.query("select count(*)::int as count from bp_platform_config_activity")).rows[0].count, 0);
});

pgTest("migration failure rolls back the cutover and preserves the original config", async t => {
  const invalid = fixture(); invalid.apps[0].tenantId = uuidv7();
  const { makeStore, pool } = await database(t, invalid);
  await assert.rejects(makeStore().initialize(), /missing tenant/);
  assert.deepEqual((await pool.query("select config from bp_platform_config")).rows[0].config, JSON.parse(JSON.stringify(invalid)));
  assert.equal((await pool.query("select to_regclass('bp_platform_config_entities') as name")).rows[0].name, null);
  await pool.query("update bp_platform_config set revision = revision + 1");
});


for (const firstWriter of ["target", "purge"] as const) pgTest(`webhook creation versus service purge preserves references when ${firstWriter} commits first`, async t => {
  const { makeStore, pool } = await database(t);
  const targetStore = makeStore(), purgeStore = makeStore();
  const targetConfig = await targetStore.loadConfig(), purgeConfig = await purgeStore.loadConfig();
  const tenantId = targetConfig.tenants[0].id, serviceId = targetConfig.tenants[0].services[0].id;
  targetConfig.webhooks.targets.push({ id: uuidv7(), tenantId, serviceId, eventId: "changed",
    url: "https://receiver.example/events", secret: "test-only", createdAt: new Date().toISOString(), enabled: true, maxAttempts: 3 });
  purgeServiceReferences(purgeConfig, tenantId, serviceId);
  purgeConfig.tenants[0].services = purgeConfig.tenants[0].services.filter(service => service.id !== serviceId);
  if (firstWriter === "target") {
    await targetStore.saveConfig(targetConfig);
    const refs = await pool.query("select target_kind, target_id from bp_platform_config_references where kind = 'webhookTargets'");
    assert.ok(refs.rows.some(row => row.target_kind === "tenantServices" && row.target_id === serviceId));
    await assert.rejects(purgeStore.saveConfig(purgeConfig), /references missing service/);
    // Reloading and purging again removes both target and service atomically.
    purgeStore.invalidate();
    const retry = await purgeStore.loadConfig();
    purgeServiceReferences(retry, tenantId, serviceId);
    retry.tenants[0].services = retry.tenants[0].services.filter(service => service.id !== serviceId);
    await purgeStore.saveConfig(retry);
  } else {
    await purgeStore.saveConfig(purgeConfig);
    await assert.rejects(targetStore.saveConfig(targetConfig), ConfigRevisionConflictError);
    const retry = await targetStore.loadConfig();
    retry.webhooks.targets.push(targetConfig.webhooks.targets[0]);
    await assert.rejects(targetStore.saveConfig(retry), /references missing service/);
  }
  const latest = await makeStore().loadConfig();
  assert.equal(latest.webhooks.targets.length, 0);
  assert.equal(latest.tenants[0].services.some(service => service.id === serviceId), false);
});


for (const firstWriter of ["manifest", "purge"] as const) pgTest(`manifest-only sync versus service purge is fenced when ${firstWriter} commits first`, async t => {
  const { makeStore, pool } = await database(t);
  const syncStore = makeStore(), purgeStore = makeStore();
  const syncConfig = await syncStore.loadConfig(), purgeConfig = await purgeStore.loadConfig();
  const tenantId = syncConfig.tenants[0].id, serviceId = syncConfig.tenants[0].services[0].id;
  syncConfig.manifestCache.push({ serviceId, manifestVersion: "1", fetchedAt: new Date().toISOString(), viewIndex: {} } as never);
  purgeServiceReferences(purgeConfig, tenantId, serviceId);
  purgeConfig.tenants[0].services = purgeConfig.tenants[0].services.filter(service => service.id !== serviceId);
  if (firstWriter === "manifest") {
    await syncStore.saveConfig(syncConfig);
    const refs = await pool.query("select target_kind, target_id from bp_platform_config_references where kind = 'manifestCache'");
    assert.ok(refs.rows.some(row => row.target_kind === "tenantServices" && row.target_id === serviceId));
    await assert.rejects(purgeStore.saveConfig(purgeConfig), ConfigRevisionConflictError);
    const retry = await purgeStore.loadConfig();
    purgeServiceReferences(retry, tenantId, serviceId);
    retry.tenants[0].services = retry.tenants[0].services.filter(service => service.id !== serviceId);
    await purgeStore.saveConfig(retry);
  } else {
    await purgeStore.saveConfig(purgeConfig);
    await assert.rejects(syncStore.saveConfig(syncConfig), ConfigRevisionConflictError);
  }
  const latest = await makeStore().loadConfig();
  assert.equal(latest.manifestCache.some(entry => entry.serviceId === serviceId), false);
  assert.equal(latest.tenants[0].services.some(service => service.id === serviceId), false);
});

pgTest("service purge removes shell fragment dependencies while preserving unrelated settings", async t => {
  const config = fixture();
  const app = config.apps[0];
  const [removed, retained] = config.tenants[0].services;
  const removedItem = { source: "service" as const, serviceId: removed.id, fragmentId: "removed", targetPath: "/" };
  const retainedItem = { source: "service" as const, serviceId: retained.id, fragmentId: "retained", targetPath: "/" };
  app.shellFragments = {
    [removed.id]: { owned: { mode: "none" } },
    [retained.id]: {
      override: { mode: "override", item: removedItem },
      list: { mode: "items", items: [removedItem, retainedItem, { source: "shell", fragmentId: "local" }] },
      empty: { mode: "items", items: [removedItem] },
      disabled: { mode: "none" },
      kept: { mode: "override", item: retainedItem }
    }
  };
  const { makeStore } = await database(t, config);
  const store = makeStore();
  const loaded = await store.loadConfig();
  const blockers = collectServiceDeleteBlockers(loaded, app.tenantId, removed.id);
  assert.ok(blockers.some(value => value.includes(`shell fragments ${removed.id}`)));
  for (const name of ["override", "list", "empty"]) {
    assert.ok(blockers.some(value => value.includes(`shell fragment ${retained.id}.${name}`)));
  }
  purgeServiceReferences(loaded, app.tenantId, removed.id);
  assert.deepEqual(collectServiceDeleteBlockers(loaded, app.tenantId, removed.id), []);
  loaded.tenants[0].services = loaded.tenants[0].services.filter(service => service.id !== removed.id);
  await store.saveConfig(loaded);
  assert.deepEqual((await makeStore().loadConfig()).apps[0].shellFragments, {
    [retained.id]: {
      list: { mode: "items", items: [retainedItem, { source: "shell", fragmentId: "local" }] },
      empty: { mode: "items", items: [] }, disabled: { mode: "none" },
      kept: { mode: "override", item: retainedItem }
    }
  });
});

for (const entity of ["app", "tenant"] as const) pgTest(`deleting a preview source ${entity} is explicitly blocked before saving`, async t => {
  const config = fixture();
  const source = config.apps[0];
  const { group } = createPreviewGroup(config, { name: "Dependent previews", expiresInDays: 7, sourceTenantId: source.tenantId, sourceAppId: source.id });
  const { makeStore } = await database(t, config);
  const store = makeStore();
  let saves = 0;
  setConfigManagerRouteContext({
    storage: { loadConfig: () => store.loadConfig(), saveConfig: async value => { saves++; await store.saveConfig(value); } },
    serviceBaseUrl: "https://config.example"
  } as Parameters<typeof setConfigManagerRouteContext>[0]);
  const remove = entity === "app" ? deleteApp : deleteTenant;
  const id = entity === "app" ? source.id : source.tenantId;
  await assert.rejects(remove(id), error => {
    assert.equal((error as { statusCode: number }).statusCode, 409);
    assert.match((error as Error).message, /Dependent previews.*Delete those preview groups first/);
    return true;
  });
  assert.equal(saves, 0);
  const unchanged = await store.loadConfig();
  assert.ok(unchanged.apps.some(app => app.id === source.id));
  assert.ok(unchanged.tenants.some(tenant => tenant.id === source.tenantId));
  assert.ok(unchanged.previewEnvironmentGroups.some(candidate => candidate.id === group.id));
  unchanged.previewEnvironmentGroups = [];
  await store.saveConfig(unchanged);
  await remove(id);
  const latest = await store.loadConfig();
  assert.equal(latest.apps.some(app => app.id === source.id), false);
  if (entity === "tenant") assert.equal(latest.tenants.some(tenant => tenant.id === source.tenantId), false);
});

pgTest("relational app data migrates losslessly and old app-document writes are fenced", async t => {
  const config = fixture(); const app = config.apps[0];
  app.auth!.roles = [{ id: "user-pbx-archiver", title: "PBX Archiver User", description: "",
    permissions: [{ serviceId: app.routes[0].serviceId, viewId: "home", permissions: ["read", "update"] }] }];
  app.menu = [{ id: uuidv7(), type: "group", title: "Group", enabled: true, serviceStatus: "show", authStatus: "auto",
    children: [{ id: uuidv7(), type: "link", title: "Home", routeId: app.routes[0].id,
      enabled: true, serviceStatus: "show", authStatus: "auto", children: [] }] }];
  // Existing schema-2 canonicalization already adds these legacy route/auth defaults.
  Object.assign(app.auth!, { loginViewId: "login.index", logoutViewId: "logout.index", refreshViewId: "refresh.index" });
  Object.assign(app.routes[0], { enablement: "enabled", resolvedServicePath: undefined, servicePathVariant: undefined, targetPath: undefined });
  const { makeStore, pool } = await database(t, config);
  const store = makeStore(); await store.initialize();
  const loaded = await store.loadConfig();
  assert.deepEqual(loaded.apps[0], app);
  const row = (await pool.query("select value from bp_platform_config_entities where kind='apps' and entity_id=$1", [app.id])).rows[0].value;
  assert.equal(row.routes, undefined); assert.equal(row.menu, undefined); assert.equal(row.auth.roles, undefined);
  assert.equal((await pool.query("select count(*)::int as n from bp_platform_config_role_grants")).rows[0].n, 2);
  assert.deepEqual((await pool.query("select value from bp_platform_config_app_data_backup where app_id=$1", [app.id])).rows[0].value, JSON.parse(JSON.stringify(app)));
  await assert.rejects(pool.query("update bp_platform_config_entities set value=value where kind='apps'"), /upgrade all config-manager replicas/);
  await makeStore().initialize();
  assert.deepEqual((await makeStore().loadConfig()).apps[0], app);
});

pgTest("replicas read committed roles and grants without broadcasts, and unrelated edits survive", async t => {
  const { makeStore, pool, config } = await database(t);
  const a = makeStore(), b = makeStore(); await Promise.all([a.initialize(), b.initialize()]);
  const appId = config.apps[0].id;
  await b.loadConfig();
  const revision = (await pool.query("select revision from bp_platform_config_entities where kind='apps' and entity_id=$1", [appId])).rows[0].revision;
  await Promise.all([
    a.mutateApp(appId, async data => { data.apps[0].auth!.roles.push({ id: "reader", title: "Reader",
      permissions: [{ serviceId: data.apps[0].routes[0].serviceId, viewId: "home", permissions: ["read"] }] }); }),
    b.mutateApp(appId, async data => { data.apps[0].routes[0].title = "Updated route"; })
  ]);
  for (const store of [a, b, makeStore(), a, b]) {
    const app = (await store.loadConfig()).apps[0];
    assert.equal(app.auth!.roles[0].id, "reader");
    assert.deepEqual(app.auth!.roles[0].permissions[0].permissions, ["read"]);
    assert.equal(app.routes[0].title, "Updated route");
  }
  assert.equal((await pool.query("select revision from bp_platform_config_entities where kind='apps' and entity_id=$1", [appId])).rows[0].revision, revision);
  const stale = await a.loadConfig();
  await b.mutateApp(appId, async data => { data.apps[0].auth!.roles[0].permissions[0].permissions.push("update"); });
  stale.apps[0].routes[0].title = "Background route sync";
  await a.saveConfig(stale);
  assert.deepEqual((await b.loadConfig()).apps[0].auth!.roles[0].permissions[0].permissions, ["read", "update"]);
});

pgTest("role POST transactions preserve concurrent roles and reject duplicates", async t => {
  const { makeStore, config } = await database(t);
  const stores = [makeStore(), makeStore()];
  await Promise.all(stores.map(store => store.initialize()));
  const handlers = stores.map(store => {
    const routes = new Map<string, (event: never) => Promise<Response>>();
    registerAdminApiRoutes(Object.fromEntries(["use", "get", "post", "put", "delete"].map(method => [method,
      (path: string, handler: (event: never) => Promise<Response>) => routes.set(method + " " + path, handler)
    ])) as never, store, {} as never);
    return routes.get("post /.well-known/bp/admin/apps/:appId/auth/roles")!;
  });
  const call = (index: number, id: string) => handlers[index]({
    context: { params: { appId: config.apps[0].id } },
    req: new Request("https://config.example/roles", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id, title: "PBX Archiver User", description: "" }) })
  } as never);
  const responses = await Promise.all([call(0, "user-pbx-archiver"), call(1, "reader")]);
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  assert.equal((await call(1, "user-pbx-archiver")).status, 409);
  assert.deepEqual((await makeStore().loadConfig()).apps[0].auth!.roles.map(role => role.id).sort(), ["reader", "user-pbx-archiver"]);
});

pgTest("menu foreign keys prevent dangling routes and failed app transactions roll back", async t => {
  const { makeStore, config } = await database(t); const store = makeStore(); await store.initialize();
  const appId = config.apps[0].id;
  await store.mutateApp(appId, async data => { data.apps[0].menu.push({ id: uuidv7(), type: "link", routeId: data.apps[0].routes[0].id,
    enabled: true, serviceStatus: "show", authStatus: "auto", children: [] }); });
  await assert.rejects(store.mutateApp(appId, async data => { data.apps[0].routes = []; }));
  assert.equal((await store.loadConfig()).apps[0].routes.length, 1);
  await assert.rejects(store.mutateApp(appId, async data => {
    data.apps[0].auth!.roles.push({ id: "never-committed", title: "No", permissions: [] });
    throw new Error("cancel");
  }), /cancel/);
  assert.equal((await store.loadConfig()).apps[0].auth!.roles.length, 0);
});

pgTest("stale snapshot replacement cannot delete newly committed app data", async t => {
  const { makeStore, config } = await database(t); const a = makeStore(), b = makeStore();
  const stale = await a.loadConfig();
  await b.mutateApp(config.apps[0].id, async data => {
    data.apps[0].auth!.roles.push({ id: "new-role", title: "New", permissions: [] });
  });
  stale.apps.shift();
  await assert.rejects(a.saveConfig(stale), /App data changed concurrently/);
  assert.equal((await b.loadConfig()).apps[0].auth!.roles[0].id, "new-role");
});

pgTest("failed relational constraints roll back all app row changes", async t => {
  const { makeStore, config } = await database(t); const store = makeStore();
  await store.initialize();
  await assert.rejects(store.mutateApp(config.apps[0].id, async data => {
    data.apps[0].auth!.roles.push({ id: "not-saved", title: "No", permissions: [] });
    data.apps[0].routes.push({ ...data.apps[0].routes[0], id: uuidv7() });
  }));
  const app = (await store.loadConfig()).apps[0];
  assert.equal(app.auth!.roles.length, 0);
  assert.equal(app.routes.length, 1);
});
