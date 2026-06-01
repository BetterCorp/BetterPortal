/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function routeDesignerScript(apiBase: string, serviceUrl: string, availableServices: ResponseData["availableServices"]): HtmlRenderable {
  return js(`{
    const apiBase = ${JSON.stringify(apiBase)};
    const serviceUrl = ${JSON.stringify(serviceUrl)};
    const services = ${JSON.stringify(availableServices)};

    const reloadContent = (appId) => {
      const target = document.getElementById("bp-main") || document.querySelector("[data-bp-main-outlet]");
      if (!target || !window.htmx) return;
      const url = serviceUrl + "/admin-routes" + (appId ? "?appId=" + encodeURIComponent(appId) : "");
      window.htmx.ajax("GET", url, { target, swap: "innerHTML" });
    };

    const closeOffcanvas = (id) => {
      const el = document.getElementById(id);
      if (el && window.bootstrap) {
        const oc = window.bootstrap.Offcanvas.getInstance(el);
        if (oc) oc.hide();
      }
    };

    const appSelect = document.querySelector("[data-bp-app-select]");
    appSelect?.addEventListener("change", () => reloadContent(appSelect.value));

    // ── Populate view dropdown when service changes ──
    const populateViewDropdown = (formPrefix) => {
      const svcSel = document.querySelector("#" + formPrefix + "-service");
      const viewSel = document.querySelector("#" + formPrefix + "-view");
      if (!svcSel || !viewSel) return;

      const updateViews = () => {
        const svc = services.find((s) => s.id === svcSel.value);
        viewSel.innerHTML = "";
        if (!svc || svc.views.length === 0) {
          viewSel.innerHTML = '<option value="">No views available</option>';
          viewSel.disabled = true;
          return;
        }
        viewSel.disabled = false;
        viewSel.innerHTML = '<option value="">Select view...</option>' +
          svc.views.map((v) => '<option value="' + v.viewId + '" data-path="' + v.path + '">' + v.title + '</option>').join("");
      };

      svcSel.addEventListener("change", updateViews);

      // On view change, default the App Path
      viewSel.addEventListener("change", () => {
        const opt = viewSel.options[viewSel.selectedIndex];
        const pathInput = document.querySelector("#" + formPrefix + "-app-path");
        if (opt && pathInput && opt.dataset.path && !pathInput.dataset.touched) {
          pathInput.value = opt.dataset.path;
        }
      });

      const pathInput = document.querySelector("#" + formPrefix + "-app-path");
      pathInput?.addEventListener("input", () => { pathInput.dataset.touched = "1"; });

      updateViews();
    };

    populateViewDropdown("bp-add-route");
    populateViewDropdown("bp-edit-route");

    // ── Create route ──
    document.getElementById("bp-add-route-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const appId = appSelect?.value;
      if (!appId) return;

      const fd = new FormData(e.target);
      const payload = {
        path: fd.get("path"),
        serviceId: fd.get("serviceId"),
        viewId: fd.get("viewId"),
        targetPath: fd.get("targetPath") || fd.get("path"),
        title: fd.get("title") || fd.get("path"),
        enabled: true
      };

      const res = await fetch(apiBase + "/apps/" + appId + "/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) { closeOffcanvas("bp-add-route-panel"); reloadContent(appId); }
      else { const err = document.getElementById("bp-add-route-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    // ── Edit route ──
    document.querySelectorAll("[data-bp-edit-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = JSON.parse(btn.dataset.bpEditRoute);
        const form = document.getElementById("bp-edit-route-form");
        if (!form) return;
        form.querySelector("[name=routeId]").value = data.id;
        form.querySelector("[name=path]").value = data.path;
        form.querySelector("[name=title]").value = data.title || "";

        const svcSel = form.querySelector("[name=serviceId]");
        svcSel.value = data.serviceId;
        svcSel.dispatchEvent(new Event("change"));

        // Wait a tick for view dropdown to populate
        setTimeout(() => {
          form.querySelector("[name=viewId]").value = data.viewId;
        }, 0);

        const pathInput = form.querySelector("[name=targetPath]");
        pathInput.value = data.targetPath || "";
        pathInput.dataset.touched = "1";
      });
    });

    document.getElementById("bp-edit-route-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const appId = appSelect?.value;
      const fd = new FormData(e.target);
      const routeId = fd.get("routeId");
      if (!appId || !routeId) return;

      const payload = {
        path: fd.get("path"),
        serviceId: fd.get("serviceId"),
        viewId: fd.get("viewId"),
        targetPath: fd.get("targetPath"),
        title: fd.get("title")
      };

      const res = await fetch(apiBase + "/apps/" + appId + "/routes/" + routeId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) { closeOffcanvas("bp-edit-route-panel"); reloadContent(appId); }
      else { const err = document.getElementById("bp-edit-route-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    document.querySelectorAll("[data-bp-delete-route]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const appId = appSelect?.value;
        const routeId = btn.dataset.bpDeleteRoute;
        if (!appId || !routeId || !confirm("Delete route?")) return;
        await fetch(apiBase + "/apps/" + appId + "/routes/" + routeId, { method: "DELETE" });
        reloadContent(appId);
      });
    });

    document.querySelectorAll("[data-bp-toggle-route]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const appId = appSelect?.value;
        const routeId = btn.dataset.bpToggleRoute;
        const enabled = btn.dataset.bpRouteEnabled === "true";
        if (!appId || !routeId) return;
        await fetch(apiBase + "/apps/" + appId + "/routes/" + routeId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !enabled })
        });
        reloadContent(appId);
      });
    });
  }`);
}

function routeFormFields(prefix: string, services: ResponseData["availableServices"]): HtmlRenderable {
  return (
    <>
      <div class="mb-3">
        <label class="form-label">Service</label>
        <select class="form-select" name="serviceId" id={`${prefix}-service`} required>
          <option value="">Select service...</option>
          {services.map((svc) => (
            <option value={svc.id}>{svc.title}</option>
          ))}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">View</label>
        <select class="form-select" name="viewId" id={`${prefix}-view`} required>
          <option value="">Select service first</option>
        </select>
        <div class="form-text">Picks the view this route should render.</div>
      </div>
      <div class="mb-3">
        <label class="form-label">App Path</label>
        <input type="text" class="form-control font-monospace" name="targetPath" id={`${prefix}-app-path`} placeholder="/hello" />
        <div class="form-text">Defaults to view's known path. Override if needed.</div>
      </div>
      <div class="mb-3">
        <label class="form-label">URL Path</label>
        <input type="text" class="form-control font-monospace" name="path" placeholder="/dashboard" required />
        <div class="form-text">URL path users will see in this app (e.g., /sales/pipeline)</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Display Title</label>
        <input type="text" class="form-control" name="title" placeholder="Dashboard" />
      </div>
    </>
  );
}

function noServicesBanner(serviceUrl: string): HtmlRenderable {
  return (
    <div class="alert alert-warning mb-3">
      <h6 class="alert-heading">No services linked to this tenant</h6>
      <p class="mb-2">Routes need a service to handle them. Register a service for this tenant first.</p>
      <a
        href={`${serviceUrl}/admin-services`}
        class="btn btn-sm btn-warning"
        hx-get={`${serviceUrl}/admin-services`}
        hx-target="#bp-main"
        hx-swap="innerHTML"
        hx-push-url="/settings/services"
      >Go to Service Registry →</a>
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  const apiBase = (data.serviceBaseUrl ?? "") + data.adminApiBase;
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
        >+ Add Route</button>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold">App</label>
        <select class="form-select" data-bp-app-select="">
          <option value="">Choose an app...</option>
          {data.apps.map((app) => (
            <option value={app.id} selected={app.id === data.selectedAppId}>
              {app.title} ({app.tenantId})
            </option>
          ))}
        </select>
      </div>

      {data.selectedAppId && !hasServices ? noServicesBanner(data.serviceBaseUrl) : ""}

      {data.routes.length === 0 ? (
        <div class="alert alert-secondary">
          {data.selectedAppId ? "No routes for this app yet" : "Select an app to view routes"}
        </div>
      ) : (
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle">
            <thead>
              <tr>
                <th>URL Path</th>
                <th>Title</th>
                <th>Service</th>
                <th>View</th>
                <th>App Path</th>
                <th>On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.routes.map((route) => (
                <tr class={route.enabled ? "" : "text-secondary"}>
                  <td class="font-monospace small fw-semibold">{route.path}</td>
                  <td>{route.title ?? ""}</td>
                  <td class="small font-monospace">{route.serviceId}</td>
                  <td class="small font-monospace">{route.viewId}</td>
                  <td class="small font-monospace">{route.targetPath ?? route.path}</td>
                  <td>
                    <button
                      class={`btn btn-sm ${route.enabled ? "btn-success" : "btn-outline-secondary"}`}
                      data-bp-toggle-route={route.id}
                      data-bp-route-enabled={String(route.enabled)}
                    >{route.enabled ? "on" : "off"}</button>
                  </td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button
                        class="btn btn-outline-primary"
                        data-bs-toggle="offcanvas"
                        data-bs-target="#bp-edit-route-panel"
                        data-bp-edit-route={JSON.stringify(route)}
                      >Edit</button>
                      <button class="btn btn-outline-danger" data-bp-delete-route={route.id}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Offcanvas: Add Route ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-route-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add Route</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          {hasServices ? (
            <form id="bp-add-route-form">
              {routeFormFields("bp-add-route", data.availableServices)}
              <div class="alert alert-danger d-none" id="bp-add-route-error"></div>
              <button type="submit" class="btn btn-primary w-100">Add Route</button>
            </form>
          ) : noServicesBanner(data.serviceBaseUrl)}
        </div>
      </div>

      {/* ── Offcanvas: Edit Route ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-route-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Edit Route</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-edit-route-form">
            <input type="hidden" name="routeId" />
            {routeFormFields("bp-edit-route", data.availableServices)}
            <div class="alert alert-danger d-none" id="bp-edit-route-error"></div>
            <button type="submit" class="btn btn-primary w-100">Save Changes</button>
          </form>
        </div>
      </div>

      <script>{routeDesignerScript(apiBase, data.serviceBaseUrl, data.availableServices)}</script>
    </div>
  );
}
