import type {
  BetterPortalH3App,
  BetterPortalEvent,
  PlatformConfigStore
} from "@betterportal/framework";
import {
  htmlResponse,
  jsonResponse,
  uuidv7
} from "@betterportal/framework";
import { getManifestCache } from "./syncApi.js";

const API_BASE = "/.well-known/bp/admin";

// -- Types ------------------------------------------------------------

interface MenuItem {
  id: string;
  type: "link" | "group" | "section" | "divider" | "external";
  title?: string;
  icon?: string;
  routeId?: string;
  href?: string;
  enabled: boolean;
  defaultExpanded?: boolean;
  children?: MenuItem[];
}

interface Route {
  id: string;
  path: string;
  title?: string;
  serviceId?: string;
  viewId?: string;
  targetPath?: string;
}

// -- Helpers ----------------------------------------------------------

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

function locate(items: MenuItem[], id: string, parent: MenuItem[] = items):
  { item: MenuItem; parent: MenuItem[]; index: number } | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return { item: items[i], parent: items, index: i };
    if (items[i].type === "group" && items[i].children) {
      const found = locate(items[i].children!, id, items[i].children!);
      if (found) return found;
    }
  }
  return null;
}

function findGroupParent(items: MenuItem[], id: string): MenuItem | null {
  for (const it of items) {
    if (it.type === "group" && it.children) {
      if (it.children.some((c) => c.id === id)) return it;
      const deeper = findGroupParent(it.children, id);
      if (deeper) return deeper;
    }
  }
  return null;
}

function getApp(config: any, appId: string): any | null {
  return config.apps.find((a: any) => a.id === appId) ?? null;
}

function getMenu(appDef: any): MenuItem[] {
  return (appDef.menu ?? []) as MenuItem[];
}

function getRoutes(appDef: any): Route[] {
  return (appDef.routes ?? []) as Route[];
}

function getServiceTitle(config: any, serviceId: string | undefined): string {
  if (!serviceId) return "-";
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

/**
 * Read views for a service from the local manifest cache. CM cannot reach
 * services, so all editor dropdowns come from the cache that services pushed
 * via /sync/poll. If a service hasn't synced yet, returns empty.
 */
function lookupServiceViews(serviceId: string): Array<{ viewId: string; title: string; path: string }> {
  if (!serviceId) return [];
  const cache = getManifestCache();
  const entry = cache.get(serviceId);
  if (!entry) return [];
  return Object.values(entry.viewIndex)
    .filter((v) => v.renderable)
    .map((v) => ({
      viewId: v.viewId,
      title: v.viewId,
      path: v.path
    }));
}

// -- Row renderer (3 modes per item) ----------------------------------

type RowMode = "display" | "edit-title" | "edit-external" | "edit-link";

function rowAttrs(item: MenuItem, depth: number): string {
  return `id="bp-menu-row-${item.id}" draggable="true" data-bp-drag-item="${item.id}" data-bp-drag-type="${item.type}" data-bp-drag-depth="${depth}" style="padding-left: ${depth * 1.5 + 1}rem;"`;
}

function titleDisplayHtml(item: MenuItem, route: Route | null, appId: string): string {
  const titleText =
    item.type === "divider" ? "- divider -" :
    item.type === "section" ? `[${item.title || "Section"}]` :
    item.type === "external" ? (item.title || item.href || "External") :
    item.type === "group" ? (item.title || "Group") :
    item.title || route?.title || route?.path || item.routeId || "(missing)";

  const editAction = item.type === "divider" ? "" : "edit-title";
  const strikeClass = item.enabled ? "" : "text-decoration-line-through opacity-50";

  if (!editAction) {
    return `<span class="text-secondary fst-italic">${escapeHtml(titleText)}</span>`;
  }

  return `<button type="button" class="bp-menu-title-display ${strikeClass}"
    style="border:1px solid var(--bs-border-color); border-radius:0.375rem; padding:0.25rem 0.6rem; background:transparent; cursor:text; text-align:left; min-width:200px; font-weight:500;"
    hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=edit-title"
    hx-target="#bp-menu-row-${item.id}"
    hx-swap="outerHTML"
    title="Click to rename">${escapeHtml(titleText)}</button>`;
}

function subLineHtml(item: MenuItem, route: Route | null, config: any, appId: string): string {
  if (item.type === "group") {
    const count = item.children?.length ?? 0;
    return `<div class="small text-secondary">${count} item${count === 1 ? "" : "s"}</div>`;
  }
  if (item.type === "divider" || item.type === "section") return "";

  if (item.type === "external") {
    return `<div class="small d-flex align-items-center gap-2">
      <span class="text-secondary">URL:</span>
      <span class="font-monospace text-truncate" style="max-width: 360px;">${escapeHtml(item.href ?? "")}</span>
      <button type="button" class="btn btn-sm btn-link p-0"
        hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=edit-external"
        hx-target="#bp-menu-row-${item.id}"
        hx-swap="outerHTML"
        title="Edit URL">Edit</button>
    </div>`;
  }

  // type === "link" with routeId
  if (!route) {
    return `<div class="small text-danger">Missing route: ${escapeHtml(item.routeId ?? "(none)")}</div>`;
  }

  const serviceTitle = getServiceTitle(config, route.serviceId);
  return `<div class="small d-flex align-items-center gap-2 flex-wrap">
    <span class="badge text-bg-secondary">${escapeHtml(serviceTitle)}</span>
    <span class="text-secondary">-</span>
    <span class="font-monospace">${escapeHtml(route.viewId ?? "(view?)")}</span>
    <span class="text-secondary">-></span>
    <span class="font-monospace text-secondary">${escapeHtml(route.path)}</span>
    ${route.targetPath && route.targetPath !== route.path ? `<span class="text-secondary">(target: <span class="font-monospace">${escapeHtml(route.targetPath)}</span>)</span>` : ""}
    <button type="button" class="btn btn-sm btn-link p-0 ms-1"
      hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=edit-link"
      hx-target="#bp-menu-row-${item.id}"
      hx-swap="outerHTML"
      title="Edit URL & paths">Edit</button>
  </div>`;
}

function actionButtons(item: MenuItem, appId: string): string {
  const btn = (action: string, label: string, btnClass: string, title: string) =>
    `<form hx-post="${API_BASE}/menu-editor/${action}" hx-target="#bp-menu-editor" hx-swap="outerHTML" class="d-inline m-0">
      <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
      <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
      <button type="submit" class="btn btn-sm ${btnClass}" title="${escapeHtml(title)}">${label}</button>
    </form>`;

  const expandedBtn = item.type === "group"
    ? btn(
      "toggle-expanded",
      item.defaultExpanded ? "expanded" : "collapsed",
      item.defaultExpanded ? "btn-info" : "btn-outline-secondary",
      item.defaultExpanded ? "Default state: expanded (click to collapse)" : "Default state: collapsed (click to expand)"
    )
    : "";

  return `<div class="btn-group btn-group-sm" role="group">
    ${expandedBtn}
    ${btn("toggle", item.enabled ? "on" : "off", item.enabled ? "btn-success" : "btn-outline-secondary", item.enabled ? "Disable" : "Enable")}
    ${btn("remove", "x", "btn-outline-danger", "Remove")}
  </div>`;
}

function renderRow(item: MenuItem, depth: number, mode: RowMode, config: any, appDef: any, appId: string): string {
  const routes = getRoutes(appDef);
  const route = item.routeId ? routes.find((r) => r.id === item.routeId) ?? null : null;
  const typeBadgeClass = item.type === "group" ? "text-bg-warning" : item.type === "external" ? "text-bg-info" : item.type === "link" ? "text-bg-primary" : "text-bg-secondary";

  if (mode === "edit-title") {
    return `<li ${rowAttrs(item, depth)} class="list-group-item">
      <form hx-post="${API_BASE}/menu-editor/save-title" hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML"
        class="d-flex align-items-center gap-2">
        <span class="badge ${typeBadgeClass}">${escapeHtml(item.type)}</span>
        <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
        <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
        <input type="text" name="title" class="form-control form-control-sm flex-grow-1" value="${escapeHtml(item.title ?? "")}" autofocus />
        <button type="submit" class="btn btn-sm btn-success" title="Save">OK</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" title="Cancel"
          hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=display"
          hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML">X</button>
      </form>
    </li>`;
  }

  if (mode === "edit-external" && item.type === "external") {
    return `<li ${rowAttrs(item, depth)} class="list-group-item">
      <form hx-post="${API_BASE}/menu-editor/save-external" hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML"
        class="d-flex flex-column gap-2">
        <div class="d-flex align-items-center gap-2">
          <span class="badge ${typeBadgeClass}">${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title || "External")}</strong>
        </div>
        <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
        <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
        <label class="form-label small mb-0">URL</label>
        <input type="url" name="href" class="form-control form-control-sm" value="${escapeHtml(item.href ?? "")}" placeholder="https://..." required />
        <div class="d-flex gap-2 justify-content-end">
          <button type="submit" class="btn btn-sm btn-success">OK Save</button>
          <button type="button" class="btn btn-sm btn-outline-secondary"
            hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=display"
            hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML">X Cancel</button>
        </div>
      </form>
    </li>`;
  }

  // display mode
  return `<li ${rowAttrs(item, depth)} class="list-group-item">
    <div class="d-flex align-items-start gap-3">
      <span class="text-secondary" style="cursor:grab; padding-top:0.3rem; user-select:none; font-size:0.75rem; line-height:1;" title="Drag to reorder">drag</span>
      <div class="d-flex flex-column gap-1 flex-grow-1 min-width-0">
        <div class="d-flex align-items-center gap-2">
          <span class="badge ${typeBadgeClass}">${escapeHtml(item.type)}</span>
          ${titleDisplayHtml(item, route, appId)}
        </div>
        ${subLineHtml(item, route, config, appId)}
      </div>
      ${actionButtons(item, appId)}
    </div>
  </li>`;
}

function renderViewOptions(views: Array<{ viewId: string; title: string; path: string }>, selectedViewId: string): string {
  return [
    `<option value="">Select view...</option>`,
    ...views.map((v) => `<option value="${escapeHtml(v.viewId)}" data-default-path="${escapeHtml(v.path)}"${v.viewId === selectedViewId ? " selected" : ""}>${escapeHtml(v.title)} (${escapeHtml(v.path)})</option>`)
  ].join("");
}

async function renderEditLink(item: MenuItem, route: Route | null, depth: number, config: any, appDef: any, appId: string): Promise<string> {
  const typeBadgeClass = "text-bg-primary";
  const services = getServicesForApp(config, appDef);
  // Views come from the local manifest cache, not a fetch (CM cannot reach services).
  const views = route?.serviceId ? lookupServiceViews(route.serviceId) : [];
  const serviceOpts = [`<option value="">Select service...</option>`,
    ...services.map((s) => `<option value="${escapeHtml(s.id)}"${s.id === route?.serviceId ? " selected" : ""}>${escapeHtml(s.title)}</option>`)
  ].join("");
  const viewOpts = renderViewOptions(views, route?.viewId ?? "");

  return `<li ${rowAttrs(item, depth)} class="list-group-item">
    <form hx-post="${API_BASE}/menu-editor/save-link" hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML"
      class="d-flex flex-column gap-2">
      <div class="d-flex align-items-center gap-2">
        <span class="badge ${typeBadgeClass}">link</span>
        <strong>${escapeHtml(item.title || route?.title || "Link")}</strong>
        <span class="small text-secondary ms-auto">Editing link binding</span>
      </div>
      <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
      <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label small mb-0">Service</label>
          <select name="serviceId" class="form-select form-select-sm" required
            hx-get="${API_BASE}/menu-editor/views"
            hx-target="#bp-views-${item.id}"
            hx-swap="innerHTML"
            hx-trigger="change"
            hx-include="this">${serviceOpts}</select>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-0">View</label>
          <select id="bp-views-${item.id}" name="viewId" class="form-select form-select-sm" required
            hx-get="${API_BASE}/menu-editor/default-target"
            hx-target="[name=targetPath]"
            hx-swap="outerHTML"
            hx-trigger="change"
            hx-include="closest form">${viewOpts}</select>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-md-4">
          <label class="form-label small mb-0">Title (menu)</label>
          <input type="text" name="title" class="form-control form-control-sm" value="${escapeHtml(item.title ?? "")}" placeholder="${escapeHtml(route?.title ?? "")}" />
        </div>
        <div class="col-md-4">
          <label class="form-label small mb-0">Public Path</label>
          <input type="text" name="path" class="form-control form-control-sm font-monospace" value="${escapeHtml(route?.path ?? "")}" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small mb-0">Target Path (service)</label>
          <input type="text" name="targetPath" class="form-control form-control-sm font-monospace" value="${escapeHtml(route?.targetPath ?? "")}" placeholder="/path?param=value" />
        </div>
      </div>
      <div class="d-flex gap-2 justify-content-end">
        <button type="submit" class="btn btn-sm btn-success">OK Save</button>
        <button type="button" class="btn btn-sm btn-outline-secondary"
          hx-get="${API_BASE}/menu-editor/item?appId=${encodeURIComponent(appId)}&itemId=${encodeURIComponent(item.id)}&mode=display"
          hx-target="#bp-menu-row-${item.id}" hx-swap="outerHTML">X Cancel</button>
      </div>
      <div class="small text-secondary">Path/target/service/view edits update the underlying route - affects any other menu items referencing it.</div>
    </form>
  </li>`;
}

function renderTree(items: MenuItem[], depth: number, config: any, appDef: any, appId: string): string {
  return items.map((item) => {
    const row = renderRow(item, depth, "display", config, appDef, appId);
    const children = item.type === "group" && item.children && item.children.length > 0
      ? renderTree(item.children, depth + 1, config, appDef, appId)
      : "";
    return row + children;
  }).join("");
}

function collectGroups(items: MenuItem[]): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  const walk = (xs: MenuItem[], prefix = "") => {
    for (const x of xs) {
      if (x.type === "group") {
        const label = prefix ? `${prefix} / ${x.title ?? "Group"}` : (x.title ?? "Group");
        out.push({ id: x.id, title: label });
        if (x.children) walk(x.children, label);
      }
    }
  };
  walk(items);
  return out;
}

function renderAddForms(appId: string, routes: Route[], groups: { id: string; title: string }[]): string {
  const routeOpts = routes.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.title || r.path)} (${escapeHtml(r.path)})</option>`).join("");
  const groupOpts = ["<option value=\"\">(root)</option>", ...groups.map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.title)}</option>`)].join("");

  return `<div class="row g-3 mt-4">
    <div class="col-md-4">
      <div class="card">
        <div class="card-header"><strong>Add View Link</strong></div>
        <div class="card-body">
          <form hx-post="${API_BASE}/menu-editor/add" hx-target="#bp-menu-editor" hx-swap="outerHTML">
            <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
            <input type="hidden" name="type" value="link" />
            <div class="mb-2">
              <label class="form-label small">Route</label>
              <select class="form-select form-select-sm" name="routeId" required>
                <option value="">Select route...</option>
                ${routeOpts}
              </select>
            </div>
            <div class="mb-2">
              <label class="form-label small">Title (optional)</label>
              <input type="text" class="form-control form-control-sm" name="title" placeholder="Defaults to route title" />
            </div>
            <div class="mb-2">
              <label class="form-label small">Parent Group</label>
              <select class="form-select form-select-sm" name="parentId">${groupOpts}</select>
            </div>
            <button type="submit" class="btn btn-primary btn-sm w-100">Add Link</button>
          </form>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card">
        <div class="card-header"><strong>Add External Link</strong></div>
        <div class="card-body">
          <form hx-post="${API_BASE}/menu-editor/add" hx-target="#bp-menu-editor" hx-swap="outerHTML">
            <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
            <input type="hidden" name="type" value="external" />
            <div class="mb-2">
              <label class="form-label small">Title</label>
              <input type="text" class="form-control form-control-sm" name="title" required />
            </div>
            <div class="mb-2">
              <label class="form-label small">URL</label>
              <input type="url" class="form-control form-control-sm" name="href" placeholder="https://..." required />
            </div>
            <div class="mb-2">
              <label class="form-label small">Parent Group</label>
              <select class="form-select form-select-sm" name="parentId">${groupOpts}</select>
            </div>
            <button type="submit" class="btn btn-info btn-sm w-100">Add External</button>
          </form>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card">
        <div class="card-header"><strong>Add Group</strong></div>
        <div class="card-body">
          <form hx-post="${API_BASE}/menu-editor/add" hx-target="#bp-menu-editor" hx-swap="outerHTML">
            <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
            <input type="hidden" name="type" value="group" />
            <div class="mb-2">
              <label class="form-label small">Title</label>
              <input type="text" class="form-control form-control-sm" name="title" placeholder="Group name" required />
            </div>
            <div class="mb-2">
              <label class="form-label small">Parent Group</label>
              <select class="form-select form-select-sm" name="parentId">${groupOpts}</select>
            </div>
            <button type="submit" class="btn btn-warning btn-sm w-100">Add Group</button>
          </form>
        </div>
      </div>
    </div>
  </div>`;
}

function renderEditor(config: any, appDef: any, appId: string): string {
  const menu = getMenu(appDef);
  const routes = getRoutes(appDef);
  const tree = menu.length === 0
    ? `<li class="list-group-item text-secondary">No menu items. Use forms below to add.</li>`
    : renderTree(menu, 0, config, appDef, appId);
  const groups = collectGroups(menu);

  return `<div id="bp-menu-editor" data-bp-app-id="${escapeHtml(appId)}">
    <form id="bp-drag-move-form" style="display:none"
      hx-post="${API_BASE}/menu-editor/move-after"
      hx-target="#bp-menu-editor"
      hx-swap="outerHTML">
      <input type="hidden" name="appId" value="${escapeHtml(appId)}" />
      <input type="hidden" name="itemId" />
      <input type="hidden" name="anchorId" />
      <input type="hidden" name="targetDepth" />
    </form>
    <ul class="list-group">${tree}</ul>
    ${renderAddForms(appId, routes, groups)}
  </div>`;
}

// -- Endpoint registration --------------------------------------------

export function registerMenuEditorRoutes(app: BetterPortalH3App, store: PlatformConfigStore): void {

  const respondEditor = async (appId: string): Promise<Response> => {
    const config = await store.loadConfig();
    const appDef = getApp(config, appId);
    if (!appDef) return htmlResponse(`<div class="alert alert-danger">App not found</div>`, 200, "text/html; mode=fragment");
    return htmlResponse(renderEditor(config, appDef, appId), 200, "text/html; mode=fragment", {
      "HX-Trigger": "bp:menu-changed"
    });
  };

  const respondRow = async (appId: string, itemId: string, mode: RowMode): Promise<Response> => {
    const config = await store.loadConfig();
    const appDef = getApp(config, appId);
    if (!appDef) return htmlResponse("", 200, "text/html; mode=fragment");
    const menu = getMenu(appDef);
    const found = locate(menu, itemId);
    if (!found) return htmlResponse("", 200, "text/html; mode=fragment");

    // Determine depth by walking up
    let depth = 0;
    const computeDepth = (items: MenuItem[], target: string, d: number): number => {
      for (const it of items) {
        if (it.id === target) return d;
        if (it.type === "group" && it.children) {
          const r = computeDepth(it.children, target, d + 1);
          if (r >= 0) return r;
        }
      }
      return -1;
    };
    depth = computeDepth(menu, itemId, 0);
    if (depth < 0) depth = 0;

    if (mode === "edit-link" && found.item.type === "link") {
      const route = (appDef.routes ?? []).find((r: any) => r.id === found.item.routeId) ?? null;
      const html = await renderEditLink(found.item, route, depth, config, appDef, appId);
      return htmlResponse(html, 200, "text/html; mode=fragment");
    }
    return htmlResponse(renderRow(found.item, depth, mode, config, appDef, appId), 200, "text/html; mode=fragment");
  };

  app.get(`${API_BASE}/menu-editor`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const appId = url.searchParams.get("appId") ?? "";
    if (!appId) return htmlResponse(`<div class="alert alert-secondary">Select an app</div>`, 200, "text/html; mode=fragment");
    return respondEditor(appId);
  });

  app.get(`${API_BASE}/menu-editor/item`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const appId = url.searchParams.get("appId") ?? "";
    const itemId = url.searchParams.get("itemId") ?? "";
    const mode = (url.searchParams.get("mode") ?? "display") as RowMode;
    return respondRow(appId, itemId, mode);
  });

  app.post(`${API_BASE}/menu-editor/save-title`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found) found.item.title = f.title || undefined;
    appDef.menu = menu;
    await store.saveConfig(config);
    // Return single row + HX-Trigger to refresh sidebar nav
    const config2 = await store.loadConfig();
    const appDef2 = getApp(config2, f.appId);
    const found2 = appDef2 ? locate(getMenu(appDef2), f.itemId) : null;
    if (!appDef2 || !found2) return htmlResponse("", 200, "text/html; mode=fragment");
    const depth = (() => {
      let d = -1;
      const walk = (xs: MenuItem[], target: string, cur: number) => {
        for (const it of xs) {
          if (it.id === target) { d = cur; return; }
          if (it.type === "group" && it.children) walk(it.children, target, cur + 1);
        }
      };
      walk(getMenu(appDef2), f.itemId, 0);
      return d < 0 ? 0 : d;
    })();
    return htmlResponse(renderRow(found2.item, depth, "display", config2, appDef2, f.appId), 200, "text/html; mode=fragment", {
      "HX-Trigger": "bp:menu-changed"
    });
  });

  app.post(`${API_BASE}/menu-editor/save-link`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (!found || found.item.type !== "link" || !found.item.routeId) {
      return htmlResponse(`<div class="alert alert-danger">Item not found</div>`, 200, "text/html; mode=fragment");
    }
    found.item.title = f.title || undefined;

    const route = (appDef.routes ?? []).find((r: any) => r.id === found.item.routeId);
    if (route) {
      if (f.serviceId) route.serviceId = f.serviceId;
      if (f.viewId) route.viewId = f.viewId;
      if (f.path) route.path = f.path;
      if (f.targetPath !== undefined) route.targetPath = f.targetPath;
    }

    appDef.menu = menu;
    await store.saveConfig(config);
    return respondRow(f.appId, f.itemId, "display").then((r) => {
      const headers = new Headers(r.headers);
      headers.set("HX-Trigger", "bp:menu-changed");
      return new Response(r.body, { status: r.status, headers });
    });
  });

  // Cascade: serviceId change -> view options (sourced from local manifest cache)
  app.get(`${API_BASE}/menu-editor/views`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    if (!serviceId) return htmlResponse(`<option value="">Select view...</option>`, 200, "text/html; mode=fragment");
    const views = lookupServiceViews(serviceId);
    return htmlResponse(renderViewOptions(views, ""), 200, "text/html; mode=fragment");
  });

  // View change -> returns new targetPath input pre-filled with view's default path
  app.get(`${API_BASE}/menu-editor/default-target`, async (event) => {
    const url = new URL(event.req.url ?? "", `http://${event.req.headers.get("host") ?? "localhost"}`);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const viewId = url.searchParams.get("viewId") ?? "";
    let defaultPath = "";
    if (serviceId && viewId) {
      const views = lookupServiceViews(serviceId);
      defaultPath = views.find((v) => v.viewId === viewId)?.path ?? "";
    }
    return htmlResponse(
      `<input type="text" name="targetPath" class="form-control form-control-sm font-monospace" value="${escapeHtml(defaultPath)}" placeholder="/path?param=value" />`,
      200,
      "text/html; mode=fragment"
    );
  });

  app.post(`${API_BASE}/menu-editor/save-external`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found) {
      found.item.href = f.href || "";
      if (f.title !== undefined && f.title !== "") found.item.title = f.title;
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondRow(f.appId, f.itemId, "display").then((r) => {
      // Add HX-Trigger to existing response
      const headers = new Headers(r.headers);
      headers.set("HX-Trigger", "bp:menu-changed");
      return new Response(r.body, { status: r.status, headers });
    });
  });

  app.post(`${API_BASE}/menu-editor/add`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);

    const type = (f.type as MenuItem["type"]) ?? "link";
    const newItem: MenuItem = {
      id: uuidv7(),
      type,
      title: f.title || undefined,
      routeId: f.routeId || undefined,
      href: f.href || undefined,
      enabled: true,
      ...(type === "group" ? { children: [] } : {})
    };

    const menu = getMenu(appDef);
    if (f.parentId) {
      const found = locate(menu, f.parentId);
      if (found && found.item.type === "group") {
        found.item.children = found.item.children ?? [];
        found.item.children.push(newItem);
      } else {
        menu.push(newItem);
      }
    } else {
      menu.push(newItem);
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/remove`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found) found.parent.splice(found.index, 1);
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/toggle`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found) found.item.enabled = !found.item.enabled;
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/toggle-expanded`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found && found.item.type === "group") {
      found.item.defaultExpanded = !found.item.defaultExpanded;
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/move-up`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found && found.index > 0) {
      const [it] = found.parent.splice(found.index, 1);
      found.parent.splice(found.index - 1, 0, it);
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/move-down`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found && found.index < found.parent.length - 1) {
      const [it] = found.parent.splice(found.index, 1);
      found.parent.splice(found.index + 1, 0, it);
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/move-in`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const found = locate(menu, f.itemId);
    if (found && found.index > 0) {
      const prev = found.parent[found.index - 1];
      if (prev.type === "group") {
        const [it] = found.parent.splice(found.index, 1);
        prev.children = prev.children ?? [];
        prev.children.push(it);
      }
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/move-after`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const srcId = f.itemId;
    const anchorId = f.anchorId || "";
    const targetDepth = Math.max(0, parseInt(f.targetDepth ?? "0", 10) || 0);

    if (!srcId || srcId === anchorId) return respondEditor(f.appId);

    const src = locate(menu, srcId);
    if (!src) return respondEditor(f.appId);

    // Prevent dropping into own descendant
    const isDescendant = (items: MenuItem[], id: string): boolean => {
      for (const it of items) {
        if (it.id === id) return true;
        if (it.type === "group" && it.children && isDescendant(it.children, id)) return true;
      }
      return false;
    };
    if (anchorId && src.item.type === "group" && src.item.children && isDescendant(src.item.children, anchorId)) {
      return respondEditor(f.appId);
    }

    // Remove src
    const [srcItem] = src.parent.splice(src.index, 1);

    if (!anchorId) {
      // Insert at start of root
      menu.unshift(srcItem);
      appDef.menu = menu;
      await store.saveConfig(config);
      return respondEditor(f.appId);
    }

    // Build ancestor chain to anchor
    const ancestorChain = (
      items: MenuItem[], id: string,
      chain: Array<{ item: MenuItem; parent: MenuItem[]; index: number; depth: number }> = [],
      depth = 0
    ): typeof chain | null => {
      for (let i = 0; i < items.length; i++) {
        const cur = { item: items[i], parent: items, index: i, depth };
        if (items[i].id === id) return [...chain, cur];
        if (items[i].type === "group" && items[i].children) {
          const r = ancestorChain(items[i].children!, id, [...chain, cur], depth + 1);
          if (r) return r;
        }
      }
      return null;
    };

    const chain = ancestorChain(menu, anchorId);
    if (!chain) {
      src.parent.splice(src.index, 0, srcItem);
      return respondEditor(f.appId);
    }

    const anchor = chain[chain.length - 1];
    const anchorDepth = anchor.depth;
    // Groups can only live at root (data model doesn't support nested groups)
    const srcIsGroup = srcItem.type === "group";
    const maxDepth = srcIsGroup ? 0 : (anchorDepth + (anchor.item.type === "group" ? 1 : 0));
    const clampedDepth = Math.max(0, Math.min(targetDepth, maxDepth));

    if (clampedDepth > anchorDepth && anchor.item.type === "group") {
      anchor.item.children = anchor.item.children ?? [];
      anchor.item.children.unshift(srcItem);
    } else if (clampedDepth >= anchorDepth) {
      anchor.parent.splice(anchor.index + 1, 0, srcItem);
    } else {
      const ancestor = chain[clampedDepth];
      if (ancestor) {
        ancestor.parent.splice(ancestor.index + 1, 0, srcItem);
      } else {
        menu.push(srcItem);
      }
    }

    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });

  app.post(`${API_BASE}/menu-editor/move-out`, async (event) => {
    const f = await readFormBody(event);
    const config = await store.loadConfig();
    const appDef = getApp(config, f.appId);
    if (!appDef) return jsonResponse({ error: "App not found" }, 404);
    const menu = getMenu(appDef);
    const parentGroup = findGroupParent(menu, f.itemId);
    if (parentGroup) {
      const grandFound = locate(menu, parentGroup.id);
      const found = locate(menu, f.itemId);
      if (grandFound && found) {
        const [it] = found.parent.splice(found.index, 1);
        grandFound.parent.splice(grandFound.index + 1, 0, it);
      }
    }
    appDef.menu = menu;
    await store.saveConfig(config);
    return respondEditor(f.appId);
  });
}
