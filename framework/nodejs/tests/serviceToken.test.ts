import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ServiceTokenAuthorizationError,
  authorizeServiceToken,
  generateKeyPair,
  loadOrGenerateKeyPair,
  signServiceToken,
  uuidv7,
  type ScopedM2MConfig
} from "../src/index.js";

function fixture() {
  const sourceServiceId = uuidv7();
  const targetServiceId = uuidv7();
  const tenantId = uuidv7();
  const appId = uuidv7();
  const bindingId = uuidv7();
  const keyPair = generateKeyPair();
  const policy: ScopedM2MConfig = {
    localServiceIds: [targetServiceId],
    services: [{
      id: sourceServiceId,
      hostname: "https://source.example",
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.kid
    }],
    bindings: [{
      id: bindingId,
      tenantId,
      appId,
      sourceServiceId,
      requestId: "reports.read",
      contractId: "reports",
      targetServiceId,
      targetViewId: "reports.list",
      enabled: true,
      createdAt: new Date().toISOString()
    }],
    grants: [{
      id: uuidv7(),
      tenantId,
      appId,
      bindingId,
      methods: ["GET"],
      permissions: ["read"],
      enabled: true,
      createdAt: new Date().toISOString()
    }]
  };
  return { sourceServiceId, targetServiceId, tenantId, appId, bindingId, keyPair, policy };
}

test("installed service tokens are bound to the target binding and grant", async () => {
  const value = fixture();
  const token = signServiceToken(value);
  const authorized = await authorizeServiceToken(token, {
    policy: value.policy,
    tenantId: value.tenantId,
    appId: value.appId,
    viewId: "reports.list",
    method: "GET",
    requiredPermissions: ["read"]
  });
  assert.equal(authorized.claims.iss, value.sourceServiceId);
  assert.equal(authorized.claims.aud, value.targetServiceId);

  await assert.rejects(
    authorizeServiceToken(token, {
      policy: value.policy,
      tenantId: value.tenantId,
      appId: value.appId,
      viewId: "reports.list",
      method: "POST",
      requiredPermissions: ["read"]
    }),
    (error) => error instanceof ServiceTokenAuthorizationError && error.status === 403
  );
});

test("installed service key bootstrap is stable across restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-s2s-"));
  try {
    const file = join(dir, "s2s-key.json");
    const first = loadOrGenerateKeyPair(file);
    const before = readFileSync(file, "utf8");
    const second = loadOrGenerateKeyPair(file);
    assert.deepEqual(second, first);
    assert.equal(readFileSync(file, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
