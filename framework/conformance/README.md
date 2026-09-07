# BP cross-language conformance

**The full .NET/Python framework delivery is incomplete.** This directory supplies
canonical AnyVali contracts, native adapters, HTTP schema/security fixtures, and a
capability ledger. Token and service-envelope interoperability is verified;
full theme helpers, route tooling and Bootstrap integration
remain delivery work. No packages are published.

## Recorded result

Published AnyVali **1.1.3** passes [1,474/1,482 schema scenarios](results-schema-local-discovery.json).
Each language runs 87 semantic cases and imports all 160 documents, then repeats
the cases with native export/reimport enabled. JavaScript and Python pass 494/494
each; C# passes 486/494. The eight C# failures cover unsupported semantic extensions
and informational metadata lost from extended export, including native-parent
composition ([AnyVali #141](https://github.com/BetterCorp/AnyVali/issues/141)).
Portable export correctly clears extension namespaces in all three SDKs.
The [Linux discovery-stage schema run](results-schema-local-discovery-linux.json)
matches every Windows outcome, including the same eight upstream failures.

The 28-suite [Windows 1.1.3 full run](results-combined-anyvali-1.1.3.json), recorded
before the workspace metadata document was added, passes
**5,750/5,758** using Node 24.4.0, Python 3.10.19 and .NET SDK 10.0.201/runtime
10.0.5. All 4,282 runtime scenarios pass; the only failures are the eight C# schema
extension checks above. The gate exits nonzero without skips or changed expectations.
The independent [Linux 1.1.3 full run](results-linux-anyvali-1.1.3.json) also records
**5,750/5,758** using Python 3.14.4, Node 24.4.0 and .NET SDK 10.0.400/runtime
10.0.11. Every case outcome and failure matches Windows after accounting for
ordering and assigned loopback ports. Both full runs were serialized without
concurrent compilers or other HTTP suites.
The 99 Node framework tests pass. Native compiler/type checks, generated clients
from all three registries, executable README examples and unpublished package
checks pass on Windows and Linux with 1.1.3. Linux also reruns the complete CLI
gate: 130 project/lock, 122 registry and 27 contract-export checks pass.

The earlier **1.1.2** [schema gate](results-anyvali-1.1.2.json) passed 1,446/1,446
before these five extension cases were added. That release fixed all 30 failures in the
[1.1.1 schema gate](results-anyvali-1.1.1.json): explicit null/default behavior,
sensitive references, recursive native-parent composition and Python coercion
export. The original [1.1.0 result](results-anyvali-1.1.0.json) remains historical evidence.

The historical 28-suite [Windows 1.1.2 full run](results-combined-anyvali-1.1.2.json) passes
**5,728/5,728** with Node 24.4.0, Python 3.10.19 and .NET SDK 10.0.201/runtime
10.0.5. It includes the later project/registry contracts and the settings checks
that replace obsolete sensitive-ref rejection. Both null-active security regressions
pass without changing their expectations. Windows and Linux compiler, CLI, executable
README and unpublished package checks also pass with 1.1.2.

The independent [Linux 1.1.2 full run](results-linux-anyvali-1.1.2.json) also passes
**5,728/5,728**, with matching case outcomes, using Python 3.14.4, Node 24.4.0
and .NET SDK 10.0.400/runtime 10.0.11. Both full runs were serialized without
concurrent compilers or other HTTP suites. Report ordering and two assigned
loopback-port IDs differ between platforms. Extension behavior was outside the
1.1.2 corpus and is now covered by the strict gate. Full framework delivery remains incomplete.

The security suite passes [459/459 scenarios](results-security.json): every
signing/verifying language pair, six token purposes, signature tampering,
issuer/audience/key checks, malformed claims/headers, config-ticket scope/actions,
refresh-role clearing, revoked service bindings/grants, caller mode, method,
permissions and tenant/app isolation. Setup installation binding is covered by the
installation suite below.
The [authorization suite](results-authorization.json) adds 306 passing checks:
current role and alias revocation, trusted management scope, caller modes, both
delegated credentials, refresh-helper purpose/scope checks, and native fail-closed
machine envelopes. Shared requests exercise Node's real H3 operation adapter.
Native-only cases cover standalone policies currently owned by BSB or stricter
port behavior; the fixture does not copy Node's private role-check implementation.
The [JWKS suite](results-keys.json) adds 80 passing checks: shared Node/port
key loading, cache/rotation and query compatibility, plus native endpoint policy,
redirect rejection, response bounds, total deadlines, cancellation and cache
invalidation. Native-only checks exercise APIs absent from Node's existing helper;
the suite does not replace Node policy with a test implementation.
The [encryption suite](results-encryption.json) passes 318 checks on Python 3.10:
all-language v2/v3 round trips, v1 legacy vectors, typed and empty secrets, unique
nonces, scope/path/key/tag tampering, imported sensitive fields, omitted optional
fields, malformed envelopes and native byte limits. Node calls its real persisted
store and preview helpers. Its empty-preview-secret length check is fixed with a
focused Node regression. This gate covers encryption primitives and preview
schema traversal; persistent settings and snapshots are covered separately below.
.NET dependencies are locked in [packages.lock.json](../dotnet/BetterPortal/packages.lock.json);
the Python probe dependencies are pinned in [requirements.txt](requirements.txt).

The [media suite](results-media.json) passes 124 checks: 16 shared scenarios per
language through the real Node helper, plus 38 native checks per port covering
q=0, specific exclusions, available offers, 406, quoted parameters and malformed
headers. HTTP quality and precedence follow [RFC 9110 section 12.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1).
JSON/metadata/HTML host integration is checked below.

The [finite stream suite](results-streams.json) passes 113 checks over real HTTP
buffered JSON/NDJSON/SSE and lifecycle probes: ordered validated items, optional/null
summary, one terminal, producer/validation errors, native frame/buffer limits,
pull backpressure, wire disconnects, early close and cancellation. Native buffered cancellation
propagates instead of returning partial success. Recursive response schema
composition is also checked. Finite HTML rendering and consumer operation hosting
are covered by the finite-operation suite below.

The [SSE subscription suite](results-sse.json) passes 71 checks: real Node/native
subscription fan-out, view/tenant/app isolation, queue overflow, reconnect without
history, input/event validation and idle cancellation. Native probes add payload
bounds, transport validation, immutable publication snapshots, mapper cancellation
and shutdown. The native transport interface is exercised by in-process delivery;
no external broker or cross-replica broadcast is supplied. Real HTTP SSE checks
cover multiline/empty data, Unicode, names, IDs and retry. Native probes add
injection/byte bounds, ID reset, rendered tick failures followed by recovery,
renderer cancellation and owned subscription cleanup. The .NET writer verifies
flush backpressure and uses the platform formatter. H3 omits empty IDs; the ports
preserve the standard reset behavior. Host authorization and renderer selection
are covered by the subscriber feed suite below.

The [context suite in the 1.1.2 full run](results-combined-anyvali-1.1.2.json) passes 103/103 checks for host/port isolation, service/theme
address priority, forged hints, host-verified proxy addresses, duplicate/orphaned
identities, configuration-only app separation, origin/referer restrictions and
snapshot-copy ownership. Python now rejects an explicit null tenant flag, with
the original `null-active-rejected` expectation unchanged. Full policy reference
validation remains delivery work.

The [CORS suite](results-cors.json) passes 33 checks over actual OPTIONS/GET
responses: preflight without bearer validation or handler execution, required and
custom headers, origin reflection, native origin/method denial, malformed/bounded
header lists and Vary. Node shared cases call the framework's existing H3 helper;
native-only denial checks exercise policy currently owned by BSB. JSON hosting
and protected-route integration are checked in the hosting suite below.

The [handler suite](results-handlers.json) passes 44 checks for per-field
params/query/headers/body validation, defaults, coercion, recursive requests,
unknown-key handling, invalid output and cancellation. Node shared cases invoke
the real H3 operation adapter and `createHandler`. The ports preserve null/array
bodies and repeated query values that Node's older parsing flattens; the native
hosts exercise this decoding in the hosting suite. Compiler checks
reject mismatched handler input/output types and verify generated model parsing.

The [registry suite](results-registry.json) passes 89 checks for native operation,
route and manifest registration: canonical defaults, explicit auth, stable IDs,
per-method schemas/policies, dependency aliases, local targets, config admin APIs,
API contract bindings and schema interchange across every language pair. Node
shared cases use its actual manifest and discovery builders. Native-only cases
reject duplicate or ambiguous routes and unsafe paths, and publish API contracts
once for optional path variants; Node currently duplicates those descriptors.
Authoring declarations are portable projections of the canonical wire contracts,
excluding derived fields. Finite registration is covered below; route-directory
discovery remains delivery work.

The [mount access suite](results-access.json) passes 130 checks. Shared scenarios
invoke Node's real H3 operation adapter for selected operation IDs, legacy IDs,
path variants, disabled mounts, GET fragments/slots, tenant/app separation and
well-known endpoints. Native checks additionally reject mounts belonging to
another service instance, disabled/unregistered local services and malformed
service paths. Permission aliases are limited to enabled local instances referenced
by the current app. The catalog fields `appRoutes`/`appFragments` do not authorize
inbound calls. JSON host integration is checked below.

The [hosting suite](results-hosting.json) passes 222 checks through the public
Starlette ASGI and ASP.NET Core adapters, with shared Node cases using its H3
router, manifest builder, context/origin helpers and JWT/JWKS verifier. It covers
JSON/metadata, method-specific routes, optional paths, static precedence,
bounded bodies, UTF-8, repeated/case-sensitive query and form fields, multipart
uploads, minimal health, discovery, error representations and cancellation.
The native hosts authorize metadata without executing handlers; Node currently
executes the handler before metadata negotiation. Cancellation probes use a
handler-start handshake instead of a timing race.
The same 222 checks pass with [Python 3.13](results-hosting-python313.json).

Every signing language calls every host with user tokens and current role policy.
Native service/delegated checks also bind verified token audiences and permission
aliases to the local instance mounting the requested operation. Preflights run
before bearer authentication, and authorization errors preserve trusted CORS
headers. These are prototype hosts with replaceable snapshots: authorized diagnostics,
full theme helpers and full helper contexts
remain delivery work.

The [raw-response suite](results-raw.json) passes 101 checks. Shared cases use the
real Node `createRawHandler`/H3 adapter and both native hosts for binary data,
status/body rules, downloads, cookies, discovery, input validation and operation
denial. Native probes cover header injection, CORS ownership, HEAD stream disposal,
incorrect JSON/raw returns, and streamed error/cancellation cleanup. Gated output
checks backpressure without timing guesses; an ASGI 2.4 disconnect probe cancels
a waiting producer. Raw operations intentionally bypass Accept negotiation.
The [Python 3.13 raw gate](results-raw-python313.json) passes the same 101 checks.

The [rendering suite](results-rendering.json) passes 163 checks through H3 and the
native hosts: page/fragment/embed, exact app/method renderer selection, components,
Accept/query selectors, metadata/manifests, parsed context defaults/coercion,
status/header controls, chrome metadata, HEAD and safe errors. Native probes add
ambiguous-selector denial, fragment preflights, error callbacks preserving the
selected fragment/component, and async renderer cancellation. Five portable AnyVali
documents define author declarations and presentation/error data; native types
derive from them. Compiler checks reject private context fields and non-HTML
results. The [Python 3.13 rendering gate](results-rendering-python313.json) runs the
same cases. Browser resource integration and global status renderers remain
delivery work. Finite stream HTML is covered below.

The [finite-operation suite](results-finite.json) passes 344 checks through real
H3, Starlette and ASP.NET registrations. One validated producer supplies bounded
buffered JSON/HTML, NDJSON and the owning GET operation's SSE endpoint. Shared
cases cover ordered frames, nullable/omitted summaries, errors, input rejection,
optional paths, exact themes, stream shells, buffered fragments/components,
manifest schemas, URL rewriting and all-language JWT verification. Native cases
also cover HEAD without starting producers, backpressure, cancellation, safe
render failures, fragment-only mount denial and revoked delegated grants. The
same [Python 3.13 gate](results-finite-python313.json) runs 344 checks. The canonical
stream-shell document generates typed callback contexts. Request metadata remains
lightweight; full streaming schemas are published in the manifest. Existing Node
query parsing retains the last repeated value and encoded path parameters; ports
preserve repeated values and decode parameters while all hosts preserve the SSE
connection URL.

The [subscriber feed suite](results-feeds.json) passes 161 checks through H3,
Starlette and ASP.NET registrations. Native `SseFeed` binds an existing typed GET
handler to a scoped `SseRoute` without executing the GET function. Checks cover
publication input, event validation, corruption at the transport boundary, bounded
queues, per-request backpressure, cancellation during subscribe/map/render, service
and host shutdown, exact fragment/theme selection, safe HTML context, URL rewriting,
input schemas, operation mounts and all-language JWT issuers with role/grant revocation.
The same suite runs on [Python 3.13](results-feeds-python313.json). Declaration guards
and typed publications are checked by native compilers. No shared broker, event
history or cross-replica delivery is claimed. Node-specific omissions (header schema
validation, tick rewriting, 406 on missing tick and render-error recovery) are recorded
in the ledger and are covered by native checks rather than copied into the ports.

The [URL suite](results-urls.json) passes 232 checks, also exercised on
[Python 3.13](results-urls-python313.json). Handler/renderer calls use real hosts
for local/optional service routes, app GET-page navigation, aliases, exact service
instances, fixed params, query/Unicode encoding, origin selection, HTMX attributes,
shell/service elements and route-token rewriting. Native guards reject ambiguous
or unsafe destinations and preserve the app origin in error callbacks. Invalid
service URL cases verify rejection either by AnyVali at snapshot import or by the
helper when the SDK accepts the address. Four portable contracts define the URL
options and element interfaces. C# generation supports direct primitive values in
union wrappers; AnyVali still performs all schema validation.

The [snapshot suite](results-snapshots.json) passes 125 checks, also run on
[Python 3.13](results-snapshots-python313.json). Native service probes exercise
file persistence, rename failures, size limits, owned copies, serialized updates,
cancelled/failed saves, shutdown, encrypted preview revisions and cache restoration
without readiness. Node supplies real JWT and preview ciphertext interoperability;
it also validates the native cache wire documents. These probes do not substitute
a fake Node sync controller. Requests after updates see current mounts, origins,
URLs and role/key policy; in-flight authentication rejects a retired snapshot while
request cancellation remains cancellation.

The [sync suite](results-sync.json) passes 132 checks for native manifest POST, SSE/poll
fallback and hosting lifetime. The portable submission contract projects the
existing CP cache fields and preserves method-specific schemas, fragments, keys
and optional provider metadata. Checks cover failed startup, readiness after
credential denial versus transient errors, reconnect submission, cache/save
failures, live policy revocation, shutdown/startup cancellation, exact loopback
policy, redirect refusal, strict UTF-8/JSON, bounded payloads and SSE framing.
Both ports also connect to the existing Node config-manager's registered H3
handlers and real file store: RSA registration, tenant-scoped projection,
persisted manifest acceptance, live route changes and credential revocation.
The test-only Node peer does not reimplement those policies. Bootstrap shell
integration remains delivery work; installation is covered below.
The earlier 130-check sync gate also passes on [Python 3.13](results-sync-python313.json);
the two new shutdown/storage-error races are included in the full Python 3.10 run.

The [settings suite](results-settings.json) passes 130 checks for scoped field declarations, native defaults/coercion,
recursive values, nested unknown-key policies, Node-compatible top-level envelopes,
native nested encryption, redaction and secret-preserving merges. It rejects
unauthenticated ciphertext, mismatched field declarations, secret placeholders
without stored values, and attempts to move preserved secrets into a public union
branch. Required secret fields retain their requiredness, including recursive refs;
partial overrides omit defaults while full effective values apply them.
The earlier [Python 3.13 result](results-settings-python313.json) records the
1.1.1 settings checks before native sensitive-ref support replaced its rejection probes.

The [settings persistence suite](results-settings-store.json) passes 70 checks:
encrypted tenant/app files read across all nine language pairs, stored overrides
versus effective defaults, mutation ownership, restart, concurrent writes, failed
saves, cancellation and shutdown. Malformed state, wrong field scopes, plaintext
secrets and tampered app ciphertext prevent the whole cache from becoming readable.
Legacy encrypted files require an explicit tenant owner; migration must persist
before readiness and preserves old bytes on failure/cancellation. Node probes use
its real file store. Native stores enforce the additional field/ownership policy.
The same suite runs on [Python 3.13](results-settings-store-python313.json).

The [config API suite in the 1.1.2 full run](results-combined-anyvali-1.1.2.json) passes 139/139 checks through actual
Node config routes, ASGI and ASP.NET hosts. Node probes invoke its BSB-owned ticket
and scope methods; they do not substitute copied authorization policy. Tickets from
all three issuers read/write scoped encrypted settings. Native checks add management
CORS, HEAD, input/media bounds, atomic clear/save failure, cancellation, shutdown,
explicit development-token opt-in, missing required settings, and effective handler
config. Snapshot changes during authentication reject the request; updates during a
settings write wait for its commit. Preview values from every language validate
before publication, overlay only their target, and never overwrite stored settings.
The Python null-active config-authorization regression now passes with AnyVali 1.1.2.
The suite also exposed future-issued config tickets accepted by Node; its shared
verifier now checks issuance/lifetime, with a focused Node regression test.
The earlier [Python 3.13 result](results-config-api-python313.json) retains the
1.1.1 null-active failure.

The [bootstrap persistence suite](results-bootstrap.json) passes 147/147 checks of the actual Node
BSB encrypted file format against both native stores. It covers unique nonces,
every cross-language decrypt, tampering, native strict JSON/encoding/master-key
validation, public/private identity matching, sensitive redaction, restart,
concurrent patch preservation, size limits and failed/cancelled writes. Native
identities live in the encrypted state's optional `identity` extension; Node
preserves it but still loads its own S2S identity from a separate file. Private
PEM data in a public field, including appended content, is rejected. The host
supplies the protected master key. The same 147 checks pass on
[Python 3.13](results-bootstrap-python313.json).

The [installation suite](results-installation.json) passes 137/137 checks. It uses the actual Node BSB
installer and config-manager setup/redeem/sync routes, with setup signatures from
all three languages. Native checks additionally cover pinned CP/service trust,
malformed/oversized responses, redirects, deadlines, protected atomic credentials,
replay, reconfiguration, settings activation, restart, failed startup/sync and
snapshot instance binding. Signed tenant locks cover operations, preflights and
config tickets. Cancellation checks block JWKS, redemption, credential persistence
and initial sync; a committed rotation can resume without redeeming again. Actual
ASGI/ASP.NET shutdown also cancels blocked JWKS, redemption and initial sync requests.
The Node fixture exposed an installer console message containing the CP API key;
that redundant message is removed, and credential logging is a failing regression
condition. Node's legacy API-key response and first-request tenant claim are not
native compatibility requirements. The earlier 131 installation checks also pass on
[Python 3.13](results-installation-python313.json).

The [hostname suite](results-hostname.json) passes 99 checks. It drives the real
Node config-manager confirmation flow and the three service hosts, preserving
credentials and signing identity across confirmation and restart. Native checks
add configured-origin pinning, unready address changes, opaque-token validation,
current instance/address proof after confirmation, bounded responses, a shared
confirmation/projection deadline, atomic local persistence and cancellation.
CP failures, redirects, stale credentials, wrong instances and forged forwarding
headers cannot replace the local binding. Host shutdown cancels both confirmation
and projection. A consumed CP token cannot undo a successful local change.

The [scoped client suite](results-clients.json) passes 210 checks. Native clients
import all three languages' exported contracts, validate method-specific inputs
and outputs with AnyVali, and call each other language's host in user, service and
delegated modes. The Node machine receiver uses the existing BSB-owned envelope
and service-token policy. Checks cover aliases, current mounts/bindings/grants,
registered keys, tenant/app isolation, optional paths, body presence/defaults,
coercion, reserved headers, cookie isolation, redirects, response/request limits,
compression rejection, snapshot retirement and cancellation/shutdown. These are
runtime and generated JSON clients. Native generated clients call each other
language's host in all three authentication modes and retain alias, grant,
snapshot and cancellation policy. Raw/streaming dependency calls and the two
Node-generated outbound client pairs remain delivery work.

`check_clientgen.py` exports a shared service through all three registries and
runs both native generators against each contract. Positive/negative compiler
checks cover GET/POST schemas, required/defaulted inputs, optional routes, nullable
fields, recursive JSON, independently scoped definitions and symbol collisions.
The checked-in HTTP client fixtures are regenerated with `--write-fixtures`;
normal verification detects drift. The same native CLI commands validate stale
files and reject invalid contracts/names. No Node process is required by a
consumer's native generation command.

`check_projects.py` passes 216 native CLI and Node compatibility checks on
Windows and Linux. Native local installation preserves `betterportal.json`
identity, resolves exact contract identities/versions, caches original UTF-8 bytes,
and generates typed clients. Frozen builds validate every pin before generating;
`--check` rejects stale source without writing. The shared `json-bytes` lock format
uses SHA-256 without locale-dependent serialization. Node accepts these pins and
retains its legacy locks; native migration requires explicit installation and
preserves aliases sharing the old cache. Corrupt caches, changed selectors,
missing pins and colliding native filenames fail verification. Seven canonical
AnyVali documents define project/lock data and workspace metadata.
Automatic discovery covers literal workspaces, sibling projects, installed/scoped
Node packages and `BP_DEV_PATHS`, including development paths to `node_modules`.
Each source is checked against the real Node CLI. Native cases also verify exact
versions, duplicate exports, ambiguous identities/content, invalid candidates,
explicit path errors and frozen isolation. Automatic candidates require a declared
registry identity; discovery never executes application code. Workspace glob
entries remain unsupported, as in Node; explicit development paths cover those layouts.

`check_registry_tools.py` passes 128 CLI checks on Windows and Linux against the real Node
registry handler and file store, plus explicitly separate hostile HTTP fixtures.
Both native tools publish identical contracts idempotently, resolve full references,
plugin IDs and short names, fetch requested versions, and pin exact response bytes.
Checks cover immutable versions, permanent identity bindings, publisher prefixes,
missing credentials, malformed/oversized responses, redirects, cookie/credential
isolation and total deadlines against trickling responses. After the registry
process stops, every installed client still verifies through an offline frozen build.
Local discovery performs no registry requests when an exact match exists. A missing
local version falls back to the registry, removes stale local-lock metadata, and
retains the requested version. Explicit `--registry` bypasses matching local exports.
Two shared AnyVali documents describe registry catalog and publication responses.
No remote registry or package release is performed by these tests.

`check_export.py` passes 27 checks on Windows and Linux. Native commands export
actual registry factories from Python packages and compiled ASP.NET Core applications,
including relative module imports and a separate managed assembly dependency. Factories use
the runtime's schema builders; request handlers are never executed by discovery.
Checks cover stable `--check` output, invalid signatures/results, missing factories,
16 MiB bounds, preservation on failure and both native consumers of each export.
The C# command loads compiled metadata and does not parse source. These explicit
factory commands are separate from the still-pending route-directory discovery tools.
C# README examples compile and run under the Web SDK so its implicit imports are
included; route construction explicitly names `BetterPortal.Route`.

The following upstream regressions are fixed in AnyVali 1.1.2. Their original
expectations remain in the shared gate.

| Fixed regression | Evidence | Required behavior |
|---|---|---|
| Python replaces explicit null with a default | default-present-null, lock-null-dependencies and their round trips | Null is present and must fail when the schema is not nullable. |
| A new native parent loses its imported child's recursive definitions (all SDKs) | recursive-composition and its round trip | Composed portable contracts must retain every referenced definition. |
| Sensitive metadata directly on ref nodes is ignored (all SDKs) | sensitive-ref encrypt/decrypt/plaintext rejection, direct and roundtrip | Native transforms must visit sensitive refs and encrypted validation must reject plaintext. |
| Python drops empty/from-string coercion on export | coerce-int-empty and coerce-int-from-string round trips | Re-import must preserve coercion and the accepted input types. |

[AnyVali #127](https://github.com/BetterCorp/AnyVali/issues/127),
[#128](https://github.com/BetterCorp/AnyVali/issues/128),
[#133](https://github.com/BetterCorp/AnyVali/issues/133) and
[#134](https://github.com/BetterCorp/AnyVali/issues/134) are resolved. Direct and
native export/reimport probes pass in every language. Settings use native
sensitive-reference transforms without the previous rejection or union wrapper.
BP retains portable document composition to preserve extension metadata, check
document versions and copy inputs; it is not an SDK validation replacement.
Packages contain no alternate validator or monkeypatch.

AnyVali 1.1.3 resolves the JavaScript/Python extension defects in
[#139](https://github.com/BetterCorp/AnyVali/issues/139). Five shared schema cases now
exercise unsupported semantic namespaces (including `default`), explicit/default
informational criticality, portable versus extended exports and native-parent
composition. Each case runs in every SDK, with round-trip variants and no waivers.
C# still accepts semantic namespaces and loses extended metadata, tracked in
[#141](https://github.com/BetterCorp/AnyVali/issues/141) with a standalone NuGet
reproduction. These eight failures keep both schema and full gates nonzero.
At the 1.1.3 upgrade, all 159 canonical BP documents had empty extensions and their
generated types were unchanged. Generated peer clients were refreshed for Python's explicit empty
`extensions` map. BP's document-composition helper does not implement extension semantics.

Supplemental positive documents are generated by native Node schema authoring.
[export-fixtures.mjs](export-fixtures.mjs) first verifies the expected behavior
before interchange. Direct portable dependency regressions also remain in the
corpus when the SDK itself fails their expected semantics. Encryption callbacks deliberately use reversible test
markers to observe sensitive traversal; these are **not cryptographic fixtures**
and never ship as encryption implementations.

The full gate returns nonzero for any failed probe. The independent security
suite can run separately. Never change failing expectations
to reproduce SDK defects or infer framework completeness from a package build.

## Run from the repository root

Use Node with the workspace dependencies installed, .NET 10, and Python 3.10+.
Earlier 1.1.1 runs used Node 24.4.0, .NET SDK 10.0.201, and Python 3.13.5 and 3.10.19 on
Windows. Both Python versions returned the original eight SDK failures. The client-generator checkpoint's
[combined Python 3.10 results](results-combined-anyvali-1.1.1.json) passes 5,530/5,560
checks across twenty-eight suites. Failures are the original SDK probes, the
context/config null-active regressions, eighteen sensitive-ref regressions and
two Python coercion-export regressions.
This combined report records one serialized run, including subscriber feeds,
finite operations, hostname changes, runtime/generated clients, installation and
sync cancellation regressions. Its 30 failure identities are the previous 28 plus
the two newly isolated AnyVali #134 regressions.
The [Linux Python 3.14.4 run](results-linux-anyvali-1.1.1.json), using Node 24.4.0
and .NET SDK 10.0.400/runtime 10.0.11, passes the same 5,530/5,560 checks with
exactly the same 30 failure identities. It ran from a separate copy of this
checkpoint on the native Linux filesystem; compiler, executable documentation and
package checks also passed there.

The later project-tooling stage adds six documents and fifteen schema cases.
Its separate Windows and [Linux schema runs](results-project-schema-linux.json)
pass 1,374/1,404 checks. The two additional failures reproduce #127 with a
defaulted dependency record. The combined reports above remain the actual
client-generator checkpoint runs, not a merge with these later schema results.
Project tooling, compiler checks, README examples and package builds also pass
on Linux at this stage.

The subsequent registry-tooling stage adds two documents and five schema cases.
Its Windows and [Linux schema gates](results-registry-schema-linux.json) pass
1,416/1,446 with exactly the preceding 30 failure identities; no new SDK failures
were introduced. Native compiler, local-lock and generated-client regressions,
README execution and unpublished package checks also pass on Linux. The earlier
full runtime reports remain unchanged because this stage changes authoring
commands and contracts.

The conformance executable uses workstation GC for its small sequential probes.
Diagnostics on Windows identified a 2.875-second server-GC pause during a
two-second shutdown assertion. The fixture also reuses each host's bootstrap
store instead of deriving its encryption key again for every state inspection.
The runtime checks pass with the original deadlines and no tracing enabled;
consumer packages do not select a GC mode.

Installation lifecycle probes check readiness immediately after the successful
poll, then wait for the initial SSE snapshot before unrelated operation/replay
assertions. The Linux client-stage run exposed that missing synchronization:
an initial SSE replacement correctly retired an authenticating request with 503.
The fixture now waits on the existing update counter; request revocation checks
and runtime readiness rules are unchanged.

The [CI ports job](../../.github/workflows/ci.yml) runs Python 3.10 and 3.14 on
Linux with .NET 10, checks canonical exports and native types, executes README
examples, builds and checks unpublished packages, then runs the full HTTP gate.
It retains packages and the JSON report even when conformance fails. Any SDK or
framework regression fails the job; no probes are waived. The workflow has
been validated locally but has not run on the hosted runner: this branch has not
been pushed.

```sh
npm ci --workspaces --include-workspace-root
npm run build --workspace @betterportal/plugin-bsb
npm run build --workspace @betterportal/config-manager
npm run build --workspace @betterportal/registry
node framework/conformance/export-contracts.mjs --check
node framework/conformance/export-fixtures.mjs --check
node framework/conformance/export-encryption-fixtures.mjs --check
python -m pip install -r framework/conformance/requirements-ci.txt
dotnet restore framework/dotnet/Conformance --locked-mode
dotnet build framework/dotnet/Conformance --no-restore
python framework/conformance/verify.py --roundtrip-all --report results.json
python framework/conformance/verify.py --suite security
python framework/conformance/verify.py --suite keys
python framework/conformance/verify.py --suite encryption
python framework/conformance/verify.py --suite authorization
python framework/conformance/verify.py --suite media
python framework/conformance/verify.py --suite streams
python framework/conformance/verify.py --suite sse
python framework/conformance/verify.py --suite context
python framework/conformance/verify.py --suite cors
python framework/conformance/verify.py --suite handlers
python framework/conformance/verify.py --suite registry
python framework/conformance/verify.py --suite access
python framework/conformance/verify.py --suite hosting
python framework/conformance/verify.py --suite raw
python framework/conformance/verify.py --suite rendering
python framework/conformance/verify.py --suite urls
python framework/conformance/verify.py --suite snapshots
python framework/conformance/verify.py --suite sync
python framework/conformance/verify.py --suite settings
python framework/conformance/verify.py --suite settings-store
python framework/conformance/verify.py --suite config-api
python framework/conformance/verify.py --suite bootstrap
python framework/conformance/verify.py --suite installation
python framework/conformance/verify.py --suite hostname
python framework/conformance/verify.py --suite clients
python framework/conformance/verify.py --suite finite
python framework/conformance/verify.py --suite feeds
```

If AnyVali is installed in a separate virtual environment, pass its interpreter
to verify.py using --python. The orchestrator itself uses only the standard
library. It launches disposable servers on available loopback ports, runs the
same HTTP requests against each, and stops all children even on failures.
The adapters accept arbitrary schemas and supply test signing actions; never
mount them on a consumer application's public surface. Raw test signatures
intentionally bypass claims validation to exercise verification of authentic
signatures over invalid claims. They are not runtime signing APIs.
Both runners accept `--suite schema|security|keys|encryption|authorization|media|streams|sse|context|cors|handlers|registry|access|hosting|raw|rendering|urls|snapshots|sync|settings|settings-store|config-api|bootstrap|installation|finite|feeds|all` (default: all).
Runtime identities are discovered from the test adapters when `--labels` is
omitted; explicit labels must be `node`, `python` or `dotnet`. This prevents
unlabelled Node adapters from accidentally running native-only API checks.

The HTTP runner can also target independently launched adapters:

```sh
python framework/conformance/run.py http://127.0.0.1:8310 http://127.0.0.1:8311 http://127.0.0.1:8312 --all-contracts --roundtrip-all
```

## Regenerate development artifacts

```sh
npm run build --workspace @betterportal/framework
npm run build --workspace @betterportal/config-manager
npm run build --workspace @betterportal/plugin-bsb
node framework/conformance/export-contracts.mjs
node framework/conformance/export-fixtures.mjs
node framework/conformance/export-encryption-fixtures.mjs
```

The exporter reads all canonical BP schemas from the compiled Node framework.
It includes the existing recursive JSON definition and exports bounded platform
menu schemas natively, without applying application-data depth limits to schema
documents. The scoped schema is derived from platform fields in
[scopedConfig.ts](../nodejs/src/contracts/scopedConfig.ts).

These JSON files are the shared source for subsequent native type generation.
Node is a repository development tool here; consumer wheels/NuGet packages must
embed the artifacts and must never invoke Node or BSB during build or runtime.
The .NET assembly and Python wheels/source distributions embed the corpus.
Python also supports direct repository imports for development. Native type
generators project these documents into C# input/output types and Python typing
declarations. Run `check_types.py` after building `BetterPortal.Tool` to check
generation drift, positive/negative compiler checks, recursive aliases, defaults,
field presence, union wire preservation and custom application documents.
`.gitattributes` fixes LF for canonical JSON so
byte-for-byte checks remain stable on Windows.

## Native package checks

```sh
python -m pip install -r framework/conformance/requirements-ci.txt
dotnet restore framework/dotnet/BetterPortal.Tool --locked-mode
dotnet build framework/dotnet/BetterPortal.Tool --no-restore
python framework/conformance/check_types.py
python framework/conformance/check_clientgen.py
python framework/conformance/check_projects.py
python framework/conformance/check_registry_tools.py
python framework/conformance/check_export.py
python framework/conformance/check_docs.py
dotnet pack framework/dotnet/BetterPortal --no-restore --output .tmp-run/ports-packages
dotnet pack framework/dotnet/BetterPortal.Tool --no-restore --output .tmp-run/ports-packages
dotnet pack framework/dotnet/BetterPortal.AspNetCore --no-restore --output .tmp-run/ports-packages
python -m build framework/python --no-isolation --outdir .tmp-run/ports-packages
python framework/conformance/check_packages.py .tmp-run/ports-packages
```

The package check compares every wheel/sdist document byte for byte, then imports
the wheel directly to exercise recursive parsing, RSA and ASGI health without Node
or the source tree. `--follow-untyped-imports` lets mypy inspect AnyVali, whose
wheel lacks py.typed. These checks passed on Windows and Linux.

## Remaining delivery

[CAPABILITIES.md](CAPABILITIES.md) maps the full requested scope to existing BP
code, documentation, implementation status, and required acceptance scenarios.
It distinguishes implemented fixtures from planned tests. The rest of the
HTTP suite (global theme helpers,
authorized diagnostics and streaming/generated Node clients) and standalone examples remain
incomplete. CI is wired but awaits a hosted run.
Publishing and BSB plugins remain separate follow-ups.
