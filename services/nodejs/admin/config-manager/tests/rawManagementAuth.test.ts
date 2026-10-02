import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BetterPortalConfigSchema, createBetterPortalApp, generateKeyPair, publicKeyToJwk, signJwt, uuidv7,
  type BetterPortalConfig
} from "@betterportal/framework";
import { registerRawManagementAccessControl } from "../src/plugins/service-betterportal-config-manager/accessControl.js";
import { registerAdminApiRoutes } from "../src/plugins/service-betterportal-config-manager/adminApi.js";
import { registerMenuEditorRoutes } from "../src/plugins/service-betterportal-config-manager/menuEditor.js";
import { issueBootstrapAdminToken } from "../src/plugins/service-betterportal-config-manager/bootstrapAccess.js";
import type { CpBootstrapState } from "../src/plugins/service-betterportal-config-manager/cpBootstrap.js";
import { registerSetupEndpoints } from "../src/plugins/service-betterportal-config-manager/setupTokens.js";
import { BaseStorage } from "../src/plugins/service-betterportal-config-manager/storage/core.js";

class MemoryStorage extends BaseStorage {
  saves = 0;
  constructor(public config: BetterPortalConfig) { super(); }
  async loadConfig() { return this.config; }
  async saveConfig(config: BetterPortalConfig) { this.saves++; this.config = config; }
}

function fixture() {
  const tenantId = uuidv7(), appId = uuidv7(), otherTenantId = uuidv7(), otherAppId = uuidv7();
  const serviceId = uuidv7(), authServiceId = uuidv7();
  const authKey = generateKeyPair(), cpKey = generateKeyPair();
  const auth = {
    serviceId: authServiceId,
    expectedIssuer: "https://auth.example",
    expectedAudience: "betterportal-runtime",
    jwksUri: "https://auth.example/.well-known/jwks.json",
    publicKeys: { keys: [publicKeyToJwk(authKey.publicKeyPem, authKey.kid)] },
    roles: [
      { id: "editor", title: "Editor", permissions: [{ serviceId, viewId: "config.index", permissions: ["read", "update"] }] },
      { id: "menu-reader", title: "Menu reader", permissions: [{ serviceId, viewId: "menu.index", permissions: ["read"] }] },
      { id: "menu-editor", title: "Menu editor", permissions: [{ serviceId, viewId: "menu.index", permissions: ["read", "create", "update", "delete"] }] },
      { id: "routes-reader", title: "Routes reader", permissions: [{ serviceId, viewId: "routes.index", permissions: ["read"] }] }
    ]
  };
  const config = BetterPortalConfigSchema.parse({
    configManagement: { adminTenantId: tenantId, managementAppId: appId },
    tenants: [
      { id: tenantId, slug: "admin", title: "Admin", active: true, services: [{ id: serviceId, hostname: "https://config.example", serviceId: "org.betterportal.config-manager", createdAt: new Date().toISOString() }] },
      { id: otherTenantId, slug: "other", title: "Other", active: true }
    ],
    sharedServiceCatalog: [{ id: "org.betterportal.auth.default", serviceId: "org.betterportal.auth.default",
      title: "Auth", baseUrl: "https://auth.example", apiKeyHash: "", enabled: true }],
    sharedServiceActivations: [{ id: uuidv7(), tenantId, sharedServiceId: "org.betterportal.auth.default",
      activatedAt: new Date().toISOString(), enabled: true }],
    apps: [
      { id: appId, tenantId, slug: "admin", title: "Admin", hostnames: ["admin.example"], auth },
      { id: otherAppId, tenantId: otherTenantId, slug: "other", title: "Other", hostnames: ["other.example"], auth }
    ]
  });
  const storage = new MemoryStorage(config);
  const cpState: CpBootstrapState = {
    keyPair: cpKey, jwk: publicKeyToJwk(cpKey.publicKeyPem, cpKey.kid),
    issuer: "https://config.example", audience: "betterportal-cp", cpId: "test-cp",
    jwksUri: "https://config.example/.well-known/jwks.json"
  };
  const app = createBetterPortalApp();
  registerRawManagementAccessControl(app, storage, cpState);
  registerAdminApiRoutes(app, storage, cpState);
  registerMenuEditorRoutes(app, storage);
  registerSetupEndpoints({ app, storage, cpState });
  const token = (scopeAppId: string, scopeTenantId: string, roles: string[] = ["*"]) => signJwt({
    privateKeyPem: authKey.privateKeyPem, kid: authKey.kid,
    claims: { iss: auth.expectedIssuer, aud: auth.expectedAudience, expiresInSeconds: 300,
      sub: "user-1", realm: "runtime", tenantId: scopeTenantId, appId: scopeAppId,
      roles, tokenType: "access" }
  });
  const send = (path: string, method = "GET", body?: object, authorization?: string) =>
    app.fetch(new Request(`https://config.example${path}`, {
      method, headers: { ...(body ? { "Content-Type": "application/json" } : {}),
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }));
  const sendForm = (path: string, fields: Record<string, string>, authorization: string) =>
    app.fetch(new Request(`https://config.example${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${authorization}` }, body: new URLSearchParams(fields)
    }));
  return { appId, tenantId, otherAppId, otherTenantId, storage, cpState, token, send, sendForm };
}

test("anonymous raw admin API cannot disclose config or mint platform service keys", async () => {
  const { send, storage } = fixture();
  assert.equal((await send("/.well-known/bp/admin/config")).status, 401);
  const create = await send("/.well-known/bp/admin/platform-services", "POST", { hostname: "https://attacker.example" });
  assert.equal(create.status, 401);
  assert.equal(storage.saves, 0);
  assert.equal(storage.config.platformServices.length, 0);
  for (const path of [
    "/.well-known/bp/%61dmin/config",
    "/.well-known/bp/admin%2fconfig",
    "/.well-known/bp/admin//config"
  ]) {
    const response = await send(path);
    assert.ok(response.status === 401 || response.status === 404, `${path}: ${response.status}`);
  }
});

test("anonymous tenant management cannot change theme, and wrong-app tokens cannot cross scope", async () => {
  const { send, storage, appId, otherAppId, otherTenantId, token } = fixture();
  const path = `/.well-known/bp/manage/theme?appId=${appId}`;
  assert.equal((await send(path, "POST", { mode: "dark" })).status, 401);
  assert.equal((await send(path, "POST", { mode: "dark" }, token(otherAppId, otherTenantId))).status, 401);
  assert.equal(storage.saves, 0);
  assert.equal(storage.config.apps[0].themeConfig.mode, "light");
});

test("verified management JWT authorizes root admin and app-scoped role grants", async () => {
  const { send, storage, appId, tenantId, token } = fixture();
  assert.deepEqual(storage.config.apps[0].auth?.roles[0]?.permissions[0]?.serviceId, storage.config.tenants[0].services[0].id);
  const root = token(appId, tenantId);
  assert.equal((await send("/.well-known/bp/admin/config", "GET", undefined, root)).status, 200);
  assert.equal((await send("/.well-known/bp/admin/config", "GET", undefined, token(appId, tenantId, ["editor"]))).status, 403);
  const created = await send("/.well-known/bp/admin/platform-services", "POST", { hostname: "https://service.example" }, root);
  assert.equal(created.status, 201, await created.text());
  assert.equal(storage.config.platformServices.length, 1);
  const changed = await send(`/.well-known/bp/manage/theme?appId=${appId}`, "POST", { mode: "dark" }, token(appId, tenantId, ["editor"]));
  assert.equal(changed.status, 200, await changed.text());
  assert.equal(storage.config.apps[0].themeConfig.mode, "dark");
});

test("delegated menu editor can use raw editor APIs only for granted actions", async () => {
  const { send, sendForm, storage, appId, tenantId, token } = fixture();
  const reader = token(appId, tenantId, ["menu-reader"]);
  const editor = token(appId, tenantId, ["menu-editor"]);
  assert.equal((await send(`/.well-known/bp/admin/menu-editor?appId=${appId}`, "GET", undefined, reader)).status, 200);
  assert.equal((await sendForm("/.well-known/bp/admin/menu-editor/add", { appId, type: "group", title: "Group" }, reader)).status, 403);
  assert.equal(storage.config.apps[0].menu.length, 0);
  assert.equal((await sendForm("/.well-known/bp/admin/menu-editor/add", { appId, type: "group", title: "Group" }, editor)).status, 200);
  assert.equal(storage.config.apps[0].menu.length, 1);
  assert.equal((await sendForm("/.well-known/bp/admin/menu-editor/remove", { appId, itemId: storage.config.apps[0].menu[0].id }, editor)).status, 200);
  assert.equal(storage.config.apps[0].menu.length, 0);
  assert.equal((await send("/.well-known/bp/admin/config", "GET", undefined, editor)).status, 403);
  assert.equal((await send("/.well-known/bp/admin/platform-services", "POST", { hostname: "https://attacker.example" }, editor)).status, 403);
});

test("delegated route reader cannot mutate routes", async () => {
  const { send, appId, tenantId, token } = fixture();
  const reader = token(appId, tenantId, ["routes-reader"]);
  assert.equal((await send(`/.well-known/bp/admin/apps/${appId}/routes`, "GET", undefined, reader)).status, 200);
  assert.equal((await send(`/.well-known/bp/admin/apps/${appId}/routes`, "POST", { path: "/evil" }, reader)).status, 403);
});

test("bootstrap capability permits only first-install and admin role creation", async () => {
  const { send, appId, tenantId, otherAppId, cpState } = fixture();
  const capability = await issueBootstrapAdminToken(cpState, tenantId, appId);
  assert.equal((await send("/.well-known/bp/admin/config", "GET", undefined, capability)).status, 401);
  assert.equal((await send("/.well-known/bp/admin/platform-services", "POST", { hostname: "https://attacker.example" }, capability)).status, 401);
  assert.equal((await send(`/.well-known/bp/admin/apps/${otherAppId}/auth/roles`, "POST", { id: "evil", title: "Evil" }, capability)).status, 401);
  assert.equal((await send("/.well-known/bp/admin/services/begin-install", "POST", { serviceUrl: "https://evil.example", tenantId, appId, sharedServiceId: "org.betterportal.auth.default" }, capability)).status, 403);
  assert.equal((await send("/.well-known/bp/admin/services/begin-install", "POST", { serviceUrl: "https://auth.example", tenantId, appId: otherAppId, sharedServiceId: "org.betterportal.auth.default" }, capability)).status, 403);
  assert.equal((await send(`/.well-known/bp/admin/apps/${appId}/auth/roles`, "POST", { id: "extra", title: "Extra" }, capability)).status, 403);
  const setup = await send("/.well-known/bp/admin/services/begin-install", "POST", { serviceUrl: "https://auth.example", tenantId, appId, sharedServiceId: "org.betterportal.auth.default" }, capability);
  assert.equal(setup.status, 200, await setup.text());
  const role = await send(`/.well-known/bp/admin/apps/${appId}/auth/roles`, "POST", { id: "admin", title: "Administrator", permissions: [] }, capability);
  assert.equal(role.status, 201, await role.text());
});

test("service-authenticated self-mutation keeps its own credential check", async () => {
  const { send } = fixture();
  const response = await send("/.well-known/bp/admin/services/self-mutation", "PUT", {});
  assert.equal(response.status, 400);
});
