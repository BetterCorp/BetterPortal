import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, publicKeyToJwk } from "../src/runtime/auth/keypair.js";
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

test("refreshes cached JWKS when a rotated kid is unknown", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const first = generateKeyPair({ kid: "first" });
  const second = generateKeyPair({ kid: "second" });
  let now = 1_000;
  let keys = [publicKeyToJwk(first.publicKeyPem, first.kid)];
  let fetches = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    fetches += 1;
    return new Response(JSON.stringify({ keys }), { headers: { "content-type": "application/json" } });
  };
  t.after(() => {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
    clearJwksCache();
  });

  const options = { issuer: "https://issuer.example", jwksUri: "https://issuer.example/jwks" };
  assert.equal(await getSigningKeyForKid(options, first.kid), first.publicKeyPem);
  keys = [publicKeyToJwk(second.publicKeyPem, second.kid)];
  now += 2_001;
  assert.equal(await getSigningKeyForKid(options, second.kid), second.publicKeyPem);
  assert.equal(fetches, 2);
});

test("JWKS lookup rejects oversized streamed provider responses", async (t) => {
  const originalFetch = globalThis.fetch;
  const key = generateKeyPair({ kid: "bounded" });
  const payload = new TextEncoder().encode(JSON.stringify({
    keys: [publicKeyToJwk(key.publicKeyPem, key.kid)], padding: "x".repeat(512 * 1024)
  }));
  globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(payload); controller.close(); }
  }), { headers: { "content-type": "application/json" } });
  t.after(() => { globalThis.fetch = originalFetch; clearJwksCache(); });
  await assert.rejects(getSigningKeyForKid({
    issuer: "https://oversized.example", jwksUri: "https://oversized.example/jwks"
  }, key.kid), /JWKS response too large/);
});


test("unpaired candidate lookups neither reuse nor populate the issuer cache", async (t) => {
  clearJwksCache();
  t.after(clearJwksCache);
  const first = generateKeyPair({ kid: "candidate" });
  const second = generateKeyPair({ kid: "candidate" });
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    const key = ++fetches === 1 ? first : second;
    return Response.json({ keys: [publicKeyToJwk(key.publicKeyPem, key.kid)] });
  });
  const options = { issuer: "https://candidate.test", jwksUri: "https://candidate.test/jwks" };
  assert.equal(await getSigningKeyForKid({ ...options, cache: false }, "candidate"), first.publicKeyPem);
  assert.equal(await getSigningKeyForKid(options, "candidate"), second.publicKeyPem);
  assert.equal(fetches, 2, "an unpaired lookup must not populate the pinned cache");
  assert.equal(await getSigningKeyForKid({ ...options, cache: false }, "candidate"), second.publicKeyPem);
  assert.equal(fetches, 3, "an unpaired lookup must not reuse the pinned cache");
  assert.equal(await getSigningKeyForKid(options, "candidate"), second.publicKeyPem);
  assert.equal(fetches, 3, "normal issuer caching must remain intact");
});
