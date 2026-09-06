"""BP representation selection over parsed HTTP media ranges."""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable

from .contracts import contract

_MIME = {"json": "application/json", "html": "text/html", "metadata": "application/vnd.betterportal.metadata+json", "ndjson": "application/x-ndjson"}
_QUALITY = re.compile(r"(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)\Z")
_TOKEN = r"[!#$%&'*+.^_`|~A-Za-z0-9-]+"
_PARAM = re.compile(rf';[ \t]*({_TOKEN})[ \t]*=[ \t]*({_TOKEN}|"(?:[\t !#-\[\]-~\x80-\xff]|\\[\t !-~\x80-\xff])*")[ \t]*')
_RANGE = re.compile(rf"({_TOKEN}/{_TOKEN})[ \t]*")


def _ranges(raw: str):
    # email's MIME parser repairs malformed parameters and is not an HTTP parser.
    position = 0
    while position < len(raw):
        if raw[position] in " \t,":
            position += 1
            continue
        match = _RANGE.match(raw, position)
        if match is None:
            raise NotAcceptable("Invalid media range")
        media, position = match[1].lower(), match.end()
        if media.startswith("*/") and media != "*/*":
            raise NotAcceptable("Invalid media wildcard")
        params = {}
        while position < len(raw) and raw[position] == ";":
            parameter = _PARAM.match(raw, position)
            if parameter is None or parameter[1].lower() in params:
                raise NotAcceptable("Invalid media parameters")
            params[parameter[1].lower()] = parameter[2]
            position = parameter.end()
        if position < len(raw) and raw[position] != ",":
            raise NotAcceptable("Invalid media range")
        yield media, params


class NotAcceptable(ValueError):
    status = 406


@dataclass(frozen=True)
class Representation:
    kind: str
    mode: str | None = None


def negotiate(accept: str | None, available: Iterable[str] = tuple(_MIME)) -> Representation:
    """Honor q=0 and more-specific exclusions, then quality and request order."""
    supported = set(available)
    if not supported <= _MIME.keys():
        raise ValueError("Unknown representation")
    raw = accept if accept and accept.strip() else "*/*"
    if len(raw) > 8192 or any(ord(char) < 32 and char != "\t" or ord(char) == 127 for char in raw):
        raise NotAcceptable("Invalid Accept header")
    entries = []
    for index, (media, params) in enumerate(_ranges(raw)):
        quality_text = params.pop("q", "1")
        if not _QUALITY.fullmatch(quality_text):
            raise NotAcceptable("Invalid media quality")
        mode = params.get("mode")
        if mode is not None and mode.startswith('"'):
            mode = re.sub(r"\\(.)", r"\1", mode[1:-1])
        if mode is not None and not contract("RenderModeSchema").safe_parse(mode).success:
            mode = "invalid"
        entries.append((media, float(quality_text), mode, index))
    candidates = []
    for kind, mime in _MIME.items():
        if kind not in supported:
            continue
        for mode in ("page", "fragment", "embed") if kind == "html" else (None,):
            matches = []
            for media, quality, requested_mode, index in entries:
                if kind == "html" and (requested_mode or "page") != mode:
                    continue
                specificity = 2 if media == mime else 1 if media == mime.split("/")[0] + "/*" else 0 if media == "*/*" else -1
                if specificity >= 0:
                    matches.append((specificity + (1 if kind == "html" and requested_mode is not None else 0), quality, -index))
            if matches:
                _, quality, order = max(matches)
                if quality > 0:
                    candidates.append((quality, order, Representation(kind, mode)))
    if not candidates:
        raise NotAcceptable("No acceptable representation")
    return max(candidates, key=lambda candidate: candidate[:2])[2]
