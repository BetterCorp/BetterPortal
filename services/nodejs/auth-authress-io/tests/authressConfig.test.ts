import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthressAppConfig } from "../src/plugins/service-betterportal-auth-authress-io/index.js";

test("Authress audience validation is opt-in", () => {
  const config = resolveAuthressAppConfig({
    authressApiUrl: "https://auth.example.com/",
    applicationId: "app_123"
  });

  assert.equal(config?.expectedIssuer, "https://auth.example.com");
  assert.equal(config?.expectedAudience, undefined);
  assert.equal(config?.jwksUri, "https://auth.example.com/.well-known/openid-configuration/jwks");
});
