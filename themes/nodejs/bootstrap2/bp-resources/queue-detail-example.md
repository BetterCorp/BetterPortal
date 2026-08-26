# Queue/detail named-component workflow

The normal GET response is the reconnect-safe snapshot. Named components render the queue and active incident from the same validated model; a POST returns only the updated active component.

```tsx
/** _renderer.bootstrap5/GET.tsx */
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";
import type { ResponseData } from "../GET.js";

export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  return <section class="container-fluid px-0">
    <h1 class="h5">Incident queue</h1>
    <div class="bp-split-pane" data-bp-split-pane-key="incidents" data-bp-detail-open={data.active ? "true" : "false"}>
      <div id="incident-queue" class="bp-split-pane__content" hx-get={ctx.url.route("incidents.index", { component: "queue" })} hx-trigger="incidents:changed from:body">
        {renderQueue(data, ctx)}
      </div>
      <aside id="incident-active" class="bp-split-pane__detail" aria-label="Selected incident">
        {renderActive(data, ctx)}
      </aside>
    </div>
    <div hx-ext="sse" sse-connect={ctx.url.route("incidents.index", { sse: true, fragment: "body.live" })} sse-swap="message"></div>
  </section>;
}
```

The named queue component uses stable state keys. The theme restores these after a component swap.

```tsx
/** _renderer.bootstrap5/queue.GET.tsx */
export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  return <div class="table-responsive"><table class="table table-sm table-hover mb-0"><tbody>
    {data.incidents.map((incident) => <tr
      id={`incident-row-${incident.id}`}
      data-bp-row-key={incident.id}
      aria-selected={incident.id === data.active?.id ? "true" : "false"}
    >
      <td>{incident.id}</td><td>{incident.title}</td>
      <td><button
        data-bp-detail-toggle
        data-bp-focus-key={`open-${incident.id}`}
        hx-get={ctx.url.route("incidents.index", { component: "active", query: { incidentId: incident.id } })}
        hx-target="#incident-active"
        hx-swap="outerHTML"
      >Open</button></td>
    </tr>)}
  </tbody></table></div>;
}
```

The active component owns its mutation and local error lane. A 4xx HTML renderer is placed in the outlet and focused; it does not replace `#incident-active`.

```tsx
/** _renderer.bootstrap5/active.GET.tsx and active.POST.tsx */
export function render(data: ResponseData, ctx: ViewRenderContext): HtmlRenderable {
  if (!data.active) return <aside id="incident-active" class="bp-split-pane__detail">Select an incident.</aside>;
  return <aside id="incident-active" class="bp-split-pane__detail" data-bp-mutation-scope>
    <button type="button" class="btn-close float-end" data-bp-detail-close aria-label="Close details"></button>
    <h2 class="h6">{data.active.id} - {data.active.title}</h2>
    <form
      hx-post={ctx.url.route("incidents.index", { component: "active" })}
      hx-target="#incident-active"
      hx-swap="outerHTML"
    >
      <input type="hidden" name="incidentId" value={data.active.id} />
      <button class="btn btn-sm btn-success" type="submit">Resolve</button>
    </form>
    <div class="alert alert-danger mt-2" data-bp-mutation-error role="alert" aria-live="polite" hidden></div>
  </aside>;
}
```

In the POST handler, return the updated active model. Emit `HX-Trigger: incidents:changed` only if a passive queue/count should reload.

```ts
const updated = await resolveIncident(ctx.request.incidentId);
ctx.responseHeaders?.set("HX-Trigger", "incidents:changed");
return { incidents: [], active: updated };
```

The SSE module declares emitted input and browser event contracts. Its default mapping may use the restricted `ctx.plugin` feature.

```ts
/** sse.ts */
import * as av from "anyvali";
import { createSse } from "../../.bp-generated/route-runtime.js";

export const InputSchema = av.object({
  id: av.string().minLength(1)
});

export const EventSchema = av.object({
  id: av.string(),
  title: av.string(),
  status: av.string()
});

export default createSse(
  { input: InputSchema, event: EventSchema },
  async (input, ctx) => ctx.plugin.findIncident(input.id)
);
```

The paired SSE renderer receives the normal server-populated view context:

```tsx
/** _body.live.sse.tsx */
import type { HtmlRenderable, ViewRenderContext } from "@betterportal/framework";

export function renderTick(data: IncidentEvent, ctx: ViewRenderContext): HtmlRenderable {
  const detailUrl = ctx.url.route("incidents.index", {
    component: "incident-detail",
    query: { incidentId: data.id }
  });
  return <tr id={`incident-row-${data.id}`} data-detail-url={detailUrl ?? ""} hx-swap-oob="outerHTML"></tr>;
}
```

When the service observes a domain change, it calls `this.betterPortal.sse.emit("incidents.index", { tenantId, appId }, { id })`. Codegen makes the view id and input type-safe; BetterPortal validates and scopes the event. `_body.live.sse.tsx` returns one stable OOB row/component, for example `<tr id="incident-row-123" hx-swap-oob="outerHTML">...</tr>`. Coalesce rapid changes by incident id before emitting; the newest state wins. Never emit the complete queue. On reconnect, reload the GET snapshot because SSE is intentionally not a durable event log.
