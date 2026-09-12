export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { accountPost } from "../../../../account.js";
import { AuthError } from "../../../../identity.js";
export const operationId = "auth.account";
export const auth = { required: false, permissions: [] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const RequestSchema = av.object({
  action: av.string().minLength(1), id: av.optional(av.string()), secret: av.optional(av.string()), email: av.optional(av.string()),
  name: av.optional(av.string()), password: av.optional(av.string()), currentPassword: av.optional(av.string()), next: av.optional(av.string()),
  method: av.optional(av.string()), code: av.optional(av.string()), credential: av.optional(JsonObjectSchema)
});
export const ResponseSchema = JsonObjectSchema;
export default createHandler({ response: ResponseSchema, request: RequestSchema }, async ctx => {
  try { return await accountPost(ctx); }
  catch (error) { if (!(error instanceof AuthError)) throw error; ctx.setStatus?.(error.status); return { status: "error", message: error.message }; }
});
