import assert from "node:assert/strict";
import test from "node:test";
import login from "../src/plugins/service-betterportal-auth-workos/bp-routes/login/GET.js";

test("OAuth uses an absolute service callback when UI aliases are ambiguous", async () => {
  for (const publicUrl of ["https://app.test/login", null]) {
    let callback = "";
    const result = await login({ query: {}, config: { clientId: "client_test", apiKey: "sk_test" },
      app: { defaultRoute: "/dashboard" }, plugin: { getAuthorizationUrl: (_config: unknown, options: { redirectUri: string }) => {
        callback = options.redirectUri; return "https://provider.test/authorize";
      } }, route: () => ({ absoluteUiPath: publicUrl, absoluteViewPath: "https://auth.test/login" }) } as never);
    assert.equal(result.status, "ok");
    assert.equal(callback, publicUrl ?? "https://auth.test/login");
    assert.equal(result.authorizationUrl, "https://provider.test/authorize");
  }
  let called = false;
  const unavailable = await login({ query: {}, config: { clientId: "client_test", apiKey: "sk_test" }, app: { defaultRoute: "/dashboard" },
    plugin: { getAuthorizationUrl: () => { called = true; return "https://provider.test/authorize"; } },
    route: () => ({ absoluteUiPath: null, absoluteViewPath: null }) } as never);
  assert.equal(unavailable.status, "error");
  assert.equal(called, false);
});
