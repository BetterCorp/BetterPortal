"""Step-up checks for already verified, app-bound access claims."""
from __future__ import annotations
import json
import time
from typing import Any, Mapping
from .contracts import parse
from .security import TokenError


class ElevationRequired(TokenError):
    def __init__(self, requirement: Mapping[str, Any], claims: Mapping[str, Any]):
        super().__init__("insufficient_user_authentication")
        self.requirement = dict(requirement)
        challenge = {"version": 1, "tenantId": claims["tenantId"], "appId": claims["appId"], **requirement}
        acr = "mfa" if requirement["minimum"] == "mfa" else "confirmed"
        authenticate = f'Bearer error="insufficient_user_authentication", acr_values="urn:betterportal:{acr}"'
        if "maxAgeSeconds" in requirement: authenticate += f', max_age="{requirement["maxAgeSeconds"]}"'
        self.headers = {"WWW-Authenticate": authenticate, "BP-Auth-Challenge": json.dumps(challenge, separators=(",", ":")), "Cache-Control": "no-store"}


def require_elevation(claims: Mapping[str, Any] | None, requirement: Mapping[str, Any], *, now: int | None = None) -> None:
    """Check after authorization and before effects. Never accepts unverified browser claims."""
    policy = parse("ElevationRequirementSchema", dict(requirement))
    if claims is None: raise TokenError("Human authentication required")
    current = int(time.time()) if now is None else now
    e = claims.get("elevation")
    if (isinstance(e, dict) and claims.get("tokenType") == "access" and claims["exp"] > current
        and e.get("assurance") in ("confirmed", "mfa")
        and 0 <= e.get("verifiedAt", -1) <= current < e.get("expiresAt", 0) <= claims["exp"]
        and (policy["minimum"] != "mfa" or e["assurance"] == "mfa")
        and ("maxAgeSeconds" not in policy or current - e["verifiedAt"] <= policy["maxAgeSeconds"])): return
    raise ElevationRequired(policy, claims)
