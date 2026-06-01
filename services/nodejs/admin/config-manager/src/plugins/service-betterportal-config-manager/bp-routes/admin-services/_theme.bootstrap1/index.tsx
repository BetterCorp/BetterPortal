/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework-nodejs";
import type { ResponseData } from "../index.js";

function configureAttrs(
  service: ResponseData["services"][number],
  appId: string | undefined,
  serviceTitle: string
): Record<string, string> {
  const qs = new URLSearchParams({
    hostname: service.hostname,
    tenantId: service.tenantId ?? "",
    title: serviceTitle,
    ...(appId ? { appId } : {})
  }).toString();

  if (service.supportsCustomUi && service.customUiPath && appId) {
    const target = `${service.hostname.replace(/\/+$/, "")}${service.customUiPath}?tenantId=${encodeURIComponent(service.tenantId ?? "")}&appId=${encodeURIComponent(appId)}`;
    const push = `${service.pushBase}?tenantId=${encodeURIComponent(service.tenantId ?? "")}&appId=${encodeURIComponent(appId)}`;
    return {
      "hx-get": target,
      "hx-target": "#bp-main",
      "hx-swap": "innerHTML",
      "hx-push-url": push
    };
  }

  return {
    "hx-get": `/.well-known/bp/admin/configure?${qs}`,
    "hx-target": "#bp-config-edit-form",
    "hx-swap": "innerHTML",
    "data-bs-toggle": "offcanvas",
    "data-bs-target": "#bp-config-edit-panel"
  };
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="container-fluid px-0">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="mb-1">{data.title}</h2>
          <p class="text-secondary mb-0">Register and manage service instances per tenant</p>
        </div>
        <button class="btn btn-primary" data-bs-toggle="offcanvas" data-bs-target="#bp-add-service-panel"
          hx-get="/.well-known/bp/admin/wizard/step1" hx-target="#bp-wizard-step" hx-swap="outerHTML">
          + Register Service
        </button>
      </div>

      {data.services.length === 0 ? (
        <div class="alert alert-secondary">No services registered yet</div>
      ) : (
        <div class="row g-3 mb-4">
          {data.services.map((service) => {
            const title = service.title ?? service.serviceId ?? service.hostname;
            const apps = service.tenantId ? (data.tenantApps[service.tenantId] ?? []) : [];
            return (
              <div class="col-12 col-lg-6">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 class="mb-0">{title}</h5>
                        <div class="small text-secondary font-monospace">{service.id}</div>
                      </div>
                      <span class={`badge ${
                        service.scope === "platform" ? "text-bg-info" :
                        service.scope === "theme" ? "text-bg-warning" :
                        "text-bg-primary"
                      }`}>{service.scope}</span>
                    </div>
                    {service.tenantId ? <div class="small mb-1"><strong>Tenant:</strong> {service.tenantId}</div> : ""}
                    <div class="small mb-1"><strong>URL:</strong> <span class="font-monospace">{service.hostname}</span></div>
                    {service.serviceId ? <div class="small mb-1"><strong>Plugin:</strong> <span class="font-monospace">{service.serviceId}</span></div> : ""}
                    <div class="small mb-1"><strong>Status:</strong> <span class={`badge ${service.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{service.enabled ? "active" : "disabled"}</span></div>
                    <div class="small mb-2"><strong>Created:</strong> {service.createdAt}{service.lastSeenAt ? ` · Last seen: ${service.lastSeenAt}` : ""}</div>
                    <div class="d-flex gap-2 flex-wrap align-items-center">
                      {apps.length > 1 ? (
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">Configure</button>
                          <ul class="dropdown-menu">
                            {apps.map((app) => (
                              <li>
                                <button type="button" class="dropdown-item" {...configureAttrs(service, app.id, `${title} · ${app.title}`)}>
                                  {app.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <button class="btn btn-sm btn-outline-primary"
                          {...configureAttrs(service, apps[0]?.id, title)}>
                          Configure
                        </button>
                      )}
                      {service.scope === "theme" ? "" : service.tenantId ? (
                        <button class="btn btn-sm btn-outline-danger"
                          hx-delete={`/.well-known/bp/admin/tenants/${service.tenantId}/services/${service.id}`}
                          hx-confirm="Remove this service registration?">
                          Remove
                        </button>
                      ) : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Offcanvas: Register Service (HTMX wizard) ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-service-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Register Service</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <div id="bp-wizard-step">
            <div class="text-center py-4 text-secondary">Loading...</div>
          </div>
        </div>
      </div>

      {/* ── Offcanvas: Config Editor ── */}
      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-config-edit-panel" style="width:480px;max-width:90vw;">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Configure Service</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <div id="bp-config-edit-form">
            <div class="text-center py-4 text-secondary">Loading...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
