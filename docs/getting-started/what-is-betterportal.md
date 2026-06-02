# What is BetterPortal?

BetterPortal is a multi-tenant portal platform for composing many independently deployed services into one coherent web application.

Each service owns its own code, config, routes, and data. The BetterPortal theme owns the shell, navigation, branding, and user-facing URL. The browser loads page content directly from services through HTMX, so the platform gets microservice isolation without iframe seams or SPA framework complexity.

## Why teams use it

- Build portal features as separate services without making users feel like they are moving between products.
- Keep each service deployable, testable, and replaceable on its own schedule.
- Use server-rendered HTML fragments as the UI contract instead of shipping a client-side application shell.
- Validate every request and response with schemas at service boundaries.
- Run many tenants and apps from one platform config without copying portal code.

## What BetterPortal is not

BetterPortal is not an iframe dashboard, a reverse proxy, a single-page app framework, or a monolith generator.

The theme does not proxy page content. Services do not emit absolute URLs. There is no client-side router. Composition happens through real HTML responses, HTMX swaps, and BP route bindings.

## The core idea

A BetterPortal app is made from four moving parts:

| Part | Responsibility |
|---|---|
| Tenant | Isolation boundary for services, branding, config, and apps. |
| App | User-facing portal surface with routes, menu, theme, and hostnames. |
| Theme | Shell, navigation, brand, layout, assets, and fragment mounting. |
| Service | Typed views, handlers, schemas, HTML renderers, and service-owned logic. |

The result is a portal that feels unified to users while staying modular for engineering teams.
