import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { BetterPortalAppSchema, BetterPortalTenantSchema, BetterPortalConfigSchema, resolveEmbeddedRequestContext, type HeaderMap, type BetterPortalConfig, type BetterPortalObservability } from "@betterportal/framework";
import type { PostgresStorage } from "./storage/postgres.js";
import { getAvailableServiceInstanceIdsForApp, resolveAuthProviderRuntimeMetadata } from "./storage/core.js";
import { appSettings } from "./storage/appData.js";

export type AppDatabase = PostgresStorage["database"];
/** Editor data, not a complete platform configuration and never passed to saveConfig. */
export type AppEditorData = Pick<BetterPortalConfig, "apps" | "tenants" | "platformServices" | "sharedServiceCatalog" | "sharedServiceActivations" | "previewEnvironmentDeployments">;

export async function readAppEditor(client: PoolClient, db: AppDatabase, appId: string): Promise<AppEditorData> {
  const rows = await db.appData.read(client, db.entities, appId);
  const app = rows.entities[0]?.value;
  const empty: AppEditorData = { apps: [], tenants: [], platformServices: [], sharedServiceCatalog: [], sharedServiceActivations: [], previewEnvironmentDeployments: [] };
  if (!app) return empty;
  db.appData.hydrate([app], rows);
  const result = await client.query(`with tenant as (
      select value from ${db.entities} where scope_id=$1 and kind='tenants' and entity_id=$2
    ), activations as (
      select value from ${db.entities} where scope_id=$1 and kind='sharedServiceActivations'
        and value->>'tenantId'=$2 and (value->>'appId' is null or value->>'appId'=$3)
    ) select kind, entity_id, value from ${db.entities} where scope_id=$1 and (
      (kind='tenants' and entity_id=$2)
      or (kind='previewEnvironmentDeployments' and value->>'appId'=$3)
      or (kind='tenantServices' and value->>'tenantId'=$2)
      or (kind='platformServices' and entity_id in (select jsonb_array_elements_text(value->'activatedPlatformServices') from tenant))
      or (kind='sharedServiceActivations' and value in (select value from activations))
      or (kind='sharedServiceCatalog' and entity_id in (select value->>'sharedServiceId' from activations))) order by ordinal`,
    [db.scope, app.tenantId, appId]);
  const values = (kind: string) => result.rows.filter(row => row.kind === kind).map(row => row.value);
  const tenant = values("tenants")[0];
  if (!tenant) throw new Error("App tenant is missing");
  tenant.services = values("tenantServices").map(({ tenantId: _tenantId, ...service }) => service);
  return { apps: [BetterPortalAppSchema.parse(app)], tenants: [BetterPortalTenantSchema.parse(tenant)],
    platformServices: values("platformServices"), sharedServiceCatalog: values("sharedServiceCatalog"),
    sharedServiceActivations: values("sharedServiceActivations"), previewEnvironmentDeployments: values("previewEnvironmentDeployments") };
}

/** A short transaction over one app's relational collections. No platform snapshots. */
export async function editAppRows<T>(db: AppDatabase, appId: string, obs: BetterPortalObservability | undefined,
  change: (data: AppEditorData) => Promise<T>): Promise<T> {
  const span = obs?.startSpan("bp.app.edit");
  const waiting = span?.startSpan("bp.app.pool_wait");
  let client: PoolClient;
  try { client = await db.pool.connect(); } catch (error) { span?.end(); throw error; } finally { waiting?.end(); }
  try {
    await client.query("begin");
    await client.query("set local betterportal.app_data_writer = '3'");
    const lock = span?.startSpan("bp.app.lock");
    try { await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",
      [JSON.stringify([db.tableName, db.scope, JSON.stringify(["apps", appId])])]); }
    finally { lock?.end(); }
    const reading = span?.startSpan("bp.app.read");
    let data: AppEditorData;
    try { data = await readAppEditor(client, db, appId); } finally { reading?.end(); }
    const before = data.apps[0] && structuredClone(data.apps[0]);
    const result = await change(data);
    if (result instanceof Response && !result.ok) { await client.query("rollback"); return result; }
    if (!before) { await client.query("rollback"); return result; }
    const after = BetterPortalAppSchema.parse(data.apps[0]);
    if (before.auth?.roles.some(role => role.id === "*") && !after.auth?.roles.some(role => role.id === "*")) {
      throw new Error("The reserved platform root role cannot be removed");
    }
    for (const route of after.routes) {
      for (const path of [route.path, route.targetPath, route.servicePathVariant, route.resolvedServicePath]) {
        if (path && /\{[^}]+\}/.test(path)) throw new Error("Route paths must use :param syntax");
      }
      for (const [name, value] of Object.entries(route.fixedParams ?? {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || value.length < 1 || value.length > 100) throw new Error("Invalid fixed route parameter");
      }
    }
    if (!isDeepStrictEqual(appSettings(before), appSettings(after))) throw new Error("App data edit cannot modify app settings");
    if (db.appData.changed(before, after)) {
      const writing = span?.startSpan("bp.app.write");
      try {
        // Existing writers use the same dependency lock names; refresh allocations after acquiring them.
        const refs = [
          ...data.tenants.map(value => ["tenants", value.id]),
          ...data.tenants.flatMap(tenant => tenant.services.map(value => ["tenantServices", value.id])),
          ...data.platformServices.map(value => ["platformServices", value.id]),
          ...data.sharedServiceCatalog.map(value => ["sharedServiceCatalog", value.id]),
          ...data.sharedServiceActivations.map(value => ["sharedServiceActivations", value.id])
        ];
        await client.query(`select pg_advisory_xact_lock_shared(hashtextextended(k,0)) from unnest($1::text[]) k order by k`,
          [refs.map(ref => JSON.stringify([db.tableName, db.scope, JSON.stringify(ref)])).sort()]);
        const current = await readAppEditor(client, db, appId);
        const allowed = getAvailableServiceInstanceIdsForApp(current, after);
        for (const serviceId of [
          ...after.routes.map(route => route.serviceId),
          ...(after.auth?.roles ?? []).flatMap(role => role.permissions.map(grant => grant.serviceId))
        ]) if (!allowed.has(serviceId)) throw new Error("Route or permission references an unavailable service");
        await db.appData.save(client, appId, before, after);
        const used = new Set<string>();
        const visit = (value: unknown): void => {
          if (!value || typeof value !== "object") return;
          for (const [key, child] of Object.entries(value)) {
            if (key === "serviceId" && typeof child === "string") used.add(child);
            else visit(child);
          }
        };
        visit(after);
        await client.query(`delete from ${db.references} where scope_id=$1 and kind='apps' and entity_id=$2
          and target_kind in ('tenantServices','platformServices','sharedServiceCatalog','sharedServiceActivations')`, [db.scope, appId]);
        for (const [kind, id] of refs) if (used.has(id)) await client.query(
          `insert into ${db.references} (scope_id,kind,entity_id,target_kind,target_id) values ($1,'apps',$2,$3,$4) on conflict do nothing`,
          [db.scope, appId, kind, id]);
        await client.query(`insert into ${db.outbox} (scope_id,id,delivery,event_name,payload)
          values ($1,$2,'broadcast','platform-config.changed',jsonb_build_object('revision',nextval('${db.revisions}'),'appId',$3::text))`,
          [db.scope, randomUUID(), appId]);
      } finally { writing?.end(); }
    }
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client.release(); span?.end(); }
}

/** Management request resolution reads app settings first, then only the matched app's rows. */
export async function readRequestConfig(db: AppDatabase, headers: HeaderMap, obs?: BetterPortalObservability) {
  const span = obs?.startSpan("bp.request_context.read");
  let client: PoolClient;
  try { client = await db.pool.connect(); } catch (error) { span?.end(); throw error; }
  try {
    await client.query("begin isolation level repeatable read read only");
    const result = await client.query(`with settings as (
      select value from ${db.entities} where scope_id=$1 and kind='settings' and entity_id='platform'
    ) select kind,value from ${db.entities} where scope_id=$1 and (
      kind='settings'
      or (kind='apps' and value->>'tenantId'=coalesce((select value->>'adminTenantId' from settings),'betterportal'))
      or (kind='tenants' and entity_id=coalesce((select value->>'adminTenantId' from settings),'betterportal'))) order by ordinal`, [db.scope]);
    const selector = BetterPortalConfigSchema.parse({
      configManagement: result.rows.find(row => row.kind === "settings")?.value,
      apps: result.rows.filter(row => row.kind === "apps").map(row => row.value),
      tenants: result.rows.filter(row => row.kind === "tenants").map(row => row.value)
    });
    const selected = resolveEmbeddedRequestContext(selector, headers);
    if (!selected) { await client.query("commit"); return selector; }
    const data = await readAppEditor(client, db, selected.app.id);
    const config = { ...selector, ...data };
    const app = config.apps[0];
    if (app.auth) {
      const provider = resolveAuthProviderRuntimeMetadata(config, app.auth.serviceId);
      if (provider) Object.assign(app.auth, { expectedIssuer: provider.issuer, expectedAudience: provider.audience,
        jwksUri: provider.jwksUri, ...(provider.publicKeys ? { publicKeys: provider.publicKeys } : {}) });
    }
    if (app.shell) {
      const service = data.tenants[0].services.find(service => service.id === app.shell!.serviceId)
        ?? data.platformServices.find(service => service.id === app.shell!.serviceId);
      const manifests = await client.query(`select value from ${db.entities} where scope_id=$1 and kind='manifestCache'
        and entity_id=any($2::text[])`, [db.scope, [app.shell.serviceId, service?.serviceId].filter(Boolean)]);
      config.manifestCache = manifests.rows.map(row => row.value);
    }
    await client.query("commit");
    return config;
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); span?.end(); }
}

export async function readAppPage(db: AppDatabase, appId?: string, chooseFirst = false) {
  const client = await db.pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const result = await client.query<{ id: string; tenantId: string; title: string }>(
      `select entity_id as id,value->>'tenantId' as "tenantId",value->>'title' as title from ${db.entities} app
       where scope_id=$1 and kind='apps' and not exists (
         select 1 from ${db.entities} preview where preview.scope_id=app.scope_id and preview.kind='previewEnvironmentDeployments'
           and preview.value->>'appId'=app.entity_id) order by ordinal`, [db.scope]);
    const selected = result.rows.find(app => app.id === appId)?.id ?? (!appId && chooseFirst ? result.rows[0]?.id : undefined);
    const data = await readAppEditor(client, db, selected ?? "");
    await client.query("commit");
    return { ...data, appChoices: result.rows };
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
}

export type CacheData = Pick<BetterPortalConfig, "apps" | "tenants" | "platformServices" | "sharedServiceCatalog" | "sharedServiceActivations" | "configManagement" | "manifestCache">;
/** Caches need service manifests and auth grants, never menus, routes or preview snapshots. */
export async function readCacheData(db: AppDatabase): Promise<CacheData> {
  const client = await db.pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const result = await client.query(`select kind,value from ${db.entities} where scope_id=$1
      and kind in ('apps','tenants','tenantServices','platformServices','sharedServiceCatalog','sharedServiceActivations','settings','manifestCache') order by ordinal`, [db.scope]);
    const values = (kind: string) => result.rows.filter(row => row.kind === kind).map(row => row.value);
    const apps = values("apps");
    const roles = await client.query(`select app_id,id,title,description,position from ${db.appData.roles} where scope_id=$1`, [db.scope]);
    const grants = await client.query(`select app_id,role_id,service_id,view_id,actions,grant_position from ${db.appData.grants} where scope_id=$1`, [db.scope]);
    db.appData.hydrate(apps, { roles: roles.rows, grants: grants.rows, routes: [], menus: [] });
    const tenants = values("tenants");
    const byId = new Map(tenants.map(tenant => [tenant.id, tenant]));
    for (const { tenantId, ...service } of values("tenantServices")) byId.get(tenantId)?.services.push(service);
    const data: CacheData = { apps: apps.map(app => BetterPortalAppSchema.parse(app)), tenants,
      platformServices: values("platformServices"), sharedServiceCatalog: values("sharedServiceCatalog"),
      sharedServiceActivations: values("sharedServiceActivations"), configManagement: values("settings")[0],
      manifestCache: values("manifestCache") };
    for (const app of data.apps) if (app.auth) {
      const provider = resolveAuthProviderRuntimeMetadata(data, app.auth.serviceId);
      if (provider) Object.assign(app.auth, { expectedIssuer: provider.issuer, expectedAudience: provider.audience,
        jwksUri: provider.jwksUri, ...(provider.publicKeys ? { publicKeys: provider.publicKeys } : {}) });
    }
    await client.query("commit");
    return data;
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
}

export async function readApp(db: AppDatabase, appId: string): Promise<AppEditorData> {
  const client = await db.pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const data = await readAppEditor(client, db, appId);
    await client.query("commit");
    return data;
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
}

export type DirectoryData = Pick<BetterPortalConfig, "apps" | "tenants" | "platformServices" | "sharedServiceCatalog" | "sharedServiceActivations" | "configManagement" | "m2m">;
/** Service/settings pages need registration summaries, not app operational collections. */
export async function readDirectory(db: AppDatabase): Promise<DirectoryData> {
  const result = await db.pool.query(`with previews as (
    select value->>'tenantId' as tenant_id,value->>'appId' as app_id from ${db.entities}
      where scope_id=$1 and kind='previewEnvironmentDeployments'
  ) select kind,value from ${db.entities} e where scope_id=$1
    and kind in ('settings','apps','tenants','tenantServices','platformServices','sharedServiceCatalog','sharedServiceActivations','bindings','grants')
    and not exists (select 1 from previews p where
      (e.kind='apps' and e.entity_id=p.app_id) or (e.kind='tenants' and e.entity_id=p.tenant_id)
      or (e.kind in ('tenantServices','sharedServiceActivations','bindings','grants') and e.value->>'tenantId'=p.tenant_id))
    order by ordinal`, [db.scope]);
  const values = (kind: string) => result.rows.filter(row => row.kind === kind).map(row => row.value);
  const tenants = values("tenants");
  const byId = new Map(tenants.map(tenant => [tenant.id, tenant]));
  for (const { tenantId, ...service } of values("tenantServices")) byId.get(tenantId)?.services.push(service);
  const activity = await db.pool.query(`select service_id,last_seen_at,last_sync_at from ${db.activity} where scope_id=$1`, [db.scope]);
  const activityById = new Map(activity.rows.map(row => [row.service_id, row]));
  for (const tenant of tenants) for (const service of tenant.services) {
    const row = activityById.get(service.id);
    if (row?.last_seen_at) service.lastSeenAt = row.last_seen_at.toISOString();
    if (row?.last_sync_at) service.lastSyncAt = row.last_sync_at.toISOString();
  }
  return { apps: values("apps").map(app => BetterPortalAppSchema.parse(app)), tenants,
    platformServices: values("platformServices"), sharedServiceCatalog: values("sharedServiceCatalog"),
    sharedServiceActivations: values("sharedServiceActivations"), configManagement: values("settings")[0],
    m2m: { bindings: values("bindings"), grants: values("grants") } };
}

/** Tenant editor needs route choices/counts, but no route options, menus or grants. */
export async function readTenantPage(db: AppDatabase): Promise<DirectoryData> {
  const data = await readDirectory(db);
  const routes = await db.pool.query(`select app_id,id,kind,path,service_id,view_id,title,icon,enabled,operations,position
    from ${db.appData.routes} where scope_id=$1 and app_id=any($2::text[])`, [db.scope, data.apps.map(app => app.id)]);
  db.appData.hydrate(data.apps, { roles: [], grants: [], routes: routes.rows, menus: [] });
  return data;
}
