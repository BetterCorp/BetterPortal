import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BetterPortalConfigSchema, toHtmlString, type ViewRenderContext } from "@betterportal/framework";
import { FileStorage } from "../src/plugins/service-betterportal-config-manager/storage/file.js";
import { setConfigManagerRouteContext } from "../src/plugins/service-betterportal-config-manager/routeContext.js";
import { handleGet as getTenants } from "../src/plugins/service-betterportal-config-manager/tenantManagement.js";
import { handleGet as getPreviews } from "../src/plugins/service-betterportal-config-manager/previewEnvironmentManagement.js";
import { render as tenants } from "../src/plugins/service-betterportal-config-manager/bp-routes/tenants/_renderer.bootstrap5/GET.js";
import { render as previews } from "../src/plugins/service-betterportal-config-manager/bp-routes/preview-environments/_renderer.bootstrap5/GET.js";

test("management APIs return domain models and views resolve their own action destinations", async t => {
  const directory = mkdtempSync(join(tmpdir(), "bp-action-destinations-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const storage = new FileStorage(join(directory, "config.json"));
  await storage.saveConfig(BetterPortalConfigSchema.parse({}));
  setConfigManagerRouteContext({ storage, cpState: {} as never, serviceBaseUrl: "https://config.test/prefix" });
  const request = { request: {}, query: {}, route: () => { throw new Error("API must not resolve view action URLs"); } };
  const tenantData = await getTenants(request as never);
  const previewData = await getPreviews(request as never);
  assert.equal("tenantsPath" in tenantData, false);
  assert.equal("previewPath" in previewData, false);
  const calls: Array<{ path: string; method: string }> = [];
  const ctx = { route: (input: { path: string; method?: string; query?: Record<string, string> }) => {
    calls.push({ path: input.path, method: input.method ?? "GET" });
    const url = new URL("https://config.test/prefix" + input.path);
    for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value);
    return { absoluteViewPath: url.toString() };
  } } as unknown as ViewRenderContext;
  const tenantHtml = toHtmlString(tenants(tenantData, ctx));
  const previewHtml = toHtmlString(previews(previewData, ctx));
  assert.match(tenantHtml, /hx-post="https:\/\/config.test\/prefix\/tenants"/);
  assert.match(tenantHtml, /hx-put="https:\/\/config.test\/prefix\/tenants"/);
  assert.match(previewHtml, /hx-post="https:\/\/config.test\/prefix\/preview-environments"/);
  assert.ok(calls.some(call => call.path === "/tenants" && call.method === "POST"));
  assert.ok(calls.some(call => call.path === "/preview-environments" && call.method === "POST"));
});
