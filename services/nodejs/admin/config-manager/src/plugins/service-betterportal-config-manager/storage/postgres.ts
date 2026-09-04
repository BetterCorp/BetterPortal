import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import * as yaml from "yaml";
import { BetterPortalConfigSchema, type BetterPortalConfig, type JsonValue } from "@betterportal/framework";
import {
  BaseStorage,
  migrateOfficialPluginIds,
  migrateRouteOperations,
  migrateRouteParamSyntax,
  type PostgresStorageOptions
} from "./core.js";

function quotePgIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export class ConfigRevisionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Platform config changed concurrently (loaded revision ${expected}, current revision ${actual})`);
    this.name = "ConfigRevisionConflictError";
  }
}

export type PendingActionKind = "bootstrap" | "setup" | "hostname-change";

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

const SCHEMA_VERSION = 1;

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
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;
  private legacyPaths: LegacyPaths = {};
  private readonly snapshots = new WeakMap<BetterPortalConfig, number>();
  private cachedConfig: { config: BetterPortalConfig; revision: number } | null = null;
  private configLoad: Promise<{ config: BetterPortalConfig; revision: number; generation: number }> | null = null;
  private configGeneration = 0;

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
      this.cachedConfig = { config: loaded.config, revision: loaded.revision };
      return this.cloneSnapshot(this.cachedConfig);
    } finally {
      if (this.configLoad === pending) this.configLoad = null;
    }
  }

  async saveConfig(config: BetterPortalConfig, options?: { notify?: boolean }): Promise<void> {
    await this.ensureSchema();
    const validated = this.parseConfig(config);
    this.validateConfigReferences(validated);
    const expectedRevision = this.snapshots.get(config);
    const client = await this.getPool().connect();
    try {
      await client.query("begin");
      const current = await client.query<{ revision: string | number }>(
        `select revision from ${this.quotedTableName} where id = $1 for update`, [this.rowId]
      );
      if (!current.rows[0]) throw new Error(`Platform config row ${this.rowId} was not initialized`);
      const currentRevision = Number(current.rows[0].revision);
      if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
        throw new ConfigRevisionConflictError(expectedRevision, currentRevision);
      }
      const revision = currentRevision + 1;
      await client.query(
        `update ${this.quotedTableName} set config = $2::jsonb, revision = $3, updated_at = now() where id = $1`,
        [this.rowId, JSON.stringify(validated), revision]
      );
      if (options?.notify !== false) await this.insertOutbox(client, "broadcast", "platform-config.changed", { revision });
      await client.query("commit");
      this.snapshots.set(config, revision);
      this.snapshots.set(validated, revision);
      this.configGeneration++;
      this.cachedConfig = { config: structuredClone(validated), revision };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  override invalidate(): void {
    this.configGeneration++;
    this.cachedConfig = null;
    super.invalidate();
  }

  private async readConfig(generation: number): Promise<{ config: BetterPortalConfig; revision: number; generation: number }> {
    const result = await this.getPool().query<{ config: unknown; revision: string | number }>(
      `select config, revision from ${this.quotedTableName} where id = $1`, [this.rowId]
    );
    if (!result.rows[0]) throw new Error(`Platform config row ${this.rowId} was not initialized`);
    return {
      config: this.parseConfig(result.rows[0].config),
      revision: Number(result.rows[0].revision),
      generation
    };
  }

  private cloneSnapshot(snapshot: { config: BetterPortalConfig; revision: number }): BetterPortalConfig {
    const config = structuredClone(snapshot.config);
    this.snapshots.set(config, snapshot.revision);
    return config;
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

  async completePendingAction(input: {
    kind: PendingActionKind;
    key: string;
    owner: string;
    result: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureSchema();
    await this.getPool().query(
      `update ${this.actionsTable} set status = 'completed', result = $5::jsonb,
          lease_owner = null, lease_until = null
        where scope_id = $1 and kind = $2 and action_key = $3 and lease_owner = $4`,
      [this.rowId, input.kind, input.key, input.owner, JSON.stringify(input.result)]
    );
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
    const lockName = `${this.tableName}:${this.rowId}:migrations`;
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
        [this.rowId, SCHEMA_VERSION]
      );
      if (applied.rows.length === 0) {
        await this.importLegacyFiles(client);
        await client.query(
          `insert into ${this.migrationsTable} (scope_id, version) values ($1, $2)`,
          [this.rowId, SCHEMA_VERSION]
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => undefined);
      client.release();
    }
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
