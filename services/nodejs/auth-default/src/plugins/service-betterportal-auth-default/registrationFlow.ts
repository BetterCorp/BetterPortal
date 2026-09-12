import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  type ApiAuthRequirement,
  type CacheHints,
  type BetterPortalRouteChrome
} from "@betterportal/framework";
import { createHandler } from "./.bp-generated/route-runtime.js";

export const QuerySchema = av.object({
  next: av.optional(av.string()).describe("The view path to pass through to login after first-admin registration.")
});
export const HeadersSchema = av.object({});

export const RequestSchema = av.object({
  setupToken: av.optional(av.string()),
  username: av.string().minLength(1).describe("Username for the account."),
  password: av.string().minLength(12).describe("Password for the first admin account."),
  email: av.optional(av.string()).describe("Email address for the first admin account."),
  name: av.optional(av.string()).describe("Display name for the first admin account.")
});

export const ResponseSchema = av.object({
  status: av.enum_(["ok", "error"] as const).describe("Registration request outcome."),
  message: av.optional(av.string()).describe("Human-readable status or error message for the renderer."),
  user: av.optional(av.object({
    id: av.string().describe("Stable UUIDv7 user id."),
    username: av.string().describe("Created account username."),
    isFirstAdmin: av.bool().describe("True when this account is the deployment's first admin.")
  }).describe("Created first-admin user summary.")),
  // GET state for the theme renderer: registration closes after management
  // bootstrap; loginUrl (self-origin, absolute) is where the renderer sends the
  // browser in that case - and after a successful first-admin creation.
  registrationOpen: av.optional(av.bool()).describe("True while management bootstrap is incomplete; once false, the renderer should send the browser to login."),
  loginUrl: av.optional(av.string()).describe("Absolute self-origin URL of this auth service's login view, used when registration is closed and after successful first-admin creation.")
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Register First Admin";
export const description = "Open registration for the very first user. Once any user exists, this endpoint requires admin auth.";

export const role = "auth.register";
export const dependencies = [
  { operationId: "auth.register", method: "POST" },
  { operationId: "auth.login.view", method: "GET" }
] as const;
export const chrome: BetterPortalRouteChrome = { fullScreen: true };

export const auth: ApiAuthRequirement = {
  required: false,
  permissions: []
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: []
};

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  async (ctx) => {
    const runtime = ctx.plugin.runtime;
    const next = (ctx.query as { next?: string }).next;
    const query = next ? { next } : undefined;
    return {
      status: "ok" as const,
      registrationOpen: runtime.isManagement({ tenantId: ctx.tenant.id, appId: ctx.app.id }) && await runtime.identity.bootstrapAvailable({ tenantId: ctx.tenant.id, appId: ctx.app.id }),
      loginUrl: ctx.routeUrl?.("login.index", { absolute: true, query })
        ?? ctx.routeUrl?.("login.index", { query })
        ?? undefined
    };
  }
);

export const handlePost = createHandler(
  { response: ResponseSchema, request: RequestSchema, query: QuerySchema },
  async (ctx) => {
    const runtime = ctx.plugin.runtime;
    const tenantId = ctx.tenant.id;
    const appId = ctx.app.id;

    const scope = { tenantId, appId };
    if (!runtime.isManagement(scope) || !await runtime.identity.bootstrapAvailable(scope)) {
      // Registration closes once management bootstrap completes. Respond 404 so the route
      // appears not to exist (no user-enumeration surface).
      ctx.setStatus?.(404);
      return {
        status: "error" as const,
        message: ""
      };
    }

    const body = ctx.request as Infer<typeof RequestSchema>;
    try {
      await runtime.identity.rateLimit(scope, "bootstrap", "setup", 10);
      if (!runtime.verifySetup(body.setupToken ?? "")) throw new Error("Enter the deployment setup token.");
      const created = await runtime.identity.createUser(scope, await runtime.policy(scope), { username: body.username, password: body.password, email: body.email, name: body.name }, ["*"], true);
      const next = (ctx.query as { next?: string }).next;
      const query = next ? { next } : undefined;
      return {
        status: "ok" as const,
        message: "First admin created.",
        user: {
          id: created.id,
          username: created.username,
          isFirstAdmin: true
        },
        // For the themed success view: where to send the browser to sign in.
        loginUrl: ctx.routeUrl?.("login.index", { absolute: true, query })
          ?? ctx.routeUrl?.("login.index", { query })
          ?? undefined
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
