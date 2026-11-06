import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createContext, Script } from "node:vm";
import { toHtmlString } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-workos/bp-routes/login/_renderer.bootstrap5/GET.js";

test("WorkOS login script is valid on repeated swaps and redirects only in automatic modes", () => {
  const html = toHtmlString(render({ status: "ok", loginUI: "default", authorizationUrl: "https://auth.test/authorize" }, { request: { query: {} }, app: { defaultRoute: "/" } } as never));
  const source = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert(source);
  const script = new Script(source);
  let clicks = 0;
  const dataset = { redirectUrl: "https://auth.test/authorize", mode: "ok", autoRedirect: "true" };
  const context = createContext({ document: {
    currentScript: { closest: () => ({ dataset }) },
    createElement: () => ({ href: "", click() { clicks++; }, remove() {} }),
    body: { appendChild() {} }
  } });
  script.runInContext(context);
  script.runInContext(context);
  assert.equal(clicks, 2, "repeated HTMX swaps must not redeclare global bindings");
  dataset.autoRedirect = "false";
  script.runInContext(context);
  dataset.autoRedirect = "true";
  dataset.mode = "error";
  script.runInContext(context);
  dataset.mode = "ok";
  dataset.redirectUrl = "";
  script.runInContext(context);
  assert.equal(clicks, 2, "manual/error/empty destinations must not redirect");
});

test("WorkOS login saves only a state fingerprint before navigating to the provider", async () => {
  const html = toHtmlString(render({ status: "ok", loginUI: "redirect",
    authorizationUrl: "https://auth.test/authorize?state=issued-nonce" },
  { request: { query: {} }, app: { defaultRoute: "/" } } as never));
  assert.match(html, /data-oauth-state="issued-nonce"/);
  const source = /<script>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  assert(source);
  const saved: Array<[string, string]> = [];
  let clicked = false;
  new Script(source).runInNewContext({
    TextEncoder,
    crypto: { subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => Uint8Array.from(createHash("sha256").update(bytes).digest()).buffer } },
    sessionStorage: { setItem: (key: string, value: string) => saved.push([key, value]) },
    document: {
      currentScript: { closest: () => ({ dataset: { oauthState: "issued-nonce", stateKey: "bp:workos:oauth-state", redirectUrl: "https://auth.test/authorize", mode: "ok", autoRedirect: "true" } }) },
      createElement: () => ({ click: () => { clicked = true; }, remove() {} }), body: { appendChild() {} }
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(saved, [["bp:workos:oauth-state", createHash("sha256").update("issued-nonce").digest("hex")]]);
  assert.equal(clicked, true);
});

test("manual Continue stays blocked until the state fingerprint is stored", async t => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const html = toHtmlString(render({ status: "ok", loginUI: "clean",
    authorizationUrl: "https://auth.test/authorize?state=issued-nonce" },
  { request: { query: {} }, app: { defaultRoute: "/" } } as never));
  const delayedHtml = html.replace('crypto.subtle.digest("SHA-256",bytes)', 'window.delayedDigest(bytes)');
  assert.notEqual(delayedHtml, html, "test must delay the rendered digest call");
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    (window as any).releaseDigest = release;
    (window as any).delayedDigest = async (bytes: Uint8Array) => {
      await pending;
      return digest("SHA-256", bytes);
    };
  });
  await page.route("https://app.test/login", route => route.fulfill({ contentType: "text/html", body: delayedHtml }));
  await page.route("https://auth.test/**", route => route.fulfill({ contentType: "text/html", body: "Provider" }));
  await page.goto("https://app.test/login");
  const prevented = await page.locator("a.btn-primary").evaluate(link => {
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    let blockedByLink = false;
    document.addEventListener("click", event => {
      blockedByLink = event.defaultPrevented;
      event.preventDefault();
    }, { once: true });
    link.dispatchEvent(click);
    return blockedByLink;
  });
  assert.equal(prevented, true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("bp:workos:oauth-state")), null);
  await page.evaluate(() => (window as any).releaseDigest());
  await page.waitForFunction(() => sessionStorage.getItem("bp:workos:oauth-state") !== null);
  assert.equal(await page.locator("a.btn-primary").getAttribute("aria-disabled"), null);
});
