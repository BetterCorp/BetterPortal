# Automation Integrations

BetterPortal exposes a lightweight discovery path for automation tools:

1. Automation plugin receives a tenant/theme URL.
2. It reads `GET <tenantUrl>/.well-known/bp/ai.json` or `GET <tenantUrl>/.well-known/bp/public`.
3. If `configManagerUrl` was not supplied manually, it uses the discovered `configManagerUrl`.
4. It reads `GET <configManagerUrl>/.well-known/bp/automation/catalog?tenantUrl=<tenantUrl>`.

Themes also expose `GET <tenantUrl>/llms.txt` and HTML discovery tags:

- `<link rel="llms" href="/llms.txt">`
- `<link rel="alternate" type="application/json" title="BetterPortal AI manifest" href="/.well-known/bp/ai.json">`
- `<meta name="betterportal:ai-manifest" content="/.well-known/bp/ai.json">`

The catalog is read-only and action-focused. It returns tenant/app ids, services, cached config schemas, and cached service view/action metadata from config-manager. Config-manager does not fetch services server-side; services must sync their manifests through control-plane sync/poll. Synced action metadata includes service path, methods, renderability, permissions, role hint, chrome, dependencies, JSON schemas, raw/API-only status, M2M API contracts/requests, and demo scenarios when the service declares them.

For app management tasks, automation clients should read `GET <configManagerUrl>/.well-known/bp/management`, then use the `/.well-known/bp/manage/*` endpoints or the discovered management app URL. Platform admin is operator-only and must not be used for user-owned tenant/app tasks.

BetterPortal response headers are part of the client contract:

- `BP-SetHeader` stores a named BP header until its expiry.
- `BP-RemoveHeader` removes a stored BP header.
- Later BP API/action calls should send the current live BP headers for the target service/app context.

`Referer` and `Origin` help config-manager resolve tenant/app context, but explicit discovered URLs, `tenantUrl`, `appId`, and BP headers are preferred when available.

Initial package scaffolds live under `automations/`:

- `automations/shared/` - shared zero-dependency discovery client.
- `automations/node-red/` - Node-RED node scaffold.
- `automations/n8n/` - n8n node scaffold.
- `automations/zapier/` - Zapier app scaffold.

## Webhooks

Services declare webhook events in their manifest. The payload schema is developer-owned and synced from the service manifest; users only configure delivery targets.

Service handlers emit events with:

```ts
await ctx.webhook?.("event.id", payload);
```

Config-manager stores targets under platform config and exposes:

- `GET /.well-known/bp/admin/webhooks/events`
- `GET|POST /.well-known/bp/admin/webhooks/targets`
- `DELETE /.well-known/bp/admin/webhooks/targets/:targetId`
- `POST /.well-known/bp/admin/webhooks/targets/:targetId/test`
- `GET /.well-known/bp/manage/webhooks/events`
- `GET|POST /.well-known/bp/manage/webhooks/targets`
- `DELETE /.well-known/bp/manage/webhooks/targets/:targetId`
- `POST /.well-known/bp/manage/webhooks/targets/:targetId/test`

Delivery is JSON over HTTP POST. BP signs each delivery with `X-BP-Webhook-Signature` using the target secret and sends `X-BP-Webhook-Id`, `X-BP-Webhook-Event`, and `X-BP-Webhook-Timestamp`. Targets should return any `2xx`; `202` is preferred.

Disabled tenants are skipped. File-backed delivery is single-process and stored in `.bp-webhook-deliveries.json`; add Postgres claiming only when multi-container webhook delivery is deployed.

Node-RED, n8n, and Zapier trigger adapters are still scaffold-only. Add platform-specific trigger UX after webhook delivery and auth are stable.
