# Python production acceptance

The Python runtime ships as a versioned wheel/sdist and standalone container
scaffold. The delivery target for this change is a disposable local Docker stack,
as requested by the operator; no existing production portal credentials are used.
The PR must have green Python 3.10/3.14 CI and all review conversations addressed
before release approval. CI artifacts are the deployment input; this change does
not automatically publish to PyPI or modify a production installation.

| Requirement | Implementation and acceptance |
| --- | --- |
| Raw and finite/subscriber clients | `clients.py`, generated raw/finite methods; bounded NDJSON/SSE parsers, validated frames, cleanup and retirement in `check_python_client_streams.py`; live Node/.NET cases in `client_cases.py` |
| Shell and error rendering | `themes.py`, safe presentation/scoped settings, app overrides, cycles, BP elements and global status renderers; `check_python_themes.py` |
| Handler and route authoring | Complete convenience context, canonical declarations, concrete schema discovery and source-free export; `check_types.py`, `check_discovery.py`, shared handler/registry/hosting cases |
| Authentication helpers | Explicit OIDC trust/nonce, app-only redirects, secure cookies, BP directives and permission targets; `check_python_auth_helpers.py` |
| Deployment configuration | `DeploymentConfig`, mounted secret, persistent stores, explicit peer proxy trust, non-root Docker scaffold; `check_python_deployment.py` |
| Observability | Replaceable span/log/metric/HTTP sinks, nested traces and bounded propagation; `check_python_observability.py` |
| Health | Minimal public readiness, management-user diagnostics and private cache policy; `check_python_health.py` |
| Webhooks | Declared validated payloads, trusted current scope, cancellation, explicit idempotency; `check_python_webhooks.py`; actual CP duplicate/revocation in Docker, plus Node regression |
| Discovery and SEO | Public resource bounds, shell task guides and complete local drop; private/public sitemap and robots projection in `check_python_deployment.py` |
| Cross-language delivery | All six generated caller/host pairs, plus Python raw/stream/feed consumption; `client_cases.py` |
| Packaged installation | `check_packages.py`, `check_scaffold.py`, wheel-only import/export, actual CP installation and encrypted state restart |
| Container/browser delivery | `check_python_docker.py`: real CP routes and Bootstrap assets in Node container, Python wheel in non-root/read-only container, authenticated browser, install/readiness, webhook deduplication/revocation, restart/upgrade/rollback; cleans its own containers, volumes and image tags |

## Reproduce the deployment gate

Build the Node framework/plugin, config-manager, theme-runtime and Bootstrap1
workspaces, install `framework/conformance/requirements-ci.txt`, build the Python
wheel, and install Playwright Chromium. Then run:

```sh
python -m build framework/python --no-isolation --outdir ports-artifacts/packages
python framework/conformance/check_python_docker.py ports-artifacts/packages
```

On a Linux machine whose Docker socket requires configured passwordless sudo,
append `--sudo`. The test uses host networking exclusively for loopback endpoints,
fresh test-only credentials, a unique state volume and unique image/container
names. It performs cleanup on success and failure. Do not expose the test adapters.

Run the full native gate with `verify.py --roundtrip-all --report <report.json>`.
The normal CI also runs the feature gates, type checks, executable documentation,
artifact inspection and packaged scaffolds. The Docker rehearsal runs in the
Python 3.14 CI job; its service image currently uses Python 3.12.

## Production promotion and operation

1. Select the reviewed commit and passing CI run. Preserve its wheel, sdist,
   conformance report and immutable application image digest. Install the wheel
   directly during the image build until a package-index release is authorized.
2. Mount `/data` for persistent state and a separate read-only bootstrap secret.
   Retain that key across restarts. Run one worker per state directory. Use HTTPS
   public/control-plane URLs, except the explicit loopback development allowance.
3. Restrict ingress to the deployment proxy, configure its exact peer IP/CIDR,
   overwrite forwarded host/protocol and disable Uvicorn proxy processing.
4. Install through the configured control plane. Readiness remains 503 until the
   manifest is accepted and a scoped snapshot persists; only then admit traffic.
5. Before upgrades, snapshot the stopped service's state volume and retain the
   previous immutable image. The rehearsal verifies same-format upgrade and
   rollback without a second credential redemption. Future state-format changes
   need their own migration/rollback acceptance; do not assume compatibility.
6. Keep deployment monitoring external to the service process. Export telemetry
   through nonblocking sinks and retain the latest failed readiness/check result.

Finite SSE data clients require an upstream app without a selected HTML stream
renderer; NDJSON is the canonical data transport for themed apps. Subscriber
clients require an explicit event schema because the current manifest does not
publish that schema. Dynamic/provider sitemap entries are conservatively omitted
until concrete URLs are supplied. These are explicit transport/discovery limits.

The control plane retains in-memory webhook idempotency IDs for seven days with a
10,000-ID limit and rejects new events at capacity. That store resets on restart;
use PostgreSQL-backed delivery for durable deduplication across control-plane
restarts. Python publishers do not automatically retry uncertain delivery.
