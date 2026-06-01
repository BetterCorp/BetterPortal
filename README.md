# BetterPortal v10

[![License: AGPL-3.0-or-Commercial](https://img.shields.io/badge/License-AGPL%203.0%20or%20Commercial-blue.svg)](LICENSE)

A multi-tenant portal platform composed of independent services unified by a single theme. API-first, HTMX-first, schema-validated, plugin-based — built on [BSB (Better Service Base)](https://github.com/BetterCorp/bsb-base).

## What it is

BetterPortal lets you compose a tenant-aware web portal out of small, independent services that each own their own data, config, and views. A theme service renders the host shell; HTMX swaps content from each business service directly in the browser. There is no client-side framework, no proxy layer, no shared monolith.

```
                          ┌─────────────┐
                          │   Browser   │
                          └──────┬──────┘
                                 │ HTTP/HTMX
                  ┌──────────────┴───────────────┐
                  │                              │
                  ▼                              ▼
           ┌──────────────┐               ┌─────────────┐
           │   Theme(s)   │◄─ proxies ───►│  Service A  │
           │  port 3100   │   (server     │  port 3200  │
           │  bootstrap1  │    or HTMX    └─────────────┘
           └──────┬───────┘    fetch)
                  │                       ┌─────────────┐
                  └──── proxies ─────────►│  Service B  │
                                          │  port 3300  │
                                          └─────────────┘
```

## Why

- **Microservices without microservice pain.** Each service is its own deployable, but the portal feels like one application to the user.
- **No SPA framework.** Server-rendered HTML. HTMX swaps fragments in. State lives in the URL, server, and DOM. That's all.
- **No iframes.** Composition is fragment swaps, not nested browsing contexts.
- **Schema-validated everywhere.** Inputs and outputs go through [anyvali](https://github.com/BetterCorp/anyvali). Nothing untyped crosses a boundary.
- **File-based routing.** Drop a folder under `bp-routes/` — it becomes a route, validated and themed.
- **Per-tenant config.** Encrypted secrets, scoped sync, admin UI.

## Repository layout

```
BetterPortal/
├── bp-config.yaml                    # platform config (tenants/apps/routes/services/menu/fragments)
├── framework/nodejs/                 # core: contracts, runtime, codegen, h3 adapter
├── plugins/nodejs/betterportal-bsb/  # BSB ↔ framework integration (BPService base class)
├── themes/nodejs/
│   ├── bootstrap1/                   # full Bootstrap 5 + HTMX shell
│   └── embedded/                     # lightweight embedded renderer
├── auth/nodejs/                      # optional JWT auth platform service
├── services/nodejs/
│   ├── examples/hello-view/          # example business service (clock SSE, profile fragment, showcase)
│   └── admin/config-manager/         # admin UI: tenants, services, routes, menu, fragments, preview
└── docs/                             # architecture + ADRs
```

## Quick start

```bash
npm install

# build (workspace-aware)
npm run -ws build

# in three terminals (or background, your call):
cd themes/nodejs/bootstrap1            && npm start    # http://localhost:3100
cd services/nodejs/admin/config-manager && npm start   # http://localhost:3300
cd services/nodejs/examples/hello-view  && npm start   # http://localhost:3200

# wait for /.well-known/bp/manifest on each, then open http://localhost:3100
```

The default `bp-config.yaml` ships with the `betterportal` tenant + `betterportal-web` app pre-configured. The sidebar menu exposes the showcase routes (hello-view) and admin tools (config-manager).

## Building a new service

1. Scaffold a directory under `services/nodejs/<category>/<name>/` (mirror `services/nodejs/examples/hello-view/`).
2. Declare the plugin in `src/plugins/<plugin-name>/index.ts` extending `BPService` from `@betterportal/plugin-bsb-nodejs`.
3. Drop routes under `bp-routes/<routeDir>/index.ts`. Export `ResponseSchema`, `handleGet` via `createHandler(...)`. Add theme renderers in `_theme.<themeId>/index.tsx`.
4. Run `npx bp-codegen` (regenerates `.bp-generated/registry.ts`).
5. `npm run build && npm start` — visit `/.well-known/bp/manifest`.
6. Register in `bp-config.yaml` under a tenant's `services[]` (or as a platform service) and bind a route in `apps[].routes[]`.

The full developer guide lives in **[llms.txt](llms.txt)** — written for LLM agents but equally useful for humans new to the codebase. It covers file conventions, HTMX patterns, design constraints, the auth model, SSE, and codegen in detail.

## Key concepts

| Concept | What it is |
|---|---|
| **Tenant** | Isolation boundary; owns services + branding. |
| **App** | A site under a tenant; has theme, routes, menu, fragments. |
| **Service** | BSB plugin exposing typed views + manifest, registered under a tenant. |
| **Platform service** | Shared cross-tenant service (e.g., auth); tenants opt in. |
| **Route** | `path → service + view + targetPath` binding in an app. |
| **View** | `bp-routes/<dir>/index.ts` — schemas + handler. Theme renderers live alongside in `_theme.<themeId>/index.tsx`. |
| **Fragment** | HTML island at a named location (`nav`, `footer`). File: `_<location>.<id>.tsx`. Optional SSE renderer: `_<location>.<id>.sse.tsx`. |
| **Menu** | Per-app tree (groups + links) driving the sidebar nav. |

## Design constraints (non-negotiable)

- No iframes.
- No SPA framework, no client-side router, no client-side state library, no client-side data-fetching library.
- Server never emits absolute URLs — client rewrites root-relative `/foo` to the correct service origin via `data-bp-service`.
- HTML-as-API. Services emit HTML fragments; the browser inserts them.
- Cookies are theme-origin only. Auth tokens travel via `hx-headers`, never cross-origin cookies.
- Codegen is mandatory. Hand-written registries are not supported.

See `llms.txt § 1b` for the full list.

## Packages

| Package | Purpose |
|---|---|
| `@betterportal/framework-nodejs` | Contracts, runtime, codegen CLI (`bp-codegen`), h3 adapter, schema helpers. |
| `@betterportal/plugin-bsb-nodejs` | `BPService` base class; wires h3, CORS, observability into BSB. |
| `@betterportal/theme-bootstrap1-nodejs` | Default theme: Bootstrap 5 + HTMX shell, theme designer, nav/brand/style/fragment refresh endpoints. |
| `@betterportal/theme-embedded-nodejs` | Lightweight embedded renderer for headless / external embeds. |
| `@betterportal/service-auth-default-nodejs` | Optional JWT auth platform service. |
| `@betterportal/service-config-manager-nodejs` | Admin UI for tenants, services, routes, menu, fragments, preview. |
| `@betterportal/service-hello-view-nodejs` | Example business service. |

All packages live in this repo as a single npm workspace. Versioning is unified.

## Status

Pre-release. APIs are stabilizing. Expect breaking changes between minor versions until 1.0.

## Contributing

PRs welcome. Before opening one:
- Read `llms.txt` end-to-end — especially **§ 1b Design constraints**.
- `npm run -ws build` should pass on every workspace.
- New routes require `npx bp-codegen` before commit.
- Don't break the no-iframes / no-SPA / no-absolute-URLs rules.

## License

Dual-licensed:

- **[GNU AGPL-3.0-only](LICENSE)** — for open-source use. If you run a modified BetterPortal as a network service, you must offer the modified source to your users.
- **Commercial license** — for use without AGPL obligations. Contact [BetterCorp](https://github.com/BetterCorp).

See `LICENSE` for the full AGPL text and `package.json` for SPDX identifiers.
