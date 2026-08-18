/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../GET.js";

function permsScript(apiBase: string, serviceUrl: string, selectedAppId: string | undefined): HtmlRenderable {
  return js(`(() => {
    const apiBase = ${JSON.stringify(apiBase)};
    const appId = ${JSON.stringify(selectedAppId ?? "")};
    const PERMISSION_FLAGS = {
      read: 1,
      create: 2,
      update: 4,
      delete: 8
    };
    const ACTIONS = ["read", "create", "update", "delete"];

    const permissionsToMask = (permission) => (
      (permission?.read ? PERMISSION_FLAGS.read : 0) |
      (permission?.create ? PERMISSION_FLAGS.create : 0) |
      (permission?.update ? PERMISSION_FLAGS.update : 0) |
      (permission?.delete ? PERMISSION_FLAGS.delete : 0)
    );

    const maskToPermissions = (mask) => ({
      read: Boolean(mask & PERMISSION_FLAGS.read),
      create: Boolean(mask & PERMISSION_FLAGS.create),
      update: Boolean(mask & PERMISSION_FLAGS.update),
      delete: Boolean(mask & PERMISSION_FLAGS.delete)
    });

    const grantToPermission = (grant) => {
      const permission = { read: false, create: false, update: false, delete: false };
      for (const action of grant?.permissions ?? []) {
        if (Object.prototype.hasOwnProperty.call(permission, action)) permission[action] = true;
      }
      return permission;
    };

    const syncGrantInputs = (select) => {
      const serviceId = select.dataset.bpServiceId;
      const viewId = select.dataset.bpViewId;
      const holder = select.closest("[data-bp-permission-row]")?.querySelector("[data-bp-grant-inputs]");
      if (!serviceId || !viewId || !holder) return;
      holder.replaceChildren();
      const permission = maskToPermissions(Number(select.value || "0"));
      for (const action of ACTIONS) {
        if (!permission[action]) continue;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "grant";
        input.value = serviceId + "|" + viewId + "|" + action;
        holder.appendChild(input);
      }
    };

    const setRowMask = (select, mask) => {
      select.value = String(mask);
      syncGrantInputs(select);
    };

    const rowSelects = (root = document) => Array.from(root.querySelectorAll("[data-bp-permission-select]"));

    const applyServiceMask = (serviceId, mask) => {
      rowSelects().forEach((select) => {
        if (select.dataset.bpServiceId === serviceId) setRowMask(select, mask);
      });
    };

    const applyGlobalMask = (mask) => {
      const serviceIds = new Set(rowSelects().map((select) => select.dataset.bpServiceId).filter(Boolean));
      serviceIds.forEach((serviceId) => applyServiceMask(serviceId, mask));
    };

    if (!appId) return;

    rowSelects().forEach((select) => {
      if (select.dataset.bpPermissionReady) return;
      select.dataset.bpPermissionReady = "true";
      select.addEventListener("change", () => syncGrantInputs(select));
    });

    document.querySelectorAll("[data-bp-service-permission-bulk]").forEach((select) => {
      if (select.dataset.bpPermissionReady) return;
      select.dataset.bpPermissionReady = "true";
      select.addEventListener("change", () => {
        if (select.value === "") return;
        const mask = Number(select.value);
        const serviceId = select.dataset.bpServiceId;
        if (!Number.isFinite(mask) || !serviceId) {
          select.value = "";
          return;
        }
        applyServiceMask(serviceId, mask);
        select.value = "";
      });
    });

    document.querySelectorAll("[data-bp-global-permission-bulk]").forEach((select) => {
      if (select.dataset.bpPermissionReady) return;
      select.dataset.bpPermissionReady = "true";
      select.addEventListener("change", () => {
        if (select.value === "") return;
        const mask = Number(select.value);
        if (Number.isFinite(mask)) applyGlobalMask(mask);
        select.value = "";
      });
    });

    document.querySelectorAll("[data-bp-edit-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = JSON.parse(btn.dataset.bpEditRole);
        const form = document.getElementById("bp-edit-role-form");
        if (!form) return;
        form.setAttribute("hx-put", apiBase + "/apps/" + encodeURIComponent(appId) + "/auth/roles/" + encodeURIComponent(role.id));
        form.querySelector("[name=roleId]").value = role.id;
        form.querySelector("[name=title]").value = role.title;
        form.querySelector("[name=description]").value = role.description || "";
        form.querySelectorAll("[data-bp-permission-select]").forEach((select) => {
          const sid = select.dataset.bpServiceId;
          const vid = select.dataset.bpViewId;
          const grant = (role.permissions ?? []).find((p) => p.serviceId === sid && p.viewId === vid);
          setRowMask(select, permissionsToMask(grantToPermission(grant)));
        });
        if (window.htmx) window.htmx.process(form, true);
      });
    });
  })()`);
}

const PERMISSION_OPTIONS = [
  [0, "No access"],
  [1, "Read"],
  [2, "Create"],
  [4, "Update"],
  [8, "Delete"],
  [3, "Read + Create"],
  [5, "Read + Update"],
  [9, "Read + Delete"],
  [6, "Create + Update"],
  [10, "Create + Delete"],
  [12, "Update + Delete"],
  [7, "Read + Create + Update"],
  [11, "Read + Create + Delete"],
  [13, "Read + Update + Delete"],
  [14, "Create + Update + Delete"],
  [15, "Read + Create + Update + Delete"]
] as const;

export function render(data: ResponseData): HtmlRenderable {
  const serviceUrl = data.serviceBaseUrl ?? "";
  const apiBase = serviceUrl + data.adminApiBase;
  const authPath = `${serviceUrl}/auth`;
  const selectedApp = data.apps.find((a) => a.id === data.selectedAppId);
  const externalRoleSync = data.externalRoleSync;
  const managedRoleSync = data.managedRoleSync;

  return (
    <div class="container-fluid px-0">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="mb-1">{data.title}</h2>
          <p class="text-secondary mb-0">Define roles + permission grants per app. Services advertise per-view requirements via manifest.</p>
        </div>
        {selectedApp && data.authConfigured && !externalRoleSync ? (
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
      ) : externalRoleSync ? (
        <div>
          <div class="alert alert-info">
            Roles for this app are managed by {externalRoleSync.serviceTitle}. Config Manager mirrors those roles for BP runtime permission checks.
          </div>
          <div
            hx-get={externalRoleSync.fragmentUrl}
            hx-trigger="load"
            hx-target="this"
            hx-swap="innerHTML"
          >
            <div class="text-secondary small">Loading WorkOS role sync status...</div>
          </div>
        </div>
      ) : (
        <div>
          {managedRoleSync ? (
            <div class="alert alert-info d-flex justify-content-between align-items-center gap-3">
              <span>Roles are managed by BetterPortal and synced to {managedRoleSync.serviceTitle}.</span>
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                hx-post={managedRoleSync.syncUrl}
                hx-swap="none"
              >Sync now</button>
              <div hidden hx-post={managedRoleSync.syncUrl} hx-trigger="load" hx-swap="none"></div>
            </div>
          ) : null}
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
                        {data.currentRoles.map((r) => {
                          const derived = (data.derivedPermissionGrants ?? []).filter((grant) => grant.roleId === r.id);
                          return <tr>
                            <td class="font-monospace small">{r.id}</td>
                            <td>
                              <div>{r.title}</div>
                              {r.description ? <div class="small text-secondary">{r.description}</div> : null}
                            </td>
                            <td>
                              <span class="badge text-bg-secondary">{r.permissions.length} explicit</span>
                              {derived.length > 0 ? <span class="badge text-bg-info ms-1">{derived.length} derived</span> : null}
                              {derived.map((grant) => (
                                <div class="small text-secondary mt-1">
                                  {grant.permissions.join(", ")} on <span class="font-monospace">{grant.viewId}</span>
                                  {" via "}
                                  {grant.requiredBy.map((source) => `${source.method} ${source.operationId}`).join(", ")}
                                </div>
                              ))}
                            </td>
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
                          </tr>;
                        })}
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
                              <div class="ms-3">
                                {v.operations.map((operation) => (
                                  <div>
                                    <code>{operation.operationId}</code>
                                    <span class="badge text-bg-secondary ms-1">{operation.method}</span>
                                    {operation.role ? <span class="badge text-bg-info ms-1">{operation.role}</span> : null}
                                  </div>
                                ))}
                              </div>
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
        </div>
      )}

      {/* -- Add role offcanvas -- */}
      {selectedApp && data.authConfigured && !externalRoleSync ? (
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
                <label class="form-label">Role ID</label>
                <input
                  type="text"
                  class="form-control font-monospace"
                  name="id"
                  placeholder="admin"
                  pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,63}"
                  required
                />
                <div class="form-text">Must match the role value emitted by the auth provider. Reserved ids cannot be created here.</div>
              </div>
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

      {/* -- Edit role offcanvas with per-view grant selectors -- */}
      {selectedApp && data.authConfigured && !externalRoleSync ? (
        <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-edit-role-panel" style="--bs-offcanvas-width: 600px;">
          <div class="offcanvas-header">
            <h5 class="offcanvas-title">Edit Role</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
          </div>
          <div class="offcanvas-body">
            <form id="bp-edit-role-form" data-bp-config="rewrite=false" hx-target="#bp-main" hx-swap="innerHTML">
              <input type="hidden" name="roleId" />
              <input type="hidden" name="grant" value="" />
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" name="title" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" name="description" rows={2}></textarea>
              </div>

              <h6 class="mt-4 mb-2">Permission grants</h6>
              <p class="small text-secondary">Choose the actions this role grants for each service view.</p>

              {data.servicePermissions.length === 0 || data.servicePermissions.every((s) => s.views.length === 0) ? (
                <div class="alert alert-secondary small mb-3">
                  No services or views in manifest cache yet. Services will appear here once they push their manifest (next poll cycle).
                </div>
              ) : (
                <div>
                  <div class="mb-3">
                    <label class="form-label small" for="bp-global-permission-bulk">Bulk permissions</label>
                    <select class="form-select form-select-sm" id="bp-global-permission-bulk" data-bp-global-permission-bulk="">
                      <option value="">- Change all service permissions -</option>
                      {PERMISSION_OPTIONS.map(([value, label]) => (
                        <option value={String(value)}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {data.servicePermissions.map((s) => (
                    s.views.length === 0 ? null : (
                      <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
                          <div>
                            <div class="fw-semibold small">{s.title}</div>
                            <div class="font-monospace text-secondary small">{s.serviceId}</div>
                          </div>
                          <select
                            class="form-select form-select-sm w-auto"
                            aria-label={`Change all permissions for ${s.title}`}
                            data-bp-service-permission-bulk=""
                            data-bp-service-id={s.serviceId}
                          >
                            <option value="">- Change all in this service -</option>
                            {PERMISSION_OPTIONS.map(([value, label]) => (
                              <option value={String(value)}>{label}</option>
                            ))}
                          </select>
                        </div>
                      <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th class="small">View</th>
                              <th class="small">Permissions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.views.map((v) => (
                              <tr data-bp-permission-row="">
                                <td class="small">
                                  <div class="font-monospace">{v.viewId}</div>
                                  {v.operations.map((operation) => (
                                    <div class="text-secondary">
                                      <code>{operation.operationId}</code> · {operation.method}
                                    </div>
                                  ))}
                                </td>
                                <td>
                                  <select
                                    class="form-select form-select-sm"
                                    aria-label={`Permissions for ${v.viewId}`}
                                    data-bp-permission-select=""
                                    data-bp-service-id={s.serviceId}
                                    data-bp-view-id={v.viewId}
                                  >
                                    {PERMISSION_OPTIONS.map(([value, label]) => (
                                      <option value={String(value)}>{label}</option>
                                    ))}
                                  </select>
                                  <span data-bp-grant-inputs=""></span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )
                  ))}
                </div>
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
