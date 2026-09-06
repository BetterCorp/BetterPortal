"""Common scoped-subscription behavior plus native transport boundary checks."""
from security_cases import post


def run_sse(urls, labels):
    results = []
    for url, label in zip(urls, labels):
        names = ["scope-route-fanout", "overflow", "overflow-isolated", "no-history", "idle-cancel", "input-validation", "event-validation"]
        if label != "node":
            names += ["transport-validation", "payload-bounds", "publication-snapshot", "mapper-cancel", "shutdown"]
        try:
            actual = post(url, {"action": "sse-probe"})
            for name in names:
                assert actual.get(name) is True, (name, actual)
                results.append({"runtime": label, "id": name, "passed": True})
        except Exception as error:
            results.append({"runtime": label, "id": "sse-probes", "passed": False, "error": str(error)})
    return results
