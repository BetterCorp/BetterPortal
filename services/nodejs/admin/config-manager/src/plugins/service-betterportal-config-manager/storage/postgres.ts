import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import * as yaml from "yaml";
import { BetterPortalConfigSchema, type BetterPortalConfig, type JsonValue } from "@betterportal/framework";
import {
  BaseStorage,
  ConfigRevisionConflictError,
  hashApiKey,
  migrateOfficialPluginIds,
  migrateRouteOperations,
  migrateRouteParamSyntax,
  type PostgresStorageOptions
} from "./core.js";

import { assembleConfig, changedEntityKeys, entityClaims, entityReferences, keyOf, splitConfig, type ConfigEntity, type ConfigEntityRow } from "./entities.js";

interface ConfigSnapshot {
  config: BetterPortalConfig;
  entities: Map<string, ConfigEntity>;
  revisions: Map<string, number>;
}

function quotePgIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export { ConfigRevisionConflictError } from "./core.js";

export type PendingActionKind = "bootstrap" | "setup" | "hostname-change";
/** Completion data fenced by the active lease owner and committed with config changes. */
export interface PendingActionCompletion {
  kind: PendingActionKind;
  key: string;
  /** Lease owner token; stale or expired claims cannot complete the action. */
  owner: string;
  /** Persisted response returned to retries after the action has completed. */
  result: Record<string, unknown>;
}

export interface PendingActionRecord {
  readonly kind: PendingActionKind;
  readonly key: string;
  readonly payload: Record<string, unknown>;
  readonly expiresAt: string;
  readonly status: "pending" | "processing" | "completed";
  readonly result?: Record<string, unknown>;
}

export type PendingActionClaim =
  | { state: "claimed" | "completed"; action: PendingActionRecord }
  | { state: "busy" | "missing" | "expired" };

export interface WebhookDeliveryRecord {
  id: string;
  targetId: string;
  serviceId: string;
  eventId: string;
  tenantId: string;
  appId?: string;
  payload: JsonValue;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  createdAt: string;
  status: "pending" | "delivered" | "failed";
  lastStatus?: number;
  lastError?: string;
}

export interface OutboxRecord {
  readonly id: string;
  readonly delivery: "broadcast" | "event";
  readonly eventName: "platform-config.changed" | "webhook.delivery.available";
  readonly payload: Record<string, unknown>;
}

interface LegacyPaths {
  readonly configPath?: string;
  readonly cpKeyPath?: string;
  readonly webhookDeliveryPath?: string;
}

const SCHEMA_VERSION = 2;

export class PostgresStorage extends BaseStorage {
  readonly backend = "postgres" as const;
  private readonly connectionString: string;
  private readonly tableName: string;
  private readonly quotedTableName: string;
  private readonly rowId: string;
  private readonly migrationsTable: string;
  private readonly identityTable: string;
  private readonly actionsTable: string;
  private readonly deliveriesTable: string;
  private readonly outboxTable: string;
  private readonly activityTable: string;
  private readonly entitiesTable: string;
  private readonly referencesTable: string;
  private readonly revisionSequence: string;
  private activityLoad?: Promise<Map<string, { lastSeenAt?: string; lastSyncAt?: string }>>;
  private activityLoadedAt = 0;
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;
  private legacyPaths: LegacyPaths = {};
  private readonly snapshots = new WeakMap<BetterPortalConfig, ConfigSnapshot>();
  private cachedConfig: ConfigSnapshot | null = null;
  private configLoad: Promise<ConfigSnapshot & { generation: number }> | null = null;
  private configGeneration = 0;
  private credentialIndex?: { config: BetterPortalConfig; entries: Map<string, NonNullable<Awaited<ReturnType<BaseStorage["validateApiKey"]>>>> };

  constructor(options: PostgresStorageOptions) {
    super();
    this.connectionString = options.connectionString;
    this.tableName = options.tableName ?? "bp_platform_config";
    this.quotedTableName = quotePgIdent(this.tableName);
    this.rowId = options.rowId ?? "default";
    this.migrationsTable = quotePgIdent(`${this.tableName}_migrations`);
    this.identityTable = quotePgIdent(`${this.tableName}_identity`);
    this.actionsTable = quotePgIdent(`${this.tableName}_actions`);
    this.deliveriesTable = quotePgIdent(`${this.tableName}_webhook_deliveries`);
    this.outboxTable = quotePgIdent(`${this.tableName}_outbox`);
    this.activityTable = quotePgIdent(`${this.tableName}_activity`);
    this.entitiesTable = quotePgIdent(`${this.tableName}_entities`);
    this.referencesTable = quotePgIdent(`${this.tableName}_references`);
    this.revisionSequence = quotePgIdent(`${this.tableName}_entity_revision`);
  }

  async initialize(paths: LegacyPaths = {}): Promise<void> {
    this.legacyPaths = paths;
    await this.ensureSchema();
  }

  async loadConfig(): Promise<BetterPortalConfig> {
    await this.ensureSchema();
    if (this.cachedConfig) return this.cloneSnapshot(this.cachedConfig);

    const pending = this.configLoad ??= this.readConfig(this.configGeneration);
    try {
      const loaded = await pending;
      if (loaded.generation !== this.configGeneration) {
        if (this.configLoad === pending) this.configLoad = null;
        return this.loadConfig();
      }
      this.cachedConfig = loaded;
      return this.cloneSnapshot(this.cachedConfig);
    } finally {
      if (this.configLoad === pending) this.configLoad = null;
    }
  }

  async saveConfig(config: BetterPortalConfig, options?: { notify?: boolean; completeAction?: PendingActionCompletion }): Promise<void> {
    await this.ensureSchema();
    const baseline = this.snapshots.get(config);
    if (!baseline) throw new Error("Config must be loaded from this store before saving; detached whole-platform replacements are not supported");
    const proposed = splitConfig(this.parseConfig(config));
    // Cached manifests belong to their concrete service registration. Deleting
    // a registration also deletes its known cache, whichever API initiated it.
    for (const [key, entity] of proposed) if (entity.kind === "manifestCache") {
      if (entityReferences(entity, baseline.entities).some(ref => !proposed.has(ref))) proposed.delete(key);
    }
    const changed = changedEntityKeys(baseline.entities, proposed);
    const client = await this.getPool().connect();
    try {
      await client.query("begin");
      if (options?.completeAction) await this.finishAction(client, options.completeAction);
      // Shared dependency locks allow two apps in a tenant to save concurrently.
      // Exclusive locks cover only changed entities and their uniqueness claims.
      const locks = new Map<string, boolean>();
      const dependencies = new Set<string>();
      for (const key of changed) {
        locks.set(key, true);
        for (const entities of [baseline.entities, proposed]) {
          const entity = entities.get(key);
          if (!entity) continue;
          for (const claim of entityClaims(entity)) locks.set(claim, true);
          for (const ref of entityReferences(entity, entities)) {
            dependencies.add(ref);
            if (!locks.has(ref)) locks.set(ref, false);
          }
        }
      }
      for (const [key, exclusive] of [...locks].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        await client.query(`select ${exclusive ? "pg_advisory_xact_lock" : "pg_advisory_xact_lock_shared"}(hashtextextended($1, 0))`,
          [JSON.stringify([this.tableName, this.rowId, key])]);
      }
      const current = await this.readSnapshot(client);
      for (const key of new Set([...changed, ...dependencies])) {
        const expected = baseline.revisions.get(key) ?? 0;
        const actual = current.revisions.get(key) ?? 0;
        if (expected !== actual) {
          this.invalidate();
          throw new ConfigRevisionConflictError(expected, actual, key);
        }
      }
      const merged = new Map(current.entities);
      for (const key of changed) {
        const entity = proposed.get(key);
        if (entity) merged.set(key, entity);
        else merged.delete(key);
      }
      // A sync may have created a cache after the deletion snapshot was loaded.
      // Reject that stale deletion before reaching the FK; a fresh retry includes
      // the cache in its deletion set and locks both records in canonical order.
      for (const entity of merged.values()) if (entity.kind === "manifestCache") {
        const removed = entityReferences(entity, current.entities).find(ref => !merged.has(ref));
        if (removed) {
          this.invalidate();
          throw new ConfigRevisionConflictError(baseline.revisions.get(keyOf(entity)) ?? 0,
            current.revisions.get(keyOf(entity)) ?? 0, keyOf(entity));
        }
      }
      const validated = this.parseConfig(assembleConfig(merged.values()));
      this.validateConfigReferences(validated);
      // Validate uniqueness against the current committed state, under claim locks.
      const claims = new Set<string>();
      for (const entity of merged.values()) for (const claim of entityClaims(entity)) {
        if (claims.has(claim)) throw new Error(`Configuration uniqueness conflict: ${claim}`);
        claims.add(claim);
      }
      const resetActivity: string[] = [];
      const services = new Map(validated.tenants.flatMap(tenant => tenant.services.map(service => [service.id, service] as const)));
      for (const previous of current.config.tenants.flatMap(tenant => tenant.services)) {
        const next = services.get(previous.id);
        if (!next || previous.apiKeyHash !== next.apiKeyHash || previous.hostname !== next.hostname) resetActivity.push(previous.id);
      }
      if (resetActivity.length) await client.query(
        `delete from ${this.activityTable} where scope_id = $1 and service_id = any($2::text[])`, [this.rowId, resetActivity]
      );
      const refreshed = changed.map(key => merged.get(key)).filter(entity => entity?.kind === "manifestCache");
      if (refreshed.length) {
        const clock = await client.query<{ now: Date }>("select clock_timestamp() as now");
        for (const entity of refreshed) entity!.value.fetchedAt = clock.rows[0].now.toISOString();
      }
      for (const key of changed) {
        const entity = merged.get(key) ?? baseline.entities.get(key)!;
        await client.query(`delete from ${this.referencesTable} where scope_id = $1 and kind = $2 and entity_id = $3`,
          [this.rowId, entity.kind, entity.id]);
        if (merged.has(key)) {
          await client.query(`insert into ${this.entitiesTable} (scope_id, kind, entity_id, value, revision)
            values ($1, $2, $3, $4::jsonb, nextval('${this.revisionSequence}'))
            on conflict (scope_id, kind, entity_id) do update set value = excluded.value, revision = excluded.revision`,
          [this.rowId, entity.kind, entity.id, JSON.stringify(entity.value)]);
        } else await client.query(`delete from ${this.entitiesTable} where scope_id = $1 and kind = $2 and entity_id = $3`,
          [this.rowId, entity.kind, entity.id]);
      }
      for (const key of changed) {
        const entity = merged.get(key);
        if (entity) await this.writeReferences(client, entity, merged);
      }
      if (changed.length) {
        const result = await client.query<{ revision: string }>(`select nextval('${this.revisionSequence}') as revision`);
        await this.insertOutbox(client, "broadcast", "platform-config.changed", { revision: Number(result.rows[0].revision) });
      }
      const committed = await this.readSnapshot(client);
      await client.query("commit");
      // Update the caller's baseline as well as its value: subsequent saves must
      // not mistake concurrent edits included in this commit for user deletions.
      Object.assign(config, structuredClone(committed.config));
      this.snapshots.set(config, committed);
      this.invalidate();
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async writeReferences(client: PoolClient, entity: ConfigEntity, entities: Map<string, ConfigEntity>): Promise<void> {
    for (const ref of entityReferences(entity, entities)) {
      const [kind, id] = JSON.parse(ref) as [string, string];
      await client.query(`insert into ${this.referencesTable} (scope_id, kind, entity_id, target_kind, target_id)
        values ($1, $2, $3, $4, $5)`, [this.rowId, entity.kind, entity.id, kind, id]);
    }
  }

  override invalidate(): void {
    this.configGeneration++;
    this.cachedConfig = null;
    this.activityLoad = undefined;
    super.invalidate();
  }

  override async validateApiKey(apiKey: string): ReturnType<BaseStorage["validateApiKey"]> {
    await this.ensureSchema();
    if (!this.cachedConfig) await this.loadConfig();
    if (!this.cachedConfig) return this.validateApiKey(apiKey);
    const config = this.cachedConfig.config;
    if (this.credentialIndex?.config !== config) {
      const entries: NonNullable<PostgresStorage["credentialIndex"]>["entries"] = new Map();
      for (const service of [...config.platformServices, ...config.sharedServiceCatalog]) {
        if (service.enabled && service.apiKeyHash) entries.set(service.apiKeyHash, { scope: "platform", serviceId: service.id, service });
      }
      for (const tenant of config.tenants.filter(tenant => tenant.active)) for (const service of tenant.services) {
        if (service.enabled && service.apiKeyHash) entries.set(service.apiKeyHash, { scope: "tenant", tenantId: tenant.id, serviceId: service.id, service });
      }
      this.credentialIndex = { config, entries };
    }
    return structuredClone(this.credentialIndex.entries.get(hashApiKey(apiKey)) ?? null);
  }

  private async readSnapshot(connection: Pick<Pool, "query"> | PoolClient): Promise<ConfigSnapshot> {
    const result = await connection.query<ConfigEntityRow & { entity_id: string }>(
      `select kind, entity_id, value, revision from ${this.entitiesTable} where scope_id = $1 order by ordinal`, [this.rowId]
    );
    if (!result.rows.some(row => row.kind === "settings")) throw new Error(`Config scope ${this.rowId} was not initialized`);
    const rows = result.rows.map(row => ({ ...row, id: row.entity_id }));
    const previewConfigs = new Set(rows.filter(row => row.kind === "previewConfigs").map(row => row.id));
    for (const row of rows) if (row.kind === "previewEnvironmentDeployments" && !previewConfigs.has(row.id)) {
      throw new Error(`Persisted preview ${row.id} is missing its effective configuration`);
    }
    const config = this.parseConfig(assembleConfig(rows));
    return { config, entities: splitConfig(config), revisions: new Map(rows.map(row => [keyOf(row), Number(row.revision)])) };
  }

  private async readConfig(generation: number): Promise<ConfigSnapshot & { generation: number }> {
    return { ...await this.readSnapshot(this.getPool()), generation };
  }

  private async cloneSnapshot(snapshot: ConfigSnapshot): Promise<BetterPortalConfig> {
    const config = structuredClone(snapshot.config);
    this.snapshots.set(config, snapshot);
    const activity = await this.loadServiceActivity();
    for (const tenant of config.tenants) for (const service of tenant.services) {
      Object.assign(service, activity.get(service.id));
    }
    return config;
  }

  async close(): Promise<void> { await this.pool?.end(); }

  async touchServiceActivity(serviceId: string, field: "lastSeenAt" | "lastSyncAt"): Promise<void> {
    await this.ensureSchema();
    const column = field === "lastSeenAt" ? "last_seen_at" : "last_sync_at";
    await this.getPool().query(
      `insert into ${this.activityTable} (scope_id, service_id, ${column}) values ($1, $2, now())
       on conflict (scope_id, service_id) do update set ${column} = excluded.${column}
       ${field === "lastSeenAt" ? `where ${this.activityTable}.${column} is null or ${this.activityTable}.${column} < now() - interval '60 seconds'` : ""}`,
      [this.rowId, serviceId]
    );
  }

  private loadServiceActivity(): Promise<Map<string, { lastSeenAt?: string; lastSyncAt?: string }>> {
    if (this.activityLoad && Date.now() - this.activityLoadedAt < 5000) return this.activityLoad;
    this.activityLoadedAt = Date.now();
    this.activityLoad = this.getPool().query<{ service_id: string; last_seen_at: Date | null; last_sync_at: Date | null }>(
      `select service_id, last_seen_at, last_sync_at from ${this.activityTable} where scope_id = $1`, [this.rowId]
    ).then(result => new Map(result.rows.map(row => [row.service_id, {
      ...(row.last_seen_at ? { lastSeenAt: row.last_seen_at.toISOString() } : {}),
      ...(row.last_sync_at ? { lastSyncAt: row.last_sync_at.toISOString() } : {})
    }]))).catch(error => { this.activityLoad = undefined; throw error; });
    return this.activityLoad;
  }

  async loadOrCreateIdentity<T extends object>(create: () => T): Promise<T> {
    await this.ensureSchema();
    const existing = await this.getPool().query<{ identity: T }>(
      `select identity from ${this.identityTable} where scope_id = $1`, [this.rowId]
    );
    if (existing.rows[0]) return existing.rows[0].identity;
    const candidate = create();
    await this.getPool().query(
      `insert into ${this.identityTable} (scope_id, identity) values ($1, $2::jsonb) on conflict (scope_id) do nothing`,
      [this.rowId, JSON.stringify(candidate)]
    );
    const result = await this.getPool().query<{ identity: T }>(
      `select identity from ${this.identityTable} where scope_id = $1`, [this.rowId]
    );
    if (!result.rows[0]) throw new Error("Control-plane identity was not initialized");
    return result.rows[0].identity;
  }

  async createPendingAction(input: {
    kind: PendingActionKind;
    key: string;
    secretHash: string;
    payload: Record<string, unknown>;
    expiresAt: string;
  }): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.getPool().query(
      `insert into ${this.actionsTable} (scope_id, kind, action_key, secret_hash, payload, expires_at)
       values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
       on conflict (scope_id, kind, action_key) do update
         set secret_hash = excluded.secret_hash, payload = excluded.payload, expires_at = excluded.expires_at,
             status = 'pending', result = null, lease_owner = null, lease_until = null, created_at = now()
       where ${this.actionsTable}.expires_at <= now()`,
      [this.rowId, input.kind, input.key, input.secretHash, JSON.stringify(input.payload), input.expiresAt]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isPendingActionAvailable(kind: PendingActionKind, key: string): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.getPool().query(
      `select 1 from ${this.actionsTable}
        where scope_id = $1 and kind = $2 and action_key = $3 and status <> 'completed' and expires_at > now()`,
      [this.rowId, kind, key]
    );
    return result.rows.length > 0;
  }

  async claimPendingAction(input: {
    kind: PendingActionKind;
    key: string;
    secretHash: string;
    owner: string;
    leaseMs?: number;
  }): Promise<PendingActionClaim> {
    await this.ensureSchema();
    const client = await this.getPool().connect();
    try {
      await client.query("begin");
      const result = await client.query<{
        payload: Record<string, unknown>;
        expires_at: Date;
        status: PendingActionRecord["status"];
        result: Record<string, unknown> | null;
        lease_until: Date | null;
      }>(
        `select payload, expires_at, status, result, lease_until from ${this.actionsTable}
          where scope_id = $1 and kind = $2 and action_key = $3 and secret_hash = $4 for update`,
        [this.rowId, input.kind, input.key, input.secretHash]
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("commit");
        return { state: "missing" };
      }
      if (row.expires_at.getTime() <= Date.now()) {
        await client.query(
          `delete from ${this.actionsTable} where scope_id = $1 and kind = $2 and action_key = $3`,
          [this.rowId, input.kind, input.key]
        );
        await client.query("commit");
        return { state: "expired" };
      }
      const action: PendingActionRecord = {
        kind: input.kind,
        key: input.key,
        payload: row.payload,
        expiresAt: row.expires_at.toISOString(),
        status: row.status,
        ...(row.result ? { result: row.result } : {})
      };
      if (row.status === "completed") {
        await client.query("commit");
        return { state: "completed", action };
      }
      if (row.status === "processing" && row.lease_until && row.lease_until.getTime() > Date.now()) {
        await client.query("commit");
        return { state: "busy" };
      }
      await client.query(
        `update ${this.actionsTable} set status = 'processing', lease_owner = $4,
             lease_until = now() + ($5::int * interval '1 millisecond')
          where scope_id = $1 and kind = $2 and action_key = $3`,
        [this.rowId, input.kind, input.key, input.owner, input.leaseMs ?? 30_000]
      );
      await client.query("commit");
      return { state: "claimed", action: { ...action, status: "processing" } };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async completePendingAction(input: PendingActionCompletion, config?: BetterPortalConfig): Promise<void> {
    if (config) return this.saveConfig(config, { completeAction: input });
    await this.ensureSchema();
    const client = await this.getPool().connect();
    try { await this.finishAction(client, input); } finally { client.release(); }
  }

  private async finishAction(client: PoolClient, input: PendingActionCompletion): Promise<void> {
    const updated = await client.query(
      `update ${this.actionsTable} set status = 'completed', result = $5::jsonb,
          lease_owner = null, lease_until = null
        where scope_id = $1 and kind = $2 and action_key = $3 and lease_owner = $4
          and status = 'processing' and lease_until > now() and expires_at > now()`,
      [this.rowId, input.kind, input.key, input.owner, JSON.stringify(input.result)]
    );
    if (updated.rowCount !== 1) throw new Error("Pending action lease was lost");
  }

  async releasePendingAction(kind: PendingActionKind, key: string, owner: string): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `update ${this.actionsTable} set status = 'pending', lease_owner = null, lease_until = null
        where scope_id = $1 and kind = $2 and action_key = $3 and lease_owner = $4 and status = 'processing'`,
      [this.rowId, kind, key, owner]
    );
  }

  async enqueueWebhookDeliveries(records: WebhookDeliveryRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.ensureSchema();
    const client = await this.getPool().connect();
    try {
      await client.query("begin");
      for (const record of records) await this.insertWebhookDelivery(client, record);
      await this.insertOutbox(client, "event", "webhook.delivery.available", {});
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimWebhookDeliveries(owner: string, limit = 25, leaseMs = 60_000): Promise<WebhookDeliveryRecord[]> {
    await this.ensureSchema();
    const result = await this.getPool().query<{
      id: string; target_id: string; service_id: string; event_id: string; tenant_id: string; app_id: string | null;
      payload: JsonValue; attempts: number; max_attempts: number; next_attempt_at: Date; created_at: Date;
      status: WebhookDeliveryRecord["status"]; last_status: number | null; last_error: string | null;
    }>(
      `with due as (
         select id from ${this.deliveriesTable}
          where scope_id = $1 and status = 'pending' and next_attempt_at <= now()
            and (lease_until is null or lease_until <= now())
          order by next_attempt_at, created_at for update skip locked limit $3
       )
       update ${this.deliveriesTable} d
          set lease_owner = $2, lease_until = now() + ($4::int * interval '1 millisecond')
         from due where d.scope_id = $1 and d.id = due.id returning d.*`,
      [this.rowId, owner, limit, leaseMs]
    );
    return result.rows.map((row) => ({
      id: row.id,
      targetId: row.target_id,
      serviceId: row.service_id,
      eventId: row.event_id,
      tenantId: row.tenant_id,
      ...(row.app_id ? { appId: row.app_id } : {}),
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.next_attempt_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      status: row.status,
      ...(row.last_status === null ? {} : { lastStatus: row.last_status }),
      ...(row.last_error === null ? {} : { lastError: row.last_error })
    }));
  }

  async finishWebhookDelivery(owner: string, record: WebhookDeliveryRecord): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `update ${this.deliveriesTable} set attempts = $4, next_attempt_at = $5::timestamptz,
          status = $6, last_status = $7, last_error = $8, lease_owner = null, lease_until = null
        where scope_id = $1 and id = $2 and lease_owner = $3`,
      [this.rowId, record.id, owner, record.attempts, record.nextAttemptAt, record.status,
        record.lastStatus ?? null, record.lastError ?? null]
    );
  }

  async cleanupWebhookDeliveries(): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `delete from ${this.deliveriesTable}
        where scope_id = $1 and status <> 'pending' and created_at < now() - interval '7 days'`,
      [this.rowId]
    );
  }

  async cleanupExpiredActions(): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `delete from ${this.actionsTable} where scope_id = $1 and expires_at <= now()`,
      [this.rowId]
    );
  }

  async tryRunExclusive(name: string, run: () => Promise<void>): Promise<boolean> {
    await this.ensureSchema();
    const client = await this.getPool().connect();
    const lockName = `${this.tableName}:${this.rowId}:${name}`;
    try {
      const result = await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [lockName]);
      if (!result.rows[0]?.locked) return false;
      try {
        await run();
        return true;
      } finally {
        await client.query("select pg_advisory_unlock(hashtext($1))", [lockName]);
      }
    } finally {
      client.release();
    }
  }

  async claimOutbox(owner: string, limit = 25, leaseMs = 30_000): Promise<OutboxRecord[]> {
    await this.ensureSchema();
    const result = await this.getPool().query<{
      id: string; delivery: OutboxRecord["delivery"]; event_name: OutboxRecord["eventName"];
      payload: Record<string, unknown>;
    }>(
      `with due as (
         select id from ${this.outboxTable}
          where scope_id = $1 and available_at <= now() and (lease_until is null or lease_until <= now())
          order by created_at for update skip locked limit $3
       )
       update ${this.outboxTable} o
          set lease_owner = $2, lease_until = now() + ($4::int * interval '1 millisecond'), attempts = attempts + 1
         from due where o.scope_id = $1 and o.id = due.id
       returning o.id, o.delivery, o.event_name, o.payload`,
      [this.rowId, owner, limit, leaseMs]
    );
    return result.rows.map((row) => ({ id: row.id, delivery: row.delivery, eventName: row.event_name, payload: row.payload }));
  }

  async completeOutbox(id: string, owner: string): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `delete from ${this.outboxTable} where scope_id = $1 and id = $2 and lease_owner = $3`,
      [this.rowId, id, owner]
    );
  }

  async releaseOutbox(id: string, owner: string, retryMs = 1_000): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `update ${this.outboxTable} set lease_owner = null, lease_until = null,
          available_at = now() + ($4::int * interval '1 millisecond')
        where scope_id = $1 and id = $2 and lease_owner = $3`,
      [this.rowId, id, owner, retryMs]
    );
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
    await this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  private parseConfig(value: unknown): BetterPortalConfig {
    return this.canonicalizeConfig(migrateRouteParamSyntax(
      BetterPortalConfigSchema.parse(migrateRouteOperations(migrateOfficialPluginIds(value)))
    ));
  }

  private getPool(): Pool {
    this.pool ??= new Pool({ connectionString: this.connectionString });
    return this.pool;
  }

  private ensureSchema(): Promise<void> {
    this.schemaReady ??= this.migrate();
    return this.schemaReady;
  }

  private async migrate(): Promise<void> {
    const client = await this.getPool().connect();
    const lockName = `${this.tableName}:migrations`;
    try {
      await client.query("select pg_advisory_lock(hashtext($1))", [lockName]);
      await client.query("begin");
      await client.query(`create table if not exists ${this.migrationsTable} (
        scope_id text not null, version integer not null, applied_at timestamptz not null default now(),
        primary key (scope_id, version))`);
      await client.query(`create table if not exists ${this.quotedTableName} (
        id text primary key, config jsonb not null, revision bigint not null default 0,
        updated_at timestamptz not null default now())`);
      await client.query(`alter table ${this.quotedTableName} add column if not exists revision bigint not null default 0`);
      await client.query(`create table if not exists ${this.identityTable} (
        scope_id text primary key, identity jsonb not null, created_at timestamptz not null default now())`);
      await client.query(`create table if not exists ${this.activityTable} (
        scope_id text not null, service_id text not null, last_seen_at timestamptz, last_sync_at timestamptz,
        primary key (scope_id, service_id))`);
      await client.query(`create table if not exists ${this.actionsTable} (
        scope_id text not null, kind text not null, action_key text not null, secret_hash text not null,
        payload jsonb not null, expires_at timestamptz not null, status text not null default 'pending',
        result jsonb, lease_owner text, lease_until timestamptz, created_at timestamptz not null default now(),
        primary key (scope_id, kind, action_key))`);
      await client.query(`create table if not exists ${this.deliveriesTable} (
        scope_id text not null, id text not null, target_id text not null, service_id text not null,
        event_id text not null, tenant_id text not null, app_id text, payload jsonb not null,
        attempts integer not null, max_attempts integer not null, next_attempt_at timestamptz not null,
        created_at timestamptz not null, status text not null, last_status integer, last_error text,
        lease_owner text, lease_until timestamptz, primary key (scope_id, id))`);
      await client.query(`create index if not exists ${quotePgIdent(`${this.tableName}_webhook_due_idx`)}
        on ${this.deliveriesTable} (scope_id, status, next_attempt_at)`);
      await client.query(`create table if not exists ${this.outboxTable} (
        scope_id text not null, id text not null, delivery text not null, event_name text not null,
        payload jsonb not null, attempts integer not null default 0, available_at timestamptz not null default now(),
        lease_owner text, lease_until timestamptz, created_at timestamptz not null default now(),
        primary key (scope_id, id))`);
      const applied = await client.query(
        `select 1 from ${this.migrationsTable} where scope_id = $1 and version = $2`,
        [this.rowId, 1]
      );
      if (applied.rows.length === 0) {
        await this.importLegacyFiles(client);
        await client.query(
          `insert into ${this.migrationsTable} (scope_id, version) values ($1, $2)`,
          [this.rowId, 1]
        );
      }
      await this.migrateEntities(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => undefined);
      client.release();
    }
  }

  private async migrateEntities(client: PoolClient): Promise<void> {
    await client.query(`create sequence if not exists ${this.revisionSequence}`);
    await client.query(`create table if not exists ${this.entitiesTable} (
      scope_id text not null, kind text not null, entity_id text not null, value jsonb not null,
      revision bigint not null, ordinal bigint generated always as identity,
      primary key (scope_id, kind, entity_id), check (jsonb_typeof(value) = 'object'))`);
    await client.query(`create table if not exists ${this.referencesTable} (
      scope_id text not null, kind text not null, entity_id text not null, target_kind text not null, target_id text not null,
      primary key (scope_id, kind, entity_id, target_kind, target_id),
      foreign key (scope_id, kind, entity_id) references ${this.entitiesTable} (scope_id, kind, entity_id) deferrable initially deferred,
      foreign key (scope_id, target_kind, target_id) references ${this.entitiesTable} (scope_id, kind, entity_id) deferrable initially deferred)`);
    await client.query(`create index if not exists ${quotePgIdent(`${this.tableName}_ref_target_idx`)}
      on ${this.referencesTable} (scope_id, target_kind, target_id)`);
    const applied = await client.query(`select 1 from ${this.migrationsTable} where scope_id = $1 and version = $2`, [this.rowId, SCHEMA_VERSION]);
    if (applied.rows.length) return;
    // Row lock waits for in-flight legacy saves. The trigger below fences later
    // old-binary writes; the frozen row is retained as a migration backup.
    const source = await client.query<{ config: unknown }>(`select config from ${this.quotedTableName} where id = $1 for update`, [this.rowId]);
    if (!source.rows[0]) throw new Error("Legacy configuration is missing");
    const config = this.parseConfig(source.rows[0].config);
    this.validateConfigReferences(config);
    const entities = splitConfig(config);
    const claims = new Set<string>();
    for (const entity of entities.values()) for (const claim of entityClaims(entity)) {
      if (claims.has(claim)) throw new Error(`Cannot migrate duplicate configuration claim: ${claim}`);
      claims.add(claim);
    }
    for (const tenant of config.tenants) for (const service of tenant.services) {
      if (!service.lastSeenAt && !service.lastSyncAt) continue;
      await client.query(`insert into ${this.activityTable} (scope_id, service_id, last_seen_at, last_sync_at)
        values ($1, $2, $3, $4) on conflict (scope_id, service_id) do update set
        last_seen_at = greatest(${this.activityTable}.last_seen_at, excluded.last_seen_at),
        last_sync_at = greatest(${this.activityTable}.last_sync_at, excluded.last_sync_at)`,
      [this.rowId, service.id, service.lastSeenAt ?? null, service.lastSyncAt ?? null]);
    }
    for (const entity of entities.values()) await client.query(
      `insert into ${this.entitiesTable} (scope_id, kind, entity_id, value, revision) values ($1, $2, $3, $4::jsonb, nextval('${this.revisionSequence}'))`,
      [this.rowId, entity.kind, entity.id, JSON.stringify(entity.value)]);
    for (const entity of entities.values()) await this.writeReferences(client, entity, entities);
    const restored = await this.readSnapshot(client);
    if (changedEntityKeys(entities, restored.entities).length) throw new Error("Config entity migration verification failed");
    const fence = quotePgIdent(`${this.tableName}_legacy_write_fence`);
    await client.query(`create or replace function ${fence}() returns trigger language plpgsql as $body$
      begin
        if exists (select 1 from ${this.migrationsTable} where scope_id = OLD.id and version = 2) then
          raise exception 'Config storage migrated to independent entities; upgrade all config-manager replicas';
        end if;
        if TG_OP = 'DELETE' then return OLD; end if;
        return NEW;
      end $body$`);
    await client.query(`drop trigger if exists legacy_write_fence on ${this.quotedTableName}`);
    await client.query(`create trigger legacy_write_fence before update or delete on ${this.quotedTableName}
      for each row execute function ${fence}()`);
    await client.query(`insert into ${this.migrationsTable} (scope_id, version) values ($1, $2)`, [this.rowId, SCHEMA_VERSION]);
  }

  private async importLegacyFiles(client: PoolClient): Promise<void> {
    const existingConfig = await client.query(`select 1 from ${this.quotedTableName} where id = $1`, [this.rowId]);
    if (existingConfig.rows.length === 0) {
      const configPath = this.legacyPaths.configPath ? resolve(this.legacyPaths.configPath) : undefined;
      const initial = configPath && existsSync(configPath)
        ? this.parseConfig(yaml.parse(readFileSync(configPath, "utf8")))
        : this.parseConfig({});
      await client.query(
        `insert into ${this.quotedTableName} (id, config, revision) values ($1, $2::jsonb, 0)`,
        [this.rowId, JSON.stringify(initial)]
      );
    }

    const identityPath = this.legacyPaths.cpKeyPath ? resolve(this.legacyPaths.cpKeyPath) : undefined;
    if (identityPath && existsSync(identityPath)) {
      const identity = JSON.parse(readFileSync(identityPath, "utf8")) as Record<string, unknown>;
      await client.query(
        `insert into ${this.identityTable} (scope_id, identity) values ($1, $2::jsonb)
         on conflict (scope_id) do nothing`, [this.rowId, JSON.stringify(identity)]
      );
    }

    const deliveryPath = this.legacyPaths.webhookDeliveryPath ? resolve(this.legacyPaths.webhookDeliveryPath) : undefined;
    if (deliveryPath && existsSync(deliveryPath)) {
      const parsed = JSON.parse(readFileSync(deliveryPath, "utf8"));
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (!value || typeof value !== "object") continue;
          const record = value as WebhookDeliveryRecord;
          if (record.id && record.targetId && record.serviceId && record.eventId && record.tenantId) {
            await this.insertWebhookDelivery(client, record);
          }
        }
      }
    }
  }

  private async insertWebhookDelivery(client: PoolClient, record: WebhookDeliveryRecord): Promise<void> {
    await client.query(
      `insert into ${this.deliveriesTable}
         (scope_id, id, target_id, service_id, event_id, tenant_id, app_id, payload,
          attempts, max_attempts, next_attempt_at, created_at, status, last_status, last_error)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::timestamptz,
               $12::timestamptz, $13, $14, $15) on conflict (scope_id, id) do nothing`,
      [this.rowId, record.id, record.targetId, record.serviceId, record.eventId, record.tenantId,
        record.appId ?? null, JSON.stringify(record.payload), record.attempts, record.maxAttempts,
        record.nextAttemptAt, record.createdAt, record.status, record.lastStatus ?? null, record.lastError ?? null]
    );
  }

  private async insertOutbox(
    client: PoolClient,
    delivery: OutboxRecord["delivery"],
    eventName: OutboxRecord["eventName"],
    payload: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `insert into ${this.outboxTable} (scope_id, id, delivery, event_name, payload)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [this.rowId, randomUUID(), delivery, eventName, JSON.stringify(payload)]
    );
  }
}
