import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-default/bp-routes/login/_renderer.bootstrap5/GET.js";

const context = { request: { query: {} }, app: { defaultRoute: "/fallback" }, route: () => ({
  apiPath: "/login", viewPath: "/login", uiPath: "/login",
  absoluteApiPath: "https://auth.test/login", absoluteViewPath: "https://auth.test/login", absoluteUiPath: "https://app.test/login"
}) } as unknown as ViewRenderContext;

test("logout preserves the requested destination and otherwise uses the app fallback", () => {
  const data = { status: "ok" as const, loggedOut: true, loginUI: "default" as const, scopes: [] };
  for (const key of ["next"]) {
    const rendered = toHtmlString(render(data, { ...context, request: { ...context.request, query: { [key]: "/billing", state: "/login-return" } } }));
    assert.match(rendered, /href="\/billing"/);
  }
  assert.match(toHtmlString(render(data, context)), /href="\/fallback"/);
});


test("signed-in Continue and password forms preserve configured destinations without a next query", () => {
  for (const useView of [false, true]) {
    const configured = { ...context, app: { ...context.app, defaultRoute: useView ? "/fallback" : "/dashboard",
      ...(useView ? { auth: { serviceId: "auth", redirects: { afterLogin: { serviceId: "auth", viewId: "dashboard.index" } } } } : {}) },
      route: (input: any) => input?.viewId === "dashboard.index" ? { ...context.route()!, uiPath: "/dashboard" } : context.route(input) };
    const html = toHtmlString(render({ status: "ok", alreadyLoggedIn: true }, configured));
    const destination = /id="bp-login-continue"[^>]*data-next="([^"]+)"/.exec(html)?.[1];
    assert.equal(destination, "/dashboard");
    let click: (() => void) | undefined;
    let navigated = "";
    new Script(/<script>([\s\S]*?)<\/script>/i.exec(html)![1]).runInNewContext({
      document: { getElementById: () => ({ dataset: { next: destination }, addEventListener: (_event: string, handler: () => void) => { click = handler; } }) },
      window: { htmx: { ajax: (_method: string, url: string) => { navigated = url; } } }
    });
    click!();
    assert.equal(navigated, "/dashboard");
    const form = toHtmlString(render({ status: "ok" }, configured));
    assert.match(form, /name="next" value="\/dashboard"/);
    const input = { value: "/dashboard" };
    new Script(/<script>([\s\S]*?)<\/script>/i.exec(form)![1]).runInNewContext({
      document: { getElementById: () => ({ querySelector: () => input, addEventListener: () => {} }) },
      window: { location: { search: "" } }, URLSearchParams
    });
    assert.equal(input.value, "/dashboard");
  }
});
