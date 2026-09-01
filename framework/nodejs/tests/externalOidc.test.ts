import assert from "node:assert/strict";
import { test } from "node:test";
import { importPKCS8, SignJWT } from "jose";
import { generateKeyPair, publicKeyToJwk } from "../src/runtime/auth/keypair.js";
import { clearJwksCache } from "../src/runtime/auth/jwks.js";
import { verifyExternalOidcToken } from "../src/runtime/auth/externalOidc.js";

test("external OIDC verification enforces signature, issuer and audience without BP claims", async (t) => {
  const pair = generateKeyPair({ kid: "external-oidc-test" });
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    clearJwksCache();
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    keys: [publicKeyToJwk(pair.publicKeyPem, pair.kid)]
  }), { headers: { "content-type": "application/json" } });

  const options = {
    issuer: "https://issuer.example",
    audience: "preview-api",
    jwksUri: "https://issuer.example/.well-known/jwks.json"
  };
  const privateKey = await importPKCS8(pair.privateKeyPem, "RS256");
  const token = await new SignJWT({
    sub: "repo:example/private:pull_request",
    repository: "example/private"
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: pair.kid })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(privateKey);
  const claims = await verifyExternalOidcToken(token, options);
  assert.equal(claims.sub, "repo:example/private:pull_request");
  assert.equal(claims.repository, "example/private");
  await assert.rejects(verifyExternalOidcToken(token, { ...options, audience: "other" }), /aud/i);
});
