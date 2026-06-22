# Repository Structure

BetterPortal uses category-first layout.

```text
BetterPortal/
  bp-config.yaml
  framework/
    nodejs/
  plugins/
    nodejs/
      betterportal-bsb/
  themes/
    nodejs/
      bootstrap1/
      embedded/
  auth/
    nodejs/
  services/
    nodejs/
      admin/
      docs-site/
      examples/
  docs/
  spec/
```

## Why category-first?

The platform is not only a Node.js framework. It has framework code, themes, services, auth, specs, docs, and integrations.

Category-first layout keeps platform roles explicit and leaves room for additional languages later.

## Where to add services

Add new user-facing or admin services under:

```text
services/nodejs/<category>/<service-name>
```

Small platform integration packages belong under `plugins/nodejs`.

Themes belong under `themes/nodejs`.

## Package output

Published service and theme packages include runtime build output and plugin metadata only:

```json
"files": [
  "lib/**/*",
  "README.md",
  "bsb-plugin.json"
]
```

Tests stay in source only. Exclude `tests/` and `*.test.ts` from `tsconfig.json`; packages that want shared BSB checks add `@bsb/tests` as a dev dependency and run them through `bsb-plugin-cli test`.
