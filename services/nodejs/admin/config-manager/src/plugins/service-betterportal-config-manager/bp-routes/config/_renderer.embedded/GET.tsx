/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../route.impl.js";

export function render(data: ResponseData): HtmlRenderable {
  return (
    <div class="p-3" data-bp-config-root="" data-bp-request-timeout={String(data.requestTimeoutMs)}>
      <div class="fw-semibold mb-2">{data.title}</div>
      <div class="text-secondary small mb-3">{data.services.length} services discovered</div>
      <div class="list-group">
        {data.services.map((service) => (
          <div class="list-group-item">
            <div class="fw-semibold">{service.serviceId}</div>
            <div class="small text-secondary">{service.endpointBaseUrl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
