/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../index.js";

function docById(data: ResponseData, id: string): ResponseData["docs"][number] | undefined {
  return data.docs.find((doc) => doc.id === id);
}

function docLink(doc: ResponseData["docs"][number] | undefined, label: string, variant = "primary"): HtmlRenderable {
  if (!doc) return "";
  return (
    <a
      class={`btn btn-${variant} px-3`}
      href={doc.href}
      hx-get={doc.href}
      hx-target="#bp-main"
      hx-swap="innerHTML"
      hx-push-url={doc.href}
      data-bp-service="docs-site"
    >{label}</a>
  );
}

function homeStyles(): HtmlRenderable {
  return (
    <style>{`
      .bp-docs-home {
        --bp-docs-ink: var(--bs-body-color);
        --bp-docs-soft: rgba(59, 130, 246, .10);
        --bp-docs-green: rgba(34, 197, 94, .12);
        --bp-docs-amber: rgba(245, 158, 11, .14);
        --bp-docs-pink: rgba(236, 72, 153, .10);
      }
      .bp-docs-hero {
        border: 1px solid var(--bs-border-color);
        background:
          linear-gradient(135deg, rgba(59,130,246,.16), rgba(34,197,94,.08) 42%, rgba(245,158,11,.10));
        overflow: hidden;
      }
      .bp-docs-hero-art {
        width: 100%;
        display: block;
        border: 1px solid rgba(255,255,255,.52);
        box-shadow: 0 1rem 2.5rem rgba(15,23,42,.16);
      }
      .bp-docs-hero h1 { letter-spacing: 0; }
      .bp-docs-kicker {
        width: fit-content;
        border: 1px solid rgba(59,130,246,.28);
        background: rgba(255,255,255,.45);
      }
      [data-bs-theme="dark"] .bp-docs-kicker { background: rgba(15,23,42,.32); }
      .bp-docs-node {
        border: 1px solid var(--bs-border-color);
        background: var(--bs-body-bg);
      }
      .bp-docs-node.is-theme { background: var(--bp-docs-soft); }
      .bp-docs-node.is-service { background: var(--bp-docs-green); }
      .bp-docs-node.is-config { background: var(--bp-docs-amber); }
      .bp-docs-line {
        height: 2px;
        background: linear-gradient(90deg, rgba(59,130,246,.45), rgba(34,197,94,.45));
      }
      .bp-docs-feature {
        border: 1px solid var(--bs-border-color);
        background: var(--bs-body-bg);
        box-shadow: 0 .5rem 1.5rem rgba(15,23,42,.06);
      }
      .bp-docs-feature-mark {
        width: .5rem;
        min-height: 100%;
        border-radius: .25rem;
      }
      .bp-docs-path {
        border: 1px solid var(--bs-border-color);
        background: linear-gradient(180deg, var(--bs-body-bg), var(--bs-tertiary-bg));
      }
      .bp-docs-list .list-group-item {
        border-left: 0;
        border-right: 0;
      }
      .bp-docs-list .list-group-item:first-child { border-top: 0; }
      .bp-docs-list .list-group-item:last-child { border-bottom: 0; }
    `}</style>
  );
}

function feature(title: string, copy: string, tone: "blue" | "green" | "amber" | "pink"): HtmlRenderable {
  const toneClass = {
    blue: "bg-primary",
    green: "bg-success",
    amber: "bg-warning",
    pink: "bg-danger"
  }[tone];

  return (
    <div class="col">
      <div class="bp-docs-feature h-100 rounded-2 d-flex overflow-hidden">
        <div class={`bp-docs-feature-mark ${toneClass}`}></div>
        <div class="p-3">
          <h2 class="h5 mb-2">{title}</h2>
          <p class="text-body-secondary mb-0">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function sectionDocs(data: ResponseData, section: string): ResponseData["docs"] {
  return data.docs.filter((doc) => doc.section === section);
}

function docsList(title: string, subtitle: string, docs: ResponseData["docs"]): HtmlRenderable {
  if (docs.length === 0) return "";
  return (
    <div class="bp-docs-list">
      <div class="d-flex flex-column gap-1 mb-3">
        <h2 class="h5 mb-0">{title}</h2>
        <p class="small text-body-secondary mb-0">{subtitle}</p>
      </div>
      <div class="list-group list-group-flush border rounded-2 overflow-hidden bg-body">
        {docs.map((doc) => (
          <a
            class="list-group-item list-group-item-action py-3"
            href={doc.href}
            hx-get={doc.href}
            hx-target="#bp-main"
            hx-swap="innerHTML"
            hx-push-url={doc.href}
            data-bp-service="docs-site"
          >
            <div class="d-flex align-items-start justify-content-between gap-3">
              <div class="d-flex flex-column gap-1">
                <span class="fw-semibold">{doc.title}</span>
                <span class="small text-body-secondary">{doc.excerpt}</span>
              </div>
              <span class="badge text-bg-light border font-monospace">{doc.section}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export function render(data: ResponseData): HtmlRenderable {
  const startDoc = docById(data, "getting-started/quick-start");
  const conceptDoc = docById(data, "getting-started/what-is-betterportal");
  const buildDoc = docById(data, "building/services");
  const operationDoc = docById(data, "operations/configuration");

  return (
    <section class="bp-docs-home container-fluid px-0" data-bp-service="docs-site">
      {homeStyles()}

      <div class="bp-docs-hero rounded-2 p-4 p-lg-5 mb-4">
        <div class="row align-items-center g-5">
          <div class="col-xl-7">
            <div class="bp-docs-kicker small text-primary fw-semibold text-uppercase rounded-pill px-3 py-2 mb-3">BetterPortal v10 docs</div>
            <h1 class="display-4 fw-semibold mb-3">{data.title}</h1>
            <p class="lead text-body-secondary mb-4 col-lg-10">{data.description}</p>
            <div class="d-flex flex-wrap gap-2">
              {docLink(startDoc, "Start building")}
              {docLink(conceptDoc, "Learn the platform", "outline-primary")}
            </div>
          </div>
          <div class="col-xl-5">
            <img
              class="bp-docs-hero-art rounded-2"
              src="/docs-assets/portal-map.svg"
              alt="BetterPortal theme shell connected to services and platform configuration"
            />
          </div>
        </div>
      </div>

      <div class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3 mb-5">
        {feature("One portal, many services", "Compose independently deployed services into one app shell without iframes or SPA routing.", "blue")}
        {feature("HTML as the API", "Services return validated data and theme-specific HTML fragments that HTMX swaps into place.", "green")}
        {feature("Tenant-aware by default", "Apps, services, routes, menus, fragments, and branding are driven from platform config.", "amber")}
        {feature("Built for ownership", "Each team can own a service boundary while the user experiences a single product.", "pink")}
      </div>

      <div class="row g-4 mb-5">
        <div class="col-lg-6">
          <div class="bp-docs-path rounded-2 p-4 h-100">
            <div class="small text-primary text-uppercase fw-semibold mb-2">Build path</div>
            <h2 class="h4 mb-3">Ship a feature as a service</h2>
            <p class="text-body-secondary">Create typed views, add Bootstrap renderers, expose a manifest, and bind the service into the shell through BP routes.</p>
            {docLink(buildDoc, "Build a service", "outline-primary")}
          </div>
        </div>
        <div class="col-lg-6">
          <div class="bp-docs-path rounded-2 p-4 h-100">
            <div class="small text-success text-uppercase fw-semibold mb-2">Operate path</div>
            <h2 class="h4 mb-3">Run the portal from config</h2>
            <p class="text-body-secondary">Manage tenants, app routes, menus, theme settings, service bindings, and deployment checks from one platform model.</p>
            {docLink(operationDoc, "Configure the platform", "outline-primary")}
          </div>
        </div>
      </div>

      {data.docs.length === 0 ? (
        <div class="alert alert-secondary">No Markdown docs were found.</div>
      ) : (
        <div class="row g-4">
          <div class="col-lg-6">{docsList("Get started", "Understand the platform and get a local portal running.", sectionDocs(data, "getting-started"))}</div>
          <div class="col-lg-6">{docsList("Platform", "Architecture, service boundaries, security, and auth.", sectionDocs(data, "platform"))}</div>
          <div class="col-lg-6">{docsList("Build", "Create BetterPortal services, routes, views, and themes.", sectionDocs(data, "building"))}</div>
          <div class="col-lg-6">{docsList("Operate", "Configure, deploy, administer, and troubleshoot BP.", [...sectionDocs(data, "operations"), ...sectionDocs(data, "admin"), ...sectionDocs(data, "reference")])}</div>
        </div>
      )}
    </section>
  );
}
