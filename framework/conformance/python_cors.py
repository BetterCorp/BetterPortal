from betterportal.context import OriginPolicy
from betterportal.cors import Cors, CorsDenied

cors = Cors(OriginPolicy(frozenset(["https://app.test"]), frozenset(["https://app.test"])), ["GET"])


def handle(response):
    preflight = response.command == "OPTIONS"
    try:
        headers = cors.preflight(response.headers.get("origin"), response.headers.get("access-control-request-method"), response.headers.get("access-control-request-headers")) if preflight else cors.headers(response.headers.get("origin"))
        response.send_response(204 if preflight else 200)
        if not preflight:
            headers["x-test-handler"] = "ran"
    except CorsDenied:
        response.send_response(403)
        headers = {"vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"}
    for name, value in headers.items():
        response.send_header(name, value)
    response.end_headers()
    if "x-test-handler" in headers:
        response.wfile.write(b'{"handled":true}')
