import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
} from "@betterportal/framework";
import type { AuthRuntime } from "../../index.js";

export const QuerySchema = av.object({
  next: av.optional(av.string()).describe("The view path to pass through to login after first-admin registration.")
}, { unknownKeys: "strip" });
export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({
  username: av.string().minLength(1).describe("Username for the first admin account."),
  password: av.string().minLength(8).describe("Password for the first admin account."),
  email: av.optional(av.string()).describe("Email address for the first admin account."),
  name: av.optional(av.string()).describe("Display name for the first admin account.")
}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const).describe("Registration request outcome."),
  message: av.optional(av.string()).describe("Human-readable status or error message for the renderer."),
  user: av.optional(av.object({
    id: av.string().describe("Stable UUIDv7 user id."),
    username: av.string().describe("Created account username."),
    isFirstAdmin: av.bool().describe("True when this account is the deployment's first admin.")
  }, { unknownKeys: "strip" }).describe("Created first-admin user summary.")),
  // GET state for the theme renderer: registrations are closed once any user
  // exists; loginUrl (self-origin, absolute) is where the renderer sends the
  // browser in that case - and after a successful first-admin creation.
  registrationOpen: av.optional(av.bool()).describe("True while the auth service has zero users; once false, the renderer should send the browser to login."),
  loginUrl: av.optional(av.string()).describe("Absolute self-origin URL of this auth service's login view, used when registration is closed and after successful first-admin creation.")
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Register First Admin";
export const description = "Open registration for the very first user. Once any user exists, this endpoint requires admin auth.";

export const role = "auth.register";
export const dependencies = ["login.index"];
export const chrome: BetterPortalRouteChrome = { fullScreen: true };

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

/** Self-origin absolute URL for a path, derived from the request Host header. */
function runtimeFrom(ctx: { plugin?: unknown }): AuthRuntime {
  const runtime = (ctx.plugin as { runtime?: AuthRuntime } | undefined)?.runtime;
  if (!runtime) throw new Error("Auth runtime not available on handler context");
  return runtime;
}

function selfUrl(ctx: { headers: Record<string, string> }, path: string, next?: string): string | undefined {
  const host = ctx.headers.host;
  if (!host) return undefined;
  const proto = ctx.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${host}${path}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => {
    const runtime = runtimeFrom(ctx);
    const next = (ctx.query as { next?: string }).next;
    return {
      status: "ok" as const,
      registrationOpen: runtime.userStore.hasNoUsers(),
      loginUrl: selfUrl(ctx, "/login", next)
    };
  }
);

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema, query: QuerySchema },
  async (ctx) => {
    const runtime = runtimeFrom(ctx);
    const tenantId = ctx.tenant.id;
    const appId = ctx.app.id;

    if (!runtime.userStore.hasNoUsers()) {
      // Registration is closed once any user exists. Respond 404 so the route
      // appears not to exist (no user-enumeration surface).
      ctx.setStatus?.(404);
      return {
        status: "error" as const,
        message: ""
      };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    try {
      const created = await runtime.userStore.createUser({
        username: body.username,
        password: body.password,
        email: body.email,
        name: body.name,
        tenantId,
        appRoles: { [appId]: ["admin"] }
      });
      return {
        status: "ok" as const,
        message: "First admin created.",
        user: {
          id: created.id,
          username: created.username,
          isFirstAdmin: true
        },
        // For the themed success view: where to send the browser to sign in.
        loginUrl: selfUrl(ctx, "/login", (ctx.query as { next?: string }).next)
      };
    } catch (err) {
      ctx.setStatus?.(400);
      return {
        status: "error" as const,
        message: (err as Error).message
      };
    }
  }
);
