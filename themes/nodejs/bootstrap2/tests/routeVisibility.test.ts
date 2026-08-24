import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadBootstrap2Asset } from "../src/plugins/service-betterportal-theme-bootstrap2/assets.js";
import { isUserFacingRoute, renderBootstrap2HostPage, renderBootstrap2Shell } from "../src/plugins/service-betterportal-theme-bootstrap2/shell/index.js";
import { BOOTSTRAP2_VERSION, bootstrap2AssetUrl, bootstrap2ServiceWorkerSource } from "../src/plugins/service-betterportal-theme-bootstrap2/cache.js";
import { defaultItems as criticalAlertDefaults, render as renderCriticalAlerts } from "../src/plugins/service-betterportal-theme-bootstrap2/shell/_critical-alerts/index.js";

test("API routes are never browser navigation candidates", () => {
  assert.equal(isUserFacingRoute({ kind: "page", href: "/tunnels/dashboard" }), true);
  assert.equal(isUserFacingRoute({ kind: "api", href: "/tunnels/dashboard" }), false);
  assert.equal(isUserFacingRoute({ href: "/_bp/service/example/tunnels/dashboard" }), false);
});

test("SSE requests keep BetterPortal headers", async () => {
  const asset = await loadBootstrap2Asset("bootstrap2-shell.js");
  const source = String(asset?.body);
  const hook = source.slice(source.indexOf("htmx_config_request"), source.indexOf("htmx_before_request"));
  assert.match(hook, /if\s*\(!isSseConnect\)/);
  assert.match(hook, /attachBpHeaders\(ctx\.request\.headers/);
});

test("marked fragment errors open a dismissible modal", async () => {
  const asset = await loadBootstrap2Asset("bootstrap2-shell.js");
  const source = String(asset?.body);
  assert.match(source, /source\.closest\("\[data-bp-error-modal\]"\)/);
  assert.match(source, /data-bs-dismiss="modal">Dismiss/);
  assert.match(source, /Modal\.getOrCreateInstance\(modal\)\.show\(\)/);
  assert.match(source, /modal\.setAttribute\("data-bp-service",context\.serviceId\)/);
  assert.ok(source.indexOf('modal.setAttribute("data-bp-service",context.serviceId)') < source.indexOf("window.htmx.process(body)"));
});

test("Bootstrap initializes before shell overlay cleanup", () => {
  const html = renderBootstrap2Shell({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    bodyHtml: ""
  });
  assert.ok(html.indexOf("bootstrap.bundle.min.js") < html.indexOf("bootstrap2-core.js"));
});

test("versioned theme assets and the offline worker stay self-contained", async () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(BOOTSTRAP2_VERSION, packageJson.version);
  assert.equal(bootstrap2AssetUrl("bootstrap2-core.js"), `/_themes/bootstrap2/assets/bootstrap2-core.js?v=${BOOTSTRAP2_VERSION}`);

  const source = bootstrap2ServiceWorkerSource();
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /request\.mode==="navigate"/);
  assert.match(source, /url\.pathname\.startsWith\("\/_themes\/bootstrap2\/assets\/"\)/);
  assert.doesNotMatch(source, /caches\.put|cache\.put/);

  const offline = await loadBootstrap2Asset("offline.html");
  assert.match(String(offline?.body), /No network connection/);
  assert.match(String(offline?.body), new RegExp(`bootstrap2-core\\.js\\?v=${BOOTSTRAP2_VERSION}`));
});

test("critical alert block is empty by default and service-content agnostic", () => {
  assert.deepEqual(criticalAlertDefaults, []);
  assert.equal(renderCriticalAlerts({ items: ["<div></div>", "<div>live</div>"] } as any), "<div></div><div>live</div>");

  const html = renderBootstrap2HostPage({
    title: "Test",
    brandName: "Test",
    themeMode: "dark",
    themeConfig: { mode: "dark", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    assetVersion: "1",
    currentPath: "/",
    routeLinks: []
  });
  assert.match(html, /id="bp-frag-critical-alerts"/);
  assert.match(html, /hx-get="\/\.well-known\/bp\/shell\/fragment\/critical-alerts"/);
});

test("fullscreen chrome keeps the normal shell and does not imply auth", () => {
  const html = renderBootstrap2HostPage({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    currentPath: "/login",
    routeLinks: [],
    chrome: { fullScreen: true }
  });
  assert.match(html, /data-bp-chrome-full-screen="true"/);
  assert.match(html, /class="bp-admin"/);
  assert.doesNotMatch(html, /data-bp-auth-mode/);
});

test("open card dropdowns rise above later cards", () => {
  const html = renderBootstrap2Shell({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    bodyHtml: ""
  });
  assert.match(html, /\.bp-shell__main \.card:has\(\.dropdown-menu\.show\)/);
});
