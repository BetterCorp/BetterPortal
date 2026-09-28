"""Bounded, pull-driven wire decoders for dependency streams."""
from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator


@dataclass(frozen=True)
class SseMessage:
    event: str
    data: str
    id: str | None = None
    retry: int | None = None


async def sse_messages(chunks: AsyncIterator[bytes], maximum: int) -> AsyncIterator[SseMessage]:
    frame = bytearray()
    line_size, carriage, first = 0, False, True
    async for chunk in chunks:
        for byte in chunk:
            if carriage and byte == 10:
                carriage = False
                continue
            carriage = byte == 13
            frame.append(byte)
            if len(frame) > maximum: raise ValueError('SSE frame exceeds its byte limit')
            if byte not in (10, 13):
                line_size += 1
                continue
            if line_size:
                line_size = 0
                continue
            text = frame.decode('utf-8-sig' if first else 'utf-8')
            frame.clear(); first = False
            event, data, identifier, retry = 'message', [], None, None
            for line in text.replace('\r', '\n').split('\n'):
                name, colon, value = line.partition(':')
                if not colon: value = ''
                if value.startswith(' '): value = value[1:]
                if name == 'event': event = value
                elif name == 'data': data.append(value)
                elif name == 'id' and '\0' not in value: identifier = value
                elif name == 'retry' and value.isascii() and value.isdigit() and len(value) <= 10: retry = int(value)
            if data: yield SseMessage(event or 'message', '\n'.join(data), identifier, retry)
    if frame: raise ValueError('SSE stream ended inside a frame')


async def ndjson_lines(chunks: AsyncIterator[bytes], maximum: int) -> AsyncIterator[str]:
    buffer = bytearray()
    async for chunk in chunks:
        for part in chunk.splitlines(keepends=True):
            if len(buffer) + len(part) > maximum + 2: raise ValueError('NDJSON frame exceeds its byte limit')
            buffer.extend(part)
            if not buffer.endswith(b'\n'): continue
            line = bytes(buffer[:-1]).removesuffix(b'\r'); buffer.clear()
            if len(line) > maximum: raise ValueError('NDJSON frame exceeds its byte limit')
            yield line.decode('utf-8')
    if buffer: raise ValueError('NDJSON stream ended inside a frame')
