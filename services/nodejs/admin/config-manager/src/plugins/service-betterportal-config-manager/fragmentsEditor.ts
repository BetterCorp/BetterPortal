import type { BetterPortalEvent, BetterPortalH3App, PlatformConfigStore, ThemeFragmentDescriptor } from "@betterportal/framework";
import { htmlResponse, jsonResponse } from "@betterportal/framework";
import { getCachedManifestForService } from "./syncApi.js";

const API_BASE = "/.well-known/bp/admin/fragments-editor";
const RELATIVE_URL_PARSE_BASE = "http://betterportal.invalid";

type Item =
  | { source: "theme"; fragmentId: string }
  | { source: "service"; serviceId: string; fragmentId: string; targetPath: string };

async function readForm(event: BetterPortalEvent): Promise<Record<string, string>> {
  const data = await event.req.formData().catch(() => null);
  const result: Record<string, string> = {};
  data?.forEach((value, key) => { if (typeof value === "string") result[key] = value; });
  return result;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function appFor(config: any, appId: string): any | null {
  return config.apps.find((app: any) => app.id === appId) ?? null;
}

function servicesFor(config: any, app: any): any[] {
  const tenant = config.tenants.find((candidate: any) => candidate.id === app.tenantId);
  const shared = (config.sharedServiceActivations ?? []).flatMap((activation: any) => {
    if (!activation.enabled || activation.tenantId !== app.tenantId || (activation.appId && activation.appId !== app.id)) return [];
    const service = config.sharedServiceCatalog.find((candidate: any) => candidate.enabled && candidate.id === activation.sharedServiceId);
    return service ? [{ ...service, id: activation.id, hostname: service.baseUrl }] : [];
  });
  return [
    ...(tenant?.services ?? []),
    ...(config.platformServices ?? []).filter((service: any) => tenant?.activatedPlatformServices?.includes(service.id)),
    ...shared
  ].filter((service: any) => service.enabled);
}

function serviceFor(config: any, app: any, serviceId: string): any | null {
  return servicesFor(config, app).find((service: any) => service.id === serviceId) ?? null;
}

function serviceLabel(config: any, app: any, serviceId: string): string {
  const service = serviceFor(config, app, serviceId);
  return service ? `${service.title || service.serviceId || service.id} · ${service.serviceId || service.id}` : serviceId;
}

function settingsFor(app: any, themeServiceId: string): Record<string, any> {
  app.themeFragments = app.themeFragments ?? {};
  app.themeFragments[themeServiceId] = app.themeFragments[themeServiceId] ?? {};
  return app.themeFragments[themeServiceId];
}

function effectiveBlockItems(app: any, themeServiceId: string, definition: ThemeFragmentDescriptor): Item[] {
  const setting = app.themeFragments?.[themeServiceId]?.[definition.id];
  if (setting?.mode === "none") return [];
  if (setting?.mode === "items") return [...setting.items];
  if (setting?.mode === "override") return [setting.item];
  const legacy = app.fragments?.[definition.id] ?? [];
  if (legacy.length) return legacy.filter((item: any) => item.enabled).map((item: any) => ({
    source: "service",
    ...item,
    fragmentId: item.fragmentId.includes(".") ? item.fragmentId : `${definition.id}.${item.fragmentId}`
  }));
  const legacySlots = (app.slots ?? []).flatMap((slot: any) => {
    if (!slot.enabled || !slot.slotId.startsWith(`${definition.id}.`)) return [];
    const route = app.routes.find((candidate: any) => candidate.enabled !== false
      && candidate.serviceId === slot.serviceId
      && candidate.viewId === slot.viewId);
    const targetPath = route?.resolvedServicePath ?? route?.targetPath;
    return targetPath ? [{ source: "service" as const, serviceId: slot.serviceId, fragmentId: slot.slotId, targetPath }] : [];
  });
  if (legacySlots.length) return legacySlots;
  return definition.defaultItems.map((fragmentId) => ({ source: "theme", fragmentId }));
}

function encodeItem(item: Item): string {
  return item.source === "theme"
    ? `t:${encodeURIComponent(item.fragmentId)}`
    : `s:${item.serviceId}:${encodeURIComponent(item.fragmentId)}:${encodeURIComponent(item.targetPath)}`;
}

function decodeItem(value: string): Item | null {
  try {
    const parts = value.split(":");
    if (parts[0] === "t" && parts[1]) return { source: "theme", fragmentId: decodeURIComponent(parts[1]) };
    if (parts[0] === "s" && parts.length === 4) return {
      source: "service",
      serviceId: parts[1],
      fragmentId: decodeURIComponent(parts[2]),
      targetPath: decodeURIComponent(parts[3])
    };
  } catch { return null; }
  return null;
}

function availableItems(config: any, app: any, definitions: ThemeFragmentDescriptor[]): Array<{ item: Item; label: string }> {
  const builtIns = definitions
    .filter((definition) => definition.kind === "fragment")
    .map((definition) => ({ item: { source: "theme", fragmentId: definition.id } as Item, label: `Theme · ${definition.title}` }));
  const services = servicesFor(config, app);
  const serviceItems = services.flatMap((service: any) => {
    const manifest = getCachedManifestForService(config, service.id);
    return Object.values(manifest?.viewIndex ?? {}).flatMap((view: any) => view.fragments
      .filter((fragment: any) => app.routes.some((route: any) => route.enabled !== false
        && route.serviceId === service.id
        && (route.resolvedServicePath ?? route.targetPath) === fragment.targetPath))
      .map((fragment: any) => ({
        item: { source: "service", serviceId: service.id, fragmentId: fragment.fragmentId, targetPath: fragment.targetPath } as Item,
        label: `${serviceLabel(config, app, service.id)} · ${fragment.fragmentId} (${fragment.targetPath})`
      })));
  });
  return [...builtIns, ...serviceItems];
}

function hidden(appId: string, themeServiceId: string, fragmentId: string): string {
  return `<input type="hidden" name="appId" value="${escapeHtml(appId)}"><input type="hidden" name="themeServiceId" value="${escapeHtml(themeServiceId)}"><input type="hidden" name="fragmentId" value="${escapeHtml(fragmentId)}">`;
}

function modeButtons(appId: string, themeServiceId: string, definition: ThemeFragmentDescriptor): string {
  const button = (mode: string, label: string, style: string) => `<form class="d-inline" hx-post="${API_BASE}/set-mode" hx-target="#bp-fragments-editor" hx-swap="outerHTML">${hidden(appId, themeServiceId, definition.id)}<input type="hidden" name="mode" value="${mode}"><button class="btn btn-sm ${style}" type="submit">${label}</button></form>`;
  return `<div class="btn-group">${button("default", "Use theme default", "btn-outline-secondary")}${button("none", "Empty", "btn-outline-danger")}</div>`;
}

function itemLabel(item: Item, config: any, app: any, definitions: ThemeFragmentDescriptor[]): string {
  if (item.source === "theme") return `Theme · ${definitions.find((definition) => definition.id === item.fragmentId)?.title ?? item.fragmentId}`;
  return `${serviceLabel(config, app, item.serviceId)} · ${item.fragmentId} (${item.targetPath})`;
}

function sourceSelect(items: Array<{ item: Item; label: string }>): string {
  return `<select name="source" class="form-select form-select-sm" required><option value="">Select fragment...</option>${items.map(({ item, label }) => `<option value="${escapeHtml(encodeItem(item))}">${escapeHtml(label)}</option>`).join("")}</select>`;
}

function renderDefinition(config: any, app: any, themeServiceId: string, definition: ThemeFragmentDescriptor, definitions: ThemeFragmentDescriptor[], choices: Array<{ item: Item; label: string }>): string {
  const setting = app.themeFragments?.[themeServiceId]?.[definition.id];
  const status = setting?.mode ?? (app.fragments?.[definition.id]?.length ? "legacy default" : "theme default");
  if (definition.kind === "fragment") {
    return `<section class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center"><div><strong>${escapeHtml(definition.title)}</strong><div class="small text-secondary font-monospace">_${escapeHtml(definition.id)}.tsx · ${escapeHtml(status)}</div></div>${modeButtons(app.id, themeServiceId, definition)}</div><div class="card-body"><p class="small text-secondary">${escapeHtml(definition.description)}</p><form class="row g-2" hx-post="${API_BASE}/set-override" hx-target="#bp-fragments-editor" hx-swap="outerHTML">${hidden(app.id, themeServiceId, definition.id)}<div class="col">${sourceSelect(choices.filter(({ item }) => item.source === "service"))}</div><div class="col-auto"><button class="btn btn-sm btn-primary" type="submit">Override</button></div></form></div></section>`;
  }

  const items = effectiveBlockItems(app, themeServiceId, definition);
  const rows = items.length ? items.map((item, index) => `<li class="list-group-item d-flex justify-content-between align-items-center"><span>${escapeHtml(itemLabel(item, config, app, definitions))}</span><div class="btn-group">${["move-up", "move-down", "remove"].map((action) => `<form hx-post="${API_BASE}/${action}" hx-target="#bp-fragments-editor" hx-swap="outerHTML">${hidden(app.id, themeServiceId, definition.id)}<input type="hidden" name="index" value="${index}"><button class="btn btn-sm ${action === "remove" ? "btn-outline-danger" : "btn-outline-secondary"}" type="submit"${(action === "move-up" && index === 0) || (action === "move-down" && index === items.length - 1) ? " disabled" : ""}>${action === "move-up" ? "Move up" : action === "move-down" ? "Move down" : "Remove"}</button></form>`).join("")}</div></li>`).join("") : `<li class="list-group-item text-secondary">Empty block.</li>`;
  return `<section class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center"><div><strong>${escapeHtml(definition.title)}</strong><div class="small text-secondary font-monospace">_${escapeHtml(definition.id)}/index.tsx · ${escapeHtml(status)}</div></div>${modeButtons(app.id, themeServiceId, definition)}</div><ul class="list-group list-group-flush">${rows}</ul><div class="card-body"><p class="small text-secondary">${escapeHtml(definition.description)}</p><form class="row g-2" hx-post="${API_BASE}/add" hx-target="#bp-fragments-editor" hx-swap="outerHTML">${hidden(app.id, themeServiceId, definition.id)}<div class="col">${sourceSelect(choices)}</div><div class="col-auto"><button class="btn btn-sm btn-primary" type="submit">Add</button></div></form></div></section>`;
}

function renderEditor(config: any, app: any): string {
  const themeServiceId = app.shell?.serviceId;
  if (!themeServiceId) return `<div id="bp-fragments-editor" class="alert alert-secondary">This app has no active theme, so it has no theme fragments.</div>`;
  const manifest = getCachedManifestForService(config, themeServiceId);
  const definitions = manifest?.theme?.fragments ?? [];
  if (!definitions.length) return `<div id="bp-fragments-editor" class="alert alert-secondary">The active theme exposes no fragments or has not synced its manifest yet.</div>`;
  const choices = availableItems(config, app, definitions);
  return `<div id="bp-fragments-editor"><div class="mb-3"><strong>${escapeHtml(serviceLabel(config, app, themeServiceId))}</strong><div class="small text-secondary">Theme defaults are used until an explicit override, list, or empty value is saved.</div></div>${definitions.map((definition) => renderDefinition(config, app, themeServiceId, definition, definitions, choices)).join("")}</div>`;
}

export function registerFragmentsEditorRoutes(router: BetterPortalH3App, store: PlatformConfigStore): void {
  const respond = async (appId: string) => {
    const config = await store.loadConfig();
    const app = appFor(config, appId);
    return app
      ? htmlResponse(renderEditor(config, app), 200, "text/html; mode=fragment", { "HX-Trigger": "bp:fragments-changed" })
      : htmlResponse(`<div id="bp-fragments-editor" class="alert alert-danger">App not found.</div>`, 200, "text/html; mode=fragment");
  };
  const mutate = (handler: (
    form: Record<string, string>,
    app: any,
    settings: Record<string, any>,
    definition: ThemeFragmentDescriptor,
    choices: Array<{ item: Item; label: string }>
  ) => boolean) => async (event: BetterPortalEvent) => {
    const form = await readForm(event);
    const config = await store.loadConfig();
    const app = appFor(config, form.appId);
    if (!app || app.shell?.serviceId !== form.themeServiceId) return jsonResponse({ error: "Active theme changed; reload the editor" }, 409);
    const definitions = getCachedManifestForService(config, form.themeServiceId)?.theme?.fragments ?? [];
    const definition = definitions.find((candidate) => candidate.id === form.fragmentId);
    if (!definition) return jsonResponse({ error: "Theme fragment is unavailable; reload the editor" }, 409);
    const choices = availableItems(config, app, definitions);
    if (!handler(form, app, settingsFor(app, form.themeServiceId), definition, choices)) return jsonResponse({ error: "Invalid fragment editor operation" }, 400);
    await store.saveConfig(config);
    return respond(form.appId);
  };

  router.get(API_BASE, async (event) => {
    const appId = new URL(event.req.url ?? "", RELATIVE_URL_PARSE_BASE).searchParams.get("appId") ?? "";
    return appId ? respond(appId) : htmlResponse(`<div id="bp-fragments-editor" class="alert alert-secondary">Select an app.</div>`, 200, "text/html; mode=fragment");
  });
  router.post(`${API_BASE}/set-mode`, mutate((form, _app, settings) => {
    if (form.mode === "default") delete settings[form.fragmentId];
    else if (form.mode === "none") settings[form.fragmentId] = { mode: "none" };
    else return false;
    return true;
  }));
  router.post(`${API_BASE}/set-override`, mutate((form, _app, settings, definition, choices) => {
    const item = decodeItem(form.source);
    if (definition.kind !== "fragment" || item?.source !== "service" || !choices.some((choice) => encodeItem(choice.item) === form.source)) return false;
    settings[form.fragmentId] = { mode: "override", item };
    return true;
  }));
  router.post(`${API_BASE}/add`, mutate((form, app, settings, definition, choices) => {
    const item = decodeItem(form.source);
    if (definition.kind !== "block" || !item || !choices.some((choice) => encodeItem(choice.item) === form.source)) return false;
    const current = settings[form.fragmentId]?.mode === "items" ? [...settings[form.fragmentId].items] : effectiveBlockItems(app, form.themeServiceId, definition);
    settings[form.fragmentId] = { mode: "items", items: [...current, item] };
    return true;
  }));
  const editItems = (operation: (items: Item[], index: number) => boolean) => mutate((form, app, settings, definition) => {
    if (definition.kind !== "block") return false;
    const current = settings[form.fragmentId]?.mode === "items"
      ? [...settings[form.fragmentId].items]
      : effectiveBlockItems(app, form.themeServiceId, definition);
    if (!operation(current, Number(form.index))) return false;
    settings[form.fragmentId] = { mode: "items", items: current };
    return true;
  });
  router.post(`${API_BASE}/remove`, editItems((items, index) => {
    if (index < 0 || index >= items.length) return false;
    items.splice(index, 1);
    return true;
  }));
  router.post(`${API_BASE}/move-up`, editItems((items, index) => {
    if (index <= 0 || index >= items.length) return false;
    items.splice(index - 1, 0, ...items.splice(index, 1));
    return true;
  }));
  router.post(`${API_BASE}/move-down`, editItems((items, index) => {
    if (index < 0 || index >= items.length - 1) return false;
    items.splice(index + 1, 0, ...items.splice(index, 1));
    return true;
  }));
}
