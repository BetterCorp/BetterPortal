export const operationId = "auth.refresh";
import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import { resolveAuthressAppConfig } from "../../index.js";

export const RequestSchema = av.object({
  refreshToken: av.optional(av.string().minLength(1))
});

export const HeadersSchema = av.object({
  "x-bp-refresh": av.optional(av.string().minLength(1))
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  accessToken: av.optional(av.string()),
  expiresInSeconds: av.optional(av.int().min(1))
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Authress Refresh";
export const description = "Refresh BetterPortal tokens after Authress session renewal.";
export const role = "auth.refresh";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

export default createHandler(
  { response: ResponseSchema, request: RequestSchema, headers: HeadersSchema },
  async (ctx) => {
    const config = resolveAuthressAppConfig(ctx.config);
    if (!config) {
      ctx.setStatus?.(503);
      return { status: "error" as const, message: "Authress config is missing authressApiUrl or applicationId." };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    const headers = ctx.headers as Infer<typeof HeadersSchema>;
    const refreshToken = body.refreshToken ?? headers["x-bp-refresh"];
    if (!refreshToken?.trim()) {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      return { status: "error" as const, message: "Refresh token is required." };
    }
    const plugin = ctx.plugin;
    let refreshClaims;
    try {
      refreshClaims = await plugin.verifyRefreshToken({ refreshToken, tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      return { status: "error" as const, message: "Refresh token invalid or expired." };
    }
    const authressToken = refreshClaims.authProvider === "authress.io"
      && typeof refreshClaims.refreshContext?.providerToken === "string"
      ? refreshClaims.refreshContext.providerToken
      : "";
    if (!authressToken) {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      return { status: "error" as const, message: "Refresh token belongs to a different auth provider." };
    }
    let authressClaims;
    try {
      authressClaims = await plugin.verifyAuthressToken(authressToken, config, { tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      return { status: "error" as const, message: "Authress token invalid or expired." };
    }

    const roles = await plugin.resolveAuthressRoles(authressClaims.sub, ctx.tenant.id, ctx.app.id, config, authressClaims.roles);
    const issued = plugin.issueTokenPair({
      sub: authressClaims.sub,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles,
      authProvider: "authress.io",
      refreshContext: { providerToken: authressToken },
      providerSubject: authressClaims.sub,
      provider: authressClaims.provider,
      name: authressClaims.name ?? refreshClaims.name,
      email: authressClaims.email ?? refreshClaims.email,
      picture: authressClaims.picture ?? refreshClaims.picture
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
      expiresInSeconds: Math.min(issued.refreshTokenExpiresInSeconds ?? Number.MAX_SAFE_INTEGER, secondsUntilJwtExpiry(authressToken))
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
