export const operationId = "auth.refresh";
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
  workOSAccessTokenDetails,
  WorkOSRefreshContextSchema
} from "../../index.js";

export const HeadersSchema = av.object({
  "x-bp-refresh": av.optional(av.string())
});

export const RequestSchema = av.object({
  refreshToken: av.optional(av.string().minLength(1))
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const),
  message: av.optional(av.string()),
  accessToken: av.optional(av.string()),
  expiresInSeconds: av.optional(av.int().min(1))
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "WorkOS Refresh";
export const description = "Refresh BetterPortal tokens using a WorkOS-backed BP refresh token.";
export const role = "auth.refresh";
export const auth: ApiAuthRequirement = { required: false, permissions: [] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };

function pluginFrom(ctx: { plugin?: unknown }): Plugin {
  const plugin = ctx.plugin as Plugin | undefined;
  if (!plugin) throw new Error("WorkOS plugin not available on handler context");
  return plugin;
}

function clearAuth(ctx: { bpHeaders?: { remove(name: string): void } }): void {
  ctx.bpHeaders?.remove("Authorization");
  ctx.bpHeaders?.remove("X-BP-Refresh");
}

export default createHandler(
  { response: ResponseSchema, request: RequestSchema, headers: HeadersSchema },
  async (ctx) => {
    const config = resolveWorkOSAppConfig(ctx.config);
    if (!config) {
      ctx.setStatus?.(503);
      return { status: "error" as const, message: "WorkOS config is missing clientId or apiKey." };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    const headers = ctx.headers as Infer<typeof HeadersSchema>;
    const refreshToken = body.refreshToken ?? headers["x-bp-refresh"];
    if (!refreshToken?.trim()) {
      ctx.setStatus?.(401);
      clearAuth(ctx);
      return { status: "error" as const, message: "Refresh token is required." };
    }

    const plugin = pluginFrom(ctx);
    let claims;
    try {
      claims = await plugin.verifyRefreshToken({ refreshToken, tenantId: ctx.tenant.id, appId: ctx.app.id });
    } catch {
      ctx.setStatus?.(401);
      clearAuth(ctx);
      return { status: "error" as const, message: "Refresh token invalid or expired." };
    }

    let refreshContext: Infer<typeof WorkOSRefreshContextSchema>;
    try {
      if (claims.authProvider !== "workos" || claims.providerSubject !== claims.sub) throw new Error("Wrong auth provider");
      refreshContext = WorkOSRefreshContextSchema.parse(claims.refreshContext);
    } catch {
      ctx.setStatus?.(401);
      clearAuth(ctx);
      return { status: "error" as const, message: "Refresh token belongs to a different auth provider." };
    }

    let state;
    try {
      state = await plugin.getWorkOSSessionState(config, {
        userId: claims.sub,
        sessionId: refreshContext.sessionId,
        organizationId: refreshContext.organizationId
      });
    } catch (error: any) {
      ctx.obs?.error(error);
      ctx.setStatus?.(502);
      return { status: "error" as const, message: "WorkOS session lookup failed." };
    }
    if (!state.sessionActive || !state.membershipActive) {
      ctx.setStatus?.(401);
      clearAuth(ctx);
      return { status: "error" as const, message: "WorkOS session or organization membership is inactive." };
    }

    let workosAuth;
    try {
      workosAuth = await plugin.refreshWorkOSToken(config, refreshContext.providerToken, refreshContext.organizationId);
    } catch (error: any) {
      ctx.obs?.error(error);
      const status = [400, 401, 403, 404, 422].includes(error?.status) ? 401 : 502;
      ctx.setStatus?.(status);
      if (status === 401) clearAuth(ctx);
      return {
        status: "error" as const,
        message: status === 401 ? "WorkOS refresh token invalid, expired, or revoked." : "WorkOS token refresh failed."
      };
    }

    const details = workOSAccessTokenDetails(workosAuth.accessToken, config.roleClaimPath ?? "roles");
    if (!details
      || workosAuth.user.id !== claims.sub
      || details.sessionId !== refreshContext.sessionId
      || (details.organizationId ?? "") !== (refreshContext.organizationId ?? "")
      || (workosAuth.organizationId ?? details.organizationId ?? "") !== (refreshContext.organizationId ?? "")) {
      ctx.setStatus?.(401);
      clearAuth(ctx);
      return { status: "error" as const, message: "WorkOS refreshed identity does not match the original session." };
    }

    const issued = plugin.issueTokenPair({
      sub: workosAuth.user.id,
      tenantId: ctx.tenant.id,
      appId: ctx.app.id,
      roles: details.roles,
      authProvider: "workos",
      refreshContext: {
        providerToken: workosAuth.refreshToken,
        sessionId: details.sessionId,
        ...(details.organizationId ? { organizationId: details.organizationId } : {})
      },
      providerSubject: workosAuth.user.id,
      provider: {
        accountId: workosAuth.user.id,
        scope: details.organizationId ? `organization:${details.organizationId}` : undefined
      },
      name: workosAuth.user.name ?? undefined,
      email: workosAuth.user.email,
      picture: workosAuth.user.profilePictureUrl ?? undefined
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

    return {
      status: "ok" as const,
      accessToken: issued.accessToken,
      expiresInSeconds: issued.accessTokenExpiresInSeconds
    };
  }
);
