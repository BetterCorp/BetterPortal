# Config Manager

The config manager is the admin service for BetterPortal.

It edits the platform configuration and provides admin views for tenants, apps, services, routes, menus, fragments, and preview.

## What it manages

- tenant records
- tenant service registrations
- app hostnames
- app routes
- shell menu
- fragments
- theme config

## Local URL

The service runs on:

```text
http://localhost:3300
```

It is mounted into the default app under `/settings`.

## Route designer

The route designer maps app URLs to service views.

Use it when adding a service page to the portal without editing YAML by hand.

## Menu editor

The menu editor controls the BP shell navigation.

Prefer shell menu entries over building persistent inner menus inside services.
