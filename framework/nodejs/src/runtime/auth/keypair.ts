import { generateKeyPairSync, createPublicKey, randomBytes, type KeyObject } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import type { RsaPublicJwk } from "../../contracts/auth.js";

export interface RsaKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  kid: string;
}

export interface GenerateKeyPairOptions {
  kid?: string;
  modulusLength?: 2048 | 3072 | 4096;
}

export function generateKeyPair(options: GenerateKeyPairOptions = {}): RsaKeyPair {
  const modulusLength = options.modulusLength ?? 2048;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  const kid = options.kid ?? deriveKeyId(publicKey);
  return { privateKeyPem: privateKey, publicKeyPem: publicKey, kid };
}

export function loadOrGenerateKeyPair(filePath: string, options: GenerateKeyPairOptions = {}): RsaKeyPair {
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as RsaKeyPair;
    if (typeof parsed.privateKeyPem !== "string" || typeof parsed.publicKeyPem !== "string" || typeof parsed.kid !== "string") {
      throw new Error(`Keypair file ${filePath} is malformed`);
    }
    return parsed;
  }

  const pair = generateKeyPair(options);
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = filePath + "." + randomBytes(8).toString("hex") + ".tmp";
  try {
    writeFileSync(temporaryPath, JSON.stringify(pair, null, 2), { mode: 0o600, flag: "wx" });
    renameSync(temporaryPath, filePath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return pair;
}

export function publicKeyToJwk(publicKeyPem: string, kid: string): RsaPublicJwk {
  const keyObject = createPublicKey(publicKeyPem);
  const jwk = keyObject.export({ format: "jwk" }) as { kty: string; n: string; e: string };
  if (jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new Error("Public key is not RSA");
  }
  return {
    kty: "RSA",
    use: "sig",
    alg: "RS256",
    kid,
    n: jwk.n,
    e: jwk.e
  };
}

export function deriveKeyId(publicKeyPem: string): string {
  const keyObject = createPublicKey(publicKeyPem);
  const jwk = keyObject.export({ format: "jwk" }) as { n?: string };
  if (!jwk.n) throw new Error("Cannot derive kid from non-RSA key");
  return jwk.n.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16) || "default";
}
