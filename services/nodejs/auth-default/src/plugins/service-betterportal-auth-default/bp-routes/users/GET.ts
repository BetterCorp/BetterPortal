export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema, type JsonObject } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import type { Mail } from "../../../../mail.js";
import type { User } from "../../../../identity.js";
export const operationId = "auth.users.view";
export const auth = { required: true, permissions: [{ serviceId: "org.betterportal.auth.default", viewId: "users.index", permissions: ["read" as const] }] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const dependencies = [{ operationId: "auth.users.manage", method: "POST" }] as const;
export const ResponseSchema = JsonObjectSchema;
export const QuerySchema = av.object({ after: av.optional(av.string()), mailAfter: av.optional(av.string()), mailState: av.optional(av.enum_(["all", "failed"])) });
export default createHandler({ response: ResponseSchema, query: QuerySchema }, async ctx => {
  const runtime = ctx.plugin.runtime; const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id }; const policy = await runtime.policy(scope);
  const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" };
  ctx.responseHeaders?.set("Cache-Control", "no-store");
  return runtime.identity.storage.transaction(scope, async tx => {
    const query = ctx.query as av.Infer<typeof QuerySchema> | undefined;
    const mailPage = query?.mailState === "failed"
      ? await tx.failedMail<Mail>(scope, { after: query.mailAfter, limit: 101 })
      : await tx.page<Mail>("mail", scope, { after: query?.mailAfter, limit: 101, descending: true });
    const auditPage = await tx.page("audit", scope, { limit: 100, descending: true });
    const people = new Map<string, Promise<{ id: string; username: string; email: string | null; name: string | null } | null>>();
    const person = (id: string) => {
      let lookup = people.get(id);
      if (!lookup) {
        lookup = tx.get<User>("user", id, dir).then(user => user ? { id: user.id, username: user.username, email: user.email ?? null, name: user.name ?? null } : null);
        people.set(id, lookup);
      }
      return lookup;
    };
    const page = await tx.page<User>("user", dir, { after: query?.after, limit: 101 });
    const users = page.slice(0, 100);
    const groups = await tx.list("group", dir);
    return {
    nextCursor: page.length > 100 ? users.at(-1)!.id : "",
    mailNextCursor: mailPage.length > 100 ? mailPage[99].id : "",
    status: "ok", mailState: query?.mailState ?? "all", registration: policy.registration, isolation: policy.isolation, mode: runtime.identity.storage.mode, roleIds: policy.allowedRoleIds, canManageDirectory: policy.isolation === "app" || policy.canManageDirectory === true,
    users: await Promise.all(users.map(async u => {
      const roles = (await tx.get("roles", u.id, scope))?.roles as string[] ?? [];
      const groupRoles = groups.filter(g => (g.members as string[]).includes(u.id)).flatMap(g => (g.appRoles as Record<string, string[]>)[scope.appId] ?? []);
      return { protected: u.bootstrapAdmin === true || roles.includes("*"), id: u.id, username: u.username, email: u.email ?? "", name: u.name ?? "", enabled: u.enabled, emailVerified: u.emailVerified, roles, effectiveRoles: [...new Set([...roles, ...groupRoles])].filter(id => policy.allowedRoleIds.includes(id) || id === "*") };
    })),
    invitations: (await tx.list("challenge", scope)).filter(c => c.purpose === "invite" && Number(c.expiresAt) > Date.now()).map(c => ({ id: c.id, email: String((c.data as Record<string, unknown>).email), expiresAt: Number(c.expiresAt) })),
    groups: groups.map(g => ({ id: g.id, name: String(g.name), members: g.members as string[], roles: (g.appRoles as Record<string, string[]>)[scope.appId] ?? [] })),
    mail: mailPage.slice(0, 100).map(m => {
      let to: string | null = null, subject: string | null = null;
      try {
        const envelope = JSON.parse(runtime.identity.cipher.decrypt(m.envelope || m.encrypted));
        to = typeof envelope.to === "string" ? envelope.to : null;
        subject = typeof envelope.subject === "string" ? envelope.subject : null;
      } catch { /* Older sent messages have no retained envelope. */ }
      return { id: m.id, state: m.state, attempts: Number(m.attempts ?? 0), to, subject, createdAt: m.createdAt ?? null,
        updatedAt: m.updatedAt ?? null, nextAttempt: m.state === "pending" || m.state === "sending" ? m.nextAttempt ?? null : null,
        lastDelivery: m.lastDelivery ?? null };
    }),
    audit: await Promise.all(auditPage.map(async a => {
      const event = String(a.event), actor = String(a.actor), data = (a.data ?? {}) as JsonObject;
      const targetId = ["admin.roles", "admin.disable", "admin.sessions.revoke", "admin.verification.link", "admin.verification.mark"].includes(event) ? String(data.id ?? "") : "";
      return { id: a.id, actor, actorUser: await person(actor), targetUser: targetId ? await person(targetId) : null, event, at: Number(a.at), data };
    }))
  };
  });
});
