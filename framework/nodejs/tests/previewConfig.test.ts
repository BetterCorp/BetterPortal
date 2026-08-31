import assert from "node:assert/strict";
import { test } from "node:test";
import * as av from "anyvali";
import {
  buildPreviewConfigSchema,
  decryptPreviewConfigValue,
  encryptPreviewConfigValue,
  generatePreviewConfigKey
} from "../src/runtime/previewConfig.js";
import type { ConfigSchemaDescriptor } from "../src/contracts/config.js";

test("preview config validates opaque secrets and decrypts only with the matching key and scope", () => {
  const descriptors: ConfigSchemaDescriptor[] = [{
    id: "example.tenant",
    title: "Example",
    description: "Example preview config",
    scope: "tenant",
    jsonSchema: { endpoint: "string", token: "string" },
    fields: [
      { key: "endpoint", title: "Endpoint", description: "Service endpoint", scope: "tenant", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", required: true },
      { key: "token", title: "Token", description: "Service token", scope: "tenant", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", required: true }
    ]
  }];
  const schema = buildPreviewConfigSchema(descriptors, "tenant");
  const key = generatePreviewConfigKey();
  const encrypted = av.encrypt(schema, { endpoint: "https://example.test", token: "secret" }, (path, value) =>
    encryptPreviewConfigValue(key, "tenant", path, value)
  );

  assert.equal(av.safeParseEncrypted(schema, encrypted).success, true);
  assert.equal(av.safeParseEncrypted(schema, { endpoint: "https://example.test", token: "secret" }).success, false);
  assert.deepEqual(av.decrypt(schema, encrypted, (path, value) =>
    decryptPreviewConfigValue(key, "tenant", path, value)
  ), { endpoint: "https://example.test", token: "secret" });
  assert.throws(() => av.decrypt(schema, encrypted, (path, value) =>
    decryptPreviewConfigValue(key, "app", path, value)
  ));
});
