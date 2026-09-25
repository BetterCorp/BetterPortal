import { createHash } from "node:crypto";
import { hostname } from "node:os";

export function credentialDiagnostics(apiKey: string) {
  return {
    keyFingerprint: createHash("sha256").update(apiKey).digest("hex").slice(0, 16),
    configManagerInstance: `${hostname()}:${process.pid}`
  };
}
