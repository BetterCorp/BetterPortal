import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { chromium, type Route } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";
import { buildServiceViewUrl, resolveAppRoute } from "../../../../framework/nodejs/src/runtime/configProvider.js";
import type { BetterPortalApp } from "../../../../framework/nodejs/src/contracts/platformConfig.js";

const list = { href: "/ui/batches", requestUrl: "https://service.test/batches", serviceId: "service", kind: "page", title: "Import batches" };
const detail = { ...list, href: "/ui/batches/:batchId", requestUrl: "https://service.test/batches/%3AbatchId", title: "Batch details" };
type Mount = typeof list;
const response = (route: Route, body: string, chrome = {}, status = 200, mode = "page") => route.fulfill({
  status, body: status === 204 ? "" : body,
  contentType: `text/html; mode=${mode}` + Object.entries(chrome).map(([key, value]) => `; bp-chrome-${key}=${encodeURIComponent(Array.isArray(value) ? JSON.stringify(value) : String(value))}`).join(""),
  headers: { "access-control-allow-origin": "*" }
});
async function shell(t: TestContext, mounts: Mount[], respond: (route: Route) => Promise<void>, path = "/ui/batches") {
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
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'></head><body>
      <div data-bp-shell-root data-bp-menu-health="false" data-bp-document-title="App" data-bp-services='{"service":"https://service.test"}' data-bp-routes='${JSON.stringify(mounts)}'>
      <h1 data-bp-current-title></h1><div data-bp-current-breadcrumb></div><a data-bp-up hidden>Up</a><button data-bp-back>Back</button>
      <main id="bp-main" data-bp-service="service" hx-get="${action}" hx-trigger="load" hx-target="#bp-main" hx-swap="innerHTML"></main></div><script>${asset.body}</script></body></html>` });
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
