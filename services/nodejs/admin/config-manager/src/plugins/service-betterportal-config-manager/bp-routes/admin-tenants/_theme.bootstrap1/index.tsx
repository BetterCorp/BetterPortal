/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function tenantsScript(apiBase: string, serviceUrl: string): HtmlRenderable {
  return js(`{
    const apiBase = ${JSON.stringify(apiBase)};
    const serviceUrl = ${JSON.stringify(serviceUrl)};

    const reloadContent = () => {
      const target = document.getElementById("bp-main") || document.querySelector("[data-bp-main-outlet]");
      if (target && window.htmx) window.htmx.ajax("GET", serviceUrl + "/admin-tenants", { target, swap: "innerHTML" });
    };

    const closeOffcanvas = (id) => {
      const el = document.getElementById(id);
      if (el && window.bootstrap) {
        const oc = window.bootstrap.Offcanvas.getInstance(el);
        if (oc) oc.hide();
      }
    };

    // ── Add tenant ──
    document.getElementById("bp-add-tenant-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = fd.get("title");
      if (!title) return;
      const slug = title.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const res = await fetch(apiBase + "/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slug, slug, title, active: true, branding: {}, services: [], activatedPlatformServices: [] })
      });

      if (res.ok) { closeOffcanvas("bp-add-tenant-panel"); reloadContent(); }
      else { const err = document.getElementById("bp-tenant-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    // ── Edit tenant ──
    document.querySelectorAll("[data-bp-edit-tenant]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = JSON.parse(btn.dataset.bpEditTenant);
        const form = document.getElementById("bp-edit-tenant-form");
        if (!form) return;
        form.querySelector("[name=tenantId]").value = data.id;
        form.querySelector("[name=title]").value = data.title;
        form.querySelector("[name=slug]").value = data.slug;
        form.querySelector("[name=active]").checked = data.active;
      });
    });

    document.getElementById("bp-edit-tenant-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const tenantId = fd.get("tenantId");
      const res = await fetch(apiBase + "/tenants/" + tenantId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          slug: fd.get("slug"),
          active: e.target.querySelector("[name=active]").checked
        })
      });
      if (res.ok) { closeOffcanvas("bp-edit-tenant-panel"); reloadContent(); }
      else { const err = document.getElementById("bp-edit-tenant-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    // ── Add app ──
    document.getElementById("bp-add-app-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = fd.get("title");
      const tenantId = fd.get("tenantId");
      const hostname = fd.get("hostname");
      const themeId = fd.get("themeId") || "bootstrap1";
      if (!title || !tenantId || !hostname) return;

      const slug = title.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const id = tenantId + "-" + slug;

      const res = await fetch(apiBase + "/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, tenantId, slug, title,
          hostnames: [hostname], themeId,
          themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
          defaultRoute: "/", routes: [], slots: [], fragments: {}
        })
      });

      if (res.ok) { closeOffcanvas("bp-add-app-panel"); reloadContent(); }
      else { const err = document.getElementById("bp-app-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    // ── Edit app ──
    document.querySelectorAll("[data-bp-edit-app]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = JSON.parse(btn.dataset.bpEditApp);
        const form = document.getElementById("bp-edit-app-form");
        if (!form) return;
        form.querySelector("[name=appId]").value = data.id;
        form.querySelector("[name=title]").value = data.title;
        form.querySelector("[name=slug]").value = data.slug;
        form.querySelector("[name=hostnames]").value = data.hostnames.join(", ");
        form.querySelector("[name=themeId]").value = data.themeId;
      });
    });

    document.getElementById("bp-edit-app-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const appId = fd.get("appId");
      const hostnames = fd.get("hostnames").toString().split(",").map((h) => h.trim()).filter(Boolean);
      const res = await fetch(apiBase + "/apps/" + appId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          slug: fd.get("slug"),
          hostnames,
          themeId: fd.get("themeId")
        })
      });
      if (res.ok) { closeOffcanvas("bp-edit-app-panel"); reloadContent(); }
      else { const err = document.getElementById("bp-edit-app-error"); if (err) { err.textContent = (await res.json()).error; err.classList.remove("d-none"); } }
    });

    // ── Delete ──
    document.querySelectorAll("[data-bp-delete-tenant]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete tenant " + btn.dataset.bpDeleteTenant + " and all its apps?")) return;
        await fetch(apiBase + "/tenants/" + btn.dataset.bpDeleteTenant, { method: "DELETE" });
        reloadContent();
      });
    });

    document.querySelectorAll("[data-bp-delete-app]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete app " + btn.dataset.bpDeleteApp + "?")) return;
        await fetch(apiBase + "/apps/" + btn.dataset.bpDeleteApp, { method: "DELETE" });
        reloadContent();
      });
    });
  }`);
}

export function render(data: ResponseData): HtmlRenderable {
  const serviceUrl = data.serviceBaseUrl ?? "";
  const apiBase = serviceUrl + data.adminApiBase;

  return (
    <div class="container-fluid px-0">
      <h2 class="mb-4">{data.title}</h2>

      {/* ── Tenants ── */}
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
                      <button class="btn btn-outline-danger" data-bp-delete-tenant={t.id}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Apps ── */}
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
                    <span class="badge text-bg-secondary">{app.themeId}</span>
                  </div>
                  <div class="small mb-1"><strong>Tenant:</strong> {app.tenantId}</div>
                  <div class="small mb-1"><strong>Hostnames:</strong> {app.hostnames.join(", ")}</div>
                  <div class="small mb-1"><strong>Theme:</strong> {app.themeId}</div>
                  <div class="small mb-2"><strong>Routes:</strong> {app.routeCount}</div>
                  <div class="btn-group btn-group-sm">
                    <button
                      class="btn btn-outline-primary"
                      data-bs-toggle="offcanvas"
                      data-bs-target="#bp-edit-app-panel"
                      data-bp-edit-app={JSON.stringify(app)}
                    >Edit</button>
                    <button class="btn btn-outline-danger" data-bp-delete-app={app.id}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Tenant ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-tenant-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add Tenant</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-add-tenant-form">
            <div class="mb-3">
              <label class="form-label">Tenant Name</label>
              <input type="text" class="form-control" name="title" placeholder="My Organization" required />
              <div class="form-text">ID and slug auto-derived from name.</div>
            </div>
            <div class="alert alert-danger d-none" id="bp-tenant-error"></div>
            <button type="submit" class="btn btn-primary w-100">Create Tenant</button>
          </form>
        </div>
      </div>

      {/* ── Edit Tenant ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-tenant-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Edit Tenant</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-edit-tenant-form">
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
              <input class="form-check-input" type="checkbox" name="active" id="bp-tenant-active" />
              <label class="form-check-label" for="bp-tenant-active">Active</label>
            </div>
            <div class="alert alert-danger d-none" id="bp-edit-tenant-error"></div>
            <button type="submit" class="btn btn-primary w-100">Save</button>
          </form>
        </div>
      </div>

      {/* ── Add App ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-app-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Add App</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-add-app-form">
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
              <label class="form-label">Theme</label>
              <select class="form-select" name="themeId">
                <option value="bootstrap1" selected>Bootstrap 1</option>
                <option value="embedded">Embedded</option>
              </select>
            </div>
            <div class="alert alert-danger d-none" id="bp-app-error"></div>
            <button type="submit" class="btn btn-primary w-100">Create App</button>
          </form>
        </div>
      </div>

      {/* ── Edit App ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-app-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Edit App</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-edit-app-form">
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
              <label class="form-label">Theme</label>
              <select class="form-select" name="themeId">
                <option value="bootstrap1">Bootstrap 1</option>
                <option value="embedded">Embedded</option>
              </select>
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
