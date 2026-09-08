// Requests pass through the real Node H3 operation policy; no copied role checks.
import * as av from "anyvali";
import { createBetterPortalApp } from "../nodejs/lib/runtime/h3.js";
import { createH3Router } from "../nodejs/lib/adapters/h3.js";
import { verifyJwt } from "../nodejs/lib/runtime/auth/tokens.js";
import { authorizeServiceToken } from "../nodejs/lib/runtime/auth/serviceToken.js";
import { ApiAuthRequirementSchema } from "../nodejs/lib/contracts/route.js";

export async function authorization(body) {
  const app = createBetterPortalApp();
  const auth = ApiAuthRequirementSchema.parse(body.requirement);
  const viewId = body.viewId;
  const method = body.method;
  const handler = ctx => ({ mode: ctx.callerMode ?? null, user: ctx.user?.sub ?? null, service: ctx.serviceCaller?.claims?.iss ?? null });
  const schemas = { response: av.object({ mode: av.nullable(av.string()), user: av.nullable(av.string()), service: av.nullable(av.string()) }) };
  const route = { viewId, path: "/check", methods: [method], paramNames: [], schemas, handlers: { [method]: handler },
    methodRoutes: { [method]: { method, operationId: "check", title: "Check", description: "", schemas, handler, auth, cacheHints: {}, demoScenarios: [] } },
    title: "Check", description: "", auth, cacheHints: {}, demoScenarios: [], renderers: {} };
  const context = body.context;
  createH3Router({ routes: [route] }, app, {
    resolveContext: () => ({ tenant: { id: context.tenantId, slug: "tenant", title: "Tenant", services: [], activatedPlatformServices: [] },
      app: { id: context.appId, slug: "app", title: "App", hostnames: ["service.test"], routes: [{ viewId, operations: ["check"], targetPath: "/check" }],
        fragments: {}, slots: [], shell: { renderer: "test" } } }),
    resolveAuth: () => ({ tenantId: context.tenantId, appId: context.appId, appAuthConfig: context.appAuth,
      serviceIdAliases: context.serviceAliases, platformRoot: context.managementScope,
      verifier: context.appAuth && body.userKey ? { verify: token => verifyJwt(token, {
        expectedIssuer: context.appAuth.expectedIssuer, expectedAudience: context.appAuth.expectedAudience, expectedTokenType: "access",
        keyResolver: async kid => { if (kid !== body.userKey.kid) throw new Error("Unknown key"); return body.userKey.publicKeyPem; }
      }) } : undefined,
      serviceVerifier: context.servicePolicy ? { verify: (token, scope) => authorizeServiceToken(token, { ...scope, policy: context.servicePolicy, clockToleranceSeconds: 0 }) } : undefined })
  });
  const response = await app.fetch(new Request("http://service.test/check", { method, headers: { accept: "application/json", ...body.headers } }));
  return { status: response.status, ...(response.status === 200 ? { output: await response.json() } : {}) };
}
