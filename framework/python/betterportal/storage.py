"""Replaceable storage for one complete runtime state, independent of BP policy."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
import secrets
from typing import Protocol


class StateStore(Protocol):
    async def load(self) -> bytes | None: ...
    async def save(self, data: bytes) -> None:
        """Atomically replace state. An exception must leave the prior state intact."""
        ...


class FileStateStore:
    """One writer per file; use a transactional shared store for multiple replicas."""
    def __init__(self, path: str | Path, *, max_bytes: int = 16 * 1024 * 1024):
        if max_bytes < 1: raise ValueError("Invalid state size limit")
        self.path, self.max_bytes = Path(path).absolute(), max_bytes

    async def load(self) -> bytes | None:
        def read():
            try:
                with self.path.open("rb") as stream: value = stream.read(self.max_bytes + 1)
            except FileNotFoundError: return None
            if len(value) > self.max_bytes: raise ValueError("Stored state exceeds the size limit")
            return value
        return await asyncio.to_thread(read)

    def _prepare(self, data: bytes) -> Path:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(self.path.name + "." + secrets.token_hex(16) + ".tmp")
        created = False
        try:
            # Exclusive creation, POSIX 0600. Permission failures must surface immediately;
            # tempfile's Windows collision retry also retries PermissionError indefinitely.
            with open(temporary, "xb", opener=lambda path, flags: os.open(path, flags, 0o600)) as stream:
                created = True
                stream.write(data); stream.flush(); os.fsync(stream.fileno())
            return temporary
        except BaseException:
            if created: temporary.unlink(missing_ok=True)
            raise

    async def save(self, data: bytes) -> None:
        if not isinstance(data, bytes): raise TypeError("State must be bytes")
        if len(data) > self.max_bytes: raise ValueError("State exceeds the size limit")
        preparation = asyncio.create_task(asyncio.to_thread(self._prepare, data))
        try: temporary = await asyncio.shield(preparation)
        except BaseException:
            # A cancelled worker cannot be abandoned with an open or orphaned temp file.
            while not preparation.done():
                try: await asyncio.shield(preparation)
                except asyncio.CancelledError: continue
                except BaseException: break
            if not preparation.cancelled() and preparation.exception() is None:
                preparation.result().unlink(missing_ok=True)
            raise
        try:
            # No suspension between the atomic commit and returning success to the owner.
            os.replace(temporary, self.path)
        finally:
            temporary.unlink(missing_ok=True)
