import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import type { Plugin } from "../../index.js";
import {
  resolveWorkOSAppConfig,
  rolesFromWorkOSAccessToken,
  secondsUntilJwtExpiry
} from "../../index.js";

export const HeadersSchema = av.object({
  "x-bp-refresh": av.optional(av.string())
}, { unknownKeys: "strip" });

export const RequestSchema = av.object({
  refreshToken: av.optional(av.string().minLength(1))
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  accessToken: av.optional(av.string()),
  expiresInSeconds: av.optional(av.int().min(1))
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "WorkOS Refresh";
export const description = "Refresh BetterPortal tokens using the WorkOS refresh token.";
export const role = "auth.refresh";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function pluginFrom(ctx: { plugin?: unknown }): Plugin {
  const plugin = ctx.plugin as Plugin | undefined;
  if (!plugin) throw new Error("WorkOS plugin not available on handler context");
  return plugin;
}

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema, headers: HeadersSchema },
  async (ctx) => {
    const config = resolveWorkOSAppConfig(ctx.config);
    if (!config) {
      return { status: "error" as const, message: "WorkOS config is missing clientId or apiKey." };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    const headers = ctx.headers as Infer<typeof HeadersSchema>;
    const refreshToken = body.refreshToken ?? headers["x-bp-refresh"];
    if (!refreshToken?.trim()) {
      return { status: "error" as const, message: "WorkOS refresh token is required." };
    }

    let auth;
    try {
      auth = await pluginFrom(ctx).refreshWorkOSToken(config, refreshToken);
    } catch (error: any) {
      ctx.obs?.error(error);
      return { status: "error" as const, message: "WorkOS refresh token invalid or expired." };
    }

    const issued = pluginFrom(ctx).issueTokenPair({
      sub: auth.user.id,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles: rolesFromWorkOSAccessToken(auth.accessToken, config.roleClaimPath ?? "roles"),
      authProvider: "workos",
      providerSubject: auth.user.id,
      provider: {
        accountId: auth.user.id,
        scope: auth.organizationId ? `organization:${auth.organizationId}` : undefined
      },
      name: auth.user.name ?? undefined,
      email: auth.user.email,
      picture: auth.user.profilePictureUrl ?? undefined
    }, { includeRefreshToken: false });

    ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
      locked: true,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });
    ctx.bpHeaders?.set("X-BP-Refresh", auth.refreshToken, {
      locked: true,
      scopeToOwner: true,
      expiresInSeconds: secondsUntilJwtExpiry(auth.accessToken)
    });

    return {
      status: "ok" as const,
      accessToken: issued.accessToken,
      expiresInSeconds: issued.accessTokenExpiresInSeconds
    };
  }
);
