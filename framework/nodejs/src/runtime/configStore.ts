import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ConfigSchemaDescriptor } from "../contracts/config.js";
import { JsonObjectSchema, type JsonValue } from "../contracts/json.js";
import type { ServiceConfigState, ServiceConfigTicketClaims } from "../contracts/serviceConfig.js";

const ValuesSchema = JsonObjectSchema;
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

// -- Interface --------------------------------------------------------

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

// -- In-memory (dev) --------------------------------------------------

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

// -- Encryption helpers -----------------------------------------------

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

// v1 wrote a 16-byte IV. GCM's standard nonce is 96-bit; anything else forces
// the GHASH-based derivation path instead of using the nonce directly. v2
// writes the correct 12 bytes. v1 values stay readable so existing stores keep
// working - they re-encrypt as v2 on the next write of that value.
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:aes256gcm2:";
const LEGACY_ENCRYPTED_PREFIX = "enc:aes256gcm:";

// spec/config.md 4.1 mandates scrypt N=32768. v1 shipped with node's default
// (16384), so the cost parameter is pinned per envelope version - v1 values
// stay decryptable and v2 values match the spec.
const KDF_COST_V1 = 16384;
const KDF_COST = 32768;

// scrypt at N=32768 is deliberately expensive, so derived keys are memoised -
// the store would otherwise re-derive once per secret value.
const derivedKeys = new Map<string, Buffer>();

// Fixed salt is safe here: the KDF input is a 256-bit CSPRNG key generated at
// install, never an operator passphrase, so there is no low-entropy space to
// precompute against.
function deriveKey(secret: string, cost: number): Buffer {
  const cacheKey = `${cost}:${secret}`;
  const cached = derivedKeys.get(cacheKey);
  if (cached) return cached;
  // maxmem must be raised alongside N; node's default ceiling is 32MB and
  // scrypt needs roughly 128 * N * r bytes.
  const key = scryptSync(secret, "bp-config-store", 32, { N: cost, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  derivedKeys.set(cacheKey, key);
  return key;
}

function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX) || value.startsWith(LEGACY_ENCRYPTED_PREFIX);
}

function encryptValue(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret, KDF_COST), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return `${ENCRYPTED_PREFIX}${payload}`;
}

function decryptValue(ciphertext: string, secret: string): string {
  const legacy = !ciphertext.startsWith(ENCRYPTED_PREFIX);
  if (legacy && !ciphertext.startsWith(LEGACY_ENCRYPTED_PREFIX)) return ciphertext;
  const prefix = legacy ? LEGACY_ENCRYPTED_PREFIX : ENCRYPTED_PREFIX;
  const ivLength = legacy ? LEGACY_IV_LENGTH : IV_LENGTH;
  const payload = Buffer.from(ciphertext.slice(prefix.length), "base64");
  const iv = payload.subarray(0, ivLength);
  const authTag = payload.subarray(ivLength, ivLength + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(ivLength + AUTH_TAG_LENGTH);
  const key = deriveKey(secret, legacy ? KDF_COST_V1 : KDF_COST);
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
  secret: string
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      secretKeys.has(k) && typeof v === "string" ? encryptValue(v, secret) : v
    ])
  );
}

function decryptSecrets(
  values: Record<string, JsonValue>,
  secretKeys: Set<string>,
  secret: string
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      secretKeys.has(k) && typeof v === "string" && isEncrypted(v)
        ? decryptValue(v, secret)
        : v
    ])
  );
}

// -- File-backed (persistent, encrypted secrets) ----------------------

export interface FileBackedServiceConfigStoreOptions {
  filePath: string;
  configSchemas: ConfigSchemaDescriptor[];
  encryptionKey: string;
}

export class FileBackedServiceConfigStore implements ServiceConfigStore {
  private state: PersistedServiceConfigState;
  private readonly encryptionKey: string;
  private readonly secretKeys: Set<string>;
  private readonly filePath: string;

  constructor(options: FileBackedServiceConfigStoreOptions) {
    this.filePath = options.filePath;
    this.encryptionKey = options.encryptionKey;
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

    const encrypted = encryptSecrets(parsed, this.secretKeys, this.encryptionKey);
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
    return decryptSecrets(values, this.secretKeys, this.encryptionKey);
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
