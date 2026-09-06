from betterportal.access import AppAccess
from betterportal.context import ScopedConfig
from betterportal.contracts import contract
from betterportal.handler import Handler
from betterportal.registry import Operation, Route


def access_request(body):
    config = ScopedConfig(body["snapshot"])
    scope = config.by_id(body["tenantId"], body["appId"])
    if scope is None: return {"allowed": False, "aliases": {}}
    route = Route("check", body.get("path", "/check/:key"), [
        Operation(Handler(contract("JsonObjectSchema"), lambda context: {}), {
            "operationId": "check." + method.lower(), "method": method, "title": "Check", "description": "Check", "auth": {}
        }) for method in ("GET", "POST")])
    access = AppAccess(scope, config.local_service_ids)
    return {"allowed": access.allows(route, body.get("method", "GET"), fragment=body.get("fragment")),
            "aliases": dict(access.permission_aliases())}
