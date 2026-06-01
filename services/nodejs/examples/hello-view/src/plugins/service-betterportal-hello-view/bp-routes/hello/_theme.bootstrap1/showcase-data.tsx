/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { ResponseData } from "../index.js";

/* ════════════════════════════════════════════
   Data Table (paginated sub-component)
   ════════════════════════════════════════════ */

const ALL_USERS = [
  { name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "Active", statusColor: "success", joined: "Jan 15, 2025" },
  { name: "Bob Smith", email: "bob@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Jan 22, 2025" },
  { name: "Carol White", email: "carol@example.com", role: "Viewer", status: "Pending", statusColor: "warning", joined: "Feb 3, 2025" },
  { name: "Dave Brown", email: "dave@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Feb 14, 2025" },
  { name: "Eve Davis", email: "eve@example.com", role: "Admin", status: "Suspended", statusColor: "danger", joined: "Feb 28, 2025" },
  { name: "Frank Miller", email: "frank@example.com", role: "Viewer", status: "Active", statusColor: "success", joined: "Mar 5, 2025" },
  { name: "Grace Lee", email: "grace@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Mar 12, 2025" },
  { name: "Henry Wilson", email: "henry@example.com", role: "Viewer", status: "Pending", statusColor: "warning", joined: "Mar 18, 2025" },
  { name: "Ivy Chen", email: "ivy@example.com", role: "Admin", status: "Active", statusColor: "success", joined: "Mar 22, 2025" },
  { name: "Jack Taylor", email: "jack@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Mar 28, 2025" },
  { name: "Kate Moore", email: "kate@example.com", role: "Viewer", status: "Suspended", statusColor: "danger", joined: "Apr 1, 2025" },
  { name: "Leo Garcia", email: "leo@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Apr 5, 2025" },
  { name: "Mia Robinson", email: "mia@example.com", role: "Viewer", status: "Active", statusColor: "success", joined: "Apr 8, 2025" },
  { name: "Noah Clark", email: "noah@example.com", role: "Admin", status: "Active", statusColor: "success", joined: "Apr 10, 2025" },
  { name: "Olivia Hall", email: "olivia@example.com", role: "Viewer", status: "Pending", statusColor: "warning", joined: "Apr 12, 2025" },
  { name: "Paul King", email: "paul@example.com", role: "Editor", status: "Active", statusColor: "success", joined: "Apr 14, 2025" },
  { name: "Quinn Adams", email: "quinn@example.com", role: "Viewer", status: "Active", statusColor: "success", joined: "Apr 15, 2025" },
  { name: "Ruby Scott", email: "ruby@example.com", role: "Editor", status: "Suspended", statusColor: "danger", joined: "Apr 16, 2025" },
];

const PAGE_SIZE = 6;
const TOTAL_PAGES = Math.ceil(ALL_USERS.length / PAGE_SIZE);

/**
 * Render the user table component.
 * @param page - current page number
 * @param routePath - the PARENT route's internal path (e.g., "/showcase/data")
 *                    pagination uses ?_c=user-table&page=N against this path
 */
function renderDataTableFragment(page: number, routePath: string): HtmlRenderable {
  const safePage = Math.max(1, Math.min(page, TOTAL_PAGES));
  const start = (safePage - 1) * PAGE_SIZE;
  const users = ALL_USERS.slice(start, start + PAGE_SIZE);

  function pageBtn(p: number, label: string, disabled: boolean): HtmlRenderable {
    if (disabled) {
      return (
        <li class="page-item disabled">
          <span class="page-link">{label}</span>
        </li>
      );
    }
    return (
      <li class={`page-item${p === safePage ? " active" : ""}`}>
        <button type="button" class="page-link"
          hx-get={`${routePath}?_c=user-table&page=${p}`}
          hx-target="#bp-c-user-table"
          hx-swap="innerHTML"
        >{label}</button>
      </li>
    );
  }

  return (
    <div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th class="text-end">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr>
                <td class="fw-semibold">{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td><span class={`badge text-bg-${user.statusColor}${user.statusColor === "warning" ? " text-dark" : ""}`}>{user.status}</span></td>
                <td class="text-end text-body-secondary">{user.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="card-footer d-flex justify-content-between align-items-center">
        <span class="text-body-secondary small">Showing {start + 1}–{Math.min(start + PAGE_SIZE, ALL_USERS.length)} of {ALL_USERS.length}</span>
        <nav>
          <ul class="pagination pagination-sm mb-0">
            {pageBtn(safePage - 1, "←", safePage <= 1)}
            {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((p) => pageBtn(p, String(p), false))}
            {pageBtn(safePage + 1, "→", safePage >= TOTAL_PAGES)}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Showcase: Data Display
   ════════════════════════════════════════════ */

export function render(data: ResponseData, page = 1): HtmlRenderable {
  const routePath = "/hello";
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">Data Display</h2>
          <p class="text-body-secondary">Functional table with HTMX pagination, list groups, progress bars, and tabs.</p>
        </div>

        {/* Functional table — component container */}
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>User Directory</span>
            <button class="btn btn-primary btn-sm">Add User</button>
          </div>
          <div class="card-body p-0" id="bp-c-user-table">
            {renderDataTableFragment(page, routePath)}
          </div>
        </div>

        {/* List group */}
        <div class="row g-3">
          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h5 class="card-title mb-3">List Group</h5>
                <div class="list-group">
                  <a href="javascript:;" class="list-group-item list-group-item-action active">Dashboard Overview</a>
                  <a href="javascript:;" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">Notifications <span class="badge text-bg-primary rounded-pill">14</span></a>
                  <a href="javascript:;" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">Messages <span class="badge text-bg-primary rounded-pill">3</span></a>
                  <a href="javascript:;" class="list-group-item list-group-item-action">Team Members</a>
                  <a href="javascript:;" class="list-group-item list-group-item-action disabled">Billing (Locked)</a>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h5 class="card-title mb-3">Progress Bars</h5>
                <div class="d-flex flex-column gap-3">
                  <div>
                    <div class="d-flex justify-content-between mb-1"><small class="fw-semibold">Storage</small><small class="text-body-secondary">64%</small></div>
                    <div class="progress"><div class="progress-bar" style="width: 64%"></div></div>
                  </div>
                  <div>
                    <div class="d-flex justify-content-between mb-1"><small class="fw-semibold">Bandwidth</small><small class="text-body-secondary">28%</small></div>
                    <div class="progress"><div class="progress-bar bg-success" style="width: 28%"></div></div>
                  </div>
                  <div>
                    <div class="d-flex justify-content-between mb-1"><small class="fw-semibold">CPU Usage</small><small class="text-body-secondary">89%</small></div>
                    <div class="progress"><div class="progress-bar bg-danger" style="width: 89%"></div></div>
                  </div>
                  <div>
                    <div class="d-flex justify-content-between mb-1"><small class="fw-semibold">Memory</small><small class="text-body-secondary">52%</small></div>
                    <div class="progress"><div class="progress-bar bg-warning" style="width: 52%"></div></div>
                  </div>
                  <div>
                    <div class="d-flex justify-content-between mb-1"><small class="fw-semibold">API Quota</small><small class="text-body-secondary">15%</small></div>
                    <div class="progress"><div class="progress-bar bg-info" style="width: 15%"></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Tabs</h5>
            <ul class="nav nav-tabs mb-3">
              <li class="nav-item"><a class="nav-link active" href="javascript:;">Overview</a></li>
              <li class="nav-item"><a class="nav-link" href="javascript:;">Analytics</a></li>
              <li class="nav-item"><a class="nav-link" href="javascript:;">Reports</a></li>
              <li class="nav-item"><a class="nav-link disabled" href="javascript:;">Export</a></li>
            </ul>
            <p class="text-body-secondary mb-0">Tab content area. Each tab would load different content via HTMX or show/hide panels.</p>
          </div>
        </div>

        {/* Pills nav */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Nav Pills</h5>
            <ul class="nav nav-pills mb-3">
              <li class="nav-item"><a class="nav-link active" href="javascript:;">All</a></li>
              <li class="nav-item"><a class="nav-link" href="javascript:;">Active</a></li>
              <li class="nav-item"><a class="nav-link" href="javascript:;">Archived</a></li>
              <li class="nav-item"><a class="nav-link" href="javascript:;">Deleted</a></li>
            </ul>
            <p class="text-body-secondary mb-0">Pill navigation for filtering or view switching within a page section.</p>
          </div>
        </div>

      </div>
    </section>
  );
}
