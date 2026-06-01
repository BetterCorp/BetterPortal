/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <section class="container-fluid px-0">
      <div class="d-flex flex-column gap-4">

        <div>
          <h2 class="h4 mb-1">UI Patterns</h2>
          <p class="text-body-secondary">Common UI patterns: empty states, search, avatars, timelines, toolbars, and step wizards.</p>
        </div>

        {/* ── Empty States ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Empty States</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-body text-center py-5">
                    <div class="mb-3" style="font-size:2.5rem;opacity:0.3;">📋</div>
                    <h6>No Projects Yet</h6>
                    <p class="text-body-secondary small mb-3">Create your first project to get started.</p>
                    <button class="btn btn-primary btn-sm">Create Project</button>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-body text-center py-5">
                    <div class="mb-3" style="font-size:2.5rem;opacity:0.3;">🔍</div>
                    <h6>No Results Found</h6>
                    <p class="text-body-secondary small mb-3">Try adjusting your search or filter criteria.</p>
                    <button class="btn btn-outline-secondary btn-sm">Clear Filters</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Search Patterns</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Basic Search</label>
                <div class="input-group">
                  <span class="input-group-text">🔍</span>
                  <input type="search" class="form-control" placeholder="Search users, projects, settings..." />
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Search with Button</label>
                <div class="input-group">
                  <input type="search" class="form-control" placeholder="Find anything..." />
                  <button class="btn btn-primary" type="button">Search</button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">Search Results Preview</label>
                <div class="card">
                  <div class="list-group list-group-flush">
                    <a href="javascript:;" class="list-group-item list-group-item-action">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <div class="fw-semibold">Jane Doe</div>
                          <small class="text-body-secondary">jane@example.com · Admin</small>
                        </div>
                        <span class="badge text-bg-primary rounded-pill">User</span>
                      </div>
                    </a>
                    <a href="javascript:;" class="list-group-item list-group-item-action">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <div class="fw-semibold">Dashboard Settings</div>
                          <small class="text-body-secondary">Settings → Dashboard → Layout</small>
                        </div>
                        <span class="badge text-bg-secondary rounded-pill">Setting</span>
                      </div>
                    </a>
                    <a href="javascript:;" class="list-group-item list-group-item-action">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <div class="fw-semibold">Project Alpha</div>
                          <small class="text-body-secondary">Created Mar 15, 2025 · 12 members</small>
                        </div>
                        <span class="badge text-bg-success rounded-pill">Project</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Avatars ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Avatars &amp; User Chips</h5>
            <div class="d-flex flex-column gap-3">
              <div>
                <h6 class="small text-body-secondary mb-2">Sizes</h6>
                <div class="d-flex align-items-center gap-3">
                  {[
                    { size: "1.5rem", fs: "0.55rem", initials: "SM" },
                    { size: "2rem", fs: "0.7rem", initials: "MD" },
                    { size: "2.5rem", fs: "0.85rem", initials: "LG" },
                    { size: "3.5rem", fs: "1.1rem", initials: "XL" }
                  ].map((a) => (
                    <div class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-semibold" style={`width:${a.size};height:${a.size};font-size:${a.fs};`}>{a.initials}</div>
                  ))}
                </div>
              </div>
              <div>
                <h6 class="small text-body-secondary mb-2">Avatar Group (stacked)</h6>
                <div class="d-flex" style="margin-left:0.5rem;">
                  {["JD", "AS", "BW", "CL", "+4"].map((initials, i) => (
                    <div
                      class={`rounded-circle ${initials.startsWith("+") ? "bg-secondary" : "bg-primary"} text-white d-inline-flex align-items-center justify-content-center fw-semibold border border-2 border-white`}
                      style={`width:2.2rem;height:2.2rem;font-size:0.68rem;margin-left:-0.5rem;z-index:${5 - i};position:relative;`}
                    >{initials}</div>
                  ))}
                </div>
              </div>
              <div>
                <h6 class="small text-body-secondary mb-2">User Chips</h6>
                <div class="d-flex flex-wrap gap-2">
                  {[
                    { name: "Jane Doe", role: "Admin", color: "primary" },
                    { name: "Bob Smith", role: "Editor", color: "success" },
                    { name: "Carol White", role: "Viewer", color: "info" }
                  ].map((user) => (
                    <span class="d-inline-flex align-items-center gap-2 border rounded-pill px-2 py-1">
                      <span class={`rounded-circle bg-${user.color} text-white d-inline-flex align-items-center justify-content-center fw-semibold`} style="width:1.5rem;height:1.5rem;font-size:0.55rem;">{user.name.split(" ").map((n) => n[0]).join("")}</span>
                      <span class="small fw-semibold">{user.name}</span>
                      <span class={`badge text-bg-${user.color} rounded-pill`} style="font-size:0.65rem;">{user.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Timeline / Activity Feed ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Activity Timeline</h5>
            <div class="d-flex flex-column gap-0">
              {[
                { time: "2 min ago", icon: "🟢", title: "Deployment completed", desc: "Production v2.4.1 deployed successfully.", badge: "Success", color: "success" },
                { time: "15 min ago", icon: "👤", title: "New user registered", desc: "alex@example.com joined the workspace.", badge: "User", color: "primary" },
                { time: "1 hr ago", icon: "⚙️", title: "Config updated", desc: "SMTP settings changed by admin@example.com.", badge: "Config", color: "secondary" },
                { time: "3 hr ago", icon: "🔴", title: "Alert triggered", desc: "CPU usage exceeded 90% on node-3.", badge: "Critical", color: "danger" },
                { time: "6 hr ago", icon: "📦", title: "Backup completed", desc: "Daily backup finished. Size: 2.4GB.", badge: "System", color: "info" }
              ].map((event, i) => (
                <div class="d-flex gap-3 position-relative" style="padding-bottom:1.5rem;">
                  {i < 4 ? <div class="position-absolute" style="left:1rem;top:2.2rem;bottom:0;width:2px;background:var(--bp-border,rgba(0,0,0,0.06));"></div> : ""}
                  <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-white border" style="width:2.2rem;height:2.2rem;font-size:0.85rem;z-index:1;">{event.icon}</div>
                  <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div class="fw-semibold">{event.title}</div>
                      <small class="text-body-secondary text-nowrap ms-2">{event.time}</small>
                    </div>
                    <div class="text-body-secondary small">{event.desc}</div>
                    <span class={`badge text-bg-${event.color} mt-1`} style="font-size:0.65rem;">{event.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Toolbar / Action Bar ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Toolbars</h5>
            <div class="d-flex flex-column gap-3">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 p-2 border rounded">
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-primary">New</button>
                  <button class="btn btn-sm btn-outline-secondary">Import</button>
                  <button class="btn btn-sm btn-outline-secondary">Export</button>
                </div>
                <div class="d-flex gap-2 align-items-center">
                  <input type="search" class="form-control form-control-sm" placeholder="Filter..." style="max-width:200px;" />
                  <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">Sort</button>
                    <ul class="dropdown-menu dropdown-menu-end">
                      <li><a class="dropdown-item" href="javascript:;">Name A–Z</a></li>
                      <li><a class="dropdown-item" href="javascript:;">Date Created</a></li>
                      <li><a class="dropdown-item" href="javascript:;">Last Modified</a></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 p-2 border rounded bg-primary bg-opacity-10">
                <span class="small fw-semibold">3 items selected</span>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary">Move</button>
                  <button class="btn btn-sm btn-outline-primary">Tag</button>
                  <button class="btn btn-sm btn-outline-danger">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Steps / Wizard ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Steps / Wizard</h5>
            <div class="d-flex justify-content-between align-items-center mb-4" style="max-width:600px;">
              {[
                { num: "1", label: "Account", done: true },
                { num: "2", label: "Profile", done: true },
                { num: "3", label: "Settings", done: false, active: true },
                { num: "4", label: "Review", done: false }
              ].map((step, i) => (
                <div class="d-flex align-items-center gap-0 flex-grow-1">
                  <div class="text-center">
                    <div class={`rounded-circle d-inline-flex align-items-center justify-content-center fw-bold ${step.done ? "bg-success text-white" : step.active ? "bg-primary text-white" : "bg-light text-body-secondary border"}`} style="width:2.2rem;height:2.2rem;font-size:0.8rem;">
                      {step.done ? "✓" : step.num}
                    </div>
                    <div class={`small mt-1 ${step.active ? "fw-semibold" : "text-body-secondary"}`}>{step.label}</div>
                  </div>
                  {i < 3 ? <div class={`flex-grow-1 mx-2 ${step.done ? "bg-success" : "bg-light"}`} style="height:2px;"></div> : ""}
                </div>
              ))}
            </div>
            <div class="card">
              <div class="card-body">
                <h6>Step 3: Settings</h6>
                <p class="text-body-secondary">Configure your notification preferences and privacy settings.</p>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Timezone</label>
                    <select class="form-select">
                      <option>UTC-8 Pacific</option>
                      <option selected>UTC-5 Eastern</option>
                      <option>UTC+0 London</option>
                      <option>UTC+9 Tokyo</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Language</label>
                    <select class="form-select">
                      <option selected>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                </div>
                <div class="d-flex justify-content-between mt-4">
                  <button class="btn btn-outline-secondary">← Back</button>
                  <button class="btn btn-primary">Continue →</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Input Groups ── */}
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-3">Input Groups</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">URL</label>
                <div class="input-group">
                  <span class="input-group-text">https://</span>
                  <input type="text" class="form-control" placeholder="example.com" />
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Price</label>
                <div class="input-group">
                  <span class="input-group-text">$</span>
                  <input type="number" class="form-control" placeholder="0.00" />
                  <span class="input-group-text">USD</span>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text">@</span>
                  <input type="text" class="form-control" placeholder="username" />
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">API Key</label>
                <div class="input-group">
                  <input type="text" class="form-control font-monospace" value="sk_live_abc123..." readonly />
                  <button class="btn btn-outline-secondary" type="button">Copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
