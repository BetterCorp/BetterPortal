import assert from "node:assert/strict";
import test from "node:test";
import { js } from "jsx-htmx";
import {
  BETTERPORTAL_HTMX_EXTENSIONS,
  betterPortalChromeAttributes,
  betterPortalShellRuntimeSource,
  buildBetterPortalShellRuntimeAsset
} from "../src/index.js";

test("backend assembles HTMX, shell adapter, shell, and SSE in order", async () => {
  const adapterSource = js(() => {
    (globalThis as typeof globalThis & { __bpShellAdapterLoaded?: boolean }).__bpShellAdapterLoaded = true;
  });
  const marker = "__bpShellAdapterLoaded";
  const asset = await buildBetterPortalShellRuntimeAsset({
    adapterSource
  });
  const source = asset.body;

  assert.ok(source.indexOf("4.0.0-beta6") < source.indexOf(marker));
  assert.ok(source.indexOf(marker) < source.indexOf('registerExtension("bp-shell"'));
  assert.ok(source.indexOf('registerExtension("bp-shell"') < source.lastIndexOf('registerExtension("sse"'));
  assert.doesNotMatch(source, /theme=/);
});

test("shell owns header-aware preload and native API allowlist rewriting", () => {
  const source = betterPortalShellRuntimeSource();

  assert.match(source, /attachBpHeaders\(headers,action\)/);
  assert.match(source, /detail\.ctx\.fetch=\(\)=>preload\.prefetch/);
  assert.match(source, /matchServiceRoute\(elServiceId,pathOnly,"api"\)/);
  assert.match(source, /resolvedPath\.search\+resolvedPath\.hash/);
  assert.match(source, /el\.setAttribute\("href",tenantUrl\)/);
  assert.match(source, /data-bp-shell-route","api"/);
  assert.equal(BETTERPORTAL_HTMX_EXTENSIONS, "bp-shell, sse");
});

test("history restoration uses the shell fragment route pipeline", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /htmx:before:history:restore/);
  assert.match(source, /hx-sync","#bp-main:replace"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /triggerShellLink\(detail\.path,serviceUrl,true\)/);
});

test("main outlet HTTP errors only swap explicit themed status views", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /mode=status/);
  assert.match(source, /isThemedStatusResponse\(ctx\)/);
  assert.match(source, /htmx_response_error/);
  assert.match(source, /renderRouteError\(errorTitle\(status\),errorMessage\(status\)/);
  assert.match(source, /applyChrome\(null\)/);
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
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /data-bp-chrome-/);
  assert.match(source, /removeAttribute/);
  assert.match(source, /shellAdapter\.applyChrome/);
  assert.doesNotMatch(source, /setChromeFullScreen/);
});

test("shared shell owns bp-element states without browser schema discovery", () => {
  const source = betterPortalShellRuntimeSource();
  assert.match(source, /bp-element\[data-bp-element\]/);
  assert.match(source, /statusSpecificity/);
  assert.match(source, /bp:element-retry/);
  assert.match(source, /bpElementStateSwaps\.has\(element\)/);
  assert.match(source, /bpElementStateSwaps\.has\(bpElement\)/);
  assert.match(source, /finally\(\(\)=>bpElementStateSwaps\.delete\(element\)\)/);
  assert.match(source, /states\.ok===void 0\?responseHtml/);
  assert.doesNotMatch(source, /loadBackgroundFragments/);
  assert.doesNotMatch(source, /\.well-known\/bp\/schema\.json/);
});
