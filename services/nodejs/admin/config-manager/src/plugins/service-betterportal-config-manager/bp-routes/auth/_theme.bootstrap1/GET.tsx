/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function permsScript(apiBase: string, serviceUrl: string, selectedAppId: string | undefined): HtmlRenderable {
  return js(`(() => {
    const apiBase = ${JSON.stringify(apiBase)};
    const appId = ${JSON.stringify(selectedAppId ?? "")};

    if (!appId) return;

    document.querySelectorAll("[data-bp-edit-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = JSON.parse(btn.dataset.bpEditRole);
        const form = document.getElementById("bp-edit-role-form");
        if (!form) return;
        form.setAttribute("hx-put", apiBase + "/apps/" + encodeURIComponent(appId) + "/auth/roles/" + encodeURIComponent(role.id));
        form.querySelector("[name=roleId]").value = role.id;
        form.querySelector("[name=title]").value = role.title;
        form.querySelector("[name=description]").value = role.description || "";
        form.querySelectorAll("[data-bp-grant]").forEach((box) => {
          const [sid, vid, action] = box.dataset.bpGrant.split("|");
          const grant = role.permissions.find((p) => p.serviceId === sid && p.viewId === vid);
          box.checked = !!(grant && grant.permissions.includes(action));
        });
        if (window.htmx) window.htmx.process(form);
      });
    });
  })()`);
}

const ACTIONS = ["read", "create", "update", "delete"] as const;

export function render(data: ResponseData): HtmlRenderable {
  const serviceUrl = data.serviceBaseUrl ?? "";
  const apiBase = serviceUrl + data.adminApiBase;
  const authPath = `${serviceUrl}/auth`;
  const selectedApp = data.apps.find((a) => a.id === data.selectedAppId);

  return (
    <div class="container-fluid px-0">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="mb-1">{data.title}</h2>
          <p class="text-secondary mb-0">Define roles + permission grants per app. Services advertise per-view requirements via manifest.</p>
        </div>
        {selectedApp && data.authConfigured ? (
          <button class="btn btn-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-add-role-panel">+ Add Role</button>
        ) : null}
      </div>

      {/* -- App selector -- */}
      <div class="mb-4">
        <label class="form-label">App</label>
        <select
          class="form-select"
          id="bp-app-select"
          name="appId"
          hx-get={authPath}
          hx-trigger="change"
          hx-target="#bp-main"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          <option value="">Select app...</option>
          {data.apps.map((a) => (
            <option value={a.id} selected={a.id === data.selectedAppId ? true : undefined}>{a.title}</option>
          ))}
        </select>
      </div>

      {!selectedApp ? (
        <div class="alert alert-secondary">Select an app to manage its roles. No apps? Create one in <strong>Tenants & Apps</strong>.</div>
      ) : !data.authConfigured ? (
        <div class="alert alert-warning">
          Configure an auth provider for this app before creating roles.
        </div>
      ) : (
        <div class="row g-4">
          {/* -- Roles column -- */}
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Roles for {selectedApp.title} ({data.currentRoles.length})</h5>
                {data.currentRoles.length === 0 ? (
                  <div class="alert alert-secondary mb-0">No roles defined. Click "Add Role" to create one.</div>
                ) : (
                  <div class="table-responsive">
                    <table class="table table-sm align-middle">
                      <thead><tr><th>ID</th><th>Title</th><th>Grants</th><th></th></tr></thead>
                      <tbody>
                        {data.currentRoles.map((r) => (
                          <tr>
                            <td class="font-monospace small">{r.id}</td>
                            <td>
                              <div>{r.title}</div>
                              {r.description ? <div class="small text-secondary">{r.description}</div> : null}
                            </td>
                            <td><span class="badge text-bg-secondary">{r.permissions.length} grant{r.permissions.length === 1 ? "" : "s"}</span></td>
                            <td>
                              <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-edit-role-panel" data-bp-edit-role={JSON.stringify(r)}>Edit</button>
                                <button
                                  class="btn btn-outline-danger"
                                  hx-delete={`${apiBase}/apps/${selectedApp.id}/auth/roles/${r.id}`}
                                  hx-confirm={`Delete role ${r.id}?`}
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
              </div>
            </div>
          </div>

          {/* -- Service catalog column -- */}
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h5 class="card-title mb-3">Available services & views</h5>
                {data.servicePermissions.length === 0 ? (
                  <div class="text-secondary small">No services registered yet.</div>
                ) : (
                  data.servicePermissions.map((s) => (
                    <div class="mb-3">
                      <div class="fw-semibold">{s.title}</div>
                      <div class="font-monospace small text-secondary mb-1">
                        {s.serviceId}
                        {s.manifestVersion ? ` - v${s.manifestVersion}` : " - manifest pending"}
                      </div>
                      {s.views.length === 0 ? (
                        <div class="small text-secondary fst-italic">No views in manifest cache.</div>
                      ) : (
                        <ul class="list-unstyled small mb-0">
                          {s.views.map((v) => (
                            <li class="ms-2">
                              <code>{v.viewId}</code>
                              <span class="text-secondary"> {v.path}</span>
                              {v.role ? <span class="badge text-bg-info ms-1">{v.role}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Add role offcanvas -- */}
      {selectedApp && data.authConfigured ? (
        <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-role-panel">
          <div class="offcanvas-header">
            <h5 class="offcanvas-title">Add Role</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
          </div>
          <div class="offcanvas-body">
            <form
              id="bp-add-role-form"
              hx-post={`${apiBase}/apps/${selectedApp.id}/auth/roles`}
              hx-target="#bp-main"
              hx-swap="innerHTML"
            >
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" name="title" placeholder="Administrator" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Description (optional)</label>
                <textarea class="form-control" name="description" rows={2}></textarea>
              </div>
              <div class="alert alert-danger d-none" id="bp-add-role-error"></div>
              <button type="submit" class="btn btn-primary w-100">Create Role</button>
              <p class="text-secondary small mt-2 mb-0">Grants are set via the Edit panel after creation.</p>
            </form>
          </div>
        </div>
      ) : null}

      {/* -- Edit role offcanvas with per-view grant checkboxes -- */}
      {selectedApp && data.authConfigured ? (
        <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-role-panel" style="--bs-offcanvas-width: 600px;">
          <div class="offcanvas-header">
            <h5 class="offcanvas-title">Edit Role</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
          </div>
          <div class="offcanvas-body">
            <form id="bp-edit-role-form" hx-target="#bp-main" hx-swap="innerHTML">
              <input type="hidden" name="roleId" />
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" name="title" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" name="description" rows={2}></textarea>
              </div>

              <h6 class="mt-4 mb-2">Permission grants</h6>
              <p class="small text-secondary">Check actions this role grants for each service view.</p>

              {data.servicePermissions.length === 0 || data.servicePermissions.every((s) => s.views.length === 0) ? (
                <div class="alert alert-secondary small mb-3">
                  No services or views in manifest cache yet. Services will appear here once they push their manifest (next poll cycle).
                </div>
              ) : (
                data.servicePermissions.map((s) => (
                  s.views.length === 0 ? null : (
                    <div class="mb-3">
                      <div class="fw-semibold small">{s.title}</div>
                      <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th class="small">View</th>
                              {ACTIONS.map((a) => (<th class="text-center small">{a}</th>))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.views.map((v) => (
                              <tr>
                                <td class="font-monospace small">{v.viewId}</td>
                                {ACTIONS.map((a) => (
                                  <td class="text-center">
                                    <input
                                      type="checkbox"
                                      class="form-check-input"
                                      name="grant"
                                      value={`${s.serviceId}|${v.viewId}|${a}`}
                                      data-bp-grant={`${s.serviceId}|${v.viewId}|${a}`}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                ))
              )}

              <div class="alert alert-danger d-none" id="bp-edit-role-error"></div>
              <button type="submit" class="btn btn-primary w-100">Save Role</button>
            </form>
          </div>
        </div>
      ) : null}

      <script>{permsScript(apiBase, serviceUrl, data.selectedAppId)}</script>
    </div>
  );
}
