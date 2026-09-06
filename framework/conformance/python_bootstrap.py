"""Real bootstrap persistence with failure/cancellation injection."""
import asyncio
from tempfile import TemporaryDirectory
from betterportal.bootstrap import BootstrapCipher, BootstrapStateStore
from python_storage import FaultStore


async def bootstrap_request(body):
    try:
        cipher = BootstrapCipher(body["key"])
        if body["operation"] == "encrypt": return {"valid": True, "stored": cipher.encrypt(body["state"]).decode()}
        if body["operation"] == "decrypt": return {"valid": True, "state": cipher.decrypt(body["stored"].encode())}
        with TemporaryDirectory(prefix="bp-bootstrap-") as directory:
            fault = FaultStore(directory, body.get("limit", 2 * 1024 * 1024))
            if "stored" in body: await fault.file.save(body["stored"].encode())
            store = BootstrapStateStore(fault, body["key"])
            outcomes = []
            for step in body["steps"]:
                fault.mode = step.get("mode", "ok")
                result = {"valid": True}
                try:
                    kind = step["kind"]
                    if kind == "read": result["state"] = await store.read(redacted=step.get("redacted", False))
                    elif kind == "write": result["state"] = await store.write(step["patch"])
                    elif kind == "clear": await store.clear()
                    elif kind == "identity": result["jwk"] = (await store.identity()).public_jwk()
                    elif kind == "restart": store = BootstrapStateStore(fault, body["key"])
                    elif kind == "parallel": await asyncio.gather(*(store.write(patch) for patch in step["patches"]))
                    elif kind == "cancel":
                        fault.mode = "block"; fault.started = asyncio.Event(); fault.release = asyncio.Event()
                        task = asyncio.create_task(store.identity() if step.get("identity") else store.write(step["patch"]))
                        await asyncio.wait_for(fault.started.wait(), 5)
                        task.cancel()
                        try: await task
                        except asyncio.CancelledError: result["cancelled"] = True
                        finally: fault.release.set()
                    else: raise ValueError("Unknown bootstrap step")
                except Exception as error: result = {"valid": False, "error": str(error)}
                result["stored"] = (await fault.file.load() or b"").decode()
                outcomes.append(result)
            return {"valid": True, "outcomes": outcomes}
    except Exception as error: return {"valid": False, "error": str(error)}
