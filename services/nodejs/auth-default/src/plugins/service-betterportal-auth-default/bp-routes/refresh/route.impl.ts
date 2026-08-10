import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";
import { createHandler } from "../../.bp-generated/route-runtime.js";
import type { Plugin } from "../../index.js";

export const QuerySchema = av.object({});
export const HeadersSchema = av.object({
  "x-bp-refresh": av.optional(av.string().minLength(1))
});

export const RequestSchema = av.object({
  refreshToken: av.optional(av.string().minLength(1).describe("Signed refresh token issued by the auth service."))
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const).describe("Refresh request outcome."),
  message: av.optional(av.string()).describe("Human-readable status or error message for the renderer."),
  accessToken: av.optional(av.string()).describe("New signed JWT access token returned when refresh succeeds."),
  expiresInSeconds: av.optional(av.int().min(1)).describe("New access token lifetime in seconds.")
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Refresh Token";
export const description = "Exchange a refresh token for a new access token.";
export const role = "auth.refresh";

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

function runtimeFrom(ctx: { plugin?: Pick<Plugin, "runtime"> }): Plugin["runtime"] {
  const runtime = ctx.plugin?.runtime;
  if (!runtime) throw new Error("Auth runtime not available on handler context");
  return runtime;
}

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema, headers: HeadersSchema },
  async (ctx) => {
    const runtime = runtimeFrom(ctx);
    const tenantId = ctx.tenant.id;
    const appId = ctx.app.id;

    const body = ctx.request as Infer<typeof RequestSchema>;
    const headers = ctx.headers as Infer<typeof HeadersSchema>;
    const refreshToken = body.refreshToken ?? headers["x-bp-refresh"];
    if (!refreshToken) {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove('Authorization');
      ctx.bpHeaders?.remove('X-BP-Refresh');
      return {
        status: "error" as const,
        message: "Refresh token missing."
      };
    }

    let claims;
    try {
      claims = await runtime.tokenIssuer.verifyRefreshToken({
        refreshToken,
        tenantId,
        appId
      });
    } catch {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove('Authorization');
      ctx.bpHeaders?.remove('X-BP-Refresh');
      return {
        status: "error" as const,
        message: "Refresh token invalid or expired."
      };
    }

    if (claims.authProvider !== 'betterportal.default' || !claims.refreshContext) {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove('Authorization');
      ctx.bpHeaders?.remove('X-BP-Refresh');
      return {
        status: 'error' as const,
        message: 'Refresh token belongs to a different auth provider.'
      };
    }

    const user = runtime.userStore.findById(claims.sub);
    if (!user || !user.enabled) {
      ctx.setStatus?.(401);
      ctx.bpHeaders?.remove('Authorization');
      ctx.bpHeaders?.remove('X-BP-Refresh');
      return {
        status: "error" as const,
        message: "User no longer exists or is disabled."
      };
    }

    const roles = user.appRoles[appId] ?? [];
    const issued = runtime.tokenIssuer.issueTokenPair({
      sub: user.id,
      tenantId: user.tenantId,
      appId,
      authProvider: 'betterportal.default',
      refreshContext: {},
      roles,
      name: user.name ?? user.username,
      email: user.email,
      picture: user.picture
    }, {
      includeRefreshToken: false
    });

    ctx.bpHeaders?.set("Authorization", `Bearer ${issued.accessToken}`, {
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      locked: true,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });

    return {
      status: "ok" as const,
      accessToken: issued.accessToken,
      expiresInSeconds: issued.accessTokenExpiresInSeconds
    };
  }
);
