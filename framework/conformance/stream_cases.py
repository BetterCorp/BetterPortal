"""Finite stream conformance over actual NDJSON and buffered HTTP responses."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from security_cases import post
from sse_cases import read_events


def run_streams(urls, labels):
    corpus = Path(__file__).with_name("contracts")
    item = json.loads((corpus / "JsonValueSchema.json").read_text())
    text = {**item, "root": {"kind": "string"}}
    cases = [
        ("empty", {"items": []}, []),
        ("order", {"items": [1, "two", {"nested": [None, True]}, "\n☃"]}, None),
        ("summary", {"items": [1, 2], "summarySchema": item, "summary": {"total": 2}}, None),
        ("null-summary", {"items": [], "summarySchema": item, "summary": None}, None),
        ("optional-summary", {"items": [1], "summarySchema": item}, None),
        ("invalid-item", {"itemSchema": text, "items": ["valid", 3, "never"]}, "item_validation_failed"),
        ("invalid-summary", {"items": [1], "summarySchema": text, "summary": False}, "item_validation_failed"),
        ("producer-error", {"items": [1], "fail": True}, "stream_failed"),
    ]
    native = [
        ("factory-error", {"factoryFail": True}, "stream_failed"),
        ("iterator-error", {"iteratorFail": True}, "stream_failed"),
        ("after-summary", {"items": [1], "summarySchema": item, "summary": None, "afterSummary": [2]}, "stream_failed"),
        ("undeclared-summary", {"summary": None}, "stream_failed"),
        ("frame-bound", {"items": ["x" * 1100], "maxFrameBytes": 1024}, "stream_failed"),
    ]
    results = []
    for url, label in zip(urls, labels):
        for mode in ("ndjson", "sse"):
            try:
                request = {"action": "stream", "format": mode, "itemSchema": item, "items": list(range(100)), "delay": 2}
                with urlopen(Request(url, json.dumps(request).encode(), {"Content-Type": "application/json"}), timeout=10) as response:
                    if mode == "sse":
                        events = read_events(response)
                        assert json.loads(next(events)["data"]) == {"kind": "item", "data": 0}
                        events.close()
                    else:
                        assert json.loads(response.readline()) == {"kind": "item", "data": 0}
                assert post(url, {"action": "media", "accept": "application/json"})["status"] == 200
                results.append({"runtime": label, "id": "wire-disconnect-" + mode, "passed": True})
            except Exception as error:
                results.append({"runtime": label, "id": "wire-disconnect-" + mode, "passed": False, "error": str(error)})
        probes = ["backpressure-close", "cancel-producer"]
        if label != "node":
            probes += ["cancel-buffered", "derived-recursive-schema"]
        if label == "dotnet":
            probes += ["cancel-uncooperative"]
        try:
            actual = post(url, {"action": "stream-probe"})
            for name in probes:
                assert actual.get(name) is True, actual
                results.append({"runtime": label, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": label, "id": "lifecycle-probes", "passed": False, "error": str(error)})
        for name, changes, failure in cases + (native if label != "node" else []):
            for mode in ("buffered", "ndjson", "sse"):
                request = {"action": "stream", "format": mode, "itemSchema": item, **changes}
                expected_failure = isinstance(failure, str)
                try:
                    try:
                        response = urlopen(Request(url, json.dumps(request).encode(), {"Content-Type": "application/json"}), timeout=10)
                    except HTTPError as error:
                        response = error
                    with response:
                        assert response.status == (500 if expected_failure and mode == "buffered" else 200), response.status
                        if mode == "buffered":
                            actual = json.load(response)
                            if expected_failure:
                                assert "error" in actual, actual
                            else:
                                expected = {"items": changes.get("items", [])}
                                if "summary" in changes:
                                    expected["summary"] = changes["summary"]
                                assert actual == expected, actual
                        else:
                            assert response.headers["Content-Type"].startswith("text/event-stream" if mode == "sse" else "application/x-ndjson"), response.headers
                            frames = []
                            if mode == "sse":
                                for event in read_events(response):
                                    frame = json.loads(event["data"])
                                    assert event["event"] == frame["kind"], event
                                    frames.append(frame)
                            else:
                                for line in response:
                                    assert line.endswith(b"\n"), line
                                    frames.append(json.loads(line))
                            assert frames, "No terminal frame"
                            terminal = frames[-1]
                            assert not any(frame["kind"] in ("end", "error") for frame in frames[:-1]), frames
                            if expected_failure:
                                assert terminal["kind"] == "error" and terminal["error"] == failure, terminal
                                delivered = [] if name == "frame-bound" else ["valid"] if name == "invalid-item" else changes.get("items", [])
                                expected = [{"kind": "item", "data": value} for value in delivered]
                                if name == "after-summary":
                                    expected.append({"kind": "summary", "data": changes["summary"]})
                                assert frames[:-1] == expected, frames
                                if label != "node":
                                    assert "private" not in terminal["message"], terminal
                            else:
                                expected = [{"kind": "item", "data": value} for value in changes.get("items", [])]
                                if "summary" in changes:
                                    expected += [{"kind": "summary", "data": changes["summary"]}]
                                expected += [{"kind": "end", "count": len(changes.get("items", []))}]
                                assert frames == expected, frames
                    results.append({"runtime": label, "id": name + "-" + mode, "passed": True})
                except Exception as error:
                    results.append({"runtime": label, "id": name + "-" + mode, "passed": False, "error": str(error)})
        if label != "node":
            for name, changes in [("item-limit", {"items": [1, 2], "maxItems": 1}),
                                  ("buffer-byte-limit", {"items": ["ab"], "maxBytes": 14}),
                                  ("empty-buffer-limit", {"items": [], "maxBytes": 2})]:
                try:
                    request = {"action": "stream", "format": "buffered", "itemSchema": item, **changes}
                    try:
                        with urlopen(Request(url, json.dumps(request).encode(), {"Content-Type": "application/json"}), timeout=10) as response:
                            raise AssertionError(f"Unexpected HTTP {response.status}")
                    except HTTPError as error:
                        assert error.code == 500, error.code
                        error.close()
                    results.append({"runtime": label, "id": name, "passed": True})
                except Exception as error:
                    results.append({"runtime": label, "id": name, "passed": False, "error": str(error)})
    return results
