import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { raw } from "jsx-htmx";
import { buildBetterPortalShellRuntimeAsset } from "../src/runtime.js";
import * as bootstrap1 from "../../bootstrap1/lib/plugins/service-betterportal-theme-bootstrap1/shell/index.js";
import * as bootstrap2 from "../../bootstrap2/lib/plugins/service-betterportal-theme-bootstrap2/shell/index.js";

for (const theme of [
  { name: "bootstrap1", render: bootstrap1.renderBootstrap1Shell, ...bootstrap1 },
  { name: "bootstrap2", render: bootstrap2.renderBootstrap2Shell, ...bootstrap2 }
]) {
  test(`${theme.name} switches palettes, components and logos together and follows system changes`, async t => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ colorScheme: "dark" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const asset = await buildBetterPortalShellRuntimeAsset({});
    const config = { mode: "system" as "light" | "dark" | "system", bootstrap: {},
      light: { background: "#eeeeee", text: "#112233" },
      dark: { background: "#222222", text: "#ddeeff" },
      lightLogoUrl: "/light.svg", darkLogoUrl: "/dark.svg" };
    let refreshes = 0;
    await page.route("https://app.test/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("-core.js")) return route.fulfill({ contentType: "text/javascript", body: asset.body });
      if (path === "/.well-known/bp/theme/style") {
        refreshes++;
        return route.fulfill({ contentType: "text/html", body: String(theme.renderThemeStyles(config)) });
      }
      if (path === "/.well-known/bp/theme/brand") {
        refreshes++;
        return route.fulfill({ contentType: "text/html", body: String(theme.renderBrand("Brand", undefined, undefined, config)) });
      }
      if (path !== "/") return route.fulfill({ contentType: path.endsWith(".js") ? "text/javascript" : "text/css", body: "" });
      return route.fulfill({ contentType: "text/html", body: theme.render({
        title: "Mode test", brandName: "Brand", themeMode: "light", themeConfig: config, assetBaseUrl: "/assets",
        bodyHtml: raw(`<div data-bp-shell-root data-bp-menu-health="false">
          ${theme.renderBrand("Brand", undefined, undefined, config)}
          <button data-bp-theme-mode="light">Light</button><button data-bp-theme-mode="dark">Dark</button><button data-bp-theme-mode="system">System</button>
          <main id="bp-main"><a class="bp-admin__route">Route</a></main></div>`)
      }) });
    });
    const check = async (mode: "light" | "dark") => {
      await expect(page.locator("html")).toHaveAttribute("data-bs-theme", mode);
      await expect(page.locator("body")).toHaveCSS("color", mode === "light" ? "rgb(17, 34, 51)" : "rgb(221, 238, 255)");
      await expect(page.locator(`[data-bp-theme-logo="${mode}"]`)).toBeVisible();
      await expect(page.locator(`[data-bp-theme-logo="${mode === "light" ? "dark" : "light"}"]`)).toBeHidden();
      await page.locator(".bp-admin__route").hover();
      await expect(page.locator(".bp-admin__route")).toHaveCSS("background-color", mode === "light" ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)");
    };
    const refresh = async (mode: typeof config.mode) => {
      config.mode = mode;
      const previous = refreshes;
      await page.evaluate(() => document.body.dispatchEvent(new CustomEvent("bp:theme-changed", { bubbles: true })));
      await expect.poll(() => refreshes).toBe(previous + 2);
      await expect(page.locator("html")).toHaveAttribute("data-bp-theme-default", mode);
    };
    await page.goto("https://app.test/");
    await check("dark"); // Server fallback is light; configured system mode is dark.
    await refresh("light");
    await check("light");
    await refresh("dark");
    await check("dark");
    await refresh("system");
    await page.emulateMedia({ colorScheme: "light" });
    await check("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await check("dark");
    assert.equal(await page.evaluate(() => localStorage.getItem("bp.theme.mode:" + location.host)), null);
    await page.locator('[data-bp-theme-mode="light"]').click();
    await check("light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await check("light"); // Explicit choice ignores OS changes.
    await refresh("dark");
    await check("light"); // Saved light preference also overrides changed defaults.
    await page.locator('[data-bp-theme-mode="dark"]').click();
    await check("dark");
    config.mode = "light";
    await page.reload();
    await check("dark"); // Persisted preference survives a light server fallback.
    await page.locator('[data-bp-theme-mode="system"]').click();
    await page.emulateMedia({ colorScheme: "light" });
    await check("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await check("dark");
    assert.equal(refreshes, 8); // Only the four config changes fetched style/brand.
    await refresh("light");
    await check("dark"); // Saved system mode still follows the dark OS preference.
    await expect(page.locator('[data-bp-theme-mode="system"]')).toHaveAttribute("aria-pressed", "true");
    config.dark.text = "#abcdef";
    await page.evaluate(() => document.body.dispatchEvent(new CustomEvent("bp:theme-changed", { bubbles: true })));
    await expect.poll(() => refreshes).toBe(12);
    await expect(page.locator("body")).toHaveCSS("color", "rgb(171, 205, 239)");
    await expect(page.locator('[data-bp-theme-logo="dark"]')).toBeVisible();
    assert.equal(refreshes, 12);
    // A newer session selection wins even if an older stored preference is readable.
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new Error("storage is read-only"); };
    });
    await page.locator('[data-bp-theme-mode="light"]').click();
    await refresh("dark");
    await check("light");
    // Without storage, an explicit selection must survive config refreshes too.
    await page.evaluate(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("storage unavailable"); } });
    });
    await page.locator('[data-bp-theme-mode="light"]').click();
    await refresh("dark");
    await check("light");
    assert.deepEqual(errors, []);
  });
}
