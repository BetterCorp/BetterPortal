# Port capability and acceptance ledger

This is an implementation ledger, not a conformance claim. The user-requested
delivery order is specification/fixtures → contracts/security → runtime/hosting
→ authoring → full interoperability. A blocked earlier gate prevents claiming
later gates. Publishing and BSB plugins are separate follow-ups.

Current state: canonical documents, native schema adapters, token/service security,
native packages and runnable HTTP gates exist. Published AnyVali 1.1.1 passes
1,012/1,020 schema probes; token/service security passes 459/459 scenarios and JWKS
checks pass 80/80; encryption passes 318/318, authorization 306/306, media 124/124,
finite streams 113/113, SSE subscriptions/wire 71/71 and CORS 33/33.
Typed handler validation passes 44/44 checks, with native compiler checks for
input/output types. JSON operation registration and manifest generation pass 89/89
registry checks. Prototype JSON hosts pass 222/222 HTTP/ASGI checks; raw responses
pass 101/101 checks including streamed delivery, ownership and backpressure.
Typed HTML callbacks, presentation context, fragments/components and status/error
rendering pass 163/163 checks.
Scoped URL, navigation and element helpers pass 232/232 checks.
Inbound operation mounts and local permission aliases pass 130/130 access checks.
Context resolution passes 102/103; its Python null-active check is blocked by the
same upstream null/default defect. The combined gate passes 3,599/3,608. See
[README](README.md). Neither language is a complete production runtime. Entries remain
pending except the specifically marked partial work.

Paths in the source column are relative to framework/nodejs/src unless prefixed
with BSB (plugins/nodejs/betterportal-bsb/src). Acceptance IDs name required
future scenarios; they are not assertions that those tests already exist.

| ID / capability | Current BP implementation | Port implementation / status | Documentation | Acceptance |
|---|---|---|---|---|
| contracts | contracts/*.ts, runtime/jsonSchema.ts | 129 canonical documents embedded in both packages, including derived authoring declarations; native imports, field selection and portable object composition; two expanded SDK probes fail | manifest.md §4 | schema-cases.json; 928/936 including all-document round trips |
| native-types | codegen/emitter.ts, cli/client.ts | C# types/Python typing generated from AnyVali with native CLI commands; input/output presence, recursion, defaults and wire unions | Port READMEs | check_types.py: positive/negative compiler checks, canonical drift and custom contracts |
| registration | runtime/handler.ts, generatedRegistry.ts, registry.ts; contracts/registry.ts | Native typed JSON/raw handlers, Operation/Route/Registry, canonical declarations, explicit auth and duplicate/ambiguous-route rejection; full contexts and renderer/finite-stream registration pending | manifest.md §1; port READMEs | handler_cases.py, registry_cases.py, raw_cases.py and check_types.py; per-method-policy, stable-ID, required-auth/schema, duplicate operations and paths |
| manifest | runtime/manifest.ts, registry.ts | Native JSON manifest/discovery generation, optional path variants, dependency aliases/local targets and config admin descriptors; rendering/streaming metadata pending | manifest.md; schema-json.md; port READMEs | registry_cases.py: 89 checks for defaults, identity, discovery, dependency targets, contract binding and schema interchange |
| validation | adapters/h3.ts, codegen/schemaPolicy.ts | Native typed handlers and JSON hosts validate per-field input/output, retain null/arrays and enforce body/query/header bounds; full authoring policy pending | protocol.md §4; port READMEs | handler_cases.py: 44 checks; hosting_cases.py adds decoding, errors, method dispatch and client cancellation |
| multipart/raw | contracts/route.ts, adapters/h3.ts | Bounded native forms/uploads with canonical types; explicit raw byte/stream/file responses with header validation, CORS ownership, HEAD disposal and cancellation; JSON/raw registration stays explicit | protocol.md; port READMEs | hosting_cases.py: input bounds and multipart; raw_cases.py: 101 checks for downloads, statuses, cookies, header injection, stream order/backpressure and disposal |
| negotiation | runtime/media.ts, adapters/h3.ts | Native media policy plus JSON/metadata/HTML hosts; authorized metadata avoids handler side effects; finite/SSE integration pending | protocol.md §3; port READMEs | media_cases.py: 124 checks; hosting_cases.py: availability, 406 and metadata; rendering_cases.py: exact renderer, mode and fragment Accept |
| rendering | runtime/view.ts, element.ts, statusViews.ts | Typed sync/async HTML callbacks, safe canonical render data, page/fragment/component and method/status selection, response state, URL/element helpers and separate error renderers; global status renderers pending | fragment-html.md; port READMEs | rendering_cases.py: 163 checks for selectors, metadata, escaped HTML, parsed context, status/header/chrome, error projection, HEAD and cancellation; url_cases.py, check_types.py and check_docs.py |
| context | runtime/configProvider.ts, http.ts, tenantResolution.ts; BSB service.ts | Python context.py/C# Context.cs prototype: canonical scoped parse, host/port lookup and origin policy; Python null-active security gate blocked by AnyVali #127; host proxy middleware/full policy references pending | config.md §1; port READMEs | context_cases.py: isolation, priority, forged hints, duplicate/orphan identities, origin restrictions, owned copies; null-active-rejected fails on Python |
| cors | runtime/h3.ts; BSB service.ts | Native trusted-origin policy integrated into JSON/raw/HTML hosts, with per-mount preflights before authentication; finite/SSE response integration pending | protocol.md §2; port READMEs | cors_cases.py: 33 checks; hosting_cases.py, raw_cases.py and rendering_cases.py: protected and fragment preflights, denied methods/origins, auth error headers and header ownership |
| allowlist | adapters/h3.ts appAllowsRoute | Native exact IDs/legacy IDs, path variants, enabled local instances and GET fragment/slot mounts; JSON hosts enforce operation-specific aliases and verified machine audiences | config.md §1; port READMEs | access_cases.py: 130 checks; hosting_cases.py adds wrong-local-target, method dispatch and rejected aliases |
| URLs | runtime/configProvider.ts, adapters/h3.ts; BSB service.ts | Native Urls on handler/render contexts: service aliases and exact instances, local/optional paths, app-mounted GET navigation, origin/param/query encoding, fragment/component/SSE selection, HTMX attributes, shell/service elements and route-token rewriting | docs/building/shell-links.md; port READMEs | url_cases.py: 232 shared/native checks; generated option compiler checks and executed documentation |
| jwt | runtime/auth/tokens.ts, jwtCrypto.ts, verifier.ts | Python security.py; C# Security.cs: six purposes, RS256 issuance/verification, strict headers, time and trust checks | auth.md §1; port READMEs | security_cases.py: cross-signature, wrong-purpose, time, issuer-audience, jku-x5u |
| jwks | runtime/auth/jwks.ts, keypair.ts | Python keys.py/C# Keys.cs: static RSA JWKS, remote cache, rotation/invalidation, bounded HTTP and cancellation; key persistence pending | auth.md §1.1; port READMEs | key_cases.py: 80 checks, including native transport policy and cancellation |
| roles | adapters/h3.ts resolveUserRequestAuth | Native current role grants, trusted aliases and management-only elevation; JSON hosts bind aliases to the mounted operation; cross-service permission-target helpers pending | auth.md §1.2; port READMEs | authorization_cases.py and hosting_cases.py: revoked-role/grant/alias, root scope, caller modes and real JWKS requests |
| auth-helpers | runtime/auth/issuer.ts, externalOidc.ts, redirect.ts, envelope.ts | Partial: refresh pairs/scope binding and CP/setup purposes; external bridge, redirects/cookies and installation binding pending | auth.md; port READMEs | security_cases.py refresh-pair, envelope-purpose; authorization_cases.py refresh-helper purpose/issuer/audience/tenant/app |
| config-ticket | runtime/configTicket.ts, serviceConfig.ts | Partial: CP-signed ticket and service/tenant/action checks; config routes/configApps policy pending | config.md §4 | security_cases.py cross-ticket, wrong-service, wrong-action; configApps-scope pending |
| s2s | runtime/auth/serviceToken.ts; BSB service.ts | JSON hosts verify both delegated halves, partial/revoked envelopes and mounted machine audiences; outbound calls pending | auth.md §3; port READMEs | security_cases.py, authorization_cases.py and hosting_cases.py: wrong-peer, revoked binding/grant/user, method/mode/permission, scope and delegated-both |
| local-config | runtime/configProvider.ts | Service accepts one validated local ScopedConfig; file/environment loading and atomic replacement pending | config.md §1; port READMEs | hosting_cases.py: ready/not-ready/closed and local scope; no-shared-CM-file tooling pending |
| settings | runtime/configStore.ts, serviceConfig.ts | Pending replaceable persistent store, scope overlays and write validation | config.md §3 | tenant-overlay, scope-key, redaction-placeholder, atomic-write-failure |
| encryption | runtime/configStore.ts | Python encryption.py/C# Encryption.cs: v1 read/v2-v3 write, native scrypt/AES-GCM; legacy sensitive-marker adapter/persistence pending | config.md §5; port READMEs | encryption_cases.py: 318 shared/native checks; typed-secret, legacy-read, tamper, bounds |
| preview | runtime/previewConfig.ts; BSB service.ts applyPreviewConfig | Native authenticated encryption/decryption and descriptor-to-AnyVali sensitive schemas; atomic revision application pending | config.md §5.1; port READMEs | encryption_cases.py: path-scope-AAD, empty-secret, wrong-key, imported-sensitive; failed-revision-retained pending |
| sync | BSB service.ts connectToControlPlane; scopedConfigCache.ts | Pending standalone manifest POST, SSE/poll, restart cache | config.md §2 | submission-before-ready, failed-bootstrap, reconnect, invalid-snapshot |
| readiness | BSB service.ts renderHealth/canReadHealthDiagnostics | JSON hosts expose minimal public local readiness; CP readiness and authorized diagnostics pending | protocol.md §1.1; port READMEs | hosting_cases.py: public-minimal, missing-snapshot and closed; admin-scoped, refresh-denied and cache-not-ready pending |
| lifecycle | BSB service.ts, bootstrapState.ts | Pending install/redeem bootstrap, key persistence, shutdown cancellation | config.md §2 | exact-loopback, redirect-denied, pinned-key, shutdown-no-retry |
| streaming | runtime/stream.ts, streamHandler.ts | Python streaming.py/C# Streaming.cs: validated finite frames, derived schema, bounded buffered/NDJSON/SSE output and cancellation; finite HTML rendering and operation hosting pending | streaming.md; port READMEs | stream_cases.py: 113 checks for wire order, summary/null, validation, single terminal, limits, backpressure and cancellation |
| subscribers | runtime/sse.ts | Python sse.py/C# Sse.cs: validated scoped routes, replaceable transport, bounded local delivery, SSE encoding, tick render functions and shutdown; host authorization/renderer selection pending | sse.md; port READMEs | sse_cases.py: 71 shared/native checks for isolation, overflow, validation, mutation, cancellation, shutdown, multiline wire data, render recovery and flushing |
| events | BSB service.ts webhook | Pending declared webhook emission through CP | manifest.md | payload-contract, idempotency, scope, declared-event-only |
| theme-helpers | BSB service.ts shell fragments; runtime/view.ts | Pending shell context/fragments/chrome helpers; reuse browser assets | docs/building/themes.md | shell-fragment-overrides, service-origin-map, Bootstrap-shell-example |
| discovery | runtime/llms.ts; BSB seo.ts, service.ts | Public health/manifest/schema JSON in native hosts; developer resources, AI/LLM discovery and SEO hooks pending | ai.md; protocol.md; port READMEs | hosting_cases.py: health/manifest/schema; public-resource-bounds, app-discovery, sitemap-visibility and robots pending |
| observability | contracts/observability.ts, runtime/traceContext.ts, h3.ts | Pending replaceable logging/tracing/metrics and safe diagnostics | protocol.md §4 | trace-propagation, outcome-status, secret-redaction |
| scaffold | codegen/init.ts, cli/bp.ts | Pending native commands with runnable examples | Port READMEs (pending) | scaffold-build-run, no-node-no-BSB |
| discovery-tools | codegen/scanner.ts, emitter.ts, validate.ts | Pending compiler-supported C# and module-based Python discovery | docs/building/routes-and-views.md | route-dirs, optional-params, stable-ID, renderer-fragment-SSE-selection |
| contract-tools | cli/project.ts, contract.ts, publish.ts | Pending betterportal.json, registry identity, local exports/publishing | docs/building/services.md | registry-identity, native-export, local-contract-resolution |
| dependency-clients | cli/client.ts; BSB service.ts authenticatedFetch | Pending typed clients using runtime context and explicit caller mode | auth.md §3 | betterportal.lock.json, frozen-build, digest-mismatch, all-language-pairs |
| delivery | .github/workflows/ci.yml | Partial: mypy/compiler checks, Python 3.10/3.13 HTTP gates, local wheel/sdist/NuGet builds, embedded-corpus package check and executed README examples; CI pending | Port READMEs | check_packages.py, check_docs.py, check_types.py; Linux, CM+Bootstrap and six client/server pairs pending |

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

- AnyVali 1.1.1 fixes the original 1.1.0 metadata, wire-name, null-default and
  recursive root interchange failures. Python still replaces explicit null with
  a default; all SDKs document a native-parent composition limitation. Both
  expanded probes remain failing; BP portable composition passes its separate
  recursive and sensitive-field probes. Never accept dangling references or mask the
  presence defect with a second validator. Encryption primitives and preview
  sensitive traversal pass; persistent encrypted settings remain a later gate.
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
- Node's buffered stream helper can return partial items on cancellation. Native
  helpers propagate cancellation; incomplete buffered data must not appear successful.
- Node's structured status helper suppresses 206 and redirect bodies. Ports retain
  these bodies and suppress only 204/205/304; explicit HTML status renderers still
  have no success-renderer fallback.
- Node's authentication error path selects only page status renderers. Ports
  preserve an explicitly selected fragment/component and pass only safe error data.
- Node can treat another instance of the same plugin as the current service when
  building URLs. Ports preserve exact instance IDs and reject ambiguous providers.
  Its generic SSE URL helper can append the endpoint suffix inside a query; ports
  append to the path before encoding the query.

These observations do not authorize unrelated Node refactoring. The Node preview
length fix is directly required by empty-secret interoperability; other Node work
here is limited to schema projection and development conformance artifacts.
