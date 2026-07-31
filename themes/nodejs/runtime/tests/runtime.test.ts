import assert from "node:assert/strict";
import test from "node:test";
import { js } from "jsx-htmx";
import {
  BETTERPORTAL_HTMX_EXTENSIONS,
  betterPortalChromeAttributes,
  betterPortalShellRuntimeSource,
  buildBetterPortalThemeRuntimeAsset
} from "../src/index.js";

test("backend assembles HTMX, theme adapter, shell, and SSE in order", async () => {
  const adapterSource = js(() => {
    (globalThis as typeof globalThis & { __bpThemeAdapterLoaded?: boolean }).__bpThemeAdapterLoaded = true;
  });
  const marker = "__bpThemeAdapterLoaded";
  const asset = await buildBetterPortalThemeRuntimeAsset({
    themeId: "test-theme",
    adapterSource
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

test("chrome attributes are normalized for initial shell rendering", () => {
  assert.deepEqual(betterPortalChromeAttributes({
    fullScreen: true,
    hide_menu: false,
    density: "compact",
    zoom: 1.25,
    invalid$key: "ignored",
    infinite: Number.POSITIVE_INFINITY
  }), {
    "data-bp-chrome-full-screen": "true",
    "data-bp-chrome-hide-menu": "false",
    "data-bp-chrome-density": "compact",
    "data-bp-chrome-zoom": "1.25"
  });
});

test("shared shell owns generic chrome lifecycle", () => {
  const source = betterPortalShellRuntimeSource("test-theme");
  assert.match(source, /data-bp-chrome-/);
  assert.match(source, /removeAttribute/);
  assert.match(source, /themeAdapter\.applyChrome/);
  assert.doesNotMatch(source, /setChromeFullScreen/);
});
