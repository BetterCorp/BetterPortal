import { test } from "node:test";
import assert from "node:assert/strict";
import { clearJwksCache, getSigningKeyForKid } from "../src/runtime/auth/jwks.js";

test("JWKS network failures include the URL and underlying cause", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    clearJwksCache();
  });
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND auth.example.invalid"), {
    code: "ENOTFOUND",
    syscall: "getaddrinfo",
    hostname: "auth.example.invalid"
  });
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed", { cause });
  };

  await assert.rejects(
    getSigningKeyForKid({
      issuer: "https://auth.example.invalid",
      jwksUri: "https://auth.example.invalid/.well-known/jwks.json"
    }, "test-kid"),
    /JWKS fetch failed: https:\/\/auth\.example\.invalid\/\.well-known\/jwks\.json: fetch failed code=ENOTFOUND syscall=getaddrinfo hostname=auth\.example\.invalid cause=getaddrinfo ENOTFOUND/
  );
});
