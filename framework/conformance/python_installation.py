"""Exercise consumer ASGI installation, restart and atomic persistence failures."""
import asyncio
import hashlib
from pathlib import Path
import tempfile
import time
import httpx
from betterportal.asgi import create_app
from betterportal.bootstrap import BootstrapStateStore
from betterportal.installation import ServiceInstallation
from betterportal.service import Service
from betterportal.storage import FileStateStore
from python_registry import build_registry
from python_storage import FaultStore


async def installation_request(body):
    with tempfile.TemporaryDirectory(prefix="bp-install-") as directory:
        fault = FaultStore(directory)
        settings = FileStateStore(Path(directory) / "settings.json")
        snapshots = FileStateStore(Path(directory) / "snapshot.json")
        if "stored" in body: await fault.file.save(body["stored"].encode())
        if "settingsStored" in body: await settings.save(body["settingsStored"].encode())
        service = installation = lifetime = app = None
        async def start():
            nonlocal service, installation, lifetime, app
            service = Service(build_registry(body), body["declaration"], managed=body.get("managed", True), state_store=snapshots)
            installation = ServiceInstallation(service, BootstrapStateStore(fault, body["key"]), body["cpUrl"], body.get("serviceUrl", "https://service.test"),
                settings_store=settings, cp_jwks_uri=body.get("jwksUri"), auth_provider=body.get("authProvider"),
                retry_delay=body.get("retryDelay", 0.05), request_timeout=body.get("requestTimeout", 1))
            app = create_app(service, installation=installation, max_body_bytes=body.get("maxBodyBytes", 1024 * 1024))
            lifetime = app.router.lifespan_context(app)
            await lifetime.__aenter__()
        async def stop():
            nonlocal lifetime
            if lifetime is not None:
                owner, lifetime = lifetime, None
                await owner.__aexit__(None, None, None)
            else:
                if installation is not None: await installation.aclose()
                if service is not None: await service.aclose()
        async def state():
            value = await BootstrapStateStore(fault, body["key"]).read()
            return {"ready": service.ready, "snapshot": service.snapshot(), "installation": installation.status,
                    "bootstrap": await BootstrapStateStore(fault, body["key"]).read(redacted=True),
                    "stored": (await fault.file.load() or b"").decode(),
                    "settingsStored": (await settings.load() or b"").decode(),
                    "apiKeyHash": hashlib.sha256(value.get("apiKey", "").encode()).hexdigest(),
                    "configKeyHash": hashlib.sha256(value.get("configEncryptionKey", "").encode()).hexdigest()}
        outcomes = []
        try:
            await start()
            for step in body["steps"]:
                fault.mode = step.get("mode", "ok")
                kind = step.get("kind", "request")
                if kind == "restart": await stop(); await start(); result = {"status": 200}
                elif kind == "state": result = {"status": 200}
                elif kind == "close": await stop(); result = {"status": 200}
                elif kind == "wait":
                    deadline = time.monotonic() + 4
                    while service.ready != step.get("ready", True):
                        if time.monotonic() >= deadline: raise TimeoutError("Installation did not reach expected readiness")
                        await asyncio.sleep(0.005)
                    result = {"status": 200}
                elif kind == "snapshot":
                    try: await service.apply_snapshot(step["snapshot"])
                    except ValueError: result = {"status": 400}
                    else: result = {"status": 200}
                elif kind in ("cancel", "close-install", "cancel-after-save", "parallel-install"):
                    fault.started = asyncio.Event(); fault.release = asyncio.Event()
                    if kind == "cancel-after-save":
                        def cancel_committed():
                            fault.after_save = None
                            asyncio.current_task().cancel()
                        fault.after_save = cancel_committed
                    elif not step.get("barrier"): fault.mode = "block"
                    task = asyncio.create_task(installation.install(step["body"]))
                    async with httpx.AsyncClient(trust_env=False) as control:
                        try:
                            if kind != "cancel-after-save":
                                if step.get("barrier"): assert (await control.get(step["barrier"] + "/control/started")).status_code == 200
                                else: await asyncio.wait_for(fault.started.wait(), 3)
                                if kind == "parallel-install":
                                    second = asyncio.create_task(installation.install(step["body"]))
                                    await asyncio.sleep(0)
                                    assert not second.done()
                                    fault.release.set()
                                    values = await asyncio.gather(task, second)
                                    result = {"status": 200, "statuses": [value[0] for value in values]}
                                elif kind == "close-install": await installation.aclose()
                                else: task.cancel()
                            if kind != "parallel-install":
                                try: await task
                                except asyncio.CancelledError: result = {"status": 0, "cancelled": True}
                                else: raise AssertionError("Expected installation cancellation")
                        finally:
                            fault.mode = "ok"; fault.after_save = None; fault.release.set()
                            if step.get("barrier"): await control.get(step["barrier"] + "/control/release")
                else:
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://service.test") as client:
                        response = await client.request(step.get("method", "GET"), step.get("path", "/.well-known/bp/health"),
                            headers=step.get("headers", {}), **({"content": step["raw"].encode()} if "raw" in step else {"json": step["body"]} if "body" in step else {}))
                        result = {"status": response.status_code, "headers": dict(response.headers), "body": response.text}
                result.update(await state())
                outcomes.append(result)
            return {"valid": True, "outcomes": outcomes}
        except Exception as error:
            return {"valid": False, "error": str(error), "outcomes": outcomes}
        finally: await stop()
