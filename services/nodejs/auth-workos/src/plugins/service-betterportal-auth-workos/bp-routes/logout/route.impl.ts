import * as av from "anyvali";
import type { Infer } from "anyvali";
import { createHandler, resolveAppAuthRedirect, type ApiAuthRequirement, type CacheHints } from "@betterportal/framework";

export const QuerySchema = av.object({
  next: av.optional(av.string()),
  redirect: av.optional(av.string())
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok"] as const),
  message: av.string(),
  nextUrl: av.string()
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "WorkOS Logout";
export const description = "Clear the stored WorkOS bearer token.";
export const role = "auth.logout";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => {
    const query = ctx.query as Infer<typeof QuerySchema>;
    const nextUrl = resolveAppAuthRedirect(ctx, "afterLogout", query.next ?? query.redirect);
    ctx.bpHeaders?.remove("Authorization");
    ctx.bpHeaders?.remove("X-BP-Refresh");
    ctx.responseHeaders?.set("HX-Location", "/login?action=logout");
    if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
    return { status: "ok" as const, message: "Signed out.", nextUrl };
  }
);
