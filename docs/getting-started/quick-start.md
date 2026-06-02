# Quick Start

This guide gets the local BetterPortal workspace running with the default Bootstrap theme, the config manager, the example service, and the docs site.

## Install

```bash
npm install
npm run build
```

## Start the core services

Run each command in its own terminal.

```bash
cd themes/nodejs/bootstrap1
npm start
```

```bash
cd services/nodejs/admin/config-manager
npm start
```

```bash
cd services/nodejs/examples/hello-view
npm start
```

```bash
cd services/nodejs/docs-site
npm start
```

## Open the portal

Open:

```text
http://localhost:3100
```

The default app is configured in `bp-config.yaml`. The theme listens on port `3100`; services listen on their own ports and are called directly by the browser.

## Useful URLs

| URL | Purpose |
|---|---|
| `http://localhost:3100` | BetterPortal shell and default app. |
| `http://localhost:3100/docs` | BetterPortal docs home. |
| `http://localhost:3300/.well-known/bp/manifest` | Config manager manifest. |
| `http://localhost:3400/.well-known/bp/manifest` | Docs service manifest. |

## After changing routes

Routes are generated from files under `bp-routes/`.

When adding, removing, or renaming route files, run:

```bash
npm run bp-codegen
```

Then rebuild the service:

```bash
npm run build
```
