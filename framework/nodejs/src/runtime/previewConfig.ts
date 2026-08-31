import * as av from "anyvali";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ConfigSchemaDescriptor } from "../contracts/config.js";

const KEY_PREFIX = "bp_pck_";
const ENCRYPTED_PREFIX = "encrypted:bp-aes256gcm-v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function buildPreviewConfigSchema(
  descriptors: readonly ConfigSchemaDescriptor[],
  scope: "tenant" | "app"
): av.BaseSchema<unknown, Record<string, string | undefined>> {
  const shape: Record<string, av.BaseSchema> = {};
  for (const field of descriptors.flatMap((descriptor) => descriptor.fields).filter((field) => field.scope === scope)) {
    let schema: av.BaseSchema = av.string().maxLength(255).describe(field.description, {
      title: field.title,
      sensitive: field.visibility === "secret"
    });
    if (!field.required) schema = av.optional(schema);
    shape[field.key] = schema;
  }
  return av.object(shape, { unknownKeys: "reject" }) as av.BaseSchema<unknown, Record<string, string | undefined>>;
}

export function generatePreviewConfigKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** AES-256-GCM envelope. Browser implementations must append the 16-byte tag to ciphertext. */
export function encryptPreviewConfigValue(
  key: string,
  scope: "tenant" | "app",
  path: readonly (string | number)[],
  value: unknown
): string {
  if (typeof value !== "string") throw new Error("Preview config sensitive values must be strings");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", previewConfigKeyBytes(key), iv);
  cipher.setAAD(previewConfigAad(scope, path));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPreviewConfigValue(
  key: string,
  scope: "tenant" | "app",
  path: readonly (string | number)[],
  value: unknown
): string {
  if (typeof value !== "string" || !value.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error("Preview config contains an invalid encrypted value");
  }
  const [ivValue, ciphertextValue, ...extra] = value.slice(ENCRYPTED_PREFIX.length).split(":");
  if (!ivValue || !ciphertextValue || extra.length > 0) throw new Error("Preview config encrypted envelope is invalid");
  const iv = Buffer.from(ivValue, "base64url");
  const payload = Buffer.from(ciphertextValue, "base64url");
  if (iv.length !== IV_BYTES || payload.length <= TAG_BYTES) throw new Error("Preview config encrypted envelope is invalid");
  const decipher = createDecipheriv("aes-256-gcm", previewConfigKeyBytes(key), iv);
  decipher.setAAD(previewConfigAad(scope, path));
  decipher.setAuthTag(payload.subarray(payload.length - TAG_BYTES));
  return Buffer.concat([
    decipher.update(payload.subarray(0, payload.length - TAG_BYTES)),
    decipher.final()
  ]).toString("utf8");
}

function previewConfigKeyBytes(key: string): Buffer {
  if (!key.startsWith(KEY_PREFIX)) throw new Error(`Preview config key must start with ${KEY_PREFIX}`);
  const decoded = Buffer.from(key.slice(KEY_PREFIX.length), "base64url");
  if (decoded.length !== 32) throw new Error("Preview config key must contain 32 bytes");
  return decoded;
}

function previewConfigAad(scope: "tenant" | "app", path: readonly (string | number)[]): Buffer {
  return Buffer.from(`betterportal.preview-config.v1\n${scope}\n${path.map(String).join(".")}`, "utf8");
}
