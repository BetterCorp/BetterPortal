# BP cross-language conformance

**The full .NET/Python framework delivery is incomplete.** This directory supplies
canonical AnyVali contracts, native adapters, HTTP schema/security fixtures, and a
capability ledger. Token and service-envelope interoperability is verified;
request hosting, route tooling, persistent configuration and Bootstrap integration
remain delivery work. No packages are published.

## Recorded result

Published AnyVali **1.1.1** passes [928/936 schema scenarios](results-anyvali-1.1.1.json).
Each language runs 27 semantic cases and imports all 129 documents, then repeats
every case after native export/reimport. It fixes every failure in the original
1.1.0 gate ([337/432](results-anyvali-1.1.0.json)), including sensitive metadata,
Python wire field names, .NET null defaults and recursive root round trips.

The security suite passes [459/459 scenarios](results-security.json): every
signing/verifying language pair, six token purposes, signature tampering,
issuer/audience/key checks, malformed claims/headers, config-ticket scope/actions,
refresh-role clearing, revoked service bindings/grants, caller mode, method,
permissions and tenant/app isolation. Setup installation binding remains
acceptance work.
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
schema traversal; it does not claim persistent settings or atomic snapshots.
.NET dependencies are locked in [packages.lock.json](../dotnet/BetterPortal/packages.lock.json);
the Python probe dependencies are pinned in [requirements.txt](requirements.txt).

The [media suite](results-media.json) passes 124 checks: 16 shared scenarios per
language through the real Node helper, plus 38 native checks per port covering
q=0, specific exclusions, available offers, 406, quoted parameters and malformed
headers. HTTP quality and precedence follow [RFC 9110 section 12.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1).
Rendering and host integration remain pending.

The [finite stream suite](results-streams.json) passes 113 checks over real HTTP
buffered JSON/NDJSON/SSE and lifecycle probes: ordered validated items, optional/null
summary, one terminal, producer/validation errors, native frame/buffer limits,
pull backpressure, wire disconnects, early close and cancellation. Native buffered cancellation
propagates instead of returning partial success. Recursive response schema
composition is also checked. Finite HTML rendering and operation hosting remain
pending; these test adapters are not consumer hosts.

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
remain pending.

The [context suite](results-context.json) passes 102/103 checks for host/port isolation, service/theme
address priority, forged hints, host-verified proxy addresses, duplicate/orphaned
identities, configuration-only app separation, origin/referer restrictions and
snapshot-copy ownership. Its Python `null-active-rejected` scenario remains
failing: AnyVali #127 turns an explicit null tenant flag into `true`. This is the
same upstream default defect at a security boundary; the prototype is not safe
to deploy until it is fixed. Full policy reference validation,
atomic storage and actual proxy middleware remain delivery work.

The [CORS suite](results-cors.json) passes 33 checks over actual OPTIONS/GET
responses: preflight without bearer validation or handler execution, required and
custom headers, origin reflection, native origin/method denial, malformed/bounded
header lists and Vary. Node shared cases call the framework's existing H3 helper;
native-only denial checks exercise policy currently owned by BSB. Full operation
hosting and protected-route integration remain pending.

The [handler suite](results-handlers.json) passes 44 checks for per-field
params/query/headers/body validation, defaults, coercion, recursive requests,
unknown-key handling, invalid output and cancellation. Node shared cases invoke
the real H3 operation adapter and `createHandler`. The ports preserve null/array
bodies and repeated query values that Node's older parsing flattens; HTTP decoding
in the native hosts remains pending. Compiler checks
reject mismatched handler input/output types and verify generated model parsing.

The [registry suite](results-registry.json) passes 89 checks for native operation,
route and manifest registration: canonical defaults, explicit auth, stable IDs,
per-method schemas/policies, dependency aliases, local targets, config admin APIs,
API contract bindings and schema interchange across every language pair. Node
shared cases use its actual manifest and discovery builders. Native-only cases
reject duplicate or ambiguous routes and unsafe paths, and publish API contracts
once for optional path variants; Node currently duplicates those descriptors.
Authoring declarations are portable projections of the canonical wire contracts,
excluding derived fields. Renderer/raw/stream registration and route-directory
discovery remain delivery work.

| Failure | Evidence | Consequence |
|---|---|---|
| Python replaces explicit null with a default | default-present-null and its round trip | Null is present and must fail when the schema is not nullable. |
| A new native parent loses its imported child's recursive definitions (all SDKs) | recursive-composition and its round trip | Composed portable contracts must retain every referenced definition. |

AnyVali documents the native-parent composition limitation. BP now provides
portable document composition before native import; recursive and sensitive
composition probes pass in all three languages. The original native-parent probe
remains visible. The explicit-null defect is tracked in
[AnyVali #127](https://github.com/BetterCorp/AnyVali/issues/127). BP packages
contain no alternate validator or monkeypatch. The obsolete pre-1.1.1 SDK patch
has been removed.

The supplemental documents are generated by native Node schema authoring.
[export-fixtures.mjs](export-fixtures.mjs) first verifies the expected behavior
before interchange. The encryption callbacks deliberately use reversible test
markers to observe sensitive traversal; these are **not cryptographic fixtures**
and never ship as encryption implementations.

The full gate intentionally returns nonzero while those probes fail. The
independent security suite can run separately. Never change failing expectations
to reproduce SDK defects or infer framework completeness from a package build.

## Run from the repository root

Use Node with the workspace dependencies installed, .NET 10, and Python 3.10+.
Recorded runs used Node 24.4.0, .NET SDK 10.0.201, and Python 3.13.5 and 3.10.19 on
Windows. Both Python versions returned the original eight SDK failures. The latest
[combined Python 3.10 run](results-combined-anyvali-1.1.1.json) passes 2,667/2,676
checks across twelve suites. Failures are those original SDK probes plus the
context-level null-active regression for the same Python default defect.
Linux execution is still acceptance work.

```sh
npm run build --workspace @betterportal/framework
node framework/conformance/export-contracts.mjs --check
node framework/conformance/export-fixtures.mjs --check
node framework/conformance/export-encryption-fixtures.mjs --check
python -m pip install -r framework/conformance/requirements.txt
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
```

If AnyVali is installed in a separate virtual environment, pass its interpreter
to verify.py using --python. The orchestrator itself uses only the standard
library. It launches disposable servers on available loopback ports, runs the
same HTTP requests against each, and stops all children even on failures.
The adapters accept arbitrary schemas and supply test signing actions; never
mount them on a consumer application's public surface. Raw test signatures
intentionally bypass claims validation to exercise verification of authentic
signatures over invalid claims. They are not runtime signing APIs.
Both runners accept `--suite schema|security|keys|encryption|authorization|media|streams|sse|context|cors|handlers|registry|all` (default: all).
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
python -m pip install build setuptools wheel mypy
python -m build framework/python --outdir .tmp-run/ports-packages
python framework/conformance/check_packages.py .tmp-run/ports-packages
python framework/conformance/check_docs.py
dotnet build framework/dotnet/BetterPortal.Tool
python framework/conformance/check_types.py
python -m mypy framework/python/betterportal --follow-imports=silent --follow-untyped-imports
dotnet pack framework/dotnet/BetterPortal --no-restore --output .tmp-run/ports-packages
dotnet pack framework/dotnet/BetterPortal.Tool --no-restore --output .tmp-run/ports-packages
```

The package check compares every wheel/sdist document byte for byte, then imports
the wheel directly to exercise recursive parsing and RSA generation without Node
or the source tree. `--follow-untyped-imports` lets mypy inspect AnyVali, whose
wheel lacks py.typed. Linux execution remains a delivery check.

## Remaining delivery

[CAPABILITIES.md](CAPABILITIES.md) maps the full requested scope to existing BP
code, documentation, implementation status, and required acceptance scenarios.
It distinguishes implemented fixtures from planned tests. The rest of the
HTTP suite (persistent settings, request hosting, sync/readiness,
rendering, streaming and generated clients), standalone examples and CI remains
incomplete. Publishing and BSB plugins remain separate follow-ups.
