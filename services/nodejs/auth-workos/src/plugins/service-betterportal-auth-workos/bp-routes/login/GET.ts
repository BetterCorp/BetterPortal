export const operationId = "auth.login";
import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  resolveAppAuthRedirect,
  type ApiAuthRequirement,
  type BetterPortalRouteChrome,
  type CacheHints
} from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import {
  resolveWorkOSAppConfig,
  workOSAccessTokenDetails
} from "../../index.js";
import {
  clearWorkOSStateCookie, createWorkOSState, readWorkOSStateCookie,
  verifyWorkOSState, workOSStateCookie
} from "../../oauthState.js";

export const QuerySchema = av.object({
  action: av.optional(av.string()),
  code: av.optional(av.string()),
  state: av.optional(av.string()),
  next: av.optional(av.string()),
  redirect: av.optional(av.string()),
  error: av.optional(av.string()),
  error_description: av.optional(av.string())
});

export const HeadersSchema = av.object({
  "x-bp-workos-state": av.optional(av.string()),
  cookie: av.optional(av.string())
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  authorizationUrl: av.optional(av.string()),
  loginUI: av.enum_(["default", "clean", "redirect"] as const).default("default"),
  alreadyLoggedIn: av.optional(av.bool()),
  loggedOut: av.optional(av.bool()),
  signedIn: av.optional(av.bool()),
  user: av.optional(av.object({
    id: av.optional(av.string()),
    name: av.optional(av.string()),
    email: av.optional(av.string()),
    picture: av.optional(av.string())
  }))
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "WorkOS Login";
export const description = "Authenticate with WorkOS AuthKit and store BetterPortal auth headers.";
export const role = "auth.login";
export const dependencies = [
  { operationId: "auth.logout", method: "GET" },
  { operationId: "auth.refresh", method: "POST" }
] as const;
export const chrome: BetterPortalRouteChrome = { fullScreen: true };
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function firstString(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

export default createHandler(
  { response: ResponseSchema, query: QuerySchema, headers: HeadersSchema },
  async (ctx) => {
    const query = ctx.query as Infer<typeof QuerySchema>;
    const config = resolveWorkOSAppConfig(ctx.config);
    let nextUrl = resolveAppAuthRedirect(ctx, "afterLogin", query.next ?? query.redirect);

    if (query.action === "logout") {
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
      return {
        status: "ok" as const,
        message: "Signed out.",
        loginUI: config?.loginUI ?? "default",
        loggedOut: true,
      };
    }

    if (!config) {
      return { status: "error" as const, message: "WorkOS config is missing clientId or apiKey.", loginUI: "default" as const };
    }

    if (query.error) {
      const proof = ctx.headers["x-bp-workos-state"] ?? readWorkOSStateCookie(ctx.headers.cookie);
      if (verifyWorkOSState(query.state, proof, { tenantId: ctx.tenant.id, appId: ctx.app.id })) {
        ctx.responseHeaders?.append("Set-Cookie", clearWorkOSStateCookie());
        try { ctx.plugin.claimOAuthState(query.state!); }
        catch (error) { ctx.obs?.error(error instanceof Error ? error : new Error(String(error))); }
      }
      return {
        status: "error" as const,
        message: query.error_description || query.error,
        loginUI: config.loginUI ?? "default",
      };
    }

    const redirectUri = ctx.route?.({ path: "/login" })?.absoluteUiPath;
    if (!redirectUri) {
      return { status: "error" as const, message: "A public app login route is required for WorkOS sign-in.", loginUI: config.loginUI ?? "default" };
    }

    if (query.code) {
      const proof = ctx.headers["x-bp-workos-state"] ?? readWorkOSStateCookie(ctx.headers.cookie);
      const storedNext = verifyWorkOSState(query.state, proof, { tenantId: ctx.tenant.id, appId: ctx.app.id });
      if (!storedNext) {
        return { status: "error" as const, message: "Sign-in state is missing, expired, or does not match this browser. Start sign-in again.", loginUI: config.loginUI ?? "default" };
      }
      try {
        if (!ctx.plugin.claimOAuthState(query.state!)) {
          return { status: "error" as const, message: "Sign-in state was already used. Start sign-in again.", loginUI: config.loginUI ?? "default" };
        }
      } catch (error) {
        ctx.obs?.error(error instanceof Error ? error : new Error(String(error)));
        return { status: "error" as const, message: "Sign-in state could not be checked. Start sign-in again.", loginUI: config.loginUI ?? "default" };
      }
      nextUrl = resolveAppAuthRedirect(ctx, "afterLogin", storedNext);
      ctx.responseHeaders?.append("Set-Cookie", clearWorkOSStateCookie());
      try {
        const auth = await ctx.plugin.authenticateWithCode(config, query.code);
        const details = workOSAccessTokenDetails(auth.accessToken, config.roleClaimPath ?? "roles");
        if (!details) throw new Error("WorkOS access token is missing its session id.");
        if (auth.organizationId && details.organizationId && auth.organizationId !== details.organizationId) {
          throw new Error("WorkOS organization does not match the access token.");
        }
        const organizationId = auth.organizationId ?? details.organizationId;
        const issued = ctx.plugin.issueTokenPair({
          sub: auth.user.id,
          tenantId: ctx.tenant.id,
          appId: ctx.app.id,
          roles: details.roles,
          authProvider: "workos",
          refreshContext: {
            providerToken: auth.refreshToken,
            sessionId: details.sessionId,
            ...(organizationId ? { organizationId } : {})
          },
          providerSubject: auth.user.id,
          provider: {
            accountId: auth.user.id,
            scope: organizationId ? `organization:${organizationId}` : undefined
          },
          name: firstString(auth.user.name, [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ")),
          email: auth.user.email,
          picture: auth.user.profilePictureUrl ?? undefined
        });
        if (!issued.refreshToken) throw new Error("Auth token issuer did not return a refresh token");
        ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
          locked: true,
          expiresInSeconds: issued.accessTokenExpiresInSeconds,
          refreshPath: "/refresh",
          refreshBeforeSeconds: 60
        });
        ctx.bpHeaders?.set("X-BP-Refresh", issued.refreshToken, {
          locked: true,
          scopeToOwner: true,
          expiresInSeconds: issued.refreshTokenExpiresInSeconds
        });
        ctx.responseHeaders?.set("HX-Redirect", nextUrl);
        if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
        return {
          status: "ok" as const,
          message: "Signed in.",
          loginUI: config.loginUI ?? "default",
          signedIn: true,
          user: {
            id: auth.user.id,
            name: firstString(auth.user.name, [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ")),
            email: auth.user.email,
            picture: auth.user.profilePictureUrl ?? undefined
          }
        };
      } catch (error: any) {
        ctx.obs?.error(error);
        return { status: "error" as const, message: `WorkOS sign in failed: ${(error as Error).message}`, loginUI: config.loginUI ?? "default" };
      }
    }

    if (ctx.user) {
      return {
        status: "ok" as const,
        message: "Already signed in.",
        loginUI: config.loginUI ?? "default",
        alreadyLoggedIn: true,
        user: {
          id: ctx.user.sub,
          name: ctx.user.name,
          email: ctx.user.email,
          picture: ctx.user.picture
        }
      };
    }

    const scope = { tenantId: ctx.tenant.id, appId: ctx.app.id };
    let state: string;
    try {
      state = createWorkOSState(nextUrl, scope);
    } catch {
      try { state = createWorkOSState(resolveAppAuthRedirect(ctx, "afterLogin"), scope); }
      catch { return { status: "error" as const, message: "The configured sign-in destination is too long.", loginUI: config.loginUI ?? "default" }; }
    }
    try { ctx.plugin.issueOAuthState(state); }
    catch (error) {
      ctx.obs?.error(error instanceof Error ? error : new Error(String(error)));
      return { status: "error" as const, message: "Sign-in state could not be created. Try again.", loginUI: config.loginUI ?? "default" };
    }
    ctx.responseHeaders?.append("Set-Cookie", workOSStateCookie(state));
    return {
      status: "ok" as const,
      message: "Continue to WorkOS.",
      loginUI: config.loginUI ?? "default",
      authorizationUrl: ctx.plugin.getAuthorizationUrl(config, { redirectUri, state }),
    };
  }
);
