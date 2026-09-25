import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";

test("auth changes refresh menu on the public shell origin and discard stale menu responses", { timeout: 30_000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const asset = await buildBetterPortalShellRuntimeAsset({});
  let hold: (() => Promise<void>) | undefined;
  let deferNext = false;
  let requests = 0;
  const navHtml = (auth?: string) => `<a data-bp-route-link id="audience">${auth === "Bearer staff" ? "Staff" : auth === "Bearer client" ? "Client" : "Public"}</a>`;
  await context.route("https://app.test/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/.well-known/bp/theme/nav") {
      requests++;
      const body = navHtml(route.request().headers().authorization);
      if (deferNext) { deferNext = false; hold = () => route.fulfill({ contentType: "text/html", body }); return; }
      return route.fulfill({ contentType: "text/html", body });
    }
    if (path === "/identity") {
      const value = new URL(route.request().url()).searchParams.get("user");
      return route.fulfill({ contentType: "text/html", body: "", headers: value
        ? { "BP-SetHeader": `Authorization=Bearer ${value}; locked=true` }
        : { "BP-RemoveHeader": "Authorization" } });
    }
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="htmx-config" content='{"mode":"cors","extensions":"bp-shell, sse"}'></head><body>
      <div data-bp-shell-root data-bp-menu-health="false" data-bp-shell-service="shell" data-bp-services='{"shell":"https://internal-theme.test"}'>
      <nav id="bp-nav-desktop" data-bp-no-route hx-get="/.well-known/bp/theme/nav" hx-trigger="load, bp:fragments-changed from:body" hx-swap="innerHTML"></nav>
      <div data-bp-no-route><button id="staff" hx-get="/identity?user=staff" hx-target="#result">Staff</button><button id="client" hx-get="/identity?user=client" hx-target="#result">Client</button><button id="logout" hx-get="/identity" hx-target="#result">Logout</button></div>
      <div id="result"></div><main id="bp-main" data-bp-loaded="yes"></main></div><script>${asset.body}</script></body></html>` });
  });
  await page.goto("https://app.test/start");
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Public");
  await page.locator("#staff").click();
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Staff");
  // Leave an authenticated menu response in flight while signing out.
  deferNext = true;
  await page.evaluate(() => (window as any).htmx.trigger(document.body, "bp:fragments-changed"));
  await assert.doesNotReject(async () => { for (let i = 0; i < 100 && !hold; i++) await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(hold); });
  await page.locator("#logout").click();
  await page.waitForFunction(() => !document.querySelector("#audience"));
  await hold!();
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Public");
  await page.locator("#client").click();
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Client");
  // Another tab must invalidate this tab's personalized navigation too.
  const other = await page.context().newPage();
  await other.goto("https://app.test/start");
  await other.evaluate(() => localStorage.setItem("bp.headers", "{}"));
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Public");
  await other.close();
  await page.locator("#staff").click();
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Staff");
  // Expiry must refresh without waiting for a content-service response.
  await page.evaluate(() => {
    const values = JSON.parse(localStorage.getItem("bp.headers")!);
    values.authorization.expires = Math.floor(Date.now() / 1000);
    localStorage.setItem("bp.headers", JSON.stringify(values));
  });
  await page.waitForFunction(() => document.querySelector("#audience")?.textContent === "Public");
  assert.ok(requests >= 5);
  assert.deepEqual(errors, []);
});
