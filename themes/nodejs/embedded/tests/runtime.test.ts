import assert from "node:assert/strict";
import test from "node:test";
import { loadEmbeddedAsset } from "../src/plugins/service-betterportal-theme-embedded/assets.js";

test("Embedded runtime keeps shared shell behavior", async () => {
  const asset = await loadEmbeddedAsset("embedded-core.js");
  const source = String(asset?.body);
  const hook = source.slice(source.indexOf("htmx_config_request"), source.indexOf("htmx_before_request"));

  assert.match(source, /registerExtension\(["']sse["']/);
  assert.match(source, /reconnectMaxAttempts:\s*Infinity/);
  assert.match(hook, /attachBpHeaders\(ctx\.request\.headers/);
  assert.match(source, /refreshStoredHeader/);
  assert.match(source, /bp:fragments-changed from:body/);
  assert.match(source, /#bp-main, \[data-bp-main-outlet\]/);
  assert.match(source, /BetterPortalThemeAdapter/);
});
