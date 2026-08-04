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
    uiRouteUrl: (viewId: string, options?: { serviceId?: string }) => {
      calls.push([viewId, options?.serviceId]);
      return "/dashboard";
    }
  } as unknown as Pick<RouteHandlerContext, "app" | "uiRouteUrl">;

  assert.equal(resolveAppAuthRedirect(ctx, "afterLogin"), "/dashboard");
  assert.deepEqual(calls, [["dashboard.index", "019f114d-bdc9-7eca-a3de-470e7a45316f"]]);
  assert.equal(resolveAppAuthRedirect(ctx, "afterLogin", "reports"), "/reports");
  assert.equal(resolveAppAuthRedirect(ctx, "afterLogout"), "/fallback");
});
