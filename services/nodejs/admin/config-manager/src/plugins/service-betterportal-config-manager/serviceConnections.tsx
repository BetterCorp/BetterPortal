/* @jsxRuntime automatic */
/* @jsxImportSource @betterportal/framework */
import type { HtmlRenderable } from "@betterportal/framework";
import type { M2MConnectionView } from "./m2mConnections.js";

export function renderServiceConnection(connection: M2MConnectionView, appId: string, adminApiBase: string): HtmlRenderable {
  const endpoint = `${adminApiBase}/apps/${encodeURIComponent(appId)}/m2m/connections`;
  return (
    <div class="list-group-item px-0 py-3 bp-service-connection" data-bp-mutation-scope="">
      <div data-bp-mutation-error="" role="alert" hidden></div>
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
              hx-target="closest .bp-service-connection"
              hx-swap="outerHTML"
              hx-confirm="Revoke this service connection? Existing service tokens will stop working."
            >Revoke</button>
          ) : connection.candidates.map((candidate) => (
            <button
              type="button"
              class="btn btn-sm btn-outline-primary text-start"
              hx-post={endpoint}
              hx-vals={JSON.stringify({ sourceServiceId: connection.sourceServiceId, requestId: connection.requestId, targetServiceId: candidate.targetServiceId, targetViewId: candidate.targetViewId })}
              hx-target="closest .bp-service-connection"
              hx-swap="outerHTML"
            >
              Connect {candidate.targetServiceTitle} / {candidate.targetServiceType}
              <span class="d-block small font-monospace">{candidate.targetServiceId}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function renderServiceConnections(connections: M2MConnectionView[], appId: string, adminApiBase: string): HtmlRenderable {
  if (!connections.length) return <div class="alert alert-secondary mb-0">No service connection requests for this app.</div>;
  return <div class="list-group list-group-flush">{connections.map(connection => renderServiceConnection(connection, appId, adminApiBase))}</div>;
}
