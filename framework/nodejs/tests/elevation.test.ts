import assert from "node:assert/strict";
import test from "node:test";
import { createBpTokenIssuer, generateKeyPair, uuidv7, satisfiesElevation, requireElevation, elevationResponse, ElevationRequired } from "../src/index.js";

test("signed elevation is app-bound, short-lived and absent from normal issuance", async () => {
  const issuer = createBpTokenIssuer({ keyPair: generateKeyPair(), issuer: "https://auth.test", audience: "app", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
  const scope = { tenantId: uuidv7(), appId: uuidv7() }; const now = Math.floor(Date.now() / 1000);
  const user = { ...scope, sub: "alice", roles: ["reader"], authProvider: "test", refreshContext: {} };
  const elevated = issuer.signElevatedAccessToken(user, { assurance: "mfa", verifiedAt: now, expiresAt: now + 60 }, 60);
  const claims = await issuer.verifier().verify(elevated, scope);
  assert.equal(satisfiesElevation(claims, { minimum: "mfa" }), true);
  assert.equal(satisfiesElevation(claims, { minimum: "confirm" }), true);
  assert.equal(satisfiesElevation(claims, { minimum: "mfa", maxAgeSeconds: 10 }, now + 11), false);
  assert.equal(satisfiesElevation(claims, { minimum: "confirm" }, now + 60), false);
  assert.equal(satisfiesElevation({ ...claims, elevation: { ...claims.elevation!, assurance: "confirmed" } }, { minimum: "mfa" }), false);
  assert.equal(satisfiesElevation({ ...claims, exp: now + 30 }, { minimum: "mfa" }), false);
  assert.equal(satisfiesElevation({ ...claims, elevation: { ...claims.elevation!, verifiedAt: now + 1 } }, { minimum: "mfa" }), false);
  const normal = issuer.issueTokenPair({ ...user, ...claims, refreshContext: {} });
  assert.equal((await issuer.verifier().verify(normal.accessToken, scope)).elevation, undefined);
  assert.equal((await issuer.verifyRefreshToken({ ...scope, refreshToken: normal.refreshToken! })).elevation, undefined);
  assert.throws(() => issuer.signElevatedAccessToken(user, { assurance: "mfa", verifiedAt: now, expiresAt: now + 901 }, 901), /Invalid elevation lifetime/);
  assert.throws(() => requireElevation(undefined, { minimum: "mfa" }), ElevationRequired);
  const challenge = elevationResponse({ minimum: "mfa", maxAgeSeconds: 300 }, scope);
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers.get("www-authenticate")!, /insufficient_user_authentication/);
  assert.equal(JSON.parse(challenge.headers.get("bp-auth-challenge")!).appId, scope.appId);
});

import { readFileSync } from "node:fs";
for (const entry of JSON.parse(readFileSync(new URL("../../conformance/elevation-cases.json", import.meta.url), "utf8"))) {
  test(`shared elevation: ${entry.name}`, () => assert.equal(satisfiesElevation(entry.user, entry.requirement, entry.now), entry.allowed));
}
