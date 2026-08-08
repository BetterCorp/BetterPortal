# Platform Architecture

BetterPortal composes a portal from a shell service plus independent services.

The browser talks to the shell service for the host page and to services for page content. The shell provides navigation and layout, but page bodies are loaded directly from the service that owns the route.

## Request flow

1. A user opens an app URL on the shell origin.
2. The shell resolves the tenant and app from scoped config.
3. The shell renders the host page and identifies the active route.
4. HTMX requests the route content from the owning service origin.
5. The service validates inputs, runs the handler, validates output, and renders HTML for the resolved app shell renderer.
6. HTMX swaps the service response into the main outlet.

## Why services are separate origins

Each service runs independently. This keeps deployment, scaling, ownership, and failure boundaries clear.

The tradeoff is that CORS must be correct. BetterPortal handles this through app hostnames, origin policy, and service-side BP config resolution.

## Why the shell does not proxy content

Proxying page bodies through the shell would make it a bottleneck and blur service boundaries.

BetterPortal instead makes the browser the composition point. The shell stays stable, while services own their own HTML APIs.

## Configuration source of truth

`bp-config.yaml` defines:

- tenants
- tenant services
- shared service catalog entries
- shared service activations
- apps
- routes
- menu
- fragments

The config manager can edit this file through BetterPortal APIs.

Scoped service snapshots keep authorization and lookup separate. `routes` and `fragments` contain the current service's allowlisted records; `appRoutes` and `appFragments` contain read-only application-wide indexes used to resolve mounted dependency services. Application indexes never authorize an inbound service request.

Tenant services are direct one-tenant bindings. Shared services are registered once in the shared catalog and activated into tenants/apps. Apps reference the activation id for shell, auth, routes, fragments, slots, and role grants. This keeps a shared provider such as auth or a shell reusable while preserving a concrete per-tenant/app service instance id.

## Runtime contracts

Every service route is schema-first:

| Contract | Purpose |
|---|---|
| Query schema | Validates URL query input. |
| Headers schema | Validates selected request headers. |
| Request schema | Validates write request bodies. |
| Response schema | Validates handler output before JSON or HTML rendering. |

This keeps service boundaries explicit and inspectable.

## HTTP outcome diagnostics

The framework records one request span for every HTTP request and adds `bp.http.response_kind` for successful and failed responses. Final statuses outside 200-399 must also have:

- `bp.http.outcome_code`: stable machine-readable classification;
- `bp.http.outcome_reason`: bounded human-readable explanation;
- `bp.http.outcome_source`: `core`, `explicit`, `response-body`, `http-status`, or `exception`.

Framework-owned failures are classified at the point where the response is created. Service handlers should call `ctx.diagnostic({ code, reason, attributes? })` before returning a custom error response so domain failures remain searchable without parsing bodies. Handled 4xx responses are diagnostic outcomes, not thrown span errors; unexpected exceptions still mark their handler/render span as an error.

For an unclassified response outside 200-399, the request wrapper falls back to JSON fields in this order: `reason`, `error`, `message`, `detail`; then bounded textual response content; then the HTTP status phrase. It reads at most 2 KiB from a cloned text/JSON body and marks truncation. Developers remain responsible for keeping error bodies and explicit diagnostic attributes free of secrets or unnecessary personal data.

## Distributed tracing

HTTP services accept and propagate the W3C `traceparent` and `tracestate` headers. A valid incoming parent creates a new server span in the same trace; malformed trace headers are ignored and recorded as diagnostic attributes rather than rejecting the request. BetterPortal-generated trace IDs are UUIDv7-derived 32-character hexadecimal values, while every span receives its own random 16-character hexadecimal ID.

Generated S2S clients create a `bp.s2s.request` client span and make the target HTTP span its child. Use `this.m2mClient(requestId, ctx)` inside a route handler so the call is parented to the active handler. The legacy `(requestId, tenantId, appId)` form remains appropriate for background automation and starts a new trace because no request parent exists.

The shell assigns one UUIDv7 correlation ID per full document load and sends it as `baggage: bp.session_id=<uuidv7>`. It is attached to spans as `bp.session.id`, linking separate user-action traces without creating one unbounded browser trace. This value is untrusted telemetry only and must never influence authentication, authorization, tenancy, rate limits, or data access.
