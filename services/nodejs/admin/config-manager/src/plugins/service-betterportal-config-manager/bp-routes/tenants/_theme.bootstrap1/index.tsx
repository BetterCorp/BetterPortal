/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function tenantsScript(apiBase: string, serviceUrl: string): HtmlRenderable {
  return js(`(() => {
    const apiBase = ${JSON.stringify(apiBase)};
    const serviceUrl = ${JSON.stringify(serviceUrl)};

    const filterTenantScopedOptions = (form, tenantId) => {
      form.querySelectorAll("select[data-bp-tenant-scoped]").forEach((select) => {
        select.querySelectorAll("option[data-bp-tenant-id]").forEach((option) => {
          option.hidden = option.getAttribute("data-bp-tenant-id") !== tenantId;
        });
      });
    };

    const addAppForm = document.getElementById("bp-add-app-form");
    const addTenantSelect = addAppForm?.querySelector("[name=tenantId]");
    addTenantSelect?.addEventListener("change", () => {
      filterTenantScopedOptions(addAppForm, addTenantSelect.value);
    });

    document.querySelectorAll("[data-bp-edit-tenant]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = JSON.parse(btn.dataset.bpEditTenant);
        const form = document.getElementById("bp-edit-tenant-form");
        if (!form) return;
        form.querySelector("[name=tenantId]").value = data.id;
        form.querySelector("[name=title]").value = data.title;
        form.querySelector("[name=slug]").value = data.slug;
        form.querySelector("[name=active]").checked = data.active;
        if (window.htmx) window.htmx.process(form);
      });
    });

    document.querySelectorAll("[data-bp-edit-app]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = JSON.parse(btn.dataset.bpEditApp);
        const form = document.getElementById("bp-edit-app-form");
        if (!form) return;
        form.querySelector("[name=appId]").value = data.id;
        form.querySelector("[name=title]").value = data.title;
        form.querySelector("[name=slug]").value = data.slug;
        form.querySelector("[name=hostnames]").value = data.hostnames.join(", ");
        filterTenantScopedOptions(form, data.tenantId);
        const shellSelect = form.querySelector("[name=shellServiceId]");
        shellSelect.value = data.shellServiceId || "";
        const authSelect = form.querySelector("[name=authServiceId]");
        authSelect.value = data.authServiceId || "";
        if (window.htmx) window.htmx.process(form);
      });
    });
  })()`);
}

export function render(data: ResponseData): HtmlRenderable {
  const serviceUrl = data.serviceBaseUrl ?? "";
  const apiBase = serviceUrl + data.adminApiBase;
  const tenantsPath = `${serviceUrl}/tenants`;

  return (
    <div class="container-fluid px-0">
      <h2 class="mb-4">{data.title}</h2>

      {/* -- Tenants -- */}
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Tenants</h4>
        <button class="btn btn-sm btn-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-add-tenant-panel">+ Add Tenant</button>
      </div>

      {data.tenants.length === 0 ? (
        <div class="alert alert-secondary mb-4">No tenants configured</div>
      ) : (
        <div class="table-responsive mb-4">
          <table class="table table-sm table-hover align-middle">
            <thead><tr><th>ID</th><th>Slug</th><th>Title</th><th>Services</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr>
                  <td class="fw-semibold font-monospace small">{t.id}</td>
                  <td>{t.slug}</td>
                  <td>{t.title}</td>
                  <td><span class="badge text-bg-secondary">{t.serviceCount}</span></td>
                  <td><span class={`badge ${t.active ? "text-bg-success" : "text-bg-secondary"}`}>{t.active ? "active" : "inactive"}</span></td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button
                        class="btn btn-outline-primary"
                        data-bs-toggle="offcanvas"
                        data-bs-target="#bp-edit-tenant-panel"
                        data-bp-edit-tenant={JSON.stringify(t)}
                      >Edit</button>
                      <button
                        class="btn btn-outline-danger"
                        hx-delete={`${tenantsPath}?entity=tenant&id=${encodeURIComponent(t.id)}`}
                        hx-confirm={`Delete tenant ${t.id} and all its apps?`}
                        hx-target="#bp-main"
                        hx-swap="innerHTML"
                      >x</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* -- Apps -- */}
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Apps</h4>
        <button class="btn btn-sm btn-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-add-app-panel">+ Add App</button>
      </div>

      {data.apps.length === 0 ? (
        <div class="alert alert-secondary">No apps configured</div>
      ) : (
        <div class="row g-3 mb-4">
          {data.apps.map((app) => (
            <div class="col-12 col-lg-6">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h5 class="mb-0">{app.title}</h5>
                      <div class="small text-secondary font-monospace">{app.id}</div>
                    </div>
                    <div class="d-flex gap-1">
                      <span class="badge text-bg-secondary">{app.shellServiceId ? "shell" : "no shell"}</span>
                      <span class="badge text-bg-secondary">{app.authServiceId ? "auth" : "no auth"}</span>
                    </div>
                  </div>
                  <div class="small mb-1"><strong>Tenant:</strong> {app.tenantId}</div>
                  <div class="small mb-1"><strong>Hostnames:</strong> {app.hostnames.join(", ")}</div>
                  <div class="small mb-1"><strong>Shell:</strong> <span class="font-monospace">{app.shellServiceId ?? "not selected"}</span></div>
                  <div class="small mb-1"><strong>Auth:</strong> <span class="font-monospace">{app.authServiceId ?? "not selected"}</span></div>
                  <div class="small mb-2"><strong>Routes:</strong> {app.routeCount}</div>
                  <div class="btn-group btn-group-sm">
                    <button
                      class="btn btn-outline-primary"
                      data-bs-toggle="offcanvas"
                      data-bs-target="#bp-edit-app-panel"
                      data-bp-edit-app={JSON.stringify(app)}
                    >Edit</button>
                    <button
                      class="btn btn-outline-danger"
                      hx-delete={`${tenantsPath}?entity=app&id=${encodeURIComponent(app.id)}`}
                      hx-confirm={`Delete app ${app.id}?`}
                      hx-target="#bp-main"
                      hx-swap="innerHTML"
                    >Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Add Tenant -- */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-tenant-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add Tenant</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-add-tenant-form" hx-post={tenantsPath} hx-target="#bp-main" hx-swap="innerHTML">
            <input type="hidden" name="entity" value="tenant" />
            <div class="mb-3">
              <label class="form-label">Tenant Name</label>
              <input type="text" class="form-control" name="title" placeholder="My Organization" required />
              <div class="form-text">ID is generated automatically.</div>
            </div>
            <div class="alert alert-danger d-none" id="bp-tenant-error"></div>
            <button type="submit" class="btn btn-primary w-100">Create Tenant</button>
          </form>
        </div>
      </div>

      {/* -- Edit Tenant -- */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-tenant-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Edit Tenant</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-edit-tenant-form" hx-put={tenantsPath} hx-target="#bp-main" hx-swap="innerHTML">
            <input type="hidden" name="entity" value="tenant" />
            <input type="hidden" name="tenantId" />
            <div class="mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" name="title" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Slug</label>
              <input type="text" class="form-control font-monospace" name="slug" required />
            </div>
            <div class="form-check form-switch mb-3">
              <input type="hidden" name="active" value="false" />
              <input class="form-check-input" type="checkbox" name="active" value="true" id="bp-tenant-active" />
              <label class="form-check-label" for="bp-tenant-active">Active</label>
            </div>
            <div class="alert alert-danger d-none" id="bp-edit-tenant-error"></div>
            <button type="submit" class="btn btn-primary w-100">Save</button>
          </form>
        </div>
      </div>

      {/* -- Add App -- */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-app-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add App</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-add-app-form" hx-post={tenantsPath} hx-target="#bp-main" hx-swap="innerHTML">
            <input type="hidden" name="entity" value="app" />
            <div class="mb-3">
              <label class="form-label">Tenant</label>
              <select class="form-select" name="tenantId" required>
                <option value="">Select tenant...</option>
                {data.tenants.map((t) => (<option value={t.id}>{t.title}</option>))}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">App Name</label>
              <input type="text" class="form-control" name="title" placeholder="Web App" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Hostname</label>
              <input type="text" class="form-control" name="hostname" placeholder="localhost:3100" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Shell service</label>
              <select class="form-select" name="shellServiceId" data-bp-tenant-scoped="">
                <option value="">No shell selected</option>
                {data.shellServices.map((service) => (
                  <option value={service.id} data-bp-tenant-id={service.tenantId}>{service.title}</option>
                ))}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Auth provider</label>
              <select class="form-select" name="authServiceId" data-bp-tenant-scoped="">
                <option value="">No auth provider</option>
                {data.authServices.map((service) => (
                  <option value={service.id} data-bp-tenant-id={service.tenantId}>{service.title}</option>
                ))}
              </select>
            </div>
            <div class="alert alert-danger d-none" id="bp-app-error"></div>
            <button type="submit" class="btn btn-primary w-100">Create App</button>
          </form>
        </div>
      </div>

      {/* -- Edit App -- */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-app-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Edit App</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-edit-app-form" hx-put={tenantsPath} hx-target="#bp-main" hx-swap="innerHTML">
            <input type="hidden" name="entity" value="app" />
            <input type="hidden" name="appId" />
            <div class="mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" name="title" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Slug</label>
              <input type="text" class="form-control font-monospace" name="slug" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Hostnames (comma-separated)</label>
              <input type="text" class="form-control" name="hostnames" placeholder="localhost:3100, example.com" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Shell service</label>
              <select class="form-select" name="shellServiceId" data-bp-tenant-scoped="">
                <option value="">No shell selected</option>
                {data.shellServices.map((service) => (
                  <option value={service.id} data-bp-tenant-id={service.tenantId}>{service.title}</option>
                ))}
              </select>
              <div class="form-text">Only theme-capable services registered for this app's tenant should be selected.</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Auth provider</label>
              <select class="form-select" name="authServiceId" data-bp-tenant-scoped="">
                <option value="">No auth provider</option>
                {data.authServices.map((service) => (
                  <option value={service.id} data-bp-tenant-id={service.tenantId}>{service.title}</option>
                ))}
              </select>
              <div class="form-text">Only auth-capable services registered for this app's tenant should be selected.</div>
            </div>
            <div class="alert alert-danger d-none" id="bp-edit-app-error"></div>
            <button type="submit" class="btn btn-primary w-100">Save</button>
          </form>
        </div>
      </div>

      <script>{tenantsScript(apiBase, serviceUrl)}</script>
    </div>
  );
}
