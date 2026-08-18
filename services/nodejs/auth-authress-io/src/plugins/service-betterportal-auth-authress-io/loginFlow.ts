import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  resolveAppAuthRedirect,
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
} from "@betterportal/framework";
import type { JwtClaims } from "@betterportal/framework";
import type { Plugin } from "./index.js";
import { resolveAuthressAppConfig, resolveAuthressBrowserConfig } from "./index.js";

export const QuerySchema = av.object({
  action: av.optional(av.string()),
  next: av.optional(av.string()),
  redirect: av.optional(av.string())
});

export const HeadersSchema = av.object({});

export const RequestSchema = av.object({
  accessToken: av.string().minLength(1),
  next: av.optional(av.string()),
  userId: av.optional(av.string()),
  name: av.optional(av.string()),
  email: av.optional(av.string()),
  picture: av.optional(av.string())
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  authressApiUrl: av.optional(av.string()),
  authressApplicationId: av.optional(av.string()),
  loginUI: av.enum_(["default", "clean", "redirect"] as const).default("default"),
  scopes: av.array(av.string()).default([]),
  alreadyLoggedIn: av.optional(av.bool()),
  loggedOut: av.optional(av.bool()),
  nextUrl: av.optional(av.string()),
  expiresInSeconds: av.optional(av.int().min(1)),
  user: av.optional(av.object({
    id: av.optional(av.string()),
    name: av.optional(av.string()),
    email: av.optional(av.string()),
    picture: av.optional(av.string())
  }))
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Authress Login";
export const description = "Authenticate with Authress and store the Authress bearer token.";
export const role = "auth.login";
export const dependencies = [
  { operationId: "auth.login", method: "POST" },
  { operationId: "auth.logout", method: "GET" },
  { operationId: "auth.refresh", method: "POST" }
] as const;
export const chrome: BetterPortalRouteChrome = { fullScreen: true };
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function secondsUntilJwtExpiry(token: string): number | undefined {
  const [, payload] = token.split(".");
  if (!payload) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return undefined;
    return Math.max(1, Math.floor(parsed.exp - Date.now() / 1000));
  } catch {
    return undefined;
  }
}

function splitScopes(value?: string): string[] {
  return (value ?? "openid profile email")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function pluginFrom(ctx: { plugin?: unknown }): Plugin {
  const plugin = ctx.plugin as Plugin | undefined;
  if (!plugin) throw new Error("Authress plugin not available on handler context");
  return plugin;
}

function profileValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema, headers: HeadersSchema },
  async (ctx) => {
    const appConfig = resolveAuthressAppConfig(ctx.config);
    const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin", (ctx.query as Infer<typeof QuerySchema>).next ?? (ctx.query as Infer<typeof QuerySchema>).redirect);
    const browserConfig = resolveAuthressBrowserConfig(ctx.config);
    if ((ctx.query as Infer<typeof QuerySchema>).action === "logout") {
      const loggedOutUrl = resolveAppAuthRedirect(ctx, "afterLogout");
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
      return {
        status: "ok" as const,
        message: "Signed out.",
        authressApiUrl: browserConfig?.authressApiUrl,
        authressApplicationId: browserConfig?.applicationId,
        loginUI: appConfig?.loginUI ?? "default",
        loggedOut: true,
        scopes: [],
        nextUrl: loggedOutUrl
      };
    }
    if (ctx.user) {
      return {
        status: "ok" as const,
        message: "Already signed in.",
        authressApiUrl: browserConfig?.authressApiUrl,
        authressApplicationId: browserConfig?.applicationId,
        loginUI: appConfig?.loginUI ?? "default",
        alreadyLoggedIn: true,
        scopes: [],
        nextUrl,
        user: {
          id: ctx.user.sub,
          name: ctx.user.name,
          email: ctx.user.email,
          picture: ctx.user.picture
        }
      };
    }

    const config = browserConfig;
    if (!config) {
      return { status: "error" as const, message: "Authress browser config is missing authressApiUrl or applicationId.", loginUI: appConfig?.loginUI ?? "default", scopes: [], nextUrl };
    }

    return {
      status: "ok" as const,
      message: "Start Authress sign in.",
      authressApiUrl: config.authressApiUrl,
      authressApplicationId: config.applicationId,
      loginUI: appConfig?.loginUI ?? "default",
      scopes: splitScopes(config.scopes),
      nextUrl
    };
  }
);

export const handlePost = createHandler(
  { response: ResponseSchema, query: QuerySchema, request: RequestSchema },
  async (ctx) => {
    const request = ctx.request as Infer<typeof RequestSchema>;
    const config = resolveAuthressAppConfig(ctx.config);
    const nextUrl = resolveAppAuthRedirect(ctx, "afterLogin", request.next ?? (ctx.query as Infer<typeof QuerySchema>).next);
    const loginUI = config?.loginUI ?? "default";
    if (!config) {
      return { status: "error" as const, message: "Authress config is missing authressApiUrl or applicationId.", loginUI, scopes: [], nextUrl };
    }

    const plugin = pluginFrom(ctx);
    let user: JwtClaims;
    try {
      user = await plugin.verifyAuthressToken(request.accessToken, config, { tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch (error: any) {
      ctx.obs?.error(error);
      return { status: "error" as const, message: `Authress token verification failed: ${(error as Error).message}`, loginUI, scopes: [], nextUrl };
    }

    if (request.userId && request.userId !== user.sub) {
      return { status: "error" as const, message: "Authress profile subject does not match token subject.", loginUI, scopes: [], nextUrl };
    }

    const roles = await plugin.resolveAuthressRoles(user.sub, ctx.tenant.id, ctx.app.id, config, user.roles);
    const issued = plugin.issueTokenPair({
      sub: user.sub,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles,
      refreshContext: { providerToken: request.accessToken },
      authProvider: "authress.io",
      providerSubject: user.sub,
      provider: user.provider,
      name: profileValue(request.name) || user.name,
      email: profileValue(request.email) || user.email,
      picture: profileValue(request.picture) || user.picture
    });
    if (!issued.refreshToken) throw new Error('Auth token issuer did not return a refresh token');
    ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
      locked: true,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });
    ctx.bpHeaders?.set("X-BP-Refresh", issued.refreshToken, {
      locked: true,
      scopeToOwner: true,
      expiresInSeconds: Math.min(
        issued.refreshTokenExpiresInSeconds ?? Number.MAX_SAFE_INTEGER,
        secondsUntilJwtExpiry(request.accessToken) ?? Number.MAX_SAFE_INTEGER
      )
    });
    ctx.responseHeaders?.set("HX-Redirect", nextUrl);
    if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);

    return {
      status: "ok" as const,
      message: "Signed in.",
      loginUI,
      scopes: [],
      nextUrl,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      user: {
        id: user.sub,
        name: profileValue(request.name) ?? user.name,
        email: profileValue(request.email) ?? user.email,
        picture: profileValue(request.picture) ?? user.picture
      }
    };
  }
);
