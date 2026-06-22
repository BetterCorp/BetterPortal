import * as av from "anyvali";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ConfigSchemaDescriptor } from "../contracts/config.js";
import type { JsonValue } from "../contracts/json.js";
import type { ServiceConfigState, ServiceConfigTicketClaims } from "../contracts/serviceConfig.js";

const ValuesSchema = av.record(av.any());
type ConfigValues = Record<string, JsonValue>;
type TenantConfigBucket = { tenant: ConfigValues; app: Record<string, ConfigValues> };
type PersistedServiceConfigState = {
  tenants: Record<string, TenantConfigBucket>;
  legacy?: TenantConfigBucket;
};

function emptyBucket(): TenantConfigBucket {
  return { tenant: {}, app: {} };
}

function cloneBucket(bucket: TenantConfigBucket | undefined): ServiceConfigState {
  return {
    tenant: { ...(bucket?.tenant ?? {}) },
    app: Object.fromEntries(
      Object.entries(bucket?.app ?? {}).map(([appId, values]) => [appId, { ...values }])
    )
  };
}

// ── Interface ────────────────────────────────────────────────────────

export interface ServiceConfigStore {
  read(ticket: ServiceConfigTicketClaims): ServiceConfigState;
  write(
    tenantId: string,
    appId: string | undefined,
    values: Record<string, unknown>,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState;
  clearKey?(
    tenantId: string,
    appId: string | undefined,
    key: string,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState;
}

// ── In-memory (dev) ──────────────────────────────────────────────────

export class InMemoryServiceConfigStore implements ServiceConfigStore {
  private state: PersistedServiceConfigState = { tenants: {} };

  read(ticket: ServiceConfigTicketClaims): ServiceConfigState {
    return cloneBucket(this.state.tenants[ticket.tenantId]);
  }

  write(
    tenantId: string,
    appId: string | undefined,
    values: Record<string, unknown>,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    const parsed = ValuesSchema.parse(values) as ConfigValues;
    if (tenantId !== ticket.tenantId) {
      return this.read(ticket);
    }
    const current = this.state.tenants[tenantId] ?? emptyBucket();

    if (appId) {
      this.state.tenants[tenantId] = {
        tenant: current.tenant,
        app: { ...current.app, [appId]: { ...(current.app[appId] ?? {}), ...parsed } }
      };
    } else {
      this.state.tenants[tenantId] = { tenant: { ...current.tenant, ...parsed }, app: current.app };
    }

    return this.read(ticket);
  }

  clearKey(
    tenantId: string,
    appId: string | undefined,
    key: string,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    if (tenantId !== ticket.tenantId) return this.read(ticket);
    const current = this.state.tenants[tenantId] ?? emptyBucket();

    if (appId) {
      const appValues = { ...(current.app[appId] ?? {}) };
      delete appValues[key];
      this.state.tenants[tenantId] = {
        tenant: current.tenant,
        app: { ...current.app, [appId]: appValues }
      };
    } else {
      const tenantValues = { ...current.tenant };
      delete tenantValues[key];
      this.state.tenants[tenantId] = { tenant: tenantValues, app: current.app };
    }
    return this.read(ticket);
  }
}

// ── Encryption helpers ───────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:aes256gcm:";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "bp-config-store", 32);
}

function encryptValue(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return `${ENCRYPTED_PREFIX}${payload}`;
}

function decryptValue(ciphertext: string, key: Buffer): string {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext;
  const payload = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function resolveSecretKeys(configSchemas: ConfigSchemaDescriptor[]): Set<string> {
  return new Set(
    configSchemas.flatMap((schema) =>
      schema.fields
        .filter((field) => field.visibility === "secret")
        .map((field) => field.key)
    )
  );
}

function encryptSecrets(
  values: Record<string, JsonValue>,
  secretKeys: Set<string>,
  key: Buffer
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      secretKeys.has(k) && typeof v === "string" ? encryptValue(v, key) : v
    ])
  );
}

function decryptSecrets(
  values: Record<string, JsonValue>,
  secretKeys: Set<string>,
  key: Buffer
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      secretKeys.has(k) && typeof v === "string" && v.startsWith(ENCRYPTED_PREFIX)
        ? decryptValue(v, key)
        : v
    ])
  );
}

// ── File-backed (persistent, encrypted secrets) ──────────────────────

export interface FileBackedServiceConfigStoreOptions {
  filePath: string;
  configSchemas: ConfigSchemaDescriptor[];
  encryptionKey: string;
}

export class FileBackedServiceConfigStore implements ServiceConfigStore {
  private state: PersistedServiceConfigState;
  private readonly key: Buffer;
  private readonly secretKeys: Set<string>;
  private readonly filePath: string;

  constructor(options: FileBackedServiceConfigStoreOptions) {
    this.filePath = options.filePath;
    this.key = deriveKey(options.encryptionKey);
    this.secretKeys = resolveSecretKeys(options.configSchemas);
    this.state = this.loadFromDisk();
  }

  read(ticket: ServiceConfigTicketClaims): ServiceConfigState {
    return this.readBucket(ticket.tenantId);
  }

  write(
    tenantId: string,
    appId: string | undefined,
    values: Record<string, unknown>,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    const parsed = ValuesSchema.parse(values) as ConfigValues;
    if (tenantId !== ticket.tenantId) {
      return this.read(ticket);
    }

    const encrypted = encryptSecrets(parsed, this.secretKeys, this.key);
    const current = this.ensureTenantBucket(tenantId);

    if (appId) {
      this.state.tenants[tenantId] = {
        tenant: current.tenant,
        app: { ...current.app, [appId]: { ...(current.app[appId] ?? {}), ...encrypted } }
      };
    } else {
      this.state.tenants[tenantId] = { tenant: { ...current.tenant, ...encrypted }, app: current.app };
    }

    this.saveToDisk();
    return this.read(ticket);
  }

  clearKey(
    tenantId: string,
    appId: string | undefined,
    key: string,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    if (tenantId !== ticket.tenantId) return this.read(ticket);
    const current = this.ensureTenantBucket(tenantId);

    if (appId) {
      const appValues = { ...(current.app[appId] ?? {}) };
      delete appValues[key];
      this.state.tenants[tenantId] = {
        tenant: current.tenant,
        app: { ...current.app, [appId]: appValues }
      };
    } else {
      const tenantValues = { ...current.tenant };
      delete tenantValues[key];
      this.state.tenants[tenantId] = { tenant: tenantValues, app: current.app };
    }

    this.saveToDisk();
    return this.read(ticket);
  }

  private readBucket(tenantId: string): ServiceConfigState {
    const bucket = this.ensureTenantBucket(tenantId);
    return {
      tenant: this.decryptRecord(bucket.tenant),
      app: Object.fromEntries(
        Object.entries(bucket.app).map(([id, vals]) => [id, this.decryptRecord(vals)])
      )
    };
  }

  private ensureTenantBucket(tenantId: string): TenantConfigBucket {
    if (!this.state.tenants[tenantId] && this.state.legacy) {
      this.state.tenants[tenantId] = this.state.legacy;
      delete this.state.legacy;
      this.saveToDisk();
    }
    if (!this.state.tenants[tenantId]) {
      this.state.tenants[tenantId] = emptyBucket();
    }
    return this.state.tenants[tenantId];
  }

  private decryptRecord(values: Record<string, JsonValue>): Record<string, JsonValue> {
    return decryptSecrets(values, this.secretKeys, this.key);
  }

  private loadFromDisk(): PersistedServiceConfigState {
    if (!existsSync(this.filePath)) {
      return { tenants: {} };
    }
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.tenants && typeof parsed.tenants === "object") {
      return { tenants: parsed.tenants };
    }
    return { tenants: {}, legacy: { tenant: parsed.tenant ?? {}, app: parsed.app ?? {} } };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify({ tenants: this.state.tenants }, null, 2), "utf8");
  }
}
