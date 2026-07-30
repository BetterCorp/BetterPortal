import assert from "node:assert/strict";
import test from "node:test";
import {
  BETTERPORTAL_HTMX_EXTENSIONS,
  betterPortalShellRuntimeSource,
  buildBetterPortalThemeRuntimeAsset
} from "../src/index.js";

test("backend assembles HTMX, theme adapter, shell, and SSE in order", async () => {
  const marker = "window.__bpThemeAdapterLoaded = true";
  const asset = await buildBetterPortalThemeRuntimeAsset({
    themeId: "test-theme",
    adapterSource: marker
  });
  const source = asset.body;

  assert.ok(source.indexOf("4.0.0-beta6") < source.indexOf(marker));
  assert.ok(source.indexOf(marker) < source.indexOf('registerExtension("bp-shell"'));
  assert.ok(source.indexOf('registerExtension("bp-shell"') < source.lastIndexOf('registerExtension("sse"'));
  assert.match(source, /theme=test-theme/);
});

test("shell owns header-aware preload and native API allowlist rewriting", () => {
  const source = betterPortalShellRuntimeSource("test-theme");

  assert.match(source, /attachBpHeaders\(headers,action\)/);
  assert.match(source, /detail\.ctx\.fetch=\(\)=>preload\.prefetch/);
  assert.match(source, /matchServiceRoute\(elServiceId,pathOnly,"api"\)/);
  assert.match(source, /resolvedPath\.search\+resolvedPath\.hash/);
  assert.match(source, /el\.setAttribute\("href",tenantUrl\)/);
  assert.match(source, /data-bp-shell-route","api"/);
  assert.equal(BETTERPORTAL_HTMX_EXTENSIONS, "bp-shell, sse");
});
