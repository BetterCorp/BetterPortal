import * as oidc from "openid-client";
import * as av from "anyvali";
import { requireElevation, type RouteHandlerContext, type JsonObject } from "@betterportal/framework";
import { AuthError, secretHash, type User } from "./identity.js";
import type { AuthRuntime } from "./plugins/service-betterportal-auth-default/index.js";
import { publishSession } from "./account.js";

type Context = RouteHandlerContext & { plugin: { runtime: AuthRuntime } };
export interface SocialConnection { id: string; kind: "google" | "microsoft" | "github"; clientId: string; clientSecret: string; tenantId?: string }
const TenantIdSchema = av.string().format("uuid");
const ConnectionsSchema = av.array(av.object({
  id: av.string().minLength(1), kind: av.enum_(["google", "microsoft", "github"] as const),
  clientId: av.string().minLength(1), clientSecret: av.string().minLength(1), tenantId: av.optional(TenantIdSchema)
})).maxItems(20);
export interface ExternalIdentity { issuer: string; subject: string; email?: string; emailVerified: boolean; name?: string }
/** Enterprise adapters can implement the same normalized identity boundary later. */
export interface IdentityProviderAdapter {
  authorize(connection: SocialConnection, parameters: Record<string, string>): Promise<string>;
  exchange(connection: SocialConnection, callback: URL, checks: { verifier: string; nonce: string; state: string; redirectUri: string }): Promise<ExternalIdentity>;
}
export function socialConnections(runtime: AuthRuntime, scope: { tenantId: string; appId: string }): SocialConnection[] {
  return parseSocialConnections(runtime.configuration(scope).socialConnections);
}
export function parseSocialConnections(configured: unknown): SocialConnection[] {
  if (configured === undefined || configured === "") return [];
  let value: unknown;
  try { value = typeof configured === "string" ? JSON.parse(configured) : configured; }
  catch { throw new AuthError("Social connections must be a valid JSON array.", 503); }
  const result = ConnectionsSchema.safeParse(value);
  if (!result.success) throw new AuthError("Invalid social connection configuration. Check provider types and required credentials.", 503);
  const list = result.data;
  if (new Set(list.map(c => c.id)).size !== list.length) throw new AuthError("Duplicate social connection ID.", 503);
  if (list.some(c => c.kind === "microsoft" && !c.tenantId)) throw new AuthError("Microsoft requires an explicit directory tenant ID.", 503);
  return list;
}
async function discover(c: SocialConnection): Promise<oidc.Configuration> {
  if (c.kind === "microsoft" && !TenantIdSchema.safeParse(c.tenantId).success) throw new AuthError("Microsoft requires an explicit directory tenant ID.", 503);
  return oidc.discovery(new URL(c.kind === "google" ? "https://accounts.google.com" : `https://login.microsoftonline.com/${c.tenantId}/v2.0`), c.clientId, c.clientSecret);
}
export const socialAdapter: IdentityProviderAdapter = {
  async authorize(connection, parameters) {
    if (connection.kind !== "github") return oidc.buildAuthorizationUrl(await discover(connection), { ...parameters, scope: "openid profile email", prompt: "select_account" }).href;
    const url = new URL("https://github.com/login/oauth/authorize");
    for (const [key, value] of Object.entries({ ...parameters, scope: "read:user user:email" })) url.searchParams.set(key, value);
    return url.href;
  },
  async exchange(connection, callback, checks) {
    if (connection.kind !== "github") {
      const token = await oidc.authorizationCodeGrant(await discover(connection), callback, { pkceCodeVerifier: checks.verifier, expectedState: checks.state, expectedNonce: checks.nonce, idTokenExpected: true });
      const claims = token.claims();
      if (!claims) throw new AuthError("Provider identity unavailable.");
      return { issuer: claims.iss, subject: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined, emailVerified: claims.email_verified === true, name: typeof claims.name === "string" ? claims.name : undefined };
    }
    const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: connection.clientId, client_secret: connection.clientSecret, code: callback.searchParams.get("code") ?? "", code_verifier: checks.verifier, redirect_uri: checks.redirectUri }) });
    const token = await response.json() as { access_token?: string };
    if (!response.ok || !token.access_token) throw new AuthError("Provider rejected sign-in.");
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "BetterPortal" };
    const [profileResponse, emailResponse] = await Promise.all([fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(10000), redirect: "error" }), fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(10000), redirect: "error" })]);
    if (!profileResponse.ok || !emailResponse.ok) throw new AuthError("Provider profile unavailable.");
    const profile = await profileResponse.json() as { id?: number; name?: string; login?: string };
    const emails = await emailResponse.json() as Array<{ email: string; verified: boolean; primary: boolean }>;
    const email = emails.find(e => e.primary && e.verified) ?? emails.find(e => e.verified);
    if (!profile.id) throw new AuthError("Provider subject unavailable.");
    return { issuer: "https://github.com", subject: String(profile.id), email: email?.email, emailVerified: !!email, name: profile.name ?? profile.login };
  }
};
export async function socialPost(ctx: Context): Promise<JsonObject> {
  const runtime = ctx.plugin.runtime; const identity = runtime.identity; const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id }; const policy = await runtime.policy(scope);
  const body = ctx.request as Record<string, any>; const connections = socialConnections(runtime, scope);
  const event = ctx.rawEvent as { req: Request; url: URL }; const origin = event.req.headers.get("origin") ?? event.url.origin;
  if (body.action === "start" || body.action === "link") {
    const connection = connections.find(c => c.id === body.connection);
    if (!connection) throw new AuthError("Connection unavailable.");
    if (body.action === "link") requireElevation(ctx.user, { minimum: "confirm", maxAgeSeconds: 300 });
    const redirectUri = ctx.uiRouteUrl?.("social.index", { absolute: true });
    if (!redirectUri || new URL(redirectUri).origin !== origin) throw new AuthError("Mount the social sign-in page in this app and register its redirect URL.", 503);
    await identity.rateLimit(scope, "social", "app", 100, 600);
    const verifier = oidc.randomPKCECodeVerifier(); const nonce = oidc.randomNonce();
    const ticket = await identity.storage.transaction(scope, async tx => {
      if (body.action === "link") {
        const user = await tx.get<User>("user", ctx.user!.sub, { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" });
        if (!user?.enabled) throw new AuthError("Account unavailable.", 401);
        await identity.assertActiveSession(tx, scope, ctx.user!, user);
      }
      // Redirecting discards the in-memory elevated JWT. Bind the approved link
      // to its app session so the ordinary token can finish after returning.
      return identity.challengeInTransaction(tx, scope, "social", { connectionId: connection.id, configHash: secretHash(JSON.stringify(connection)), verifier: identity.cipher.encrypt(verifier), nonce, redirectUri, origin, linkUserId: body.action === "link" ? ctx.user!.sub : null, linkSessionId: body.action === "link" ? ctx.user!.sessionId : null, linkVersion: body.action === "link" ? ctx.user!.sessionVersion : null });
    });
    const authorizationUrl = await socialAdapter.authorize(connection, { client_id: connection.clientId, redirect_uri: redirectUri, response_type: "code", state: ticket.id, nonce, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256" });
    return { status: "ok", ...ticket, authorizationUrl };
  }
  if (body.action !== "complete") throw new AuthError("Unknown social action.");
  const result = await identity.consume(scope, "social", String(body.id), String(body.secret), async (challenge, tx) => {
    const data = challenge.data; const connection = connections.find(c => c.id === data.connectionId);
    if (!connection || data.configHash !== secretHash(JSON.stringify(connection)) || data.origin !== origin) throw new AuthError("Sign-in configuration changed. Start again.");
    const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" };
    let linkingUser: User | undefined;
    if (data.linkUserId) {
      if (!ctx.user || ctx.user.sub !== data.linkUserId || ctx.user.sessionId !== data.linkSessionId || ctx.user.sessionVersion !== data.linkVersion) throw new AuthError("Sign in again before linking.", 401);
      linkingUser = await tx.get<User>("user", ctx.user.sub, dir);
      if (!linkingUser?.enabled) throw new AuthError("Account unavailable.", 401);
      await identity.assertActiveSession(tx, scope, ctx.user, linkingUser);
    }
    const callback = new URL(String(data.redirectUri)); callback.searchParams.set("code", String(body.code)); callback.searchParams.set("state", challenge.id);
    const external = await socialAdapter.exchange(connection, callback, { verifier: identity.cipher.decrypt(String(data.verifier)), nonce: String(data.nonce), state: challenge.id, redirectUri: String(data.redirectUri) });
    const id = secretHash(JSON.stringify([connection.kind, external.issuer, external.subject]));
    const linked = await tx.get("external", id, dir);
    if (linkingUser) {
      const user = linkingUser;
      if (linked && linked.userId !== user.id) throw new AuthError("Identity already linked or unavailable.");
      await tx.put("external", dir, { id, userId: user.id, issuer: external.issuer, subject: external.subject, provider: connection.kind });
      await identity.audit(tx, scope, user.id, "identity.linked");
      return { linked: true, user };
    }
    let user = linked ? await tx.get<User>("user", String(linked.userId), dir) : undefined;
    if (!linked) {
      if (policy.registration !== "public") throw new AuthError("Accept an invitation or sign in to link this provider first.", 403);
      if (!external.email || !external.emailVerified) throw new AuthError("This provider did not verify an email address. Register with email first, then link the provider.");
      // Email equality is never proof that two identities should be linked.
      user = await identity.createInTransaction(tx, scope, policy, { username: external.email, email: external.email, name: external.name, verified: true });
      await tx.put("external", dir, { id, userId: user.id, issuer: external.issuer, subject: external.subject, provider: connection.kind });
    }
    if (!user?.enabled) throw new AuthError("Account unavailable.", 403);
    return { linked: false, user };
  });
  if (result.linked) return { status: "ok", message: "Provider linked to your account." };
  const hasFactors = await runtime.factors.hasFactors(result.user);
  const roles = await identity.storage.transaction(scope, tx => identity.roles(tx, scope, result.user, policy));
  if (hasFactors || policy.requireMfa || roles.includes("*")) {
    const prepared = await runtime.factors.prepare(result.user, origin, !hasFactors);
    const ticket = await identity.challenge(scope, "login", { version: result.user.refreshVersion, factor: prepared.private }, result.user.id);
    return { status: "ok", challenge: { ...ticket, ...prepared.public }, accountUrl: ctx.routeUrl?.("account.index", { absolute: true }) ?? "/account" } as JsonObject;
  }
  publishSession(ctx, await identity.issueSession(scope, policy, result.user, runtime.tokenIssuer, runtime.refreshTokenSeconds));
  return { status: "ok", message: "Signed in.", next: "/" };
}
