import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { BPService } from "../src/service.js";
import { effectiveRouteAuth, hasRoutePermissions, signJwt, uuidv7 } from "@betterportal/framework";

test("navigation verifies tokens, scopes users, uses current grants and invalidates cached verification keys", async () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7();
  const auth = { serviceId, expectedIssuer: "https://auth.test", expectedAudience: "app", jwksUri: "https://auth.test/jwks",
    publicKeys: { keys: [{ ...keys.publicKey.export({ format: "jwk" }), kid: "nav", alg: "RS256", use: "sig" }] },
    roles: [{ id: "reader", title: "Reader", permissions: [{ serviceId, viewId: "batches", permissions: ["read"] }] }] };
  const route = { id: uuidv7(), viewId: "batches", serviceId, path: "/batches", enabled: true, operations: ["batches.read"],
    resolvedAuth: [{ operationId: "batches.read", method: "GET", auth: { required: true, permissions: [] } }] };
  const app = { id: appId, tenantId, auth, routes: [route] };
  const service = Object.create(BPService.prototype) as any;
  service.scopedConfig = { apps: [app], tenants: [{ id: tenantId, services: [{ id: serviceId, serviceId: "org.example.batches" }] }] };
  const token = (changes = {}) => signJwt({ privateKeyPem: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), kid: "nav",
    claims: { iss: auth.expectedIssuer, aud: auth.expectedAudience, sub: "user", tenantId, appId, roles: ["reader"],
      realm: "runtime", tokenType: "access", expiresInSeconds: 60, ...changes } });
  const project = (value?: string) => service.navigationAccess({ req: new Request("https://theme.test/", {
    headers: value ? { Authorization: "Bearer " + value } : {}
  }) }, app);
  const valid = token();
  assert.equal((await project(valid)).canAccess(route), true);
  const verifier = service.getJwtVerifier(tenantId, appId);
  assert.equal(service.getJwtVerifier(tenantId, appId), verifier);
  for (const invalid of [undefined, "invalid", token({ appId: uuidv7() }), token({ tenantId: uuidv7() }), token({ tokenType: "refresh" }), token({ roles: ["admin"] })]) {
    assert.equal((await project(invalid)).canAccess(route), false);
  }
  auth.roles = [];
  assert.equal((await project(valid)).canAccess(route), false, "unexpired tokens do not retain revoked role grants");
  assert.equal(service.getJwtVerifier(tenantId, appId), verifier, "role updates do not discard signing-key caches");
  const changedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  auth.publicKeys.keys = [{ ...changedKeys.publicKey.export({ format: "jwk" }), kid: "nav", alg: "RS256", use: "sig" }];
  assert.notEqual(service.getJwtVerifier(tenantId, appId), verifier);
  assert.equal((await project(valid)).user, undefined, "old keys cannot verify after a trusted snapshot change");
});


test("host permission ownership follows identity, selected operation and matched path", () => {
  const tenantId = uuidv7(), appId = uuidv7(), owner = uuidv7(), other = uuidv7();
  const pluginId = "org.example.batches";
  const claims = { tenantId, appId, roles: ["reader"] } as any;
  const auth = { roles: [{ id: "reader", permissions: [{ serviceId: other, viewId: "batches", permissions: ["read"] }] }] } as any;
  const operation = { operationId: "batches.read", auth: { required: true, permissions: [] } };
  const route = { viewId: "batches", path: "/a", methods: ["GET"], methodRoutes: { GET: operation } } as any;
  const app = { id: appId, tenantId, routes: [
    { serviceId: owner, viewId: "batches", enabled: true, operations: ["batches.read"], targetPath: "/a" },
    { serviceId: other, viewId: "batches", enabled: true, operations: ["batches.read"], targetPath: "/b" }
  ], slots: [], fragments: {} };
  const service = Object.create(BPService.prototype) as any;
  service.scopedConfig = { serviceIdentity: { id: owner }, m2m: { localServiceIds: [owner, other] }, apps: [app] };
  service.getJwtVerifier = () => ({ verify: async () => claims });
  service.getServiceTokenVerifier = () => undefined;
  service.getAppAuthConfig = () => auth;
  service.getServiceIdAliases = () => ({ [owner]: pluginId, [other]: pluginId });
  service.getPlatformRootAuthScope = () => undefined;
  const context = (path = "/a", method = "GET") => service.resolveAuthForRequest({
    __bpTenantId: tenantId, __bpAppId: appId, req: new Request("https://service.test" + path, { method })
  }, route);
  const allowed = () => {
    const current = context();
    return hasRoutePermissions(claims, effectiveRouteAuth({ required: true, permissions: [] },
      current.permissionServiceId ?? "", "batches", "GET"), current.appAuthConfig, current.serviceIdAliases);
  };
  assert.equal(context().permissionServiceId, owner);
  assert.equal(context("/a////").permissionServiceId, owner, "trailing separators retain the same owning path");
  assert.equal(allowed(), false, "another installation's grant cannot authorize the owning host");
  auth.roles[0].permissions[0].serviceId = owner;
  assert.equal(allowed(), true);
  assert.equal(context("/b").permissionServiceId, null, "a trusted identity cannot be replaced with another path's instance");
  delete service.scopedConfig.serviceIdentity;
  assert.equal(context().permissionServiceId, owner, "a unique matching operation/path resolves without an identity hint");
  app.routes[1].targetPath = "/a";
  assert.equal(context().permissionServiceId, null, "ambiguous ownership never falls back to plugin-wide authority");
  app.routes[1].operations = ["batches.create"];
  assert.equal(context().permissionServiceId, owner, "a different selected operation does not create ownership ambiguity");
  assert.equal(context("/a", "HEAD").permissionServiceId, owner);
});


test("shared hosts resolve only activations belonging to their trusted catalog identity", () => {
  const tenantId = uuidv7(), appId = uuidv7(), catalog = uuidv7(), activation = uuidv7(), other = uuidv7();
  const route = { viewId: "batches", path: "/a", methods: ["GET"], methodRoutes: { GET: { operationId: "batches.read", auth: { required: true, permissions: [] } } } };
  const app: any = { id: appId, tenantId, routes: [
    { serviceId: activation, viewId: "batches", enabled: true, operations: ["batches.read"], targetPath: "/a" },
    { serviceId: other, viewId: "batches", enabled: true, operations: ["batches.read"], targetPath: "/b" }
  ], slots: [], fragments: {} };
  const service = Object.create(BPService.prototype) as any;
  service.scopedConfig = { serviceIdentity: { id: catalog }, m2m: { localServiceIds: [catalog, activation, other] }, apps: [app],
    tenants: [{ id: tenantId, services: [
      { id: activation, enabled: true, serviceId: "org.example.batches", sharedServiceId: catalog },
      { id: other, enabled: true, serviceId: "org.example.batches", sharedServiceId: uuidv7() }
    ] }] };
  service.getJwtVerifier = () => ({ verify: async () => ({}) });
  service.getServiceTokenVerifier = () => undefined;
  service.getAppAuthConfig = () => undefined;
  service.getServiceIdAliases = () => ({});
  service.getPlatformRootAuthScope = () => undefined;
  const context = (path: string, accept = "application/json") => service.resolveAuthForRequest({ __bpTenantId: tenantId, __bpAppId: appId,
    req: new Request("https://service.test" + path, { headers: { Accept: accept } }) }, route);
  assert.equal(context("/a").permissionServiceId, activation);
  assert.equal(context("/b").permissionServiceId, null, "a shared host cannot own another catalog's activation");
  service.scopedConfig.tenants[0].services[1].sharedServiceId = catalog;
  assert.equal(context("/b").permissionServiceId, other);
  app.slots = [{ serviceId: other, viewId: "batches", enabled: true }];
  app.fragments = { nav: [{ serviceId: other, fragmentId: "badge", targetPath: "/a", enabled: true }] };
  assert.equal(context("/a").permissionServiceId, activation, "an alternate slot or fragment cannot obscure a selected page owner");
  assert.equal(context("/a?_f=nav.badge", "text/html").permissionServiceId, other);
  assert.equal(context("/a", "text/html; fragment=nav.badge").permissionServiceId, other);
  assert.equal(context("/a?_f=nav.badge").permissionServiceId, activation, "JSON requests retain the page owner");
  assert.equal(context("/a?_f=nav.missing", "text/html").permissionServiceId, activation, "a page may render its own unmounted fragment");
  app.routes[1].targetPath = "/a";
  assert.equal(context("/a").permissionServiceId, null, "two matching activations remain ambiguous");
  app.routes = [];
  assert.equal(context("/a").permissionServiceId, other, "slots are considered when no selected page owner exists");
  app.slots = [];
  assert.equal(context("/a").permissionServiceId, null, "fragment bindings require an explicit fragment request");
  assert.equal(context("/a?_f=nav.badge", "text/html").permissionServiceId, other);
});
