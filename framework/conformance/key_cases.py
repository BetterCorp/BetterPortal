"""Shared JWKS HTTP peer; Node baseline plus native port transport/cancellation checks."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import time

from security_cases import post, ISSUER


@contextmanager
def peer():
    routes, counts, barriers = {}, {}, {}
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path, _, command = self.path.partition("/control/")
            if command:
                started, release = barriers[path]
                ready = started.wait(3) if command == "started" else True
                if command == "release":
                    release.set()
                self.send_response(200 if ready else 504)
                self.end_headers()
                return
            with lock:
                index = counts.get(self.path, 0)
                counts[self.path] = index + 1
                choices = routes.get(self.path, [{"status": 404}])
                reply = choices[min(index, len(choices) - 1)]
            try:
                if reply.get("barrier"):
                    started, release = barriers[self.path]
                    started.set()
                    if not release.wait(3):
                        raise TimeoutError("JWKS test barrier was not released")
                self.send_response(reply.get("status", 200))
                self.send_header("Content-Type", reply.get("type", "application/jwk-set+json"))
                if "location" in reply:
                    self.send_header("Location", reply["location"])
                self.end_headers()
                if reply.get("drip"):
                    for _ in range(7):
                        self.wfile.write(b" ")
                        self.wfile.flush()
                        time.sleep(1)
                data = reply.get("raw") or json.dumps(reply.get("body", {})).encode()
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", routes, counts, barriers
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def run_keys(urls, labels):
    keys = [post(url, {"action": "jwt-key"}) for url in urls]
    first = keys[0]
    second = keys[1] if len(keys) > 1 else {**first, "kid": "rotated-key", "jwk": {**first["jwk"], "kid": "rotated-key"}}
    results = []

    def check(label, name, action):
        result = {"runtime": label, "id": name, "passed": False}
        try:
            action()
            result["passed"] = True
        except Exception as error:
            result["error"] = str(error)
        results.append(result)

    def pem(value):
        return "".join(value.split())

    with peer() as (base, routes, counts, barriers):
        for url, label in zip(urls, labels):
            def scenario(name, replies, steps, expected, request_count):
                path = "/" + label + "/" + name
                routes[path] = replies
                if any(reply.get("barrier") for reply in replies):
                    barriers[path] = (threading.Event(), threading.Event())
                actual = post(url, {"action": "keys-probe", "issuer": ISSUER, "uri": base + path, "steps": steps})["results"]
                assert len(actual) == len(expected), actual
                for value, target in zip(actual, expected):
                    if isinstance(target, str):
                        assert value.get("valid") and pem(value["pem"]) == pem(target), value
                    else:
                        assert value == target, value
                assert counts.get(path, 0) == request_count, counts

            good = {"body": {"keys": [key["jwk"] for key in keys]}}
            check(label, "jwks-configured-query", lambda: scenario("query?realm=public", [good],
                [{"kid": first["kid"]}], [first["publicKeyPem"]], 1))
            def root_query_case():
                query = "?realm=" + label + "@public"
                routes["/" + query] = [good]
                actual = post(url, {"action": "keys-probe", "issuer": ISSUER, "uri": base + query,
                                   "steps": [{"kid": first["kid"]}]})["results"]
                assert actual[0].get("valid") and pem(actual[0]["pem"]) == pem(first["publicKeyPem"]), actual
                assert counts.get("/" + query) == 1
            check(label, "jwks-root-query", root_query_case)
            check(label, "jwks-native-keys-parallel-cache", lambda: scenario("parallel", [good],
                [{"kid": first["kid"], "parallel": 20}] + [{"kid": key["kid"]} for key in keys],
                [first["publicKeyPem"]] + [key["publicKeyPem"] for key in keys], 1))
            check(label, "jwks-rotation-miss-throttle", lambda: scenario("rotation", [
                {"body": {"keys": [first["jwk"]]}}, {"body": {"keys": [second["jwk"]]}}],
                [{"kid": first["kid"]}, {"kid": "unknown"}, {"kid": "another-miss"}, {"invalidate": True}, {"kid": second["kid"]}, {"kid": first["kid"]}],
                [first["publicKeyPem"], {"valid": False}, {"valid": False}, {"invalidated": True}, second["publicKeyPem"], {"valid": False}], 2))
            for name, response in (("content-type", {**good, "type": "text/html"}), ("invalid-json", {"raw": b"{"}),
                                   ("http-error", {**good, "status": 503})):
                check(label, "jwks-" + name, lambda: scenario(name, [response], [{"kid": first["kid"]}], [{"valid": False}], 1))
            check(label, "jwks-invalid-kid-no-fetch", lambda: scenario("invalid-kid", [good], [{"kid": "../key"}], [{"valid": False}], 0))

            # Node's existing helper has no endpoint guard or request-cancellation API.
            # Exercise those new native APIs separately, without substituting fake Node policy.
            if label == "node":
                continue
            for valid, endpoints in ((True, [base, "http://localhost:8080/keys", "http://[::1]:8080/keys", "https://keys.example/keys"]),
                (False, ["http://keys.example", "http://127.1", "http://2130706433", "http://0x7f000001", "http://127.0.0.2",
                         "http://[0:0:0:0:0:0:0:1]", "http://localhost.evil", "http://localhost.", "https://@keys.example",
                         "https://user:secret@keys.example", "https://keys.example/?", "https://keys.example/#", "https://keys.example:0",
                         "ftp://localhost/keys", "https://keys.example\\evil", "https://keys.example/\n"])):
                for index, endpoint in enumerate(endpoints):
                    def endpoint_case():
                        assert post(url, {"action": "keys-url", "uri": endpoint}) == {"valid": valid}, endpoint
                    check(label, f"jwks-endpoint-{valid}-{index}", endpoint_case)

            redirect_target = "/" + label + "/redirect-target"
            routes[redirect_target] = [good]
            def redirect_case():
                scenario("redirect", [{"status": 302, "location": base + redirect_target}], [{"kid": first["kid"]}], [{"valid": False}], 1)
                assert counts.get(redirect_target, 0) == 0
            check(label, "jwks-no-redirect", redirect_case)
            check(label, "jwks-response-limit", lambda: scenario("limit", [{"body": {**good["body"], "padding": "x" * (1024 * 1024)}}],
                [{"kid": first["kid"]}], [{"valid": False}], 1))
            check(label, "jwks-duplicate-id", lambda: scenario("duplicate-id", [{"body": {"keys": [first["jwk"], first["jwk"]]}}],
                [{"kid": first["kid"]}], [{"valid": False}], 1))
            duplicate_json = json.dumps(good["body"])[:-1] + ',"keys":' + json.dumps([first["jwk"]]) + "}"
            check(label, "jwks-duplicate-json", lambda: scenario("duplicate-json", [{"raw": duplicate_json.encode()}],
                [{"kid": first["kid"]}], [{"valid": False}], 1))
            check(label, "jwks-waiter-cancellation", lambda: scenario("cancel", [{**good, "barrier": True}],
                [{"kid": first["kid"], "cancel": True}, {"kid": first["kid"]}], [{"cancelled": True}, first["publicKeyPem"]], 1))
            check(label, "jwks-shutdown-cancellation", lambda: scenario("close", [{**good, "barrier": True}],
                [{"kid": first["kid"], "close": True}], [{"cancelled": True}], 1))
            check(label, "jwks-invalidate-inflight", lambda: scenario("inflight", [{**good, "barrier": True}, {"body": {"keys": [second["jwk"]]}}],
                [{"kid": first["kid"], "invalidateDuring": True}, {"kid": second["kid"]}], [{"valid": False}, second["publicKeyPem"]], 2))
            def deadline_case():
                start = time.monotonic()
                scenario("deadline", [{**good, "drip": True}], [{"kid": first["kid"]}], [{"valid": False}], 1)
                assert time.monotonic() - start < 6.5
            check(label, "jwks-total-deadline", deadline_case)
    return results
