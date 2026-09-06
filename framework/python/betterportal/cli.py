"""Native BP authoring commands; no Node or BSB build hooks."""
import argparse
from pathlib import Path

from .contracts import document, names
from .jsoncodec import loads
from .typegen import generate_types
from .clientgen import generate_client


def main() -> None:
    parser = argparse.ArgumentParser(prog="bp-python")
    commands = parser.add_subparsers(dest="command", required=True)
    types = commands.add_parser("types", help="Generate Python input/output types from AnyVali contracts")
    sources = types.add_mutually_exclusive_group(required=True)
    sources.add_argument("--platform", action="store_true", help="Use embedded canonical BP contracts")
    sources.add_argument("--contracts", type=Path, help="An AnyVali JSON file or directory of documents")
    types.add_argument("--output", type=Path, required=True)
    types.add_argument("--check", action="store_true", help="Fail if the generated output is stale")
    client = commands.add_parser("client", help="Generate a typed JSON dependency client from an exported BP contract")
    client.add_argument("--contract", type=Path, required=True)
    client.add_argument("--output", type=Path, required=True)
    client.add_argument("--class-name", default="DependencyClient")
    client.add_argument("--check", action="store_true", help="Fail if the generated client is stale")
    args = parser.parse_args()
    if args.command == "client":
        output = generate_client(loads(args.contract.read_text(encoding="utf-8")), args.class_name)
        description = "dependency client"
    elif args.platform:
        documents = {name: document(name) for name in names()}
        output = generate_types(documents)
        description = f"{len(documents)} AnyVali contracts"
    else:
        files = sorted(args.contracts.glob("*.json")) if args.contracts.is_dir() else [args.contracts]
        if not files:
            parser.error("No contract documents found")
        documents = {path.stem: loads(path.read_text(encoding="utf-8")) for path in files}
        output = generate_types(documents)
        description = f"{len(documents)} AnyVali contracts"
    if args.check:
        if not args.output.is_file() or args.output.read_text(encoding="utf-8") != output:
            parser.error("Generated output is stale")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8", newline="\n")
    print(f"Checked {description}")
