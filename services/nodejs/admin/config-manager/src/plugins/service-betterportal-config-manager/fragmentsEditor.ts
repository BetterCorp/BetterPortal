import type {
  BetterPortalH3App,
  BetterPortalEvent,
  PlatformConfigStore
} from "@betterportal/framework-nodejs";
import {
  htmlResponse,
  jsonResponse
} from "@betterportal/framework-nodejs";

const API_BASE = "/.well-known/bp/admin";

interface Fragment {
  serviceId: string;
  fragmentId: string;
  targetPath: string;
  enabled: boolean;
}

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

function getApp(config: any, appId: string): any | null {
  return config.apps.find((a: any) => a.id === appId) ?? null;
}

function getServicesForApp(config: any, appDef: any): Array<{ id: string; title: string }> {
  const tenant = (config.tenants ?? []).find((t: any) => t.id === appDef.tenantId);
  if (!tenant) return [];
  const tenantSvcs = (tenant.services ?? []).filter((s: any) => s.enabled).map((s: any) => ({
    id: s.id, title: s.title || s.serviceId || s.id
  }));
  const platformSvcs = (tenant.activatedPlatformServices ?? [])
    .map((psId: string) => (config.platformServices ?? []).find((p: any) => p.id === psId && p.enabled))
    .filter(Boolean)
    .map((p: any) => ({ id: p.id, title: `${p.title || p.id} (platform)` }));
  return [...tenantSvcs, ...platformSvcs];
}

function getServiceTitle(config: any, serviceId: string): string {
  for (const t of config.tenants ?? []) {
    const s = (t.services ?? []).find((x: any) => x.id === serviceId);
    if (s) return s.title || s.serviceId || s.id;
  }
  const ps = (config.platformServices ?? []).find((x: any) => x.id === serviceId);
  return ps ? (ps.title || ps.id) : serviceId;
}

function getServiceHostname(config: any, serviceId: string): string | null {
  for (const t of config.tenants ?? []) {
    const s = (t.services ?? []).find((x: any) => x.id === serviceId);
    if (s) return s.hostname ?? null;
  }
  const ps = (config.platformServices ?? []).find((x: any) => x.id === serviceId);
  return ps?.hostname ?? null;
}

interface AvailableFragment {
  fragmentLocation: string;
  fragmentId: string;
  viewPath: string;
}

async function fetchServiceFragments(hostname: string, location?: string): Promise<AvailableFragment[]> {
  if (!hostname) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch(`${hostname.replace(/\/+$/, "")}/.well-known/bp/schema.json`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const schema = await resp.json() as {
      routes?: Array<{ path: string; fragments?: Array<{ fragmentLocation: string; fragmentId: string }> }>;
    };
    const out: AvailableFragment[] = [];
    for (const r of schema.routes ?? []) {
      for (const f of r.fragments ?? []) {
        if (location && f.fragmentLocation !== location) continue;
        out.push({ fragmentLocation: f.fragmentLocation, fragmentId: f.fragmentId, viewPath: r.path });
      }
    }
    return out;
  } catch { return []; }
}

function getFragments(appDef: any, location: string): Fragment[] {
  const all = (appDef.fragments ?? {}) as Record<string, Fragment[]>;
  return all[location] ?? [];
}

function setFragments(appDef: any, location: string, frags: Fragment[]): void {
  appDef.fragments = appDef.fragments ?? {};
  (appDef.fragments as Record<string, Fragment[]>)[location] = frags;
}

const LOCATIONS = [
  { id: "nav", label: "Topbar (right side)" },
  { id: "footer", label: "Footer" }
];

function renderFragmentRow(frag: Fragment, idx: number, location: string, appId: string, config: any): string {
  const serviceTitle = getServiceTitle(config, frag.serviceId);
  const btn = (action: string, label: string, btnClass: string, title: string) =>
    `<form hx-post="${API_BASE}/fragments-editor/${action}" hx-target="#bp-fragments-editor" hx-swap="outerHTML" class="d-inline m-0">
      <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
      <input type="hidden" name="location" value="${escapeHtml(location)}" />
      <input type="hidden" name="index" value="${idx}" />
      <button type="submit" class="btn btn-sm ${btnClass}" title="${escapeHtml(title)}">${label}</button>
    </form>`;

  return `<li class="list-group-item d-flex justify-content-between align-items-center">
    <div class="d-flex flex-column gap-1 flex-grow-1 min-width-0">
      <div class="d-flex align-items-center gap-2">
        <span class="badge text-bg-secondary">${escapeHtml(serviceTitle)}</span>
        <span class="font-monospace">${escapeHtml(frag.fragmentId)}</span>
        <span class="text-secondary">→</span>
        <span class="font-monospace text-secondary small">${escapeHtml(frag.targetPath)}</span>
      </div>
    </div>
    <div class="btn-group btn-group-sm" role="group">
      ${btn("move-up", "↑", "btn-outline-secondary", "Move up")}
      ${btn("move-down", "↓", "btn-outline-secondary", "Move down")}
      ${btn("toggle", frag.enabled ? "on" : "off", frag.enabled ? "btn-success" : "btn-outline-secondary", frag.enabled ? "Disable" : "Enable")}
      ${btn("remove", "×", "btn-outline-danger", "Remove")}
    </div>
  </li>`;
}

function renderLocationSection(location: string, label: string, frags: Fragment[], appId: string, config: any, appDef: any): string {
  const services = getServicesForApp(config, appDef);
  const serviceOpts = ["<option value=\"\">Select service...</option>",
    ...services.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`)
  ].join("");

  const rows = frags.length === 0
    ? `<li class="list-group-item text-secondary">No fragments in this location.</li>`
    : frags.map((f, i) => renderFragmentRow(f, i, location, appId, config)).join("");

  return `<div class="card mb-3">
    <div class="card-header"><strong>${escapeHtml(label)}</strong> <span class="small text-secondary">(${frags.length})</span></div>
    <ul class="list-group list-group-flush">${rows}</ul>
    <div class="card-body">
      <form hx-post="${API_BASE}/fragments-editor/add" hx-target="#bp-fragments-editor" hx-swap="outerHTML"
        class="row g-2 align-items-end">
        <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
        <input type="hidden" name="location" value="${escapeHtml(location)}" />
        <div class="col-md-3">
          <label class="form-label small mb-0">Service</label>
          <select name="serviceId" class="form-select form-select-sm" required
            hx-get="${API_BASE}/fragments-editor/fragments"
            hx-target="#bp-frag-select-${location}"
            hx-swap="innerHTML"
            hx-trigger="change"
            hx-include="closest form">${serviceOpts}</select>
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-0">Fragment</label>
          <select id="bp-frag-select-${location}" name="fragmentId" class="form-select form-select-sm" required
            hx-get="${API_BASE}/fragments-editor/fragment-target"
            hx-target="#bp-frag-target-${location}"
            hx-swap="outerHTML"
            hx-trigger="change"
            hx-include="closest form">
            <option value="">Pick service first...</option>
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small mb-0">Target Path</label>
          <input id="bp-frag-target-${location}" type="text" name="targetPath" class="form-control form-control-sm font-monospace" placeholder="auto-filled" required />
        </div>
        <div class="col-md-2">
          <button type="submit" class="btn btn-primary btn-sm w-100">Add</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderEditor(config: any, appDef: any, appId: string): string {
  const sections = LOCATIONS.map((loc) =>
    renderLocationSection(loc.id, loc.label, getFragments(appDef, loc.id), appId, config, appDef)
  ).join("");

  return `<div id="bp-fragments-editor">${sections}</div>`;
}

export function registerFragmentsEditorRoutes(app: BetterPortalH3App, store: PlatformConfigStore): void {

  const respondEditor = async (appId: string): Promise<Response> => {
    const config = await store.loadConfig();
    const appDef = getApp(config, appId);
    if (!appDef) return htmlResponse(`<div class="alert alert-danger">App not found</div>`, 200, "text/html; mode=fragment");
    return htmlResponse(renderEditor(config, appDef, appId), 200, "text/html; mode=fragment", {
      "HX-Trigger": "bp:fragments-changed"
    });
  };

  app.get(`${API_BASE}/fragments-editor`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const appId = url.searchParams.get("appId") ?? "";
    if (!appId) return htmlResponse(`<div class="alert alert-secondary">Select an app</div>`, 200, "text/html; mode=fragment");
    return respondEditor(appId);
  });

  app.post(`${API_BASE}/fragments-editor/add`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    if (!f.serviceId || !f.fragmentId || !f.targetPath) return respondEditor(f.appId);
    const frags = getFragments(appDef, f.location);
    frags.push({
      serviceId: f.serviceId,
      fragmentId: f.fragmentId,
      targetPath: f.targetPath,
      enabled: true
    });
    setFragments(appDef, f.location, frags);
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/fragments-editor/remove`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const idx = parseInt(f.index, 10);
    const frags = getFragments(appDef, f.location);
    if (idx >= 0 && idx < frags.length) frags.splice(idx, 1);
    setFragments(appDef, f.location, frags);
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/fragments-editor/toggle`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const idx = parseInt(f.index, 10);
    const frags = getFragments(appDef, f.location);
    if (idx >= 0 && idx < frags.length) frags[idx].enabled = !frags[idx].enabled;
    setFragments(appDef, f.location, frags);
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/fragments-editor/move-up`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const idx = parseInt(f.index, 10);
    const frags = getFragments(appDef, f.location);
    if (idx > 0 && idx < frags.length) {
      const [it] = frags.splice(idx, 1);
      frags.splice(idx - 1, 0, it);
    }
    setFragments(appDef, f.location, frags);
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.get(`${API_BASE}/fragments-editor/fragments`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const location = url.searchParams.get("location") ?? "";
    if (!serviceId) return htmlResponse(`<option value="">Pick service first...</option>`, 200, "text/html; mode=fragment");
    const config = await store.loadConfig();
    const hostname = getServiceHostname(config, serviceId);
    if (!hostname) return htmlResponse(`<option value="">No service</option>`, 200, "text/html; mode=fragment");
    const frags = await fetchServiceFragments(hostname, location || undefined);
    if (frags.length === 0) return htmlResponse(`<option value="">No fragments at "${escapeHtml(location)}"</option>`, 200, "text/html; mode=fragment");
    return htmlResponse([
      `<option value="">Select fragment...</option>`,
      ...frags.map((f) => `<option value="${escapeHtml(f.fragmentId)}" data-view-path="${escapeHtml(f.viewPath)}">${escapeHtml(f.fragmentId)} (${escapeHtml(f.viewPath)})</option>`)
    ].join(""), 200, "text/html; mode=fragment");
  });

  app.get(`${API_BASE}/fragments-editor/fragment-target`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const fragmentId = url.searchParams.get("fragmentId") ?? "";
    const location = url.searchParams.get("location") ?? "";
    let targetPath = "";
    if (serviceId && fragmentId) {
      const config = await store.loadConfig();
      const hostname = getServiceHostname(config, serviceId);
      if (hostname) {
        const frags = await fetchServiceFragments(hostname, location || undefined);
        targetPath = frags.find((f) => f.fragmentId === fragmentId)?.viewPath ?? "";
      }
    }
    return htmlResponse(
      `<input id="bp-frag-target-${escapeHtml(location)}" type="text" name="targetPath" class="form-control form-control-sm font-monospace" value="${escapeHtml(targetPath)}" placeholder="auto-filled" required />`,
      200,
      "text/html; mode=fragment"
    );
  });

  app.post(`${API_BASE}/fragments-editor/move-down`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const idx = parseInt(f.index, 10);
    const frags = getFragments(appDef, f.location);
    if (idx >= 0 && idx < frags.length - 1) {
      const [it] = frags.splice(idx, 1);
      frags.splice(idx + 1, 0, it);
    }
    setFragments(appDef, f.location, frags);
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });
}
