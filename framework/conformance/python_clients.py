"""Exercise public client APIs through real scoped Service request preparation."""
import asyncio
import anyvali as av
import httpx
from betterportal.clients import ClientContract, ClientError
from betterportal.context import ScopedConfig
from betterportal.service import Service, RequestError
from python_registry import build_registry
from python_security import KEY
from generated_peer import PeerClient


async def clients_request(body):
    results = []
    try:
        registry = build_registry(body)
        service = Service(registry, body["declaration"], ScopedConfig(body["snapshot"]) if body.get("snapshot") else None,
                          signing_key=None if body.get("noKey") else KEY)
        try:
            contract = ClientContract(body["contract"])
            if body.get("background"):
                scope = service.clients.scope(body["tenantId"], body["appId"])
            else:
                route = registry.routes[0]
                prepared = await service.prepare(route, "GET", "/check/item", body.get("headers", {"origin": "https://app.test"}))
                scope = prepared[0].clients
            client = scope.m2m(body["requestId"], contract) if "requestId" in body else scope.user(contract, body.get("serviceId"))
            generated = PeerClient(scope, request_id=body["requestId"]) if "requestId" in body else PeerClient(scope, service_id=body.get("serviceId"))
            for step in body.get("steps", [{}]):
                try:
                    if "snapshot" in step: await service.apply_snapshot(step["snapshot"])
                    if step.get("close"): await service.aclose()
                    values = step.get("values", {"params": {"key": "item"}})
                    pending = asyncio.create_task(generated.check_get(values) if body.get("generated") else client.request(step.get("operation", "check.get"), values))
                    if "during" in step:
                        control = step["during"]
                        async with httpx.AsyncClient(trust_env=False) as http:
                            (await http.get(control["url"] + "/control/started")).raise_for_status()
                            if "snapshot" in control: await service.apply_snapshot(control["snapshot"])
                            if control.get("close"): await service.aclose()
                            if control.get("cancel"): pending.cancel()
                            (await http.get(control["url"] + "/control/release")).raise_for_status()
                    results.append({"status": 200, "output": await pending})
                except asyncio.CancelledError: results.append({"status": 499})
                except (ClientError, RequestError) as error: results.append({"status": error.status, "error": str(error)})
                except (av.ValidationError, ValueError, TypeError): results.append({"status": 400})
            return {"results": results}
        finally: await service.aclose()
    except (ClientError, RequestError) as error: return {"status": error.status, "error": str(error)}
    except (av.ValidationError, ValueError, TypeError): return {"status": 400}
