import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";

export const QuerySchema = av.object({}, { unknownKeys: "strip" });
export const HeadersSchema = av.object({}, { unknownKeys: "strip" });
export const RequestSchema = av.object({}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok"] as const).describe("Logout request outcome."),
  message: av.string().describe("Human-readable logout status for the renderer.")
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Logout";
export const description = "Clear the authentication token from the client.";
export const role = "auth.logout";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

export const handlePost = createHandler(
  { response: ResponseSchema },
  (ctx) => {
    // Always emit BP-RemoveHeader so the client shim drops the stored token -
    // logout must clear state even when called with a dead or missing token.
    ctx.bpHeaders?.remove("Authorization");
    ctx.bpHeaders?.remove("X-BP-Refresh");
    ctx.responseHeaders?.set(
      "HX-Location",
      ctx.routeUrl?.("login.index", { query: { action: "logout" } }) ?? "/login?action=logout"
    );
    // Auth state changed - reload this service's fragments (nav profile etc.).
    if (ctx.serviceId) {
      ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
    }
    return {
      status: "ok" as const,
      message: "Client should clear stored Authorization header."
    };
  }
);

export const handleGet = handlePost;
