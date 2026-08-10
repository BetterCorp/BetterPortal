import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  resolveAppAuthRedirect,
  type ApiAuthRequirement,
  type BetterPortalRouteChrome,
  type CacheHints
} from "@betterportal/framework";
import type { Plugin } from "../../index.js";
import {
  resolveWorkOSAppConfig,
  workOSAccessTokenDetails
} from "../../index.js";

export const QuerySchema = av.object({
  action: av.optional(av.string()),
  code: av.optional(av.string()),
  state: av.optional(av.string()),
  next: av.optional(av.string()),
  redirect: av.optional(av.string()),
  error: av.optional(av.string()),
  error_description: av.optional(av.string())
});

export const HeadersSchema = av.object({});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  authorizationUrl: av.optional(av.string()),
  loginUI: av.enum_(["default", "clean", "redirect"] as const).default("default"),
  alreadyLoggedIn: av.optional(av.bool()),
  loggedOut: av.optional(av.bool()),
  signedIn: av.optional(av.bool()),
  nextUrl: av.optional(av.string()),
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
export const dependencies = ["auth.logout", "auth.refresh"];
export const chrome: BetterPortalRouteChrome = { fullScreen: true };
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function pluginFrom(ctx: { plugin?: unknown }): Plugin {
  const plugin = ctx.plugin as Plugin | undefined;
  if (!plugin) throw new Error("WorkOS plugin not available on handler context");
  return plugin;
}

function firstString(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema, headers: HeadersSchema },
  async (ctx) => {
    const query = ctx.query as Infer<typeof QuerySchema>;
    const config = resolveWorkOSAppConfig(ctx.config);
    const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin", query.state ?? query.next ?? query.redirect);

    if (query.action === "logout") {
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
      return {
        status: "ok" as const,
        message: "Signed out.",
        loginUI: config?.loginUI ?? "default",
        loggedOut: true,
        nextUrl: resolveAppAuthRedirect(ctx, "afterLogout")
      };
    }

    if (!config) {
      return { status: "error" as const, message: "WorkOS config is missing clientId or apiKey.", loginUI: "default" as const, nextUrl };
    }

    if (query.error) {
      return {
        status: "error" as const,
        message: query.error_description || query.error,
        loginUI: config.loginUI ?? "default",
        nextUrl
      };
    }

    if (query.code) {
      try {
        const auth = await pluginFrom(ctx).authenticateWithCode(config, query.code);
        const details = workOSAccessTokenDetails(auth.accessToken, config.roleClaimPath ?? "roles");
        if (!details) throw new Error("WorkOS access token is missing its session id.");
        if (auth.organizationId && details.organizationId && auth.organizationId !== details.organizationId) {
          throw new Error("WorkOS organization does not match the access token.");
        }
        const organizationId = auth.organizationId ?? details.organizationId;
        const issued = pluginFrom(ctx).issueTokenPair({
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
          nextUrl,
          user: {
            id: auth.user.id,
            name: firstString(auth.user.name, [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ")),
            email: auth.user.email,
            picture: auth.user.profilePictureUrl ?? undefined
          }
        };
      } catch (error: any) {
        ctx.obs?.error(error);
        return { status: "error" as const, message: `WorkOS sign in failed: ${(error as Error).message}`, loginUI: config.loginUI ?? "default", nextUrl };
      }
    }

    if (ctx.user) {
      return {
        status: "ok" as const,
        message: "Already signed in.",
        loginUI: config.loginUI ?? "default",
        alreadyLoggedIn: true,
        nextUrl,
        user: {
          id: ctx.user.sub,
          name: ctx.user.name,
          email: ctx.user.email,
          picture: ctx.user.picture
        }
      };
    }

    const redirectUri =
      ctx.uiRouteUrl?.("login.index", { absolute: true }) ??
      ctx.routeUrl?.("login.index", { absolute: true }) ??
      "/login";
    return {
      status: "ok" as const,
      message: "Continue to WorkOS.",
      loginUI: config.loginUI ?? "default",
      authorizationUrl: pluginFrom(ctx).getAuthorizationUrl(config, { redirectUri, state: nextUrl }),
      nextUrl
    };
  }
);
