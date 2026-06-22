import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Persistent state held by each BPService instance:
 *  - apiKey: control-plane API key (delivered via setup)
 *  - cpUrl: control-plane URL (delivered via setup)
 *  - tenantLock: first-tenant lock for auto-single-tenant default
 *
 * Stored encrypted on disk at the configured path. Encryption key derived from
 * `configEncryptionKey` (same as service config store).
 */
export interface BootstrapStateFile {
  version: 1;
  apiKey?: string;
  cpUrl?: string;
  cpId?: string;
  cpJwksUri?: string;
  configEncryptionKey?: string;
  tenantLock?: string;
  installedAt?: string;
}

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = Buffer.from("bp-bootstrap-state-v1", "utf8");

export interface BootstrapStateOptions {
  filePath: string;
  encryptionKey?: string;
}

export class BootstrapStateStore {
  private cache: BootstrapStateFile | null = null;
  private readonly filePath: string;
  private readonly key: Buffer;

  constructor(options: BootstrapStateOptions) {
    this.filePath = resolve(options.filePath);
    this.key = deriveKey(options.encryptionKey ?? loadOrCreateLocalKey(`${this.filePath}.key`));
  }

  read(): BootstrapStateFile {
    if (this.cache) return this.cache;
    if (!existsSync(this.filePath)) {
      this.cache = { version: 1 };
      return this.cache;
    }
    const raw = readFileSync(this.filePath, "utf8");
    try {
      this.cache = decrypt(raw, this.key);
    } catch {
      const parsed = JSON.parse(raw) as BootstrapStateFile;
      if (parsed.version !== 1) throw new Error(`Bootstrap state ${this.filePath} version mismatch`);
      this.cache = parsed;
    }
    return this.cache;
  }

  write(patch: Partial<BootstrapStateFile>): BootstrapStateFile {
    const current = this.read();
    const next: BootstrapStateFile = { ...current, ...patch, version: 1 };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload = encrypt(next, this.key);
    writeFileSync(this.filePath, payload, { mode: 0o600 });
    this.cache = next;
    return next;
  }

  clear(): void {
    this.cache = { version: 1 };
    if (existsSync(this.filePath)) {
      writeFileSync(this.filePath, encrypt(this.cache, this.key), { mode: 0o600 });
    }
  }

  hasApiKey(): boolean {
    const s = this.read();
    return typeof s.apiKey === "string" && s.apiKey.length > 0
      && typeof s.cpUrl === "string" && s.cpUrl.length > 0;
  }
}

function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, SALT, 32);
}

function loadOrCreateLocalKey(filePath: string): string {
  if (existsSync(filePath)) {
    const key = readFileSync(filePath, "utf8").trim();
    if (key.length >= 16) return key;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  const key = `bp_bsk_${randomBytes(32).toString("base64url")}`;
  writeFileSync(filePath, key, { mode: 0o600 });
  return key;
}

function encrypt(state: BootstrapStateFile, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: encrypted.toString("base64")
  });
}

function decrypt(payload: string, key: Buffer): BootstrapStateFile {
  const envelope = JSON.parse(payload) as { v: number; iv: string; tag: string; ct: string };
  if (envelope.v !== 1) throw new Error("Bootstrap state envelope version mismatch");
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  if (tag.length !== AUTH_TAG_LENGTH) throw new Error("Bootstrap state auth tag invalid");
  const ct = Buffer.from(envelope.ct, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plaintext) as BootstrapStateFile;
  if (parsed.version !== 1) throw new Error("Bootstrap state version mismatch");
  return parsed;
}
