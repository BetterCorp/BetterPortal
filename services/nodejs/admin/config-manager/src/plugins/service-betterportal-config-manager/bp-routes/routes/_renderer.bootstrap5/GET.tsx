/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";
import { appRoutePatternKey } from "../../../routeMounts.js";

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function manifestLoaderScript(services: ResponseData["availableServices"]): string {
  return `
(() => {
  const state = { token: Date.now() + ":" + Math.random() };
  window.__bpRouteDesignerManifest = state;
  const isCurrent = () => window.__bpRouteDesignerManifest === state;
  const services = ${scriptJson(services)};
  const byServiceId = new Map(services.map((service) => [
    service.id,
    { ...service, views: Array.isArray(service.views) ? service.views : [] }
  ]));

  const formatServiceLabel = (service) => {
    const title = String(service?.title || service?.id || "");
    const identity = String(service?.serviceId || service?.id || "");
    return identity && identity !== title ? title + " · " + identity : title;
  };

  const viewRenderable = (view) => {
    if (typeof view?.renderable === "boolean") return view.renderable;
    const renderers = view?.html?.renderers;
    return !!renderers && typeof renderers === "object" && Object.keys(renderers).length > 0;
  };

  const manifestViews = (manifest) => {
    if (!Array.isArray(manifest?.views)) return [];
    return manifest.views
      .map((view) => ({
        viewId: String(view.viewId || ""),
        title: String(view.title || view.viewId || ""),
        path: String(view.path || ""),
        pathVariants: Array.isArray(view.pathVariants) ? view.pathVariants.map(String) : [],
        paramsSchema: view.paramsSchema && typeof view.paramsSchema === "object" ? view.paramsSchema : undefined,
        methods: Array.isArray(view.methods) ? view.methods.map(String) : [],
        renderable: viewRenderable(view),
        dependencies: Array.isArray(view.dependencies) ? view.dependencies.map(String) : []
      }))
      .filter((view) => view.viewId);
  };

  const syncForm = (form) => {
    if (!isCurrent()) return;
    const service = form.querySelector("[data-bp-route-service]");
    const view = form.querySelector("[data-bp-route-view]");
    if (!service || !view) return;

    const selectedService = service.value;
    const selectedView = view.dataset.selectedView || view.value || "";
    const placeholder = view.querySelector("option[value='']")?.textContent || "Select view...";
    view.replaceChildren(new Option(placeholder, ""));

    for (const svc of byServiceId.values()) {
      for (const routeView of svc.views) {
        if (routeView.renderable === false && !(svc.id === selectedService && routeView.viewId === selectedView)) continue;
        const option = new Option(routeView.title || routeView.viewId, routeView.viewId);
        option.dataset.serviceId = svc.id;
        option.dataset.renderable = routeView.renderable === false ? "false" : "true";
        option.disabled = routeView.renderable === false && !(svc.id === selectedService && routeView.viewId === selectedView);
        option.selected = svc.id === selectedService && routeView.viewId === selectedView;
        view.appendChild(option);
      }
    }

    const selectedExists = Array.from(view.options).some((option) =>
      option.value === selectedView && option.dataset.serviceId === selectedService
    );
    if (selectedService && selectedView && !selectedExists) {
      const selectedServiceMeta = byServiceId.get(selectedService);
      const reason = !selectedServiceMeta
        ? "service unavailable"
        : selectedServiceMeta.manifestLoaded === false
          ? "service manifest not loaded"
          : "unavailable in current manifest";
      const option = new Option(selectedView + " — " + reason, selectedView, true, true);
      option.dataset.serviceId = selectedService;
      option.dataset.renderable = "true";
      option.dataset.unavailable = "true";
      view.appendChild(option);
    }

    let hasSelectedView = false;
    Array.from(view.options).forEach((option) => {
      if (!option.value) {
        option.hidden = false;
        option.disabled = false;
        return;
      }
      const visible = !selectedService || option.dataset.serviceId === selectedService;
      option.hidden = !visible;
      option.disabled = !visible;
      if (visible && option.selected) hasSelectedView = true;
    });
    if (hasSelectedView) {
      view.dataset.selectedView = view.value;
    } else {
      view.value = "";
    }
    syncRouteUiFields(form);
  };

  const syncRouteUiFields = (form) => {
    const selected = form.querySelector("[data-bp-route-view]")?.selectedOptions?.[0];
    const renderable = selected?.dataset?.renderable !== "false";
    form.querySelectorAll("[data-bp-ui-route-field]").forEach((field) => {
      field.disabled = !renderable;
      if (field.name === "path" || field.name === "title") field.required = renderable;
    });
    syncParamFields(form, renderable);
  };

  const pathParamNames = (path) => Array.from(new Set(String(path || "").split("/").flatMap((segment) => {
    const match = segment.match(/^:([A-Za-z_][A-Za-z0-9_]*)$/);
    return match ? [match[1]] : [];
  })));

  const selectedViewMeta = (form) => {
    const serviceId = form.querySelector("[data-bp-route-service]")?.value || "";
    const viewId = form.querySelector("[data-bp-route-view]")?.value || "";
    return byServiceId.get(serviceId)?.views.find((candidate) => candidate.viewId === viewId);
  };

  const syncParamFields = (form, renderable = true) => {
    const container = form.querySelector("[data-bp-route-params]");
    const servicePathSelect = form.querySelector("[data-bp-service-path]");
    if (!container || !servicePathSelect) return;
    const view = selectedViewMeta(form);
    const existingValues = {};
    container.querySelectorAll("[data-bp-fixed-param]").forEach((input) => {
      existingValues[input.dataset.bpFixedParam] = input.value;
    });
    let storedValues = {};
    try { storedValues = JSON.parse(container.dataset.fixedParams || "{}"); } catch {}

    const variants = view ? Array.from(new Set([view.path, ...(view.pathVariants || [])].filter(Boolean))) : [];
    const wantedPath = servicePathSelect.dataset.selectedPath || servicePathSelect.value || view?.path || "";
    servicePathSelect.replaceChildren();
    for (const path of variants) servicePathSelect.add(new Option(path, path, false, path === wantedPath));
    if (wantedPath && !variants.includes(wantedPath)) {
      servicePathSelect.add(new Option(wantedPath + " — unavailable", wantedPath, true, true));
    }
    if (!servicePathSelect.value && variants.length) servicePathSelect.value = variants[0];
    servicePathSelect.dataset.selectedPath = servicePathSelect.value;
    servicePathSelect.disabled = !view;

    if (!renderable) {
      container.replaceChildren();
      container.classList.add("d-none");
      form.querySelectorAll("button[type=submit]").forEach((button) => { button.disabled = false; });
      return;
    }

    const servicePath = servicePathSelect.value;
    const appPath = form.querySelector("[name=path]")?.value || "";
    const dynamicParams = new Set(pathParamNames(appPath));
    const names = pathParamNames(servicePath);
    container.replaceChildren();
    container.classList.toggle("d-none", names.length === 0);
    let complete = true;
    const properties = view?.paramsSchema?.properties || {};
    for (const name of names) {
      const dynamic = dynamicParams.has(name);
      const value = existingValues[name] ?? storedValues[name] ?? "";
      const rule = properties[name] && typeof properties[name] === "object" ? properties[name] : {};
      const maxLength = Math.min(Number.isInteger(rule.maxLength) ? rule.maxLength : 100, 100);
      const minLength = Number.isInteger(rule.minLength) ? rule.minLength : 1;
      const validFixed = value.length >= minLength && value.length <= maxLength
        && (!rule.pattern || (() => { try { return new RegExp(rule.pattern).test(value); } catch { return false; } })());
      const resolved = dynamic || validFixed;
      complete = complete && resolved;
      const row = document.createElement("div");
      row.className = "border rounded p-2 mb-2 " + (resolved ? "border-success bg-success-subtle" : "border-danger bg-danger-subtle");
      const header = document.createElement("div");
      header.className = "d-flex align-items-center justify-content-between gap-2";
      const code = document.createElement("code");
      code.textContent = ":" + name;
      const badge = document.createElement("span");
      badge.className = "badge " + (resolved ? "text-bg-success" : "text-bg-danger");
      badge.textContent = dynamic ? "From app path" : validFixed ? "Fixed value" : "Value required";
      header.append(code, badge);
      row.append(header);
      if (!dynamic) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control form-control-sm mt-2";
        input.name = "fixedParam." + name;
        input.value = value;
        input.required = true;
        input.minLength = minLength;
        input.maxLength = maxLength;
        if (rule.pattern) input.pattern = rule.pattern;
        input.placeholder = "Fixed value for :" + name;
        input.dataset.bpFixedParam = name;
        row.append(input);
      }
      container.append(row);
    }
    form.querySelectorAll("button[type=submit]").forEach((button) => {
      button.disabled = renderable && !complete;
    });
  };

  const syncAllForms = () => {
    document.querySelectorAll("[data-bp-route-form]").forEach(syncForm);
  };

  const syncLabels = () => {
    document.querySelectorAll("[data-bp-route-service]").forEach((select) => {
      Array.from(select.options).forEach((option) => {
        if (!option.value) return;
        const service = byServiceId.get(option.value);
        if (service) option.textContent = formatServiceLabel(service);
      });
    });
    document.querySelectorAll("[data-bp-route-service-label]").forEach((node) => {
      const service = byServiceId.get(node.dataset.bpRouteServiceLabel || "");
      if (service) node.textContent = formatServiceLabel(service);
    });
    document.querySelectorAll("[data-bp-route-view-label]").forEach((node) => {
      const service = byServiceId.get(node.dataset.bpRouteServiceId || "");
      const routeView = service?.views.find((view) => view.viewId === node.dataset.bpRouteViewLabel);
      if (routeView) node.textContent = routeView.title || routeView.viewId;
    });
  };

  document.addEventListener("change", (event) => {
    if (!isCurrent()) return;
    if (!event.target?.matches?.("[data-bp-route-service]")) return;
    const view = event.target.closest("[data-bp-route-form]")?.querySelector("[data-bp-route-view]");
    if (view) view.dataset.selectedView = "";
    const servicePath = event.target.closest("[data-bp-route-form]")?.querySelector("[data-bp-service-path]");
    if (servicePath) servicePath.dataset.selectedPath = "";
    const form = event.target.closest("[data-bp-route-form]");
    if (form) syncForm(form);
  });
  document.addEventListener("change", (event) => {
    if (!isCurrent()) return;
    if (!event.target?.matches?.("[data-bp-route-view]")) return;
    event.target.dataset.selectedView = event.target.value;
    const servicePath = event.target.closest("[data-bp-route-form]")?.querySelector("[data-bp-service-path]");
    if (servicePath) servicePath.dataset.selectedPath = "";
    const option = event.target.selectedOptions?.[0];
    const title = event.target.closest("[data-bp-route-form]")?.querySelector("[name=title]");
    const form = event.target.closest("[data-bp-route-form]");
    if (title && option?.value && option.dataset.renderable !== "false") title.value = option.textContent?.trim() || option.value;
    if (form) syncRouteUiFields(form);
  });
  document.addEventListener("change", (event) => {
    if (!isCurrent()) return;
    if (!event.target?.matches?.("[data-bp-service-path]")) return;
    event.target.dataset.selectedPath = event.target.value;
    const form = event.target.closest("[data-bp-route-form]");
    if (form) syncRouteUiFields(form);
  });
  document.addEventListener("input", (event) => {
    if (!isCurrent()) return;
    if (!event.target?.matches?.("[name=path], [data-bp-fixed-param]")) return;
    const form = event.target.closest("[data-bp-route-form]");
    if (!form) return;
    if (event.target.matches("[name=path]")) {
      syncRouteUiFields(form);
      return;
    }
    const valid = !!event.target.value.trim() && event.target.checkValidity();
    const row = event.target.closest(".border");
    row?.classList.toggle("border-success", valid);
    row?.classList.toggle("bg-success-subtle", valid);
    row?.classList.toggle("border-danger", !valid);
    row?.classList.toggle("bg-danger-subtle", !valid);
    const badge = row?.querySelector(".badge");
    if (badge) {
      badge.className = "badge " + (valid ? "text-bg-success" : "text-bg-danger");
      badge.textContent = valid ? "Fixed value" : "Value required";
    }
    const incomplete = !!form.querySelector("[data-bp-route-params] .border-danger");
    form.querySelectorAll("button[type=submit]").forEach((button) => { button.disabled = incomplete; });
  });

  const loadManifest = async (service) => {
    const baseUrl = String(service.hostname || "").replace(/\\/+$/, "");
    if (!baseUrl) return;
    const response = await fetch(baseUrl + "/.well-known/bp/manifest", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const manifest = await response.json().catch(() => null);
    if (!response.ok || !manifest) return;
    const views = manifestViews(manifest);
    byServiceId.set(service.id, {
      ...service,
      title: typeof manifest.title === "string" ? manifest.title : service.title,
      serviceId: typeof manifest.pluginId === "string" ? manifest.pluginId : service.serviceId,
      manifestLoaded: true,
      views
    });
  };

  syncLabels();
  syncAllForms();
  Promise.allSettled(services.map(loadManifest)).then(() => {
    if (!isCurrent()) return;
    syncLabels();
    syncAllForms();
  });
})();
`;
}

function routeFormFields(
  prefix: string,
  services: ResponseData["availableServices"],
  route?: ResponseData["routes"][number]
): HtmlRenderable {
  const selectedService = route?.serviceId ?? "";
  const selectedView = route?.viewId ?? "";
  const viewOptions = services.flatMap((svc) =>
    svc.views.map((view) => ({
      serviceId: svc.id,
      serviceTitle: svc.title,
      ...view
    }))
  );
  const selectedServiceMeta = services.find((service) => service.id === selectedService);
  const selectedMeta = viewOptions.find((view) => view.serviceId === selectedService && view.viewId === selectedView);
  const selectedViewMissing = Boolean(route && selectedView && !selectedMeta);
  const isRenderable = selectedMeta?.renderable ?? route?.renderable ?? true;
  return (
    <>
      <div class="mb-3">
        <label class="form-label">Service</label>
        <select class="form-select" name="serviceId" id={`${prefix}-service`} data-bp-route-service="" required>
          <option value="">Select service...</option>
          {services.map((svc) => (
            <option value={svc.id} selected={svc.id === selectedService}>{serviceLabel(services, svc.id)}</option>
          ))}
          {route && selectedService && !selectedServiceMeta ? (
            <option value={selectedService} selected>{selectedService} — service unavailable</option>
          ) : ""}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">View</label>
        <select class="form-select" name="viewId" id={`${prefix}-view`} data-bp-route-view="" data-selected-view={selectedView} required>
          <option value="">Select view...</option>
          {selectedViewMissing ? (
            <option
              value={selectedView}
              data-service-id={selectedService}
              data-renderable={isRenderable ? "true" : "false"}
              data-unavailable="true"
              selected
            >{selectedView} — {!selectedServiceMeta ? "service unavailable" : selectedServiceMeta.manifestLoaded ? "unavailable in current manifest" : "service manifest not loaded"}</option>
          ) : ""}
          {viewOptions.filter((view) => view.renderable !== false || (view.serviceId === selectedService && view.viewId === selectedView)).map((view) => (
            <option
              value={view.viewId}
              data-service-id={view.serviceId}
              data-renderable={view.renderable === false ? "false" : "true"}
              disabled={view.renderable === false && !(view.serviceId === selectedService && view.viewId === selectedView)}
              selected={view.serviceId === selectedService && view.viewId === selectedView}
            >
              {view.renderable === false ? `[API] ${view.title}` : view.title}
            </option>
          ))}
        </select>
        <div class="form-text">Page views create navigation routes. API/dependency views are mounted for service access only.</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Mount path</label>
        <input type="text" class="form-control font-monospace" name="path" value={route?.path ?? ""} placeholder="/dashboard" required={isRenderable} disabled={!isRenderable} pattern="/.*" data-bp-ui-route-field="" />
        <div class="form-text">URL path users will see in this app. Service-side path is resolved from the view id at sync time.</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Service path</label>
        <select
          class="form-select font-monospace"
          name="servicePathVariant"
          data-bp-service-path=""
          data-selected-path={route?.servicePathVariant ?? route?.targetPath ?? selectedMeta?.path ?? ""}
        ></select>
        <div class="form-text">For optional service routes, choose the concrete path this app route targets.</div>
      </div>
      <div
        class="mb-3 d-none"
        data-bp-route-params=""
        data-fixed-params={JSON.stringify(route?.fixedParams ?? {})}
      >
        <label class="form-label">Route parameters</label>
      </div>
      <div class="mb-3">
        <label class="form-label">Display Title</label>
        <input type="text" class="form-control" name="title" value={route?.title ?? ""} placeholder="Dashboard" required={isRenderable} disabled={!isRenderable} pattern=".*\S.*" data-bp-ui-route-field="" />
      </div>
      <div class="mb-3">
        <label class="form-label">Query string (optional)</label>
        <input type="text" class="form-control font-monospace" name="query" value={route?.query ?? ""} placeholder="filter=active" disabled={!isRenderable} data-bp-ui-route-field="" />
        <div class="form-text">Appended to the service request. Use this to customize the same view, not to change paths.</div>
      </div>
    </>
  );
}

function serviceLabel(services: ResponseData["availableServices"], serviceId: string): string {
  const service = services.find((svc) => svc.id === serviceId);
  if (!service) return serviceId;
  const identity = service.serviceId || service.id;
  return identity !== service.title ? `${service.title} · ${identity}` : service.title;
}

function viewLabel(services: ResponseData["availableServices"], serviceId: string, viewId: string): string {
  const service = services.find((svc) => svc.id === serviceId);
  const view = service?.views.find((candidate) => candidate.viewId === viewId);
  return view?.title || viewId;
}

function routeWarning(services: ResponseData["availableServices"], route: ResponseData["routes"][number]): string | undefined {
  const service = services.find((candidate) => candidate.id === route.serviceId);
  if (!service) return "Service unavailable";
  if (!service.manifestLoaded) return "Service manifest not loaded";
  if (!service.views.some((candidate) => candidate.viewId === route.viewId)) return "Manifest view unavailable";
  return undefined;
}

function methodsLabel(methods: string[] | undefined): string {
  return ((methods && methods.length > 0 ? methods : ["GET"]) as string[]).join(", ");
}

type VisualRoute = ResponseData["routes"][number];

export type PathGroup = {
  pathPrefix: string;
  synthetic: boolean;
  routes: VisualRoute[];
};

function routeSegments(path: string): string[] {
  return path.replace(/\/+/g, "/").replace(/\/$/, "").split("/").filter(Boolean);
}

function domId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

export function groupVisualRoutes(routes: VisualRoute[]): PathGroup[] {
  const groups = new Map<string, PathGroup>();
  for (const route of routes) {
    const segments = routeSegments(route.path);
    const synthetic = segments.length > 1;
    const pathPrefix = synthetic ? `/${segments.slice(0, -1).join("/")}` : (segments.length ? `/${segments[0]}` : "/");
    const key = `${synthetic ? "group" : "route"}:${pathPrefix}`;
    const group = groups.get(key) ?? { pathPrefix, synthetic, routes: [] };
    group.routes.push(route);
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((group) => ({ ...group, routes: group.routes.sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id)) }))
    .sort((left, right) => left.pathPrefix.localeCompare(right.pathPrefix));
}

function pathWithinGroup(group: PathGroup, path: string): string {
  if (!group.synthetic) return path;
  return path.slice(group.pathPrefix.length) || "/";
}

function renderPageRoutes(data: ResponseData, apiBase: string): HtmlRenderable {
  const pageRoutes = data.routes
    .filter((route) => route.kind !== "api" && route.renderable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));

  if (pageRoutes.length === 0) {
    return <div class="alert alert-secondary">No visual routes for this app yet</div>;
  }

  const groups = groupVisualRoutes(pageRoutes);
  const conflictCounts = new Map<string, number>();
  for (const route of pageRoutes) {
    const key = appRoutePatternKey(route.path);
    conflictCounts.set(key, (conflictCounts.get(key) ?? 0) + 1);
  }
  return (
    <div class="table-responsive">
      <table class="table table-sm table-hover align-middle">
        <thead>
          <tr>
            <th>Mount path</th>
            <th>Title</th>
            <th>Service</th>
            <th>View</th>
            <th>Query</th>
            <th>On</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <>
              {group.synthetic ? (
                <tr class="table-light" data-bp-path-group={group.pathPrefix}>
                  <th colspan={7} class="font-monospace small py-2">Path group: {group.pathPrefix}</th>
                </tr>
              ) : ""}
              {group.routes.map((route) => {
                const warning = routeWarning(data.availableServices, route);
                const conflictCount = conflictCounts.get(appRoutePatternKey(route.path)) ?? 0;
                return (
                  <tr class={route.enabled ? "" : "text-secondary"} data-bp-route-id={route.id}>
                    <td class="font-monospace small fw-semibold">
                      {pathWithinGroup(group, route.path)}
                      {conflictCount > 1 ? <span class="badge text-bg-danger ms-2">Conflict: {conflictCount} route records use this mount path</span> : ""}
                    </td>
                    <td>{route.title ?? ""}</td>
                    <td class="small" data-bp-route-service-label={route.serviceId}>{serviceLabel(data.availableServices, route.serviceId)}</td>
                    <td class="small">
                      <span data-bp-route-service-id={route.serviceId} data-bp-route-view-label={route.viewId}>{viewLabel(data.availableServices, route.serviceId, route.viewId)}</span>
                      <div class="d-flex flex-wrap gap-1 mt-1">
                        {!route.enabled ? <span class="badge text-bg-secondary">Disabled</span> : ""}
                        {warning ? <span class="badge text-bg-warning">{warning}</span> : ""}
                      </div>
                    </td>
                    <td class="small font-monospace">{route.query ?? ""}</td>
                    <td>
                      <button
                        class={`btn btn-sm ${route.enabled ? "btn-success" : "btn-outline-secondary"}`}
                        hx-put={`${apiBase}/apps/${data.selectedAppId}/routes/${route.id}`}
                        hx-vals={JSON.stringify({ enabled: !route.enabled })}
                        hx-target="#bp-main"
                        hx-swap="innerHTML"
                      >{route.enabled ? "on" : "off"}</button>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-primary"
                          data-bs-toggle="offcanvas"
                          data-bs-target={`#bp-edit-route-panel-${route.id}`}
                        >Edit</button>
                        <button
                          class="btn btn-outline-danger"
                          hx-delete={`${apiBase}/apps/${data.selectedAppId}/routes/${route.id}`}
                          hx-confirm="Delete route?"
                          hx-target="#bp-routes-alerts"
                          hx-swap="innerHTML"
                        >x</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderApiRoutes(data: ResponseData, apiBase: string): HtmlRenderable {
  const apiRoutes = data.routes
    .filter((route) => route.kind === "api" || route.renderable === false)
    .sort((a, b) => serviceLabel(data.availableServices, a.serviceId).localeCompare(serviceLabel(data.availableServices, b.serviceId)) || a.serviceId.localeCompare(b.serviceId) || a.path.localeCompare(b.path));

  if (apiRoutes.length === 0) {
    return <div class="alert alert-secondary">No service/API routes mounted for this app</div>;
  }

  const serviceIds = [...new Set(apiRoutes.map((route) => route.serviceId))];
  const openServiceId = data.openApiServiceId && serviceIds.includes(data.openApiServiceId)
    ? data.openApiServiceId
    : serviceIds[0];
  return (
    <div class="accordion" id="bp-api-routes-accordion">
      {serviceIds.map((serviceId) => {
        const routes = apiRoutes.filter((route) => route.serviceId === serviceId);
        const panelId = `bp-api-routes-${domId(serviceId)}`;
        const open = serviceId === openServiceId;
        return (
          <div class="accordion-item">
            <h3 class="accordion-header">
              <button class={`accordion-button ${open ? "" : "collapsed"}`} type="button" data-bs-toggle="collapse" data-bs-target={`#${panelId}`} aria-expanded={open ? "true" : "false"} aria-controls={panelId}>
                <span data-bp-route-service-label={serviceId}>{serviceLabel(data.availableServices, serviceId)}</span>
                <span class="font-monospace small text-secondary ms-2">{serviceId}</span>
                <span class="badge text-bg-secondary ms-2">{routes.length}</span>
              </button>
            </h3>
            <div id={panelId} class={`accordion-collapse collapse ${open ? "show" : ""}`} data-bs-parent="#bp-api-routes-accordion">
              <div class="accordion-body p-0">
                <table class="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>App allowlist path</th>
                      <th>Service path</th>
                      <th>View</th>
                      <th>Methods</th>
                      <th>On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => {
                      const warning = routeWarning(data.availableServices, route);
                      return (
                        <tr class={route.enabled ? "" : "text-secondary"} data-bp-route-id={route.id}>
                          <td class="font-monospace small">{route.path}</td>
                          <td class="font-monospace small">{route.targetPath ?? ""}</td>
                          <td class="small">
                            <span data-bp-route-service-id={route.serviceId} data-bp-route-view-label={route.viewId}>{viewLabel(data.availableServices, route.serviceId, route.viewId)}</span>
                            <div class="d-flex flex-wrap gap-1 mt-1">
                              {!route.enabled ? <span class="badge text-bg-secondary">Disabled</span> : ""}
                              {warning ? <span class="badge text-bg-warning">{warning}</span> : ""}
                            </div>
                          </td>
                          <td class="small font-monospace">{methodsLabel(route.methods)}</td>
                          <td>
                            <button
                              class={`btn btn-sm ${route.enabled ? "btn-success" : "btn-outline-secondary"}`}
                              hx-put={`${apiBase}/apps/${data.selectedAppId}/routes/${route.id}`}
                              hx-vals={JSON.stringify({ enabled: !route.enabled })}
                              hx-target="#bp-main"
                              hx-swap="innerHTML"
                            >{route.enabled ? "on" : "off"}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function noServicesBanner(serviceUrl: string): HtmlRenderable {
  return (
    <div class="alert alert-warning mb-3">
      <h6 class="alert-heading">No services linked to this tenant</h6>
      <p class="mb-2">Routes need a service to handle them. Register a service for this tenant first.</p>
      <a
        href={`${serviceUrl}/services`}
        class="btn btn-sm btn-warning"
        hx-get={`${serviceUrl}/services`}
        hx-target="#bp-main"
        hx-swap="innerHTML"
        hx-push-url="/settings/services"
      >Go to Service Registry -&gt;</a>
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  const apiBase = (data.serviceBaseUrl ?? "") + data.adminApiBase;
  const routesPath = `${data.serviceBaseUrl}/routes`;
  const hasServices = data.availableServices.length > 0;
  const canAddRoute = data.selectedAppId && hasServices;

  return (
    <div class="container-fluid px-0">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0">{data.title}</h2>
        <button
          class="btn btn-primary"
          data-bs-toggle="offcanvas"
          data-bs-target="#bp-add-route-panel"
          disabled={!canAddRoute}
        >+ Add Visual Route</button>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold">App</label>
        <select
          class="form-select"
          name="appId"
          data-bp-app-select=""
          hx-get={routesPath}
          hx-trigger="change"
          hx-target="#bp-main"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          <option value="">Choose an app...</option>
          {data.apps.map((app) => (
            <option value={app.id} selected={app.id === data.selectedAppId}>
              {app.title} ({app.tenantId})
            </option>
          ))}
        </select>
      </div>

      <div id="bp-routes-alerts"></div>

      {data.selectedAppId && !hasServices ? noServicesBanner(data.serviceBaseUrl) : ""}

      {data.routes.length === 0 ? (
        <div class="alert alert-secondary">
          {data.selectedAppId ? "No routes for this app yet" : "Select an app to view routes"}
        </div>
      ) : (
        <div class="d-grid gap-4">
          <section>
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <div>
                <h3 class="h5 mb-0">Visual Routes</h3>
                <div class="small text-secondary">Routes rendered as app pages and eligible for menus</div>
              </div>
            </div>
            {renderPageRoutes(data, apiBase)}
          </section>
          <section>
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <div>
                <h3 class="h5 mb-0">Service/API Routes</h3>
                <div class="small text-secondary">Service-locked app allowlist routes mounted under /_bp/service</div>
              </div>
            </div>
            {renderApiRoutes(data, apiBase)}
          </section>
        </div>
      )}

      {/* Offcanvas: Add Route */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-route-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add Visual Route</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          {hasServices ? (
            <form id="bp-add-route-form" hx-post={`${apiBase}/apps/${data.selectedAppId}/routes`} hx-target="#bp-main" hx-swap="innerHTML">
              <div data-bp-route-form="">
              {routeFormFields("bp-add-route", data.availableServices)}
              </div>
              <div class="alert alert-danger d-none" id="bp-add-route-error"></div>
              <button type="submit" class="btn btn-primary w-100">Add Route</button>
            </form>
          ) : noServicesBanner(data.serviceBaseUrl)}
        </div>
      </div>

      {/* Offcanvas: Edit Route */}
      {data.routes.filter((route) => route.kind !== "api" && route.renderable !== false).map((route) => (
        <div class="offcanvas offcanvas-end" tabindex={-1} id={`bp-edit-route-panel-${route.id}`}>
          <div class="offcanvas-header">
            <h5 class="offcanvas-title">Edit Route</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
          </div>
          <div class="offcanvas-body">
            <form
              hx-put={`${apiBase}/apps/${data.selectedAppId}/routes/${route.id}`}
              hx-target="#bp-main"
              hx-swap="innerHTML"
            >
              <div data-bp-route-form="">
              {routeFormFields(`bp-edit-route-${route.id}`, data.availableServices, route)}
              </div>
              <button type="submit" class="btn btn-primary w-100">Save Changes</button>
            </form>
          </div>
        </div>
      ))}
      <script>{js(manifestLoaderScript(data.availableServices))}</script>
    </div>
  );
}
