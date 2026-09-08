"""Export an explicitly selected application module's BP contract factory."""
import importlib
import inspect
import json
from pathlib import Path
import sys

from .contracts import parse
from .project import _read, _write


def export_contract(module: str, project: Path, output: Path, *, check: bool = False) -> None:
    name, separator, member = module.partition(":")
    if not separator or not name or not member.isidentifier():
        raise ValueError("Use --module package.module:factory")
    # Application imports are explicit authoring code, executed only by this command.
    previous_path = sys.path.copy()
    sys.path.insert(0, str(project.resolve()))
    try:
        factory = getattr(importlib.import_module(name), member)
        if not callable(factory) or inspect.iscoroutinefunction(factory) or inspect.signature(factory).parameters:
            raise ValueError("The contract factory must be synchronous and take no arguments")
        contract = parse("BpSchemaOutputSchema", factory())
    finally:
        sys.path[:] = previous_path
    data = (json.dumps(contract, ensure_ascii=True, indent=2, allow_nan=False) + "\n").encode()
    if len(data) > 16 * 1024 * 1024: raise ValueError("Exported contract exceeds its size limit")
    path = project / output
    if check:
        if not path.is_file() or _read(path) != data: raise ValueError("Exported contract is stale")
    else: _write(path, data)
