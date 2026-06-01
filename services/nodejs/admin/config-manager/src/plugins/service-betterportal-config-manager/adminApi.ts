import type {
  BetterPortalH3App,
  BetterPortalEvent,
  PlatformConfigStore,
  JsonValue
} from "@betterportal/framework-nodejs";
import {
  generateApiKey,
  hashApiKey,
  htmlResponse,
  jsonResponse,
  uuidv7
} from "@betterportal/framework-nodejs";
import type { TenantServiceRegistration, PlatformService } from "@betterportal/framework-nodejs";

const API_BASE = "/.well-known/bp/admin";
const CONFIG_TOKEN = "bp-dev-config-token";

async function readFormBody(event: BetterPortalEvent): Promise<Record<string, string>> {
  const fd = await event.req.formData().catch(() => null);
  if (!fd) return {};
  const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function readJsonBody(event: BetterPortalEvent): Promise<Record<string, unknown>> {
  const parsed = await event.req.json().catch(() => null);
  return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};
}

function getParam(event: BetterPortalEvent, name: string): string | undefined {
  return (event as unknown as { context: { params?: Record<string, string> } }).context?.params?.[name];
}

export function registerAdminApiRoutes(app: BetterPortalH3App, store: PlatformConfigStore): void {

  // ── Platform services (marketplace) ────────────────────────────────

  app.get(`${API_BASE}/platform-services`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config.platformServices.map((s) => ({
      id: s.id, hostname: s.hostname, serviceId: s.serviceId,
      title: s.title, description: s.description, enabled: s.enabled, createdAt: s.createdAt
    })) as JsonValue);
  });

  app.post(`${API_BASE}/platform-services`, async (event) => {
    const body = await readJsonBody(event);
    const hostname = body.hostname as string;
    const title = (body.title as string) || hostname;
    if (!hostname) return jsonResponse({ error: "hostname is required" }, 400);

    const config = await store.loadConfig();
    const apiKey = generateApiKey();
    const service: PlatformService = {
      id: `ps-${uuidv7()}`,
      hostname,
      apiKeyHash: hashApiKey(apiKey),
      title,
      description: (body.description as string) || undefined,
      createdAt: new Date().toISOString(),
      enabled: true
    };

    config.platformServices.push(service);
    await store.saveConfig(config);
    return jsonResponse({ id: service.id, hostname, apiKey, title } as JsonValue, 201);
  });

  // ── Tenants ────────────────────────────────────────────────────────

  app.get(`${API_BASE}/tenants`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config.tenants.map((t) => ({
      id: t.id, slug: t.slug, title: t.title, active: t.active,
      serviceCount: t.services.length,
      activatedPlatformServices: t.activatedPlatformServices
    })) as JsonValue);
  });

  app.post(`${API_BASE}/tenants`, async (event) => {
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    if (!body.id || !body.slug || !body.title) {
      return jsonResponse({ error: "id, slug, and title are required" }, 400);
    }
    if (config.tenants.some((t) => t.id === body.id)) {
      return jsonResponse({ error: `Tenant ${body.id} already exists` }, 409);
    }

    config.tenants.push({
      id: body.id as string, slug: body.slug as string, title: body.title as string,
      active: true, branding: {}, services: [], activatedPlatformServices: []
    });
    await store.saveConfig(config);
    return jsonResponse({ ok: true, id: body.id } as unknown as JsonValue, 201);
  });

  app.put(`${API_BASE}/tenants/:id`, async (event) => {
    const id = getParam(event, "id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === id);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    if (body.title !== undefined) tenant.title = body.title as string;
    if (body.slug !== undefined) tenant.slug = body.slug as string;
    if (body.active !== undefined) tenant.active = body.active as boolean;
    if (body.branding !== undefined) tenant.branding = body.branding as any;

    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/tenants/:id`, async (event) => {
    const id = getParam(event, "id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const config = await store.loadConfig();
    config.tenants = config.tenants.filter((t) => t.id !== id);
    config.apps = config.apps.filter((a) => a.tenantId !== id);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // ── Tenant services (per-tenant registration) ──────────────────────

  app.get(`${API_BASE}/tenants/:tenantId/services`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    if (!tenantId) return jsonResponse({ error: "tenantId required" }, 400);
    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    return jsonResponse(tenant.services.map((s) => ({
      id: s.id, hostname: s.hostname, serviceId: s.serviceId,
      title: s.title, enabled: s.enabled, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt
    })) as JsonValue);
  });

  app.post(`${API_BASE}/tenants/:tenantId/services`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    if (!tenantId) return jsonResponse({ error: "tenantId required" }, 400);
    const body = await readJsonBody(event);
    const hostname = body.hostname as string;
    if (!hostname) return jsonResponse({ error: "hostname is required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    const apiKey = generateApiKey();
    const service: TenantServiceRegistration = {
      id: `svc-${uuidv7()}`,
      hostname,
      apiKeyHash: hashApiKey(apiKey),
      title: (body.title as string) || undefined,
      deploymentMode: "self-hosted",
      createdAt: new Date().toISOString(),
      enabled: true
    };

    tenant.services.push(service);
    await store.saveConfig(config);
    return jsonResponse({ id: service.id, hostname, apiKey } as JsonValue, 201);
  });

  app.delete(`${API_BASE}/tenants/:tenantId/services/:serviceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const serviceId = getParam(event, "serviceId");
    if (!tenantId || !serviceId) return jsonResponse({ error: "tenantId and serviceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    tenant.services = tenant.services.filter((s) => s.id !== serviceId);
    await store.saveConfig(config);
    const accept = event.req.headers.get("accept") ?? "";
    if (accept.includes("text/html") || event.req.headers.get("hx-request")) {
      return htmlResponse("", 200, "text/html; mode=fragment", {
        "HX-Location": JSON.stringify({ path: "/admin-services", target: "#bp-main", swap: "innerHTML" })
      });
    }
    return jsonResponse({ ok: true });
  });

  // ── Activate/deactivate platform services for tenant ───────────────

  app.post(`${API_BASE}/tenants/:tenantId/activate/:platformServiceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const psId = getParam(event, "platformServiceId");
    if (!tenantId || !psId) return jsonResponse({ error: "tenantId and platformServiceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    if (!tenant.activatedPlatformServices.includes(psId)) {
      tenant.activatedPlatformServices.push(psId);
      await store.saveConfig(config);
    }
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/tenants/:tenantId/activate/:platformServiceId`, async (event) => {
    const tenantId = getParam(event, "tenantId");
    const psId = getParam(event, "platformServiceId");
    if (!tenantId || !psId) return jsonResponse({ error: "tenantId and platformServiceId required" }, 400);

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) return jsonResponse({ error: "Tenant not found" }, 404);

    tenant.activatedPlatformServices = tenant.activatedPlatformServices.filter((id) => id !== psId);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // ── Apps ────────────────────────────────────────────────────────────

  app.get(`${API_BASE}/apps`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config.apps.map((a) => ({
      id: a.id, tenantId: a.tenantId, slug: a.slug, title: a.title,
      hostnames: a.hostnames, themeId: a.themeId, routeCount: a.routes.length
    })) as unknown as JsonValue);
  });

  app.post(`${API_BASE}/apps`, async (event) => {
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    if (!body.id || !body.tenantId || !body.title) {
      return jsonResponse({ error: "id, tenantId, and title are required" }, 400);
    }
    config.apps.push(body as any);
    await store.saveConfig(config);
    return jsonResponse({ ok: true, id: body.id } as unknown as JsonValue, 201);
  });

  app.put(`${API_BASE}/apps/:id`, async (event) => {
    const id = getParam(event, "id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === id);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);

    if (body.title !== undefined) appDef.title = body.title as string;
    if (body.slug !== undefined) appDef.slug = body.slug as string;
    if (body.hostnames !== undefined) appDef.hostnames = body.hostnames as string[];
    if (body.themeId !== undefined) appDef.themeId = body.themeId as string;

    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/apps/:id`, async (event) => {
    const id = getParam(event, "id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const config = await store.loadConfig();
    config.apps = config.apps.filter((a) => a.id !== id);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // ── Routes (per app) ───────────────────────────────────────────────

  app.get(`${API_BASE}/apps/:appId/routes`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    return jsonResponse(appDef.routes as unknown as JsonValue);
  });

  app.post(`${API_BASE}/apps/:appId/routes`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const route = { id: uuidv7(), enabled: true, methods: ["GET"], ...body };
    appDef.routes.push(route as any);
    await store.saveConfig(config);
    return jsonResponse({ ok: true, id: route.id } as unknown as JsonValue, 201);
  });

  app.put(`${API_BASE}/apps/:appId/routes/:routeId`, async (event) => {
    const appId = getParam(event, "appId");
    const routeId = getParam(event, "routeId");
    if (!appId || !routeId) return jsonResponse({ error: "appId and routeId required" }, 400);
    const body = await readJsonBody(event);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const route = appDef.routes.find((r) => r.id === routeId);
    if (!route) return jsonResponse({ error: "Route not found" }, 404);

    if (body.path !== undefined) route.path = body.path as string;
    if (body.serviceId !== undefined) route.serviceId = body.serviceId as string;
    if (body.viewId !== undefined) route.viewId = body.viewId as string;
    if (body.targetPath !== undefined) route.targetPath = body.targetPath as string;
    if (body.title !== undefined) route.title = body.title as string;
    if (body.enabled !== undefined) route.enabled = body.enabled as boolean;

    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  app.delete(`${API_BASE}/apps/:appId/routes/:routeId`, async (event) => {
    const appId = getParam(event, "appId");
    const routeId = getParam(event, "routeId");
    if (!appId || !routeId) return jsonResponse({ error: "appId and routeId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    appDef.routes = appDef.routes.filter((r) => r.id !== routeId);
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // ── Menu (per app) ─────────────────────────────────────────────────

  app.get(`${API_BASE}/apps/:appId/menu`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    return jsonResponse(((appDef as any).menu ?? []) as unknown as JsonValue);
  });

  app.put(`${API_BASE}/apps/:appId/menu`, async (event) => {
    const appId = getParam(event, "appId");
    if (!appId) return jsonResponse({ error: "appId required" }, 400);
    const body = await readJsonBody(event);
    const items = Array.isArray(body.items) ? body.items : [];
    const config = await store.loadConfig();
    const appDef = config.apps.find((a) => a.id === appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    (appDef as any).menu = items.map((m: any) => ({
      id: m.id ?? uuidv7(),
      type: m.type ?? "link",
      title: m.title,
      icon: m.icon,
      routeId: m.routeId,
      href: m.href,
      enabled: m.enabled !== false,
      children: m.children ?? []
    }));
    await store.saveConfig(config);
    return jsonResponse({ ok: true });
  });

  // ── Full config (read-only) ────────────────────────────────────────

  app.get(`${API_BASE}/config`, async () => {
    const config = await store.loadConfig();
    return jsonResponse(config as unknown as JsonValue);
  });

  // ── HTMX wizard: verify service ────────────────────────────────────

  app.post(`${API_BASE}/wizard/verify`, async (event) => {
    const form = await readFormBody(event);
    const tenantId = form.tenantId ?? "";
    const hostname = (form.hostname ?? "").replace(/\/+$/, "");
    if (!tenantId || !hostname) {
      return htmlResponse(renderWizardStep1(await store.loadConfig(), "Tenant and hostname are required."), 200, "text/html; mode=fragment");
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${hostname}/.well-known/bp/manifest`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const manifest = await resp.json() as { pluginId?: string; title?: string; version?: string; views?: unknown[] };
      if (!manifest.pluginId || !manifest.title) throw new Error("Not a valid BetterPortal service manifest");

      return htmlResponse(renderWizardStep2({
        tenantId, hostname,
        pluginId: manifest.pluginId,
        version: manifest.version ?? "unknown",
        viewCount: Array.isArray(manifest.views) ? manifest.views.length : 0,
        title: manifest.title
      }), 200, "text/html; mode=fragment");
    } catch (err) {
      const config = await store.loadConfig();
      return htmlResponse(renderWizardStep1(config, `Verification failed: ${(err as Error).message}`, { tenantId, hostname }), 200, "text/html; mode=fragment");
    }
  });

  // ── HTMX wizard: register service ──────────────────────────────────

  app.post(`${API_BASE}/wizard/register`, async (event) => {
    const form = await readFormBody(event);
    const tenantId = form.tenantId ?? "";
    const hostname = (form.hostname ?? "").replace(/\/+$/, "");
    const title = form.title || hostname;
    if (!tenantId || !hostname) {
      return htmlResponse(`<div class="alert alert-danger">Missing tenantId or hostname</div>`, 200, "text/html; mode=fragment");
    }

    const config = await store.loadConfig();
    const tenant = config.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      return htmlResponse(`<div class="alert alert-danger">Tenant not found</div>`, 200, "text/html; mode=fragment");
    }

    // Fetch service schema for serviceId + routes
    let serviceId: string | undefined;
    let serviceRoutes: Array<{ viewId: string; path: string }> = [];
    let viewMeta = new Map<string, string>();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${hostname}/.well-known/bp/schema.json`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        const schema = await resp.json() as {
          manifest?: { pluginId?: string; views?: Array<{ viewId: string; title: string }> };
          routes?: Array<{ viewId: string; path: string }>;
        };
        serviceId = schema.manifest?.pluginId;
        serviceRoutes = schema.routes ?? [];
        viewMeta = new Map((schema.manifest?.views ?? []).map((v) => [v.viewId, v.title]));
      }
    } catch { /* network failure → register without routes */ }

    const apiKey = generateApiKey();
    const newServiceId = `svc-${uuidv7()}`;
    const service: TenantServiceRegistration = {
      id: newServiceId,
      hostname,
      apiKeyHash: hashApiKey(apiKey),
      title,
      serviceId,
      deploymentMode: "self-hosted",
      createdAt: new Date().toISOString(),
      enabled: true
    };
    tenant.services.push(service);

    // Auto-add routes + menu group to each app in tenant
    if (serviceRoutes.length > 0) {
      const tenantApps = config.apps.filter((a) => a.tenantId === tenantId);
      for (const appDef of tenantApps) {
        const groupId = `g-${newServiceId}`;
        const groupChildren: Array<{ id: string; type: string; title: string; routeId: string; enabled: boolean }> = [];
        const existingPaths = new Set(appDef.routes.map((r) => r.path));

        for (const r of serviceRoutes) {
          // Default mounting path is the service's own path; skip collisions
          const mountPath = existingPaths.has(r.path) ? `/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${r.path}` : r.path;
          if (existingPaths.has(mountPath)) continue;

          const routeId = uuidv7();
          const routeTitle = viewMeta.get(r.viewId) ?? r.viewId;
          appDef.routes.push({
            id: routeId,
            path: mountPath,
            serviceId: newServiceId,
            viewId: r.viewId,
            targetPath: r.path,
            title: routeTitle,
            enabled: true,
            methods: ["GET"]
          } as any);
          existingPaths.add(mountPath);
          groupChildren.push({
            id: `m-${routeId}`,
            type: "link",
            title: routeTitle,
            routeId,
            enabled: true
          });
        }

        if (groupChildren.length > 0) {
          const menu = ((appDef as any).menu ?? []) as Array<Record<string, unknown>>;
          menu.push({
            id: groupId,
            type: "group",
            title,
            enabled: true,
            children: groupChildren
          });
          (appDef as any).menu = menu;
        }
      }
    }

    await store.saveConfig(config);
    return htmlResponse(renderWizardStep3(apiKey), 200, "text/html; mode=fragment");
  });

  app.get(`${API_BASE}/wizard/step1`, async () => {
    const config = await store.loadConfig();
    return htmlResponse(renderWizardStep1(config), 200, "text/html; mode=fragment");
  });

  // ── HTMX configure: load form ──────────────────────────────────────

  app.get(`${API_BASE}/configure`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const hostname = (url.searchParams.get("hostname") ?? "").replace(/\/+$/, "");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const serviceTitle = url.searchParams.get("title") ?? "Service";
    if (!hostname || !tenantId) {
      return htmlResponse(`<div class="alert alert-danger">Missing hostname or tenantId</div>`, 200, "text/html; mode=fragment");
    }

    try {
      const schemaResp = await fetch(`${hostname}/.well-known/bp/config/schema`, {
        headers: { Accept: "application/json" }
      });
      if (!schemaResp.ok) throw new Error(`schema HTTP ${schemaResp.status}`);
      const schema = await schemaResp.json() as {
        supportsCustomUi?: boolean;
        customUiPath?: string;
        configSchemas?: Array<{ scope: string; fields: Array<{ key: string; title: string; description?: string; visibility?: string }> }>;
      };

      const config = await store.loadConfig();
      const tenantApps = config.apps.filter((a) => a.tenantId === tenantId);
      const appScopeFields = (schema.configSchemas ?? []).filter((s) => s.scope === "app").flatMap((s) => s.fields);
      const tenantScopeFields = (schema.configSchemas ?? []).filter((s) => s.scope === "tenant").flatMap((s) => s.fields);
      const needsApp = appScopeFields.length > 0;

      // Fetch current values
      const headers: Record<string, string> = {
        Authorization: `Bearer ${CONFIG_TOKEN}`,
        "x-bp-tenant-id": tenantId
      };
      if (appId) headers["x-bp-app-id"] = appId;
      let values: Record<string, unknown> = {};
      if (!needsApp || appId) {
        const valResp = await fetch(`${hostname}/.well-known/bp/config`, { headers });
        if (valResp.ok) {
          const data = await valResp.json() as { values?: Record<string, unknown> };
          values = data.values ?? {};
        }
      }

      return htmlResponse(renderConfigForm({
        hostname, tenantId, appId, serviceTitle,
        fields: needsApp ? appScopeFields : tenantScopeFields,
        values, tenantApps, needsApp
      }), 200, "text/html; mode=fragment");
    } catch (err) {
      return htmlResponse(`<div class="alert alert-danger">Failed to load: ${escapeHtml((err as Error).message)}</div>`, 200, "text/html; mode=fragment");
    }
  });

  // ── HTMX configure: save ──────────────────────────────────────────

  app.post(`${API_BASE}/configure-save`, async (event) => {
    const form = await readFormBody(event);
    const hostname = (form.hostname ?? "").replace(/\/+$/, "");
    const tenantId = form.tenantId ?? "";
    const appId = form.appId ?? "";
    const serviceTitle = form.serviceTitle ?? "Service";
    if (!hostname || !tenantId) {
      return htmlResponse(`<div class="alert alert-danger">Missing hostname or tenantId</div>`, 200, "text/html; mode=fragment");
    }

    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === "hostname" || k === "tenantId" || k === "appId" || k === "serviceTitle") continue;
      if (v !== "" && v !== "(unchanged)") values[k] = v;
    }

    const payload: Record<string, unknown> = { tenantId, values };
    if (appId) payload.appId = appId;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG_TOKEN}`,
      "x-bp-tenant-id": tenantId
    };
    if (appId) headers["x-bp-app-id"] = appId;

    try {
      const resp = await fetch(`${hostname}/.well-known/bp/config`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` })) as { error?: string };
        return htmlResponse(`<div class="alert alert-danger">${escapeHtml(err.error ?? "Save failed")}</div>`, 200, "text/html; mode=fragment");
      }
      return htmlResponse(
        `<div class="alert alert-success">Saved. <button type="button" class="btn-close float-end" data-bs-dismiss="offcanvas"></button></div>`,
        200,
        "text/html; mode=fragment",
        { "HX-Trigger": "bp:config-saved" }
      );
    } catch (err) {
      return htmlResponse(`<div class="alert alert-danger">${escapeHtml((err as Error).message)}</div>`, 200, "text/html; mode=fragment");
    }
  });
}

// ── HTML fragment renderers ──────────────────────────────────────────

function renderWizardStep1(
  config: { tenants: Array<{ id: string; title: string }> },
  error?: string,
  prefill?: { tenantId?: string; hostname?: string }
): string {
  const tenantOptions = config.tenants
    .map((t) => `<option value="${escapeHtml(t.id)}"${prefill?.tenantId === t.id ? " selected" : ""}>${escapeHtml(t.title)} (${escapeHtml(t.id)})</option>`)
    .join("");
  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 1 of 3</div>
  <form hx-post="/.well-known/bp/admin/wizard/verify" hx-target="#bp-wizard-step" hx-swap="outerHTML" hx-indicator="#bp-wizard-spinner">
    <div class="mb-3">
      <label class="form-label">Tenant</label>
      <select class="form-select" name="tenantId" required>
        <option value="">Select tenant...</option>
        ${tenantOptions}
      </select>
      <div class="form-text">Which tenant owns this service?</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Service URL</label>
      <input type="url" class="form-control" name="hostname" value="${escapeHtml(prefill?.hostname ?? "")}" placeholder="http://localhost:3200" required />
      <div class="form-text">We'll verify it's a valid BetterPortal service.</div>
    </div>
    ${error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ""}
    <button type="submit" class="btn btn-primary w-100">
      <span id="bp-wizard-spinner" class="spinner-border spinner-border-sm htmx-indicator" role="status"></span>
      Verify Service →
    </button>
  </form>
</div>`;
}

function renderWizardStep2(d: { tenantId: string; hostname: string; pluginId: string; version: string; viewCount: number; title: string }): string {
  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 2 of 3</div>
  <div class="alert alert-success mb-3">
    <h6 class="alert-heading">Service Verified</h6>
    <div class="small mb-1"><strong>Plugin ID:</strong> <code>${escapeHtml(d.pluginId)}</code></div>
    <div class="small mb-1"><strong>Version:</strong> ${escapeHtml(d.version)}</div>
    <div class="small mb-0"><strong>Views:</strong> ${d.viewCount}</div>
  </div>
  <form hx-post="/.well-known/bp/admin/wizard/register" hx-target="#bp-wizard-step" hx-swap="outerHTML">
    <input type="hidden" name="tenantId" value="${escapeHtml(d.tenantId)}" />
    <input type="hidden" name="hostname" value="${escapeHtml(d.hostname)}" />
    <div class="mb-3">
      <label class="form-label">Display Name</label>
      <input type="text" class="form-control" name="title" value="${escapeHtml(d.title)}" required />
      <div class="form-text">Auto-filled from manifest. Edit if needed.</div>
    </div>
    <div class="d-flex gap-2">
      <button type="button" class="btn btn-outline-secondary" hx-get="/.well-known/bp/admin/wizard/step1" hx-target="#bp-wizard-step" hx-swap="outerHTML">← Back</button>
      <button type="submit" class="btn btn-primary flex-grow-1">Register Service</button>
    </div>
  </form>
</div>`;
}

function renderWizardStep3(apiKey: string): string {
  return `<div id="bp-wizard-step">
  <div class="mb-3 text-secondary small">Step 3 of 3</div>
  <div class="alert alert-success">
    <h6 class="alert-heading">Service Registered</h6>
    <p class="mb-2 small">Copy the API key below — it's shown <strong>once only</strong>.</p>
    <div class="input-group mb-3">
      <input type="text" class="form-control font-monospace small" id="bp-api-key-value" value="${escapeHtml(apiKey)}" readonly />
      <button class="btn btn-outline-secondary" type="button"
        onclick="navigator.clipboard.writeText(this.previousElementSibling.value); this.textContent='Copied!'; setTimeout(()=>{this.textContent='Copy';},1500)">Copy</button>
    </div>
    <p class="small text-secondary mb-0">Add this key to the service's <code>sec-config.yaml</code> as <code>serviceApiKey</code>.</p>
  </div>
  <button class="btn btn-primary w-100"
    data-bs-dismiss="offcanvas"
    hx-get="/admin-services"
    hx-target="#bp-main"
    hx-swap="innerHTML"
    hx-push-url="/admin-services">Done</button>
</div>`;
}

function renderConfigForm(d: {
  hostname: string;
  tenantId: string;
  appId: string;
  serviceTitle: string;
  fields: Array<{ key: string; title: string; description?: string; visibility?: string }>;
  values: Record<string, unknown>;
  tenantApps: Array<{ id: string; title: string }>;
  needsApp: boolean;
}): string {
  const appSelector = d.needsApp
    ? `<div class="mb-3">
      <label class="form-label">App</label>
      <select class="form-select" name="appId" required
        hx-get="/.well-known/bp/admin/configure"
        hx-trigger="change"
        hx-target="#bp-config-edit-form"
        hx-swap="innerHTML"
        hx-include="closest form"
        hx-vals='{"hostname":"${escapeHtml(d.hostname)}","tenantId":"${escapeHtml(d.tenantId)}","title":"${escapeHtml(d.serviceTitle)}"}'>
        <option value="">Select app...</option>
        ${d.tenantApps.map((a) => `<option value="${escapeHtml(a.id)}"${a.id === d.appId ? " selected" : ""}>${escapeHtml(a.title)}</option>`).join("")}
      </select>
    </div>`
    : "";

  if (d.needsApp && !d.appId) {
    return `<div class="small text-secondary mb-3">${escapeHtml(d.serviceTitle)} · <span class="font-monospace">${escapeHtml(d.hostname)}</span></div>
${appSelector}
<div class="alert alert-info">Select an app to load its config</div>`;
  }

  const fieldsHtml = d.fields.map((f) => {
    const val = d.values[f.key] ?? "";
    const type = f.visibility === "secret" ? "password" : "text";
    const placeholder = f.visibility === "secret" && val === "__redacted__" ? "(unchanged)" : "";
    const renderedVal = f.visibility === "secret" && val === "__redacted__" ? "" : String(val);
    return `<div class="mb-3">
      <label class="form-label">${escapeHtml(f.title)}</label>
      <input type="${type}" class="form-control" name="${escapeHtml(f.key)}" value="${escapeHtml(renderedVal)}" placeholder="${escapeHtml(placeholder)}" />
      ${f.description ? `<div class="form-text">${escapeHtml(f.description)}</div>` : ""}
    </div>`;
  }).join("");

  return `<div class="small text-secondary mb-3">${escapeHtml(d.serviceTitle)} · <span class="font-monospace">${escapeHtml(d.hostname)}</span></div>
${appSelector}
<form hx-post="/.well-known/bp/admin/configure-save" hx-target="#bp-config-save-status" hx-swap="innerHTML"
  hx-on::after-request="if(event.detail.successful) setTimeout(()=>bootstrap.Offcanvas.getInstance(document.getElementById('bp-config-edit-panel'))?.hide(), 800)">
  <input type="hidden" name="hostname" value="${escapeHtml(d.hostname)}" />
  <input type="hidden" name="tenantId" value="${escapeHtml(d.tenantId)}" />
  <input type="hidden" name="appId" value="${escapeHtml(d.appId)}" />
  <input type="hidden" name="serviceTitle" value="${escapeHtml(d.serviceTitle)}" />
  ${fieldsHtml}
  <div id="bp-config-save-status"></div>
  <button type="submit" class="btn btn-primary w-100">Save Configuration</button>
</form>`;
}
