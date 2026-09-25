import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalAppSchema, BetterPortalMenuItemSchema, BetterPortalRouteMountSchema } from "../src/contracts/platformConfig.js";
import { createBpTokenIssuer } from "../src/runtime/auth/issuer.js";
import { generateKeyPair, publicKeyToJwk } from "../src/runtime/auth/keypair.js";
import { filterThemeMenu, menuItemVisible, resolveThemeAuth, type ThemeAuthContext } from "../src/runtime/auth/menu.js";
import { uuidv7 } from "../src/runtime/uuid.js";

const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7();
const keys = generateKeyPair({ kid: "menu-test" });
const issuer = createBpTokenIssuer({ keyPair: keys, issuer: "https://auth.test", audience: "portal", accessTokenSeconds: 900, refreshTokenSeconds: 3600 });
const app = BetterPortalAppSchema.parse({ id: appId, tenantId, slug: "test", title: "Test", hostnames: ["app.test"],
  auth: { serviceId, expectedIssuer: "https://auth.test", expectedAudience: "portal", jwksUri: "https://auth.test/jwks",
    publicKeys: { keys: [publicKeyToJwk(keys.publicKeyPem, keys.kid)] }, roles: [{ id: "staff", title: "Staff", permissions: [{ serviceId, viewId: "dashboard", permissions: ["read"] }] }] }
});
const route = BetterPortalRouteMountSchema.parse({ id: uuidv7(), path: "/dashboard", serviceId, viewId: "dashboard", authRequired: true, operations: ["dashboard.get"],
  menuPermissions: [{ serviceId: "org.example.service", viewId: "dashboard", permissions: ["read"] }] });
const anonymous: ThemeAuthContext = { status: "anonymous", permissions: [] };
const unknown: ThemeAuthContext = { status: "unknown", permissions: [] };
const token = (roles: string[], id = appId) => issuer.issueTokenPair({ sub: "user", tenantId, appId: id, roles, authProvider: "test", refreshContext: {} });
const authenticate = (roles: string[]) => resolveThemeAuth(app, new Headers({ authorization: `Bearer ${token(roles).accessToken}` }));

test("theme auth uses synced keys and rejects wrong app, refresh, and invalid tokens", async () => {
  assert.equal((await resolveThemeAuth(app, new Headers())).status, "unknown");
  assert.equal((await resolveThemeAuth(app, new Headers({ "hx-request": "true" }))).status, "anonymous");
  assert.equal((await authenticate(["staff"])).user?.sub, "user");
  for (const value of [token(["staff"], uuidv7()).accessToken, token(["staff"]).refreshToken, "not-a-token"]) {
    assert.notEqual((await resolveThemeAuth(app, new Headers({ authorization: `Bearer ${value}` }))).status, "authenticated");
  }
  assert.equal((await resolveThemeAuth({ ...app, auth: { ...app.auth!, publicKeys: undefined } }, new Headers({ authorization: `Bearer ${token(["staff"]).accessToken}` }))).status, "unknown");
});

test("public, authenticated, and permission audiences are distinct before any service request", async () => {
  const staff = await authenticate(["staff"]), client = await authenticate(["client"]);
  for (const state of [unknown, anonymous, staff, client]) {
    assert.equal(menuItemVisible({ authStatus: "show" }, route, state), true);
    assert.equal(menuItemVisible({ authStatus: "auto" }, { ...route, authRequired: true }, state, { [serviceId]: "org.example.service" }), state === staff);
    assert.equal(menuItemVisible({ authStatus: "auto" }, { ...route, authRequired: false, menuPermissions: [] }, state), true);
    assert.equal(menuItemVisible({ authStatus: "show-unauthenticated" }, route, state), state === anonymous);
    assert.equal(menuItemVisible({ authStatus: "hide-unauthenticated" }, route, state), state === staff || state === client);
    assert.equal(menuItemVisible({ authStatus: "hide-unauthorized" }, route, state, { [serviceId]: "org.example.service" }), state === staff);
    assert.equal(menuItemVisible({ authStatus: "show", rolesAnyOf: ["staff"] }, route, state), state === staff);
  }
  assert.equal(menuItemVisible({ authStatus: "hide-unauthorized" }, { ...route, menuPermissions: undefined }, staff), false);
  assert.equal(menuItemVisible({ authStatus: "hide-unauthorized" }, { ...route, menuPermissions: [] }, staff), true);
  assert.equal(menuItemVisible({ authStatus: "show" }, { ...route, menu: false }, staff), false);
});

test("parent role conditions, empty groups, and forced exclusions apply recursively without changing routes", async () => {
  const link = BetterPortalMenuItemSchema.parse({ id: uuidv7(), type: "link", routeId: route.id });
  const group = BetterPortalMenuItemSchema.parse({ id: uuidv7(), type: "group", rolesAnyOf: ["staff"], children: [link] });
  const configured = { routes: [{ ...route, menuPermissions: [{ serviceId, viewId: "dashboard", permissions: ["read"] }] }], menu: [group] };
  assert.equal(filterThemeMenu(configured, await authenticate(["staff"])).length, 1);
  assert.equal(filterThemeMenu(configured, await authenticate(["client"])).length, 0);
  assert.equal(filterThemeMenu({ ...configured, routes: [{ ...route, menu: false }] }, await authenticate(["staff"])).length, 0);
  assert.equal(configured.routes.length, 1);
  assert.equal(configured.menu[0].children.length, 1);
});
