/** @jsxImportSource jsx-htmx */
import type { HtmlRenderable } from "@betterportal/framework";
import type { ResponseData } from "../../../previewEnvironmentManagement.js";

/** Read-only, on-demand diagnostics under the existing preview read permission. */
export function render(data: ResponseData): HtmlRenderable {
  const debug = data.diagnostics;
  if (!debug) return <div class="alert alert-warning">Preview deployment was not found.</div>;
  return <div>
    <p class="text-secondary">Configuration diagnostics, not a live availability test. Config delivery does not prove that a manifest was accepted or its routes were reconciled. No credentials or config values are included.</p>
    <dl class="small">
      <dt>Deployment</dt><dd><code>{debug.deploymentId}</code></dd>
      <dt>Preview tenant / app</dt><dd><code>{debug.tenantId}<br />{debug.appId}</code></dd>
      <dt>Source tenant / app</dt><dd><code>{debug.sourceTenantId}<br />{debug.sourceAppId}</code></dd>
      <dt>Hostname</dt><dd>{debug.hostname}</dd>
      <dt>Shell / auth instance</dt><dd><code>{debug.shellServiceId ?? "Missing"}<br />{debug.authServiceId ?? "Not configured"}</code></dd>
    </dl>
    <h4 class="h6">Services</h4>
    {debug.services.map(service => <section class="border rounded p-3 mb-3">
      <h5 class="h6 text-break">{service.serviceId}</h5>
      <div class="small text-break"><code>{service.instanceId}</code><br />{service.origin}</div>
      <div class={`badge my-2 ${service.status.state === "configured" ? "text-bg-success" : "text-bg-warning"}`}>{service.status.state}</div>
      <dl class="small mb-0">
        <dt>Persisted manifest version / timestamp</dt><dd>{service.status.manifestVersion ?? "None"} / {service.status.manifestAt ?? "Never"}</dd>
        <dt>Last seen / config delivered</dt><dd>{service.status.lastSeenAt ?? "Never"} / {service.status.lastSyncAt ?? "Never"}</dd>
        <dt>Advertised operations / enabled mounts</dt><dd>{service.status.advertisedOperations} / {service.status.enabledRoutes}</dd>
      </dl>
      {service.status.issues.length ? <ul class="small text-danger mb-0">{service.status.issues.map(issue => <li>{issue}</li>)}</ul> : null}
    </section>)}
    <h4 class="h6">Auth redirects</h4>
    {debug.authRedirects.length ? <ul class="small">{debug.authRedirects.map(target => <li>{target.purpose}: <code>{target.serviceId} / {target.viewId}</code> — {target.mounted ? "Mounted" : "Missing enabled route"}</li>)}</ul> : <p class="small">No configured auth redirects.</p>}
    <h4 class="h6">Routes and menu inclusion</h4>
    {debug.routes.map(route => <details class="border rounded p-2 mb-2 small">
      <summary>{route.path} — {route.enabled ? "Enabled" : "Disabled"}</summary>
      <div class="text-break"><code>{route.serviceId} / {route.viewId}</code><br />Target: <code>{route.targetPath || "Unresolved"}</code><br />Operations: {route.operations.join(", ")}<br />Menu: {route.menu}</div>
    </details>)}
    <p class="small text-secondary mt-3">If manifest/config timestamps stop advancing, check service logs for “Control plane sync bootstrap failed” and config-manager logs for revision conflicts. Updated clients retry failed manifest submissions every five seconds; readiness remains false until acceptance. Remote retry/error state is not stored in this snapshot.</p>
  </div>;
}
