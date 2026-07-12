import assert from "node:assert/strict";
import test from "node:test";
import { isUserFacingRoute } from "../src/plugins/service-betterportal-theme-bootstrap1/theme/index.js";

test("API routes are never browser navigation candidates", () => {
  assert.equal(isUserFacingRoute({ kind: "page", href: "/tunnels/dashboard" }), true);
  assert.equal(isUserFacingRoute({ kind: "api", href: "/tunnels/dashboard" }), false);
  assert.equal(isUserFacingRoute({ href: "/_bp/service/example/tunnels/dashboard" }), false);
});
