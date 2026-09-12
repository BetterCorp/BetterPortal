import { requireElevation, resolveAppAuthRedirect, type RouteHandlerContext, type JsonObject } from "@betterportal/framework";
import { AuthError, hashPassword, verifyPassword, isValidEmail, type User, type Session } from "./identity.js";
import type { AuthRuntime } from "./plugins/service-betterportal-auth-default/index.js";
import type { AuthTransaction } from "./storage.js";

type Context = RouteHandlerContext & { plugin: { runtime: AuthRuntime } };
export function publishSession(ctx: Context, issued: Awaited<ReturnType<AuthRuntime["identity"]["issueSession"]>>): void {
  ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, { expiresInSeconds: issued.accessTokenExpiresInSeconds, locked: true, refreshPath: "/refresh", refreshBeforeSeconds: 60 });
  ctx.bpHeaders?.set("X-BP-Refresh", issued.refreshToken!, { expiresInSeconds: issued.refreshTokenExpiresInSeconds!, locked: true, scopeToOwner: true });
  if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
}
export function accountLink(ctx: Context, action: string, ticket: { id: string; secret: string }): string | null {
  const url = ctx.uiRouteUrl?.("account.index", { absolute: true });
  return url ? `${url}#bp-auth=${encodeURIComponent(JSON.stringify({ action, ...ticket }))}` : null;
}
const publicUser = (u: User) => ({ id: u.id, username: u.username, email: u.email ?? "", name: u.name ?? "", enabled: u.enabled, emailVerified: u.emailVerified, totp: !!u.totp });
export async function accountGet(ctx: Context): Promise<JsonObject> {
  const runtime = ctx.plugin.runtime;
  const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id };
  const policy = await runtime.policy(scope);
  ctx.responseHeaders?.set("Cache-Control", "no-store"); ctx.responseHeaders?.set("Referrer-Policy", "no-referrer");
  const accountUrl = ctx.routeUrl?.("account.index", { absolute: true }) ?? "/account";
  if (!ctx.user) return { status: "ok", accountUrl, registration: policy.registration, signedIn: false };
  const user = await runtime.identity.findUser(scope, policy, ctx.user.sub, true);
  if (!user?.enabled) throw new AuthError("Sign in again.", 401);
  const sessionPage = await runtime.identity.storage.transaction(scope, async tx => {
    const now = Date.now();
    await tx.pruneSessions(scope, now);
    return tx.activeSessions<Session>(scope, user.id, now, { after: typeof ctx.query?.sessionAfter === "string" ? ctx.query.sessionAfter : undefined, limit: 101 });
  });
  const sessions = sessionPage.slice(0, 100).map(s => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt }));
  const sessionNextUrl = sessionPage.length > 100 ? ctx.routeUrl?.("account.index", { absolute: true, query: { sessionAfter: sessions.at(-1)!.id } }) ?? "" : "";
  const passkeys = await runtime.identity.storage.transaction(scope, async tx => (await tx.list("passkey", user)).filter(p => p.userId === user.id).map(p => ({ id: p.id, name: String(p.name), rpId: String(p.rpId) })));
  const linkedIdentities = await runtime.identity.storage.transaction(scope, async tx => (await tx.list("external", user)).filter(p => p.userId === user.id).map(p => ({ id: p.id, provider: String(p.provider) })));
  return { status: "ok", passkeys, linkedIdentities, accountUrl, socialUrl: ctx.routeUrl?.("social.index", { absolute: true }) ?? "/social", registration: policy.registration, signedIn: true, user: publicUser(user), sessions, sessionNextUrl };
}
export async function accountPost(ctx: Context): Promise<JsonObject> {
  const runtime = ctx.plugin.runtime; const identity = runtime.identity;
  const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id }; const policy = await runtime.policy(scope);
  const body = ctx.request as Record<string, any>; const action = String(body.action);
  const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" };
  const event = ctx.rawEvent as { req: Request; url: URL };
  const origin = event.req.headers.get("origin") ?? event.url.origin;
  const accountUrl = ctx.routeUrl?.("account.index", { absolute: true }) ?? "/account";
  ctx.responseHeaders?.set("Cache-Control", "no-store"); ctx.responseHeaders?.set("Referrer-Policy", "no-referrer");
  const sendLink = async (user: User, purpose: string) => identity.storage.transaction(scope, async tx => {
    const ticket = await identity.challengeInTransaction(tx, scope, purpose, { version: user.refreshVersion }, user.id, 1800);
    const link = accountLink(ctx, purpose, ticket);
    if (!link) throw new AuthError("Mount the account page in this app before enabling email delivery.", 503);
    await runtime.mail.enqueue(tx, scope, user.email!, "BetterPortal account verification", `Open this link to ${purpose === "reset" ? "reset your password" : "verify your email"}: ${link}\nThis link expires in 30 minutes. If you did not request it, ignore this email.`);
  });
  if (["signup", "request-reset", "resend"].includes(action)) {
    const email = String(body.email ?? "").trim().toLowerCase();
    await identity.rateLimit(scope, action, email, 5, 900);
    await identity.rateLimit(scope, "mail-volume", "app", 100, 900);
    if (action === "signup") {
      if (policy.registration !== "public") throw new AuthError("Public registration is closed.", 403);
      if (!email) throw new AuthError("Email required.");
      // The user and email job commit together; a delivery configuration failure leaves no stranded account.
      const passwordHash = await hashPassword(String(body.password ?? ""));
      try { await identity.storage.transaction(scope, async tx => {
        const created = await identity.createInTransaction(tx, scope, policy, { username: email, email, name: body.name }, passwordHash);
        const ticket = await identity.challengeInTransaction(tx, scope, "verify", { version: created.refreshVersion }, created.id, 1800);
        const link = accountLink(ctx, "verify", ticket);
        if (!link) throw new AuthError("Mount the account page in this app before enabling registration.", 503);
        await runtime.mail.enqueue(tx, scope, email, "Verify your email", `Verify your email address: ${link}\nThis link expires in 30 minutes.`);
      }); } catch (error) { if (!(error instanceof AuthError && error.status === 409 && error.message === "This account cannot be registered.")) throw error; }
    } else {
      const user = await identity.findUser(scope, policy, email);
      if (user?.enabled && user.email && (action !== "resend" || !user.emailVerified)) await sendLink(user, action === "resend" ? "verify" : "reset");
    }
    return { status: "ok", message: "If the account is eligible, an email will arrive shortly.", accountUrl };
  }
  if (action === "verify" || action === "reset" || action === "email.verify") {
    const passwordHash = action === "reset" ? await hashPassword(String(body.password ?? "")) : undefined;
    await identity.consume(scope, action, String(body.id), String(body.secret), async (challenge, tx) => {
      const user = await tx.get<User>("user", challenge.userId ?? "", dir);
      if (!user?.enabled || challenge.data.version !== user.refreshVersion) throw new AuthError("Verification unavailable.");
      if (action === "reset") {
        user.passwordHash = passwordHash; user.emailVerified = true; user.refreshVersion++;
        if (user.email) await runtime.mail.enqueue(tx, scope, user.email, "Password reset completed", "Your password was reset and existing sessions were revoked. If this was not you, contact your administrator immediately.");
      }
      else if (action === "email.verify") {
        const email = String(challenge.data.email);
        if (await tx.get("identifier", email, dir)) throw new AuthError("Email unavailable.");
        if (user.email) {
          await tx.remove("identifier", user.email, dir);
          if (user.username === user.email) user.username = email;
        }
        user.email = email; user.emailVerified = true; user.refreshVersion++;
        await tx.put("identifier", dir, { id: email, userId: user.id });
      } else user.emailVerified = true;
      await tx.put("user", dir, user); await identity.audit(tx, scope, user.id, `account.${action}`);
    });
    return { status: "ok", message: action === "reset" ? "Password reset. Sign in with your new password and authentication factor." : "Email verified. You can sign in.", accountUrl };
  }
  if (action === "invite.accept") {
    if (policy.registration === "closed") throw new AuthError("Registration is closed.", 403);
    const passwordHash = body.password ? await hashPassword(String(body.password)) : undefined;
    await identity.consume(scope, "invite", String(body.id), String(body.secret), async (challenge, tx) => {
      const email = String(challenge.data.email); const roles = challenge.data.roles as string[];
      if (roles.some(id => id === "*" || !policy.allowedRoleIds.includes(id))) throw new AuthError("Invitation roles are no longer available.");
      const index = await tx.get("identifier", email, dir);
      if (index) {
        const user = await tx.get<User>("user", String(index.userId), dir);
        if (!ctx.user || ctx.user.sub !== user?.id || !user.enabled || user.email !== email) throw new AuthError("Sign in to the existing account before accepting this invitation.", 409);
        await identity.assertActiveSession(tx, scope, ctx.user, user);
        const existing = await tx.get("roles", user.id, scope);
        await tx.put("roles", scope, { id: user.id, roles: [...new Set([...(existing?.roles as string[] ?? []), ...roles])], initialized: true });
        await identity.audit(tx, scope, user.id, "invitation.accepted");
        return;
      }
      if (!passwordHash) throw new AuthError("Choose a password for your new account.");
      await identity.createInTransaction(tx, scope, policy, { username: email, email, name: body.name, verified: true }, passwordHash, roles);
    });
    return { status: "ok", message: "Invitation accepted. Sign in to continue.", accountUrl };
  }
  if (action === "login.complete") {
    const result = await identity.consume(scope, "login", String(body.id), String(body.secret), async (challenge, tx) => {
      const user = await tx.get<User>("user", challenge.userId ?? "", dir);
      if (!user?.enabled || user.refreshVersion !== challenge.data.version) throw new AuthError("Login expired. Start again.");
      const factor = challenge.data.factor as Record<string, unknown>;
      if (factor.origin !== origin) throw new AuthError("Login belongs to a different origin.");
      const recoveryCodes = await runtime.factors.complete(tx, scope, user, factor, body);
      return { user, recoveryCodes };
    });
    const issued = await identity.issueSession(scope, policy, result.user, runtime.tokenIssuer, runtime.refreshTokenSeconds);
    publishSession(ctx, issued);
    return { status: "ok", message: "Signed in.", next: resolveAppAuthRedirect(ctx, "afterLogin", body.next), recoveryCodes: result.recoveryCodes ?? [], accountUrl };
  }
  if (!ctx.user) throw new AuthError("Sign in to manage your account.", 401);
  const user = await identity.findUser(scope, policy, ctx.user.sub, true);
  if (!user?.enabled) throw new AuthError("Account unavailable.", 401);
  const assertCurrent = async (tx: AuthTransaction): Promise<User> => {
    const current = await tx.get<User>("user", user.id, dir);
    if (!current?.enabled) throw new AuthError("Account unavailable.", 401);
    await identity.assertActiveSession(tx, scope, ctx.user!, current);
    return current;
  };
  await identity.storage.transaction(scope, assertCurrent);
  if (action === "profile") {
    await identity.updateUser(scope, policy, user.id, async (u, tx) => { await assertCurrent(tx); u.name = String(body.name ?? "").slice(0, 200); });
  } else if (action === "session.revoke") {
    await identity.storage.transaction(scope, async tx => {
      await assertCurrent(tx);
      const session = await tx.get<Session>("session", String(body.id), scope);
      if (session?.userId !== user.id) throw new AuthError("Session unavailable.", 404);
      await tx.put("session", scope, { ...session, revoked: true });
    });
  } else if (action === "password") {
    if (!await verifyPassword(user.passwordHash, String(body.currentPassword ?? ""))) throw new AuthError("Current password invalid.", 403);
    if (await runtime.factors.hasFactors(user)) requireElevation(ctx.user, { minimum: "mfa", maxAgeSeconds: 300 });
    const hash = await hashPassword(String(body.password));
    await identity.updateUser(scope, policy, user.id, async (u, tx) => { await assertCurrent(tx); if (u.passwordHash !== user.passwordHash) throw new AuthError("Account changed."); u.passwordHash = hash; u.refreshVersion++; });
  } else if (action === "email.change") {
    requireElevation(ctx.user, { minimum: await runtime.factors.hasFactors(user) ? "mfa" : "confirm", maxAgeSeconds: 300 });
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) throw new AuthError("Enter a valid email.");
    await identity.storage.transaction(scope, async tx => {
      await assertCurrent(tx);
      const ticket = await identity.challengeInTransaction(tx, scope, "email.verify", { email, version: user.refreshVersion }, user.id, 1800);
      const link = accountLink(ctx, "email.verify", ticket);
      if (!link) throw new AuthError("Account page is not mounted.", 503);
      await runtime.mail.enqueue(tx, scope, email, "Verify your new email address", `Confirm your new email address: ${link}`);
      if (user.email) await runtime.mail.enqueue(tx, scope, user.email, "Email change requested", "A change to your email address was requested. If this was not you, reset your password and contact your administrator.");
    });
  } else if (action === "factor.start") {
    if (await runtime.factors.hasFactors(user)) requireElevation(ctx.user, { minimum: "mfa", maxAgeSeconds: 300 });
    else requireElevation(ctx.user, { minimum: "confirm", maxAgeSeconds: 300 });
    const prepared = await runtime.factors.prepare(user, origin, true);
    const ticket = await identity.challenge(scope, "factor", { version: user.refreshVersion, factor: prepared.private }, user.id);
    return { status: "ok", challenge: { ...ticket, ...prepared.public }, accountUrl } as JsonObject;
  } else if (action === "factor.complete") {
    const recoveryCodes = await identity.consume(scope, "factor", String(body.id), String(body.secret), async (challenge, tx) => {
      const current = await assertCurrent(tx);
      const factor = challenge.data.factor as Record<string, unknown>;
      if (!current?.enabled || challenge.userId !== user.id || current.refreshVersion !== challenge.data.version || factor.origin !== origin) throw new AuthError("Account changed.");
      return runtime.factors.complete(tx, scope, current, factor, body);
    });
    return { status: "ok", message: "Factor enrolled. Save your recovery codes now.", recoveryCodes: recoveryCodes ?? [], accountUrl };
  } else if (action === "factor.remove") {
    requireElevation(ctx.user, { minimum: "mfa", maxAgeSeconds: 300 });
    await identity.updateUser(scope, policy, user.id, async (u, tx) => {
      await assertCurrent(tx);
      const keys = (await tx.list("passkey", dir)).filter(p => p.userId === user.id);
      if (keys.length + (u.totp ? 1 : 0) <= 1) throw new AuthError("Enroll a replacement before removing your last factor.");
      if (body.method === "totp") { delete u.totp; delete u.totpLastStep; }
      else { const key = keys.find(k => k.id === body.id); if (!key) throw new AuthError("Factor unavailable."); await tx.remove("passkey", key.id, dir); }
      u.refreshVersion++;
    });
  } else if (action === "identity.unlink") {
    requireElevation(ctx.user, { minimum: await runtime.factors.hasFactors(user) ? "mfa" : "confirm", maxAgeSeconds: 300 });
    await identity.storage.transaction(scope, async tx => {
      const current = await assertCurrent(tx);
      const links = (await tx.list("external", dir)).filter(p => p.userId === current.id);
      if (!links.some(p => p.id === body.id)) throw new AuthError("Linked identity unavailable.", 404);
      // A verified local password is a recovery-independent sign-in method.
      if (!current.passwordHash || !current.emailVerified) throw new AuthError("Set a local password and verify your email before unlinking a provider.");
      await tx.remove("external", String(body.id), dir);
      current.refreshVersion++; await tx.put("user", dir, current);
    });
  } else throw new AuthError("Unknown account action.");
  await identity.storage.transaction(scope, tx => identity.audit(tx, scope, user.id, `account.${action}`));
  return { status: "ok", message: "Account updated.", accountUrl };
}
