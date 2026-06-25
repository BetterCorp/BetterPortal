import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
} from "@betterportal/framework";
import type { JwtClaims } from "@betterportal/framework";
import type { Plugin } from "../../index.js";
import { resolveAuthressAppConfig, resolveAuthressBrowserConfig } from "../../index.js";

export const QuerySchema = av.object({
  action: av.optional(av.string()),
  next: av.optional(av.string()),
  redirect: av.optional(av.string())
}, { unknownKeys: "strip" });

export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({
  accessToken: av.string().minLength(1),
  next: av.optional(av.string()),
  userId: av.optional(av.string()),
  name: av.optional(av.string()),
  email: av.optional(av.string()),
  picture: av.optional(av.string())
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  authressApiUrl: av.optional(av.string()),
  authressApplicationId: av.optional(av.string()),
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
  }, { unknownKeys: "strip" }))
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Authress Login";
export const description = "Authenticate with Authress and store the Authress bearer token.";
export const role = "auth.login";
export const dependencies = ["logout.index", "refresh.index"];
export const chrome: BetterPortalRouteChrome = { fullScreen: true };
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function normalizeRedirect(raw: string | undefined): string {
  const redirect = raw?.trim();
  if (!redirect) return "/";
  if (redirect.startsWith("http://") || redirect.startsWith("https://")) return redirect;
  return redirect.startsWith("/") ? redirect : `/${redirect}`;
}

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
    const nextUrl = normalizeRedirect((ctx.query as Infer<typeof QuerySchema>).next ?? (ctx.query as Infer<typeof QuerySchema>).redirect ?? appConfig?.loginRedirectPath);
    const browserConfig = resolveAuthressBrowserConfig(ctx.config);
    if ((ctx.query as Infer<typeof QuerySchema>).action === "logout") {
      const loggedOutUrl = normalizeRedirect(appConfig?.logoutRedirectPath);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
      return {
        status: "ok" as const,
        message: "Signed out.",
        authressApiUrl: browserConfig?.authressApiUrl,
        authressApplicationId: browserConfig?.applicationId,
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
      return { status: "error" as const, message: "Authress browser config is missing authressApiUrl or applicationId.", scopes: [], nextUrl };
    }

    return {
      status: "ok" as const,
      message: "Start Authress sign in.",
      authressApiUrl: config.authressApiUrl,
      authressApplicationId: config.applicationId,
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
    const nextUrl = normalizeRedirect(request.next ?? (ctx.query as Infer<typeof QuerySchema>).next ?? config?.loginRedirectPath);
    if (!config) {
      return { status: "error" as const, message: "Authress config is missing authressApiUrl or applicationId.", scopes: [], nextUrl };
    }

    let user: JwtClaims;
    try {
      user = await pluginFrom(ctx).verifyAuthressToken(request.accessToken, config, { tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch (error: any) {
      ctx.obs?.error(error);
      return { status: "error" as const, message: `Authress token verification failed: ${(error as Error).message}`, scopes: [], nextUrl };
    }

    if (request.userId && request.userId !== user.sub) {
      return { status: "error" as const, message: "Authress profile subject does not match token subject.", scopes: [], nextUrl };
    }

    const issued = pluginFrom(ctx).issueTokenPair({
      sub: user.sub,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles: user.roles,
      authProvider: "authress.io",
      providerSubject: user.sub,
      provider: user.provider,
      name: profileValue(request.name) || user.name,
      email: profileValue(request.email) || user.email,
      picture: profileValue(request.picture) || user.picture
    }, { includeRefreshToken: false });
    ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
      locked: true,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });
    ctx.bpHeaders?.set("X-BP-Refresh", request.accessToken, {
      locked: true,
      scopeToOwner: true,
      expiresInSeconds: secondsUntilJwtExpiry(request.accessToken)
    });
    ctx.responseHeaders?.set("HX-Redirect", nextUrl);
    if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);

    return {
      status: "ok" as const,
      message: "Signed in.",
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
