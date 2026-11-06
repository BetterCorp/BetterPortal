"""The single boundary for Python environment configuration and AnyVali validation."""
from __future__ import annotations

from ipaddress import ip_network
import os
from pathlib import Path
from typing import Mapping, Any

import anyvali as av

from .keys import secure_endpoint

# Environment transport names are kept here; runtime owners receive parsed values.
_MASTER_KEY_SCHEMA = av.string().pattern(r"^bp_bsk_[A-Za-z0-9_-]{43}$")
_FIELDS: dict[str, av.BaseSchema[Any]] = {
    "BP_CP_URL": av.optional(av.string().max_length(4096)),
    "BP_PUBLIC_ORIGIN": av.optional(av.string().min_length(1).max_length(4096)),
    "BP_STATE_DIRECTORY": av.optional(av.string().max_length(4096)),
    "BP_BOOTSTRAP_MASTER_KEY": av.optional(av.union([av.literal(""), _MASTER_KEY_SCHEMA])),
    "BP_BOOTSTRAP_MASTER_KEY_FILE": av.optional(av.string().max_length(4096)),
    "BP_TRUSTED_PROXIES": av.optional(av.string().max_length(65536)),
    "BP_REGISTRY_URL": av.optional(av.string().min_length(1).max_length(4096)),
    "BP_REGISTRY_TOKEN": av.optional(av.string().max_length(32768).pattern(r"^[!-~]*$")),
    "BP_DEV_PATHS": av.optional(av.string().max_length(65536)),
}
_ENVIRONMENT_SCHEMA = av.object_(_FIELDS, required=[], unknown_keys="reject")


def read_environment(environment: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Read supported settings only; never include secret inputs in errors."""
    source = os.environ if environment is None else environment
    name = "configuration"
    try:
        value = _ENVIRONMENT_SCHEMA.parse({name: source[name] for name in _FIELDS if name in source})
        for name in ("BP_CP_URL", "BP_PUBLIC_ORIGIN", "BP_REGISTRY_URL"):
            if value.get(name): secure_endpoint(value[name])
        for name in ("BP_STATE_DIRECTORY", "BP_BOOTSTRAP_MASTER_KEY_FILE", "BP_DEV_PATHS"):
            if "\x00" in value.get(name, ""): raise ValueError("Invalid path")
        name = "BP_TRUSTED_PROXIES"
        for proxy in value.get(name, "").split(","):
            if proxy.strip(): ip_network(proxy.strip(), strict=False)
    except av.ValidationError as error:
        names = sorted({str(issue.path[0]) for issue in error.issues if issue.path})
        raise ValueError("Invalid BetterPortal environment settings: " + ", ".join(names)) from None
    except ValueError:
        raise ValueError("Invalid BetterPortal environment setting: " + name) from None
    return value


def deployment_environment(environment: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Resolve and validate host secrets before creating any runtime resource."""
    value = read_environment(environment)
    if "BP_PUBLIC_ORIGIN" not in value: raise ValueError("Configure BP_PUBLIC_ORIGIN")
    key, key_file = value.get("BP_BOOTSTRAP_MASTER_KEY"), value.get("BP_BOOTSTRAP_MASTER_KEY_FILE")
    if bool(key) == bool(key_file): raise ValueError("Configure exactly one bootstrap master key source")
    if key_file:
        with Path(key_file).open("r", encoding="ascii") as source:
            key = source.read(256).strip()
            if source.read(1): raise ValueError("Bootstrap key file is too large")
    try: value["BP_BOOTSTRAP_MASTER_KEY"] = _MASTER_KEY_SCHEMA.parse(key)
    except av.ValidationError: raise ValueError("Invalid bootstrap master key") from None
    return value
