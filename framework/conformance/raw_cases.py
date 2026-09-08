"""Raw-response wire parity and native transport ownership/security probes."""
import base64
import gzip
from copy import deepcopy
import json
from hosting_cases import fixture
from security_cases import post


def run_raw(urls, labels):
    results = []
    def check(label, name, action):
        result = {"runtime": label, "id": "raw-" + name, "passed": False}
        try: action(); result["passed"] = True
        except Exception as error: result["error"] = str(error)
        results.append(result)
    def encoded(value): return base64.b64encode(value).decode()
    payload = b"\x00\xff\x80BP\r\n"
    base = fixture()
    base["rawProbe"] = True
    base["routes"][0]["operations"][0]["raw"] = {"body": encoded(payload), "headers": [["content-type", "application/octet-stream"], ["x-download", "ready"]]}
    cases = []
    def case(name, change=lambda body, spec, raw: None, status=200, value=payload, native=False, invoked=1):
        body = deepcopy(base); spec = body["routes"][0]["operations"][0]
        change(body, spec, spec["raw"])
        cases.append((name, body, status, value, native, invoked))
    case("binary")
    compressed = gzip.compress(payload, mtime=0)
    case("gzip", lambda body, spec, raw: raw.update(body=encoded(compressed), headers=[["Content-Encoding", "gzip"]]), value=None)
    case("gzip-stream", lambda body, spec, raw: raw.update(chunks=[encoded(compressed[:10]), encoded(compressed[10:])], headers=[["Content-Encoding", "gzip"]]), value=None)
    case("accept-bypass", lambda body, spec, raw: body["request"]["headers"].update(accept="image/png"))
    case("metadata-bypass", lambda body, spec, raw: body["request"]["headers"].update(accept="application/vnd.betterportal.metadata+json"))
    case("cookies", lambda body, spec, raw: raw["headers"].extend([["set-cookie", "first=1; HttpOnly; Path=/"], ["Set-Cookie", "second=2; Secure; Path=/"]]))
    case("vary", lambda body, spec, raw: raw["headers"].append(["vary", "Accept-Encoding"]), native=True)
    case("repeated-vary", lambda body, spec, raw: raw["headers"].extend([["Vary", "Accept-Encoding"], ["vary", "Accept-Language"]]), native=True)
    case("file", lambda body, spec, raw: raw.update(filename="report.txt", contentType="text/plain"))
    case("unicode-filename", lambda body, spec, raw: raw.update(filename='résumé"\r\n.txt'), native=True)
    case("head", lambda body, spec, raw: body["request"].update(method="HEAD"), value=b"", native=True)
    for status in (201, 202, 206, 302, 404, 503):
        case("status-" + str(status), lambda body, spec, raw, status=status: raw.update(status=status), status)
    for status in (204, 205, 304, 404):
        case("empty-" + str(status), lambda body, spec, raw, status=status: raw.update(body="", status=status), status, b"")
    case("invalid-status", lambda body, spec, raw: raw.update(status=199), 500, None)
    case("body-forbidden", lambda body, spec, raw: raw.update(status=204), 500, None)
    case("missing-response", lambda body, spec, raw: spec.update(result={"secret": "bad-result"}), 500, None)
    case("json-cannot-return-raw", lambda body, spec, raw: spec.update(jsonHandler=True), 500, None, True)
    case("json-closes-raw-stream", lambda body, spec, raw: (spec.update(jsonHandler=True), raw.update(chunks=[encoded(b"unused")])) , 500, None, True)
    for name, header in (
        ("header-injection", ["x-file", "safe\r\nx-injected: unsafe"]),
        ("header-name", ["bad header", "value"]),
        ("hop-by-hop", ["transfer-encoding", "chunked"]),
        ("content-length", ["content-length", "999"]),
        ("cors-override", ["access-control-allow-origin", "*"]),
        ("header-size", ["x-file", "x" * 65537])):
        case(name, lambda body, spec, raw, header=header: raw["headers"].append(header), 500, None, True)
    for name, value in (
        ("content-type", "application/octet-stream"), ("content-disposition", "attachment"),
        ("content-location", "/file"), ("content-range", "bytes 0-3/4"),
        ("date", "Mon, 07 Sep 2026 20:00:00 GMT"), ("etag", '"version"'),
        ("last-modified", "Mon, 07 Sep 2026 20:00:00 GMT"), ("location", "/file"),
        ("retry-after", "10"), ("server", "BetterPortal"), ("age", "0"),
        ("expires", "Mon, 07 Sep 2026 20:00:00 GMT")):
        case("duplicate-" + name, lambda body, spec, raw, name=name, value=value: raw.update(headers=[[name, value], [name.title(), value]]), 500, None, True)
    case("conflicting-content-type", lambda body, spec, raw: raw["headers"].append(["Content-Type", "text/html"]), 500, None, True)
    case("input-validation", lambda body, spec, raw: spec.update(schemas={"query": {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": {"kind": "object", "properties": {"required": {"kind": "string"}}, "required": ["required"], "unknownKeys": "strip"}}}), 400, None, invoked=0)
    case("denied-operation", lambda body, spec, raw: body["snapshot"]["apps"][0]["routes"][0].update(operations=["unavailable.get"]), 404, None, invoked=0)
    case("auth-required", lambda body, spec, raw: spec["declaration"].update(auth={"required": True}), 401, None, native=True, invoked=0)
    case("manifest", lambda body, spec, raw: body["request"].update(path="/.well-known/bp/manifest"), value=None, invoked=0)
    case("stream", lambda body, spec, raw: raw.update(chunks=[encoded(b"first"), encoded(b"second"), encoded(payload)]), value=b"firstsecond" + payload)
    case("stream-head", lambda body, spec, raw: (raw.update(chunks=[encoded(b"first")]), body["request"].update(method="HEAD")), value=b"", native=True)
    case("stream-enumerable", lambda body, spec, raw: raw.update(enumerable=True, chunks=[encoded(b"first"), encoded(b"second"), encoded(payload)]), value=b"firstsecond" + payload, native=True)
    case("stream-enumerable-head", lambda body, spec, raw: (raw.update(enumerable=True, chunks=[encoded(b"unused")]), body["request"].update(method="HEAD")), value=b"", native=True)
    case("json-closes-enumerable", lambda body, spec, raw: (spec.update(jsonHandler=True), raw.update(enumerable=True, chunks=[encoded(b"unused")])), 500, None, True)
    for name, body, status, value, native, invoked in cases:
        for url, label in zip(urls, labels):
            if native and label == "node": continue
            def action():
                actual = post(url, body)
                assert actual.get("status") == status and actual["invoked"] == invoked, actual
                if value is not None: assert base64.b64decode(actual["bodyBase64"]) == value, actual
                if name.startswith("gzip"):
                    received = base64.b64decode(actual["bodyBase64"])
                    assert (received if label == "python" else gzip.decompress(received)) == payload, actual
                    assert actual["headers"]["content-encoding"] == "gzip", actual
                if status == 500: assert "secret" not in actual["body"] and "bad-result" not in actual["body"], actual
                if name == "binary": assert actual["headers"].get("access-control-allow-origin") == "https://app.test" and actual["headers"].get("x-download") == "ready", actual
                if name == "cookies": assert actual["cookies"] == ["first=1; HttpOnly; Path=/", "second=2; Secure; Path=/"], actual
                if name == "vary": assert {item.strip().lower() for item in actual["headers"]["vary"].split(",")} >= {"origin", "accept-encoding"}, actual
                if name == "repeated-vary": assert {item.strip().lower() for item in actual["headers"]["vary"].split(",")} >= {"origin", "accept-encoding", "accept-language"}, actual
                if name == "file": assert 'attachment; filename="report.txt"' in actual["headers"]["content-disposition"] and actual["headers"]["content-type"].startswith("text/plain"), actual
                if name == "unicode-filename": assert "filename*=UTF-8''r%C3%A9sum%C3%A9%22%0D%0A.txt" in actual["headers"]["content-disposition"], actual
                if name == "head": assert actual["headers"].get("content-length") == str(len(payload)), actual
                if name == "manifest": assert json.loads(actual["body"])["views"][0]["operations"][0]["raw"] is True, actual
                if label != "node" and name.startswith("stream"):
                    assert actual["stream"] == {"closed": True, "reads": 0 if name.endswith("head") else 3}, actual
                if name in ("json-closes-raw-stream", "json-closes-enumerable"): assert actual["stream"] == {"closed": True, "reads": 0}, actual
            check(label, name, action)
    for url, label in zip(urls, labels):
        if label == "node": continue
        def abandoned():
            body = deepcopy(base); body["cancel"] = True
            spec = body["routes"][0]["operations"][0]
            spec.update(wait=True, returnOnCancel=True)
            spec["raw"].update(chunks=[encoded(b"unused")])
            actual = post(url, body)
            assert actual["cancelled"] and actual["stream"] == {"closed": True, "reads": 0}, actual
        check(label, "cancelled-handler-result", abandoned)
        def abandoned_enumerable():
            body = deepcopy(base); body["cancel"] = True
            spec = body["routes"][0]["operations"][0]
            spec.update(wait=True, returnOnCancel=True)
            spec["raw"].update(enumerable=True, chunks=[encoded(b"unused")])
            actual = post(url, body)
            assert actual["cancelled"] and actual["stream"] == {"closed": True, "reads": 0}, actual
        check(label, "cancelled-enumerable-handler-result", abandoned_enumerable)
        def backpressure():
            body = deepcopy(base); body["rawOutputProbe"] = "backpressure"
            body["routes"][0]["operations"][0]["raw"].update(chunks=[encoded(b"first"), encoded(b"second")])
            actual = post(url, body)
            assert actual["observed"] == 1 and actual["stream"] == {"closed": True, "reads": 2}, actual
        check(label, "backpressure", backpressure)
        if label == "python":
            for kind in ("complete", "head", "cancel", "disconnect", "throw", "invalid-chunk", "abandoned"):
                def single_close():
                    body = deepcopy(base); spec = body["routes"][0]["operations"][0]
                    spec["raw"].update(strictClose=True, chunks=[encoded(b"first"), encoded(b"second")])
                    if kind == "head": body["request"]["method"] = "HEAD"
                    if kind in ("cancel", "disconnect"): spec["raw"]["wait"] = True
                    if kind in ("cancel", "abandoned"): body["cancel"] = True
                    if kind == "abandoned": spec.update(wait=True, returnOnCancel=True)
                    if kind == "disconnect": body["rawOutputProbe"] = "disconnect"
                    if kind == "throw": spec["raw"]["throw"] = True
                    if kind == "invalid-chunk": spec["raw"]["invalidChunk"] = True
                    actual = post(url, body)
                    assert actual["stream"]["closes"] == 1 and actual["stream"]["closed"], actual
                    if kind in ("complete", "head"): assert actual.get("status") == 200, actual
                    elif kind in ("cancel", "disconnect", "abandoned"): assert actual["cancelled"], actual
                    else: assert actual["transportError"], actual
                check(label, "single-close-" + kind, single_close)
            def disconnect():
                body = deepcopy(base); body["rawOutputProbe"] = "disconnect"
                body["routes"][0]["operations"][0]["raw"].update(chunks=[encoded(b"first"), encoded(b"second")], wait=True)
                actual = post(url, body)
                assert actual["cancelled"] and actual["stream"] == {"closed": True, "reads": 2}, actual
            check(label, "asgi-disconnect", disconnect)
        for kind in ("wait", "throw"):
            def action():
                body = deepcopy(base)
                body["routes"][0]["operations"][0]["raw"].update(chunks=[encoded(b"first"), encoded(b"second")], **{kind: True})
                if kind == "wait": body["cancel"] = True
                actual = post(url, body)
                assert actual.get("cancelled" if kind == "wait" else "transportError") is True, actual
                assert actual["stream"] == {"closed": True, "reads": 2}, actual
            check(label, "stream-" + kind, action)
    return results
