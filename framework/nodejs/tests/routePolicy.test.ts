import assert from "node:assert/strict";
import test from "node:test";
import * as av from "anyvali";
import { createNavigationAccess, effectiveRouteAuth, hasRoutePermissions } from "../src/runtime/auth/routePolicy.js";
import { createStreamHandler } from "../src/runtime/streamHandler.js";
import { createH3Router } from "../src/adapters/h3.js";
import { createBetterPortalApp } from "../src/runtime/h3.js";
import { uuidv7 } from "../src/runtime/uuid.js";
import type { AppAuthConfig, JwtClaims } from "../src/contracts/auth.js";
import type { BetterPortalApp, BetterPortalRouteMount } from "../src/contracts/platformConfig.js";
import type { RegisteredRoute } from "../src/contracts/registry.js";

const serviceId = uuidv7(), tenantId = uuidv7(), appId = uuidv7();
const claims = { iss: "https://auth.test", aud: "app", sub: "user", tenantId, appId, roles: ["reader"], tokenType: "access",
  realm: "runtime", iat: 1, exp: 9999999999, jti: uuidv7() } satisfies JwtClaims;
const auth = { required: true, permissions: [] };
function appAuth(permissions: AppAuthConfig["roles"][number]["permissions"]): AppAuthConfig {
  return { serviceId, expectedIssuer: claims.iss, expectedAudience: claims.aud, jwksUri: "https://auth.test/jwks",
    roleClaimPath: "roles", roles: [{ id: "reader", title: "Reader", permissions }] };
}
const baseline = { serviceId, viewId: "batches", permissions: ["read" as const] };

test("empty additional requirements retain the baseline and cannot substitute another grant", () => {
  const effective = effectiveRouteAuth(auth, serviceId, "batches", "GET");
  assert.equal(hasRoutePermissions(claims, effective, appAuth([])), false);
  assert.equal(hasRoutePermissions(claims, effective, appAuth([baseline])), true);
  const extra = { serviceId, viewId: "approval", permissions: ["update" as const] };
  const combined = effectiveRouteAuth({ ...auth, permissions: [extra] }, serviceId, "batches", "GET");
  assert.equal(hasRoutePermissions(claims, combined, appAuth([extra])), false);
  assert.equal(hasRoutePermissions(claims, combined, appAuth([baseline])), false);
  assert.equal(hasRoutePermissions(claims, combined, appAuth([baseline, extra])), true);
  assert.deepEqual(auth.permissions, []);
});

test("every HTTP operation enforces its own grant before invoking its handler", async () => {
  for (const [method, action] of [["GET", "read"], ["POST", "create"], ["PUT", "update"], ["PATCH", "update"], ["DELETE", "delete"]] as const) {
    let calls = 0;
    let grants: AppAuthConfig["roles"][number]["permissions"] = [];
    const otherServiceId = uuidv7();
    const handler = () => { calls++; return { ok: true }; };
    const schemas = { response: av.object({ ok: av.bool() }) };
    const route = { viewId: "batches", path: "/batches", paramNames: [], methods: [method], schemas, handlers: { [method]: handler },
      methodRoutes: { [method]: { method, operationId: "batches.action", title: "Batches", description: "", schemas, handler,
        auth, cacheHints: {}, demoScenarios: [] } }, title: "Batches", description: "", auth, cacheHints: {}, demoScenarios: [], renderers: {} } as RegisteredRoute;
    const server = createBetterPortalApp();
    createH3Router({ routes: [route] }, server, { serviceId: "org.example.batches",
      resolveContext: () => ({ tenant: { id: tenantId, slug: "test", title: "Test", active: true, branding: {}, services: [], activatedPlatformServices: [] },
        app: { id: appId, tenantId, routes: [{ serviceId, viewId: "batches", enabled: true, operations: ["batches.action"] }], slots: [], fragments: {} } as unknown as BetterPortalApp }),
      resolveAuth: () => ({ tenantId, appId, permissionServiceId: serviceId,
        serviceIdAliases: { [serviceId]: "org.example.batches", [otherServiceId]: "org.example.batches" }, verifier: { verify: async () => claims }, appAuthConfig: appAuth(grants) }) });
    const request = () => server.fetch(new Request("https://service.test/batches", { method, headers: { Authorization: "Bearer test", Accept: "application/json" } }));
    assert.equal((await request()).status, 403);
    assert.equal(calls, 0);
    grants = [{ serviceId: otherServiceId, viewId: "batches", permissions: [action] }];
    assert.equal((await request()).status, 403, "another installation of the same plugin cannot grant access");
    grants = [{ serviceId, viewId: "batches", permissions: [action] }];
    assert.equal((await request()).status, 200);
    assert.equal(calls, 1);
    grants = [];
    assert.equal((await request()).status, 403);
    assert.equal(calls, 1);
  }
});

test("navigation projects the selected operation, verified app scope and current role grants", () => {
  const route = { id: uuidv7(), kind: "page", path: "/batches", serviceId, viewId: "batches", enabled: true,
    operations: ["batches.read", "batches.delete"], resolvedAuth: [
      { operationId: "batches.read", method: "GET", auth: { ...auth, callers: ["user"] } },
      { operationId: "batches.delete", method: "DELETE", auth: { ...auth, callers: ["user"] } }
    ] } satisfies BetterPortalRouteMount;
  const app = { id: appId, tenantId, auth: appAuth([baseline]) } as BetterPortalApp;
  const access = createNavigationAccess(app, claims);
  assert.equal(access.canAccess(route), true);
  assert.equal(access.canAccess(route, "DELETE"), false);
  assert.equal(createNavigationAccess(app, undefined).canAccess(route), false);
  assert.equal(createNavigationAccess(app, { ...claims, appId: uuidv7() }).canAccess(route), false);
  assert.equal(access.canAccess({ ...route, resolvedAuth: undefined }), false);
  assert.equal(access.canAccess({ ...route, operations: ["not-selected"] }), false);
  assert.equal(access.canAccess({ ...route, enabled: false }), false);
  app.auth = appAuth([]);
  assert.equal(createNavigationAccess(app, claims).canAccess(route), false);
  const publicRoute = { ...route, resolvedAuth: [{ operationId: "batches.read", method: "GET" as const,
    auth: { required: false, permissions: [], callers: ["user" as const] } }] };
  assert.equal(createNavigationAccess(app, undefined).canAccess(publicRoute), true);
  assert.equal(access.canAccess({ ...route, resolvedAuth: [{ operationId: "batches.read", method: "GET", auth: { ...auth, callers: ["service"] } }] }), false);
});

test("management root is scoped and another instance's grant cannot authorize navigation", () => {
  const effective = effectiveRouteAuth(auth, serviceId, "batches", "GET");
  const root = { ...claims, roles: ["*"] };
  assert.equal(hasRoutePermissions(root, effective, appAuth([])), false);
  assert.equal(hasRoutePermissions(root, effective, appAuth([]), {}, { tenantId, appId }), true);
  assert.equal(hasRoutePermissions(root, effective, appAuth([]), {}, { tenantId, appId: uuidv7() }), false);
  assert.equal(hasRoutePermissions(claims, effective, appAuth([{ ...baseline, serviceId: uuidv7() }])), false);
});


test("hosting binding identity keeps same-plugin grants scoped to the owning instance", async () => {
  const otherId = uuidv7();
  const effective = effectiveRouteAuth(auth, serviceId, "batches", "GET");
  const aliases = { [serviceId]: "org.example.batches", [otherId]: "org.example.batches" };
  assert.equal(hasRoutePermissions(claims, effective, appAuth([{ ...baseline, serviceId: otherId }]), aliases), false);
  assert.equal(hasRoutePermissions(claims, effective, appAuth([baseline]), aliases), true);
  assert.equal(hasRoutePermissions(claims, effective, appAuth([{ ...baseline, serviceId: "org.example.batches" }]), aliases), false,
    "a plugin-wide grant cannot satisfy the concrete baseline even in an unparsed custom host context");
});

test("fragment-only navigation evaluates its own synced GET policy", () => {
  const app = { id: appId, tenantId, auth: appAuth([baseline]) } as BetterPortalApp;
  const fragment = { serviceId, fragmentId: "card", targetPath: "/batches", enabled: true,
    resolvedPolicy: { viewId: "batches", operationId: "batches.read", auth } };
  assert.equal(createNavigationAccess(app, claims).canAccessFragment(fragment), true);
  assert.equal(createNavigationAccess(app, undefined).canAccessFragment(fragment), false);
  assert.equal(createNavigationAccess(app, claims).canAccessFragment({ ...fragment, resolvedPolicy: undefined }), false);
  assert.equal(createNavigationAccess(app, claims).canAccessFragment({ ...fragment, enabled: false }), false);
  assert.equal(createNavigationAccess(app, claims).canAccessFragment({ ...fragment, serviceId: uuidv7() }), false);
  assert.equal(createNavigationAccess(app, claims).canAccessFragment({ ...fragment,
    resolvedPolicy: { ...fragment.resolvedPolicy, auth: { required: false, permissions: [], callers: ["service"] } } }), false);
  assert.equal(createNavigationAccess(app, undefined).canAccessFragment({ ...fragment,
    resolvedPolicy: { ...fragment.resolvedPolicy, auth: { required: false, permissions: [] } } }), true);
  app.auth = appAuth([]);
  assert.equal(createNavigationAccess(app, claims).canAccessFragment(fragment), false);
});


test("generated SSE streams require elevation before any handler effects", async () => {
  const now = Math.floor(Date.now() / 1000);
  let user: JwtClaims = { ...claims, iat: now, exp: now + 300 };
  let effects = 0;
  const handler = createStreamHandler({ item: av.string() }, async function* () { effects++; yield "row"; });
  const requirement = { required: true, permissions: [], callers: ["user", "service"], elevation: { minimum: "mfa", maxAgeSeconds: 300 } };
  const operation = { operationId: "feed.read", method: "GET", title: "Feed", description: "", auth: requirement,
    handler, schemas: { response: handler.responseSchema }, cacheHints: {}, demoScenarios: [] };
  const route = { viewId: "feed", path: "/feed", paramNames: [], methods: ["GET"], handlers: { GET: handler },
    methodRoutes: { GET: operation }, schemas: operation.schemas, renderers: {}, auth: requirement, title: "Feed", description: "" } as unknown as RegisteredRoute;
  const server = createBetterPortalApp();
  createH3Router({ routes: [route] }, server, { serviceId,
    resolveContext: () => ({ tenant: { id: tenantId, slug: "t", title: "T", active: true, branding: {}, services: [], activatedPlatformServices: [] },
      app: { id: appId, tenantId, routes: [{ serviceId, viewId: "feed", enabled: true, operations: ["feed.read"] }], slots: [], fragments: {} } as unknown as BetterPortalApp }),
    resolveAuth: () => ({ tenantId, appId, permissionServiceId: serviceId, verifier: { verify: async () => user },
      serviceVerifier: { verify: async () => ({ aud: serviceId }) } as any,
      appAuthConfig: appAuth([{ serviceId, viewId: "feed", permissions: ["read"] }]) }) });
  const request = (headers: Record<string, string> = { Authorization: "Bearer user" }) => server.fetch(new Request("https://service.test/feed/__sse", { headers: { Accept: "text/event-stream", ...headers } }));
  const denied = await request();
  assert.equal(denied.status, 401);
  assert.ok(denied.headers.get("BP-Auth-Challenge"));
  assert.equal(effects, 0);
  const token = `${Buffer.from(JSON.stringify({ typ: "BP-S2S-JWT" })).toString("base64url")}.e30.signature`;
  const machine = await request({ Authorization: "Bearer " + token, "x-bp-service-id": uuidv7(), "x-bp-tenant-id": tenantId, "x-bp-app-id": appId });
  assert.equal(machine.status, 403);
  assert.equal(effects, 0);
  user = { ...user, elevation: { assurance: "mfa", verifiedAt: now, expiresAt: now + 60 } };
  const allowed = await request();
  assert.equal(allowed.status, 200);
  assert.match(await allowed.text(), /row/);
  assert.equal(effects, 1);
});

test("machine audiences must match the trusted owning installation even on optional routes", async () => {
  let audience = uuidv7(), effects = 0;
  let owner: string | null = serviceId;
  const source = uuidv7();
  const handler = () => { effects++; return { ok: true }; };
  const requirement = { required: false, callers: ["service"], permissions: [] };
  const schemas = { response: av.object({ ok: av.bool() }) };
  const route = { viewId: "check", path: "/check", paramNames: [], methods: ["GET"], schemas, handlers: { GET: handler },
    methodRoutes: { GET: { operationId: "check.read", method: "GET", title: "Check", description: "", auth: requirement,
      schemas, handler, cacheHints: {}, demoScenarios: [] } }, renderers: {}, title: "Check", description: "", auth: requirement } as unknown as RegisteredRoute;
  const server = createBetterPortalApp();
  createH3Router({ routes: [route] }, server, { serviceId,
    resolveContext: () => ({ tenant: { id: tenantId, slug: "t", title: "T", active: true, branding: {}, services: [], activatedPlatformServices: [] },
      app: { id: appId, tenantId, routes: [{ serviceId, viewId: "check", enabled: true, operations: ["check.read"] }], slots: [], fragments: {} } as unknown as BetterPortalApp }),
    resolveAuth: () => ({ tenantId, appId, permissionServiceId: owner, serviceVerifier: { verify: async () => ({ aud: audience }) } as any }) });
  const token = `${Buffer.from(JSON.stringify({ typ: "BP-S2S-JWT" })).toString("base64url")}.e30.signature`;
  const request = () => server.fetch(new Request("https://service.test/check", { headers: { Accept: "application/json", Authorization: "Bearer " + token,
    "x-bp-service-id": source, "x-bp-tenant-id": tenantId, "x-bp-app-id": appId } }));
  assert.equal((await request()).status, 403);
  assert.equal(effects, 0);
  audience = serviceId;
  assert.equal((await request()).status, 200);
  assert.equal(effects, 1);
  owner = null;
  assert.equal((await request()).status, 403);
  assert.equal(effects, 1);
});
