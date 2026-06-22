import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { generateKeyPair, signJwt, verifyJwt, type KeyResolver } from "@betterportal/framework";

const ISSUER = "https://auth.test.local";
const AUDIENCE = "test-app";
const TENANT_ID = "019ece41-6655-713d-adff-b56a16fcd4ce";
const APP_ID = "019ece41-6656-71e3-830c-c59f85975180";

function makeResolver(publicKeyPem: string, kid: string): KeyResolver {
  return async (requestedKid) => {
    if (requestedKid !== kid) throw new Error(`Unknown kid ${requestedKid}`);
    return publicKeyPem;
  };
}

function baseSignArgs(privateKeyPem: string, kid: string) {
  return {
    privateKeyPem,
    kid,
    claims: {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: "user-1",
      tenantId: TENANT_ID,
      appId: APP_ID,
      roles: ["admin"],
      realm: "runtime" as const,
      tokenType: "access" as const,
      expiresInSeconds: 900
    }
  };
}

function baseVerifyOpts(keyResolver: KeyResolver) {
  return {
    keyResolver,
    expectedIssuer: ISSUER,
    expectedAudience: AUDIENCE
  };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

test("valid RS256 token returns claims", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const token = signJwt(baseSignArgs(privateKeyPem, kid));
  const claims = await verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid)));
  assert.equal(claims.sub, "user-1");
  assert.equal(claims.tenantId, TENANT_ID);
  assert.equal(claims.appId, APP_ID);
  assert.deepEqual(claims.roles, ["admin"]);
});

test("alg: none token is rejected", async () => {
  const { publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "none", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1", exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const token = `${header}.${payload}.`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /Algorithm not allowed/
  );
});

test("HS256 token signed with RS pubkey as HMAC secret is rejected", async () => {
  const { publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "HS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1", exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", publicKeyPem).update(unsigned).digest("base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /Algorithm not allowed/
  );
});

test("wrong RSA signature is rejected", async () => {
  const { privateKeyPem, kid } = generateKeyPair();
  const { publicKeyPem: otherPublic } = generateKeyPair({ kid });

  const token = signJwt(baseSignArgs(privateKeyPem, kid));

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(otherPublic, kid))),
    /Library verification failed/
  );
});

test("expired token is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const args = baseSignArgs(privateKeyPem, kid);
  args.claims.expiresInSeconds = -10;
  const token = signJwt(args);

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /expired|jwt expired/
  );
});

test("future nbf is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: now + 600, iat: now, nbf: now + 300,
    jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /not (yet|active)/i
  );
});

test("missing exp claim is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /exp/i
  );
});

test("wrong iss is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const args = baseSignArgs(privateKeyPem, kid);
  args.claims.iss = "https://attacker.local";
  const token = signJwt(args);

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /issuer/i
  );
});

test("wrong aud is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const args = baseSignArgs(privateKeyPem, kid);
  args.claims.aud = "other-audience";
  const token = signJwt(args);

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /audience/i
  );
});

test("missing tenantId is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: now + 600, iat: now, jti: "j", realm: "runtime",
    appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /tenantId|tenant_id/i
  );
});

test("missing appId is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: now + 600, iat: now, jti: "j", realm: "runtime",
    tenantId: TENANT_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /appId|app_id/i
  );
});

test("roles must be array of strings", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: now + 600, iat: now, jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: [42, "admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /roles/i
  );
});

test("tampered payload (signature mismatch) is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const token = signJwt(baseSignArgs(privateKeyPem, kid));
  const [h, p, s] = token.split(".");
  const decoded = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  decoded.sub = "attacker";
  const tampered = `${h}.${Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url")}.${s}`;

  await assert.rejects(
    () => verifyJwt(tampered, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /Library verification failed/
  );
});

test("malformed JWT (not three parts) is rejected", async () => {
  const { publicKeyPem, kid } = generateKeyPair();
  await assert.rejects(
    () => verifyJwt("not.a.valid.jwt", baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /three parts/
  );
  await assert.rejects(
    () => verifyJwt("only.two", baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /three parts/
  );
  await assert.rejects(
    () => verifyJwt("", baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /empty/
  );
});

test("kid with traversal characters is rejected before lookup", async () => {
  const { privateKeyPem, publicKeyPem } = generateKeyPair();
  const evilKid = "../../etc/passwd";
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid: evilKid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  let lookupCalled = false;
  await assert.rejects(
    () => verifyJwt(token, {
      ...baseVerifyOpts(async () => { lookupCalled = true; return publicKeyPem; }),
    }),
    /Invalid kid/
  );
  assert.equal(lookupCalled, false, "key resolver must not be called for invalid kid");
});

test("token with jku header is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid, jku: "https://attacker.local/jwks.json" });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /jku|x5u|untrusted/i
  );
});

test("token with x5u header is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid, x5u: "https://attacker.local/cert.pem" });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /jku|x5u|untrusted/i
  );
});

test("wrong typ is rejected", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const header = base64UrlJson({ alg: "RS256", typ: "NOT-JWT", kid });
  const payload = base64UrlJson({
    iss: ISSUER, aud: AUDIENCE, sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000), jti: "j", realm: "runtime",
    tenantId: TENANT_ID, appId: APP_ID, roles: ["admin"], tokenType: "access"
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKeyPem, "base64url");
  const token = `${unsigned}.${signature}`;

  await assert.rejects(
    () => verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid))),
    /typ/i
  );
});

test("refresh token rejected when expected access type", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const args = baseSignArgs(privateKeyPem, kid);
  args.claims.tokenType = "refresh";
  const token = signJwt(args);

  await assert.rejects(
    () => verifyJwt(token, {
      ...baseVerifyOpts(makeResolver(publicKeyPem, kid)),
      expectedTokenType: "access"
    }),
    /Token type mismatch/
  );
});

test("verify requires either jwks or keyResolver", async () => {
  const { privateKeyPem, kid } = generateKeyPair();
  const token = signJwt(baseSignArgs(privateKeyPem, kid));

  await assert.rejects(
    () => verifyJwt(token, { expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
    /requires either jwks or keyResolver/
  );
});

test("aud as array containing expected audience succeeds", async () => {
  const { privateKeyPem, publicKeyPem, kid } = generateKeyPair();
  const args = baseSignArgs(privateKeyPem, kid);
  args.claims.aud = ["other-app", AUDIENCE, "third-app"];
  const token = signJwt(args);

  const claims = await verifyJwt(token, baseVerifyOpts(makeResolver(publicKeyPem, kid)));
  assert.ok(Array.isArray(claims.aud));
});
