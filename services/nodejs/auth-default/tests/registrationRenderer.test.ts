import assert from "node:assert/strict";
import test from "node:test";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-default/bp-routes/register/_renderer.bootstrap5/GET.js";

const context = { request: { query: {} }, routeUrl: (input: { path?: string }) => ({
  apiPath: "/login", viewPath: "/login", uiPath: null,
  absoluteApiPath: `https://auth.test${input.path ?? "/register"}`, absoluteViewPath: "https://auth.test/login", absoluteUiPath: null
}) } as unknown as ViewRenderContext;

test("registration forms remain usable without a unique mounted login page", () => {
  const form = toHtmlString(render({ status: "ok", registrationOpen: true }, context));
  assert.match(form, /<form/);
  assert.match(form, /hx-post="https:\/\/auth.test\/register"/);
  assert.doesNotMatch(form, /hx-post="this"/);
  const invalid = toHtmlString(render({ status: "error", message: "Passwords differ" }, context));
  assert.match(invalid, /<form/);
  assert.match(invalid, /Passwords differ/);
  const success = toHtmlString(render({ status: "ok", user: { id: "admin", username: "admin", isFirstAdmin: true } }, context));
  assert.match(success, /Admin created/);
  assert.doesNotMatch(success, /hx-trigger="load/);
});
