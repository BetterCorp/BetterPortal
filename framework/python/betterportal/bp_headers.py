"""BP-managed browser header directives, independent of HTTP hosting."""
from __future__ import annotations

import re
import time
from .urls import _path


class BpHeaders:
    def __init__(self):
        self._values: dict[str, tuple[str, str]] = {}

    @staticmethod
    def _name(name: str) -> None:
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', name): raise ValueError('Invalid BP header name')

    def set(self, name: str, value: str, *, locked: bool = False, scope_to_owner: bool = False,
            expires_in_seconds: int | None = None, refresh_path: str | None = None, refresh_before_seconds: int | None = None) -> None:
        self._name(name)
        if len(value) > 16384 or any(ord(char) < 32 or ord(char) > 126 or char in ';,' for char in value): raise ValueError('Invalid BP header value')
        parts = [name + '=' + value]
        if locked: parts.append('locked=true')
        if scope_to_owner: parts.append('scope=true')
        for duration in (expires_in_seconds, refresh_before_seconds):
            if duration is not None and (isinstance(duration, bool) or not isinstance(duration, int) or not 0 < duration <= 31536000): raise ValueError('Invalid BP header lifetime')
        if expires_in_seconds is not None: parts.append('expires=' + str(int(time.time()) + expires_in_seconds))
        if refresh_path is not None:
            _path(refresh_path)
            if not refresh_path.isascii() or any(char in refresh_path for char in ';,'): raise ValueError('Invalid header refresh path')
            parts.append('refresh=' + refresh_path)
        if refresh_before_seconds is not None: parts.append('refreshBefore=' + str(refresh_before_seconds))
        self._values[name.lower()] = ('BP-SetHeader', '; '.join(parts))

    def remove(self, name: str) -> None:
        self._name(name)
        self._values[name.lower()] = ('BP-RemoveHeader', name)

    def emit(self) -> tuple[tuple[str, str], ...]: return tuple(self._values.values())
