import assert from "node:assert/strict";
import test from "node:test";
import login from "../src/plugins/service-betterportal-auth-workos/bp-routes/login/GET.js";
import { createWorkOSState, verifyWorkOSState } from "../src/plugins/service-betterportal-auth-workos/oauthState.js";

test("OAuth uses an absolute service callback when UI aliases are ambiguous", async () => {
  for (const publicUrl of ["https://app.test/login", null]) {
    let callback = "";
    let state = "";
    const responseHeaders = new Headers();
    const result = await login({ query: {}, config: { clientId: "client_test", apiKey: "sk_test" },
      tenant: { id: "tenant" }, app: { id: "app", defaultRoute: "/dashboard" }, plugin: { getAuthorizationUrl: (_config: unknown, options: { redirectUri: string; state: string }) => {
        callback = options.redirectUri; state = options.state; return "https://provider.test/authorize";
      } }, responseHeaders, route: () => ({ absoluteUiPath: publicUrl, absoluteViewPath: "https://auth.test/login" }) } as never);
    assert.equal(result.status, "ok");
    assert.equal(callback, publicUrl ?? "https://auth.test/login");
    assert.equal(result.authorizationUrl, "https://provider.test/authorize");
    assert.equal(verifyWorkOSState(state, state, { tenantId: "tenant", appId: "app" }), "/dashboard");
    assert.match(responseHeaders.get("set-cookie") ?? "", /bp_workos_oauth_state=.*HttpOnly; SameSite=Lax; Secure/);
  }
  let called = false;
  const unavailable = await login({ query: {}, config: { clientId: "client_test", apiKey: "sk_test" }, tenant: { id: "tenant" }, app: { id: "app", defaultRoute: "/dashboard" },
    plugin: { getAuthorizationUrl: () => { called = true; return "https://provider.test/authorize"; } },
    route: () => ({ absoluteUiPath: null, absoluteViewPath: null }) } as never);
  assert.equal(unavailable.status, "error");
  assert.equal(called, false);
});

test("an unsolicited or cross-app WorkOS callback cannot exchange its authorization code", async () => {
  const state = createWorkOSState("/dashboard", { tenantId: "tenant", appId: "app" });
  let exchanges = 0;
  const callback = (proof?: string, appId = "app") => login({
    query: { code: "attacker-code", state }, headers: proof ? { "x-bp-workos-state": proof } : {},
    config: { clientId: "client_test", apiKey: "sk_test" },
    tenant: { id: "tenant" }, app: { id: appId, defaultRoute: "/dashboard" },
    plugin: { authenticateWithCode: async () => { exchanges++; throw new Error("exchange attempted"); } }
  } as never);
  assert.equal((await callback()).status, "error");
  assert.equal((await callback("forged")).status, "error");
  assert.equal((await callback(state, "another-app")).status, "error");
  assert.equal(exchanges, 0);
  assert.equal((await callback(state)).status, "error");
  assert.equal(exchanges, 1, "only a matching browser proof reaches code exchange");
  const direct = await login({
    query: { code: "direct-code", state }, headers: { cookie: `bp_workos_oauth_state=${state}` },
    config: { clientId: "client_test", apiKey: "sk_test" }, tenant: { id: "tenant" },
    app: { id: "app", defaultRoute: "/dashboard" },
    plugin: { authenticateWithCode: async () => { exchanges++; throw new Error("exchange attempted"); } }
  } as never);
  assert.equal(direct.status, "error");
  assert.equal(exchanges, 2, "a same-origin cookie also proves a direct service login");
});
