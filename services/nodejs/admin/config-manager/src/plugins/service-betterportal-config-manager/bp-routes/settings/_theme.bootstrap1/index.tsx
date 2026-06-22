/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function serviceBadge(tags: string[]): HtmlRenderable {
  return tags.length > 0 ? (
    <div class="d-flex gap-1 flex-wrap">
      {tags.map((tag) => <span class="badge text-bg-light border">{tag}</span>)}
    </div>
  ) : "";
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="container-fluid px-0">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div class="text-uppercase small text-secondary fw-semibold">User Management</div>
          <h2 class="mb-2">{data.title}</h2>
          <p class="text-secondary mb-0">
            {data.tenant.title} / {data.app.title}
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <a class="btn btn-sm btn-outline-secondary" href={data.managementDiscoveryUrl} target="_blank" rel="noreferrer">Management API</a>
          <a class="btn btn-sm btn-outline-secondary" href={data.automationCatalogUrl} target="_blank" rel="noreferrer">Automation Catalog</a>
        </div>
      </div>

      <div id="bp-settings-alerts" class="mb-3"></div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-xl-6">
          <section class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h5 class="mb-3">Current App</h5>
              <dl class="row small mb-0">
                <dt class="col-sm-3">Tenant ID</dt>
                <dd class="col-sm-9 font-monospace">{data.tenant.id}</dd>
                <dt class="col-sm-3">App ID</dt>
                <dd class="col-sm-9 font-monospace">{data.app.id}</dd>
                <dt class="col-sm-3">Hostnames</dt>
                <dd class="col-sm-9">{data.app.hostnames.length ? data.app.hostnames.join(", ") : "None"}</dd>
              </dl>
            </div>
          </section>
        </div>
        <div class="col-12 col-xl-6">
          <section class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h5 class="mb-3">Endpoints</h5>
              <div class="list-group list-group-flush small">
                <a class="list-group-item list-group-item-action px-0" href={data.endpoints.services} target="_blank" rel="noreferrer">Services</a>
                <a class="list-group-item list-group-item-action px-0" href={data.endpoints.routes} target="_blank" rel="noreferrer">Routes ({data.routeCount})</a>
                <a class="list-group-item list-group-item-action px-0" href={data.endpoints.fragments} target="_blank" rel="noreferrer">Fragments ({data.fragmentCount})</a>
                <a class="list-group-item list-group-item-action px-0" href={data.endpoints.theme} target="_blank" rel="noreferrer">Theme</a>
                <a class="list-group-item list-group-item-action px-0" href={data.endpoints.webhooks} target="_blank" rel="noreferrer">Webhooks</a>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section>
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Shared Services</h5>
          <span class="badge text-bg-secondary">{data.sharedServices.length}</span>
        </div>
        <div class="row g-3">
          {data.sharedServices.map((service) => (
            <div class="col-12 col-xl-6">
              <article class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                    <div>
                      <h6 class="mb-1">{service.title}</h6>
                      <div class="small text-secondary font-monospace">{service.id}</div>
                    </div>
                    <span class={`badge ${service.active ? "text-bg-success" : service.enabled ? "text-bg-light border" : "text-bg-secondary"}`}>
                      {service.active ? "active" : service.enabled ? "available" : "disabled"}
                    </span>
                  </div>
                  {service.description ? <p class="small text-secondary mb-2">{service.description}</p> : ""}
                  <div class="small mb-2"><strong>URL:</strong> <span class="font-monospace">{service.baseUrl}</span></div>
                  {service.category ? <div class="small mb-2"><strong>Category:</strong> {service.category}</div> : ""}
                  <div class="mb-3">{serviceBadge(service.tags)}</div>
                  {!service.active && service.enabled ? (
                    <form
                      hx-post={data.endpoints.activateService}
                      hx-target="#bp-settings-alerts"
                      hx-swap="innerHTML"
                    >
                      <input type="hidden" name="sharedServiceId" value={service.id} />
                      <button class="btn btn-sm btn-primary" type="submit">Activate</button>
                    </form>
                  ) : ""}
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
