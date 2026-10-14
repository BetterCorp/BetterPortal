import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createWorkOSState, readWorkOSStateCookie, verifyWorkOSState, workOSStateCookie, WORKOS_STATE_COOKIE, WorkOSStateClaims
} from "../src/plugins/service-betterportal-auth-workos/oauthState.js";

test("pending OAuth state is atomically consumed across store instances", (t) => {
  const root = mkdtempSync(join(tmpdir(), "bp-workos-claims-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = new WorkOSStateClaims(join(root, "pending"));
  const second = new WorkOSStateClaims(join(root, "pending"));
  const state = createWorkOSState("/reports", { tenantId: "tenant", appId: "app" });
  assert.equal(second.claim(state), false, "a state was never issued");
  first.issue(state);
  assert.equal(second.claim(state), true);
  assert.equal(first.claim(state), false, "the second process cannot reuse the same state");
});

test("OAuth state needs the browser proof and matching app scope", () => {
  const scope = { tenantId: "tenant", appId: "app" };
  const state = createWorkOSState("/reports", scope);
  assert.equal(verifyWorkOSState(state, undefined, scope), undefined);
  assert.equal(verifyWorkOSState(state, "wrong", scope), undefined);
  assert.doesNotThrow(() => verifyWorkOSState("éé", "AA", scope));
  assert.equal(verifyWorkOSState("éé", "AA", scope), undefined);
  assert.equal(verifyWorkOSState(state, state, { tenantId: "tenant", appId: "other" }), undefined);
  assert.equal(verifyWorkOSState(state, state, scope), "/reports");
  const cookie = workOSStateCookie(state);
  assert.equal(WORKOS_STATE_COOKIE, "__Host-bp_workos_oauth_state");
  assert.match(cookie, /; Path=\/; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/);
  assert.doesNotMatch(cookie, /; Domain=/i);
  assert.equal(readWorkOSStateCookie(`other=1; ${cookie.split(";", 1)[0]}`), state);
  assert.equal(readWorkOSStateCookie(`bp_workos_oauth_state=${state}`), undefined,
    "a sibling domain's legacy parent-domain cookie must not prove the callback");
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
