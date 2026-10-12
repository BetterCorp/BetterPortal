import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { render } from "../src/plugins/service-betterportal-auth-authress-io/bp-routes/login/_renderer.bootstrap5/GET.js";

const apiDestination = "https://auth.service.test/_bp/service/authress/login?next=%2Freports";
const callbackDestination = "https://portal.test/account/sign-in?next=%2Freports";
const context = {
  request: { query: { next: "/reports" } }, app: { defaultRoute: "/home" },
  routeUrl: (options: { method?: string }) => ({ apiPath: "/login", viewPath: "/login", uiPath: "/account/sign-in",
    absoluteApiPath: apiDestination, absoluteViewPath: "https://auth.service.test/_bp/service/authress/login?next=%2Freports",
    absoluteUiPath: options.method === "GET" ? callbackDestination : null })
} as unknown as ViewRenderContext;

for (const sessionExists of [true, false]) {
  test(`login fragment on another page keeps its resolved ${sessionExists ? "token POST" : "provider callback"} destination`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.addInitScript(`
        window.__name = fn => fn;
        window.loginSubmissions = [];
        window.loginRedirects = [];
        HTMLFormElement.prototype.requestSubmit = function() {
          window.loginSubmissions.push({ url: this.getAttribute("hx-post"), accessToken: new FormData(this).get("accessToken") });
        };
        window.Authress = { LoginClient: class {
          async userSessionExists() { return ${sessionExists}; }
          async ensureToken() { return "test.access.token"; }
          async getUserIdentity() { return { sub: "user-1", name: "Test User" }; }
          async authenticate(options) { window.loginRedirects.push(options.redirectUrl); }
        } };
      `);
      await page.route("https://portal.test/**", route => route.fulfill({ contentType: "text/html", body: "<main>Unrelated page</main>" }));
      await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
      await page.goto("https://portal.test/batches/1?inspect=1");
      const html = toHtmlString(render({ status: "ok", loginUI: "default", scopes: ["openid"], authressApiUrl: "https://login.authress.test" }, context));
      await page.setContent(html);
      await page.waitForFunction(() => (window as any).loginSubmissions.length + (window as any).loginRedirects.length === 1);
      const result = await page.evaluate(() => ({ submissions: (window as any).loginSubmissions, redirects: (window as any).loginRedirects }));
      if (sessionExists) assert.deepEqual(result, { submissions: [{ url: apiDestination, accessToken: "test.access.token" }], redirects: [] });
      else assert.deepEqual(result, { submissions: [], redirects: [callbackDestination] });
      assert.equal(page.url(), "https://portal.test/batches/1?inspect=1");
    } finally { await browser.close(); }
  });
}
