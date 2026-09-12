export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import type { User } from "../../../../identity.js";
export const operationId = "auth.users.view";
export const auth = { required: true, permissions: [{ serviceId: "org.betterportal.auth.default", viewId: "users.index", permissions: ["read" as const] }] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const dependencies = [{ operationId: "auth.users.manage", method: "POST" }] as const;
export const ResponseSchema = JsonObjectSchema;
export const QuerySchema = av.object({ after: av.optional(av.string()), mailAfter: av.optional(av.string()) });
export default createHandler({ response: ResponseSchema, query: QuerySchema }, async ctx => {
  const runtime = ctx.plugin.runtime; const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id }; const policy = await runtime.policy(scope);
  const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" };
  ctx.responseHeaders?.set("Cache-Control", "no-store");
  return runtime.identity.storage.transaction(scope, async tx => {
    const query = ctx.query as av.Infer<typeof QuerySchema> | undefined;
    const mailPage = await tx.failedMail(scope, { after: query?.mailAfter, limit: 101 });
    const page = await tx.page<User>("user", dir, { after: query?.after, limit: 101 });
    const users = page.slice(0, 100);
    const groups = await tx.list("group", dir);
    return {
    nextUrl: page.length > 100 ? ctx.routeUrl?.("users.index", { absolute: true, query: { after: users.at(-1)!.id, ...(query?.mailAfter ? { mailAfter: query.mailAfter } : {}) } }) ?? "" : "",
    mailNextUrl: mailPage.length > 100 ? ctx.routeUrl?.("users.index", { absolute: true, query: { mailAfter: mailPage[99].id, ...(query?.after ? { after: query.after } : {}) } }) ?? "" : "",
    status: "ok", endpoint: ctx.routeUrl?.("users.index", { absolute: true }) ?? "/users", isolation: policy.isolation, mode: runtime.identity.storage.mode, roleIds: policy.allowedRoleIds, canManageDirectory: policy.isolation === "app" || policy.canManageDirectory === true,
    users: await Promise.all(users.map(async u => {
      const roles = (await tx.get("roles", u.id, scope))?.roles as string[] ?? [];
      const groupRoles = groups.filter(g => (g.members as string[]).includes(u.id)).flatMap(g => (g.appRoles as Record<string, string[]>)[scope.appId] ?? []);
      return { id: u.id, username: u.username, email: u.email ?? "", name: u.name ?? "", enabled: u.enabled, emailVerified: u.emailVerified, roles, effectiveRoles: [...new Set([...roles, ...groupRoles])].filter(id => policy.allowedRoleIds.includes(id) || id === "*") };
    })),
    invitations: (await tx.list("challenge", scope)).filter(c => c.purpose === "invite" && Number(c.expiresAt) > Date.now()).map(c => ({ id: c.id, email: String((c.data as Record<string, unknown>).email), expiresAt: Number(c.expiresAt) })),
    groups: groups.map(g => ({ id: g.id, name: String(g.name), members: g.members as string[], roles: (g.appRoles as Record<string, string[]>)[scope.appId] ?? [] })),
    mail: mailPage.slice(0, 100).map(m => ({ id: m.id, state: String(m.state), attempts: Number(m.attempts) })),
    audit: (await tx.page("audit", scope, { limit: 100, descending: true })).map(a => ({ id: a.id, actor: String(a.actor), event: String(a.event), at: Number(a.at) }))
  };
  });
});
