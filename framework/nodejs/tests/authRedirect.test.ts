import { test } from "node:test";
import assert from "node:assert/strict";
import type { RouteHandlerContext } from "../src/contracts/route.js";
import { resolveAppAuthRedirect } from "../src/runtime/auth/redirect.js";

test("app auth redirects resolve configured views and preserve explicit next paths", () => {
  const calls: Array<[string, string | undefined]> = [];
  const ctx = {
    app: {
      defaultRoute: "/fallback",
      auth: {
        redirects: {
          afterLogin: { serviceId: "019f114d-bdc9-7eca-a3de-470e7a45316f", viewId: "dashboard.index" }
        }
      }
    },
    route: (input: { viewId?: string; serviceId?: string }) => {
      calls.push([input.viewId!, input.serviceId]);
      return { uiPath: "/dashboard" };
    }
  } as unknown as Pick<RouteHandlerContext, "app" | "route">;

  assert.equal(resolveAppAuthRedirect(ctx, "afterLogin"), "/dashboard");
  assert.deepEqual(calls, [["dashboard.index", "019f114d-bdc9-7eca-a3de-470e7a45316f"]]);
  assert.equal(resolveAppAuthRedirect(ctx, "afterLogin", "reports"), "/reports");
  assert.equal(resolveAppAuthRedirect(ctx, "afterLogout"), "/fallback");
});

test("untrusted login destinations cannot leave the app origin", () => {
  const ctx = { app: { defaultRoute: "/dashboard" } } as Pick<RouteHandlerContext, "app" | "route">;
  for (const requested of [
    "https://attacker.example/collect", "http://attacker.example/collect",
    "//attacker.example/collect", "/\\attacker.example/collect",
    "\\\\attacker.example/collect", "javascript:alert(1)",
    "data:text/html,attacker", "\n//attacker.example"
  ]) {
    assert.equal(resolveAppAuthRedirect(ctx, "afterLogin", requested), "/dashboard", requested);
  }
  assert.equal(resolveAppAuthRedirect(ctx, "afterLogin", "/reports?filter=open#today"), "/reports?filter=open#today");
});
