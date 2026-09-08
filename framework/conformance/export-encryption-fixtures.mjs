// Deterministic public test vectors. These keys/nonces must never be used for service data.
import { createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const key = "bp-conformance-only-key-not-for-service-use";
const fixtures = [];
for (const version of [1, 2, 3]) {
  const value = version === 3 ? { number: 42, nested: [null, true, "secret 🔐"] } : "legacy secret 🔐";
  const nonce = Buffer.alloc(version === 1 ? 16 : 12, version);
  const derived = scryptSync(key, "bp-config-store", 32, { N: version === 1 ? 16384 : 32768, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", derived, nonce);
  const plaintext = version === 3 ? JSON.stringify(value) : value;
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const decipher = createDecipheriv("aes-256-gcm", derived, nonce);
  decipher.setAuthTag(tag);
  if (Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8") !== plaintext) throw new Error("Invalid crypto fixture");
  fixtures.push({ id: `storage-v${version}`, key, value, envelope: `enc:aes256gcm${version === 1 ? "" : version}:` + Buffer.concat([nonce, tag, encrypted]).toString("base64") });
}
const content = JSON.stringify(fixtures, null, 2) + "\n";
const file = new URL("encryption-fixtures.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(file, "utf8") !== content) throw new Error("Stale encryption fixtures");
} else await writeFile(file, content);
console.log("Checked deterministic Node AES-GCM/scrypt fixtures");
