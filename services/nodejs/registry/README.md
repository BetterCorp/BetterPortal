# BetterPortal Registry

Immutable registry for BetterPortal `/.well-known/bp/schema.json` service contracts.

The production API is hosted at `https://io.betterportal.org`. BSB packages continue to publish their BSB schemas separately; this service also accepts contracts from PHP, .NET, Go, and other BP implementations.

Build the combined BSB + BetterPortal registry image from the repository root:

```sh
docker build -f services/nodejs/registry/Dockerfile -t betterportal/registry .
```

The BSB registry UI listens on port `3210`; the BP contract API listens on port `3211`. Map `io.betterportal.org` to `3211`, persist `/mnt/temp`, and set `BP_REGISTRY_TOKEN` plus `BP_COMMUNITY_REGISTRY_TOKEN`. Namespace credentials and their permitted reverse-domain plugin ID prefixes are configured in `sec-config.yaml`.

Published versions are immutable. Re-publishing byte-equivalent canonical contract content is idempotent; reusing the version with changed content or binding a plugin ID to another registry reference returns `409`.
