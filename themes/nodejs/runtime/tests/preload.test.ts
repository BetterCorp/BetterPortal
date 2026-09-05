import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";

test("Bootstrap 1 menu preloads are reused and can be refreshed after expiry", { timeout: 30_000 }, async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const asset = await buildBetterPortalShellRuntimeAsset({});
  let requests = 0;
  let status = 200;
  const headers: Record<string, string>[] = [];
  await page.route("https://service.test/**", async route => {
    requests++;
    headers.push(route.request().headers());
    await route.fulfill({ status, contentType: "text/html", body: `<p id="result">Response ${requests}</p>`, headers: { "access-control-allow-origin": "*" } });
  });
  await page.route("https://app.test/**", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse","historyCacheSize":20}'></head><body>
    <div data-bp-shell-root data-bp-menu-health="false" data-bp-services='{"service":"https://service.test"}'>
      <a id="menu" href="/next" data-bp-route-link data-bp-service="service" hx-get="https://service.test/view" hx-target="#bp-main" hx-swap="innerHTML" hx-push-url="/next" hx-preload="mouseover">Next</a>
      <main id="bp-main" data-bp-loaded="yes"></main>
    </div><script>${asset.body}</script></body></html>` }));
  await page.goto("https://app.test/start");
  const link = page.locator("#menu");
  await link.dispatchEvent("mouseover");
  await page.waitForFunction(() => !!(document.querySelector("#menu") as any)._htmx?.preload);
  await link.click();
  await page.waitForSelector("#result");
  assert.equal(requests, 1, "click should consume the hovered response");
  assert.equal(headers[0].accept, "text/html; mode=page");
  await link.dispatchEvent("mouseover");
  await page.waitForFunction(() => !!(document.querySelector("#menu") as any)._htmx?.preload);
  await page.evaluate(() => { const now = Date.now(); Date.now = () => now + 6000; });
  await link.dispatchEvent("mouseover");
  await link.click();
  await page.waitForFunction(() => document.querySelector("#result")?.textContent === "Response 3");
  await link.dispatchEvent("mouseover");
  await page.waitForFunction(() => !!(document.querySelector("#menu") as any)._htmx?.preload);
  await page.waitForFunction(() => (document.querySelector("#menu") as any)._htmx.preload.expiresAt > Date.now());
  await page.evaluate(async () => { await (document.querySelector("#menu") as any)._htmx.preload.prefetch; });
  assert.equal(requests, 4, "an expired cache must not permanently disable hover");

  await page.evaluate(() => localStorage.setItem("bp.headers", JSON.stringify({
    authorization: { value: "Bearer changed-session", owner: "service", scope: null, locked: true }
  })));
  await link.click();
  await page.waitForFunction(() => document.querySelector("#result")?.textContent === "Response 5");
  assert.equal(headers[4].authorization, "Bearer changed-session", "a new session must not reuse the old response");

  await link.dispatchEvent("mouseover");
  await page.evaluate(async () => { await (document.querySelector("#menu") as any)._htmx.preload.prefetch; });
  await link.evaluate(el => el.setAttribute("hx-get", "https://service.test/other"));
  await link.dispatchEvent("mouseover");
  await page.evaluate(async () => { await (document.querySelector("#menu") as any)._htmx.preload.prefetch; });
  await link.click();
  await page.waitForFunction(() => document.querySelector("#result")?.textContent === "Response 7");
  assert.equal(requests, 7, "a changed URL gets a fresh reusable preload");
  status = 500;
  await link.dispatchEvent("mouseover");
  await page.waitForFunction(() => !(document.querySelector("#menu") as any)._htmx?.preload);
  status = 200;
  await link.dispatchEvent("mouseover");
  await link.click();
  await page.waitForFunction(() => document.querySelector("#result")?.textContent === "Response 9");
  assert.equal(requests, 9, "a failed preload can be retried immediately");
  assert.deepEqual(errors, []);
});
