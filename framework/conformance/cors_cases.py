"""Actual OPTIONS/GET requests over the native policy and Node's existing H3 helper."""
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def run_cors(urls, labels):
    result = []
    shared = [
        ("allowed-preflight", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "GET"}, 204),
        ("authorization-preflight", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "Authorization, X-BP-Service-Authorization, traceparent, baggage", "Authorization": "Bearer invalid"}, 204),
        ("custom-headers", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "X-App-Filter, Last-Event-ID"}, 204),
        ("actual-origin", "GET", {"Origin": "https://app.test"}, 200),
        ("actual-no-origin", "GET", {}, 200),
    ]
    native = [
        ("head-preflight", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "HEAD"}, 204),
        ("denied-preflight", "OPTIONS", {"Origin": "https://evil.test", "Access-Control-Request-Method": "GET"}, 403),
        ("denied-actual", "GET", {"Origin": "https://evil.test"}, 403),
        ("wrong-port", "OPTIONS", {"Origin": "https://app.test:444", "Access-Control-Request-Method": "GET"}, 403),
        ("wrong-method", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "POST"}, 403),
        ("missing-origin", "OPTIONS", {"Access-Control-Request-Method": "GET"}, 403),
        ("missing-method", "OPTIONS", {"Origin": "https://app.test"}, 403),
        ("null-origin", "OPTIONS", {"Origin": "null", "Access-Control-Request-Method": "GET"}, 403),
        ("header-syntax", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "X:Bad"}, 403),
        ("header-bound", "OPTIONS", {"Origin": "https://app.test", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x" * 8193}, 403),
    ]
    for url, label in zip(urls, labels):
        for name, method, headers, status in shared + (native if label != "node" else []):
            try:
                try:
                    response = urlopen(Request(url.rstrip("/") + "/cors", method=method, headers=headers), timeout=10)
                except HTTPError as error:
                    response = error
                with response:
                    assert response.status == status, response.status
                    body = response.read()
                    if status == 204:
                        assert not body and response.headers.get("x-test-handler") is None, body
                        assert response.headers["access-control-allow-origin"] == headers["Origin"], response.headers
                        assert "GET" in response.headers["access-control-allow-methods"], response.headers
                        assert headers["Access-Control-Request-Method"] in {part.strip() for part in response.headers["access-control-allow-methods"].split(",")}, response.headers
                        allowed = {value.strip().lower() for value in response.headers["access-control-allow-headers"].split(",")}
                        requested = {value.strip().lower() for value in headers.get("Access-Control-Request-Headers", "Authorization, traceparent").split(",")}
                        assert requested <= allowed, allowed
                    if status == 403:
                        assert response.headers.get("x-test-handler") is None and response.headers.get("access-control-allow-origin") is None, response.headers
                    if status == 200:
                        assert response.headers["x-test-handler"] == "ran", response.headers
                    if label != "node":
                        assert "origin" in {value.strip().lower() for value in response.headers["vary"].split(",")}, response.headers
                        assert response.headers.get("access-control-allow-credentials") is None, response.headers
                result.append({"runtime": label, "id": name, "passed": True})
            except Exception as error:
                result.append({"runtime": label, "id": name, "passed": False, "error": str(error)})
    return result
