import assert from "node:assert/strict";
import test from "node:test";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-default/bp-routes/register/_renderer.bootstrap5/GET.js";

const context = { request: { query: {} }, routeUrl: () => ({
  apiPath: "/login", viewPath: "/login", uiPath: null,
  absoluteApiPath: "https://auth.test/login", absoluteViewPath: "https://auth.test/login", absoluteUiPath: null
}) } as unknown as ViewRenderContext;

test("registration forms remain usable without a unique mounted login page", () => {
  assert.match(toHtmlString(render({ status: "ok", registrationOpen: true }, context)), /<form/);
  const invalid = toHtmlString(render({ status: "error", message: "Passwords differ" }, context));
  assert.match(invalid, /<form/);
  assert.match(invalid, /Passwords differ/);
  const success = toHtmlString(render({ status: "ok", user: { id: "admin", username: "admin", isFirstAdmin: true } }, context));
  assert.match(success, /Admin created/);
  assert.doesNotMatch(success, /hx-trigger="load/);
});
