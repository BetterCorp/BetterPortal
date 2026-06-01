import * as av from "anyvali";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ConfigSchemaDescriptor } from "../contracts/config.js";
import type { JsonValue } from "../contracts/json.js";
import type { ServiceConfigState, ServiceConfigTicketClaims } from "../contracts/serviceConfig.js";

const ValuesSchema = av.record(av.any());

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
  private state: ServiceConfigState = { tenant: {}, app: {} };

  read(ticket: ServiceConfigTicketClaims): ServiceConfigState {
    return {
      tenant: this.state.tenant,
      app: ticket.appId
        ? { [ticket.appId]: this.state.app[ticket.appId] ?? {} }
        : this.state.app
    };
  }

  write(
    tenantId: string,
    appId: string | undefined,
    values: Record<string, unknown>,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    const parsed = ValuesSchema.parse(values) as ServiceConfigState["tenant"];
    if (tenantId !== ticket.tenantId || appId !== ticket.appId) {
      return this.state;
    }

    if (appId) {
      this.state = {
        tenant: this.state.tenant,
        app: {
          ...this.state.app,
          [appId]: { ...(this.state.app[appId] ?? {}), ...parsed }
        }
      };
    } else {
      this.state = {
        tenant: { ...this.state.tenant, ...parsed },
        app: this.state.app
      };
    }

    return this.state;
  }

  clearKey(
    tenantId: string,
    appId: string | undefined,
    key: string,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    if (tenantId !== ticket.tenantId || appId !== ticket.appId) return this.state;

    if (appId) {
      const current = { ...(this.state.app[appId] ?? {}) };
      delete current[key];
      this.state = {
        tenant: this.state.tenant,
        app: { ...this.state.app, [appId]: current }
      };
    } else {
      const current = { ...this.state.tenant };
      delete current[key];
      this.state = { tenant: current, app: this.state.app };
    }
    return this.state;
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
  private state: ServiceConfigState;
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
    return {
      tenant: this.decryptRecord(this.state.tenant),
      app: ticket.appId
        ? { [ticket.appId]: this.decryptRecord(this.state.app[ticket.appId] ?? {}) }
        : Object.fromEntries(
            Object.entries(this.state.app).map(([id, vals]) => [id, this.decryptRecord(vals)])
          )
    };
  }

  write(
    tenantId: string,
    appId: string | undefined,
    values: Record<string, unknown>,
    ticket: ServiceConfigTicketClaims
  ): ServiceConfigState {
    const parsed = ValuesSchema.parse(values) as ServiceConfigState["tenant"];
    if (tenantId !== ticket.tenantId || appId !== ticket.appId) {
      return this.readAll();
    }

    const encrypted = encryptSecrets(parsed, this.secretKeys, this.key);

    if (appId) {
      this.state = {
        tenant: this.state.tenant,
        app: {
          ...this.state.app,
          [appId]: { ...(this.state.app[appId] ?? {}), ...encrypted }
        }
      };
    } else {
      this.state = {
        tenant: { ...this.state.tenant, ...encrypted },
        app: this.state.app
      };
    }

    this.saveToDisk();
    return this.readAll();
  }

  private readAll(): ServiceConfigState {
    return {
      tenant: this.decryptRecord(this.state.tenant),
      app: Object.fromEntries(
        Object.entries(this.state.app).map(([id, vals]) => [id, this.decryptRecord(vals)])
      )
    };
  }

  private decryptRecord(values: Record<string, JsonValue>): Record<string, JsonValue> {
    return decryptSecrets(values, this.secretKeys, this.key);
  }

  private loadFromDisk(): ServiceConfigState {
    if (!existsSync(this.filePath)) {
      return { tenant: {}, app: {} };
    }
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      tenant: parsed.tenant ?? {},
      app: parsed.app ?? {}
    };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
