import assert from "node:assert/strict";
import test from "node:test";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-workos/bp-routes/login/_renderer.bootstrap5/GET.js";

const context = { request: { query: {} }, app: { defaultRoute: "/fallback" }, route: () => ({
  apiPath: "/login", viewPath: "/login", uiPath: "/login",
  absoluteApiPath: "https://auth.test/login", absoluteViewPath: "https://auth.test/login", absoluteUiPath: "https://app.test/login"
}) } as unknown as ViewRenderContext;

test("logout preserves the requested destination and otherwise uses the app fallback", () => {
  const data = { status: "ok" as const, loggedOut: true, loginUI: "default" as const, scopes: [] };
  for (const key of ["next", "redirect"]) {
    const rendered = toHtmlString(render(data, { ...context, request: { ...context.request, query: { [key]: "/billing", state: "/login-return" } } }));
    assert.match(rendered, /href="\/billing"/);
  }
  assert.match(toHtmlString(render(data, context)), /href="\/fallback"/);
});
