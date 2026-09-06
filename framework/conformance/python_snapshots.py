"""Test-only fault injection around real standalone snapshot policy and file storage."""
import asyncio
import json
from pathlib import Path
import tempfile
import threading

import httpx
from betterportal.contracts import contract
from betterportal.handler import Handler
from betterportal.registry import Registry, Route, Operation
from betterportal.service import Service, RequestError
from betterportal.storage import FileStateStore


async def snapshots(body):
    with tempfile.TemporaryDirectory() as directory:
        if body.get("workerProbe"):
            started, release = threading.Event(), threading.Event()
            class SlowStore(FileStateStore):
                def _prepare(self, data):
                    temporary = super()._prepare(data)
                    started.set(); release.wait(3)
                    return temporary
            target = Path(directory) / "state.json"; target.write_bytes(b"old")
            task = asyncio.create_task(SlowStore(target).save(b"new"))
            assert await asyncio.to_thread(started.wait, 3)
            task.cancel(); await asyncio.sleep(0); task.cancel(); await asyncio.sleep(0)
            release.set()
            cancelled = False
            try: await task
            except asyncio.CancelledError: cancelled = True
            return {"cancelled": cancelled, "preserved": target.read_bytes() == b"old", "temporaryFiles": len(list(Path(directory).glob("*.tmp")))}
        if body.get("fileProbe"):
            target = Path(directory) / "blocked"; target.mkdir()
            (target / "sentinel").write_bytes(b"old")
            failed = False
            try: await FileStateStore(target).save(b"new")
            except OSError: failed = True
            return {"failed": failed, "preserved": (target / "sentinel").read_bytes() == b"old", "temporaryFiles": len(list(Path(directory).glob("*.tmp")))}
        class Store:
            def __init__(self):
                self.file = FileStateStore(Path(directory) / "state.json", max_bytes=body.get("maxBytes", 16 * 1024 * 1024))
                self.mode = "ok"; self.started = asyncio.Event(); self.release = asyncio.Event(); self.saves = 0
            async def load(self): return await self.file.load()
            async def save(self, data):
                self.saves += 1
                if self.mode == "fail": raise OSError("Injected persistence failure")
                if self.mode == "block": self.started.set(); await self.release.wait()
                await self.file.save(data)
        store = Store()
        if "stored" in body:
            (Path(directory) / "state.json").write_bytes(body["stored"].encode())
        route = Route("check", "/check/:key", [Operation(Handler(contract("JsonObjectSchema"), lambda ctx: {}),
            {"operationId": "check.get", "method": "GET", "title": "Check", "description": "Check", "auth": body.get("auth", {})})])
        service = Service(Registry([route]), body["declaration"], state_store=store, managed=body.get("managed", True), preview_key=body.get("previewKey"))
        async def prepare(headers):
            try:
                context, _ = await service.prepare(route, "GET", "/check/item", headers)
                return {"status": 200, "config": dict(context.config), "url": context.urls.route("check", {"params": {"key": "item"}, "absolute": True})}
            except RequestError as error: return {"status": error.status}
        def state(): return {"ready": service.ready, "snapshot": service.snapshot()}
        outcomes = []
        try:
            for step in body["steps"]:
                value = {}
                try:
                    if step.get("kind") == "restore": value["restored"] = await service.restore_snapshot()
                    elif step.get("kind") == "read":
                        value["request"] = await prepare(step["headers"])
                    elif step.get("kind") == "close": await service.aclose()
                    elif step.get("kind") == "mutate":
                        document = service.snapshot(); document["tenants"][0]["title"] = "MUTATED"
                    elif step.get("kind") == "auth-race":
                        task = asyncio.create_task(prepare(step["headers"]))
                        async with httpx.AsyncClient(trust_env=False) as client:
                            try:
                                response = await client.get(step["uri"] + "/control/started"); response.raise_for_status()
                                if step.get("cancel"): task.cancel()
                                else: await service.apply_snapshot(step["snapshot"])
                            finally: await client.get(step["uri"] + "/control/release")
                        try: value["request"] = await task
                        except asyncio.CancelledError: value["request"] = {"cancelled": True}
                    else:
                        store.mode = step.get("save", "ok")
                        if store.mode == "block":
                            store.started.clear(); store.release.clear()
                            task = asyncio.create_task(service.apply_snapshot(step["snapshot"], manifest_submitted=step.get("submitted", False)))
                            await asyncio.wait_for(store.started.wait(), 3)
                            value["during"] = state()
                            queued = asyncio.create_task(service.apply_snapshot(step["queued"])) if "queued" in step else None
                            if step.get("cancel"): task.cancel()
                            elif step.get("shutdown"): await service.aclose()
                            else: store.release.set()
                            try: await task
                            except asyncio.CancelledError: value["cancelled"] = True
                            if queued: await queued
                        else: await service.apply_snapshot(step["snapshot"], manifest_submitted=step.get("submitted", False))
                    value["accepted"] = True
                except Exception: value["accepted"] = False
                value.update(state()); outcomes.append(value)
            stored = await store.load()
            return {"steps": outcomes, "stored": stored.decode() if stored else None, "saves": store.saves,
                    "temporaryFiles": len(list(Path(directory).glob("*.tmp")))}
        finally: await service.aclose()
