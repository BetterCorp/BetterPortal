import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  CONFIG_TICKET_AUDIENCE,
  signServiceConfigTicket,
  verifyServiceConfigTicket
} from "../src/runtime/configTicket.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});
const KID = "test-kid-1";
const ISSUER = "http://cp.local:4000";
const SERVICE_ID = "service.betterportal.example";

const keyResolver = (kid: string): string => {
  if (kid !== KID) throw new Error(`unknown kid ${kid}`);
  return publicKey;
};

function sign(overrides: { expiresInSeconds?: number } = {}): string {
  return signServiceConfigTicket({
    privateKeyPem: privateKey,
    kid: KID,
    issuer: ISSUER,
    tenantId: "tenant-a",
    serviceId: SERVICE_ID,
    actions: ["config.read", "config.write"],
    expiresInSeconds: overrides.expiresInSeconds ?? 300
  });
}

test("round-trips a CP-signed ticket", async () => {
  const claims = await verifyServiceConfigTicket(sign(), {
    keyResolver,
    issuer: ISSUER,
    serviceId: SERVICE_ID
  });
  assert.equal(claims.tenantId, "tenant-a");
  assert.equal(claims.serviceId, SERVICE_ID);
  assert.equal(claims.realm, "control-plane");
  assert.deepEqual(claims.actions, ["config.read", "config.write"]);
});

test("rejects a ticket for a different serviceId", async () => {
  await assert.rejects(
    verifyServiceConfigTicket(sign(), { keyResolver, issuer: ISSUER, serviceId: "service.other" }),
    /serviceId mismatch/
  );
});

test("rejects a ticket with the wrong issuer", async () => {
  await assert.rejects(
    verifyServiceConfigTicket(sign(), { keyResolver, issuer: "http://evil.local", serviceId: SERVICE_ID }),
    /issuer|jwt issuer invalid/i
  );
});

test("rejects an expired ticket", async () => {
  await assert.rejects(
    verifyServiceConfigTicket(sign({ expiresInSeconds: -10 }), { keyResolver, issuer: ISSUER, serviceId: SERVICE_ID }),
    /expired|jwt expired/i
  );
});

test("rejects a ticket signed by an untrusted key", async () => {
  const other = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const forged = signServiceConfigTicket({
    privateKeyPem: other.privateKey,
    kid: KID,
    issuer: ISSUER,
    tenantId: "tenant-a",
    serviceId: SERVICE_ID,
    actions: ["config.write"],
    expiresInSeconds: 300
  });
  await assert.rejects(
    verifyServiceConfigTicket(forged, { keyResolver, issuer: ISSUER, serviceId: SERVICE_ID }),
    /verification failed|invalid signature/i
  );
});

test("rejects an HS256 token even with a matching secret-as-key (alg confusion)", async () => {
  // Attacker tries to pass an HMAC token; verifier must pin RS256.
  const hs = jwt.sign(
    {
      iss: ISSUER,
      aud: [CONFIG_TICKET_AUDIENCE],
      sub: "admin",
      realm: "control-plane",
      tenantId: "tenant-a",
      serviceId: SERVICE_ID,
      actions: ["config.write"]
    },
    "some-shared-secret",
    { algorithm: "HS256", keyid: KID, expiresIn: 300 }
  );
  await assert.rejects(
    verifyServiceConfigTicket(hs, { keyResolver, issuer: ISSUER, serviceId: SERVICE_ID }),
    /Algorithm not allowed|verification failed/i
  );
});
