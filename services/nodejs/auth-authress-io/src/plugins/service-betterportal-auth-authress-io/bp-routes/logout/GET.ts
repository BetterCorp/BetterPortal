export const operationId = "auth.logout";
import * as av from "anyvali";
import type { Infer } from "anyvali";
import { createHandler, type ApiAuthRequirement, type CacheHints } from "@betterportal/framework";

export const QuerySchema = av.object({
  next: av.optional(av.string()),
  redirect: av.optional(av.string())
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok"] as const),
  message: av.string()
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Authress Logout";
export const description = "Clear the stored Authress bearer token.";
export const role = "auth.logout";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

export default createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => {
    const query = ctx.query as Infer<typeof QuerySchema>;
    ctx.bpHeaders?.remove("Authorization");
    ctx.bpHeaders?.remove("X-BP-Refresh");
    const login = ctx.route?.({ path: "/login", query: { action: "logout", next: query.next ?? query.redirect } });
    if (login?.uiPath) ctx.responseHeaders?.set("HX-Location", login.uiPath);
    if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
    return { status: "ok" as const, message: "Signed out." };
  }
);
