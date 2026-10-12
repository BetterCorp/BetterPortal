import assert from "node:assert/strict";
import test from "node:test";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-authress-io/bp-routes/login/_renderer.bootstrap5/GET.js";

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


test("non-interactive auth responses do not require a POST service destination", () => {
  const unavailable = { ...context, route: () => null } as ViewRenderContext;
  const base = { status: "ok" as const, loginUI: "default" as const, scopes: [] };
  assert.match(toHtmlString(render({ ...base, loggedOut: true }, unavailable)), /Signed out/);
  for (const data of [{ ...base, alreadyLoggedIn: true }, { ...base, status: "error" as const, message: "Provider unavailable" }]) {
    const html = toHtmlString(render(data, unavailable));
    assert.doesNotMatch(html, /<form[^>]*id="bp-authress-token-form"/);
  }
  assert.throws(() => render(base, unavailable), /Authress login service route is unavailable/);
});
