# Port capability and acceptance ledger

This is an implementation ledger, not a conformance claim. The user-requested
delivery order is specification/fixtures → contracts/security → runtime/hosting
→ authoring → full interoperability. A blocked earlier gate prevents claiming
later gates. Publishing and BSB plugins are separate follow-ups.

Current state: canonical documents, native schema adapters, token/service security,
native packages and runnable HTTP gates exist. Published AnyVali 1.1.1 passes
1,250/1,278 schema probes; token/service security passes 459/459 scenarios and JWKS
checks pass 80/80; encryption passes 318/318, authorization 306/306, media 124/124,
finite stream primitives 113/113, finite operation hosting 344/344, SSE subscriptions/wire 71/71, subscriber hosting 161/161 and CORS 33/33.
Typed handler validation passes 44/44 checks, with native compiler checks for
input/output types. JSON operation registration and manifest generation pass 89/89
registry checks. Prototype JSON hosts pass 222/222 HTTP/ASGI checks; raw responses
pass 101/101 checks including streamed delivery, ownership and backpressure.
Typed HTML callbacks, presentation context, fragments/components and status/error
rendering pass 163/163 checks.
Scoped URLs pass 232/232, atomic snapshots 125/125, standalone control-plane sync
132/132, settings schema/encryption/redaction policy 130/130, encrypted settings
persistence 70/70, config HTTP hosting 138/139, protected bootstrap storage 147/147,
installation 137/137, hostname changes 99/99 and scoped dependency clients 210/210.
The full gate passes 5,530/5,560;
the remaining probes expose SDK defects/limitations, including Python's explicit-null
tenant flag affecting config authorization. Windows Python 3.10 and Linux Python
3.14 produce the same full-gate failure identities. Linux compiler, documentation
and package checks pass; CI runs those gates on Python 3.10/3.14 without waiving
the upstream failures. Hosted CI execution awaits a future push.
Inbound operation mounts and local permission aliases pass 130/130 access checks.
Context resolution passes 102/103; its Python null-active check is blocked by the
same upstream null/default defect. See
[README](README.md). Neither language is a complete production runtime. Entries remain
pending except the specifically marked partial work.

Paths in the source column are relative to framework/nodejs/src unless prefixed
with BSB (plugins/nodejs/betterportal-bsb/src). Acceptance IDs name required
future scenarios; they are not assertions that those tests already exist.

| ID / capability | Current BP implementation | Port implementation / status | Documentation | Acceptance |
|---|---|---|---|---|
| contracts | contracts/*.ts, runtime/jsonSchema.ts | 151 canonical documents embedded in both packages, including derived authoring declarations; native imports, field selection and portable object composition; SDK defects remain visible | manifest.md §4 | schema-cases.json; 1,240/1,266 including all-document round trips |
| native-types | codegen/emitter.ts, cli/client.ts | C# types/Python typing generated from AnyVali with native CLI commands; input/output presence, recursion, defaults and wire unions | Port READMEs | check_types.py: positive/negative compiler checks, canonical drift and custom contracts |
| registration | runtime/handler.ts, generatedRegistry.ts, registry.ts; contracts/registry.ts | Native typed JSON/raw/finite handlers, Operation/Route/Registry, canonical declarations, explicit auth and duplicate/ambiguous-route rejection; typed subscriber-feed binding; full contexts pending | manifest.md §1; port READMEs | handler_cases.py, registry_cases.py, raw_cases.py and check_types.py; per-method-policy, stable-ID, required-auth/schema, duplicate operations and paths |
| manifest | runtime/manifest.ts, registry.ts | Native JSON manifest/discovery generation, optional path variants, dependency aliases/local targets and config admin descriptors and renderer/streaming metadata | manifest.md; schema-json.md; port READMEs | registry_cases.py: 89 checks for defaults, identity, discovery, dependency targets, contract binding and schema interchange |
| validation | adapters/h3.ts, codegen/schemaPolicy.ts | Native typed handlers and JSON hosts validate per-field input/output, retain null/arrays and enforce body/query/header bounds; full authoring policy pending | protocol.md §4; port READMEs | handler_cases.py: 44 checks; hosting_cases.py adds decoding, errors, method dispatch and client cancellation |
| multipart/raw | contracts/route.ts, adapters/h3.ts | Bounded native forms/uploads with canonical types; explicit raw byte/stream/file responses with header validation, CORS ownership, HEAD disposal and cancellation; JSON/raw registration stays explicit | protocol.md; port READMEs | hosting_cases.py: input bounds and multipart; raw_cases.py: 101 checks for downloads, statuses, cookies, header injection, stream order/backpressure and disposal |
| negotiation | runtime/media.ts, adapters/h3.ts | Native media policy plus JSON/metadata/HTML/NDJSON hosts and finite SSE; authorized metadata avoids handler side effects | protocol.md §3; port READMEs | media_cases.py: 124 checks; hosting_cases.py: availability, 406 and metadata; rendering_cases.py: exact renderer, mode and fragment Accept |
| rendering | runtime/view.ts, element.ts, statusViews.ts | Typed sync/async HTML callbacks, safe canonical render data, page/fragment/component and method/status selection, response state, URL/element helpers and separate error renderers; global status renderers pending | fragment-html.md; port READMEs | rendering_cases.py: 163 checks for selectors, metadata, escaped HTML, parsed context, status/header/chrome, error projection, HEAD and cancellation; url_cases.py, check_types.py and check_docs.py |
| context | runtime/configProvider.ts, http.ts, tenantResolution.ts; BSB service.ts | Python context.py/C# Context.cs prototype: canonical scoped parse, host/port lookup and origin policy; Python null-active security gate blocked by AnyVali #127; host proxy middleware/full policy references pending | config.md §1; port READMEs | context_cases.py: isolation, priority, forged hints, duplicate/orphan identities, origin restrictions, owned copies; null-active-rejected fails on Python |
| cors | runtime/h3.ts; BSB service.ts | Native trusted-origin policy integrated into JSON/raw/HTML/finite hosts, with per-mount preflights before authentication | protocol.md §2; port READMEs | cors_cases.py: 33 checks; hosting_cases.py, raw_cases.py and rendering_cases.py: protected and fragment preflights, denied methods/origins, auth error headers and header ownership |
| allowlist | adapters/h3.ts appAllowsRoute | Native exact IDs/legacy IDs, path variants, enabled local instances and GET fragment/slot mounts; JSON hosts enforce operation-specific aliases and verified machine audiences | config.md §1; port READMEs | access_cases.py: 130 checks; hosting_cases.py adds wrong-local-target, method dispatch and rejected aliases |
| URLs | runtime/configProvider.ts, adapters/h3.ts; BSB service.ts | Native Urls on handler/render contexts: service aliases and exact instances, local/optional paths, app-mounted GET navigation, origin/param/query encoding, fragment/component/SSE selection, HTMX attributes, shell/service elements and route-token rewriting | docs/building/shell-links.md; port READMEs | url_cases.py: 232 shared/native checks; generated option compiler checks and executed documentation |
| jwt | runtime/auth/tokens.ts, jwtCrypto.ts, verifier.ts | Python security.py; C# Security.cs: six purposes, RS256 issuance/verification, strict headers, time and trust checks | auth.md §1; port READMEs | security_cases.py: cross-signature, wrong-purpose, time, issuer-audience, jku-x5u |
| jwks | runtime/auth/jwks.ts, keypair.ts | Python keys.py/C# Keys.cs: static RSA JWKS, remote cache, rotation/invalidation, bounded HTTP and cancellation; protected identity persistence in bootstrap.py/Bootstrap.cs | auth.md §1.1; port READMEs | key_cases.py: 80 checks, including native transport policy and cancellation |
| roles | adapters/h3.ts resolveUserRequestAuth | Native current role grants, trusted aliases and management-only elevation; JSON hosts bind aliases to the mounted operation; cross-service permission-target helpers pending | auth.md §1.2; port READMEs | authorization_cases.py and hosting_cases.py: revoked-role/grant/alias, root scope, caller modes and real JWKS requests |
| auth-helpers | runtime/auth/issuer.ts, externalOidc.ts, redirect.ts, envelope.ts | Partial: refresh pairs/scope binding and CP/setup purposes; installation binding is covered below; external bridge and redirects/cookies pending | auth.md; port READMEs | security_cases.py refresh-pair, envelope-purpose; authorization_cases.py refresh-helper purpose/issuer/audience/tenant/app |
| config-ticket | runtime/configTicket.ts, serviceConfig.ts | CP-signed ticket routes enforce issuer/service/actions, active tenant and configApps scope; management CORS, redaction, atomic writes and lifecycle integrated; Python null-active probe blocked by AnyVali #127 | config.md §4; port READMEs | security_cases.py and config_api_cases.py: 138/139 config HTTP checks, all-language issuers, scope revocation/races, dev opt-in and Node shared issuance-time regression |
| s2s | runtime/auth/serviceToken.ts; BSB service.ts | JSON hosts verify both delegated halves, partial/revoked envelopes and mounted machine audiences; native JSON clients bind user/service/delegated calls to current scope, mounts, contracts, requests, bindings, grants and registered signing identity | auth.md §3; port READMEs | security_cases.py, authorization_cases.py, hosting_cases.py and client_cases.py: wrong-peer, revocation, method/mode/permission/capability, scope, redirects, cookie isolation, transport bounds, cancellation and all receiver languages |
| local-config | runtime/configProvider.ts | Service accepts local ScopedConfig, validates atomic replacements and restores canonical snapshots through replaceable file storage; platform/environment authoring still pending | config.md §1; port READMEs | snapshot_cases.py: failed-save/cancellation/size/rename, concurrent updates, owned copies, cache interchange and live scope/auth/URL policy; hosting_cases.py: local scope |
| settings | runtime/configStore.ts, serviceConfig.ts | SettingsSchema compiles AnyVali contracts and preserves scopes/defaults/requiredness; ServiceSettings owns encrypted persistence with explicit legacy ownership; ConfigApi integrates authorized HTTP writes and effective handler/preview values | config.md §3; port READMEs | settings_cases.py: 130 checks for values, defaults, requiredness and sensitive policy; settings_store_cases.py: 70 for files, atomic failure, cancellation, migration and lifecycle; config_api_cases.py: API authorization, config/default/preview application and continued configuration with missing required values |
| encryption | runtime/configStore.ts | Python encryption.py/settings.py; C# Encryption.cs/Settings.cs: v1 read/v2-v3 write, native scrypt/AES-GCM and sensitive traversal, Node marker bridge, nested encryption/redaction and persisted encrypted caches | config.md §5; port READMEs | encryption_cases.py: 318 checks; settings_cases.py and settings_store_cases.py: all-language envelope/file interchange, nested ciphertext, tampering, imported metadata and ordinary-prefix preservation |
| preview | runtime/previewConfig.ts; BSB service.ts applyPreviewConfig | Native sensitive schemas and authenticated preview decryption; validate both scopes and unambiguous active target before persisting encrypted snapshot and atomically activating request-config overlay | config.md §5.1; port READMEs | encryption_cases.py; snapshot_cases.py: cross-language encrypted cache, failed-revision retention, scope rejection, removal and no plaintext persistence |
| sync | BSB service.ts connectToControlPlane; scopedConfigCache.ts | Native ControlPlaneSync: typed manifest projection, bounded/validated POST and SSE, atomic snapshots, reconnect/poll fallback, secure endpoints and shutdown | config.md §2; port READMEs | sync_cases.py: neutral HTTP peer plus actual Node config-manager/FileStorage; key registration, manifest commit, scopes, live policy, framing, bounds, redirects, cache/save failures and reconnect |
| readiness | BSB service.ts renderHealth/canReadHealthDiagnostics | Managed health requires current manifest acknowledgment and a persisted valid snapshot; restored cache stays unready, explicit CP denial/shutdown suspends readiness, transient failures retain valid policy; authorized diagnostics pending | protocol.md §1.1; port READMEs | hosting_cases.py, snapshot_cases.py and sync_cases.py: bootstrap, cache, failed save, denial/recovery, real-CP credential revocation and public-minimal; diagnostic authorization pending |
| lifecycle | BSB service.ts, bootstrapState.ts | Native ASGI lifespan and ASP.NET hosted service own installation/sync cancellation and service disposal; encrypted atomic bootstrap/identity storage | config.md §2; port READMEs | sync_cases.py: exact-loopback, redirect-denied, shutdown-no-retry, cancelled startup/storage failure and host lifetime; bootstrap_cases.py: file interchange, tampering, identity/redaction, atomic failure and cancellation |
| installation | BSB service.ts registerInstallEndpoint, validateTenantApp; CM setupTokens.ts | Native ServiceInstallation pins CP/service trust, redeems setup tokens, persists credentials/identity, activates config API and sync; replay/reconfiguration, instance pinning, signed/persisted tenant locks and restart | config.md §2.2; port READMEs | installation_cases.py: actual Node installer/config-manager plus native failure, scope, transport, concurrency, cancellation and readiness checks; Node credential logging regression |
| hostname-change | BSB service.ts registerHostnameChangeEndpoint; CM setupTokens.ts | Native ServiceInstallation confirms through the pinned CP, proves the current instance/address projection, atomically replaces the protected binding and resumes normal sync; configured address and credentials retain ownership | config.md §2.3; port READMEs | hostname_cases.py: 99 checks for real CP/Node/native lifecycle, pending readiness, forged headers, input/response bounds, revoked credentials, wrong instance/address, atomic failure, restart, concurrency and host/transport cancellation |
| streaming | runtime/stream.ts, streamHandler.ts | Python streaming.py/C# Streaming.cs: validated finite frames, derived schema, bounded buffered/NDJSON/SSE output and cancellation; finite.py/Finite.cs register typed finite handlers and stream renderers through existing host policy | streaming.md; port READMEs | stream_cases.py: 113 primitive checks; finite_cases.py: 344 host checks for buffered/NDJSON/SSE, typed shells/frames, limits/cancellation, input/mount/auth policy and manifest metadata |
| subscribers | runtime/sse.ts | Python sse.py/C# Sse.cs: validated scoped routes, replaceable transport, bounded local delivery, SSE encoding, tick render functions and shutdown; feeds.py/Feeds.cs bind typed feeds to the owning GET and enforce host authorization, exact renderer selection and cancellation | sse.md; port READMEs | sse_cases.py: 71 shared/native checks for isolation, overflow, validation, mutation, cancellation, shutdown, multiline wire data, render recovery and flushing; feed_cases.py: 161 checks for input/transport/event boundaries, scope/auth/mounts, fragments, backpressure, overflow and service/host shutdown |
| events | BSB service.ts webhook | Pending declared webhook emission through CP | manifest.md | payload-contract, idempotency, scope, declared-event-only |
| theme-helpers | BSB service.ts shell fragments; runtime/view.ts | Pending shell context/fragments/chrome helpers; reuse browser assets | docs/building/themes.md | shell-fragment-overrides, service-origin-map, Bootstrap-shell-example |
| discovery | runtime/llms.ts; BSB seo.ts, service.ts | Public health/manifest/schema JSON in native hosts; developer resources, AI/LLM discovery and SEO hooks pending | ai.md; protocol.md; port READMEs | hosting_cases.py: health/manifest/schema; public-resource-bounds, app-discovery, sitemap-visibility and robots pending |
| observability | contracts/observability.ts, runtime/traceContext.ts, h3.ts | Pending replaceable logging/tracing/metrics and safe diagnostics | protocol.md §4 | trace-propagation, outcome-status, secret-redaction |
| scaffold | codegen/init.ts, cli/bp.ts | Pending native commands with runnable examples | Port READMEs (pending) | scaffold-build-run, no-node-no-BSB |
| discovery-tools | codegen/scanner.ts, emitter.ts, validate.ts | Pending compiler-supported C# and module-based Python discovery | docs/building/routes-and-views.md | route-dirs, optional-params, stable-ID, renderer-fragment-SSE-selection |
| contract-tools | cli/project.ts, contract.ts, publish.ts | Pending betterportal.json, registry identity, local exports/publishing | docs/building/services.md | registry-identity, native-export, local-contract-resolution |
| dependency-clients | cli/client.ts; BSB service.ts authenticatedFetch | Native runtime and generated JSON clients use AnyVali documents and scoped credentials; native client CLI preserves typed method inputs/outputs and delegates policy to the runtime; raw/streaming clients, project locking and frozen builds pending | auth.md §3; port READMEs | client_cases.py: 210 checks, including four generated cross-language host pairs in user/service/delegated modes; check_clientgen.py compiles all three registry exports and rejects invalid callers; locking, frozen-build, digest-mismatch and two Node-generated outbound pairs pending |
| delivery | .github/workflows/ci.yml | Partial: Windows Python 3.10/3.13 and Linux Python 3.14 HTTP gates; Linux/Windows mypy/compiler checks, executed README examples, wheel/sdist/NuGet builds and embedded-corpus checks; CI matrix wired with strict conformance failure reporting | Port READMEs; conformance README | check_packages.py, check_docs.py, check_types.py, check_clientgen.py; hosted CI, CM+Bootstrap and two Node-generated client/server pairs pending |

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
  a default; all SDKs document a native-parent composition limitation (#133). Both
  expanded probes remain failing; BP portable composition passes its separate
  recursive and sensitive-field probes. Never accept dangling references or mask the
  presence defect with a second validator. Encryption primitives and preview
  sensitive traversal and encrypted persistence pass. Ticket-protected hosting passes
  except its Python null-active regression caused by AnyVali #127.
- AnyVali 1.1.1 also bypasses sensitive metadata on ref nodes in all SDKs (#128).
  The eighteen direct/roundtrip probes remain failing. Settings declarations reject
  that unsafe form; BP field visibility annotates a native wrapper. Metadata on
  referenced definitions is exercised separately. No SDK patch or second data
  validator is introduced.
- Python AnyVali 1.1.1 drops empty/from-string coercion on export (#134).
  Native direct parsing accepts the input; export/re-import rejects it. Both
  regressions remain in the strict shared gate, including their impact on
  typing derived from exported contracts.
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
here is limited to schema projection and development conformance artifacts.
