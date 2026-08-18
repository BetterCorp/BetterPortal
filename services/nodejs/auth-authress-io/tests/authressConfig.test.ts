import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUTHRESS_GROUP_CACHE_TTL_MS, AuthressGroupCache } from "../src/groupCache.js";
import { resolveAuthressAppConfig } from "../src/plugins/service-betterportal-auth-authress-io/index.js";
import handleRefresh from "../src/plugins/service-betterportal-auth-authress-io/bp-routes/refresh/POST.js";

test("Authress audience validation is opt-in", () => {
  const config = resolveAuthressAppConfig({
    authressApiUrl: "https://auth.example.com/",
    applicationId: "app_123"
  });

  assert.equal(config?.expectedIssuer, "https://auth.example.com");
  assert.equal(config?.expectedAudience, undefined);
  assert.equal(config?.jwksUri, "https://auth.example.com/.well-known/openid-configuration/jwks");
});

test("Authress refresh preserves profile claims missing from the provider token", async () => {
  let issuedInput: { roles?: string[]; name?: string; email?: string; picture?: string } | undefined;
  await handleRefresh({
    config: { authressApiUrl: "https://auth.example.com", applicationId: "app_123" },
    request: { refreshToken: "bp-refresh" },
    headers: {},
    tenant: { id: "tenant-1" },
    app: { id: "app-1" },
    plugin: {
      verifyRefreshToken: async () => ({
        authProvider: "authress.io",
        refreshContext: { providerToken: "provider-token" },
        name: "Example User",
        email: "user@example.com",
        picture: "https://example.com/user.png"
      }),
      verifyAuthressToken: async () => ({ sub: "user-1", roles: [] }),
      resolveAuthressRoles: async () => ["Admin"],
      issueTokenPair: (input: typeof issuedInput) => {
        issuedInput = input;
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accessTokenExpiresInSeconds: 900,
          refreshTokenExpiresInSeconds: 3600
        };
      }
    },
    bpHeaders: { set() {}, remove() {} }
  } as any);

  assert.deepEqual(issuedInput?.roles, ["Admin"]);
  assert.equal(issuedInput?.name, "Example User");
  assert.equal(issuedInput?.email, "user@example.com");
  assert.equal(issuedInput?.picture, "https://example.com/user.png");
});

test("Authress group cache persists roles per tenant and app for one hour", () => {
  const dir = mkdtempSync(join(tmpdir(), "bp-authress-groups-"));
  const path = join(dir, "groups.json");
  try {
    new AuthressGroupCache(path).write("tenant-1", "app-1", { "user-1": ["Admin"] }, 1_000);
    const cache = new AuthressGroupCache(path);

    assert.deepEqual(cache.read("tenant-1", "app-1", "user-1", 1_000 + AUTHRESS_GROUP_CACHE_TTL_MS - 1), {
      roles: ["Admin"],
      fresh: true
    });
    assert.equal(cache.read("tenant-1", "app-1", "user-1", 1_000 + AUTHRESS_GROUP_CACHE_TTL_MS).fresh, false);
    assert.deepEqual(cache.read("tenant-1", "app-2", "user-1", 1_000), { roles: [], fresh: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
