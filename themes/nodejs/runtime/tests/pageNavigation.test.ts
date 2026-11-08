import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Route } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";
import { buildServiceViewUrl, resolveAppRoute } from "../../../../framework/nodejs/src/runtime/configProvider.js";
import type { BetterPortalApp } from "../../../../framework/nodejs/src/contracts/platformConfig.js";
import { renderServiceConnection } from "../../../../services/nodejs/admin/config-manager/lib/plugins/service-betterportal-config-manager/serviceConnections.js";
import type { M2MConnectionView } from "../../../../services/nodejs/admin/config-manager/src/plugins/service-betterportal-config-manager/m2mConnections.js";

const list = { href: "/ui/batches", requestUrl: "https://service.test/batches", serviceId: "service", kind: "page", title: "Import batches" };
const detail = { ...list, href: "/ui/batches/:batchId", requestUrl: "https://service.test/batches/%3AbatchId", title: "Batch details" };
type Mount = typeof list;
const response = (route: Route, body: string, chrome = {}, status = 200, mode = "page") => route.fulfill({
  status, body: status === 204 ? "" : body,
  contentType: `text/html; mode=${mode}` + Object.entries(chrome).map(([key, value]) => `; bp-chrome-${key}=${encodeURIComponent(Array.isArray(value) ? JSON.stringify(value) : String(value))}` + (Array.isArray(value) ? `; bp-array-chrome-${key}=true` : "")).join(""),
  headers: { "access-control-allow-origin": "*" }
});
async function shell(t: TestContext, mounts: Mount[], respond: (route: Route) => Promise<void>, path = "/ui/batches", errorOutlet = false) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.dismiss());
  const asset = await buildBetterPortalShellRuntimeAsset({});
  await page.route("https://service.test/**", respond);
  const app = { routes: mounts.map((mount, index) => ({ id: `route-${index}`, enabled: true, kind: "page", path: mount.href, serviceId: mount.serviceId, viewId: `view-${index}`, targetPath: new URL(mount.requestUrl).pathname.replace(/%3A/gi, ":") })) } as BetterPortalApp;
  await page.route("https://app.test/**", route => {
    const url = new URL(route.request().url());
    const mount = resolveAppRoute(app, url.pathname);
    if (!mount) return route.fulfill({ status: 404, body: "No page mount" });
    const action = buildServiceViewUrl({ hostname: "https://service.test" }, mount, url.pathname)! + url.search;
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><title>App</title><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'></head><body>
      <div data-bp-shell-root data-bp-menu-health="false" data-bp-document-title="App" data-bp-services='${JSON.stringify(Object.fromEntries(mounts.map(mount => [mount.serviceId, "https://service.test"])))}' data-bp-routes='${JSON.stringify(mounts)}'>
      <h1 data-bp-current-title></h1><div data-bp-current-breadcrumb></div><a data-bp-up hidden>Up</a><button data-bp-back>Back</button>
      <main id="bp-main" data-bp-service="service" hx-get="${action}" hx-trigger="load" hx-target="#bp-main" hx-swap="innerHTML"></main></div><div id="error-outlet"></div><script>window.BetterPortalShellAdapter = { applyChrome: chrome => { window.appliedChrome = chrome; } ${errorOutlet ? ', showRequestError: (status, html) => { document.getElementById("error-outlet").innerHTML = html; }' : ''} };</script><script>${asset.body}</script></body></html>` });
  });
  await page.goto("https://app.test" + path);
  return { page, errors };
}

test("undeclared child links cannot invent page mounts", async t => {
  let requests = 0;
  const { page, errors } = await shell(t, [list], route => { requests++; return response(route, '<a id="detail" href="/batches/1">Batch 1</a><p id="list">List</p>'); });
  await page.waitForSelector("#detail");
  assert.equal(await page.locator("#detail").getAttribute("hx-get"), null);
  assert.ok(await page.locator("#detail").getAttribute("data-bp-route-error"));
  await page.locator("#detail").click();
  assert.equal(page.url(), "https://app.test/ui/batches");
  assert.equal(requests, 1);
  assert.deepEqual(errors, []);
});

test("page filters infer navigation, retain submitted values and survive direct refresh on an aliased mount", async t => {
  const mounted = { ...list, href: "/configuration/services", requestUrl: "https://service.test/services", title: "Services" };
  const { page, errors } = await shell(t, [mounted,
    { ...list, href: "/services", requestUrl: "https://service.test/unrelated" },
    { ...mounted, serviceId: "other", href: "/other/services" }], route => {
    const tenant = new URL(route.request().url()).searchParams.get("tenantId") || "first";
    const app = new URL(route.request().url()).searchParams.get("appId") || "first";
    return response(route, `<select id="tenant" name="tenantId" hx-get="/services" hx-trigger="change"><option value="first" ${tenant === "first" ? "selected" : ""}>First</option><option value="second" ${tenant === "second" ? "selected" : ""}>Second</option></select><select id="app" name="appId" hx-get="/services" hx-trigger="change" hx-include="#tenant"><option value="first" ${app === "first" ? "selected" : ""}>First</option><option value="other" ${app === "other" ? "selected" : ""}>Other</option></select><p id="selected">${tenant}</p>`);
  }, "/configuration/services");
  await page.waitForSelector("#tenant");
  assert.equal(await page.locator("#tenant").getAttribute("data-bp-shell-route"), "page");
  assert.equal(await page.locator("#tenant").getAttribute("hx-get"), "https://service.test/services");
  await page.locator("#tenant").selectOption("second");
  await page.waitForURL("https://app.test/configuration/services?tenantId=second");
  await page.waitForFunction(() => document.querySelector("#selected")?.textContent === "second");
  await page.locator("#app").selectOption("other");
  await page.waitForURL(url => url.pathname === "/configuration/services" && url.searchParams.get("tenantId") === "second" && url.searchParams.get("appId") === "other");
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#selected")?.textContent === "second");
  assert.equal(await page.locator("#app").inputValue(), "other");
  await page.goBack();
  await page.waitForURL("https://app.test/configuration/services?tenantId=second");
  await page.goBack();
  await page.waitForURL("https://app.test/configuration/services");
  assert.deepEqual(errors, []);
});

test("unregistered contextual owners do not emit or request a fabricated service origin", async t => {
  const { page } = await shell(t, [list], route => response(route,
    '<div data-bp-service-id="missing"><select id="unknown" hx-get="/services" hx-target="#local"><option value="first">First</option><option value="second">Second</option></select><div id="local"></div></div>'));
  await page.waitForSelector("#unknown");
  assert.equal(await page.locator("#unknown").getAttribute("hx-get"), "/services");
  assert.ok(await page.locator("#unknown").getAttribute("data-bp-route-error"));
});

test("connection mutations replace one row and keep HTTP and network errors inside that component", async t => {
  const connection: M2MConnectionView = { sourceServiceId: "source", sourceServiceTitle: "Source", sourceServiceType: "source.plugin", requestId: "read",
    title: "Read reports", contractId: "reports", mode: "service", methods: ["GET"], permissions: ["read"], optional: false,
    status: "pending", message: "Choose a provider", candidates: [{ targetServiceId: "provider", targetServiceTitle: "Provider", targetServiceType: "provider.plugin", targetViewId: "reports" }] };
  let failure = "", connected = false, pages = 0;
  const row = () => String(renderServiceConnection({ ...connection, ...(connected ? { bindingId: "binding", status: "connected" as const } : {}) }, "app", "/api"));
  const { page, errors } = await shell(t, [list], route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS", "access-control-allow-headers": "*"
    } });
    if (route.request().method() !== "GET") {
      if (failure === "network") return route.abort("failed");
      if (failure === "http") return response(route, '<div role="alert">Connection update failed</div>', {}, 500, "fragment");
      connected = route.request().method() === "POST";
      return response(route, row(), {}, 200, "fragment");
    }
    pages++;
    return response(route, '<input id="untouched" value="original"><p id="sibling">Other connection</p>' + row());
  });
  await page.waitForSelector("#untouched");
  page.removeAllListeners("dialog");
  page.on("dialog", dialog => dialog.accept());
  await page.locator("#untouched").fill("keep my changes");
  await page.getByRole("button", { name: /Connect Provider/ }).click();
  await page.getByRole("button", { name: "Revoke" }).waitFor();
  failure = "http";
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.locator(".bp-service-connection [data-bp-mutation-error]").getByText("Connection update failed").waitFor();
  assert.equal(await page.getByRole("button", { name: "Revoke" }).count(), 1);
  failure = "network";
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.locator(".bp-service-connection [data-bp-mutation-error]").getByText(/Service unavailable/).waitFor();
  failure = "";
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: /Connect Provider/ }).waitFor();
  assert.equal(await page.locator("#untouched").inputValue(), "keep my changes");
  assert.equal(await page.locator("#sibling").textContent(), "Other connection");
  assert.equal(page.url(), "https://app.test/ui/batches");
  assert.equal(pages, 1);
  assert.deepEqual(errors, []);
});

test("route-form validation shows the actual error without hiding the page or losing entered values", async t => {
  const { page, errors } = await shell(t, [list], route => route.request().method() === "POST"
    ? response(route, '<div class="alert alert-danger">section is missing from the service parameter schema.</div>', {}, 400, "fragment")
    : response(route, '<div id="route-list">Existing routes</div><form id="route-form" hx-post="/routes" hx-target="this" hx-swap="none" data-bp-mutation-scope><input name="path" value="/crm/users"><input name="fixedParam.section" value="users"><div data-bp-mutation-error role="alert" hidden></div><button>Save route</button></form>'));
  await page.getByRole("button", { name: "Save route" }).click();
  await page.locator("#route-form [data-bp-mutation-error]").getByText("section is missing from the service parameter schema.").waitFor();
  assert.equal(await page.locator("#route-list").isVisible(), true);
  assert.equal(await page.locator('[name="path"]').inputValue(), "/crm/users");
  assert.equal(await page.locator('[name="fixedParam.section"]').inputValue(), "users");
  assert.equal(page.url(), "https://app.test/ui/batches");
  assert.deepEqual(errors, []);
});

test("declared parameter routes preserve IDs, static titles, queries and direct refresh", async t => {
  const requests: string[] = [];
  const { page, errors } = await shell(t, [list, detail], route => {
    requests.push(route.request().url());
    return response(route, new URL(route.request().url()).pathname === "/batches"
      ? '<a id="detail" href="/batches/caf%C3%A9?tab=history">Open</a>' : '<p id="batch">Batch</p>');
  });
  await page.waitForSelector("#detail");
  assert.equal(await page.locator("#detail").getAttribute("href"), "/ui/batches/caf%C3%A9?tab=history");
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  assert.equal(await page.locator("[data-bp-current-title]").textContent(), "Batch details");
  await page.reload();
  await page.waitForSelector("#batch");
  assert.ok(requests.every(url => !url.includes("%25C3")));
  assert.equal(requests.at(-1), "https://service.test/batches/caf%C3%A9?tab=history");
  assert.deepEqual(errors, []);
});

test("current-page forms resolve the service path with explicit same-service ownership", async t => {
  let posted = "";
  const { page, errors } = await shell(t, [list, detail], route => {
    if (route.request().method() === "POST") { posted = route.request().url(); return response(route, '<p id="saved">Saved</p>', {}, 200, "fragment"); }
    return response(route, '<div data-bp-service-id="service"><form><input name="note" value="test"><button>Save</button></form></div>');
  }, "/ui/batches/1?tab=edit");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForSelector("#saved");
  assert.equal(posted, "https://service.test/batches/1?tab=edit");
  assert.deepEqual(errors, []);
});

test("page titles and parents commit on navigation and reset through Up and history", async t => {
  const { page, errors } = await shell(t, [list, detail], route => new URL(route.request().url()).pathname === "/batches"
    ? response(route, '<a id="detail" href="/batches/1">Open</a>')
    : response(route, '<p id="batch">Batch</p>', { title: 'Batch 1; café "A"', parents: ['<Sales>', '/batches?tab=all'] }));
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  assert.equal(await page.locator("[data-bp-current-title]").textContent(), 'Batch 1; café "A"');
  assert.equal(await page.title(), 'Batch 1; café "A" - App');
  assert.equal(await page.getByRole("navigation", { name: "Breadcrumb" }).locator("li").first().textContent(), "<Sales>");
  assert.equal(await page.locator('[aria-current="page"]').textContent(), 'Batch 1; café "A"');
  assert.equal(await page.getByRole("link", { name: "Import batches", exact: true }).getAttribute("href"), "/ui/batches?tab=all");
  await page.getByRole("link", { name: "Up to Import batches" }).click();
  await page.waitForSelector("#detail");
  assert.equal(await page.locator("[data-bp-current-title]").textContent(), "Import batches");
  assert.equal(await page.locator("[data-bp-up]").isVisible(), false);
  await page.goBack();
  await page.waitForSelector("#batch");
  assert.equal(await page.title(), 'Batch 1; café "A" - App');
  await page.goForward();
  await page.waitForSelector("#detail");
  assert.equal(await page.title(), "Import batches · App");
  assert.deepEqual(errors, []);
});

test("preload and no-content or fragment responses leave active page metadata alone", async t => {
  const { page, errors } = await shell(t, [list, detail], route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/batches/1") return response(route, '<p id="batch">Batch</p>', { title: "Batch 1", parents: ["/batches"] });
    if (path === "/noop") return response(route, "", { title: "Wrong", "hide-header": true }, 204);
    if (path === "/fragment") return response(route, '<p id="fragment">Fragment</p>', { title: "Wrong", "hide-header": true }, 200, "fragment");
    return response(route, '<a id="detail" href="/batches/1">Open</a><button id="noop" hx-get="https://service.test/noop">Noop</button><button id="fragment-link" hx-get="https://service.test/fragment" hx-target="#region">Fragment</button><div id="region"></div>', { title: "Current" });
  });
  await page.waitForSelector("#detail");
  await page.locator("#detail").dispatchEvent("mouseover");
  await page.evaluate(async () => { await (document.querySelector("#detail") as any)._htmx.preload.prefetch; });
  assert.equal(await page.title(), "Current - App");
  await page.locator("#noop").click();
  await page.locator("#fragment-link").click();
  await page.waitForSelector("#fragment");
  assert.equal(await page.title(), "Current - App");
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-chrome-hide-header"), null);
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  assert.equal(await page.title(), "Batch 1 - App");
  assert.deepEqual(errors, []);
});

test("text immediate parents hide Up and unresolved or ambiguous paths are omitted", async t => {
  const alias = { ...list, href: "/alternate/batches" };
  const { page, errors } = await shell(t, [list, detail, alias], route => response(route, '<p id="batch">Batch</p>', {
    title: "123", parents: ["/batches", "/missing", "Imports", "Current workflow"]
  }), "/ui/batches/1");
  await page.waitForSelector("#batch");
  assert.equal(await page.locator("[data-bp-current-title]").textContent(), "123");
  assert.deepEqual(await page.getByRole("navigation", { name: "Breadcrumb" }).locator("li").allTextContents(), ["Imports", "Current workflow", "123"]);
  assert.equal(await page.locator("[data-bp-up]").isVisible(), false);
  assert.deepEqual(errors, []);
});

test("main-outlet fragments and cancelled swaps do not change the current title or chrome", async t => {
  const { page, errors } = await shell(t, [list, detail], route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/batches/1") return response(route, '<p id="never-swapped">Next page</p>', { title: "Wrong", "hide-header": true });
    if (path === "/fragment") return response(route, '<p id="fragment">Updated fragment</p>', { title: "Wrong", "hide-header": true }, 200, "fragment");
    return response(route, '<a id="cancelled" href="/batches/1">Cancelled</a><button id="fragment-link" hx-get="https://service.test/fragment">Fragment</button>');
  });
  await page.waitForSelector("#cancelled");
  await page.evaluate(() => document.addEventListener("htmx:before:swap", event => {
    if ((event as CustomEvent).detail.ctx.request.action.endsWith("/batches/1")) event.preventDefault();
  }));
  await page.locator("#cancelled").click();
  await page.locator("#fragment-link").click();
  await page.waitForSelector("#fragment");
  assert.equal(await page.locator("#never-swapped").count(), 0);
  assert.equal(await page.title(), "Import batches · App");
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-chrome-hide-header"), null);
  assert.deepEqual(errors, []);
});

test("failed navigation preserves the last committed page presentation", async t => {
  const { page, errors } = await shell(t, [list, detail], route => new URL(route.request().url()).pathname === "/batches"
    ? response(route, '<a id="detail" href="/batches/1">Open</a>', { title: "Import queue", parents: ["Imports"] })
    : response(route, "Failed", { title: "Wrong", parents: ["/batches"], "hide-header": true }, 500));
  await page.locator("#detail").click();
  await page.waitForFunction(() => document.querySelector("#bp-main")?.textContent?.includes("Internal Server Error"));
  assert.equal(await page.title(), "Import queue - App");
  assert.deepEqual(await page.getByRole("navigation", { name: "Breadcrumb" }).locator("li").allTextContents(), ["Imports", "Import queue"]);
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-chrome-hide-header"), null);
  assert.deepEqual(errors, []);
});

test("custom themes can expose Up without a breadcrumb outlet", async t => {
  const { page, errors } = await shell(t, [list, detail], route => new URL(route.request().url()).pathname === "/batches"
    ? response(route, '<a id="detail" href="/batches/1">Open</a>')
    : response(route, '<p id="batch">Batch</p>', { title: "Batch 1", parents: ["/batches"] }));
  await page.waitForSelector("#detail");
  await page.evaluate(() => document.querySelector("[data-bp-current-breadcrumb]")?.remove());
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  assert.equal(await page.getByRole("link", { name: "Up to Import batches" }).getAttribute("href"), "/ui/batches");
  assert.deepEqual(errors, []);
});

test("unresolved-link DOM text cannot become error-outlet HTML", async t => {
  const { page, errors } = await shell(t, [list], route => response(route,
    '<a id="unavailable" href="/missing">Unavailable</a>'), "/ui/batches", true);
  await page.waitForSelector("#unavailable");
  await page.locator("#unavailable").evaluate(element => element.setAttribute("data-bp-route-error", '<img id="injected" src="missing.png" onerror="window.injected=true">'));
  await page.locator("#unavailable").click();
  assert.equal(await page.locator("#error-outlet #injected").count(), 0);
  assert.equal(await page.locator("#error-outlet").textContent(), "This destination is not available in this app.");
  assert.deepEqual(errors, []);
});

test("shells without an app-title attribute update and restore browser titles", async t => {
  const { page, errors } = await shell(t, [list, detail], route => new URL(route.request().url()).pathname === "/batches"
    ? response(route, '<a id="detail" href="/batches/1">Open</a>')
    : response(route, '<p id="batch">Batch</p>', { title: "Batch 1", parents: ["/batches"] }));
  await page.waitForSelector("#detail");
  await page.evaluate(() => document.querySelector("[data-bp-shell-root]")?.removeAttribute("data-bp-document-title"));
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  assert.equal(await page.title(), "Batch 1 - App");
  await page.getByRole("link", { name: "Up to Import batches" }).click();
  await page.waitForSelector("#detail");
  assert.equal(await page.title(), "App");
  assert.deepEqual(errors, []);
});

test("custom chrome arrays retain their type without converting literal JSON strings", async t => {
  const { page, errors } = await shell(t, [list, detail], route => new URL(route.request().url()).pathname === "/batches"
    ? response(route, '<a id="detail" href="/batches/1">Open</a>')
    : response(route, '<p id="batch">Batch</p>', { tabs: ["summary", "//display"], literal: '["summary","//display"]', parents: ["/batches"] }));
  await page.locator("#detail").click();
  await page.waitForSelector("#batch");
  const chrome = await page.evaluate(() => (window as any).appliedChrome);
  assert.deepEqual(chrome.tabs, ["summary", "//display"]);
  assert.equal(chrome.literal, '["summary","//display"]');
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-array-chrome-tabs"), "true");
  await page.getByRole("link", { name: "Up to Import batches" }).click();
  await page.waitForSelector("#detail");
  assert.equal(await page.locator("[data-bp-shell-root]").getAttribute("data-bp-array-chrome-tabs"), null);
  assert.deepEqual(errors, []);
});
