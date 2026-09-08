"""Real ASGI config routes with stateful requests and injectable file failures."""
import asyncio
import base64
from pathlib import Path
import tempfile
import os
import httpx
from betterportal.asgi import create_app
from betterportal.config_api import ConfigApi
from betterportal.contracts import contract
from betterportal.context import ScopedConfig
from betterportal.encryption import ConfigCipher
from betterportal.handler import Handler
from betterportal.registry import Registry, Route, Operation
from betterportal.service import Service
from betterportal.settings import SettingsSchema, ServiceSettings
from python_storage import FaultStore


async def config_api_request(body):
    with tempfile.TemporaryDirectory() as directory:
        store = FaultStore(directory, body.get("maxBytes", 16 * 1024 * 1024))
        path = Path(directory) / "state.json"
        if "stored" in body: path.write_text(body["stored"], encoding="utf-8")
        settings = None if body.get("unsupported") else ServiceSettings(SettingsSchema(body["descriptors"]), ConfigCipher(body["key"]), store)
        previous = os.environ.get("BP_ALLOW_DEV_CONFIG_TOKEN")
        try:
            os.environ["BP_ALLOW_DEV_CONFIG_TOKEN"] = "true" if body.get("enableDevToken") else "false"
            api = ConfigApi(settings, issuer=body.get("issuer"), jwks_uri=body.get("jwksUri"), mode=body.get("mode"), custom_ui_path=body.get("customUiPath"), writable=body.get("writable", True), dev_token=body.get("devToken"))
        finally:
            if previous is None: os.environ.pop("BP_ALLOW_DEV_CONFIG_TOKEN", None)
            else: os.environ["BP_ALLOW_DEV_CONFIG_TOKEN"] = previous
        route = Route("check", "/check/:key", [Operation(Handler(contract("JsonObjectSchema"), lambda context: dict(context.request_context.config)),
            {"operationId": "check.get", "method": "GET", "title": "Check", "description": "Check", "auth": {}})])
        service = Service(Registry([route]), {**body["declaration"], "configSchemas": body["descriptors"]}, ScopedConfig(body["snapshot"]) if body.get("snapshot") is not None else None,
            config_api=api, preview_key=body.get("previewKey"), managed=body.get("managed", False))
        app = create_app(service, max_body_bytes=body.get("maxBodyBytes", 1024 * 1024))
        outcomes = []
        try:
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://service.test") as client:
                    for step in body["steps"]:
                        if "snapshot" in step:
                            try: await service.apply_snapshot(step["snapshot"], manifest_submitted=step.get("submitted", False))
                            except Exception as error:
                                if not step.get("allowFailure"): raise
                                outcomes.append({"rejected": True, "errorType": type(error).__name__})
                            else:
                                if step.get("allowFailure"): outcomes.append({"rejected": False})
                            continue
                        if step.get("close"): await service.aclose(); continue
                        store.mode = step.get("mode", "ok")
                        async def request():
                            payload = base64.b64decode(step["bodyBase64"]) if "bodyBase64" in step else step.get("body", "").encode()
                            response = await client.request(step["method"], step["path"], headers=step.get("headers", {}), content=payload)
                            return {"status": response.status_code, "body": response.text, "headers": dict(response.headers)}
                        if "duringAuthSnapshot" in step:
                            task = asyncio.create_task(request())
                            async with httpx.AsyncClient(trust_env=False) as control:
                                try:
                                    assert (await control.get(body["jwksUri"] + "/control/started")).status_code == 200
                                    await service.apply_snapshot(step["duringAuthSnapshot"])
                                finally: await control.get(body["jwksUri"] + "/control/release")
                            outcomes.append(await task)
                        elif step.get("cancelWrite") or "duringWriteSnapshot" in step or step.get("closeWrite"):
                            store.mode = "block"; store.started = asyncio.Event(); store.release = asyncio.Event()
                            task = asyncio.create_task(request()); await asyncio.wait_for(store.started.wait(), 3)
                            if "duringWriteSnapshot" in step:
                                update = asyncio.create_task(service.apply_snapshot(step["duringWriteSnapshot"]))
                                await asyncio.sleep(0)
                                assert not update.done()
                                store.release.set(); outcomes.append(await task); await update
                            else:
                                if step.get("closeWrite"): await service.aclose()
                                else: task.cancel()
                                try: await task
                                except asyncio.CancelledError: outcomes.append({"cancelled": True})
                                else: raise AssertionError("Expected cancellation")
                            store.mode = "ok"
                        else: outcomes.append(await request())
        except Exception as error:
            return {"startupError": type(error).__name__, "ready": service.ready, "stored": path.read_text() if path.exists() else None}
        finally: await service.aclose()
        return {"outcomes": outcomes, "ready": service.ready, "stored": path.read_text() if path.exists() else None}
