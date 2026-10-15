import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { renderBootstrapWizardHtml } from "../src/plugins/service-betterportal-config-manager/bootstrapWizardHtml.js";

test("bootstrap issuer cannot escape the setup page script", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const issuer = 'https://manager.test/</script><script>window.__bootstrapXss = true</script>';
  await page.route("https://manager.test/setup", route => route.fulfill({
    contentType: "text/html", body: renderBootstrapWizardHtml({ cpIssuer: issuer })
  }));
  await page.goto("https://manager.test/setup");
  assert.equal(await page.evaluate(() => (window as any).__bootstrapXss), undefined);
});

test("setup progress labels are displayed as text", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route("https://manager.test/setup", route => route.fulfill({
    contentType: "text/html", body: renderBootstrapWizardHtml({ cpIssuer: "https://manager.test" })
  }));
  await page.goto("https://manager.test/setup");
  await page.evaluate(() => (window as any).step("injected", '<img src=x onerror="window.__bootstrapXss = true">'));
  await page.waitForTimeout(50);
  assert.equal(await page.locator("#injected img").count(), 0);
  assert.equal(await page.evaluate(() => (window as any).__bootstrapXss), undefined);
  assert.match(await page.locator("#injected").innerText(), /<img src=x onerror=/);
});
