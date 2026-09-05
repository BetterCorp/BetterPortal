# BetterPortal Python port

Status: initial AnyVali contract adapter only; **not a usable framework runtime**.
The loopback conformance adapter uses published AnyVali 1.1.0. Python 3.10+ with
Starlette/ASGI remains the runtime target, but hosting, auth, configuration,
tools, types, and wheel packaging are pending the failed
[interchange gate](../conformance/README.md).

```sh
python -m pip install -r framework/conformance/requirements.txt
python framework/conformance/python_schema_server.py 8311
```

The betterportal.contracts module loads the canonical corpus in a source
checkout and calls native AnyVali import/parse/export. It deliberately contains
no compatibility validator that masks upstream failures. All remaining work is
tracked in the [capability ledger](../conformance/CAPABILITIES.md).
