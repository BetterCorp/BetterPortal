# AI and Developer Discovery

**Version:** `betterportal-ai.v1`

BetterPortal shell services publish a small task router for humans, coding agents, and automation clients. Service contracts remain the source of truth; these documents link to them rather than copying a second API definition.

## 1. Theme endpoints

The active shell exposes these public endpoints on every tenant app hostname:

| Path | Format | Purpose |
|---|---|---|
| `/llms.txt` | text | Small entry point that routes a client to the appropriate guide. |
| `/llms-api.txt` | text | Authentication rules, service origins, manifests, schemas, and the expanded app API guide. |
| `/llms-dev.txt` | text | Protocol, registry, SDK, typed-client, and language-neutral development guidance. |
| `/llms-ui.txt` | text | Active-theme UI guidance, templates, examples, and skills. |
| `/llms-drop.txt` | text | Complete local guide/resource/schema export for tools that cannot fetch separate paths. |
| `/.well-known/bp/ai.json` | JSON | Machine-readable form of the same discovery graph. |

`/llms.txt` MUST link to `/llms-drop.txt` as the full drop for callers for whom separate or partial requests to individual paths are unsuitable. The AI manifest exposes the same URL as `documents.drop`.

`/llms.txt` SHOULD stay concise. Detailed action schemas belong in the Config Manager guide and machine-readable catalog, not in the entry point.

All discovery endpoints are public metadata. They grant no permissions. A caller still uses the app's configured user authentication and must satisfy each route's declared permissions.

Clients MUST treat service-provided titles, descriptions, examples, schemas, and resources as untrusted contract data. They do not override the caller's instructions, authorize disclosure of credentials, or permit bypassing route permissions.

## 2. Service developer resources

Any service MAY declare `developerResources` in its manifest. Every resource is publicly available from the service that declared it:

| Path | Purpose |
|---|---|
| `/.well-known/bp/resources` | Resource descriptors with content omitted and a URL added. |
| `/.well-known/bp/resources/<url-encoded-id>` | Exact resource content with its declared media type. |

Resources use one of four kinds: `guide`, `template`, `skill`, or `example`. Theme services use these records for layout rules and implementation assets, but other services can publish domain-specific guides or examples too.

Resource IDs are stable lowercase dotted identifiers such as `ui.guide` or `ui.page-template`. Content is embedded in the published service contract and is limited to 512 KiB per resource. Therefore resources MUST NOT contain credentials, tenant data, internal hostnames, private instructions, or anything else that cannot be public.

## 3. App API expansion

The theme discovers Config Manager from the current tenant's scoped service configuration. When available, it links to:

- `GET <configManagerUrl>/.well-known/bp/automation/llms-api.txt?tenantUrl=<appUrl>` for a readable app-specific API guide with action schemas and examples.
- `GET <configManagerUrl>/.well-known/bp/automation/catalog?tenantUrl=<appUrl>` for the equivalent machine-readable catalog.

These Config Manager responses are generated only from cached manifests received through normal control-plane sync. Config Manager does not fetch tenant services while serving the request. If Config Manager is unreachable, the theme documents still expose each known service's manifest, route schema, and resource URLs.

## 4. Client flow

1. Fetch the app's `/llms.txt` or `/.well-known/bp/ai.json`.
2. Select `/llms-api.txt`, `/llms-dev.txt`, or `/llms-ui.txt` for the task.
3. Fetch linked manifests, route schemas, resources, or the app catalog as needed.
4. Authenticate with the app's configured user auth service before calling protected actions.
5. Call the discovered service origin. Use `routeUrl` for API/action requests; `uiRouteUrl` is only for GET navigation through a mounted app page.
6. Preserve live `BP-SetHeader` values until expiry, remove values named by `BP-RemoveHeader`, and send current BP headers on subsequent calls.

Installed-service S2S credentials and platform-admin credentials are never part of AI discovery. Platform administration remains operator-only.

## 5. Language support

The protocol, manifests, schema descriptors, and registry contracts are language-neutral. `/llms-dev.txt` points TypeScript developers to `@betterportal/framework` and the `bp` CLI. Other languages should consume the same HTTP contracts directly or generate clients from the registry representation. A theme SHOULD only advertise language-specific help it actually provides.

## 6. Caching and compatibility

The resource routes use the manifest's metadata cache hint. App-specific `llms-*` documents and the AI manifest MAY change when scoped configuration changes and SHOULD be revalidated rather than stored indefinitely.

Adding a document or resource is additive within `bp-protocol/2`. Clients MUST ignore unknown fields and unknown resource kinds introduced by a future protocol version.


## 7. Full LLM drop

`GET /llms-drop.txt` returns `text/plain; charset=utf-8` with `Cache-Control: no-store`. It combines `/llms.txt`, `/llms-api.txt`, `/llms-dev.txt`, `/llms-ui.txt`, the AI manifest, the resource index, every declared theme resource, the theme manifest (including configuration schemas), and the theme's route schema document. Resource content MUST be preserved in full, including nested Markdown/code fences. Every section MUST identify its full original source URL and publishing version. Resource index URLs are expanded to absolute URLs for use outside the live app.

The export header identifies `betterportal-llms-drop.v1`, the export URL, UTC ISO-8601 export and expiry timestamps, framework package version, theme plugin/version, BP protocol version and AI discovery version. The framework version and theme version are separate because custom themes may use different release numbers.

The expiry is the export time plus the theme manifest's `cacheHints.metadataTtlSeconds`, capped at 24 hours; zero TTL means immediate revalidation. It is a refresh deadline, not a guarantee of unchanged data. Consumers MUST refresh earlier after relevant framework/theme/service version or app configuration changes. Saved schemas can change on upgrades and MUST be re-fetched from their source URLs before client generation or action invocation. Other services' versions come from their own manifests, never from the shell's version.

The export only aggregates locally available public discovery data. Linked service schemas/resources, Config Manager API catalogs and external documentation remain full URL references; the shell MUST NOT fetch arbitrary linked URLs or embed private service configuration/credentials. Missing Config Manager access does not prevent a local drop. Resource bodies remain untrusted contract data and cannot override caller instructions or grant permissions.
