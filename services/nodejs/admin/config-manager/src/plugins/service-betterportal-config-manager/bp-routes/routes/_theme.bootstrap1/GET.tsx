/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

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

  const viewRenderable = (view) => {
    if (typeof view?.renderable === "boolean") return view.renderable;
    const themeRenderers = view?.html?.themeRenderers;
    return !!themeRenderers && typeof themeRenderers === "object" && Object.keys(themeRenderers).length > 0;
  };

  const manifestViews = (manifest) => {
    if (!Array.isArray(manifest?.views)) return [];
    return manifest.views
      .map((view) => ({
        viewId: String(view.viewId || ""),
        title: String(view.title || view.viewId || ""),
        path: String(view.path || ""),
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
  };

  const syncAllForms = () => {
    document.querySelectorAll("[data-bp-route-form]").forEach(syncForm);
  };

  const syncLabels = () => {
    document.querySelectorAll("[data-bp-route-service]").forEach((select) => {
      Array.from(select.options).forEach((option) => {
        if (!option.value) return;
        const service = byServiceId.get(option.value);
        if (service) option.textContent = service.title || option.value;
      });
    });
    document.querySelectorAll("[data-bp-route-service-label]").forEach((node) => {
      const service = byServiceId.get(node.dataset.bpRouteServiceLabel || "");
      if (service) node.textContent = service.title || service.id;
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
    const form = event.target.closest("[data-bp-route-form]");
    if (form) syncForm(form);
  });
  document.addEventListener("change", (event) => {
    if (!isCurrent()) return;
    if (!event.target?.matches?.("[data-bp-route-view]")) return;
    event.target.dataset.selectedView = event.target.value;
    const option = event.target.selectedOptions?.[0];
    const title = event.target.closest("[data-bp-route-form]")?.querySelector("[name=title]");
    const form = event.target.closest("[data-bp-route-form]");
    if (title && option?.value && option.dataset.renderable !== "false") title.value = option.textContent?.trim() || option.value;
    if (form) syncRouteUiFields(form);
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
  const selectedMeta = viewOptions.find((view) => view.serviceId === selectedService && view.viewId === selectedView);
  const isRenderable = selectedMeta?.renderable !== false;
  return (
    <>
      <div class="mb-3">
        <label class="form-label">Service</label>
        <select class="form-select" name="serviceId" id={`${prefix}-service`} data-bp-route-service="" required>
          <option value="">Select service...</option>
          {services.map((svc) => (
            <option value={svc.id} selected={svc.id === selectedService}>{svc.title}</option>
          ))}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">View</label>
        <select class="form-select" name="viewId" id={`${prefix}-view`} data-bp-route-view="" data-selected-view={selectedView} required>
          <option value="">Select view...</option>
          {viewOptions.filter((view) => view.renderable !== false || view.viewId === selectedView).map((view) => (
            <option
              value={view.viewId}
              data-service-id={view.serviceId}
              data-renderable={view.renderable === false ? "false" : "true"}
              disabled={view.renderable === false && view.viewId !== selectedView}
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
  return service?.title || serviceId;
}

function viewLabel(services: ResponseData["availableServices"], serviceId: string, viewId: string): string {
  const service = services.find((svc) => svc.id === serviceId);
  const view = service?.views.find((candidate) => candidate.viewId === viewId);
  return view?.title || viewId;
}

function methodsLabel(methods: string[] | undefined): string {
  return ((methods && methods.length > 0 ? methods : ["GET"]) as string[]).join(", ");
}

function pathDepth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

function domId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function renderPageRoutes(data: ResponseData, apiBase: string): HtmlRenderable {
  const pageRoutes = data.routes
    .filter((route) => route.kind !== "api" && route.renderable !== false)
    .sort((a, b) => a.path.localeCompare(b.path));

  if (pageRoutes.length === 0) {
    return <div class="alert alert-secondary">No visual routes for this app yet</div>;
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
          {pageRoutes.map((route) => (
            <tr class={route.enabled ? "" : "text-secondary"}>
              <td class="font-monospace small fw-semibold">
                <span style={`padding-left:${Math.max(0, pathDepth(route.path) - 1) * 1.25}rem`}>{route.path}</span>
              </td>
              <td>{route.title ?? ""}</td>
              <td class="small" data-bp-route-service-label={route.serviceId}>{serviceLabel(data.availableServices, route.serviceId)}</td>
              <td class="small" data-bp-route-service-id={route.serviceId} data-bp-route-view-label={route.viewId}>{viewLabel(data.availableServices, route.serviceId, route.viewId)}</td>
              <td class="small font-monospace">{(route as unknown as { query?: string }).query ?? ""}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderApiRoutes(data: ResponseData, apiBase: string): HtmlRenderable {
  const apiRoutes = data.routes
    .filter((route) => route.kind === "api" || route.renderable === false)
    .sort((a, b) => serviceLabel(data.availableServices, a.serviceId).localeCompare(serviceLabel(data.availableServices, b.serviceId)) || a.path.localeCompare(b.path));

  if (apiRoutes.length === 0) {
    return <div class="alert alert-secondary">No service/API routes mounted for this app</div>;
  }

  const serviceIds = [...new Set(apiRoutes.map((route) => route.serviceId))];
  return (
    <div class="accordion" id="bp-api-routes-accordion">
      {serviceIds.map((serviceId, index) => {
        const routes = apiRoutes.filter((route) => route.serviceId === serviceId);
        const panelId = `bp-api-routes-${domId(serviceId)}`;
        return (
          <div class="accordion-item">
            <h3 class="accordion-header">
              <button class={`accordion-button ${index === 0 ? "" : "collapsed"}`} type="button" data-bs-toggle="collapse" data-bs-target={`#${panelId}`}>
                <span>{serviceLabel(data.availableServices, serviceId)}</span>
                <span class="badge text-bg-secondary ms-2">{routes.length}</span>
              </button>
            </h3>
            <div id={panelId} class={`accordion-collapse collapse ${index === 0 ? "show" : ""}`} data-bs-parent="#bp-api-routes-accordion">
              <div class="accordion-body p-0">
                <table class="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>App allowlist path</th>
                      <th>Service path</th>
                      <th>View</th>
                      <th>Methods</th>
                      <th>On</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => (
                      <tr class={route.enabled ? "" : "text-secondary"}>
                        <td class="font-monospace small">{route.path}</td>
                        <td class="font-monospace small">{route.targetPath ?? ""}</td>
                        <td class="small">{viewLabel(data.availableServices, route.serviceId, route.viewId)}</td>
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
                        <td>
                          <button
                            class="btn btn-sm btn-outline-danger"
                            hx-delete={`${apiBase}/apps/${data.selectedAppId}/routes/${route.id}`}
                            hx-confirm="Delete API route?"
                            hx-target="#bp-routes-alerts"
                            hx-swap="innerHTML"
                          >x</button>
                        </td>
                      </tr>
                    ))}
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
      <script>{manifestLoaderScript(data.availableServices)}</script>
    </div>
  );
}
