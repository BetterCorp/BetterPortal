from betterportal.encryption import ConfigCipher
from betterportal.settings import SettingsSchema, ServiceSettings
import asyncio
from pathlib import Path
import tempfile
from python_storage import FaultStore


def settings_request(body):
    try:
        schema = SettingsSchema(body["descriptors"])
        command, scope = body["command"], body.get("scope", "tenant")
        if command == "values": output = schema.values(scope, body["values"], partial=body.get("partial", True))
        elif command == "encode": output = schema.encode(scope, body["values"], ConfigCipher(body["key"]))
        elif command == "decode": output = schema.decode(scope, body["values"], ConfigCipher(body["key"]))
        elif command == "redact": output = schema.redact(scope, body["values"])
        elif command == "merge": output = schema.merge(scope, body["current"], body["values"], body.get("clearKeys", []))
        elif command == "effective": output = schema.effective(body["tenant"], body["app"])
        else: raise ValueError("Unknown test command")
        return {"valid": True, "output": output}
    except Exception as error: return {"valid": False, "errorType": type(error).__name__}


async def settings_store(body):
    with tempfile.TemporaryDirectory() as directory:
        store = FaultStore(directory, body.get("maxBytes", 16 * 1024 * 1024))
        path = Path(directory) / "state.json"
        if "stored" in body: path.write_text(body["stored"], encoding="utf-8")
        schema = SettingsSchema(body["descriptors"]); cipher = ConfigCipher(body["key"])
        settings = ServiceSettings(schema, cipher, None if body.get("memory") else store)
        outcomes = []
        async def write(step): return await settings.write(step["tenantId"], step["values"], app_id=step.get("appId"), clear_keys=step.get("clearKeys", []))
        try:
            for step in body["steps"]:
                result = {}
                try:
                    kind = step["kind"]
                    if kind == "initialize":
                        store.mode = step.get("mode", "ok")
                        result["loaded"] = await settings.initialize(legacy_tenant_id=step.get("legacyTenantId"))
                    elif kind == "write":
                        store.mode = step.get("mode", "ok")
                        result["values"] = await write(step)
                    elif kind == "read": result["values"] = settings.values(step["tenantId"], step.get("appId"), redacted=step.get("redacted", False))
                    elif kind == "effective": result["values"] = settings.effective(step["tenantId"], step["appId"])
                    elif kind == "mutate": settings.read(step["tenantId"])["tenant"]["secret"] = "MUTATED"
                    elif kind == "restart":
                        await settings.aclose(); settings = ServiceSettings(schema, cipher, store)
                    elif kind == "close": await settings.aclose()
                    elif kind == "concurrent": await asyncio.gather(*(write(value) for value in step["writes"]))
                    elif kind in ("cancel-write", "close-write", "concurrent-save", "cancel-initialize", "cancel-migration"):
                        store.mode = "block"; store.started = asyncio.Event(); store.release = asyncio.Event()
                        if kind == "cancel-initialize": store.load_mode = "block"
                        pending = asyncio.create_task(settings.initialize(legacy_tenant_id=step.get("legacyTenantId")) if kind in ("cancel-initialize", "cancel-migration") else write(step))
                        await asyncio.wait_for(store.started.wait(), 2)
                        if kind == "concurrent-save":
                            second = asyncio.create_task(write(step["following"]))
                            store.release.set(); await asyncio.gather(pending, second)
                        else:
                            if kind == "close-write": await settings.aclose()
                            else: pending.cancel()
                            try: await pending
                            except asyncio.CancelledError: result["cancelled"] = True
                            else: raise AssertionError("Expected cancellation")
                        store.mode = store.load_mode = "ok"
                    else: raise ValueError("Unknown test step")
                    result["valid"] = True
                except Exception as error: result.update(valid=False, errorType=type(error).__name__)
                result.update(ready=settings.ready, saves=store.saves, stored=path.read_text(encoding="utf-8") if path.exists() else None)
                outcomes.append(result)
            return {"outcomes": outcomes, "stored": path.read_text(encoding="utf-8") if path.exists() else None}
        finally: await settings.aclose()
