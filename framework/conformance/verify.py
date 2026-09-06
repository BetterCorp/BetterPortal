"""Launch disposable loopback adapters, run the HTTP gate, and always stop them.

Build the Node framework and .NET Conformance project before running this file.
Only Python's standard library is used by the orchestrator.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--python", default=sys.executable, help="Python with the pinned AnyVali package installed")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--roundtrip-all", action="store_true")
    parser.add_argument("--suite", choices=["schema", "security", "keys", "encryption", "authorization", "media", "streams", "all"], default="all")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    dll = root.parent / "dotnet/Conformance/bin/Debug/net10.0/Conformance.dll"
    if not dll.is_file():
        parser.error("Build framework/dotnet/Conformance first")
    commands = [
        ["node", str(root / "node-schema-server.mjs")],
        [args.python, str(root / "python_schema_server.py")],
        ["dotnet", str(dll)],
    ]
    processes = []
    urls = []
    try:
        with ExitStack() as stack:
            for index, command in enumerate(commands):
                with socket.socket() as probe:
                    probe.bind(("127.0.0.1", 0))
                    port = probe.getsockname()[1]
                url = f"http://127.0.0.1:{port}"
                command += [str(port)] if index < 2 else ["--urls", url, "--Logging:LogLevel:Default", "Warning"]
                log = stack.enter_context(tempfile.TemporaryFile(mode="w+", encoding="utf-8"))
                process = subprocess.Popen(command, stdout=log, stderr=log,
                                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                processes.append(process)
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline and process.poll() is None:
                    try:
                        with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                            break
                    except OSError:
                        time.sleep(0.05)
                else:
                    log.seek(0)
                    raise RuntimeError(f"Adapter failed to start: {command}\n{log.read()}")
                urls.append(url)
            command = [sys.executable, str(root / "run.py"), *urls, "--labels", "node", "python", "dotnet", "--all-contracts", "--suite", args.suite]
            if args.roundtrip_all:
                command.append("--roundtrip-all")
            if args.report:
                command += ["--report", str(args.report)]
            return subprocess.call(command)
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
