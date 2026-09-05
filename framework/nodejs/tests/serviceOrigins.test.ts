import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppServiceOrigins } from "../src/runtime/configProvider.js";

test("app credential destinations include enabled fragments and slots but exclude unbound services", () => {
  const context = {
    app: {
      routes: [{ serviceId: "route", enabled: true }, { serviceId: "disabled-route", enabled: false }],
      slots: [{ serviceId: "slot", enabled: true }, { serviceId: "disabled-slot", enabled: false }],
      fragments: { header: [{ serviceId: "fragment", enabled: true }, { serviceId: "disabled-fragment", enabled: false }, { serviceId: "disabled-service", enabled: true }] },
      shell: { serviceId: "shell" }, auth: { serviceId: "auth" },
      shellFragments: { shell: { header: { mode: "items", items: [{ source: "service", serviceId: "override" }] } }, other: { header: { mode: "override", item: { source: "service", serviceId: "other-shell" } } } }
    },
    tenant: {
      services: ["route", "slot", "fragment", "shell", "auth", "override", "disabled-route", "disabled-slot", "disabled-fragment", "disabled-service", "unbound", "other-shell"].map(id => ({ id, enabled: id !== "disabled-service", hostname: `https://${id}.test/path` })),
      activatedPlatformServices: []
    }
  };
  assert.deepEqual(resolveAppServiceOrigins({ platformServices: [] } as never, context as never),
    Object.fromEntries(["route", "slot", "fragment", "shell", "auth", "override"].map(id => [id, `https://${id}.test`])));
});
