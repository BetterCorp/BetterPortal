/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function configureAttrs(
  service: ResponseData["services"][number],
  appId: string | undefined,
  serviceTitle: string,
  adminApiBase: string
): Record<string, string> {
  const qs = new URLSearchParams({
    serviceInstanceId: service.id,
    hostname: service.hostname,
    tenantId: service.tenantId ?? "",
    title: serviceTitle,
    adminApiBase,
    ...(appId ? { appId } : {})
  }).toString();

  if (service.supportsCustomUi && service.customUiPath && appId) {
    const target = `${service.hostname.replace(/\/+$/, "")}${service.customUiPath}?tenantId=${encodeURIComponent(service.tenantId ?? "")}&appId=${encodeURIComponent(appId)}&adminApiBase=${encodeURIComponent(adminApiBase)}`;
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
    "hx-on::before-request": "document.getElementById('bp-config-edit-form').innerHTML='<div class=\"text-center py-4 text-secondary\">Loading...</div>'",
    "onclick": "document.getElementById('bp-config-edit-form').innerHTML='<div class=\"text-center py-4 text-secondary\">Loading...</div>'",
    "data-bs-toggle": "offcanvas",
    "data-bs-target": "#bp-config-edit-panel"
  };
}

function configureButton(
  service: ResponseData["services"][number],
  appId: string | undefined,
  serviceTitle: string,
  adminApiBase: string,
  label = "Configure",
  className = "btn btn-sm btn-outline-primary",
  disabledReason?: string
): HtmlRenderable {
  const reason = disabledReason ?? (!service.hasConfigurableOptions ? "No configurable options" : undefined);
  if (reason) return (
    <span title={reason}>
      <button class={className} type="button" disabled aria-disabled="true">
        {label}
      </button>
    </span>
  );

  return (
    <button class={className} type="button" {...configureAttrs(service, appId, serviceTitle, adminApiBase)}>
      {label}
    </button>
  );
}

function renderServiceCard(
  service: ResponseData["services"][number],
  data: ResponseData,
  tenantById: Map<string, ResponseData["tenants"][number]>
): HtmlRenderable {
  const title = service.title ?? service.serviceId ?? service.hostname;
  const adminApiBase = `${(data.serviceBaseUrl ?? "").replace(/\/+$/, "")}${data.adminApiBase}`;
  const apps = service.tenantId
    ? (data.tenantApps[service.tenantId] ?? [])
    : [];
  const tenant = service.tenantId ? tenantById.get(service.tenantId) : undefined;

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
              service.scope === "shell" ? "text-bg-warning" :
              service.scope === "shared" ? "text-bg-success" :
              "text-bg-primary"
            }`}>{service.scope}</span>
          </div>
          {service.tenantId ? <div class="small mb-1"><strong>Tenant:</strong> {tenant?.title ?? service.tenantId}</div> : ""}
          {service.scope === "shell" && apps.length > 0 ? <div class="small mb-1"><strong>Apps:</strong> {apps.map((app) => app.title).join(", ")}</div> : ""}
          <div class="small mb-1"><strong>URL:</strong> <span class="font-monospace">{service.hostname}</span></div>
          {service.serviceId ? <div class="small mb-1"><strong>Plugin:</strong> <span class="font-monospace">{service.serviceId}</span></div> : ""}
          {service.capabilities.length > 0 ? (
            <div class="small mb-1">
              <strong>Capabilities:</strong>{" "}
              {service.capabilities.map((capability) => <span class="badge text-bg-light border me-1">{capability}</span>)}
            </div>
          ) : ""}
          <div class="small mb-1"><strong>Status:</strong> <span class={`badge ${service.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{service.enabled ? "active" : "disabled"}</span></div>
          <div class="small mb-2"><strong>Created:</strong> {service.createdAt}{service.lastSeenAt ? ` - Last seen: ${service.lastSeenAt}` : ""}</div>
          <div class="d-flex gap-2 flex-wrap align-items-center">
            {service.scope !== "shared" ? (
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                data-bp-change-hostname=""
                data-bp-service-id={service.id}
                data-bp-service-url={normalizeUrl(service.hostname)}
                data-bs-toggle="offcanvas"
                data-bs-target="#bp-change-hostname-panel"
              >
                Change URL
              </button>
            ) : ""}
            {apps.length > 0 && service.hasConfigurableOptions ? (
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">Configure</button>
                <ul class="dropdown-menu">
                  <li>
                    <button type="button" class="dropdown-item" {...configureAttrs(service, undefined, `${title} - Tenant defaults`, adminApiBase)}>
                      Tenant defaults
                    </button>
                  </li>
                  {apps.map((app) => (
                    <li>
                      <button type="button" class="dropdown-item" {...configureAttrs(service, app.id, `${title} - ${app.title}`, adminApiBase)}>
                        {app.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              configureButton(service, undefined, title, adminApiBase)
            )}
            {service.scope === "shared" && service.tenantId ? (
              <button class="btn btn-sm btn-outline-secondary"
                hx-delete={`${data.adminApiBase}/shared-services/${encodeURIComponent(service.serviceId ?? service.id)}/activations?tenantId=${encodeURIComponent(service.tenantId)}`}
                hx-target="#bp-services-alerts"
                hx-swap="innerHTML"
                data-bp-error-modal=""
                hx-confirm="Deactivate this shared service?">
                Deactivate
              </button>
            ) : service.tenantId ? (
              <>
                {service.serviceId && service.serviceId !== "org.betterportal.config-manager" ? (
                  <button class="btn btn-sm btn-outline-success"
                    hx-post={`${data.adminApiBase}/tenants/${encodeURIComponent(service.tenantId)}/services/${encodeURIComponent(service.id)}/migrate-to-shared`}
                    hx-target="#bp-services-alerts"
                    hx-swap="innerHTML"
                    hx-confirm="Convert this tenant service to a shared service and rewrite app references?">
                    Convert to shared
                  </button>
                ) : ""}
                <button class="btn btn-sm btn-outline-danger"
                  hx-delete={`${data.adminApiBase}/tenants/${encodeURIComponent(service.tenantId)}/services/${encodeURIComponent(service.id)}`}
                  hx-target="#bp-services-alerts"
                  hx-swap="innerHTML"
                  data-bp-error-modal=""
                  hx-confirm="Remove this service registration?">
                  Remove
                </button>
              </>
            ) : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function renderCatalogCard(
  item: ResponseData["sharedServiceCatalog"][number],
  data: ResponseData,
  selectedTenantId: string
): HtmlRenderable {
  const title = item.title ?? item.id;
  const selectedActivation = data.sharedServiceActivations.find((activation) =>
    activation.tenantId === selectedTenantId
    && activation.sharedServiceId === item.id
    && activation.enabled
    && !activation.appId
  );
  return (
    <div
      class="col-12 col-lg-6 bp-catalog-card"
      data-bp-catalog-id={item.id}
      data-bp-catalog-url={normalizeUrl(item.baseUrl)}
    >
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div>
              <h5 class="mb-1">{title}</h5>
              <div class="small text-secondary font-monospace">{item.id}</div>
            </div>
            <span class={`badge ${selectedActivation ? "text-bg-success" : item.enabled ? "text-bg-light border" : "text-bg-secondary"}`}>
              {selectedActivation ? "active" : item.installed ? "shared" : item.enabled ? "awaiting install" : "disabled"}
            </span>
          </div>
          <div class="small mt-2"><strong>URL:</strong> <span class="font-monospace">{item.baseUrl}</span></div>
          {item.category ? <div class="small"><strong>Category:</strong> {item.category}</div> : ""}
          {item.tags.length > 0 ? (
            <div class="small mb-3">
              <strong>Tags:</strong>{" "}
              {item.tags.map((tag) => <span class="badge text-bg-light border me-1">{tag}</span>)}
            </div>
          ) : <div class="mb-3"></div>}
          <div class="d-flex gap-2 flex-wrap">
            {!item.installed ? (
              <button
                class="btn btn-sm btn-outline-primary"
                type="button"
                data-bp-install-shared={item.id}
                data-bp-install-url={normalizeUrl(item.baseUrl)}
              >
                Install
              </button>
            ) : ""}
            {item.installed ? (
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                data-bp-change-hostname=""
                data-bp-service-id={item.id}
                data-bp-service-url={normalizeUrl(item.baseUrl)}
                data-bs-toggle="offcanvas"
                data-bs-target="#bp-change-hostname-panel"
              >
                Change URL
              </button>
            ) : ""}
            {selectedActivation ? (
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                hx-delete={`${data.adminApiBase}/shared-services/${encodeURIComponent(item.id)}/activations?tenantId=${encodeURIComponent(selectedTenantId)}`}
                hx-target="#bp-services-alerts"
                hx-swap="innerHTML"
                data-bp-error-modal=""
                hx-confirm="Deactivate this shared service for the selected tenant?"
              >
                Deactivate
              </button>
            ) : (
              <button
                class="btn btn-sm btn-outline-primary"
                type="button"
                hx-post={`${data.adminApiBase}/shared-services/${encodeURIComponent(item.id)}/activations`}
                hx-vals={`{"tenantId":"${selectedTenantId}"}`}
                hx-target="#bp-services-alerts"
                hx-swap="innerHTML"
                disabled={!item.enabled || !item.installed || !selectedTenantId ? true : undefined}
              >
                Activate
              </button>
            )}
            <button
              class="btn btn-sm btn-outline-danger"
              type="button"
              hx-delete={`${data.adminApiBase}/shared-services/${encodeURIComponent(item.id)}`}
              hx-target="#bp-services-alerts"
              hx-swap="innerHTML"
              hx-confirm="Delete this shared service definition?"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderConnections(data: ResponseData, appId: string): HtmlRenderable {
  if (data.m2mConnections.length === 0) return <div class="alert alert-secondary mb-0">No service connection requests for this app.</div>;
  const endpoint = `${data.adminApiBase}/apps/${encodeURIComponent(appId)}/m2m/connections`;
  return (
    <div class="list-group list-group-flush">
      {data.m2mConnections.map((connection) => (
        <div class="list-group-item px-0 py-3">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div>
              <div class="fw-semibold">{connection.title}</div>
              <div class="small text-secondary">
                {connection.sourceServiceTitle} / <span class="font-monospace">{connection.sourceServiceType}</span>
              </div>
              <div class="small font-monospace">{connection.contractId}{connection.version ? `@${connection.version}` : ""} / {connection.mode}</div>
              <div class="small mt-1">
                <span class={`badge me-2 ${connection.status === "connected" ? "text-bg-success" : connection.status === "stale" || connection.status === "unavailable" ? "text-bg-warning" : "text-bg-secondary"}`}>
                  {connection.status}
                </span>
                {connection.message}
              </div>
              {connection.methods.length > 0 ? <div class="small mt-1"><strong>Methods:</strong> {connection.methods.join(", ")}</div> : ""}
              {connection.permissions.length > 0 ? <div class="small"><strong>Permissions:</strong> {connection.permissions.join(", ")}</div> : ""}
            </div>
            <div class="d-flex flex-column gap-2 align-items-end">
              {connection.bindingId ? (
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  hx-delete={`${endpoint}/${encodeURIComponent(connection.bindingId)}`}
                  hx-target="#bp-services-alerts"
                  hx-swap="innerHTML"
                  hx-confirm="Revoke this service connection? Existing service tokens will stop working."
                  data-bp-error-modal=""
                >Revoke</button>
              ) : connection.candidates.map((candidate) => (
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary text-start"
                  hx-post={endpoint}
                  hx-vals={JSON.stringify({ sourceServiceId: connection.sourceServiceId, requestId: connection.requestId, targetServiceId: candidate.targetServiceId, targetViewId: candidate.targetViewId })}
                  hx-target="#bp-services-alerts"
                  hx-swap="innerHTML"
                  data-bp-error-modal=""
                >
                  Connect {candidate.targetServiceTitle} / {candidate.targetServiceType}
                  <span class="d-block small font-monospace">{candidate.targetServiceId}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  const tenantById = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const selectedTenantId = data.selectedTenantId ?? data.tenants[0]?.id ?? "";
  const selectedTenant = data.tenants.find((tenant) => tenant.id === selectedTenantId);
  const selectedTenantServices = data.services.filter((service) => service.tenantId === selectedTenantId);
  const selectedTenantApps = data.apps.filter((app) => app.tenantId === selectedTenantId);
  const selectedAppId = selectedTenantApps.some((app) => app.id === data.selectedAppId) ? data.selectedAppId : selectedTenantApps[0]?.id;
  const unassignedServices = data.services.filter((service) => !service.tenantId);
  const hasPendingManifests = data.services.some((service) => service.enabled && !service.configManifestKnown);
  const selectedServicesPath = selectedTenantId
    ? `/services?tenantId=${encodeURIComponent(selectedTenantId)}${selectedAppId ? `&appId=${encodeURIComponent(selectedAppId)}` : ""}`
    : "/services";
  const adminApiBase = data.adminApiBase;
  const serviceBaseUrl = data.serviceBaseUrl ?? "";

  return (
    <div class="container-fluid px-0">
      <div class="d-flex justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 class="mb-1">{data.title}</h2>
          <p class="text-secondary mb-0">Register and manage service instances per tenant</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select
            class="form-select"
            id="bp-services-tenant-filter"
            name="tenantId"
            aria-label="Tenant"
            hx-get="/services"
            hx-trigger="change"
            hx-target="#bp-main"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            {data.tenants.map((tenant) => (
              <option value={tenant.id} selected={tenant.id === selectedTenantId}>{tenant.title}</option>
            ))}
          </select>
          <select
            class="form-select"
            id="bp-services-app-filter"
            name="appId"
            aria-label="App"
            hx-get="/services"
            hx-trigger="change"
            hx-include="#bp-services-tenant-filter"
            hx-target="#bp-main"
            hx-swap="innerHTML"
            hx-push-url="true"
            disabled={selectedTenantApps.length === 0 ? true : undefined}
          >
            {selectedTenantApps.map((app) => (
              <option value={app.id} selected={app.id === selectedAppId}>{app.title}</option>
            ))}
          </select>
          <button class="btn btn-primary text-nowrap" id="bp-register-service-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#bp-add-service-panel">
            + Register Service
          </button>
          <button class="btn btn-outline-primary text-nowrap" type="button" data-bs-toggle="offcanvas" data-bs-target="#bp-shared-service-panel">
            + Shared Service
          </button>
        </div>
      </div>

      <div id="bp-services-alerts"></div>

      <section class="card border-0 shadow-sm mb-4">
        <div class="card-body">
          <div class="mb-3">
            <h3 class="h5 mb-1">Service Connections</h3>
            <div class="small text-secondary">Approve explicit app-scoped service and delegated access. Revocation requires a new approval.</div>
          </div>
          {selectedAppId ? renderConnections(data, selectedAppId) : <div class="alert alert-secondary mb-0">Select an app to manage service connections.</div>}
        </div>
      </section>

      {data.sharedServiceCatalog.length > 0 ? (
        <section class="mb-4">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <div>
              <h3 class="h5 mb-0">Shared Services</h3>
              <div class="small text-secondary">Platform-managed services that can be activated for tenants</div>
            </div>
          </div>
          <div class="row g-3">
            {data.sharedServiceCatalog.map((item) => renderCatalogCard(item, data, selectedTenantId))}
          </div>
        </section>
      ) : ""}

      {hasPendingManifests ? (
        <div class="alert alert-secondary d-flex justify-content-between align-items-center gap-3">
          <span>Some service manifests are still pending sync.</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            hx-get={selectedServicesPath}
            hx-target="#bp-main"
            hx-swap="innerHTML"
          >
            Refresh
          </button>
        </div>
      ) : ""}

      {!selectedTenant ? (
        <div class="alert alert-secondary">No tenant selected</div>
      ) : (
        <div class="mb-4">
          <section class="bp-services-tenant" data-bp-tenant-id={selectedTenant.id}>
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <div>
                <h3 class="h5 mb-0">{selectedTenant.title}</h3>
                <div class="small text-secondary font-monospace">{selectedTenant.id}</div>
              </div>
              <span class="badge text-bg-secondary">{selectedTenantServices.length} services</span>
            </div>
            {selectedTenantServices.length === 0 ? (
              <div class="alert alert-secondary">No services registered for this tenant</div>
            ) : (
              <div class="row g-3">
                {selectedTenantServices.map((service) => renderServiceCard(service, data, tenantById))}
              </div>
            )}
          </section>
          {unassignedServices.length > 0 ? (
            <section class="mt-4">
              <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <div>
                  <h3 class="h5 mb-0">Platform services</h3>
                  <div class="small text-secondary">Shared or unscoped registrations</div>
                </div>
                <span class="badge text-bg-secondary">{unassignedServices.length} services</span>
              </div>
              <div class="row g-3">
                {unassignedServices.map((service) => renderServiceCard(service, data, tenantById))}
              </div>
            </section>
          ) : ""}
        </div>
      )}

      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-add-service-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Register Service</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-tenant-service-form" data-bp-config="rewrite=false">
            <div class="mb-3">
              <label class="form-label">Tenant</label>
              <select class="form-select" name="tenantId" required>
                <option value="">Select tenant...</option>
                {data.tenants.map((tenant) => (
                  <option value={tenant.id} selected={tenant.id === selectedTenantId}>{tenant.title}</option>
                ))}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Service URL</label>
              <input class="form-control" type="url" name="baseUrl" placeholder="http://localhost:3200" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Display Name</label>
              <input class="form-control" type="text" name="title" placeholder="Auto-filled from manifest" />
            </div>
            <div class="alert alert-secondary small" id="bp-tenant-service-preview">Manifest details are loaded from the service before it is added.</div>
            <button type="submit" class="btn btn-primary w-100">Register Service</button>
          </form>
        </div>
      </div>

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

      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-change-hostname-panel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Change Service URL</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <form id="bp-change-hostname-form" data-bp-config="rewrite=false">
            <input type="hidden" name="instanceId" />
            <div class="mb-3">
              <label class="form-label">New service URL</label>
              <input class="form-control" type="url" name="baseUrl" placeholder="https://service.example.com" required />
            </div>
            <div class="alert alert-info small">
              The new URL must be this exact installed instance. BetterPortal verifies it with the instance's existing API key.
            </div>
            <button type="submit" class="btn btn-primary w-100">Verify and change URL</button>
          </form>
        </div>
      </div>

      <div class="offcanvas offcanvas-end" tabindex={-1} id="bp-shared-service-panel" style="width:480px;max-width:90vw;">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Shared Service</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
          <form
            id="bp-shared-service-form"
            data-admin-api-base={adminApiBase}
            data-service-base-url={serviceBaseUrl}
            data-bp-config="rewrite=false"
          >
            <div class="mb-3">
              <label class="form-label">Base URL</label>
              <input class="form-control" type="url" name="baseUrl" placeholder="http://localhost:3200" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Owner</label>
              <select class="form-select" name="owner">
                <option value="bp">BP</option>
                <option value="3p">Third party</option>
              </select>
            </div>
            <div class="alert alert-secondary small" id="bp-shared-service-preview">Manifest details are loaded from the service before it is added.</div>
            <button type="submit" class="btn btn-primary w-100">Add Shared Service</button>
          </form>
          <script>
            {js(`
(() => {
  const tenantForm = document.getElementById("bp-tenant-service-form");
  const sharedForm = document.getElementById("bp-shared-service-form");
  const hostnameForm = document.getElementById("bp-change-hostname-form");
  const alerts = document.getElementById("bp-services-alerts");
  const tenantPreview = document.getElementById("bp-tenant-service-preview");
  const sharedPreview = document.getElementById("bp-shared-service-preview");
  const serviceBaseUrl = ${JSON.stringify(serviceBaseUrl)}.replace(/\\/+$/, "");
  const adminApiBase = serviceBaseUrl + ${JSON.stringify(adminApiBase)};
  const selectedServicesPath = ${JSON.stringify(selectedServicesPath)};
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const setAlert = (kind, message) => {
    if (!alerts) return;
    alerts.innerHTML = '<div class="alert alert-' + kind + '">' + escapeHtml(message) + '</div>';
  };
  const setPreview = (preview, manifest) => {
    if (!preview) return;
    const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities.join(", ") : "";
    preview.className = "alert alert-info small";
    preview.innerHTML = '<div><strong>' + escapeHtml(manifest.title) + '</strong></div>' +
      '<div class="font-monospace">' + escapeHtml(manifest.pluginId) + '</div>' +
      (capabilities ? '<div>' + escapeHtml(capabilities) + '</div>' : "");
  };
  const postJson = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
    return data;
  };
  const refreshServices = async () => {
    const url = (serviceBaseUrl || "") + selectedServicesPath;
    if (window.htmx) {
      window.htmx.ajax("GET", url, { target: "#bp-main", swap: "innerHTML" });
      return;
    }
    const response = await fetch(url, { headers: { Accept: "text/html" }, cache: "no-store" });
    const html = await response.text();
    const main = document.getElementById("bp-main");
    if (response.ok && main) main.innerHTML = html;
  };
  const loadManifest = async (baseUrl) => {
    const response = await fetch(baseUrl + "/.well-known/bp/manifest", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const manifest = await response.json().catch(() => null);
    if (!response.ok || !manifest || typeof manifest.pluginId !== "string" || typeof manifest.title !== "string") {
      throw new Error("Could not load a valid BetterPortal manifest");
    }
    return manifest;
  };
  const loadSchema = async (baseUrl, manifest) => {
    try {
      const response = await fetch(baseUrl + "/.well-known/bp/schema.json", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (response.ok) return await response.json();
    } catch { /* manifest-only fallback */ }
    return { manifest, routes: [] };
  };
  const installShared = async (id, baseUrl) => {
    setAlert("secondary", "Installing shared service...");
    const install = await postJson(adminApiBase + "/services/begin-install", {
      serviceUrl: baseUrl,
      sharedServiceId: id
    });
    await postJson(baseUrl + "/.well-known/bp/install", {
      setupToken: install.setupToken,
      cpUrl: install.cpUrl
    });
    setAlert("success", "Shared service installed. Waiting for sync...");
    await refreshServices();
  };
  const installTenant = async (registered) => {
    setAlert("secondary", "Installing service...");
    try {
      const install = await postJson(adminApiBase + "/services/begin-install", {
        serviceUrl: registered.serviceUrl,
        tenantId: registered.tenantId,
        instanceId: registered.serviceInstanceId
      });
      await postJson(registered.serviceUrl + "/.well-known/bp/install", {
        setupToken: install.setupToken,
        cpUrl: install.cpUrl
      });
      setAlert("success", "Service installed. Waiting for sync...");
      await refreshServices();
    } catch (error) {
      try {
        await postJson(adminApiBase + "/wizard/cleanup-provisional-service", {
          tenantId: registered.tenantId,
          serviceInstanceId: registered.serviceInstanceId
        });
      } catch { /* cleanup best effort */ }
      throw error;
    }
  };
  document.addEventListener("click", async (event) => {
    const hostnameButton = event.target?.closest?.("[data-bp-change-hostname]");
    if (hostnameButton && hostnameForm) {
      hostnameForm.elements.instanceId.value = hostnameButton.dataset.bpServiceId || "";
      hostnameForm.elements.baseUrl.value = hostnameButton.dataset.bpServiceUrl || "";
      return;
    }
    const button = event.target?.closest?.("[data-bp-install-shared]");
    if (!button) return;
    event.preventDefault();
    try {
      await installShared(button.dataset.bpInstallShared, button.dataset.bpInstallUrl);
    } catch (error) {
      setAlert("danger", error instanceof Error ? error.message : String(error));
    }
  });
  hostnameForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = hostnameForm.querySelector('button[type="submit"]');
    const fd = new FormData(hostnameForm);
    const instanceId = String(fd.get("instanceId") || "").trim();
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!instanceId || !baseUrl) {
      setAlert("danger", "Service instance and URL are required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setAlert("secondary", "Verifying exact installed service instance...");
      const change = await postJson(adminApiBase + "/services/begin-hostname-change", {
        instanceId,
        serviceUrl: baseUrl
      });
      await postJson(baseUrl + "/.well-known/bp/hostname-change", {
        changeToken: change.changeToken
      });
      setAlert("success", "Service URL changed and verified.");
      await refreshServices();
    } catch (error) {
      setAlert("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  tenantForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = tenantForm.querySelector('button[type="submit"]');
    const fd = new FormData(tenantForm);
    const tenantId = String(fd.get("tenantId") || "").trim();
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!tenantId) {
      setAlert("danger", "Tenant is required");
      return;
    }
    if (!baseUrl) {
      setAlert("danger", "Service URL is required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setAlert("secondary", "Loading service manifest...");
      const manifest = await loadManifest(baseUrl);
      setPreview(tenantPreview, manifest);
      const titleInput = tenantForm.querySelector('input[name="title"]');
      if (titleInput && !titleInput.value) titleInput.value = manifest.title;
      const schema = await loadSchema(baseUrl, manifest);
      setAlert("secondary", "Registering service...");
      const registered = await postJson(adminApiBase + "/wizard/register", {
        tenantId,
        hostname: baseUrl,
        title: String(fd.get("title") || manifest.title || baseUrl),
        schema: JSON.stringify(schema)
      });
      await installTenant(registered);
    } catch (error) {
      setAlert("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  sharedForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = sharedForm.querySelector('button[type="submit"]');
    const fd = new FormData(sharedForm);
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!baseUrl) {
      setAlert("danger", "Base URL is required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setAlert("secondary", "Loading service manifest...");
      const manifest = await loadManifest(baseUrl);
      setPreview(sharedPreview, manifest);
      setAlert("secondary", "Creating shared service...");
      const createBody = {
        baseUrl,
        owner: String(fd.get("owner") || "bp"),
        enabled: true,
        manifest
      };
      const created = await postJson(adminApiBase + "/shared-services", createBody);
      await installShared(created.id || manifest.pluginId, baseUrl);
    } catch (error) {
      setAlert("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
            `)}
          </script>
        </div>
      </div>
    </div>
  );
}
