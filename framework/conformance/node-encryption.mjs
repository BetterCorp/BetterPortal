// Test-only adapter to Node's real persisted-config and preview helpers.
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import * as av from "anyvali";
import { FileBackedServiceConfigStore } from "../nodejs/lib/runtime/configStore.js";
import { buildPreviewConfigSchema, generatePreviewConfigKey, encryptPreviewConfigValue, decryptPreviewConfigValue } from "../nodejs/lib/runtime/previewConfig.js";

export async function encryption(body) {
  try {
    const { action, key, value, scope, path } = body;
    if (action === "crypto-keys") return { valid: true, output: { storage: randomBytes(32).toString("base64url"), preview: generatePreviewConfigKey() } };
    if (action === "crypto-preview-encrypt") return { valid: true, output: encryptPreviewConfigValue(key, scope, path, value) };
    if (action === "crypto-preview-decrypt") return { valid: true, output: decryptPreviewConfigValue(key, scope, path, value) };
    if (action === "crypto-preview-fields-encrypt" || action === "crypto-preview-fields-decrypt") {
      let schema = buildPreviewConfigSchema(body.descriptors, scope);
      if (body.roundtrip) schema = av.importSchema(av.exportSchema(schema));
      return { valid: true, output: action.endsWith("-encrypt")
        ? av.encrypt(schema, value, (path, value) => encryptPreviewConfigValue(key, scope, path, value))
        : av.decrypt(schema, value, (path, value) => decryptPreviewConfigValue(key, scope, path, value)) };
    }
    if (action !== "crypto-store-encrypt" && action !== "crypto-store-decrypt") throw new Error("Unknown encryption action");
    const temporary = await mkdtemp(join(tmpdir(), "bp-crypto-"));
    try {
      const filePath = join(temporary, "config.json");
      if (action.endsWith("-decrypt")) await writeFile(filePath, JSON.stringify({ tenants: { test: { tenant: { secret: value }, app: {} } } }));
      const store = new FileBackedServiceConfigStore({ filePath, encryptionKey: key, configSchemas: [{ fields: [{ key: "secret", visibility: "secret" }] }] });
      if (action.endsWith("-decrypt")) return { valid: true, output: store.read({ tenantId: "test" }).tenant.secret };
      store.write("test", undefined, { secret: value }, { tenantId: "test" });
      return { valid: true, output: JSON.parse(await readFile(filePath, "utf8")).tenants.test.tenant.secret };
    } finally {
      if (dirname(temporary) !== tmpdir()) throw new Error("Unexpected temporary directory");
      await rm(temporary, { recursive: true, force: true });
    }
  } catch (error) { return { valid: false, errorType: error.name }; }
}
