import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkOSState, readWorkOSStateCookie, verifyWorkOSState, workOSStateCookie
} from "../src/plugins/service-betterportal-auth-workos/oauthState.js";

test("OAuth state needs the browser proof and matching app scope", () => {
  const scope = { tenantId: "tenant", appId: "app" };
  const state = createWorkOSState("/reports", scope);
  assert.equal(verifyWorkOSState(state, undefined, scope), undefined);
  assert.equal(verifyWorkOSState(state, "wrong", scope), undefined);
  assert.equal(verifyWorkOSState(state, state, { tenantId: "tenant", appId: "other" }), undefined);
  assert.equal(verifyWorkOSState(state, state, scope), "/reports");
  assert.equal(readWorkOSStateCookie(`other=1; ${workOSStateCookie(state, true).split(";", 1)[0]}`), state);
});

test("OAuth state expires after ten minutes", (t) => {
  const scope = { tenantId: "tenant", appId: "app" };
  const issued = Date.now();
  let now = issued;
  t.mock.method(Date, "now", () => now);
  const state = createWorkOSState("/", scope);
  now = issued + 10 * 60_000 + 1;
  assert.equal(verifyWorkOSState(state, state, scope), undefined);
});
