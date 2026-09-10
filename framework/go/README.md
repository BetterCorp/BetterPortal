# BetterPortal Go protocol primitives

Experimental, unpublished Go 1.22+ module. This is the first Go port milestone,
not a service SDK or a conformant BetterPortal host. It uses only the standard
library; Node, BSB and Python are not runtime or build dependencies.

From this directory:

```sh
go test -race -cover ./...
go vet ./...
go run ./examples/protocol
```

Import `github.com/BetterCorp/BetterPortal/framework/go` as `protocol`. Until this
branch is merged, use a local module `replace` pointing to this directory. No
module release tag or package publication is created by this change.

`Negotiate(accept, available)` returns `Representation` or an error. Use
`errors.Is(err, protocol.ErrNotAcceptable)` to map malformed/unacceptable Accept
headers to HTTP 406. A nil offer list enables JSON/HTML; an empty slice enables
nothing. Explicitly offer `metadata` and `ndjson` only on operations implementing
them. Parsing is bounded to 8 KiB and handles quality, request-order ties,
specific exclusions, quoted parameters and BP HTML modes. Theme hints never
select a renderer. The host must resolve the trusted app shell and authorize
selectors independently. Negotiation and encoding are safe for concurrent calls.

`EncodeEvent(data, EventOptions{...})` frames already serialized UTF-8 text. It
preserves empty messages and Unicode separators, normalizes CR/LF, bounds names
and IDs to 1 KiB, and defaults data to 1 MiB (`MaxDataBytes: 0`). Negative limits
are invalid. Nil event/ID/retry pointers omit fields; empty IDs and zero retry
remain present. The codec does not validate application values or manage feeds.
Hosts must apply AnyVali schemas, authorization, tenant isolation, backpressure
and disconnect cleanup before exposing per-view SSE. Do not register a manual
generator as a BetterPortal route.

A zero-value `HeaderDirectives` collects one response's BP header updates. Never
share it across requests or mutate it concurrently. `Set` supports locked,
owner scope, absolute Unix expiry, a URL-encoded root-relative refresh path and
refresh lead time. Last action wins case-insensitively. Values reject control
bytes and unescaped comma/semicolon delimiters. Zero times are retained. `Emit`
returns an owned snapshot of header pairs; append these individually using the
host's header API and expose their names through CORS. The collector neither
persists credentials nor authenticates callers.

## Acceptance and remaining work

The negotiation corpus mirrors `framework/conformance/media_cases.py`, including
its stricter native cases. Tests cover SSE wire bytes and limits, injection,
collector state/ownership and fuzz seeds. CI runs tests with the race detector,
vet, bounded parser fuzzing and an example from an isolated copy with networking
disabled, on Go 1.22 and the current stable version.

Pending: AnyVali contract import/type generation; generated route registration;
manifest/schema discovery; request/response validation; app resolution, allowlists,
CORS and authentication; rendering; config/install/sync; managed streaming and
full cross-language HTTP conformance. AnyVali remains the only application
schema validator. No replacement validator or partial HTTP server is introduced.

The previously reported Go schema/concurrency failures are fixed in AnyVali
`v1.1.6`. The verified source pin installs as:

```sh
go get github.com/BetterCorp/AnyVali/sdk/go@v0.0.0-20260910095723-c04ae2b71c8e
```

This resolves to commit `c04ae2b71c8e8b8efc7b6dab53f6bd3f2909d15e`. All six
native dependency probes pass with `go test -race -count=1`: canonical record
import, recursive JSON parsing, missing/default versus explicit-null behavior,
and concurrent imports of simple and recursive documents. The corresponding
[record interchange](https://github.com/BetterCorp/AnyVali/issues/150),
[null/default](https://github.com/BetterCorp/AnyVali/issues/151), and
[import race](https://github.com/BetterCorp/AnyVali/issues/152) blockers are resolved.

These targeted dependency checks do not replace the full canonical contract
gate, including 64-bit integers and export/reimport, or the runtime/HTTP
acceptance required before full SDK integration.

See [the protocol](../../spec/protocol.md), [SSE](../../spec/sse.md), and the
[existing port capability ledger](../conformance/CAPABILITIES.md).
