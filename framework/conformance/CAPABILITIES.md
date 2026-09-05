# Port capability and acceptance ledger

This is an implementation ledger, not a conformance claim. The user-requested
delivery order is specification/fixtures → contracts/security → runtime/hosting
→ authoring → full interoperability. A blocked earlier gate prevents claiming
later gates. Publishing and BSB plugins are separate follow-ups.

Current state: canonical documents, native schema adapters, and a runnable HTTP
schema compatibility gate exist. The gate fails with published AnyVali 1.1.0;
see [README](README.md). Neither language is yet a service runtime. All entries
below remain pending in both ports except the specifically marked partial work.

Paths in the source column are relative to framework/nodejs/src unless prefixed
with BSB (plugins/nodejs/betterportal-bsb/src). Acceptance IDs name required
future scenarios; they are not assertions that those tests already exist.

| ID / capability | Current BP implementation | Port implementation / status | Documentation | Acceptance |
|---|---|---|---|---|
| contracts | contracts/*.ts, runtime/jsonSchema.ts | 127 canonical documents; Python contracts.py and C# Contracts.cs partial; native import compatibility blocked | manifest.md §4 | schema-cases.json; all-document import/export sweep |
| native-types | codegen/emitter.ts, cli/client.ts | Pending C# types/Python typing from AnyVali; no independent platform schema copies | manifest.md §4 | type-presence, type-recursion, type-defaults, generated-build |
| registration | runtime/handler.ts, generatedRegistry.ts, registry.ts; contracts/registry.ts | Pending typed operations and handler/render contexts | manifest.md §1 | duplicate-operation, per-method-policy, missing-schema |
| manifest | runtime/manifest.ts, registry.ts | Pending manifest/schema generation | manifest.md; schema-json.md | manifest-defaults, operation-identity, discovery-schema |
| validation | adapters/h3.ts, codegen/schemaPolicy.ts | Pending input/output AnyVali validation | protocol.md §4 | params-query-headers-body, invalid-output, unknown-keys |
| multipart/raw | contracts/route.ts, adapters/h3.ts | Pending bounded uploads, repeated fields, native raw/file responses | protocol.md | multipart-bounds, repeated-fields, raw-download, bodyless-status |
| negotiation | runtime/media.ts, adapters/h3.ts | Pending HTML/JSON/metadata/NDJSON | protocol.md §3 | accept-q-zero, unsupported-406, exact-renderer, per-method-schema |
| rendering | runtime/view.ts, element.ts, statusViews.ts | Pending HTML-returning functions, components, fragments, status renderers | fragment-html.md | fragment-selector, component-selector, themed-error, escape-html |
| context | runtime/configProvider.ts, http.ts, tenantResolution.ts; BSB service.ts | Pending tenant/app and trusted proxy resolution | config.md §1 | tenant-isolation, app-isolation, ambiguous-port, forged-proxy |
| cors | runtime/h3.ts; BSB service.ts | Pending trusted-origin policy and preflights | protocol.md §2 | allowed-preflight, denied-origin, vary, credential-headers |
| allowlist | adapters/h3.ts resolveAppRouteAccess | Pending exact operation allowlists, GET fragment/slot mounts | config.md §1 | denied-operation, sibling-method, no-appRoutes-inbound |
| URLs | runtime/configProvider.ts, adapters/h3.ts; BSB service.ts | Pending service aliases, routeUrl/uiRouteUrl, params/query/fragments/SSE | docs/building/shell-links.md | service-alias, cross-service-path, optional-param, shell-navigation |
| jwt | runtime/auth/tokens.ts, jwtCrypto.ts, verifier.ts | Pending RS256 issuance/verification | auth.md §1 | cross-signature, wrong-purpose, time, issuer-audience, jku-x5u |
| jwks | runtime/auth/jwks.ts, keypair.ts | Pending local/static/remote keys and cache invalidation | auth.md §1.1 | rotation, unknown-kid, trusted-destination, no-redirect |
| roles | adapters/h3.ts resolveUserRequestAuth | Pending scoped role expansion and management-only elevation | auth.md §1.2 | revoked-role, instance-alias, forged-root, preview-elevation |
| auth-helpers | runtime/auth/issuer.ts, externalOidc.ts, redirect.ts, envelope.ts | Pending refresh pairs, external token bridge, redirects/cookies, CP/setup helpers | auth.md | refresh-purpose, scope-binding, redirect-safety, envelope-purpose |
| config-ticket | runtime/configTicket.ts, serviceConfig.ts | Pending CP-signed ticket and action/scope checks | config.md §4 | cross-ticket, wrong-service, wrong-action, configApps-scope |
| s2s | runtime/auth/serviceToken.ts; BSB service.ts | Pending service/delegated tokens and outbound calls | auth.md §3 | partial-envelope, wrong-peer, expired-grant, revoked-binding, delegated-both |
| local-config | runtime/configProvider.ts | Pending native local configuration provider | config.md §1 | local-valid, local-invalid, no-shared-CM-file |
| settings | runtime/configStore.ts, serviceConfig.ts | Pending replaceable persistent store, scope overlays and write validation | config.md §3 | tenant-overlay, scope-key, redaction-placeholder, atomic-write-failure |
| encryption | runtime/configStore.ts | Pending native sensitive APIs with v1/v2/v3 BP envelope compatibility | config.md §5 | cross-encrypt, typed-secret, legacy-read, tamper, no-plaintext |
| preview | runtime/previewConfig.ts; BSB service.ts applyPreviewConfig | Pending authenticated preview decryption and atomic revision application | config.md §5.1 | path-scope-AAD, empty-secret, wrong-key, failed-revision-retained |
| sync | BSB service.ts connectToControlPlane; scopedConfigCache.ts | Pending standalone manifest POST, SSE/poll, restart cache | config.md §2 | submission-before-ready, failed-bootstrap, reconnect, invalid-snapshot |
| readiness | BSB service.ts renderHealth/canReadHealthDiagnostics | Pending public minimal health and authorized diagnostics | protocol.md §1.1 | public-minimal, admin-scoped, refresh-denied, cache-not-ready |
| lifecycle | BSB service.ts, bootstrapState.ts | Pending install/redeem bootstrap, key persistence, shutdown cancellation | config.md §2 | exact-loopback, redirect-denied, pinned-key, shutdown-no-retry |
| streaming | runtime/stream.ts, streamHandler.ts | Pending SSE/NDJSON/buffered frames, cancellation/backpressure | streaming.md | order, summary, single-terminal, invalid-item, slow-sink, cancel |
| subscribers | runtime/sse.ts | Pending bounded tenant/app subscriptions and replaceable transport | sse.md | tenant-only, overflow, disconnect-cleanup, no-unconfigured-broadcast |
| events | BSB service.ts webhook | Pending declared webhook emission through CP | manifest.md | payload-contract, idempotency, scope, declared-event-only |
| theme-helpers | BSB service.ts shell fragments; runtime/view.ts | Pending shell context/fragments/chrome helpers; reuse browser assets | docs/building/themes.md | shell-fragment-overrides, service-origin-map, Bootstrap-shell-example |
| discovery | runtime/llms.ts; BSB seo.ts, service.ts | Pending developer resources, AI/LLM discovery and SEO hooks | ai.md; protocol.md | public-resource-bounds, app-discovery, sitemap-visibility, robots |
| observability | contracts/observability.ts, runtime/traceContext.ts, h3.ts | Pending replaceable logging/tracing/metrics and safe diagnostics | protocol.md §4 | trace-propagation, outcome-status, secret-redaction |
| scaffold | codegen/init.ts, cli/bp.ts | Pending native commands with runnable examples | Port READMEs (pending) | scaffold-build-run, no-node-no-BSB |
| discovery-tools | codegen/scanner.ts, emitter.ts, validate.ts | Pending compiler-supported C# and module-based Python discovery | docs/building/routes-and-views.md | route-dirs, optional-params, stable-ID, renderer-fragment-SSE-selection |
| contract-tools | cli/project.ts, contract.ts, publish.ts | Pending betterportal.json, registry identity, local exports/publishing | docs/building/services.md | registry-identity, native-export, local-contract-resolution |
| dependency-clients | cli/client.ts; BSB service.ts authenticatedFetch | Pending typed clients using runtime context and explicit caller mode | auth.md §3 | betterportal.lock.json, frozen-build, digest-mismatch, all-language-pairs |
| delivery | .github/workflows/ci.yml | Pending port type checks, docs examples, wheels/NuGet and integration CI | Port READMEs (pending) | Python 3.10+, .NET 10, CM+Bootstrap, six client/server pairs |

## BP and BSB ownership

BP owns schema validation, auth/authorization, origin/context/allowlist policy,
URL resolution, configuration, manifest sync, readiness, streaming, discovery,
and authoring semantics. Standalone runtimes must own these policies independently
of an application host. BSB contributes plugin discovery/loading, lifecycle calls,
its observability/config integration, and Node build hooks. Future BSB plugins
adapt those host facilities to BP; they must not reimplement BP policy.

Themes and provider *building blocks* are in scope. Bootstrap themes, config-manager,
registry service, individual auth-provider services, and translated browser
JavaScript are not port deliverables. Existing Node services are integration peers.

## Known defects must not become compatibility requirements

- AnyVali 1.1.0 import drops sensitive metadata in JS, Python, and C#. The native
  encryption/storage gate must pass before ports may persist secrets.
- Python 1.1.0 importer rejects Node record valueSchema and wrapper inner keys.
- C# 1.1.0 import loses explicit null defaults. Native export/reimport of recursive
  definitions is separately tested; never accept a dangling reference.
- Node's platform menu schema is bounded but its exported document can exceed
  application JSON's depth limit. The development exporter uses native AnyVali
  export and supplies BP's existing recursive JSON definition without parsing
  schema documents as application JSON values.
- Node's sync casts unvalidated snapshots; port snapshots must validate before
  replacement. Its preview update sequence must not be copied as non-atomic writes.
- Node's Accept helper does not exclude q=0 and falls back to JSON for unknown
  types. The protocol's unacceptable-representation rules still apply to ports.
- The historical host matcher may ignore a mismatched port. Never turn that into
  ambiguous tenant/app authorization in the ports.

These observations do not authorize unrelated Node refactoring. The schema
projection and development conformance artifacts are the only Node code changes
needed for this initial gate.
