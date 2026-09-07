"""Build and install scaffolded services from native packages against the Node config manager."""
import argparse
import base64
from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile

from hosting_cases import fixture
from key_cases import peer as key_peer
from security_cases import post, TENANT, SOURCE, TARGET, fixtures

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("packages", type=Path)
args = parser.parse_args()
packages = args.packages.resolve()
root = Path(__file__).resolve().parents[2]
python, dotnet, node = sys.executable, shutil.which("dotnet"), shutil.which("node")
assert dotnet and node
wheel, = packages.glob("betterportal-*.whl")
tool_package, = packages.glob("BetterPortal.Tool.*.nupkg")
environment = dict(os.environ)
# Build/run consumer services with Node unavailable; only the test CP uses it.
environment["PATH"] = os.pathsep.join(part for part in environment["PATH"].split(os.pathsep)
    if not any((Path(part) / name).is_file() for name in ("node", "node.exe")))
assert shutil.which("node", path=environment["PATH"]) is None
environment["PYTHONPATH"] = str(wheel)
for name in ("BP_CP_URL", "BP_PUBLIC_ORIGIN", "BP_BOOTSTRAP_MASTER_KEY", "BP_STATE_DIRECTORY"):
    environment.pop(name, None)
checks = 0


def run(command, directory, expected=True, env=None):
    global checks
    result = subprocess.run(command, cwd=directory, env=env or environment,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
        timeout=180, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    assert (result.returncode == 0) == expected, result.stdout[-5000:]
    checks += 1
    return result.stdout


def unpack(archive_path, target):
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            path = (target / member.filename).resolve()
            assert target.resolve() in path.parents, member.filename
        archive.extractall(target)


@contextmanager
def server(command, directory, env):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0)); port = probe.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as log:
        process = subprocess.Popen(command(port, url), cwd=directory, env=env,
            stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline and process.poll() is None:
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.1): break
                except OSError: time.sleep(0.05)
            else:
                log.seek(0); raise AssertionError("Service failed to start: " + log.read()[-4000:])
            yield url
        finally:
            if process.poll() is None: process.terminate()
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()


def request(url, path, status, data=None, headers=None):
    global checks
    value = Request(url + path, None if data is None else json.dumps(data).encode(), headers or {})
    if data is not None: value.add_header("Content-Type", "application/json")
    deadline = time.monotonic() + 5
    while True:
        try: response = urlopen(value, timeout=10)
        except HTTPError as error: response = error
        with response:
            raw = response.read().decode()
            # Initial poll and SSE snapshots can overlap a read. Retry only this
            # explicit policy-change response; all other errors fail immediately.
            if (path == "/hello" and data is None and response.status == 503
                    and json.loads(raw) == {"error": "Configuration changed during authentication"}
                    and time.monotonic() < deadline):
                time.sleep(0.05)
                continue
            assert response.status == status, (path, response.status, raw[:1500])
            checks += 1
            return json.loads(raw) if "application/json" in response.headers.get("content-type", "") else raw


with tempfile.TemporaryDirectory(prefix="bp-scaffold-", dir=root / ".tmp-run") as temporary:
    directory = Path(temporary)
    unpack(tool_package, directory / "tool")
    tool, = (directory / "tool").glob("tools/*/any/BetterPortal.Tool.dll")
    # Restore app dependencies offline into a fresh cache; exclude older BP builds.
    dependencies = directory / "dependencies"; dependencies.mkdir()
    cache = Path(os.environ.get("NUGET_PACKAGES", str(Path.home() / ".nuget/packages")))
    for package in cache.glob("*/*/*.nupkg"):
        if not package.name.lower().startswith("betterportal."):
            shutil.copyfile(package, dependencies / package.name)
    commands = {"python": [python, "-m", "betterportal"], "dotnet": [dotnet, str(tool)]}
    title = 'Hello "BP"\nCafé'
    for language, command in commands.items():
        print("Checking packaged " + language + " scaffolding", flush=True)
        project = directory / (language + " service")
        init = [*command, "init", str(project), "--plugin-id", "com.example.service", "--registry-ref", "example/service", "--title", title]
        for option, invalid in (("--plugin-id", "bad"), ("--registry-ref", "../outside"), ("--title", "")):
            bad = init.copy(); bad[bad.index(option) + 1] = invalid
            run(bad, directory, False); assert not project.exists()
        run(init, directory)
        original = {file.relative_to(project): file.read_bytes() for file in project.rglob("*") if file.is_file()}
        run(init, directory, False)
        assert original == {file.relative_to(project): file.read_bytes() for file in project.rglob("*") if file.is_file()}
        assert json.loads((project / "betterportal.json").read_text())["registryRef"] == "example/service"
        assert not (project / "package.json").exists()
        run([*command, "deps", "sync", "--project", str(project), "--frozen", "--check"], directory)
        env = environment.copy()
        if language == "python":
            run([python, "-m", "build", str(project), "--wheel", "--no-isolation", "--outdir", str(project / "dist")], directory)
            application_wheel, = (project / "dist").glob("*.whl")
            installed = directory / "installed-python"; unpack(application_wheel, installed)
            env["PYTHONPATH"] += os.pathsep + str(installed)
            export = [*command, "export", "--module", "my_service.definition:contract", "--project", str(installed), "--output", "bp-contract.json"]
            runtime = [python, "-m", "uvicorn", "my_service.app:create_app", "--factory", "--host", "127.0.0.1"]
            host = lambda port, url: [*runtime, "--port", str(port)]
            contract_path = installed / "bp-contract.json"
        else:
            run([dotnet, "restore", str(project), "--packages", str(directory / "nuget"), "--source", str(packages), "--source", str(dependencies)], directory)
            run([dotnet, "restore", str(project), "--locked-mode", "--packages", str(directory / "nuget"), "--source", str(packages), "--source", str(dependencies)], directory)
            run([dotnet, "build", str(project), "--no-restore", "-m:1", "-p:UseSharedCompilation=false"], directory)
            assembly = project / "bin/Debug/net10.0/BpService.dll"
            export = [*command, "export", "--assembly", str(assembly), "--factory", "BpService.Definition:Export", "--project", str(project), "--output", "bp-contract.json"]
            runtime = [dotnet, str(assembly)]
            generated_key = run([*runtime, "--new-bootstrap-key"], directory).strip()
            assert generated_key.startswith("bp_bsk_") and len(base64.urlsafe_b64decode(generated_key[7:] + "=")) == 32
            host = lambda port, url: [*runtime, "--urls", url, "--Logging:LogLevel:Default", "Warning"]
            contract_path = project / "bp-contract.json"
        run(export, directory, env=env)
        run([*export, "--check"], directory, env=env)
        contract = json.loads(contract_path.read_text())
        assert contract["manifest"]["title"] == title and contract["manifest"]["pluginId"] == "com.example.service"
        view, = contract["manifest"]["views"]
        assert view["viewId"] == "hello.index" and view["operations"][0]["auth"]["required"] is True
        run(runtime, directory, False, env=env)  # Required host secrets are not scaffolded.
        with server(lambda port, url: [node, str(root / "framework/conformance/node-schema-server.mjs"), str(port)], directory, os.environ.copy()) as peer, key_peer() as (key_url, keys, _, _):
            signer = post(peer, {"action": "jwt-key"})["jwk"]
            keys["/auth-keys"] = [{"body": {"keys": [signer]}}]
            token = post(peer, {"action": "jwt-sign", "purpose": "access", "claims": fixtures()["access"]})["token"]
            authenticated = {"origin": "https://app.test", "accept": "application/json", "authorization": "Bearer " + token}
            config = {name: fixture()["snapshot"][name] for name in ("tenants", "apps")}
            config["tenants"][0]["services"][1].update(serviceId="com.example.theme", hostname="https://theme.test")
            config["apps"][0]["routes"][0].update(path="/hello", viewId="hello.index", operations=["hello.get"], resolvedServicePath="/hello")
            config["apps"][0]["auth"] = {"serviceId": TARGET, "expectedIssuer": fixtures()["access"]["iss"], "expectedAudience": fixtures()["access"]["aud"],
                "jwksUri": key_url + "/auth-keys", "roles": [{"id": "reader", "title": "Reader", "permissions": []}]}
            config["apps"][0]["shell"] = {"serviceId": SOURCE}
            # Platform app config stores only the shell instance; the real CP resolves
            # its renderer from cached shell metadata before submitting the snapshot.
            config["manifestCache"] = [{"serviceId": SOURCE, "manifestVersion": "1.0.0", "fetchedAt": "2026-09-01T00:00:00Z",
                "shell": {"service": "bootstrap1", "renderer": "bootstrap5", "fragments": []}}]
            control = post(peer, {"action": "sync-peer", "command": "start", "config": config, "setup": True, "jwks": [signer]})
            try:
                env.update(BP_CP_URL=control["url"], BP_PUBLIC_ORIGIN="https://service.test",
                    BP_BOOTSTRAP_MASTER_KEY="bp_bsk_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="),
                    BP_STATE_DIRECTORY=str(project / ".bp-state"))
                with server(host, directory, env) as address:
                    assert request(address, "/.well-known/bp/health", 503) == {"ok": False}
                    assert request(address, "/.well-known/bp/manifest", 200)["pluginId"] == "com.example.service"
                    issued = post(control["url"] + "/.well-known/bp/admin/services/begin-install", {"serviceUrl": "https://service.test", "tenantId": TENANT, "instanceId": TARGET})
                    result = request(address, "/.well-known/bp/install", 200, {"setupToken": issued["setupToken"], "cpUrl": control["url"]})
                    assert result["ok"] and "apiKey" not in result
                    assert request(address, "/.well-known/bp/health", 200) == {"ok": True}
                    request(address, "/hello", 401, headers={"origin": "https://app.test", "accept": "application/json"})
                    assert request(address, "/hello", 200, headers=authenticated) == "Hello"
                    assert "<p>Hello</p>" in request(address, "/hello", 200, headers={**authenticated, "accept": "text/html"})
                stored = (project / ".bp-state/bootstrap.json").read_text()
                assert "PRIVATE KEY" not in stored and "bp_sk_t_" not in stored
                with server(host, directory, env) as address:
                    # Managed startup synchronizes persisted credentials before accepting requests.
                    assert request(address, "/.well-known/bp/health", 200) == {"ok": True}
                    request(address, "/hello", 401, headers={"origin": "https://app.test", "accept": "application/json"})
                    assert request(address, "/hello", 200, headers=authenticated) == "Hello"
                state = post(peer, {"action": "sync-peer", "command": "state", "id": control["id"]})
                assert sum(call["path"] == "/.well-known/bp/services/redeem" for call in state["calls"]) == 1
                service_manifest, = [entry for entry in state["config"]["manifestCache"] if entry["serviceId"] == TARGET]
                assert service_manifest["viewIndex"]["hello.index"]["operations"][0]["operationId"] == "hello.get"
            finally: post(peer, {"action": "sync-peer", "command": "stop", "id": control["id"]})
print(f"{checks} packaged scaffold, export and config-manager installation checks passed")
