import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { toHtmlString } from "@betterportal/framework";
import { ResponseSchema } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/GET.js";
import { render } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_renderer.bootstrap5/GET.js";

test("visual route options contain only GET pages before and after live manifest loading; actions stay in the API section", async t => {
  const serviceId = "01a1a70a-3318-77a9-a572-1e86ac72bc12";
  const operations = [
    { operationId: "frame.kiosks.read", viewId: "frame.kiosks", method: "GET", path: "/kiosks", renderable: true, modes: ["page"] },
    { operationId: "frame.kiosks.pair.post", viewId: "frame.kiosks.pair", method: "POST", path: "/kiosks/pair", renderable: true, modes: ["page"] },
    { operationId: "frame.kiosks.update", viewId: "frame.kiosks.detail", method: "PUT", path: "/kiosks/:id", renderable: true, modes: ["page"] },
    { operationId: "frame.stats.read", viewId: "frame.stats", method: "GET", path: "/stats", renderable: true, modes: ["fragment"] },
    { operationId: "frame.data.read", viewId: "frame.data", method: "GET", path: "/data", renderable: false, modes: [] },
    { operationId: "frame.download.read", viewId: "frame.download", method: "GET", path: "/download", renderable: false, modes: ["page"], raw: true }
  ];
  const data = ResponseSchema.parse({
    title: "Route Designer", selectedAppId: "app", apps: [{ id: "app", title: "App", tenantId: "tenant" }],
    routes: operations.slice(1).map(operation => ({ id: operation.operationId, kind: "api", path: `/_bp/service/frame${operation.path}`,
      serviceId, viewId: operation.viewId, operations: [operation.operationId], methods: [operation.method],
      targetPath: operation.path, renderable: false, enabled: true })),
    availableServices: [{ id: serviceId, title: "BetterFrame", hostname: "https://frame.test", manifestLoaded: true,
      views: operations.map(operation => ({ ...operation, title: operation.operationId, description: "", pathVariants: [],
        renderable: operation.renderable && operation.modes.includes("page") })) }],
    adminApiBase: "/.well-known/bp/admin", serviceBaseUrl: "https://config.test"
  });
  const html = toHtmlString(render(data));
  const formMarkup = html.slice(html.indexOf('id="bp-add-route-form"'), html.indexOf("</form>", html.indexOf('id="bp-add-route-form"')));
  assert.match(formMarkup, /value="frame.kiosks.read"/);
  assert.doesNotMatch(formMarkup, /value="frame.kiosks.pair.post"|value="frame.kiosks.update"|value="frame.stats.read"|value="frame.data.read"|value="frame.download.read"/);

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let releaseManifest!: () => void;
  const manifestReady = new Promise<void>(resolve => { releaseManifest = resolve; });
  await page.route("https://frame.test/.well-known/bp/manifest", async route => {
    await manifestReady;
    await route.fulfill({ headers: { "access-control-allow-origin": "https://config.test" }, json: {
      pluginId: "cloud.betterportal.frame", title: "BetterFrame", views: operations.map(operation => ({
        viewId: operation.viewId, path: operation.path, operations: [{ ...operation, title: `${operation.operationId} live`,
          html: { renderers: operation.modes.length ? { bootstrap5: { renderModes: operation.modes } } : {} } }]
      }))
    } });
  });
  await page.route("https://config.test/routes", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><main id="bp-main">${html}</main>` }));
  await page.goto("https://config.test/routes");
  await page.locator("#bp-add-route-service").selectOption(serviceId);
  const picker = page.locator("#bp-add-route-view");
  assert.deepEqual(await picker.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)), ["", "frame.kiosks.read"]);
  releaseManifest();
  await picker.locator('option[value="frame.kiosks.read"]').filter({ hasText: "live" }).waitFor({ state: "attached" });
  assert.deepEqual(await picker.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)), ["", "frame.kiosks.read"]);
  await picker.selectOption("frame.kiosks.read");
  assert.equal(await page.locator('#bp-add-route-form input[name="viewId"]').inputValue(), "frame.kiosks");
  assert.equal(await page.locator('#bp-add-route-form select[name="servicePathVariant"]').inputValue(), "/kiosks");
  for (const operation of operations.slice(1)) {
    assert.equal(await page.locator(`#bp-api-routes-accordion tr[data-bp-route-id="${operation.operationId}"]`).count(), 1);
    assert.equal(await page.locator(`[id="bp-edit-route-panel-${operation.operationId}"]`).count(), 0);
  }
  assert.deepEqual(errors, []);
});
