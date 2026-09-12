export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema, type JsonObject } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { socialPost } from "../../../../social.js";
import { AuthError } from "../../../../identity.js";
export const operationId = "auth.social";
export const auth = { required: false, permissions: [] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const RequestSchema = av.object({ action: av.string(), connection: av.optional(av.string()), id: av.optional(av.string()), secret: av.optional(av.string()), code: av.optional(av.string()) });
export const ResponseSchema = JsonObjectSchema;
export default createHandler({ response: ResponseSchema, request: RequestSchema }, async (ctx): Promise<JsonObject> => {
  try { return await socialPost(ctx); } catch (error) { if (!(error instanceof AuthError)) throw error; ctx.setStatus?.(error.status); return { status: "error", message: error.message }; }
});
