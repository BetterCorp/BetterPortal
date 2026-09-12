import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, openSync, closeSync, fsyncSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Pool, type PoolClient } from "pg";

export interface Scope { tenantId: string; appId: string }
export interface RecordValue { id: string; [key: string]: unknown }
export interface StoredRecord { kind: string; scope: Scope; value: RecordValue }
interface PageOptions { after?: string; limit?: number; descending?: boolean }
export interface AuthTransaction {
  get<T extends RecordValue>(kind: string, id: string, scope: Scope): Promise<T | undefined>;
  list<T extends RecordValue>(kind: string, scope?: Scope): Promise<T[]>;
  page<T extends RecordValue>(kind: string, scope: Scope, options?: PageOptions): Promise<T[]>;
  dueMail<T extends RecordValue>(now: number, limit: number): Promise<T[]>;
  put(kind: string, scope: Scope, value: RecordValue): Promise<void>;
  remove(kind: string, id: string, scope: Scope): Promise<void>;
}
export interface AuthStorage {
  readonly mode: "simple" | "advanced";
  transaction<T>(scope: Scope, work: (tx: AuthTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
interface FileData { version: 2; records: StoredRecord[] }
const key = (kind: string, id: string, scope: Scope) => JSON.stringify([scope.tenantId, scope.appId, kind, id]);
const sameScope = (a: Scope, b: Scope) => a.tenantId === b.tenantId && a.appId === b.appId;

/** Atomic replace includes a directory fsync so a completed write survives restart. */
export function atomicWrite(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temp, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(data)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
  const dir = openSync(dirname(path), "r");
  try { fsyncSync(dir); } finally { closeSync(dir); }
}

function validateRecords(data: unknown): FileData {
  if (!data || typeof data !== "object") throw new Error("Invalid auth store");
  const file = data as FileData;
  if (file.version !== 2 || !Array.isArray(file.records)) throw new Error("Unsupported auth store version");
  const seen = new Set<string>();
  for (const row of file.records) {
    if (!row || typeof row.kind !== "string" || !row.scope || typeof row.scope.tenantId !== "string"
      || typeof row.scope.appId !== "string" || !row.value || typeof row.value.id !== "string") throw new Error("Malformed auth record");
    const id = key(row.kind, row.value.id, row.scope);
    if (seen.has(id)) throw new Error("Duplicate auth record");
    seen.add(id);
  }
  return file;
}

/** Only a demonstrably dead writer on this host may be recovered automatically. */
function lockFile(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const processStart = (pid: number): string | undefined => {
    try { return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[19]; } catch { return undefined; }
  };
  const owner = JSON.stringify({ pid: process.pid, host: hostname(), start: processStart(process.pid), nonce: randomUUID() });
  const acquire = () => {
    const fd = openSync(lock, "wx", 0o600);
    try { writeFileSync(fd, owner); fsyncSync(fd); } finally { closeSync(fd); }
  };
  try { acquire(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const recovery = `${lock}.recover`;
    let recoveryFd: number;
    try { recoveryFd = openSync(recovery, "wx", 0o600); }
    catch { throw new Error(`Auth lock recovery is already active; verify ownership of ${recovery}`); }
    try {
    const previous = readFileSync(lock, "utf8");
    let dead = false;
    try {
      const record = JSON.parse(previous);
      if (record.host === hostname() && Number.isInteger(record.pid) && record.pid > 0) {
        try { process.kill(record.pid, 0); } catch (failure) { dead = (failure as NodeJS.ErrnoException).code === "ESRCH"; }
        const start = processStart(record.pid);
        if (record.start && start && record.start !== start) dead = true;
      }
    } catch { /* Ambiguous ownership requires operator recovery. */ }
    if (!dead || readFileSync(lock, "utf8") !== previous) throw new Error(`Auth store already has an owner; verify the previous process stopped before removing ${lock}`, { cause: error });
    unlinkSync(lock);
    acquire(); // An intervening new owner wins; never steal its lock.
    } finally { closeSync(recoveryFd); unlinkSync(recovery); }
  }
  return () => { if (existsSync(lock) && readFileSync(lock, "utf8") === owner) unlinkSync(lock); };
}

export class JsonAuthStorage implements AuthStorage {
  readonly mode = "simple" as const;
  private data: FileData;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly release: () => void;
  private closed = false;
  private closing = false;

  constructor(readonly path: string) {
    const marker = `${path}.mode.json`;
    if (existsSync(marker)) throw new Error("This installation requires Advanced mode; Simple downgrade is unsupported");
    this.release = lockFile(path);
    try {
      this.data = existsSync(path) ? validateRecords(JSON.parse(readFileSync(path, "utf8"))) : { version: 2, records: [] };
      if (new Set(this.data.records.filter(r => r.kind === "user").map(r => r.scope.tenantId)).size > 1) throw new Error("Simple auth supports one tenant; select Advanced mode");
    } catch (error) { this.release(); throw error; }
  }

  transaction<T>(_scope: Scope, work: (tx: AuthTransaction) => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error("Auth store is closed"));
    const run = this.tail.then(async () => {
      if (this.closed) throw new Error("Auth store is closed");
      const draft = structuredClone(this.data);
      let dirty = false;
      const result = await work({
        get: async <R extends RecordValue>(kind: string, id: string, scope: Scope) => structuredClone(draft.records.find(row => key(row.kind, row.value.id, row.scope) === key(kind, id, scope))?.value as R | undefined),
        list: async <R extends RecordValue>(kind: string, scope?: Scope) => structuredClone(draft.records.filter(row => row.kind === kind && (!scope || sameScope(row.scope, scope))).map(row => row.value as R)),
        dueMail: async <R extends RecordValue>(now: number, limit: number) => structuredClone(draft.records.filter(row => row.kind === "mail" && ["pending", "sending"].includes(String(row.value.state)) && Number(row.value.nextAttempt) <= now)
          .sort((a, b) => Number(a.value.nextAttempt) - Number(b.value.nextAttempt) || a.value.id.localeCompare(b.value.id)).slice(0, Math.max(1, Math.min(100, limit))).map(row => row.value as R)),
        page: async <R extends RecordValue>(kind: string, scope: Scope, options: PageOptions = {}) => structuredClone(draft.records.filter(row => row.kind === kind && sameScope(row.scope, scope)).map(row => row.value as R)
          .filter(row => !options.after || (options.descending ? row.id < options.after : row.id > options.after))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) * (options.descending ? -1 : 1)).slice(0, Math.max(1, Math.min(501, options.limit ?? 100)))),
        put: async (kind, scope, value) => {
          const i = draft.records.findIndex(row => key(row.kind, row.value.id, row.scope) === key(kind, value.id, scope));
          const row = structuredClone({ kind, scope, value });
          if (i < 0) draft.records.push(row); else draft.records[i] = row;
          dirty = true;
        },
        remove: async (kind, id, scope) => { draft.records = draft.records.filter(row => key(row.kind, row.value.id, row.scope) !== key(kind, id, scope)); dirty = true; }
      });
      if (dirty) { atomicWrite(this.path, draft); this.data = draft; }
      return result;
    });
    this.tail = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> { this.closing = true; await this.tail; if (!this.closed) { this.closed = true; this.release(); } }
}

function pgTransaction(client: PoolClient, installationId: string): AuthTransaction {
  return {
    get: async <T extends RecordValue>(kind: string, id: string, scope: Scope) => {
      const r = await client.query("SELECT value FROM bp_auth_records WHERE installation=$1 AND tenant=$2 AND app=$3 AND kind=$4 AND id=$5", [installationId, scope.tenantId, scope.appId, kind, id]);
      return r.rows[0]?.value as T | undefined;
    },
    list: async <T extends RecordValue>(kind: string, scope?: Scope) => {
      const r = scope
        ? await client.query("SELECT value FROM bp_auth_records WHERE installation=$1 AND tenant=$2 AND app=$3 AND kind=$4 ORDER BY id", [installationId, scope.tenantId, scope.appId, kind])
        : await client.query("SELECT value FROM bp_auth_records WHERE installation=$1 AND kind=$2 ORDER BY tenant,app,id", [installationId, kind]);
      return r.rows.map(row => row.value as T);
    },
    page: async <T extends RecordValue>(kind: string, scope: Scope, options: PageOptions = {}) => {
      const comparison = options.descending ? "<" : ">"; const order = options.descending ? "DESC" : "ASC";
      const result = await client.query(`SELECT value FROM bp_auth_records WHERE installation=$1 AND tenant=$2 AND app=$3 AND kind=$4 AND ($5::text IS NULL OR id ${comparison} $5) ORDER BY id ${order} LIMIT $6`, [installationId, scope.tenantId, scope.appId, kind, options.after || null, Math.max(1, Math.min(501, options.limit ?? 100))]);
      return result.rows.map(row => row.value as T);
    },
    dueMail: async <T extends RecordValue>(now: number, limit: number) => {
      const result = await client.query("SELECT value FROM bp_auth_records WHERE installation=$1 AND kind='mail' AND value->>'state' IN ('pending','sending') AND (value->>'nextAttempt')::bigint <= $2 ORDER BY (value->>'nextAttempt')::bigint,id LIMIT $3", [installationId, now, Math.max(1, Math.min(100, limit))]);
      return result.rows.map(row => row.value as T);
    },
    put: async (kind, scope, value) => {
      await client.query("INSERT INTO bp_auth_records(installation,tenant,app,kind,id,value) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(installation,tenant,app,kind,id) DO UPDATE SET value=EXCLUDED.value", [installationId, scope.tenantId, scope.appId, kind, value.id, value]);
    },
    remove: async (kind, id, scope) => { await client.query("DELETE FROM bp_auth_records WHERE installation=$1 AND tenant=$2 AND app=$3 AND kind=$4 AND id=$5", [installationId, scope.tenantId, scope.appId, kind, id]); }
  };
}

export class PostgresAuthStorage implements AuthStorage {
  readonly mode = "advanced" as const;
  private readonly pool: Pool;
  constructor(connectionString: string, readonly installationId: string) {
    if (!connectionString) throw new Error("Advanced auth requires PostgreSQL");
    this.pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
  }
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('betterportal-auth-schema',0))");
      await client.query(`CREATE TABLE IF NOT EXISTS bp_auth_records (
        installation text NOT NULL, tenant text NOT NULL, app text NOT NULL, kind text NOT NULL, id text NOT NULL,
        value jsonb NOT NULL CHECK(jsonb_typeof(value)='object' AND value->>'id'=id),
        PRIMARY KEY(installation,tenant,app,kind,id))`);
      await client.query("CREATE INDEX IF NOT EXISTS bp_auth_record_kind ON bp_auth_records(installation,kind,tenant,app)");
      await client.query("CREATE INDEX IF NOT EXISTS bp_auth_mail_due ON bp_auth_records(installation,((value->>'nextAttempt')::bigint),id) WHERE kind='mail' AND value->>'state' IN ('pending','sending')");
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async transaction<T>(scope: Scope, work: (tx: AuthTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Tenant serialization also fences first-user isolation decisions against app creation.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([this.installationId, scope.tenantId])]);
      const result = await work(pgTransaction(client, this.installationId));
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async close(): Promise<void> { await this.pool.end(); }
}

/** Import only known legacy fields. Unknown schema versions never trigger a destructive fallback. */
export function importLegacy(raw: unknown, appIds: Record<string, string[]>): FileData {
  const file = raw as { version: number; users?: Array<Record<string, unknown>>; revokedRefreshTokens?: Record<string, number> };
  if (file.version === 2) return validateRecords(raw);
  if (file.version !== 1 || !Array.isArray(file.users)) throw new Error("Unsupported legacy auth store");
  const records: StoredRecord[] = [];
  const tenants = new Set<string>();
  const identifiers = new Map<string, { scope: Scope; id: string; users: Set<string> }>();
  // Legacy usernames were case-sensitive, and email addresses were not unique.
  // Collect ownership before emitting records so a collision never chooses a winner.
  for (const user of file.users) {
    if (typeof user.id !== "string" || typeof user.tenantId !== "string" || typeof user.username !== "string" || typeof user.passwordHash !== "string") throw new Error("Malformed legacy user");
    const scope = { tenantId: user.tenantId, appId: "" };
    for (const id of new Set([user.username.trim().toLowerCase(), ...(typeof user.email === "string" && user.email ? [user.email.trim().toLowerCase()] : [])])) {
      const indexKey = key("identifier", id, scope);
      const entry = identifiers.get(indexKey) ?? { scope, id, users: new Set<string>() };
      entry.users.add(user.id); identifiers.set(indexKey, entry);
    }
  }
  for (const user of file.users) {
    if (typeof user.id !== "string" || typeof user.tenantId !== "string" || typeof user.username !== "string" || typeof user.passwordHash !== "string") throw new Error("Malformed legacy user");
    tenants.add(user.tenantId);
    const scope = { tenantId: user.tenantId, appId: "" };
    const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
    const ambiguousEmail = !!email && identifiers.get(key("identifier", email, scope))!.users.size > 1;
    const value: RecordValue = { ...user, id: user.id, appId: "", legacyUsernameLogin: !email || ambiguousEmail, bootstrapAdmin: Object.values(user.appRoles as Record<string, string[]> ?? {}).some(roles => roles.includes("*")), emailVerified: false, refreshVersion: Number(user.refreshVersion ?? 0) + 1 };
    if (ambiguousEmail) { value.legacyEmail = user.email; delete value.email; }
    else if (email) value.email = email;
    records.push({ kind: "user", scope, value });
    if (identifiers.get(key("identifier", user.username.trim().toLowerCase(), scope))!.users.size > 1) {
      records.push({ kind: "legacy-username", scope, value: { id: user.username, userId: user.id } });
    }
    const roles = user.appRoles as Record<string, string[]> ?? {};
    for (const appId of new Set([...(appIds[user.tenantId] ?? []), ...Object.keys(roles)])) {
      records.push({ kind: "roles", scope: { tenantId: user.tenantId, appId }, value: { id: user.id, roles: roles[appId] ?? [], initialized: true } });
    }
  }
  for (const entry of identifiers.values()) records.push({ kind: "identifier", scope: entry.scope, value: entry.users.size === 1
    ? { id: entry.id, userId: [...entry.users][0] }
    : { id: entry.id, ambiguous: true } });
  for (const tenantId of tenants) records.push({ kind: "tenant", scope: { tenantId, appId: "" }, value: { id: tenantId, isolation: "tenant", lockedAt: Date.now(), bootstrapComplete: true } });
  for (const [id, expiresAt] of Object.entries(file.revokedRefreshTokens ?? {})) records.push({ kind: "legacy-revocation", scope: { tenantId: "", appId: "" }, value: { id, expiresAt } });
  return validateRecords({ version: 2, records });
}

export async function openAuthStorage(options: { mode: "simple" | "advanced"; path: string; connectionString?: string; installationId: string; appIds: Record<string, string[]> }): Promise<AuthStorage> {
  const path = resolve(options.path);
  if (options.mode === "simple") {
    if (existsSync(`${path}.mode.json`)) throw new Error("Advanced-to-Simple downgrade is unsupported");
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      if (raw.version === 1) {
        const release = lockFile(path);
        try {
          const current = JSON.parse(readFileSync(path, "utf8"));
          const imported = importLegacy(current, options.appIds);
          if (new Set(imported.records.filter(r => r.kind === "tenant").map(r => r.scope.tenantId)).size > 1) throw new Error("Legacy store contains multiple tenants; select Advanced mode");
          if (!existsSync(`${path}.v1.backup`)) atomicWrite(`${path}.v1.backup`, current);
          atomicWrite(path, imported);
        } finally { release(); }
      }
    }
    return new JsonAuthStorage(path);
  }
  const storage = new PostgresAuthStorage(options.connectionString ?? "", options.installationId);
  const markerPath = `${path}.mode.json`;
  if (existsSync(markerPath)) {
    const marker = JSON.parse(readFileSync(markerPath, "utf8"));
    if (marker.installationId !== options.installationId) throw new Error("Auth installation identity mismatch");
  }
  atomicWrite(markerPath, { mode: "advanced", installationId: options.installationId, state: "migrating" });
  try {
    await storage.initialize();
    const release = existsSync(path) ? lockFile(path) : () => undefined;
    try {
      const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
      const checksum = source ? createHash("sha256").update(source).digest("hex") : "empty";
      const scope = { tenantId: "", appId: "" };
      await storage.transaction(scope, async tx => {
        const ledger = await tx.get("migration", "simple", scope);
        if (ledger) {
          if (source && ledger.checksum !== checksum) throw new Error("Leftover Simple store differs from the committed import");
          return;
        }
        if ((await tx.list("user")).length) throw new Error("Advanced store contains users without a matching migration ledger");
        if (source) {
          const imported = importLegacy(JSON.parse(source), options.appIds);
          if (!existsSync(`${path}.advanced.backup`)) atomicWrite(`${path}.advanced.backup`, JSON.parse(source));
          for (const row of imported.records) {
            if (row.kind === "session") row.value.revoked = true;
            await tx.put(row.kind, row.scope, row.value);
          }
          for (const row of imported.records) if (!isDeepStrictEqual(await tx.get(row.kind, row.value.id, row.scope), row.value)) throw new Error("Auth migration record verification failed");
          if ((await tx.list("user")).length !== imported.records.filter(row => row.kind === "user").length) throw new Error("Auth migration verification failed");
        }
        await tx.put("migration", scope, { id: "simple", checksum, completedAt: Date.now(), schemaVersion: 1 });
      });
      atomicWrite(markerPath, { mode: "advanced", installationId: options.installationId, state: "complete" });
      if (source) unlinkSync(path);
    } finally { release(); }
    return storage;
  } catch (error) { await storage.close(); throw error; }
}
