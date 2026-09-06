"""Test-only native sync/hosting adapter; the peer speaks the real CP wire protocol."""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
import tempfile
import time
import httpx

from betterportal.asgi import create_app
from betterportal.security import KeyPair
from betterportal.service import Service
from betterportal.storage import FileStateStore
from betterportal.sync import ControlPlaneSync
from python_registry import build_registry


async def sync_request(body):
    with tempfile.TemporaryDirectory() as directory:
        class Store:
            def __init__(self): self.file = FileStateStore(Path(directory) / "snapshot.json"); self.failures = body.get("saveFailures", 0); self.saves = 0
            async def load(self): return await self.file.load()
            async def save(self, value):
                self.saves += 1
                if self.failures: self.failures -= 1; raise OSError("Injected save failure")
                await self.file.save(value)
        store = Store()
        if "stored" in body: (Path(directory) / "snapshot.json").write_text(body["stored"], encoding="utf-8")
        async with Service(build_registry(body), body["declaration"], state_store=store,
                managed=body.get("managed", True), preview_key=body.get("previewKey")) as service:
            try:
                key = KeyPair(body["key"]["privateKeyPem"], body["key"]["kid"]) if "key" in body else KeyPair.generate() if body.get("generateKey") else None
                sync = ControlPlaneSync(service, body["baseUrl"], body.get("apiKey", "bp-test-key"), key_pair=key,
                    auth_provider=body.get("authProvider"), retry_delay=body.get("retryDelay", 0.05), request_timeout=body.get("requestTimeout", 1))
            except Exception: return {"valid": False}
            if body.get("cancelStartup"):
                starting = asyncio.create_task(sync.start())
                while not sync.status["attempts"]: await asyncio.sleep(0)
                starting.cancel()
                result = (await asyncio.gather(starting, return_exceptions=True))[0]
                assert isinstance(result, asyncio.CancelledError)
                stopped = sync.status
                await asyncio.sleep(0.1)
                assert sync.status == stopped and stopped["phase"] == "closed"
                return {"valid": True, "cancelled": True, "ready": service.ready, "stored": await store.load()}
            app = create_app(service, sync=sync)
            def state(): return {"ready": service.ready, "snapshot": service.snapshot(), "sync": sync.status}
            @asynccontextmanager
            async def lifetime():
                if body.get("hosted"):
                    async with app.router.lifespan_context(app): yield service.ready
                else:
                    try: yield await sync.start()
                    finally: await sync.aclose()
            async with lifetime() as started:
                first = state()
                until = body.get("until", {})
                deadline = time.monotonic() + 4
                def reached():
                    status = sync.status
                    current = service.snapshot()
                    return all(status[key] >= value if isinstance(value, int) else status[key] == value for key, value in until.items()) and (
                        "untilTitle" not in body or current is not None and current["tenants"][0]["title"] == body["untilTitle"])
                while not reached():
                    if time.monotonic() >= deadline: raise TimeoutError("Sync probe did not reach its expected state")
                    await asyncio.sleep(0.005)
                final = state()
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://service.test") as client:
                    response = await client.get("/.well-known/bp/health")
                    health = {"status": response.status_code, "body": response.json()}
                    probe = body.get("probeRequest", body.get("request"))
                    operation = None
                    if probe:
                        response = await client.request(probe["method"], probe["path"], headers=probe.get("headers", {}), content=probe.get("body", ""))
                        operation = {"status": response.status_code, "body": response.text}
            stopped = sync.status
            await asyncio.sleep(0.03)
            assert stopped == sync.status
            stored = await store.load()
            return {"valid": True, "started": started, "first": first, "final": final, "closed": sync.status,
                    "readyAfterClose": service.ready,
                    "serviceClosed": not service.ready if body.get("hosted") else None, "health": health,
                    "submission": sync.submission(), "stored": stored.decode() if stored else None, "saves": store.saves, "operation": operation}
