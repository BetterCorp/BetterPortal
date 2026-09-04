import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, generateKeyPairSync, createPublicKey } from "node:crypto";
import type { RsaPublicJwk } from "@betterportal/framework";
import type { PostgresStorage } from "./storage/postgres.js";

export interface CpKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  kid: string;
}

export interface CpBootstrapState {
  keyPair: CpKeyPair;
  /** Public RSA JWK derived from keyPair. */
  jwk: RsaPublicJwk;
  /** Issuer URL used in tokens (iss claim). */
  issuer: string;
  /** Audience for tokens minted by this CP. */
  audience: string;
  /** Stable identifier for this CP instance (cpId). */
  cpId: string;
  /** JWKS URI the CP exposes (built from issuer). */
  jwksUri: string;
}

/**
 * Load or generate the CP keypair + derive JWK + assemble bootstrap state.
 * Returns the same object on subsequent calls within a process.
 */
let cached: CpBootstrapState | null = null;

export async function cpBootstrap(input: {
  keyStorePath: string;
  postgres?: PostgresStorage;
  issuer?: string;
  audience: string;
  host: string;
  port: number;
}): Promise<CpBootstrapState> {
  if (cached) return cached;

  const keyPath = resolve(input.keyStorePath);
  const keyPair = input.postgres
    ? await input.postgres.loadOrCreateIdentity(generateKeyPair)
    : loadOrGenerateKeyPair(keyPath);
  assertKeyPair(keyPair, input.postgres ? "PostgreSQL" : keyPath);

  if (!input.issuer) {
    throw new Error("Config manager cpIssuer is required and must be the public control-plane issuer URL.");
  }
  const issuer = input.issuer;
  const jwksUri = `${issuer.replace(/\/+$/, "")}/.well-known/jwks.json`;
  const cpId = `cp-${keyPair.kid.slice(0, 12)}`;

  cached = {
    keyPair,
    jwk: publicKeyToJwk(keyPair.publicKeyPem, keyPair.kid),
    issuer: issuer.replace(/\/+$/, ""),
    audience: input.audience,
    cpId,
    jwksUri
  };
  return cached;
}

function loadOrGenerateKeyPair(filePath: string): CpKeyPair {
  if (existsSync(filePath)) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as CpKeyPair;
    return parsed;
  }
  const pair = generateKeyPair();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(pair, null, 2), { mode: 0o600 });
  return pair;
}

function assertKeyPair(value: CpKeyPair, source: string): void {
  if (typeof value?.privateKeyPem !== "string" || typeof value?.publicKeyPem !== "string" || typeof value?.kid !== "string") {
    throw new Error(`Malformed CP keypair in ${source}`);
  }
}

function generateKeyPair(): CpKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const kid = randomBytes(16).toString("base64url");
  return { privateKeyPem: privateKey, publicKeyPem: publicKey, kid };
}

function publicKeyToJwk(publicKeyPem: string, kid: string): RsaPublicJwk {
  const keyObject = createPublicKey(publicKeyPem);
  const jwk = keyObject.export({ format: "jwk" }) as { kty: string; n: string; e: string };
  return {
    kty: "RSA",
    use: "sig",
    alg: "RS256",
    kid,
    n: jwk.n,
    e: jwk.e
  };
}
