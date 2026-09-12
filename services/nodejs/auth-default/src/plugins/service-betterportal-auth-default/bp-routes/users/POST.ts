export { title, description } from "./index.js";
import * as av from "anyvali";
import { JsonObjectSchema, uuidv7 } from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { accountLink } from "../../../../account.js";
import { AuthError, isValidEmail, type User } from "../../../../identity.js";
export const operationId = "auth.users.manage";
export const auth = { required: true, elevation: { minimum: "mfa" as const }, permissions: [{ serviceId: "org.betterportal.auth.default", viewId: "users.index", permissions: ["update" as const] }] };
export const cacheHints = { ttlSeconds: 0, varyBy: [] };
export const RequestSchema = av.object({ action: av.string(), id: av.optional(av.string()), email: av.optional(av.string()), name: av.optional(av.string()), enabled: av.optional(av.bool()), roles: av.optional(av.array(av.string())), members: av.optional(av.array(av.string())) });
export const ResponseSchema = JsonObjectSchema;
export default createHandler({ response: ResponseSchema, request: RequestSchema }, async ctx => {
  const runtime = ctx.plugin.runtime; const identity = runtime.identity; const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id }; const policy = await runtime.policy(scope);
  const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" }; const body = ctx.request as av.Infer<typeof RequestSchema>;
  try {
    if (policy.isolation === "tenant" && !policy.canManageDirectory && ["disable", "sessions.revoke", "group.save", "group.delete"].includes(body.action)) throw new AuthError("Use the tenant's designated directory administration app to manage shared accounts and groups.", 403);
    const roles = [...new Set(body.roles ?? [])];
    if (roles.some(id => id === "*" || !policy.allowedRoleIds.includes(id))) throw new AuthError("Choose existing app roles. Root cannot be provisioned here.");
    await identity.storage.transaction(scope, async tx => {
      const actor = await tx.get<User>("user", ctx.user!.sub, dir);
      if (!actor?.enabled) throw new AuthError("Account unavailable.", 401);
      await identity.assertActiveSession(tx, scope, ctx.user!, actor);
      if (body.action === "invite") {
        if (policy.registration === "closed") throw new AuthError("Registration is closed.");
        const email = (body.email ?? "").trim().toLowerCase();
        if (!isValidEmail(email)) throw new AuthError("Enter a valid email.");
        const ticket = await identity.challengeInTransaction(tx, scope, "invite", { email, roles }, undefined, 86400);
        const link = accountLink(ctx, "invite.accept", ticket);
        if (!link) throw new AuthError("Mount the account page before inviting users.");
        await runtime.mail.enqueue(tx, scope, email, `Invitation to ${ctx.app.title}`, `Accept your invitation: ${link}\nThis invitation expires in 24 hours.`);
      } else if (body.action === "invite.revoke") {
        const challenge = await tx.get("challenge", body.id ?? "", scope);
        if (!challenge || challenge.purpose !== "invite") throw new AuthError("Invitation unavailable.", 404);
        await tx.remove("challenge", challenge.id, scope);
      } else if (body.action === "roles" || body.action === "disable" || body.action === "sessions.revoke") {
        const user = await tx.get<User>("user", body.id ?? "", dir);
        if (!user) throw new AuthError("User unavailable.", 404);
        const current = await tx.get("roles", user.id, scope);
        if (user.bootstrapAdmin || (current?.roles as string[] | undefined)?.includes("*")) throw new AuthError("The bootstrap administrator cannot be modified through this interface.", 403);
        if (body.action === "roles") await tx.put("roles", scope, { id: user.id, roles, initialized: true });
        else { if (body.action === "disable") user.enabled = body.enabled === true; user.refreshVersion++; await tx.put("user", dir, user); }
      } else if (body.action === "group.save") {
        const id = body.id || uuidv7();
        if (body.id && !await tx.get("group", id, dir)) throw new AuthError("Group unavailable.", 404);
        const members = [...new Set(body.members ?? [])];
        for (const member of members) if (!await tx.get("user", member, dir)) throw new AuthError("Group member belongs to a different directory.");
        const existing = await tx.get("group", id, dir);
        await tx.put("group", dir, { id, name: (body.name ?? "Group").slice(0, 200), members, appRoles: { ...(existing?.appRoles as object ?? {}), [scope.appId]: roles } });
      } else if (body.action === "group.roles") {
        const group = await tx.get("group", body.id ?? "", dir);
        if (!group) throw new AuthError("Group unavailable.", 404);
        await tx.put("group", dir, { ...group, appRoles: { ...(group.appRoles as object), [scope.appId]: roles } });
      } else if (body.action === "group.delete") {
        await tx.remove("group", body.id ?? "", dir);
      } else if (body.action === "mail.retry") {
        const mail = await tx.get("mail", body.id ?? "", scope);
        if (!mail || mail.state !== "failed") throw new AuthError("Failed delivery unavailable.");
        await tx.put("mail", scope, { ...mail, attempts: 0, nextAttempt: Date.now(), state: "pending" });
      } else throw new AuthError("Unknown admin action.");
      await identity.audit(tx, scope, ctx.user!.sub, `admin.${body.action}`, { id: body.id ?? "", roles });
    });
    return { status: "ok", message: "Saved." };
  } catch (error) { if (!(error instanceof AuthError)) throw error; ctx.setStatus?.(error.status); return { status: "error", message: error.message }; }
});
