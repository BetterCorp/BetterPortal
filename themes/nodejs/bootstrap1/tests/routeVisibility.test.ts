import assert from "node:assert/strict";
import test from "node:test";
import { loadBootstrap1Asset } from "../src/plugins/service-betterportal-theme-bootstrap1/assets.js";
import { Bootstrap1AdapterSource } from "../src/plugins/service-betterportal-theme-bootstrap1/adapter.js";
import { isUserFacingRoute, renderBootstrap1HostPage, renderBootstrap1Shell } from "../src/plugins/service-betterportal-theme-bootstrap1/shell/index.js";

test("API routes are never browser navigation candidates", () => {
  assert.equal(isUserFacingRoute({ kind: "page", href: "/tunnels/dashboard" }), true);
  assert.equal(isUserFacingRoute({ kind: "api", href: "/tunnels/dashboard" }), false);
  assert.equal(isUserFacingRoute({ href: "/_bp/service/example/tunnels/dashboard" }), false);
});

test("sidebar titles remain text when the adapter converts them", async t => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<div id="root"><section data-bp-sidebar="panel" data-bp-sidebar-title="&lt;img src=x onerror=alert(1)&gt;"><button id="existing">Open</button></section></div>');
  await page.evaluate(() => { (window as any).bootstrap = {}; });
  await page.addScriptTag({ content: "const __name = value => value;\n" + String(Bootstrap1AdapterSource) });
  await page.evaluate(() => (window as any).BetterPortalShellAdapter.initComponents(document.querySelector("#root")));
  assert.equal(await page.locator("#panel img").count(), 0);
  assert.equal(await page.locator("#panel .offcanvas-title").innerText(), '<img src=x onerror=alert(1)>');
  assert.equal(await page.locator("#existing").count(), 1);
});

test("navigation building stays fast with a long interior slash run", () => {
  const href = `/${"/".repeat(50_000)}page`;
  const started = performance.now();
  renderBootstrap1HostPage({
    title: "Test", brandName: "Test", themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets", currentPath: "/", routeLinks: [
      { href, requestUrl: "https://service.test/page", serviceId: "service", kind: "page", title: "Page", active: false }
    ]
  } as never);
  assert.ok(performance.now() - started < 250, "navigation normalization must stay linear");
});

test("SSE requests keep BetterPortal headers", async () => {
  const asset = await loadBootstrap1Asset("bootstrap1-shell.js");
  const source = String(asset?.body);
  const hook = source.slice(source.indexOf("htmx_config_request"), source.indexOf("htmx_before_request"));
  assert.match(hook, /isSseConnect\s*\|\|\s*!isMainTarget\(ctx\.target\)/);
  assert.match(hook, /if\s*\(isSseConnect\)[\s\S]*HX-Request-Type[\s\S]*partial/);
  assert.match(hook, /attachBpHeaders\(ctx\.request\.headers/);
});

test("marked fragment errors open a dismissible modal", async () => {
  const asset = await loadBootstrap1Asset("bootstrap1-shell.js");
  const source = String(asset?.body);
  assert.match(source, /source\.closest\("\[data-bp-error-modal\]"\)/);
  assert.match(source, /data-bs-dismiss="modal">Dismiss/);
  assert.match(source, /Modal\.getOrCreateInstance\(modal\)\.show\(\)/);
  assert.match(source, /modal\.setAttribute\("data-bp-service",context\.serviceId\)/);
  assert.ok(source.indexOf('modal.setAttribute("data-bp-service",context.serviceId)') < source.indexOf("window.htmx.process(body)"));
});

test("Bootstrap initializes before shell overlay cleanup", () => {
  const html = renderBootstrap1Shell({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    assetVersion: "10.6.9",
    bodyHtml: ""
  });
  assert.ok(html.indexOf("bootstrap.bundle.min.js") < html.indexOf("bootstrap1-core.js"));
  assert.match(html, /bootstrap1-core\.js\?v=10\.6\.9[^>]*fetchpriority="high"/);
});

test("fullscreen chrome keeps the normal shell and does not imply auth", () => {
  const html = renderBootstrap1HostPage({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    currentPath: "/login",
    routeLinks: [],
    serviceOrigins: { fragment: "https://fragment.test" },
    chrome: { fullScreen: true }
  });
  assert.match(html, /data-bp-chrome-full-screen="true"/);
  assert.match(html, /data-bp-services="[^"\n]*fragment[^"\n]*https:\/\/fragment\.test/);
  assert.match(html, /class="bp-admin"/);
  assert.doesNotMatch(html, /data-bp-auth-mode/);
});

test("open card dropdowns rise above later cards", () => {
  const html = renderBootstrap1Shell({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    bodyHtml: ""
  });
  assert.match(html, /\.bp-shell__main \.card:has\(\.dropdown-menu\.show\)/);
});

test("open dropdowns and native options follow both palettes outside main content", async t => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route("**/*", route => route.abort());
  const html = renderBootstrap1Shell({
    title: "Theme test", brandName: "Test", themeMode: "dark",
    themeConfig: { mode: "dark", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets", bodyHtml: ""
  });
  await page.setContent(html);
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = '<div class="dropdown-menu show"><button class="dropdown-item">Menu item</button></div><select><option>Choice</option></select>';
    document.body.append(fixture);
  });
  for (const mode of ["dark", "light"] as const) {
    await page.evaluate(value => document.documentElement.dataset.bsTheme = value, mode);
    const colors = await page.evaluate(() => {
      return {
        menu: getComputedStyle(document.querySelector(".dropdown-menu")!).backgroundColor,
        item: getComputedStyle(document.querySelector(".dropdown-item")!).color,
        option: getComputedStyle(document.querySelector("option")!).backgroundColor,
        optionText: getComputedStyle(document.querySelector("option")!).color
      };
    });
    const channel = (value: string) => Number(value.match(/\d+/)![0]);
    if (mode === "dark") {
      assert.ok(channel(colors.menu) < 100);
      assert.ok(channel(colors.option) < 100);
      assert.ok(channel(colors.item) > 200);
      assert.ok(channel(colors.optionText) > 200);
    } else {
      assert.ok(channel(colors.menu) > 200);
      assert.ok(channel(colors.option) > 200);
      assert.ok(channel(colors.item) < 100);
      assert.ok(channel(colors.optionText) < 100);
    }
  }
});

test("initial 404 stays visible after Bootstrap1 runtime initialization", async t => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const html = renderBootstrap1HostPage({
    title: "Test", brandName: "Test", themeMode: "dark",
    themeConfig: { mode: "dark", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets", currentPath: "/users", routeLinks: [], serviceOrigins: {},
    initialRouteStatus: 404, initialRouteError: "No enabled route matches this path."
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.href === "https://app.test/users") {
      return route.fulfill({ status: 404, contentType: "text/html", body: html });
    }
    if (url.origin === "https://app.test" && url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js")) {
      const asset = await loadBootstrap1Asset(url.pathname.slice("/assets/".length));
      assert.ok(asset);
      return route.fulfill({ contentType: asset.contentType, body: String(asset.body) });
    }
    return route.fulfill({ status: 200, body: "" });
  });
  await page.goto("https://app.test/users");
  await page.waitForLoadState("load");
  assert.deepEqual(errors, []);
  assert.match(await page.locator("#bp-main").innerText(), /Route Not Found/);
  assert.equal(await page.locator(".bp-admin__content-frame").evaluate(el => el.classList.contains("is-loading")), false);
  assert.equal(await page.locator("#bp-main").getAttribute("hx-trigger"), null);
});
