# BetterPortal PHP protocol primitives

Experimental, unpublished PHP 8.1+ package (`betterportal/protocol`). This is the
first PHP port milestone, not a service SDK or a conformant BetterPortal host.
It has no runtime dependencies on Node, BSB, Python or a PHP web framework.

From this directory:

```sh
composer install
composer test
php examples/protocol.php
```

`Media::negotiate($accept, $available)` returns a `Representation` with `kind`,
`mode` and optional `fragment`. Defaults offer JSON and HTML only; explicitly
include `metadata` or `ndjson` when the operation implements them. It honors
quality, request-order ties, specific exclusions, quoted parameters and BP HTML
modes. Malformed or unacceptable headers throw `NotAcceptable` (map to HTTP 406).
Accept is bounded to 8 KiB. Theme hints never select a renderer. The host must
resolve the trusted app shell and verify an exact renderer and permitted selector.

`Sse::encode($data, event: ..., id: ..., retry: ...)` frames already serialized
UTF-8 text. It preserves empty messages, normalizes CR/LF and bounds data to 1 MiB
(configurable), names/IDs to 1 KiB. It does not validate application values,
subscribe, send headers or flush. Hosts must apply AnyVali event schemas,
authorization, tenant isolation, backpressure and disconnect cleanup before
exposing a per-view feed. Do not register a manual generator as a BP route.

`HeaderDirectives` collects `BP-SetHeader`/`BP-RemoveHeader` pairs for one response.
`set` supports locked, owner scope, absolute Unix expiry, root-relative refresh
path and refresh lead time. Last action wins case-insensitively. Values reject
control bytes and unescaped comma/semicolon delimiters. Use URL-encoded refresh
paths. Expiry/refresh times are nonnegative integers; zero is retained. `emit()`
returns a snapshot without consuming it. Append each pair separately in the host,
and expose both names through its CORS policy. This collector neither persists
credentials nor authenticates a caller.

## Acceptance and remaining work

The test corpus mirrors `framework/conformance/media_cases.py`, including its
stricter native cases. Tests additionally cover SSE bytes, UTF-8 bounds, header
injection and collector state transitions. CI tests PHP 8.1 and 8.3 and verifies
an isolated Composer archive install, including the example below.

Pending: AnyVali contract import/type generation; generated route registration;
manifest/schema discovery; request/response validation; app resolution, allowlists,
CORS and authentication; rendering; config/install/sync; managed streaming and
full cross-language HTTP conformance. AnyVali remains the only application
schema validator. No replacement validator or partial HTTP server is introduced.
At implementation time the documented `anyvali/anyvali` package was unavailable
from Packagist; resolve distribution and run the canonical contract corpus before
adding that dependency. Nothing is published by this PR.

See [the protocol](../../spec/protocol.md), [SSE](../../spec/sse.md), and the
[existing port capability ledger](../conformance/CAPABILITIES.md).
