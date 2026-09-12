import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Route } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";

async function shell(t: TestContext, respond: (route: Route) => Promise<void>, stored = {}, initialUrl = "https://service.test/dashboard", initialTenantPath = "/tools/dashboard") {
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
      <main id="bp-main" data-bp-service="${initialUrl.startsWith("https://auth.test") ? "auth" : "service"}" hx-get="${initialUrl}" ${initialUrl ? 'hx-trigger="load"' : ''} hx-target="#bp-main" hx-swap="innerHTML"><p>Loading</p></main>
    </div><script>${asset.body}</script></body></html>` }));
  await page.goto("https://app.test" + initialTenantPath);
  return { page, errors };
}

const html = (route: Route, body: string, status = 200, headers = {}) => route.fulfill({ status, contentType: "text/html", body, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "HX-Location,HX-Redirect,HX-Trigger,BP-SetHeader", ...headers } });

test("absolute role-sync fragments returned by a service receive managed credentials", async t => {
  let authorization: string | undefined;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().includes("service.test")) {
      return html(route, '<div hx-get="https://auth.test/.well-known/bp/config/workos-role-sync?tenantId=target&amp;appId=app" hx-trigger="load" hx-target="this" hx-swap="innerHTML"></div>');
    }
    authorization = route.request().headers().authorization;
    return html(route, '<p id="role-sync">Role sync loaded</p>');
  }, { Authorization: { value: "Bearer management-test", owner: "auth", scope: null } });
  await page.waitForSelector("#role-sync");
  assert.equal(authorization, "Bearer management-test");
  assert.deepEqual(errors, []);
});

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

test("connection errors keep the main area inert and Reload makes only one explicit request", async t => {
  let requests = 0;
  const { page, errors } = await shell(t, async route => {
    requests++;
    await route.abort("failed");
  });
  await page.waitForSelector('[data-bp-error-action="reload"]');
  const initialRequests = requests;
  await page.locator("#bp-main").click({ position: { x: 2, y: 2 } });
  await page.locator('[data-bp-error-action="reload"]').hover();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(requests, initialRequests);
  await page.locator('[data-bp-error-action="reload"]').click();
  await page.waitForFunction(() => document.querySelector("#bp-main")?.textContent?.includes("Connection Error"));
  assert.equal(requests, initialRequests + 1);
  assert.equal(await page.locator("#bp-main").getAttribute("hx-get"), null);
  assert.doesNotMatch(await page.locator("#bp-main").textContent() ?? "", /Route Configuration Error/);
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

test("elevation retries the captured mutation once and reuses the token for subsequent actions", async t => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { tenantId: "tenant", appId: "app", sub: "alice", exp: now + 600 };
  const token = (value: unknown) => "header." + Buffer.from(JSON.stringify(value)).toString("base64url") + ".signature";
  const base = token(claims); const elevated = token({ ...claims, elevation: { assurance: "confirmed", verifiedAt: now, expiresAt: now + 600 } });
  const mutations: Array<{ body: string; authorization: string | undefined }> = [];
  let starts = 0; let completes = 0;
  const { page, errors } = await shell(t, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,GET", "access-control-allow-headers": "*" } });
    if (request.url().endsWith("/dashboard")) return html(route, '<form hx-post="https://service.test/change" hx-target="#result" hx-swap="innerHTML"><input id="message" name="message" value="submitted"><button type="submit">Save change</button></form><div id="result"></div>');
    if (request.url().includes("/auth/elevate")) {
      const input = request.postDataJSON();
      if (input.action === "start") { starts++; return route.fulfill({ json: { challengeId: "challenge", method: "confirm" }, headers: { "access-control-allow-origin": "*" } }); }
      completes++; return route.fulfill({ json: { accessToken: elevated }, headers: { "access-control-allow-origin": "*" } });
    }
    mutations.push({ body: request.postData() ?? "", authorization: request.headers().authorization });
    if (request.headers().authorization !== "Bearer " + elevated) return html(route, "elevation required", 401, { "BP-Auth-Challenge": JSON.stringify({ version: 1, tenantId: "tenant", appId: "app", minimum: "confirm" }), "access-control-expose-headers": "BP-Auth-Challenge" });
    return html(route, "<p>Saved</p>");
  }, { Authorization: { value: "Bearer " + base, owner: "auth", scope: null } });
  await page.getByRole("button", { name: "Save change" }).click();
  await page.locator("dialog[open]").waitFor();
  await page.locator("#message").fill("edited-after-submit");
  await page.locator("dialog").getByRole("button", { name: "Continue" }).click();
  await page.locator("#result").getByText("Saved").waitFor();
  assert.equal(mutations.length, 2); assert.equal(mutations[0].body, mutations[1].body);
  assert.ok(mutations[1].body.includes("submitted"));
  await page.getByRole("button", { name: "Save change" }).click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.waitForTimeout(100);
  assert.equal(mutations.length, 3); assert.equal(starts, 1); assert.equal(completes, 1);
  const stored = await page.evaluate(() => localStorage.getItem("bp.headers"));
  assert.ok(!stored?.includes(elevated)); assert.deepEqual(errors, []);
});

test("cancelling elevation leaves the session and submitted action untouched", async t => {
  const base = "header." + Buffer.from(JSON.stringify({ tenantId: "tenant", appId: "app", sub: "alice", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url") + ".signature";
  let mutations = 0; let completions = 0;
  const { page, errors } = await shell(t, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,GET", "access-control-allow-headers": "*" } });
    if (request.url().endsWith("/dashboard")) return html(route, '<button hx-post="https://service.test/change" hx-target="#result">Delete item</button><div id="result">Unchanged</div>');
    if (request.url().includes("/auth/elevate")) { if (request.postDataJSON().action === "complete") completions++; return route.fulfill({ json: { challengeId: "challenge", method: "confirm" }, headers: { "access-control-allow-origin": "*" } }); }
    mutations++; return html(route, "elevation required", 401, { "BP-Auth-Challenge": JSON.stringify({ version: 1, tenantId: "tenant", appId: "app", minimum: "confirm" }), "access-control-expose-headers": "BP-Auth-Challenge" });
  }, { Authorization: { value: "Bearer " + base, owner: "auth", scope: null } });
  await page.getByRole("button", { name: "Delete item" }).click();
  await page.locator("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.locator("#result").getByText("Unchanged").waitFor();
  assert.equal(mutations, 1); assert.equal(completions, 0);
  assert.ok((await page.evaluate(() => localStorage.getItem("bp.headers")))?.includes(base));
  assert.deepEqual(errors, []);
});

const passwordLoginForm = '<form id="bp-login-form" hx-post="this" hx-swap="none" onsubmit="return window.bpLoginSubmit(event)"><input name="username" value="alice"><input name="password" value="password"><input name="next" value="/tools/dashboard"><button type="submit">Sign in</button></form><p id="bp-login-error" class="d-none"></p>';
const loginJson = (route: Route, body: unknown, status = 200, headers = {}) => route.fulfill({ status, json: body, headers: { "access-control-allow-origin": "https://app.test", "access-control-allow-credentials": "true", "access-control-expose-headers": "BP-SetHeader,HX-Trigger", ...headers } });

for (const enroll of [false, true]) test(`password login completes ${enroll ? "factor enrollment" : "MFA"} before navigation`, async t => {
  const completions: unknown[] = []; let dashboards = 0; let logins = 0;
  const { page, errors } = await shell(t, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "https://app.test", "access-control-allow-credentials": "true", "access-control-allow-methods": "POST,GET", "access-control-allow-headers": "*" } });
    if (request.url().endsWith("/dashboard")) {
      dashboards++; assert.equal(request.headers().authorization, "Bearer verified-session");
      return html(route, '<p id="signed-in">Signed in</p>');
    }
    if (request.url().endsWith("/account")) {
      completions.push(request.postDataJSON());
      return loginJson(route, { status: "ok", recoveryCodes: enroll ? ["recovery-one", "recovery-two"] : [] }, 200, { "BP-SetHeader": "Authorization=Bearer verified-session; locked=true" });
    }
    if (request.method() === "POST") {
      logins++;
      assert.equal(new URLSearchParams(request.postData()!).get("next"), "/tools/dashboard");
      return loginJson(route, { status: "ok", accountUrl: "https://auth.test/account", challenge: { id: "login-ticket", secret: "login-proof", methods: ["totp"], enroll, ...(enroll ? { totpSecret: "enrollment-secret" } : {}) } });
    }
    return html(route, passwordLoginForm);
  }, {}, "https://auth.test/login", "/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("dialog[open]").waitFor();
  assert.equal(dashboards, 0); assert.equal(completions.length, 0);
  assert.ok(!(await page.evaluate(() => localStorage.getItem("bp.headers")))?.includes("verified-session"));
  // Repeated form submission during verification cannot create another challenge.
  await page.locator("#bp-login-form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.locator("dialog").getByLabel("Verification code").fill("123456");
  await page.locator("dialog").getByRole("button", { name: "Continue", exact: true }).click();
  if (enroll) {
    await page.locator("dialog").getByText("Save your recovery codes", { exact: true }).waitFor();
    assert.equal(dashboards, 0);
    assert.match(await page.locator("dialog pre").innerText(), /recovery-one\nrecovery-two/);
    await page.locator("dialog").getByRole("button", { name: "I saved my recovery codes" }).click();
  }
  await page.locator("#signed-in").waitFor();
  assert.equal(logins, 1); assert.equal(dashboards, 1);
  assert.deepEqual(completions, [{ action: "login.complete", id: "login-ticket", secret: "login-proof", next: "/tools/dashboard", method: "totp", code: "123456" }]);
  assert.equal(new URL(page.url()).pathname, "/tools/dashboard");
  const stored = await page.evaluate(() => localStorage.getItem("bp.headers"));
  assert.ok(stored?.includes("verified-session")); assert.ok(!stored?.includes("recovery-one"));
  assert.deepEqual(errors, []);
});

test("cancelled or rejected login verification stays on the form without storing credentials", async t => {
  let completions = 0; let dashboards = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().endsWith("/dashboard")) { dashboards++; return html(route, "Unexpected navigation"); }
    if (route.request().url().endsWith("/account")) { completions++; return loginJson(route, { status: "error", message: "Invalid verification code." }, 403); }
    if (route.request().method() === "POST") return loginJson(route, { status: "ok", accountUrl: "/account", challenge: { id: "ticket", secret: "proof", methods: ["recovery"] } });
    return html(route, passwordLoginForm);
  }, {}, "https://auth.test/login", "/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.locator("#bp-login-error").getByText("Sign-in verification cancelled.").waitFor();
  assert.equal(completions, 0); assert.equal(dashboards, 0);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("dialog").getByLabel("Verification code").fill("wrong-code");
  await page.locator("dialog").getByRole("button", { name: "Continue" }).click();
  await page.locator("#bp-login-error").getByText("Invalid verification code.").waitFor();
  assert.equal(completions, 1); assert.equal(dashboards, 0);
  assert.equal(await page.locator("#bp-login-form").count(), 1);
  assert.ok(!(await page.evaluate(() => localStorage.getItem("bp.headers")))?.includes("authorization"));
  assert.deepEqual(errors, []);
});

test("password-only login still stores session headers and navigates directly", async t => {
  const { page, errors } = await shell(t, route => {
    if (route.request().url().endsWith("/dashboard")) {
      assert.equal(route.request().headers().authorization, "Bearer password-session");
      return html(route, '<p id="signed-in">Signed in</p>');
    }
    if (route.request().method() === "POST") return loginJson(route, { status: "ok" }, 200, { "BP-SetHeader": "Authorization=Bearer password-session; locked=true" });
    return html(route, passwordLoginForm);
  }, {}, "https://auth.test/login", "/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("#signed-in").waitFor();
  assert.equal(await page.locator("dialog").count(), 0); assert.deepEqual(errors, []);
});

test("login challenges cannot send verification proof to another installed service", async t => {
  let otherRequests = 0;
  const { page, errors } = await shell(t, route => {
    if (route.request().url().startsWith("https://service.test")) { otherRequests++; return loginJson(route, { status: "ok" }); }
    if (route.request().method() === "POST") return loginJson(route, { status: "ok", accountUrl: "https://service.test/account", challenge: { id: "ticket", secret: "proof", methods: ["totp"] } });
    return html(route, passwordLoginForm);
  }, {}, "https://auth.test/login", "/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator("#bp-login-error").getByText("The auth service returned an invalid verification endpoint.").waitFor();
  assert.equal(otherRequests, 0); assert.equal(await page.locator("dialog").count(), 0); assert.deepEqual(errors, []);
});
