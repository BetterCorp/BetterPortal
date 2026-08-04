import assert from "node:assert/strict";
import test from "node:test";
import { loadBootstrap1Asset } from "../src/plugins/service-betterportal-theme-bootstrap1/assets.js";
import { isUserFacingRoute, renderBootstrap1HostPage, renderBootstrap1Shell } from "../src/plugins/service-betterportal-theme-bootstrap1/shell/index.js";

test("API routes are never browser navigation candidates", () => {
  assert.equal(isUserFacingRoute({ kind: "page", href: "/tunnels/dashboard" }), true);
  assert.equal(isUserFacingRoute({ kind: "api", href: "/tunnels/dashboard" }), false);
  assert.equal(isUserFacingRoute({ href: "/_bp/service/example/tunnels/dashboard" }), false);
});

test("SSE requests keep BetterPortal headers", async () => {
  const asset = await loadBootstrap1Asset("bootstrap1-shell.js");
  const source = String(asset?.body);
  const hook = source.slice(source.indexOf("htmx_config_request"), source.indexOf("htmx_before_request"));
  assert.match(hook, /if\s*\(!isSseConnect\)/);
  assert.match(hook, /attachBpHeaders\(ctx\.request\.headers/);
});

test("marked fragment errors open a dismissible modal", async () => {
  const asset = await loadBootstrap1Asset("bootstrap1-shell.js");
  const source = String(asset?.body);
  assert.match(source, /source\.closest\("\[data-bp-error-modal\]"\)/);
  assert.match(source, /data-bs-dismiss="modal">Dismiss/);
  assert.match(source, /Modal\.getOrCreateInstance\(modal\)\.show\(\)/);
});

test("Bootstrap initializes before shell overlay cleanup", () => {
  const html = renderBootstrap1Shell({
    title: "Test",
    brandName: "Test",
    themeMode: "light",
    themeConfig: { mode: "light", bootstrap: {}, light: {}, dark: {} },
    assetBaseUrl: "/assets",
    bodyHtml: ""
  });
  assert.ok(html.indexOf("bootstrap.bundle.min.js") < html.indexOf("bootstrap1-core.js"));
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
    chrome: { fullScreen: true }
  });
  assert.match(html, /data-bp-chrome-full-screen="true"/);
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
