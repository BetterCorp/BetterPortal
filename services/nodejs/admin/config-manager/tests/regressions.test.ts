import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRouteTree, flattenRouteTree } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_theme.bootstrap1/GET.js";
import { appRoutePatternKey } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";
import { applyVerifiedServiceOrigin } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";

test("visual routes include the root mount", () => {
  const route = {
    id: "root-route",
    path: "/",
    serviceId: "service.example",
    viewId: "home",
    title: "Home",
    enabled: true
  };
  const rows = flattenRouteTree(buildRouteTree([route]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.path, "/");
  assert.equal(rows[0]?.route?.id, "root-route");
});

test("duplicate route keys follow runtime route matching", () => {
  assert.equal(appRoutePatternKey("/"), appRoutePatternKey("//"));
  assert.equal(appRoutePatternKey("/users/:id"), appRoutePatternKey("/users/{userId}/"));
  assert.notEqual(appRoutePatternKey("/users/new"), appRoutePatternKey("/users/:id"));
});

test("hostname changes require the exact instance API key", () => {
  const service = { hostname: "https://old.example" } as never;
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "other", "https://new.example"), false);
  assert.equal((service as { hostname: string }).hostname, "https://old.example");
  assert.equal(applyVerifiedServiceOrigin(service, "expected", "expected", "https://new.example"), true);
  assert.equal((service as { hostname: string }).hostname, "https://new.example");
});
