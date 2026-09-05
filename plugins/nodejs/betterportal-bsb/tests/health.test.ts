import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { registerBpWellKnownRoutes, signJwt, type JwtClaims } from "@betterportal/framework";
import { createBetterPortalApp } from "@betterportal/framework/lib/runtime/h3.js";
import { BPService } from "../src/service.js";

test("health diagnostics require setup or a verified admin-app user and cannot be cached", async () => {
  const tenantId = "01900000-0000-7000-8000-000000000001";
  const appId = "01900000-0000-7000-8000-000000000002";
  const otherId = "01900000-0000-7000-8000-000000000003";
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const auth = {
    expectedIssuer: "https://auth.test", expectedAudience: "management",
    publicKeys: { keys: [{ ...keys.publicKey.export({ format: "jwk" }), kid: "health", alg: "RS256", use: "sig" }] }
  };
  const service = Object.create(BPService.prototype) as any;
  Object.assign(service, {
    requireBetterPortalConfigSource: true, inSetupMode: false,
    manifest: { pluginId: "org.example.service", version: "10.6.11" },
    manifestSync: { state: "synced", lastSuccessAt: "2026-09-05T00:00:00Z" },
    scopedConfig: {
      tenants: [{}], apps: [{}], configManagement: {
        adminTenantId: tenantId, managementAppId: appId,
        context: { app: { id: appId, tenantId, auth } }
      }
    },
    managementRequestContext: () => ({ tenant: { id: tenantId, active: true }, app: { id: appId } })
  });
  const app = createBetterPortalApp();
  registerBpWellKnownRoutes(app, service.manifest, { manifest: service.manifest, routes: [] }, {
    health: async event => service.renderHealth(service.inSetupMode || await service.canReadHealthDiagnostics(event))
  });
  const token = (changes: Partial<JwtClaims> = {}, expiresInSeconds = 60) => signJwt({
    privateKeyPem, kid: "health", claims: {
      iss: auth.expectedIssuer, aud: auth.expectedAudience, sub: "admin-user", realm: "runtime",
      tenantId, appId, roles: [], tokenType: "access", ...changes, expiresInSeconds
    }
  });
  const probe = async (bearer?: string) => {
    const response = await app.fetch(new Request("https://service.test/.well-known/bp/health", {
      headers: { origin: "https://management.test", "bp-tenant-id": tenantId, "bp-app-id": appId,
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }
    }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Authorization");
    return { status: response.status, body: await response.json() };
  };
  for (const bearer of [undefined, "invalid", "bp_sk_service-key", token({ tenantId: otherId }), token({ appId: otherId }),
    token({ tokenType: "refresh" }), token({ iss: "https://untrusted.test" }), token({ aud: "other" }), token({}, -60)]) {
    assert.deepEqual(await probe(bearer), { status: 200, body: { ok: true } });
  }
  const valid = token();
  const [header, payload, signature] = valid.split(".");
  assert.deepEqual(await probe(`${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`),
    { status: 200, body: { ok: true } });
  const diagnostics = (await probe(valid)).body;
  assert.equal(diagnostics.version, "10.6.11");
  assert.equal(diagnostics.pluginId, "org.example.service");
  assert.equal(diagnostics.config.tenants, 1);
  assert.equal(diagnostics.manifestSync.state, "synced");

  service.manifestSync.state = "retrying";
  assert.deepEqual(await probe(), { status: 503, body: { ok: false } });
  service.inSetupMode = true;
  const setup = await probe();
  assert.equal(setup.status, 200);
  assert.equal(setup.body.setupMode, true);
  assert.equal(setup.body.pluginId, "org.example.service");
  service.inSetupMode = false;
  service.manifestSync.state = "synced";
  service.scopedConfig.configManagement.adminTenantId = otherId;
  assert.deepEqual(await probe(valid), { status: 200, body: { ok: true } });
  service.scopedConfig.configManagement.adminTenantId = tenantId;
  service.managementRequestContext = () => ({ tenant: { id: tenantId, active: false }, app: { id: appId } });
  assert.deepEqual(await probe(valid), { status: 200, body: { ok: true } });
  // Config manager resolves its management context from its own storage rather than scoped config.
  service.managementRequestContext = () => null;
  service.resolveRequestContext = async () => ({ tenant: { id: tenantId, active: true }, app: { id: appId } });
  assert.equal((await probe(valid)).body.version, "10.6.11");
  service.scopedConfig.configManagement.context.app.auth = undefined;
  assert.deepEqual(await probe(valid), { status: 200, body: { ok: true } });

  // Public probes must not resolve a tenant, read storage, or verify a token.
  service.managementRequestContext = () => { throw new Error("Unexpected context lookup"); };
  assert.deepEqual(await probe(), { status: 200, body: { ok: true } });
  assert.deepEqual(await probe(valid), { status: 200, body: { ok: true } });
});
