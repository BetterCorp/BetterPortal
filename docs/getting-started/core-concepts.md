# Core Concepts

BetterPortal has a small vocabulary. Understanding these terms makes the rest of the platform easier to reason about.

## Tenant

A tenant is the isolation boundary. It owns direct service registrations, shared-service activations, branding, config, and apps.

Tenants are defined in `bp-config.yaml` under `tenants`.

## App

An app is a user-facing portal surface inside a tenant. It has hostnames, a theme, routes, a menu, fragments, and theme config.

A tenant can have more than one app.

## Theme

A theme renders the shell: layout, navigation, brand, assets, style, and fragment locations.

The default theme is `bootstrap1`. It uses Bootstrap 5 and HTMX. It does not proxy service page content.

## Service

A service is an independently running BSB plugin that exposes BetterPortal views. Each service has its own manifest, handlers, schemas, and theme renderers.

Services are registered directly under a tenant or registered once in `sharedServiceCatalog` and activated through `sharedServiceActivations`.

## Route

A route maps a visible app URL to a service view.

For example, the app route `/docs` can map to the docs service route `/docs`.

## View

A view is a typed endpoint under `bp-routes/<route>/`. `index.ts` declares metadata; `GET.ts`, `POST.ts`, and other method files declare schemas and handlers.

Theme-specific HTML renderers live beside the view in `_theme.<themeId>/` as method/status files such as `GET.tsx` or `POST.422.tsx`.

## Fragment

A fragment is a small named HTML island mounted into the shell, such as a nav profile block or live clock.

Fragments are still service-owned, but the app decides where they are mounted.

## Manifest

Every service publishes `/.well-known/bp/manifest`. BetterPortal uses manifests to discover views, supported themes, schemas, fragments, and service metadata.
