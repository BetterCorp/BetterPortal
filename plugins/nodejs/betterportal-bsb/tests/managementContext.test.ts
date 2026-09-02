import assert from "node:assert/strict";
import test from "node:test";
import { BPService } from "../src/service.js";

test("management auth stays root while handler routing uses the requested tenant app", () => {
  const rootTenant = tenant("root-tenant", "Root");
  const targetTenant = tenant("target-tenant", "Target", [{
    id: "workos-activation",
    serviceId: "org.betterportal.auth.workos",
    hostname: "https://workos.test",
    enabled: true,
  }]);
  const rootApp = app("root-app", rootTenant.id);
  const targetApp = app("target-app", targetTenant.id);
  const service = Object.create(BPService.prototype) as any;
  service.scopedConfig = {
    configManagement: { adminTenantId: rootTenant.id, managementAppId: rootApp.id, context: { tenant: rootTenant, app: rootApp } },
    managementOrigins: [],
    tenants: [targetTenant],
    apps: [targetApp],
  };
  service.configStore = { read: () => ({ tenant: {}, app: {} }) };
  service.manifest = { pluginId: "org.betterportal.auth.workos" };
  service.getConfiguredJwtVerifier = () => ({ verify: async () => ({}) });
  service.getServiceTokenVerifier = () => undefined;
  service.getAppAuthConfig = () => undefined;
  service.getServiceIdAliases = () => undefined;

  const event = {
    url: new URL("https://workos.test/.well-known/bp/config/workos-role-sync?tenantId=target-tenant&appId=target-app"),
  } as any;
  const route = {
    path: "/.well-known/bp/config/workos-role-sync",
    methodRoutes: { GET: { auth: { required: true } } },
  } as any;

  const handler = service.resolveHandlerContext(event, route);
  const auth = service.resolveAuthForRequest(event, route);

  assert.equal(handler.tenant?.id, targetTenant.id);
  assert.equal(handler.app?.id, targetApp.id);
  assert.equal(auth?.tenantId, rootTenant.id);
  assert.equal(auth?.appId, rootApp.id);
  assert.equal(event.__bpTenantId, targetTenant.id);
  assert.equal(event.__bpAppId, targetApp.id);
});

function tenant(id: string, title: string, services: unknown[] = []) {
  return { id, slug: id, title, active: true, branding: {}, services, activatedPlatformServices: [] };
}

function app(id: string, tenantId: string) {
  return {
    id,
    tenantId,
    slug: id,
    title: id,
    hostnames: [],
    originOverrides: [],
    refererOverrides: [],
    themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
    defaultRoute: "/",
    routes: [],
    appRoutes: [],
    menu: [],
    slots: [],
    fragments: {},
    appFragments: {},
    shellFragments: {},
  };
}
