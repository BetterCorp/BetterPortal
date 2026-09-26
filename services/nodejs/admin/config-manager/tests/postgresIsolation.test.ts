import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Pool } from "pg";
import { BetterPortalConfigSchema, uuidv7, type BetterPortalConfig } from "@betterportal/framework";
import { PostgresStorage, ConfigRevisionConflictError } from "../src/plugins/service-betterportal-config-manager/storage/postgres.js";
import { entityKey, splitConfig } from "../src/plugins/service-betterportal-config-manager/storage/entities.js";
import { createPreviewGroup, provisionPreviewDeployment } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { registerAdminApiRoutes } from "../src/plugins/service-betterportal-config-manager/adminApi.js";

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
  assert.deepEqual((await pool.query("select version from bp_platform_config_migrations order by version")).rows.map(row => row.version), [1, 2]);
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
