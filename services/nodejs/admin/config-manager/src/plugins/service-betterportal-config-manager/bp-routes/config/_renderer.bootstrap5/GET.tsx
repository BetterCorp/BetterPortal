/** @jsxImportSource jsx-htmx */
import { js } from "jsx-htmx";
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

function configManagerRuntimeSource(timeoutMs: number): HtmlRenderable {
  return js(`(() => {
    const timeoutValue = ${timeoutMs};

    const setCardStatus = (card, values) => {
      const statusNode = card.querySelector("[data-bp-config-status]");
      const modeNode = card.querySelector("[data-bp-config-mode]");
      const schemaCountNode = card.querySelector("[data-bp-config-schema-count]");
      const writeNode = card.querySelector("[data-bp-config-write]");
      if (statusNode) { statusNode.textContent = values.statusText; statusNode.className = "badge " + values.statusClass; }
      if (modeNode) { modeNode.textContent = values.modeText; }
      if (schemaCountNode) { schemaCountNode.textContent = values.schemaCountText; }
      if (writeNode) { writeNode.textContent = values.writeText; writeNode.className = "badge " + (values.writeText === "write enabled" ? "text-bg-info" : "text-bg-secondary"); }
    };

    const inspectCard = async (card) => {
      const healthUrl = card.dataset.bpHealthUrl;
      const schemaUrl = card.dataset.bpSchemaUrl;
      if (!healthUrl) return;

      setCardStatus(card, { statusText: "checking", statusClass: "text-bg-secondary", modeText: "Checking...", schemaCountText: "...", writeText: "unknown" });

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutValue);

      try {
        const healthResponse = await fetch(healthUrl, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
        if (!healthResponse.ok) throw new Error("Health check failed: " + healthResponse.status);

        if (!schemaUrl) {
          setCardStatus(card, { statusText: "online", statusClass: "text-bg-success", modeText: "No config", schemaCountText: "0", writeText: "n/a" });
          return;
        }

        const schemaResponse = await fetch(schemaUrl, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
        if (!schemaResponse.ok) {
          setCardStatus(card, { statusText: "online", statusClass: "text-bg-success", modeText: "No config", schemaCountText: "0", writeText: "n/a" });
          return;
        }

        const payload = (schemaResponse.headers.get("content-type") || "").includes("application/json") ? await schemaResponse.json() : null;
        if (!payload) throw new Error("Schema returned non-JSON");
        const schemaCount = Array.isArray(payload.configSchemas) ? payload.configSchemas.length : 0;
        setCardStatus(card, { statusText: "available", statusClass: "text-bg-success", modeText: payload.mode || "unknown", schemaCountText: String(schemaCount), writeText: payload.supportsWrite === true ? "write enabled" : "read only" });
      } catch {
        setCardStatus(card, { statusText: "unreachable", statusClass: "text-bg-warning", modeText: "Unavailable", schemaCountText: "0", writeText: "unknown" });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const run = () => { document.querySelectorAll("[data-bp-config-card]").forEach((card) => { inspectCard(card); }); };
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", run, { once: true }); } else { run(); }
  })()`);
}

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="container-fluid px-0">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div class="text-uppercase small text-secondary fw-semibold">Admin Config</div>
          <h2 class="mb-2">{data.title}</h2>
          <p class="text-secondary mb-0">
            Tenant <strong>{data.tenantId}</strong>, app <strong>{data.appId}</strong>
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <span class="badge text-bg-primary">{data.services.length} services</span>
          <span class="badge text-bg-dark">Client-side discovery</span>
        </div>
      </div>
      <div class="row g-3">
        {data.services.map((service) => (
          <div class="col-12 col-xl-6">
            <article
              class="card border-0 shadow-sm h-100"
              data-bp-config-card=""
              data-bp-health-url={service.healthUrl}
              data-bp-schema-url={service.schemaUrl}
            >
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div class="text-uppercase small text-secondary fw-semibold">Service</div>
                    <h5 class="mb-1">{service.serviceId}</h5>
                    <div class="text-secondary small">{service.endpointBaseUrl}</div>
                  </div>
                  <span class="badge text-bg-secondary" data-bp-config-status="">pending</span>
                </div>
                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <div class="rounded-3 bg-body-tertiary p-3">
                      <div class="small text-secondary">Mode</div>
                      <div class="fw-semibold" data-bp-config-mode="">Waiting...</div>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="rounded-3 bg-body-tertiary p-3">
                      <div class="small text-secondary">Schemas</div>
                      <div class="fw-semibold" data-bp-config-schema-count="">...</div>
                    </div>
                  </div>
                </div>
                <div class="small text-secondary mb-2">Binding: {service.bindingId}</div>
                <div class="small text-secondary mb-3">Deployment: {service.deploymentMode}</div>
                <div class="d-flex gap-2 flex-wrap">
                  <a class="btn btn-sm btn-primary" href={service.schemaUrl} target="_blank" rel="noreferrer">Schema</a>
                  <a class="btn btn-sm btn-outline-secondary" href={service.manifestUrl} target="_blank" rel="noreferrer">Manifest</a>
                  <span class="badge text-bg-secondary" data-bp-config-write="">unknown</span>
                </div>
              </div>
            </article>
          </div>
        ))}
      </div>
      <script>{configManagerRuntimeSource(data.requestTimeoutMs)}</script>
    </div>
  );
}
