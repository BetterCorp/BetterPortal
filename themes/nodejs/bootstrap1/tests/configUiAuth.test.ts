import assert from "node:assert/strict";
import { test } from "node:test";
import { Plugin as Bootstrap1Plugin } from "../src/plugins/service-betterportal-theme-bootstrap1/index.js";
import { Plugin as Bootstrap2Plugin } from "../../bootstrap2/src/plugins/service-betterportal-theme-bootstrap2/index.js";

for (const [name, plugin] of [["bootstrap1", Bootstrap1Plugin], ["bootstrap2", Bootstrap2Plugin]] as const) {
  test(`${name} legacy config UI cannot read or change theme settings anonymously`, async () => {
    let writes = 0;
    const context = Object.assign(Object.create(plugin.prototype) as object, {
      validateConfigTicket: async () => null,
      validateConfigScope: async () => true,
      computeEffectiveAndStored: async () => ({ eff: {}, storedKeys: new Set<string>(), valid: true }),
      renderConfigUiForm: () => "private theme settings",
      configStore: { write: () => { writes++; }, clearKey: () => { writes++; } }
    });
    const handlers = plugin.prototype as unknown as {
      handleConfigUi(event: never): Promise<Response>;
      handleConfigUiSave(event: never): Promise<Response>;
      handleConfigUiReset(event: never): Promise<Response>;
    };
    const get = await handlers.handleConfigUi.call(context as never, {
      req: new Request("https://theme.example/.well-known/bp/config/ui?tenantId=tenant-a&appId=app-a")
    } as never);
    assert.equal(get.status, 401);
    for (const [method, fields] of [
      ["handleConfigUiSave", { tenantId: "tenant-a", appId: "app-a", brandName: "Attacker" }],
      ["handleConfigUiReset", { tenantId: "tenant-a", appId: "app-a", key: "brandName" }]
    ] as const) {
      const response = await handlers[method].call(context as never, {
        req: new Request(`https://theme.example/.well-known/bp/config/ui/${method === "handleConfigUiSave" ? "save" : "reset"}`, {
          method: "POST", body: new URLSearchParams(fields)
        })
      } as never);
      assert.equal(response.status, 401);
    }
    assert.equal(writes, 0);
  });

  test(`${name} legacy config UI accepts only scoped tickets and bounded forms`, async () => {
    let writes = 0;
    const ticket = {
      tenantId: "tenant-a", serviceId: `org.betterportal.theme.${name}`,
      exp: Math.floor(Date.now() / 1000) + 60, actions: ["config.read", "config.write"]
    };
    const context = Object.assign(Object.create(plugin.prototype) as object, {
      validateConfigTicket: async (value: string | null) => value === "valid" ? ticket : null,
      validateConfigScope: async () => true,
      computeEffectiveAndStored: async () => ({ eff: {}, storedKeys: new Set<string>(), valid: true }),
      renderConfigUiForm: () => "private theme settings",
      configStore: { write: () => { writes++; }, clearKey: () => { writes++; } }
    });
    const handlers = plugin.prototype as unknown as {
      handleConfigUi(event: never): Promise<Response>;
      handleConfigUiSave(event: never): Promise<Response>;
      handleConfigUiReset(event: never): Promise<Response>;
    };
    const get = (tenantId: string) => handlers.handleConfigUi.call(context as never, {
      req: new Request(`https://theme.example/.well-known/bp/config/ui?tenantId=${tenantId}&appId=app-a`, {
        headers: { authorization: "Bearer valid" }
      })
    } as never);
    assert.equal((await get("tenant-a")).status, 200);
    assert.equal((await get("tenant-b")).status, 403);
    const post = (method: "handleConfigUiSave" | "handleConfigUiReset", tenantId: string, extra: Record<string, string> = {}) =>
      handlers[method].call(context as never, { req: new Request("https://theme.example/.well-known/bp/config/ui/save", {
        method: "POST", headers: { authorization: "Bearer valid" },
        body: new URLSearchParams({ tenantId, appId: "app-a", key: "brandName", brandName: "Good", ...extra })
      }) } as never);
    assert.equal((await post("handleConfigUiSave", "tenant-a")).status, 200);
    assert.equal(writes, 1);
    assert.equal((await post("handleConfigUiReset", "tenant-b")).status, 403);
    assert.equal(writes, 1);
    assert.equal((await post("handleConfigUiSave", "tenant-a", { padding: "x".repeat(2 * 1024 * 1024) })).status, 413);
    assert.equal(writes, 1);
  });
}
