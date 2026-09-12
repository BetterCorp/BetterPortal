import assert from "node:assert/strict";
import test from "node:test";
import { createBpTokenIssuer, generateKeyPair, uuidv7 } from "@betterportal/framework";
import { createBetterPortalApp } from "@betterportal/framework/lib/runtime/h3.js";
import { BPService } from "../src/service.js";

test("generic confirmation works across replicas and restart without renewing replayed assurance", async t => {
  const options = { keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "app", accessTokenSeconds: 900 };
  const issuer = createBpTokenIssuer(options);
  const scope = { tenantId: uuidv7(), appId: uuidv7() };
  // Also cover an older token minted before the provider shortened its access lifetime.
  const token = createBpTokenIssuer({ ...options, accessTokenSeconds: 1800 }).signAccessToken({ ...scope, sub: "alice" });
  const replica = () => {
    const service = Object.create(BPService.prototype) as any;
    Object.assign(service, { app: createBetterPortalApp(), resolveRequestContext: async () => ({ tenant: { id: scope.tenantId }, app: { id: scope.appId } }), validateConfigScope: async () => true, validateTenantApp: async () => ({ allowed: true }) });
    service.registerElevationEndpoint(createBpTokenIssuer(options));
    return service.app;
  };
  const send = (app: ReturnType<typeof createBetterPortalApp>, body: object, bearer = token) => app.fetch(new Request("https://auth.test/.well-known/bp/auth/elevate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` }, body: JSON.stringify(body) }));
  const started = await (await send(replica(), { action: "start", requirement: { minimum: "confirm" } })).json();
  const payload = { action: "complete", challengeId: started.challengeId, confirm: true };
  assert.equal((await send(replica(), { ...payload, confirm: false })).status, 400);
  assert.equal((await send(replica(), { ...payload, challengeId: started.challengeId + ".extra" })).status, 400);
  assert.equal((await send(replica(), payload, issuer.signAccessToken({ ...scope, sub: "alice" }))).status, 400);
  const completed = await send(replica(), payload); assert.equal(completed.status, 200);
  const first = await completed.json(); const claims = await issuer.verifier().verify(first.accessToken, scope);
  assert.equal(claims.elevation?.assurance, "confirmed");
  await assert.rejects(issuer.verifier().verify(started.challengeId, scope));
  const clock = Date.now(); t.mock.method(Date, "now", () => clock + 60000);
  const replay = await (await send(replica(), payload)).json();
  assert.equal(replay.elevation.verifiedAt, first.elevation.verifiedAt);
  assert.equal(replay.elevation.expiresAt, first.elevation.expiresAt);
  assert.equal((await send(replica(), { action: "start", requirement: { minimum: "mfa" } })).status, 400);
  t.mock.method(Date, "now", () => clock + 301000);
  assert.equal((await send(replica(), payload)).status, 400);
});
