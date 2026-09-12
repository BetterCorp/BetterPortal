export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema, type JsonObject } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { socialConnections } from "../../../../social.js";
import { AuthError } from "../../../../identity.js";
export const operationId = "auth.social.view";
export const auth = { required: false, permissions: [] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const dependencies = [{ operationId: "auth.social", method: "POST" }, { operationId: "auth.account", method: "POST" }] as const;
export const QuerySchema = av.object({ code: av.optional(av.string()), state: av.optional(av.string()), error: av.optional(av.string()) });
export const ResponseSchema = JsonObjectSchema;
export default createHandler({ response: ResponseSchema, query: QuerySchema }, (ctx): JsonObject => {
  ctx.responseHeaders?.set("Cache-Control", "no-store"); ctx.responseHeaders?.set("Referrer-Policy", "no-referrer");
  try {
    return { status: "ok", endpoint: ctx.routeUrl?.("social.index", { absolute: true }) ?? "/social", signedIn: !!ctx.user, code: String(ctx.query.code ?? ""), state: String(ctx.query.state ?? ""), error: String(ctx.query.error ?? ""), connections: socialConnections(ctx.plugin.runtime, { tenantId: ctx.tenant.id, appId: ctx.app.id }).map(c => ({ id: c.id, title: c.kind })) };
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    ctx.setStatus?.(error.status);
    return { status: "error", message: error.message, connections: [] };
  }
});
