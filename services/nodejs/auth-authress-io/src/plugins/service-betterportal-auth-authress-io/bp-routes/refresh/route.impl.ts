import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import type { Plugin } from "../../index.js";
import { resolveAuthressAppConfig } from "../../index.js";

export const RequestSchema = av.object({
  refreshToken: av.optional(av.string().minLength(1)),
  accessToken: av.optional(av.string())
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  accessToken: av.optional(av.string()),
  expiresInSeconds: av.optional(av.int().min(1))
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Authress Refresh";
export const description = "Refresh BetterPortal tokens after Authress session renewal.";
export const role = "auth.refresh";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function pluginFrom(ctx: { plugin?: unknown }): Plugin {
  const plugin = ctx.plugin as Plugin | undefined;
  if (!plugin) throw new Error("Authress plugin not available on handler context");
  return plugin;
}

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema },
  async (ctx) => {
    const config = resolveAuthressAppConfig(ctx.config);
    if (!config) {
      return { status: "error" as const, message: "Authress config is missing authressApiUrl or applicationId." };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    const headers = ctx.headers as Record<string, string | undefined>;
    const authressToken = body.accessToken ?? headers["x-bp-refresh"];
    if (!authressToken?.trim()) {
      return { status: "error" as const, message: "Authress access token is required to refresh BetterPortal tokens." };
    }
    const plugin = pluginFrom(ctx);
    let authressClaims;
    try {
      authressClaims = await plugin.verifyAuthressToken(authressToken, config, { tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch {
      return { status: "error" as const, message: "Authress token invalid or expired." };
    }

    const issued = plugin.issueTokenPair({
      sub: authressClaims.sub,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles: authressClaims.roles,
      authProvider: "authress.io",
      providerSubject: authressClaims.sub,
      provider: authressClaims.provider,
      name: authressClaims.name,
      email: authressClaims.email,
      picture: authressClaims.picture
    }, { includeRefreshToken: false });

    ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
      locked: true,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });
    ctx.bpHeaders?.set("X-BP-Refresh", authressToken, {
      locked: true,
      scopeToOwner: true,
      expiresInSeconds: secondsUntilJwtExpiry(authressToken)
    });

    return {
      status: "ok" as const,
      accessToken: issued.accessToken,
      expiresInSeconds: issued.accessTokenExpiresInSeconds
    };
  }
);

function secondsUntilJwtExpiry(token: string): number {
  const payload = token.split(".")[1];
  if (!payload) return 60 * 15;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return 60 * 15;
    return Math.max(1, parsed.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 60 * 15;
  }
}
