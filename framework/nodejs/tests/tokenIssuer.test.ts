import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "../src/runtime/auth/keypair.js";
import { createBpTokenIssuer } from "../src/runtime/auth/issuer.js";
import { uuidv7 } from "../src/runtime/uuid.js";

const keyPair = generateKeyPair({ kid: "issuer-test" });
const tenantId = uuidv7();
const appId = uuidv7();

test("issues access and refresh tokens from one token id", async () => {
  const issuer = createBpTokenIssuer({
    keyPair,
    issuer: "https://auth.local",
    audience: "betterportal-runtime",
    accessTokenSeconds: 900,
    refreshTokenSeconds: 3600
  });

  const pair = issuer.issueTokenPair({
    sub: "user-1",
    tenantId,
    appId,
    roles: ["admin"],
    name: "Admin User",
    email: "admin@example.test"
  });

  assert.equal(typeof pair.tokenId, "string");
  assert.equal(pair.accessTokenExpiresInSeconds, 900);
  assert.equal(pair.refreshTokenExpiresInSeconds, 3600);
  assert.ok(pair.refreshToken);

  const accessClaims = await issuer.verifier("access").verify(pair.accessToken);
  const refreshClaims = await issuer.verifyRefreshToken({
    refreshToken: pair.refreshToken,
    tenantId,
    appId
  });

  assert.equal(accessClaims.jti, pair.tokenId);
  assert.equal(refreshClaims.jti, pair.tokenId);
  assert.equal(accessClaims.tokenType, "access");
  assert.equal(refreshClaims.tokenType, "refresh");
  assert.deepEqual(accessClaims.roles, ["admin"]);
  assert.deepEqual(refreshClaims.roles, []);
});

test("rejects refresh tokens bound to a different tenant or app", async () => {
  const issuer = createBpTokenIssuer({
    keyPair,
    issuer: "https://auth.local",
    audience: "betterportal-runtime",
    accessTokenSeconds: 900,
    refreshTokenSeconds: 3600
  });
  const pair = issuer.issueTokenPair({
    sub: "user-1",
    tenantId,
    appId
  });
  assert.ok(pair.refreshToken);

  await assert.rejects(
    issuer.verifyRefreshToken({
      refreshToken: pair.refreshToken,
      tenantId,
      appId: uuidv7()
    }),
    /different tenant\/app/
  );
});
