import assert from "node:assert/strict";
import test from "node:test";
import { loadEmbeddedAsset } from "../src/plugins/service-betterportal-theme-embedded/assets.js";
import { renderEmbeddedHostPage } from "../src/plugins/service-betterportal-theme-embedded/shell/index.js";

test("Embedded runtime keeps shared shell behavior", async () => {
  const asset = await loadEmbeddedAsset("embedded-core.js");
  const source = String(asset?.body);
  const hook = source.slice(source.indexOf("htmx_config_request"), source.indexOf("htmx_before_request"));

  assert.match(source, /registerExtension\(["']sse["']/);
  assert.match(source, /reconnectMaxAttempts:\s*Infinity/);
  assert.match(hook, /attachBpHeaders\(ctx\.request\.headers/);
  assert.match(source, /refreshStoredHeader/);
  assert.match(source, /bp-element\[data-bp-element\]/);
  assert.match(source, /#bp-main, \[data-bp-main-outlet\]/);
  assert.match(source, /BetterPortalShellAdapter/);
});

test("Embedded shell receives initial generic chrome", () => {
  const html = renderEmbeddedHostPage({
    title: "Embedded",
    assetBaseUrl: "/assets",
    assetVersion: "10.6.9",
    routeLinks: [],
    chrome: { fullScreen: true, hideHeader: true }
  });
  assert.match(html, /data-bp-chrome-full-screen="true"/);
  assert.match(html, /data-bp-chrome-hide-header="true"/);
  assert.match(html, /data-bp-menu-health="false"/);
  assert.match(html, /embedded-core\.js\?v=10\.6\.9[^>]*fetchpriority="high"/);
});
