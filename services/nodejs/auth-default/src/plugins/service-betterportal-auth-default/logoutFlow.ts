import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import { createHandler } from "./.bp-generated/route-runtime.js";
import type { AuthRuntime } from "./index.js";

export const QuerySchema = av.object({});
export const HeadersSchema = av.object({ "x-bp-refresh": av.optional(av.string()) });
export const RequestSchema = av.object({});

export const ResponseSchema = av.object({
  status: av.enum_(["ok"] as const).describe("Logout request outcome."),
  message: av.string().describe("Human-readable logout status for the renderer.")
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Logout";
export const description = "Clear the authentication token from the client.";
export const role = "auth.logout";
export const dependencies = [{ operationId: "auth.logout", method: "POST" }] as const;

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

export const handlePost = createHandler(
  { response: ResponseSchema, headers: HeadersSchema },
  async (ctx) => {
    await revokePresentedRefreshToken(ctx.plugin.runtime, ctx.headers["x-bp-refresh"], ctx.tenant.id, ctx.app.id);
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

export async function revokePresentedRefreshToken(runtime: AuthRuntime, token: string | undefined, tenantId: string, appId: string): Promise<void> {
  if (!token) return;
  let claims;
  try { claims = await runtime.tokenIssuer.verifyRefreshToken({ refreshToken: token, tenantId, appId }); }
  catch { return; } // Logout still clears invalid or expired credentials.
  runtime.userStore.revokeRefreshToken(claims.jti, claims.exp);
}
