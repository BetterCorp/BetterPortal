/* @jsxImportSource @betterportal/framework */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import { renderServiceConnections } from "../../../serviceConnections.js";
import type { ResponseData } from "../GET.js";

const TICKET_ONLY_THEME_SERVICES = new Set([
  "org.betterportal.theme.bootstrap1",
  "org.betterportal.theme.bootstrap2"
]);

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

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

  if (service.supportsCustomUi && service.customUiPath && appId && !TICKET_ONLY_THEME_SERVICES.has(service.serviceId ?? "")) {
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
          <div class="small mb-1"><strong>Status:</strong> <span data-bp-service-status class={`badge ${service.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{service.enabled ? "active" : "disabled"}</span></div>
          <div class="small mb-2"><strong>Created:</strong> {service.createdAt}{service.lastSeenAt ? ` - Last seen: ${service.lastSeenAt}` : ""}{service.lastSyncAt ? ` - Last sync: ${service.lastSyncAt}` : ""}{service.syncedVersion ? ` - Synced version: ${service.syncedVersion}` : ""}</div>
          <div class="d-flex gap-2 flex-wrap align-items-center">
            {service.scope !== "shared" ? (
              <>
                <button
                  class="btn btn-sm btn-outline-secondary"
                  type="button"
                  data-bp-change-hostname=""
                  data-bp-service-id={service.id}
                  data-bp-service-plugin-id={service.serviceId ?? ""}
                  data-bp-tenant-id={service.tenantId ?? ""}
                  data-bp-service-url={normalizeUrl(service.hostname)}
                  data-bs-toggle="offcanvas"
                  data-bs-target="#bp-change-hostname-panel"
                >
                  Change URL
                </button>
                {service.serviceId ? (
                  <button
                    class="btn btn-sm btn-outline-warning"
                    type="button"
                    hidden={true}
                    data-bp-reconfigure-service=""
                    data-bp-service-id={service.id}
                    data-bp-service-plugin-id={service.serviceId}
                    data-bp-service-url={normalizeUrl(service.hostname)}
                    data-bp-tenant-id={service.tenantId ?? ""}
                    data-bs-toggle="offcanvas"
                    data-bs-target="#bp-change-hostname-panel"
                  >
                    Reconnect
                  </button>
                ) : ""}
              </>
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
                data-bp-service-plugin-id={item.serviceId ?? item.id}
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
    <div class="container-fluid px-0" id="bp-services-page">
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
          {selectedAppId ? renderServiceConnections(data.m2mConnections, selectedAppId, data.adminApiBase) : <div class="alert alert-secondary mb-0">Select an app to manage service connections.</div>}
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
            <div class="alert alert-secondary small" id="bp-tenant-service-preview" role="status" aria-live="polite">Manifest details are loaded from the service before it is added.</div>
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
            <input type="hidden" name="pluginId" />
            <input type="hidden" name="tenantId" />
            <div class="mb-3">
              <label class="form-label">New service URL</label>
              <input class="form-control" type="url" name="baseUrl" placeholder="https://service.example.com" required />
            </div>
            <div class="alert alert-info small">
              Installed services verify their existing API key. If the service was reset, set it up again to keep its existing registration and app bindings.
            </div>
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" name="reconfigure" id="bp-reinstall-service" />
              <label class="form-check-label" for="bp-reinstall-service">Set up a reset service at this URL</label>
            </div>
            <div id="bp-change-hostname-status" class="alert alert-secondary small" role="status" aria-live="polite">Enter the service URL to verify or reconnect it.</div>
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
            <div class="alert alert-secondary small" id="bp-shared-service-preview" role="status" aria-live="polite">Manifest details are loaded from the service before it is added.</div>
            <button type="submit" class="btn btn-primary w-100">Add Shared Service</button>
          </form>
        </div>
      </div>
      <script>
            {js(`
(() => {
  const root = document.currentScript?.closest("#bp-services-page") || document.getElementById("bp-services-page");
  // HTMX copies HTML attributes from the previous page while settling a swap.
  if (!root || root.__bpServicesReady) return;
  root.__bpServicesReady = true;
  const tenantForm = root.querySelector("#bp-tenant-service-form");
  const sharedForm = root.querySelector("#bp-shared-service-form");
  const hostnameForm = root.querySelector("#bp-change-hostname-form");
  const tenantPreview = root.querySelector("#bp-tenant-service-preview");
  const sharedPreview = root.querySelector("#bp-shared-service-preview");
  const hostnameStatus = root.querySelector("#bp-change-hostname-status");
  const serviceBaseUrl = ${scriptJson(serviceBaseUrl)}.replace(/\\/+$/, "");
  const adminApiBase = serviceBaseUrl + ${scriptJson(adminApiBase)};
  const selectedServicesPath = ${scriptJson(selectedServicesPath)};
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const setAlert = (kind, message) => {
    const alerts = document.getElementById("bp-services-alerts");
    if (!alerts) return;
    alerts.innerHTML = '<div class="alert alert-' + kind + '">' + escapeHtml(message) + '</div>';
  };
  const setStatus = (node, kind, message) => {
    if (!node) return;
    node.className = "alert alert-" + kind + " small";
    node.textContent = message;
  };
  const setTenantStatus = (kind, message) => setStatus(tenantPreview, kind, message);
  const setSharedStatus = (kind, message) => setStatus(sharedPreview, kind, message);
  const setHostnameStatus = (kind, message) => {
    setStatus(hostnameStatus, kind, message);
    const submit = hostnameForm?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = hostnameForm.elements.reconfigure.checked ? "Set up and update URL" : "Verify and change URL";
  };
  hostnameForm?.elements.reconfigure.addEventListener("change", () => {
    setHostnameStatus("secondary", hostnameForm.elements.reconfigure.checked
      ? "The service must be reset and its plugin must match the existing registration."
      : "The installed service will verify its existing API key.");
  });
  const showToast = (message) => {
    let container = document.getElementById("bp-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bp-toast-container";
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      container.style.zIndex = "1090";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast align-items-center text-bg-success border-0";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    toast.innerHTML = '<div class="d-flex"><div class="toast-body">' + escapeHtml(message) + '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
    container.appendChild(toast);
    toast.addEventListener("hidden.bs.toast", () => toast.remove(), { once: true });
    window.bootstrap?.Toast?.getOrCreateInstance(toast, { delay: 5000 })?.show();
  };
  const setPreview = (preview, manifest) => {
    if (!preview) return;
    const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities.join(", ") : "";
    preview.className = "alert alert-info small";
    preview.innerHTML = '<div><strong>' + escapeHtml(manifest.title) + '</strong></div>' +
      '<div class="font-monospace">' + escapeHtml(manifest.pluginId) + '</div>' +
      (capabilities ? '<div>' + escapeHtml(capabilities) + '</div>' : "");
  };
  const managementFetch = (url, options) => {
    if (!window.BetterPortalAuth?.fetch) throw new Error("Authentication is unavailable. Reload the app and sign in again.");
    return window.BetterPortalAuth.fetch(url, options);
  };
  const postJson = async (url, body) => {
    const target = new URL(url, window.location.href);
    const management = new URL(adminApiBase, window.location.href);
    let managementPath = management.pathname;
    while (managementPath.endsWith("/")) managementPath = managementPath.slice(0, -1);
    const isManagement = target.origin === management.origin && (target.pathname === managementPath || target.pathname.startsWith(managementPath + "/"));
    const response = await (isManagement ? managementFetch : fetch)(url, {
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
    const response = await managementFetch(url, { headers: { Accept: "text/html" }, cache: "no-store" });
    const html = await response.text();
    const main = document.getElementById("bp-main");
    if (!response.ok) throw new Error("Could not refresh the services list. Reload the page to see the latest state.");
    if (main && window.htmx) await window.htmx.swap({ text: html, sourceElement: main, target: main, swap: "innerHTML" });
    else if (main) main.innerHTML = html;
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
  const loadHealth = async (baseUrl) => {
    const response = await fetch(baseUrl + "/.well-known/bp/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const health = await response.json().catch(() => null);
    return response.ok && health && typeof health === "object" ? health : null;
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
  const finishAction = async (panel, message) => {
    showToast(message);
    const instance = panel && window.bootstrap?.Offcanvas?.getInstance(panel);
    if (instance && panel.matches(".show, .showing, .hiding")) {
      await new Promise((resolve) => {
        panel.addEventListener("hidden.bs.offcanvas", resolve, { once: true });
        instance.hide();
      });
    } else instance?.hide();
    try { if (root.isConnected) await refreshServices(); }
    catch (error) { setAlert("warning", message + " " + (error instanceof Error ? error.message : String(error))); }
  };
  const installShared = async (id, baseUrl, status = setAlert, panel) => {
    status("secondary", "Installing shared service...");
    const install = await postJson(adminApiBase + "/services/begin-install", {
      serviceUrl: baseUrl,
      sharedServiceId: id
    });
    await postJson(baseUrl + "/.well-known/bp/install", {
      setupToken: install.setupToken,
      cpUrl: install.cpUrl
    });
    status("success", "Shared service installed. Waiting for sync...");
    await finishAction(panel, "Shared service installed successfully.");
  };
  const installTenant = async (registered) => {
    setTenantStatus("secondary", "Installing service...");
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
    } catch (error) {
      try {
        await postJson(adminApiBase + "/wizard/cleanup-provisional-service", {
          tenantId: registered.tenantId,
          serviceInstanceId: registered.serviceInstanceId
        });
      } catch { /* cleanup best effort */ }
      throw error;
    }
    setTenantStatus("success", "Service installed. Refreshing services...");
    await finishAction(tenantForm.closest(".offcanvas"), (registered.title || "Service") + " registered successfully.");
  };
  root.querySelectorAll("[data-bp-reconfigure-service]").forEach(async (button) => {
    try {
      const health = await loadHealth(button.dataset.bpServiceUrl);
      const needsReconnect = health?.setupMode === true && health.pluginId === button.dataset.bpServicePluginId;
      button.hidden = !needsReconnect;
      const status = button.closest(".card")?.querySelector("[data-bp-service-status]");
      if (needsReconnect && status) {
        status.className = "badge text-bg-warning";
        status.textContent = "needs reconnect";
      }
    } catch { button.hidden = true; }
  });
  root.addEventListener("click", async (event) => {
    const hostnameButton = event.target?.closest?.("[data-bp-change-hostname], [data-bp-reconfigure-service]");
    if (hostnameButton && hostnameForm) {
      hostnameForm.elements.instanceId.value = hostnameButton.dataset.bpServiceId || "";
      hostnameForm.elements.baseUrl.value = hostnameButton.dataset.bpServiceUrl || "";
      hostnameForm.elements.pluginId.value = hostnameButton.dataset.bpServicePluginId || "";
      hostnameForm.elements.tenantId.value = hostnameButton.dataset.bpTenantId || "";
      hostnameForm.elements.reconfigure.checked = hostnameButton.hasAttribute("data-bp-reconfigure-service");
      setHostnameStatus("secondary", "Enter the service URL to verify or reconnect it.");
      return;
    }
    const button = event.target?.closest?.("[data-bp-install-shared]");
    if (!button) return;
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try {
      await installShared(button.dataset.bpInstallShared, button.dataset.bpInstallUrl);
    } catch (error) {
      setAlert("danger", error instanceof Error ? error.message : String(error));
    } finally { button.disabled = false; }
  });
  hostnameForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = hostnameForm.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    const fd = new FormData(hostnameForm);
    const instanceId = String(fd.get("instanceId") || "").trim();
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!instanceId || !baseUrl) {
      setHostnameStatus("danger", "Service instance and URL are required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setHostnameStatus("secondary", "Checking service...");
      const health = await loadHealth(baseUrl);
      const reconfigure = hostnameForm.elements.reconfigure;
      if (health?.setupMode === true && !reconfigure.checked) {
        reconfigure.checked = true;
        setHostnameStatus("warning", "This service has been reset. Submit again to set it up at this URL and keep its existing registration and app bindings.");
        return;
      }
      if (reconfigure.checked) {
        const expectedPluginId = String(fd.get("pluginId") || "");
        if (!expectedPluginId || health?.setupMode !== true || health.pluginId !== expectedPluginId) {
          throw new Error("The service must be in setup mode and its plugin must match the existing registration.");
        }
        setHostnameStatus("secondary", "Setting up service...");
        const install = await postJson(adminApiBase + "/services/begin-install", {
          instanceId, serviceUrl: baseUrl, tenantId: String(fd.get("tenantId") || "") || undefined, reconfigure: true
        });
        await postJson(baseUrl + "/.well-known/bp/install", { setupToken: install.setupToken, cpUrl: install.cpUrl });
      } else {
        setHostnameStatus("secondary", "Verifying exact installed service instance...");
        const change = await postJson(adminApiBase + "/services/begin-hostname-change", { instanceId, serviceUrl: baseUrl });
        await postJson(baseUrl + "/.well-known/bp/hostname-change", { changeToken: change.changeToken });
      }
      const message = reconfigure.checked ? "Service set up and URL updated." : "Service URL changed and verified.";
      setHostnameStatus("success", message);
      await finishAction(hostnameForm.closest(".offcanvas"), message);
    } catch (error) {
      setHostnameStatus("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  tenantForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = tenantForm.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    const fd = new FormData(tenantForm);
    const tenantId = String(fd.get("tenantId") || "").trim();
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!tenantId) {
      setTenantStatus("danger", "Tenant is required");
      return;
    }
    if (!baseUrl) {
      setTenantStatus("danger", "Service URL is required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setTenantStatus("secondary", "Loading service manifest...");
      const manifest = await loadManifest(baseUrl);
      setPreview(tenantPreview, manifest);
      const titleInput = tenantForm.querySelector('input[name="title"]');
      if (titleInput && !titleInput.value) titleInput.value = manifest.title;
      const schema = await loadSchema(baseUrl, manifest);
      setTenantStatus("secondary", "Registering service...");
      const registered = await postJson(adminApiBase + "/wizard/register", {
        tenantId,
        hostname: baseUrl,
        title: String(fd.get("title") || manifest.title || baseUrl),
        schema: JSON.stringify(schema)
      });
      await installTenant(registered);
    } catch (error) {
      setTenantStatus("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  sharedForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = sharedForm.querySelector('button[type="submit"]');
    if (submit?.disabled) return;
    const fd = new FormData(sharedForm);
    const baseUrl = String(fd.get("baseUrl") || "").trim().replace(/\\/+$/, "");
    if (!baseUrl) {
      setSharedStatus("danger", "Base URL is required");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      setSharedStatus("secondary", "Loading service manifest...");
      const manifest = await loadManifest(baseUrl);
      setPreview(sharedPreview, manifest);
      setSharedStatus("secondary", "Creating shared service...");
      const createBody = {
        baseUrl,
        owner: String(fd.get("owner") || "bp"),
        enabled: true,
        manifest
      };
      const created = await postJson(adminApiBase + "/shared-services", createBody);
      await installShared(created.id || manifest.pluginId, baseUrl, setSharedStatus, sharedForm.closest(".offcanvas"));
    } catch (error) {
      setSharedStatus("danger", error instanceof Error ? error.message : String(error));
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
            `)}
      </script>
    </div>
  );
}
