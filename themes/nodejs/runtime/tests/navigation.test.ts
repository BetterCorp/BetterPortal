import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Route } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";

async function shell(t: TestContext, respond: (route: Route) => Promise<void>, stored = {}, initialUrl = "https://service.test/dashboard") {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const asset = await buildBetterPortalShellRuntimeAsset({});
  await page.addInitScript(value => localStorage.setItem("bp.headers", JSON.stringify(value)), stored);
  await page.route("https://service.test/**", respond);
  await page.route("https://auth.test/**", respond);
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: `<!doctype html>
    <html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'></head><body>
    <div data-bp-shell-root data-bp-menu-health="false" data-bp-login-url="https://auth.test/login"
      data-bp-services='{"service":"https://service.test","auth":"https://auth.test"}'
      data-bp-routes='[{"href":"/tools/dashboard","requestUrl":"https://service.test/dashboard","serviceId":"service","kind":"page"},{"href":"/auth/login","requestUrl":"https://auth.test/login","serviceId":"auth","kind":"page"}]'>
      <a id="menu" href="/tools/dashboard" data-bp-route-link data-bp-service="service" hx-get="https://service.test/dashboard" hx-target="#bp-main">Dashboard</a>
      <main id="bp-main" data-bp-service="service" hx-get="${initialUrl}" ${initialUrl ? 'hx-trigger="load"' : ''} hx-target="#bp-main" hx-swap="innerHTML"><p>Loading</p></main>
    </div><script>${asset.body}</script></body></html>` }));
  await page.goto("https://app.test/tools/dashboard");
  return { page, errors };
}

const html = (route: Route, body: string, status = 200, headers = {}) => route.fulfill({ status, contentType: "text/html", body, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "HX-Location,HX-Redirect,HX-Trigger,BP-SetHeader", ...headers } });

test("an empty initial route does not turn the whole content area into a link", async t => {
  let requests = 0;
  const { page, errors } = await shell(t, route => { requests++; return html(route, "Unexpected"); }, {}, "");
  await page.locator("#bp-main p").click();
  assert.equal(await page.locator("#bp-main").textContent(), "Loading");
  assert.equal(await page.locator("#bp-main").getAttribute("hx-get"), null);
  assert.equal(requests, 0);
  assert.deepEqual(errors, []);
});

test("initial 401 loads login promptly and content clicks cannot reissue the initial load", async t => {
  let contentRequests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("service.test")) { contentRequests++; return html(route, "Unauthorized", 401); }
    return html(route, '<div id="login"><p id="blank">Sign in</p></div>');
  });
  await page.waitForSelector("#login");
  await page.locator("#blank").click();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(contentRequests, 1);
  assert.equal(await page.locator("#bp-main").getAttribute("hx-get"), null);
  assert.deepEqual(errors, []);
});

test("disabled auth links never preload or navigate, including their child elements", async t => {
  let authRequests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("auth.test")) { authRequests++; return html(route, '<p id="unexpected">Auth flow</p>'); }
    return html(route, '<a id="disabled" class="btn disabled" aria-disabled="true" href="/auth/login?action=google&amp;next=%2Ftools%2Fdashboard" hx-preload="mouseover"><span id="mark">Google sign-in unavailable</span></a>');
  });
  await page.waitForSelector("#disabled");
  await page.locator("#mark").dispatchEvent("mouseover");
  await page.locator("#disabled").dispatchEvent("focusin");
  await page.locator("#mark").dispatchEvent("click", { button: 0 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(authRequests, 0);
  assert.equal(new URL(page.url()).pathname, "/tools/dashboard");
  assert.deepEqual(errors, []);
});

test("a stalled refresh cannot indefinitely block login after the initial 401", async t => {
  const { page } = await shell(t, route => {
    if (route.request().url().endsWith("/refresh")) return new Promise<void>(() => {});
    if (route.request().url().includes("service.test")) return html(route, "Unauthorized", 401);
    return html(route, '<p id="login">Sign in</p>');
  }, { authorization: { value: "Bearer stale", owner: "auth", scope: null, expires: Math.floor(Date.now() / 1000) + 3600, refresh: "/refresh" } });
  await page.waitForSelector("#login", { timeout: 7000 });
});

test("hovering auth links is inert and explicit clicks retain tenant URLs and query parameters", async t => {
  let authRequests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("auth.test")) { authRequests++; return html(route, '<p id="login">Sign in</p>'); }
    return html(route, '<a id="signin" href="/auth/login?action=google&amp;next=%2Ftools%2Fdashboard"><span>Google</span></a>');
  });
  await page.waitForSelector("#signin");
  await page.locator("#signin").dispatchEvent("mouseover");
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(authRequests, 0);
  assert.equal(await page.locator("#signin").getAttribute("href"), "/auth/login?action=google&next=%2Ftools%2Fdashboard");
  assert.equal(await page.locator("#signin").getAttribute("hx-get"), "https://auth.test/login?action=google&next=%2Ftools%2Fdashboard");
  await page.locator("#signin").click();
  await page.waitForSelector("#login");
  assert.equal(authRequests, 1);
  assert.equal(new URL(page.url()).pathname, "/auth/login");
  assert.equal(new URL(page.url()).searchParams.get("next"), "/tools/dashboard");
  assert.deepEqual(errors, []);
});

test("preloads cannot follow redirects or apply response directives until a click", async t => {
  let status = 200;
  let preloads = 0;
  let loginRequests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("auth.test")) { loginRequests++; return html(route, '<p id="login">Sign in</p>'); }
    if (route.request().url().endsWith("/next")) {
      preloads++;
      return html(route, "Do not render", status, status === 302 ? { Location: "https://auth.test/login" } : { "HX-Location": "https://auth.test/login", "HX-Trigger": "preload-side-effect", "BP-SetHeader": "Authorization=unexpected" });
    }
    return html(route, '<a id="next" href="/tools/dashboard/next" hx-get="https://service.test/next" hx-target="#bp-main">Next</a>');
  });
  await page.waitForSelector("#next");
  await page.evaluate(() => {
    (window as any).sideEffects = 0;
    document.body.addEventListener("preload-side-effect", () => (window as any).sideEffects++);
  });
  const hover = async () => {
    await page.locator("#next").dispatchEvent("mouseover");
    await page.evaluate(async () => { await (document.querySelector("#next") as any)._htmx?.preload?.prefetch; });
  };
  await hover();
  assert.equal(preloads, 1);
  assert.equal(loginRequests, 0);
  assert.equal(await page.evaluate(() => (window as any).sideEffects), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("bp.headers")), "{}");
  assert.equal(await page.locator("#next").count(), 1);
  for (status of [401, 302]) {
    await page.evaluate(() => { delete (document.querySelector("#next") as any)._htmx.preload; });
    await hover();
    assert.equal(loginRequests, 0);
    assert.equal(await page.locator("#next").count(), 1);
  }
  status = 200;
  await hover();
  await page.locator("#next").click();
  await page.waitForSelector("#login");
  assert.equal(loginRequests, 1, "response navigation is allowed after explicit activation");
  assert.equal(await page.evaluate(() => (window as any).sideEffects), 1);
  assert.deepEqual(errors, []);
});

test("initial 401 ignores service navigation directives in favor of the configured login", async t => {
  let otherRequests = 0;
  const { page } = await shell(t, route => {
    if (route.request().url().endsWith("/wrong")) { otherRequests++; return html(route, "Wrong destination"); }
    if (route.request().url().includes("service.test")) return html(route, "Unauthorized", 401, { "HX-Location": "https://service.test/wrong" });
    return html(route, '<p id="login">Sign in</p>');
  });
  await page.waitForSelector("#login");
  assert.equal(otherRequests, 0);
});

test("clicking an in-flight redirect preload falls back to a normal request", async t => {
  const pending = Promise.withResolvers<Route>();
  let requests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("auth.test")) return html(route, '<p id="login">Sign in</p>');
    if (route.request().url().endsWith("/redirect")) {
      if (++requests === 1) { pending.resolve(route); return Promise.resolve(); }
      assert.equal(route.request().headers()["hx-request-type"], "partial");
      return html(route, '<p id="login">Sign in</p>');
    }
    return html(route, '<a id="redirect" href="/tools/dashboard/redirect" hx-get="https://service.test/redirect" hx-target="#bp-main">Redirect</a>');
  });
  await page.waitForSelector("#redirect");
  await page.locator("#redirect").dispatchEvent("mouseover");
  const prefetch = await pending.promise;
  await page.locator("#redirect").click();
  await html(prefetch, "", 302, { Location: "https://auth.test/login" });
  await page.waitForSelector("#login");
  assert.equal(requests, 2);
  assert.deepEqual(errors, []);
});

test("a late failed refresh cannot replace a newer user navigation with login", async t => {
  const refreshStarted = Promise.withResolvers<Route>();
  let contentRequests = 0;
  let loginRequests = 0;
  const { page } = await shell(t, route => {
    if (route.request().url().endsWith("/refresh")) { refreshStarted.resolve(route); return Promise.resolve(); }
    if (route.request().url().includes("auth.test")) { loginRequests++; return html(route, "Login"); }
    return ++contentRequests === 1 ? html(route, "Unauthorized", 401) : html(route, '<p id="new-page">New page</p>');
  }, { authorization: { value: "Bearer stale", owner: "auth", scope: null, expires: Math.floor(Date.now() / 1000) + 3600, refresh: "/refresh" } });
  const refreshRoute = await refreshStarted.promise;
  assert.equal(await page.locator("#bp-main").getAttribute("data-bp-loading"), "");
  await page.locator("#menu").click();
  await page.waitForSelector("#new-page");
  await html(refreshRoute, "Expired", 401);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(loginRequests, 0);
  assert.equal(await page.locator("#new-page").count(), 1);
});
