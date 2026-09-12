"""CORS policy; hosts perform preflight before operation authentication/dispatch."""
from __future__ import annotations

import re
from typing import Iterable
from .context import OriginPolicy, http_origin
from .contracts import parse

_ALLOW = "Accept, Authorization, Content-Type, HX-Current-URL, HX-Request, HX-Target, HX-Trigger, HX-Trigger-Name, X-BP-Tenant-Id, X-BP-App-Id, X-BP-Service-Id, X-BP-Service-Authorization, BP-SetHeader, BP-RemoveHeader, traceparent, tracestate, baggage"
_EXPOSE = "HX-Trigger, HX-Trigger-After-Swap, HX-Trigger-After-Settle, HX-Location, HX-Push-Url, HX-Redirect, HX-Refresh, HX-Replace-Url, HX-Reswap, HX-Retarget, BP-SetHeader, BP-RemoveHeader, WWW-Authenticate, BP-Auth-Challenge"
_TOKEN = re.compile(r"[!#$%&'*+.^_`|~A-Za-z0-9-]+\Z")


class CorsDenied(ValueError):
    status = 403


class Cors:
    def __init__(self, policy: OriginPolicy, methods: Iterable[str]):
        self.policy = policy
        declared = [parse("HttpMethodSchema", method) for method in methods]
        self.methods = tuple(dict.fromkeys([*(item for method in declared for item in (("GET", "HEAD") if method == "GET" else (method,))), "OPTIONS"]))

    def headers(self, origin: str | None) -> dict[str, str]:
        result = {"vary": "Origin"}
        if origin is not None:
            if not self.policy.allows(origin):
                raise CorsDenied("Origin is not allowed")
            result["access-control-allow-origin"] = http_origin(origin)
            result["access-control-expose-headers"] = _EXPOSE
        return result

    def preflight(self, origin: str | None, method: str | None, requested_headers: str | None = None) -> dict[str, str]:
        if origin is None or method not in self.methods:
            raise CorsDenied("Preflight origin or method is not allowed")
        result = self.headers(origin)
        allowed = _ALLOW
        if requested_headers is not None:
            if len(requested_headers) > 8192 or any(ord(char) < 32 and char != "\t" or ord(char) > 126 for char in requested_headers):
                raise CorsDenied("Invalid preflight headers")
        if requested_headers and requested_headers.strip(" \t"):
            names = [name.strip() for name in requested_headers.split(",") if name.strip()]
            if not names or any(not _TOKEN.fullmatch(name) for name in names):
                raise CorsDenied("Invalid preflight header name")
            # Trusted origins can send custom operation headers; schemas validate their values.
            allowed = ", ".join(dict.fromkeys(name.lower() for name in names))
        result.update({"access-control-allow-methods": ", ".join(self.methods), "access-control-allow-headers": allowed,
                       "access-control-max-age": "600", "vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"})
        return result
