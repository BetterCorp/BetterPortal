# Port capability and acceptance ledger

The .NET/Python ports remain incomplete. This ledger maps the requested scope to
implementation, documentation and acceptance checks; it is not a production-readiness
claim. Follow specification/fixtures, contracts/security, runtime/hosting, authoring,
then full interoperability. Publishing and BSB plugins are separate follow-ups.

See [the conformance guide](README.md) for running checks and locating CI artifacts.
Run totals and historical SDK failures belong in those artifacts and Git history.
The table retains outstanding work and the checks used to verify each capability.

Paths in the source column are relative to framework/nodejs/src unless prefixed
with BSB (plugins/nodejs/betterportal-bsb/src). Acceptance IDs name required
future scenarios; they are not assertions that those tests already exist.

| ID / capability | Current BP implementation | Port implementation / status | Documentation | Acceptance |
|---|---|---|---|---|
| contracts | contracts/*.ts, runtime/jsonSchema.ts | Canonical documents embedded in both packages, including derived authoring declarations, project locks, workspace/route metadata and registry responses; native imports, field selection and portable object composition | manifest.md §4 | schema-cases.json; all-document round trips and native integer boundaries with the pinned AnyVali SDKs |
| native-types | codegen/emitter.ts, cli/client.ts | C# types/Python typing generated from AnyVali with native CLI commands; input/output presence, recursion, defaults and wire unions | Port READMEs | check_types.py: positive/negative compiler checks, canonical drift and custom contracts |
| registration | runtime/handler.ts, generatedRegistry.ts, registry.ts; contracts/registry.ts | Native typed JSON/raw/finite handlers, Operation/Route/Registry, canonical declarations, explicit auth and duplicate/ambiguous-route rejection; typed subscriber-feed binding; full contexts pending | manifest.md §1; port READMEs | handler_cases.py, registry_cases.py, raw_cases.py and check_types.py; per-method-policy, stable-ID, required-auth/schema, duplicate operations and paths |
| manifest | runtime/manifest.ts, registry.ts | Native JSON manifest/discovery generation, optional path variants, dependency aliases/local targets and config admin descriptors and renderer/streaming metadata | manifest.md; schema-json.md; port READMEs | registry_cases.py: checks for defaults, identity, discovery, dependency targets, contract binding and schema interchange |
| validation | adapters/h3.ts, codegen/schemaPolicy.ts | Native typed handlers and JSON hosts validate per-field input/output, retain null/arrays and enforce body/query/header bounds; full authoring policy pending | protocol.md §4; port READMEs | handler_cases.py: checks; hosting_cases.py adds decoding, errors, method dispatch and client cancellation |
| multipart/raw | contracts/route.ts, adapters/h3.ts | Bounded native forms/uploads with canonical types; explicit raw byte/stream/file responses with header validation, CORS ownership, HEAD disposal and cancellation; JSON/raw registration stays explicit | protocol.md; port READMEs | hosting_cases.py: input bounds and multipart; raw_cases.py: checks for downloads, statuses, cookies, header injection, stream order/backpressure and disposal |
| negotiation | runtime/media.ts, adapters/h3.ts | Native media policy plus JSON/metadata/HTML/NDJSON hosts and finite SSE; authorized metadata avoids handler side effects | protocol.md §3; port READMEs | media_cases.py: checks; hosting_cases.py: availability, 406 and metadata; rendering_cases.py: exact renderer, mode and fragment Accept |
| rendering | runtime/view.ts, element.ts, statusViews.ts | Typed sync/async HTML callbacks, safe canonical render data, page/fragment/component and method/status selection, response state, URL/element helpers and separate error renderers; global status renderers pending | fragment-html.md; port READMEs | rendering_cases.py: checks for selectors, metadata, escaped HTML, parsed context, status/header/chrome, error projection, HEAD and cancellation; url_cases.py, check_types.py and check_docs.py |
| context | runtime/configProvider.ts, http.ts, tenantResolution.ts; BSB service.ts | Python context.py/C# Context.cs prototype: canonical scoped parse, host/port lookup and origin policy; host proxy middleware/full policy references pending | config.md §1; port READMEs | context_cases.py: checks for isolation, priority, forged hints, duplicate/orphan identities, origin restrictions, owned copies and null-active rejection |
| cors | runtime/h3.ts; BSB service.ts | Native trusted-origin policy integrated into JSON/raw/HTML/finite hosts, with per-mount preflights before authentication; HEAD follows GET policy | protocol.md §2; port READMEs | cors_cases.py: checks; hosting_cases.py, raw_cases.py and rendering_cases.py: protected and fragment preflights, denied methods/origins, auth error headers and header ownership |
| allowlist | adapters/h3.ts appAllowsRoute | Native exact IDs/legacy IDs, path variants, enabled local instances and GET fragment/slot mounts; JSON hosts enforce operation-specific aliases and verified machine audiences | config.md §1; port READMEs | access_cases.py: checks; hosting_cases.py adds wrong-local-target, method dispatch and rejected aliases |
| URLs | runtime/configProvider.ts, adapters/h3.ts; BSB service.ts | Native Urls on handler/render contexts: service aliases and exact instances, local/optional paths, app-mounted GET navigation, origin/param/query encoding, fragment/component/SSE selection, HTMX attributes, shell/service elements and route-token rewriting | docs/building/shell-links.md; port READMEs | url_cases.py: 232 shared/native checks; generated option compiler checks and executed documentation |
| jwt | runtime/auth/tokens.ts, jwtCrypto.ts, verifier.ts | Python security.py; C# Security.cs: six purposes, RS256 issuance/verification, strict headers, time and trust checks | auth.md §1; port READMEs | security_cases.py: cross-signature, wrong-purpose, time, issuer-audience, jku-x5u |
| jwks | runtime/auth/jwks.ts, keypair.ts | Python keys.py/C# Keys.cs: static RSA JWKS, remote cache, rotation/invalidation, bounded HTTP and cancellation; protected identity persistence in bootstrap.py/Bootstrap.cs | auth.md §1.1; port READMEs | key_cases.py: checks, including native transport policy and cancellation |
| roles | adapters/h3.ts resolveUserRequestAuth | Native current role grants, trusted aliases and management-only elevation; JSON hosts bind aliases to the mounted operation; cross-service permission-target helpers pending | auth.md §1.2; port READMEs | authorization_cases.py and hosting_cases.py: revoked-role/grant/alias, root scope, caller modes and real JWKS requests |
| auth-helpers | runtime/auth/issuer.ts, externalOidc.ts, redirect.ts, envelope.ts | Partial: refresh pairs/scope binding and CP/setup purposes; installation binding is covered below; external bridge and redirects/cookies pending | auth.md; port READMEs | security_cases.py refresh-pair, envelope-purpose; authorization_cases.py refresh-helper purpose/issuer/audience/tenant/app |
| config-ticket | runtime/configTicket.ts, serviceConfig.ts | CP-signed ticket routes enforce issuer/service/actions, active tenant and configApps scope; management CORS, redaction, atomic writes and lifecycle integrated | config.md §4; port READMEs | security_cases.py and config_api_cases.py: 139/139 config HTTP checks, all-language issuers, null-active rejection, scope revocation/races, dev opt-in and Node shared issuance-time regression |
| s2s | runtime/auth/serviceToken.ts; BSB service.ts | JSON hosts verify both delegated halves, partial/revoked envelopes and mounted machine audiences; native JSON clients bind user/service/delegated calls to current scope, mounts, contracts, requests, bindings, grants and registered signing identity | auth.md §3; port READMEs | security_cases.py, authorization_cases.py, hosting_cases.py and client_cases.py: wrong-peer, revocation, method/mode/permission/capability, scope, redirects, cookie isolation, transport bounds, cancellation and all receiver languages |
| local-config | runtime/configProvider.ts | Service accepts local ScopedConfig, validates atomic replacements and restores canonical snapshots through replaceable file storage; platform/environment authoring still pending | config.md §1; port READMEs | snapshot_cases.py: failed-save/cancellation/size/rename, concurrent updates, owned copies, cache interchange and live scope/auth/URL policy; hosting_cases.py: local scope |
| settings | runtime/configStore.ts, serviceConfig.ts | SettingsSchema compiles AnyVali contracts and preserves scopes/defaults/requiredness; ServiceSettings owns encrypted persistence with explicit legacy ownership; ConfigApi integrates authorized HTTP writes and effective handler/preview values | config.md §3; port READMEs | settings_cases.py: checks for values, defaults, requiredness and sensitive policy; settings_store_cases.py: checks for files, atomic failure, cancellation, migration and lifecycle; config_api_cases.py: API authorization, config/default/preview application and continued configuration with missing required values |
| encryption | runtime/configStore.ts | Python encryption.py/settings.py; C# Encryption.cs/Settings.cs: v1 read/v2-v3 write, native scrypt/AES-GCM and sensitive traversal, Node marker bridge, nested encryption/redaction and persisted encrypted caches | config.md §5; port READMEs | encryption_cases.py: checks; settings_cases.py and settings_store_cases.py: all-language envelope/file interchange, nested ciphertext, tampering, imported metadata and ordinary-prefix preservation |
| preview | runtime/previewConfig.ts; BSB service.ts applyPreviewConfig | Native sensitive schemas and authenticated preview decryption; validate both scopes and unambiguous active target before persisting encrypted snapshot and atomically activating request-config overlay | config.md §5.1; port READMEs | encryption_cases.py; snapshot_cases.py: cross-language encrypted cache, failed-revision retention, scope rejection, removal and no plaintext persistence |
| sync | BSB service.ts connectToControlPlane; scopedConfigCache.ts | Native ControlPlaneSync: typed manifest projection, bounded/validated POST and SSE, atomic snapshots, reconnect/poll fallback, secure endpoints and shutdown | config.md §2; port READMEs | sync_cases.py: neutral HTTP peer plus actual Node config-manager/FileStorage; key registration, manifest commit, scopes, live policy, framing, bounds, redirects, cache/save failures and reconnect |
| readiness | BSB service.ts renderHealth/canReadHealthDiagnostics | Managed health requires current manifest acknowledgment and a persisted valid snapshot; restored cache stays unready, explicit CP denial/shutdown suspends readiness, transient failures retain valid policy; authorized diagnostics pending | protocol.md §1.1; port READMEs | hosting_cases.py, snapshot_cases.py and sync_cases.py: bootstrap, cache, failed save, denial/recovery, real-CP credential revocation and public-minimal; diagnostic authorization pending |
| lifecycle | BSB service.ts, bootstrapState.ts | Native ASGI lifespan and ASP.NET hosted service own installation/sync cancellation and service disposal; encrypted atomic bootstrap/identity storage | config.md §2; port READMEs | sync_cases.py: exact-loopback, redirect-denied, shutdown-no-retry, cancelled startup/storage failure and host lifetime; bootstrap_cases.py: file interchange, tampering, identity/redaction, atomic failure and cancellation |
| installation | BSB service.ts registerInstallEndpoint, validateTenantApp; CM setupTokens.ts | Native ServiceInstallation pins CP/service trust, redeems setup tokens, persists credentials/identity, activates config API and sync; replay/reconfiguration, instance pinning, signed/persisted tenant locks and restart | config.md §2.2; port READMEs | installation_cases.py: actual Node installer/config-manager plus native failure, scope, transport, concurrency, cancellation and readiness checks; Node credential logging regression |
| hostname-change | BSB service.ts registerHostnameChangeEndpoint; CM setupTokens.ts | Native ServiceInstallation confirms through the pinned CP, proves the current instance/address projection, atomically replaces the protected binding and resumes normal sync; configured address and credentials retain ownership | config.md §2.3; port READMEs | hostname_cases.py: checks for real CP/Node/native lifecycle, pending readiness, forged headers, input/response bounds, revoked credentials, wrong instance/address, atomic failure, restart, concurrency and host/transport cancellation |
| streaming | runtime/stream.ts, streamHandler.ts | Python streaming.py/C# Streaming.cs: validated finite frames, derived schema, bounded buffered/NDJSON/SSE output and cancellation; finite.py/Finite.cs register typed finite handlers and stream renderers through existing host policy | streaming.md; port READMEs | stream_cases.py: 113 primitive checks; finite_cases.py: 344 host checks for buffered/NDJSON/SSE, typed shells/frames, limits/cancellation, input/mount/auth policy and manifest metadata |
| subscribers | runtime/sse.ts | Python sse.py/C# Sse.cs: validated scoped routes, replaceable transport, bounded local delivery, SSE encoding, tick render functions and shutdown; feeds.py/Feeds.cs bind typed feeds to the owning GET and enforce host authorization, exact renderer selection and cancellation | sse.md; port READMEs | sse_cases.py: 71 shared/native checks for isolation, overflow, validation, mutation, cancellation, shutdown, multiline wire data, render recovery and flushing; feed_cases.py: checks for input/transport/event boundaries, scope/auth/mounts, fragments, backpressure, overflow and service/host shutdown |
| events | BSB service.ts webhook | Pending declared webhook emission through CP | manifest.md | payload-contract, idempotency, scope, declared-event-only |
| theme-helpers | BSB service.ts shell fragments; runtime/view.ts | Pending shell context/fragments/chrome helpers; reuse browser assets | docs/building/themes.md | shell-fragment-overrides, service-origin-map, Bootstrap-shell-example |
| discovery | runtime/llms.ts; BSB seo.ts, service.ts | Public health/manifest/schema JSON in native hosts; developer resources, AI/LLM discovery and SEO hooks pending | ai.md; protocol.md; port READMEs | hosting_cases.py: health/manifest/schema; public-resource-bounds, app-discovery, sitemap-visibility and robots pending |
| observability | contracts/observability.ts, runtime/traceContext.ts, h3.ts | Pending replaceable logging/tracing/metrics and safe diagnostics | protocol.md §4 | trace-propagation, outcome-status, secret-redaction |
| scaffold | codegen/init.ts, cli/bp.ts | Native init commands create standalone installation hosts, discovered authenticated JSON/HTML routes, export factories, BP identity/locks and pinned native package references; existing destinations are rejected | [Route authoring](../../docs/building/route-authoring.md); generated READMEs | check_scaffold.py: packaged CLI/HTTP checks on each OS, offline .NET dependency restore, consumer builds with no Node, real CM installation, manifest/readiness, JWT auth and encrypted-state restart |
| discovery-tools | codegen/scanner.ts, emitter.ts, validate.ts | C# compiler-supplied RouteModule metadata and Python package factories build the shared registry; index presentation, optional paths, method policies, typed renderer/fragment/raw/finite selection and owning-GET SSE binding; concrete AnyVali schema policy | [Route authoring](../../docs/building/route-authoring.md) | check_discovery.py: compiled/module exports, Node path/ID comparison, source/PDB-free .NET discovery, hostile declarations and executable guide examples |
| contract-tools | cli/project.ts, contract.ts, publish.ts | Native project/lock parsing, automatic local discovery and explicit local/registry installation preserve identity/version; Python module/C# compiled factories export validated runtime contracts; publishing uses bounded authenticated HTTP | docs/building/services.md; port READMEs | check_projects.py: CLI checks including real Node discovery compatibility, exact versions, ambiguity and frozen isolation; check_registry_tools.py: checks against the real Node registry, local fallback, hostile responses and offline builds; check_export.py: 27 native factory/consumer checks |
| dependency-clients | cli/client.ts; BSB service.ts authenticatedFetch | Native runtime and generated JSON clients use AnyVali documents and scoped credentials; project commands discover/install local or registry contracts and verify shared byte locks before frozen generation; raw/streaming clients pending | auth.md §3; port READMEs | client_cases.py: checks, including four generated cross-language host pairs in user/service/delegated modes; check_clientgen.py compiles all three registry exports; check_projects.py: CLI checks for discovery, locks, tampering, migration, alias conflicts and frozen builds; two Node-generated outbound pairs pending |
| delivery | .github/workflows/ci.yml | Partial: Linux CI matrix uses Python 3.10/3.14 with strict conformance failure reporting; local Windows/Linux HTTP, mypy/compiler, executable README, wheel/sdist/NuGet and embedded-corpus checks | Port READMEs; conformance README | check_packages.py, check_docs.py, check_types.py, check_clientgen.py, check_projects.py, check_registry_tools.py, check_export.py, check_discovery.py, check_scaffold.py; hosted CI passes the transport stage; full CM+Bootstrap and two Node-generated client/server pairs pending |

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

## Conformance policy

AnyVali is the only schema validator. Keep regressions for SDK defects in the
corpus after upstream fixes; do not add alternate validators or waive failures.
Known Node differences are not compatibility requirements for the ports:

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
- Finite connections reject fragment/component selectors in the ports; a
  fragment-only mount cannot authorize the full frame stream. Node currently
  passes these selectors into the generic SSE mount check. Ports also keep an
  absent sibling method schema separate from a GET stream's input schema.
- Node's subscriber adapter can fall back to raw events when a selected tick is
  unavailable, omits header-schema validation and tick URL rewriting, and closes
  on render failures. Native hosts require exact ticks, reject Accept-only fragment
  authorization, validate headers, rewrite tick URLs and recover with safe error events.
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
here also includes shared token checks, schema projection, development conformance
artifacts and frozen CLI support for the native byte-lock format. The registry's
existing persisted digest algorithm is unchanged.
