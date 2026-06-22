import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
} from "@betterportal/framework";
import type { AuthRuntime } from "../../index.js";
import { resolveDefaultAuthAppConfig } from "../../index.js";

export const QuerySchema = av.object({
  action: av.optional(av.string()).describe("Optional login route action, currently supports logout."),
  next: av.optional(av.string()).describe("The view path that redirected to the login page and should be redirected back to after a successful login.")
}, { unknownKeys: "strip" });

export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({
  username: av.string().minLength(1).describe("Username for the account signing in."),
  password: av.string().minLength(1).describe("Password for the account signing in."),
  next: av.optional(av.string()).describe("The view path to soft-navigate to after a successful login.")
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const).describe("Login request outcome."),
  message: av.optional(av.string()).describe("Human-readable status or error message for the renderer."),
  accessToken: av.optional(av.string()).describe("Signed JWT access token returned on successful login."),
  refreshToken: av.optional(av.string()).describe("Signed JWT refresh token returned on successful login."),
  expiresInSeconds: av.optional(av.int().min(1)).describe("Access token lifetime in seconds."),
  user: av.optional(av.object({
    id: av.string().describe("Stable UUIDv7 user id."),
    username: av.string().describe("Account username."),
    email: av.optional(av.string()).describe("User email address, when set."),
    name: av.optional(av.string()).describe("Display name, when set.")
  }, { unknownKeys: "strip" }).describe("Authenticated user summary.")),
  // True while the auth service has zero users — the theme renderer redirects
  // to the register view (first-admin setup) instead of showing the login form.
  requiresFirstAdmin: av.optional(av.bool()).describe("True while the auth service has zero users; the theme renderer should redirect to first-admin registration instead of showing the login form."),
  // Absolute URL of this auth service's register view (self-origin). Provided so
  // the theme renderer can load it in-shell without knowing the auth origin.
  firstAdminUrl: av.optional(av.string()).describe("Absolute self-origin URL of this auth service's register view so the theme can load it in-shell without knowing the auth origin."),
  // True when the GET request already carried a valid access token — the theme
  // renderer shows a "signed in" state instead of the login form.
  alreadyLoggedIn: av.optional(av.bool()).describe("True when the GET request already carried a valid access token; the theme renderer should show a signed-in state instead of the login form."),
  loggedOut: av.optional(av.bool()).describe("True after the login route handled ?action=logout."),
  // Tenant-app path of the logout view (app config auth.logoutViewId).
  logoutUrl: av.optional(av.string()).describe("Tenant-app path of the logout view from app auth config."),
  // Echo of ?next= when already signed in — the theme renderer redirects there
  // immediately instead of showing the signed-in card.
  nextUrl: av.optional(av.string()).describe("Echo of the next path when already signed in; the theme renderer should redirect there immediately.")
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Login";
export const description = "Authenticate with username and password to receive a JWT.";
export const role = "auth.login";
export const dependencies = ["logout.index", "refresh.index", "register.index"];
export const chrome: BetterPortalRouteChrome = { fullScreen: true };

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

function runtimeFrom(ctx: { plugin?: unknown }): AuthRuntime {
  const runtime = (ctx.plugin as { runtime?: AuthRuntime } | undefined)?.runtime;
  if (!runtime) throw new Error("Auth runtime not available on handler context");
  return runtime;
}

function normalizeRedirect(raw: string | undefined): string {
  const redirect = raw?.trim();
  if (!redirect) return "/";
  if (redirect.startsWith("http://") || redirect.startsWith("https://")) return redirect;
  return redirect.startsWith("/") ? redirect : `/${redirect}`;
}

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => {
    const runtime = runtimeFrom(ctx);
    const requiresFirstAdmin = runtime.userStore.hasNoUsers();
    if ((ctx.query as Infer<typeof QuerySchema>).action === "logout") {
      const config = resolveDefaultAuthAppConfig(ctx.config);
      const nextUrl = normalizeRedirect(config.logoutRedirectPath);
      ctx.bpHeaders?.remove("Authorization");
      ctx.bpHeaders?.remove("X-BP-Refresh");
      if (ctx.serviceId) ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
      return {
        status: "ok" as const,
        message: "Signed out.",
        loggedOut: true,
        nextUrl
      };
    }

    // Valid token already on the request — no point rendering a login form.
    // First-admin setup still wins: a token can outlive a wiped user store.
    if (ctx.user && !requiresFirstAdmin) {
      const config = resolveDefaultAuthAppConfig(ctx.config);
      const next = (ctx.query as { next?: string }).next || config.loginRedirectPath;
      return {
        status: "ok" as const,
        message: "Already signed in.",
        alreadyLoggedIn: true,
        user: {
          id: ctx.user.sub,
          username: ctx.user.name ?? ctx.user.email ?? ctx.user.sub,
          email: ctx.user.email,
          name: ctx.user.name
        },
        logoutUrl: "/login?action=logout",
        ...(next ? { nextUrl: next } : {})
      };
    }

    let firstAdminUrl: string | undefined;
    if (requiresFirstAdmin) {
      const host = ctx.headers.host;
      if (host) {
        const proto = ctx.headers["x-forwarded-proto"] ?? "http";
        const next = (ctx.query as { next?: string }).next;
        firstAdminUrl = `${proto}://${host}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      }
    }
    return {
      status: "ok" as const,
      message: "Submit username + password via POST to authenticate.",
      requiresFirstAdmin,
      ...(firstAdminUrl ? { firstAdminUrl } : {})
    };
  }
);

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema, query: QuerySchema },
  async (ctx) => {
    const runtime = runtimeFrom(ctx);
    const tenantId = ctx.tenant.id;
    const appId = ctx.app.id;

    const body = ctx.request as Infer<typeof RequestSchema>;
    const user = await runtime.userStore.authenticate(
      tenantId,
      appId,
      body.username,
      body.password
    );

    if (!user) {
      // Auth failures are 401, not 200-with-error-body.
      ctx.setStatus?.(401);
      return {
        status: "error" as const,
        message: "Invalid username or password."
      };
    }

    const issued = runtime.tokenIssuer.issueTokenPair({
      sub: user.id,
      tenantId: user.tenantId,
      appId,
      roles: user.roles,
      name: user.name ?? user.username,
      email: user.email,
      picture: user.picture
    });
    if (!issued.refreshToken) {
      throw new Error("Auth token issuer did not return a refresh token");
    }

    // Login is rendered in the theme's auth-only page state. After credentials
    // are stored, navigate the browser back to the tenant route so the normal
    // shell is rendered from a clean page request.
    const config = resolveDefaultAuthAppConfig(ctx.config);
    const next = body.next || (ctx.query as { next?: string }).next || config.loginRedirectPath || "/";
    ctx.responseHeaders?.set("HX-Redirect", next);
    // Auth state changed — reload this service's fragments (nav profile etc.).
    // Fragments listening on this key re-fetch; absent fragments ignore it.
    if (ctx.serviceId) {
      ctx.responseHeaders?.set("HX-Trigger", `bp:fragments:${ctx.serviceId}`);
    }
    // Expire the stored header with the ACCESS token, not the refresh token —
    // otherwise the client replays a dead JWT for days. The refresh token is
    // stored separately so the profile fragment can renew before expiry.
    ctx.bpHeaders?.set('Authorization', `Bearer ${issued.accessToken}`, {
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      locked: true,
      refreshPath: "/refresh",
      refreshBeforeSeconds: 60
    });
    ctx.bpHeaders?.set('X-BP-Refresh', issued.refreshToken, {
      expiresInSeconds: issued.refreshTokenExpiresInSeconds ?? runtime.refreshTokenSeconds,
      locked: true,
      scopeToOwner: true
    });

    return {
      status: "ok" as const,
      message: "logged in",
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresInSeconds: issued.accessTokenExpiresInSeconds,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name ?? user.username
      }
    };
  }
);
