import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Route } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";

async function shell(t: TestContext, respond: (route: Route) => Promise<void>, stored = {}, initialUrl = "https://service.test/dashboard", initialTenantPath = "/tools/dashboard", navigation = false) {
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
  await page.route("https://app.test/**", route => navigation && new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation" ? respond(route) : route.fulfill({ contentType: "text/html", body: `<!doctype html>
    <html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'></head><body>
    <div data-bp-shell-root ${navigation ? 'data-bp-navigation-url="/.well-known/bp/theme/navigation"' : ""} data-bp-menu-health="false" data-bp-login-url="https://auth.test/login"
      data-bp-services='{"service":"https://service.test","auth":"https://auth.test"}'
      data-bp-routes='[{"href":"/tools/dashboard","requestUrl":"https://service.test/dashboard","serviceId":"service","kind":"page"},{"href":"/auth/login","requestUrl":"https://auth.test/login","serviceId":"auth","kind":"page"}]'>
      <nav id="bp-nav-desktop"><a id="menu" href="/tools/dashboard" data-bp-route-link data-bp-service="service" hx-get="https://service.test/dashboard" hx-target="#bp-main">Dashboard</a></nav><nav id="bp-nav-mobile"></nav>
      <main id="bp-main" data-bp-service="${new URL(initialUrl, "https://app.test").origin === "https://auth.test" ? "auth" : "service"}" hx-get="${initialUrl}" ${initialUrl ? 'hx-trigger="load"' : ''} hx-target="#bp-main" hx-swap="innerHTML"><p>Loading</p></main>
    </div><script>${asset.body}</script></body></html>` }));
  await page.goto("https://app.test" + initialTenantPath);
  return { page, errors };
}

const html = (route: Route, body: string, status = 200, headers = {}) => route.fulfill({ status, contentType: "text/html", body, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "HX-Location,HX-Redirect,HX-Trigger,BP-SetHeader", ...headers } });

test("navigation projections replace menu and routes on logout and reject stale authorized responses", async t => {
  let hold = false;
  let delayed: Route | undefined;
  let requests = 0;
  let contentRequests = 0;
  const projection = (authorized: boolean) => ({
    authenticated: authorized,
    routes: [
      { href: "/auth/login", requestUrl: "https://auth.test/login", serviceId: "auth", kind: "page" },
      ...(authorized ? [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }] : [])
    ],
    desktop: authorized ? '<a id="private-menu" href="/tools/dashboard" data-bp-route-link data-bp-service="service" hx-get="https://service.test/dashboard" hx-target="#bp-main">Private dashboard</a>' : '',
    mobile: authorized ? '<span id="private-mobile">Private dashboard</span>' : ''
  });
  const respond = (route: Route) => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      requests++;
      if (hold) { hold = false; delayed = route; return Promise.resolve(); }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(projection(route.request().headers().authorization === "Bearer allowed")) });
    }
    if (route.request().url().includes("service.test")) contentRequests++;
    return html(route, route.request().url().includes("auth.test") ? '<p id="login">Login</p>' : '<p id="dashboard">Dashboard</p>');
  };
  const { page, errors } = await shell(t, respond,
    { authorization: { value: "Bearer allowed", owner: "auth", scope: null } }, "", "/tools/dashboard", true);
  await page.waitForSelector("#private-menu");
  await page.waitForSelector("#private-mobile");
  await page.waitForSelector("#dashboard");
  assert.match(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-routes") ?? "", /tools\/dashboard/);
  hold = true;
  await page.evaluate(() => document.body.dispatchEvent(new CustomEvent("bp:menu-changed")));
  await page.waitForFunction(() => true);
  for (let attempt = 0; !delayed && attempt < 30; attempt++) await page.waitForTimeout(10);
  assert.ok(delayed);
  assert.equal(delayed.request().headers().authorization, "Bearer allowed");
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("htmx:before:history:restore", { cancelable: true, detail: { path: "/tools/dashboard" } }));
    localStorage.setItem("bp.headers", "{}");
    document.body.dispatchEvent(new CustomEvent("bp:fragments-changed"));
  });
  await page.waitForFunction(() => !document.querySelector("#private-menu") &&
    !(document.querySelector("[data-bp-shell-root]")?.getAttribute("data-bp-routes") ?? "").includes("tools/dashboard"));
  await page.waitForFunction(() => !document.querySelector("#dashboard") && document.querySelector("#bp-main")?.textContent?.includes("Access denied"));
  await delayed.fulfill({ contentType: "application/json", body: JSON.stringify(projection(true)) });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#private-menu").count(), 0);
  assert.equal(await page.locator("#private-mobile").count(), 0);
  assert.doesNotMatch(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-routes") ?? "", /tools\/dashboard/);
  assert.ok(requests >= 3);
  assert.equal(contentRequests, 1, "a navigation queued before logout must not run with the new auth state");
  assert.deepEqual(errors, []);
});


test("navigation hydration fails closed and Retry restores the allowed route", async t => {
  let projections = 0;
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      if (++projections === 1) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true,
        routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }],
        desktop: '<span id="allowed-menu">Dashboard</span>', mobile: '' }) });
    }
    return html(route, '<p id="dashboard-ready">Ready</p>');
  }, { authorization: { value: "Bearer allowed", owner: "auth", scope: null } }, "", "/tools/dashboard", true);
  await page.waitForSelector('[data-bp-error-action="navigation-retry"]');
  assert.equal(await page.locator("#menu").count(), 0);
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-routes"), "[]");
  await page.locator('[data-bp-error-action="navigation-retry"]').click();
  await page.waitForSelector("#dashboard-ready");
  await page.waitForSelector("#allowed-menu");
  assert.equal(projections, 2);
  assert.deepEqual(errors, []);
});


test("an unmounted root loads the first permitted page and ignores denied menu destinations", async t => {
  const requests: string[] = [];
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true,
        routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }],
        desktop: '<a href="/denied" data-bp-route-link data-bp-route-request="https://service.test/denied" data-bp-service="service">Denied</a>', mobile: '' }) });
    }
    requests.push(route.request().url());
    return html(route, '<p id="landing">Landing</p>');
  }, {}, "", "/?source=start#section", true);
  await page.waitForSelector("#landing");
  assert.equal(page.url(), "https://app.test/tools/dashboard?source=start#section");
  assert.deepEqual(requests, ["https://service.test/dashboard?source=start"]);
  assert.deepEqual(errors, []);
});

test("a failed newer projection offers Retry and rejects an older response with unchanged credentials", async t => {
  let first: Route | undefined;
  let count = 0;
  const projection = { authenticated: true,
    routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }],
    desktop: '<span id="ready-menu">Dashboard</span>', mobile: '' };
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      if (++count === 1) { first = route; return Promise.resolve(); }
      if (count === 2) return route.fulfill({ status: 503, body: "{}" });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(projection) });
    }
    return html(route, '<p id="recovered">Ready</p>');
  }, {}, "", "/tools/dashboard", true);
  for (let attempt = 0; !first && attempt < 30; attempt++) await page.waitForTimeout(10);
  assert.ok(first);
  await page.evaluate(() => document.body.dispatchEvent(new CustomEvent("bp:menu-changed")));
  await page.waitForSelector('[data-bp-error-action="navigation-retry"]');
  await first.fulfill({ contentType: "application/json", body: JSON.stringify(projection) });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#ready-menu").count(), 0);
  await page.locator('[data-bp-error-action="navigation-retry"]').click();
  await page.waitForSelector("#recovered");
  assert.deepEqual(errors, []);
});


test("a failed logout projection removes loaded private content and Retry recovers anonymously", async t => {
  let failed = false;
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      const authorized = route.request().headers().authorization === "Bearer allowed";
      if (!authorized && !failed) { failed = true; return route.fulfill({ status: 503, body: "{}" }); }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: authorized,
        routes: authorized ? [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }]
          : [{ href: "/auth/login", requestUrl: "https://auth.test/login", serviceId: "auth", kind: "page" }],
        desktop: authorized ? '<span id="private-menu">Private</span>' : '', mobile: '' }) });
    }
    return html(route, route.request().url().includes("auth.test") ? '<p id="anonymous-login">Sign in</p>' : '<p id="private-content">Private data</p>');
  }, { authorization: { value: "Bearer allowed", owner: "auth", scope: null } }, "", "/tools/dashboard", true);
  await page.waitForSelector("#private-content");
  await page.evaluate(() => {
    localStorage.setItem("bp.headers", "{}");
    document.body.dispatchEvent(new CustomEvent("bp:fragments-changed"));
  });
  await page.waitForSelector('[data-bp-error-action="navigation-retry"]');
  assert.equal(await page.locator("#private-content").count(), 0);
  assert.equal(await page.locator("#private-menu").count(), 0);
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-routes"), "[]");
  await page.locator('[data-bp-error-action="navigation-retry"]').click();
  await page.waitForSelector("#anonymous-login");
  assert.deepEqual(errors, []);
});

test("stalled navigation times out and Retry can hydrate the permitted page", async t => {
  let projections = 0;
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      if (++projections === 1) return Promise.resolve();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true, principal: "user",
        routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }], desktop: '', mobile: '' }) });
    }
    return html(route, '<p id="timeout-recovered">Ready</p>');
  }, {}, "", "/tools/dashboard", true);
  await page.waitForSelector('[data-bp-error-action="navigation-retry"]', { timeout: 7000 });
  await page.locator('[data-bp-error-action="navigation-retry"]').click();
  await page.waitForSelector("#timeout-recovered");
  assert.equal(projections, 2);
  assert.deepEqual(errors, []);
});

test("account changes reload personalized content while token renewal for the same principal preserves it", async t => {
  let contentRequests = 0;
  const { page, errors } = await shell(t, route => {
    const authorization = route.request().headers().authorization;
    const principal = authorization === "Bearer A" ? "A" : "B";
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true, principal,
        routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }],
        desktop: `<span id="account-menu">${authorization}</span>`, mobile: '' }) });
    }
    contentRequests++;
    return html(route, `<p id="personalized">${principal}</p>`);
  }, { authorization: { value: "Bearer A", owner: "auth", scope: null } }, "", "/tools/dashboard", true);
  await page.waitForFunction(() => document.querySelector("#personalized")?.textContent === "A");
  await page.evaluate(() => {
    localStorage.setItem("bp.headers", JSON.stringify({ authorization: { value: "Bearer B", owner: "auth", scope: null } }));
    document.body.dispatchEvent(new CustomEvent("bp:fragments-changed"));
  });
  await page.waitForFunction(() => document.querySelector("#personalized")?.textContent === "B");
  assert.equal(contentRequests, 2);
  await page.evaluate(() => {
    localStorage.setItem("bp.headers", JSON.stringify({ authorization: { value: "Bearer B-renewed", owner: "auth", scope: null } }));
    document.body.dispatchEvent(new CustomEvent("bp:fragments-changed"));
  });
  await page.waitForFunction(() => document.querySelector("#account-menu")?.textContent === "Bearer B-renewed");
  assert.equal(contentRequests, 2);
  assert.equal(await page.locator("#personalized").textContent(), "B");
  assert.deepEqual(errors, []);
});

test("a denied initial page cannot restore its late body or header directives", async t => {
  let projection: Route | undefined, initial: Route | undefined;
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") projection = route;
    else initial = route;
    return Promise.resolve();
  }, { authorization: { value: "Bearer allowed", owner: "auth", scope: null } }, "https://service.test/dashboard", "/tools/dashboard", true);
  for (let attempt = 0; (!projection || !initial) && attempt < 30; attempt++) await page.waitForTimeout(10);
  assert.ok(projection); assert.ok(initial);
  await projection.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true, principal: "user", routes: [], desktop: '', mobile: '' }) });
  await page.waitForFunction(() => document.querySelector("#bp-main")?.textContent?.includes("Access denied"));
  await html(initial, '<p id="late-private">Private</p>', 200, { "BP-SetHeader": "Authorization=Bearer stale; locked=true" });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#late-private").count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bp.headers") || "{}").authorization?.value), "Bearer allowed");
  assert.deepEqual(errors, []);
});

test("an allowed projection does not duplicate a pending initial page request", async t => {
  let projection: Route | undefined, initial: Route | undefined, requests = 0;
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") projection = route;
    else { initial = route; requests++; }
    return Promise.resolve();
  }, {}, "https://service.test/dashboard", "/tools/dashboard", true);
  for (let attempt = 0; (!projection || !initial) && attempt < 30; attempt++) await page.waitForTimeout(10);
  assert.ok(projection); assert.ok(initial);
  await projection.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true, principal: "user",
    routes: [{ href: "/tools/dashboard", requestUrl: "https://service.test/dashboard", serviceId: "service", kind: "page" }], desktop: '', mobile: '' }) });
  await page.waitForTimeout(100);
  assert.equal(requests, 1);
  await html(initial, '<p id="initial-ready">Ready</p>');
  await page.waitForSelector("#initial-ready");
  assert.deepEqual(errors, []);
});

test("a permitted parameterized deep link hydrates from complete service templates", async t => {
  const requests: string[] = [];
  const { page, errors } = await shell(t, route => {
    if (new URL(route.request().url()).pathname === "/.well-known/bp/theme/navigation") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: true, principal: "user",
        routes: [{ href: "/tools/:id", servicePath: "/dashboard/:id", serviceBaseUrl: "https://service.test", serviceId: "service", kind: "page", methods: ["GET"] }], desktop: '', mobile: '' }) });
    }
    requests.push(route.request().url());
    return html(route, '<p id="parameterized-ready">Ready</p>');
  }, {}, "", "/tools/42?tab=all", true);
  await page.waitForSelector("#parameterized-ready");
  assert.deepEqual(requests, ["https://service.test/dashboard/42?tab=all"]);
  assert.deepEqual(errors, []);
});
