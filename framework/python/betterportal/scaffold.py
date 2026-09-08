"""Create a standalone service using the installed native runtime."""
from importlib.metadata import version
import json
from pathlib import Path

from .contracts import parse


def scaffold(directory: Path, plugin_id: str, registry_ref: str, title: str) -> None:
    declaration = {"pluginId": plugin_id, "title": title, "description": title, "version": "1.0.0"}
    parse("ManifestDeclarationSchema", declaration)
    config = parse("BetterPortalProjectConfigSchema", {"registryRef": registry_ref, "defaultNamespace": registry_ref.split("/")[0]})
    runtime = version("betterportal")
    files = {
        "betterportal.json": json.dumps(config, indent=2) + "\n",
        "betterportal.lock.json": json.dumps(parse("BetterPortalLockSchema", {}), indent=2) + "\n",
        ".gitignore": ".venv/\n__pycache__/\n*.egg-info/\n.bp-state/\n.bp-generated/\n.env\n",
        "pyproject.toml": f'''[build-system]
requires = ["setuptools>=77"]
build-backend = "setuptools.build_meta"

[project]
name = {json.dumps(registry_ref.replace('/', '-'))}
version = "1.0.0"
requires-python = ">=3.10"
dependencies = ["betterportal[asgi]=={runtime}", "uvicorn==0.52.4"]

[tool.setuptools.packages.find]
include = ["my_service*"]
''',
        "my_service/__init__.py": "",
        "my_service/bp_routes/__init__.py": "",
        "my_service/bp_routes/hello/index.py": '''from betterportal.generated_types import RouteDeclarationInput

def create() -> RouteDeclarationInput:
    return {"viewId": "hello.index", "title": "Hello"}
''',
        "my_service/bp_routes/hello/GET.py": '''from typing import Any
import anyvali as av
from betterportal.handler import Handler, HandlerContext
from betterportal.registry import Operation
from betterportal.rendering import Renderer

def hello(context: HandlerContext[Any, Any, Any, Any]) -> str:
    return "Hello"

def create() -> Operation:
    page = Renderer[str]({"renderer": "bootstrap5"}, lambda value, context: "<p>Hello</p>")
    return Operation(Handler(av.string(), hello, renderers=[page]), {
        "operationId": "hello.get", "method": "GET", "title": "Hello",
        "description": "Return a greeting", "auth": {"required": True}
    })
''',
        "my_service/definition.py": f'''from betterportal.discovery import discover
from betterportal.generated_types import BpSchemaOutput, ManifestDeclarationInput
from betterportal.registry import Registry

declaration: ManifestDeclarationInput = {declaration!r}

def registry() -> Registry:
    return discover("my_service.bp_routes")

def contract() -> BpSchemaOutput:
    return registry().schema(declaration)
''',
        "my_service/app.py": '''import os
from pathlib import Path
from betterportal.asgi import create_app as asgi_app
from betterportal.bootstrap import BootstrapStateStore
from betterportal.installation import ServiceInstallation
from betterportal.service import Service
from betterportal.storage import FileStateStore
from .definition import declaration, registry

def create_app():
    directory = Path(os.environ.get("BP_STATE_DIRECTORY", ".bp-state"))
    service = Service(registry(), declaration, managed=True,
        state_store=FileStateStore(directory / "snapshot.json"))
    installation = ServiceInstallation(service,
        BootstrapStateStore(FileStateStore(directory / "bootstrap.json"), os.environ["BP_BOOTSTRAP_MASTER_KEY"]),
        os.environ["BP_CP_URL"], os.environ["BP_PUBLIC_ORIGIN"],
        settings_store=FileStateStore(directory / "settings.json"))
    return asgi_app(service, installation=installation)
''',
        "README.md": '''# Standalone BP service

Install the matching native BP packages into a Python 3.10+ environment, then run:

    python -m pip install -e .
    bp-python export --module my_service.definition:contract --output bp-contract.json
    bp-python deps sync --frozen --check

For unpublished packages, add --find-links /path/to/local/packages to pip install.
No Node or BSB installation is needed by this service.

Configure BP_CP_URL (trusted config manager), BP_PUBLIC_ORIGIN (this service's
public origin), and BP_BOOTSTRAP_MASTER_KEY through your host's protected secrets.
Generate a master key once and retain it across restarts:

    python -c "from betterportal.bootstrap import BootstrapCipher; print(BootstrapCipher.generate_key())"

BP_STATE_DIRECTORY defaults to .bp-state; mount persistent storage there in a
container. Keep the master key separate from that directory. URLs require HTTPS
except the runtime's exact loopback development exceptions.

    python -m uvicorn my_service.app:create_app --factory --host 127.0.0.1 --port 8000

Install through the existing config manager using the configured public origin.
Health at /.well-known/bp/health returns 503 until installation, manifest submission
and a valid scoped snapshot succeed. Mount hello.index / hello.get in an app;
/hello then returns JSON or Bootstrap HTML with valid user authentication.
Application ASGI lifespan owns installation, sync and shutdown cancellation.

Edit my_service/definition.py for BP identity/version and bp_routes for operations.
Keep betterportal.json and betterportal.lock.json in source control. Use native deps
commands for dependency contracts and repeat export after changing the registry.
''',
    }
    directory.mkdir(parents=True, exist_ok=False)
    for name, content in files.items():
        target = directory / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("x", encoding="utf-8", newline="\n") as output:
            output.write(content)
