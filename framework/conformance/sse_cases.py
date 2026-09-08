"""Common scoped-subscription behavior plus native transport boundary checks."""
from security_cases import post
import io
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def read_events(response):
    """Test decoder for WHATWG message fields, including empty data and persistent IDs."""
    data, event, event_id, retry = [], "message", "", None
    for line in io.TextIOWrapper(response, encoding="utf-8-sig", newline=None):
        assert line.endswith("\n"), "Truncated SSE line"
        line = line[:-1]
        if not line:
            if data:
                yield {"event": event or "message", "data": "\n".join(data), "id": event_id, "retry": retry}
            data, event = [], "message"
            continue
        field, _, value = line.partition(":")
        value = value[1:] if value.startswith(" ") else value
        if field == "data": data.append(value)
        elif field == "event": event = value
        elif field == "id" and "\0" not in value: event_id = value
        elif field == "retry" and value.isascii() and value.isdecimal(): retry = int(value)
    assert not data, "Truncated SSE message"


def run_sse(urls, labels):
    results = []
    for url, label in zip(urls, labels):
        names = ["scope-route-fanout", "overflow", "overflow-isolated", "no-history", "idle-cancel", "input-validation", "event-validation"]
        if label != "node":
            names += ["transport-validation", "payload-bounds", "publication-snapshot", "mapper-cancel", "shutdown",
                      "wire-render-recovery", "wire-render-cancel", "wire-close"]
        if label == "dotnet": names += ["wire-flush-backpressure"]
        try:
            actual = post(url, {"action": "sse-probe"})
            for name in names:
                assert actual.get(name) is True, (name, actual)
                results.append({"runtime": label, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": label, "id": "sse-probes", "passed": False, "error": str(error)})
        cases = [("named-unicode", [{"event": "status", "data": "snowman \u2603"}], False),
                 ("multiline", [{"data": "first\nsecond\n"}], False),
                 ("empty-data", [{"event": "end", "data": ""}], False),
                 ("id-retry", [{"id": "one", "retry": 2500, "data": "a"}, {"id": "two", "retry": 0, "data": "b"}], False),
                 ("data-fields", [{"data": " x\n\nevent: spoof\nid: other\ndata: literal"}], False)]
        if label != "node":
            # H3 omits empty IDs, so only ports exercise the standard reset behavior.
            cases += [("id-reset", [{"id": "one", "data": "a"}, {"id": "", "data": "b"}], False),
                      ("crlf", [{"data": "one\rtwo\r\nthree\n"}], False),
                      ("unicode-separators", [{"data": "a\u2028b\u0085c\v\f"}], False),
                      ("id-injection", [{"data": "x", "id": "a\nevent: evil"}], True),
                      ("event-injection", [{"data": "x", "event": "a\rdata: evil"}], True),
                      ("null-id", [{"data": "x", "id": "a\0b"}], True),
                      ("metadata-bound", [{"data": "x", "event": "x" * 1025}], True),
                      ("data-byte-bound", [{"data": "\u2603" * 1024}], True),
                      ("negative-retry", [{"data": "x", "retry": -1}], True)]
        for name, events, denied in cases:
            result = {"runtime": label, "id": "sse-wire-" + name, "passed": False}
            try:
                body = {"action": "sse-wire", "events": events, "maxDataBytes": 1024}
                try: response = urlopen(Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=5)
                except HTTPError as error: response = error
                with response:
                    assert response.status == (400 if denied else 200), response.status
                    if not denied:
                        assert response.headers["Content-Type"].startswith("text/event-stream")
                        actual = list(read_events(response))
                        expected, event_id, retry = [], "", None
                        for item in events:
                            event_id, retry = item.get("id", event_id), item.get("retry", retry)
                            expected.append({"event": item.get("event") or "message", "data": item["data"].replace("\r\n", "\n").replace("\r", "\n"), "id": event_id, "retry": retry})
                        assert actual == expected, actual
                result["passed"] = True
            except Exception as error: result["error"] = str(error)
            results.append(result)
    return results
