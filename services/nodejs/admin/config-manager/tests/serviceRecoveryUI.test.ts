import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Page } from "@playwright/test";
import { toHtmlString } from "@betterportal/framework";
import { ResponseSchema } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/GET.js";
import { render } from "../src/plugins/service-betterportal-config-manager/bp-routes/services/_renderer.bootstrap5/GET.js";
import { buildBetterPortalShellRuntimeAsset } from "../../../../../themes/nodejs/runtime/src/runtime.js";
import { Bootstrap1AdapterSource } from "../../../../../themes/nodejs/bootstrap1/src/plugins/service-betterportal-theme-bootstrap1/adapter.js";

function servicesHtml(shared = false, shell = false) {
  return toHtmlString(render(ResponseSchema.parse({
    title: "Services", adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: shell ? "https://manager.test/prefix" : "/prefix",
    tenants: [{ id: "tenant", title: "Tenant" }], apps: [{ id: "app", tenantId: "tenant", title: "App" }],
    tenantApps: { tenant: [{ id: "app", title: "App" }] },
    services: [{ id: "instance", tenantId: "tenant", scope: "tenant", title: "Example", hostname: "https://external.test",
      serviceId: "org.example.external", createdAt: "2026-11-06T00:00:00.000Z", enabled: true, capabilities: [], pushBase: "/service" }],
    sharedServiceCatalog: shared ? [{ id: "org.example.shared", title: "Shared", baseUrl: "https://external.test", installed: false, enabled: true, tags: [] }] : []
  })));
}

async function fixture(t: TestContext, options: { reset?: boolean; shared?: boolean; refreshFails?: boolean; catalogFails?: boolean; shell?: boolean; refreshPage?: boolean } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", error => { errors.push(error.message); t.diagnostic(error.message); });
  const calls: Array<{ host: string; path: string; body: Record<string, unknown>; authorization?: string }> = [];
  let refreshedAfterClose = false;
  let serviceLoads = 0;
  const asset = options.shell ? await buildBetterPortalShellRuntimeAsset({ adapterSource: Bootstrap1AdapterSource }) : undefined;
  await page.addInitScript(`(() => {
    const win = window;
    localStorage.setItem("bp.headers", JSON.stringify({ authorization: {
      value: "Bearer management-test", owner: "manager", locked: false, expires: null, scope: null, refresh: null, refreshBefore: null
    } }));
    win.BetterPortalAuth = { fetch: (url, options = {}) => {
      const headers = new Headers(options.headers);
      headers.set("Authorization", "Bearer management-test");
      return fetch(url, { ...options, headers });
    } };
    win.bootstrap = { Tooltip: { getInstance: () => ({ dispose() {} }) }, Popover: { getInstance: () => ({ dispose() {} }) },
      Modal: { getInstance: () => null }, Offcanvas: { getInstance: (panel) => ({ hide() {
      setTimeout(() => {
        panel.classList.remove("show", "showing", "hiding");
        panel.dispatchEvent(new Event("hidden.bs.offcanvas"));
      }, 25);
    }, dispose() { panel.classList.remove("show", "showing", "hiding"); } }) } };
    document.addEventListener("click", event => {
      const button = event.target?.closest("[data-bs-target]");
      if (button) document.querySelector(button.getAttribute("data-bs-target"))?.classList.add("show");
    });
  })()`);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const headers = { "access-control-allow-origin": request.headers().origin || "https://manager.test", "access-control-allow-headers": "content-type, authorization, baggage, hx-request-type, hx-request", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "POST") calls.push({ host: url.hostname, path, body: request.postDataJSON(), authorization: request.headers().authorization });
    if (path === "/services" && (url.hostname === "manager.test" || url.hostname === "shell.test")) {
      const content = options.shell ? '<main id="bp-main" data-bp-service="manager" hx-get="https://manager.test/prefix/services" hx-trigger="load" hx-target="#bp-main" hx-swap="innerHTML"></main>' : '<main id="bp-main">' + servicesHtml(options.shared) + '</main>';
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'><style>.offcanvas:not(.show):not(.showing){display:none}</style></head><body>
        <div data-bp-shell-root data-bp-menu-health="false" data-bp-services='{"manager":"https://manager.test/prefix","external":"https://external.test"}' data-bp-routes='[{"href":"/services","requestUrl":"https://manager.test/prefix/services","serviceId":"manager","kind":"page","title":"Services"}]'>
        ${content}</div>${asset ? `<script>${asset.body}</script>` : ''}</body></html>` });
    }
    if (url.hostname === "manager.test") {
      if (path === "/prefix/services") {
        serviceLoads++;
        if (options.shell && serviceLoads === 1) return route.fulfill({ headers, contentType: "text/html; mode=page", body: servicesHtml(options.shared, true) });
        refreshedAfterClose = await page.locator(".offcanvas.show, .offcanvas.showing, .offcanvas.hiding").count() === 0;
        return route.fulfill({ headers, status: options.refreshFails ? 503 : 200, contentType: "text/html", body: options.refreshPage ? servicesHtml(options.shared, options.shell) : '<div id="refreshed">Refreshed</div>' });
      }
      if (path.endsWith("/shared-services") && options.catalogFails) return route.fulfill({ headers, status: 503, json: { error: "Catalog unavailable" } });
      if (path.endsWith("/shared-services")) return route.fulfill({ headers, json: { id: "org.example.shared" } });
      if (path.endsWith("/begin-install")) return route.fulfill({ headers, json: { setupToken: "setup-test", cpUrl: "https://manager.test" } });
      if (path.endsWith("/begin-hostname-change")) return route.fulfill({ headers, json: { changeToken: "change-test" } });
      return route.fulfill({ headers, status: 404, json: { error: "Unexpected management request" } });
    }
    if (path.endsWith("/health")) return route.fulfill({ headers, json: options.reset && url.hostname === "replacement.test"
      ? { ok: true, setupMode: true, pluginId: "org.example.external" } : { ok: true } });
    if (path.endsWith("/manifest")) return route.fulfill({ headers, json: { pluginId: "org.example.external", title: "Example", version: "1.0.0", capabilities: [] } });
    if (path.endsWith("/install")) return route.fulfill({ headers, json: { status: "ok" } });
    return route.fulfill({ headers, status: 409, json: { error: "Service is not installed" } });
  });
  await page.goto(options.shell ? "https://shell.test/services" : "https://manager.test/services");
  if (options.shell) await page.waitForFunction(() => document.getElementById("bp-change-hostname-panel")?.parentElement === document.body);
  return { page, calls, errors, refreshedAfterClose: () => refreshedAfterClose };
}

async function changeUrl(page: Page) {
  await page.locator("[data-bp-change-hostname]").first().click();
  await page.locator('#bp-change-hostname-form [name="baseUrl"]').fill("https://replacement.test");
}

test("hostname verification errors stay visible in the open sidebar", async t => {
  const { page, calls, errors } = await fixture(t);
  await changeUrl(page);
  await page.locator('#bp-change-hostname-form [type="submit"]').click();
  await page.waitForFunction(() => document.getElementById("bp-change-hostname-status")?.textContent === "Service is not installed");
  assert.equal(await page.locator("#bp-change-hostname-panel").isVisible(), true);
  assert.equal(await page.locator("#bp-services-alerts").textContent(), "");
  assert.equal(await page.locator('#bp-change-hostname-form [type="submit"]').isEnabled(), true);
  assert.equal(calls.filter(call => call.path.endsWith("/begin-hostname-change")).length, 1);
  assert.deepEqual(errors, []);
});

test("a reset replacement offers re-setup and keeps registration identity without leaking admin credentials", async t => {
  const { page, calls, errors, refreshedAfterClose } = await fixture(t, { reset: true });
  await changeUrl(page);
  const submit = page.locator('#bp-change-hostname-form [type="submit"]');
  await submit.click();
  await page.waitForFunction(() => document.getElementById("bp-change-hostname-status")?.textContent?.includes("Submit again"));
  assert.equal(await page.locator("#bp-reinstall-service").isChecked(), true);
  assert.equal(await submit.textContent(), "Set up and update URL");
  assert.equal(calls.length, 0, "detecting reset state must not modify registration");
  await submit.click();
  await page.waitForSelector("#refreshed");
  const begin = calls.find(call => call.path.endsWith("/begin-install"))!;
  assert.deepEqual(begin.body, { instanceId: "instance", serviceUrl: "https://replacement.test", tenantId: "tenant", reconfigure: true });
  assert.equal(begin.authorization, "Bearer management-test");
  const install = calls.find(call => call.path.endsWith("/install"))!;
  assert.equal(install.host, "replacement.test");
  assert.equal(install.authorization, undefined);
  assert.deepEqual(install.body, { setupToken: "setup-test", cpUrl: "https://manager.test" });
  assert.equal(calls.some(call => call.path.endsWith("/begin-hostname-change")), false);
  assert.equal(refreshedAfterClose(), true, "finish closing the sidebar before replacing its DOM");
  assert.deepEqual(errors, []);
});

test("shared registration failures use the shared sidebar status", async t => {
  const { page, errors } = await fixture(t, { catalogFails: true });
  await page.locator('[data-bs-target="#bp-shared-service-panel"]').click();
  await page.locator('#bp-shared-service-form [name="baseUrl"]').fill("https://external.test");
  await page.locator('#bp-shared-service-form [type="submit"]').click();
  await page.waitForFunction(() => document.getElementById("bp-shared-service-preview")?.textContent === "Catalog unavailable");
  assert.equal(await page.locator("#bp-shared-service-panel").isVisible(), true);
  assert.equal(await page.locator("#bp-services-alerts").textContent(), "");
  assert.deepEqual(errors, []);
});

test("revisiting or reinitializing services cannot multiply installation requests", async t => {
  const { page, calls, errors } = await fixture(t, { shared: true });
  for (let visit = 0; visit < 3; visit++) {
    await page.locator("#bp-main").evaluate((main, html) => {
      main.innerHTML = html;
      main.querySelectorAll("script").forEach(source => {
        const script = document.createElement("script"); script.textContent = source.textContent;
        source.replaceWith(script);
      });
    }, servicesHtml(true));
  }
  const source = await page.locator("#bp-services-page script").textContent();
  await page.addScriptTag({ content: source! });
  await page.locator("[data-bp-install-shared]").click();
  await page.waitForSelector("#refreshed");
  assert.equal(calls.filter(call => call.path.endsWith("/begin-install")).length, 1);
  assert.equal(calls.filter(call => call.path.endsWith("/install")).length, 1);
  assert.deepEqual(errors, []);
});

test("a refresh failure after successful setup does not retry or clean up the installed service", async t => {
  const { page, calls, errors } = await fixture(t, { reset: true, refreshFails: true });
  await changeUrl(page);
  await page.locator("#bp-reinstall-service").check();
  const installed = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/install") && response.request().method() === "POST");
  await page.locator('#bp-change-hostname-form [type="submit"]').click();
  await installed;
  await page.waitForFunction(() => document.getElementById("bp-services-alerts")?.textContent?.includes("Reload the page"));
  assert.match(await page.locator("#bp-services-alerts").textContent() || "", /Service set up and URL updated/);
  assert.equal(await page.locator("#bp-change-hostname-panel").isVisible(), false);
  assert.equal(calls.filter(call => call.path.endsWith("/install")).length, 1);
  assert.equal(calls.some(call => call.path.includes("cleanup")), false);
  assert.deepEqual(errors, []);
});

test("the real shell preserves completion feedback when refresh fails after recovery", async t => {
  const { page, calls, errors, refreshedAfterClose } = await fixture(t, { reset: true, refreshFails: true, shell: true });
  await changeUrl(page);
  assert.equal(await page.locator("#bp-change-hostname-panel").evaluate(panel => panel.parentElement === document.body), true);
  await page.locator("#bp-reinstall-service").check();
  await page.locator("#bp-change-hostname-panel").evaluate(panel => { panel.classList.replace("show", "showing"); });
  await page.locator('#bp-change-hostname-form [type="submit"]').click();
  await page.waitForFunction(() => document.getElementById("bp-services-alerts")?.textContent?.includes("Reload the page"));
  assert.match(await page.locator("#bp-services-alerts").textContent() || "", /Service set up and URL updated/);
  assert.equal(await page.locator("#bp-services-page").count(), 1);
  assert.equal(refreshedAfterClose(), true);
  assert.equal(calls.filter(call => call.path.endsWith("/install")).length, 1);
  assert.deepEqual(errors, []);
});

test("real shell refreshes bind new sidebar controls and discard the previous teleported panels", async t => {
  const { page, calls, errors } = await fixture(t, { reset: true, shell: true, refreshPage: true });
  await changeUrl(page);
  await page.locator("#bp-reinstall-service").check();
  await page.locator('#bp-change-hostname-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector(".offcanvas.show"));
  await page.waitForFunction(() => document.getElementById("bp-change-hostname-status")?.textContent?.startsWith("Enter the service URL"));
  assert.equal(await page.locator("#bp-change-hostname-panel").count(), 1);
  await page.waitForFunction(() => !document.querySelector("#bp-main.htmx-swapping, #bp-main.htmx-settling"));
  await changeUrl(page);
  assert.equal(await page.locator('#bp-change-hostname-form [name="instanceId"]').inputValue(), "instance");
  await page.locator("#bp-reinstall-service").check();
  const installedAgain = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/install") && response.request().method() === "POST");
  await page.locator('#bp-change-hostname-form [type="submit"]').click();
  await installedAgain;
  await page.waitForFunction(() => document.getElementById("bp-change-hostname-status")?.textContent?.startsWith("Enter the service URL"));
  assert.equal(calls.filter(call => call.path.endsWith("/begin-install")).length, 2);
  assert.equal(calls.filter(call => call.path.endsWith("/install")).length, 2);
  assert.deepEqual(errors, []);
});
