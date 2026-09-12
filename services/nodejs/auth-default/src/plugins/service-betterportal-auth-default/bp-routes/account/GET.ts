export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema, type JsonObject } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { accountGet } from "../../../../account.js";
import { AuthError } from "../../../../identity.js";
export const operationId = "auth.account.view";
export const role = "auth.account";
export const auth = { required: false, permissions: [] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const dependencies = [{ operationId: "auth.account", method: "POST" }] as const;
export const QuerySchema = av.object({ action: av.optional(av.string()), id: av.optional(av.string()), secret: av.optional(av.string()) });
export const ResponseSchema = JsonObjectSchema;
export default createHandler({ response: ResponseSchema, query: QuerySchema }, async (ctx): Promise<JsonObject> => {
  try { return { ...await accountGet(ctx), action: String(ctx.query.action ?? ""), id: String(ctx.query.id ?? ""), secret: String(ctx.query.secret ?? "") }; }
  catch (error) { if (!(error instanceof AuthError)) throw error; ctx.setStatus?.(error.status); return { status: "error", message: error.message }; }
});
