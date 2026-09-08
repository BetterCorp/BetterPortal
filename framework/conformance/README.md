# BP cross-language conformance

This directory contains the shared AnyVali contract corpus, fixtures, HTTP adapters
and development checks for the Node.js, .NET and Python frameworks. The native
ports are incomplete; [CAPABILITIES.md](CAPABILITIES.md) tracks remaining delivery.

Authoring documentation lives in [docs/building/route-authoring.md](../../docs/building/route-authoring.md).
The [Python](../python/README.md) and [.NET](../dotnet/README.md) SDK guides describe
their runtime APIs and package commands.

## What belongs here

| Files | Purpose |
| --- | --- |
| `contracts/*.json` | Portable BP AnyVali documents used to generate native types and embedded in native packages |
| `schema-cases.json`, `encryption-fixtures.json` | Reproducible schema and cryptographic inputs with expected outcomes |
| `*_cases.py` | Shared HTTP scenarios for schema, security, tenant/app isolation, rendering, control-plane lifecycle and streaming behavior |
| `node-*.mjs`, `python_*.py` | Disposable test adapters for the Node.js and Python runtimes; the .NET adapter is in `../dotnet/Conformance/` |
| `check_*.py` | Compiler, authoring CLI, executable documentation, package and standalone installation checks |
| `export-*.mjs` | Development-only exporters for canonical documents and deterministic fixtures |

Python orchestrates the tests; it is not a runtime dependency of Node.js or .NET
services. AnyVali remains the only schema validator. Consumer packages embed the
contracts and do not run Node or BSB to build or serve requests.

Keep generated test reports and package archives out of Git. The
[Build workflow](../../.github/workflows/ci.yml) uploads `native-ports-python-*`
artifacts containing packages and `conformance.json`, including failed runs.
Use [GitHub Actions](https://github.com/BetterCorp/BetterPortal/actions/workflows/ci.yml)
to inspect results for a particular commit. Local output belongs under `.tmp-run/`.

## Run from the repository root

Use Node.js 24, .NET 10 and Python 3.10 or later. Install the development dependencies
and build the real Node services used as integration peers:

```sh
npm ci --workspaces --include-workspace-root
npm run build --workspace @betterportal/plugin-bsb
npm run build --workspace @betterportal/config-manager
npm run build --workspace @betterportal/registry
python -m pip install -r framework/conformance/requirements-ci.txt
node framework/conformance/export-contracts.mjs --check
node framework/conformance/export-fixtures.mjs --check
node framework/conformance/export-encryption-fixtures.mjs --check
dotnet restore framework/dotnet/Conformance --locked-mode
dotnet build framework/dotnet/Conformance --no-restore -m:1 -p:UseSharedCompilation=false
python framework/conformance/verify.py --roundtrip-all --report .tmp-run/conformance.json
```

`verify.py` starts disposable loopback adapters, runs the checks and stops the
processes even on failure. To run one suite or list the available suites:

```sh
python framework/conformance/verify.py --suite hosting
python framework/conformance/verify.py --suite schema --roundtrip-all
python framework/conformance/verify.py --help
```

Pass `--python /path/to/python` when the Python adapter's dependencies are installed
in a separate environment. The orchestrator itself uses Python's standard library.
To target already-running adapters:

```sh
python framework/conformance/run.py http://127.0.0.1:8310 http://127.0.0.1:8311 http://127.0.0.1:8312 --all-contracts --roundtrip-all
```

The runner discovers runtime identities from the adapters. Tests for native-only
APIs and exact 64-bit JSON numbers explicitly select their applicable runtimes;
JavaScript numbers cannot represent every native integer. Shared wire scenarios
compare the supported runtimes, and regressions fail the gate.

Adapters accept arbitrary test schemas and signing actions, including deliberate
invalid-claim signatures. They are test infrastructure, not public service endpoints.

## Regenerate contracts and fixtures

```sh
npm run build --workspace @betterportal/framework
npm run build --workspace @betterportal/config-manager
npm run build --workspace @betterportal/plugin-bsb
node framework/conformance/export-contracts.mjs
node framework/conformance/export-fixtures.mjs
node framework/conformance/export-encryption-fixtures.mjs
```

The contract exporter reads compiled Node BP schemas and projects portable
authoring declarations. The resulting AnyVali documents are the shared input for
C# and Python type generation. Native packages embed them without a Node build
dependency. Fixture regeneration preserves numeric source tokens, including
integers outside JavaScript's exact range. Canonical JSON uses LF line endings for
byte-for-byte checks on Windows and Linux.

## Authoring, documentation and package checks

```sh
dotnet restore framework/dotnet/BetterPortal.Tool --locked-mode
dotnet build framework/dotnet/BetterPortal.Tool --no-restore -m:1 -p:UseSharedCompilation=false
python framework/conformance/check_types.py
python framework/conformance/check_clientgen.py
python framework/conformance/check_projects.py
python framework/conformance/check_registry_tools.py
python framework/conformance/check_export.py
python framework/conformance/check_discovery.py
python framework/conformance/check_docs.py
dotnet pack framework/dotnet/BetterPortal --no-restore --output .tmp-run/ports-packages
dotnet pack framework/dotnet/BetterPortal.AspNetCore --no-restore --output .tmp-run/ports-packages
dotnet pack framework/dotnet/BetterPortal.Tool --no-restore --output .tmp-run/ports-packages
python -m build framework/python --no-isolation --outdir .tmp-run/ports-packages
python framework/conformance/check_packages.py .tmp-run/ports-packages
python framework/conformance/check_scaffold.py .tmp-run/ports-packages
```

`check_discovery.py` executes the Node.js, Python and C# route-authoring examples.
`check_docs.py` executes the native SDK README examples. Package checks compare
embedded contracts and exercise installed packages without the repository or Node
in the consumer path. Scaffold checks run generated services against the existing
Node config manager; complete Bootstrap shell integration remains delivery work.

CI runs these checks and the full HTTP suite with Python 3.10 and 3.14 on Linux.
The capability ledger records implementation gaps; passing existing checks does
not imply that every planned capability has been delivered.
