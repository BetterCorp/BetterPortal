"""Shared persistence fault injection around the runtime's real file store."""
import asyncio
from pathlib import Path
from betterportal.storage import FileStateStore


class FaultStore:
    def __init__(self, directory, limit=16 * 1024 * 1024):
        self.file = FileStateStore(Path(directory) / "state.json", max_bytes=limit)
        self.mode = "ok"; self.load_mode = "ok"; self.started = asyncio.Event(); self.release = asyncio.Event(); self.saves = 0
        self.after_save = None
    async def load(self):
        if self.load_mode == "block": self.started.set(); await self.release.wait()
        return await self.file.load()
    async def save(self, data):
        self.saves += 1
        if self.mode == "fail": raise OSError("Injected persistence failure")
        if self.mode == "block": self.started.set(); await self.release.wait()
        await self.file.save(data)
        if self.after_save is not None: self.after_save()
