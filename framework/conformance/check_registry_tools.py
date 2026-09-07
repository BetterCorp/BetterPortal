"""Native CLI installation/publishing against the real Node registry and hostile HTTP peers."""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import build_opener, ProxyHandler

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "framework/python"))
from client_cases import target_fixture
from python_registry import registry_request

environment = {**os.environ, "PYTHONPATH": str(root / "framework/python"), "BP_REGISTRY_TOKEN": "fixture-publisher-token"}
tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
native = {"python": [sys.executable, "-m", "betterportal"], "dotnet": ["dotnet", str(tool)]}
http = build_opener(ProxyHandler({}))
checks = 0
(root / ".tmp-run").mkdir(exist_ok=True)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")

def snapshot(directory):
    return {str(path.relative_to(directory)): path.read_bytes() for path in directory.rglob("*") if path.is_file()}

def run(command, directory, valid=True, env=None):
    global checks
    result = subprocess.run(command, cwd=directory, env=env or environment, capture_output=True, text=True, encoding="utf-8", timeout=45)
    assert (result.returncode == 0) == valid, (command, result.stdout, result.stderr)
    checks += 1
    if not valid: assert "fixture-publisher-token" not in result.stdout + result.stderr, "Registry error exposed credentials"
    return result.stdout

with tempfile.TemporaryDirectory(prefix="bp-registry-tools-", dir=root / ".tmp-run") as temporary:
    directory = Path(temporary)
    provider = directory / "provider"; provider.mkdir()
    contract = registry_request(target_fixture())["schema"]
    contract["manifest"]["description"] = "Registry Unicode: \u00e4 \U0001f30d"
    write(provider / "bp-contract.json", contract)
    write(provider / "betterportal.json", {"registryRef": "example/service"})
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0)); port = probe.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    environment["BP_REGISTRY_URL"] = url
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as log:
        peer = subprocess.Popen(["node", str(root / "framework/conformance/node-contract-registry.mjs"), str(port), str(directory / "store"), str(provider / "bp-contract.json")], stdout=log, stderr=log,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline and peer.poll() is None:
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=.1): break
                except OSError: time.sleep(.05)
            else:
                log.seek(0); raise AssertionError(log.read())

            for index, (language, command) in enumerate(native.items()):
                print("Checking registry tooling from " + language, flush=True)
                result = json.loads(run([*command, "publish", "--contract", "bp-contract.json", "--project", str(provider)], provider))
                assert result["unchanged"] == (index > 0), result
                # Same version/content is idempotent across both native serializers.
                assert json.loads(run([*command, "publish", "--contract", "bp-contract.json"], provider))["unchanged"]

            newer = deepcopy(contract); newer["manifest"]["version"] = "2.0.0"
            write(provider / "newer.json", newer)
            run([*native["python"], "publish", "--contract", "newer.json"], provider)
            consumers = []
            for language, command in native.items():
                print("Checking resolution and hostile responses from " + language, flush=True)
                for index, selector in enumerate(("example/service@1.0.0", "com.example.service@1.0.0", "service@1.0.0", "service@latest", "example/service", "com.example.service")):
                    project = directory / f"{language}-{index}"; project.mkdir(); consumers.append((language, project))
                    write(project / "betterportal.json", {})
                    entry = json.loads(run([*command, "deps", "add", selector, "--alias", "peer", "--registry", url], project))
                    expected = "1.0.0" if selector.endswith("@1.0.0") else "2.0.0"
                    assert entry["version"] == expected and entry["registryRef"] == "example/service", entry
                    cached = project / f".betterportal/contracts/com.example.service/{expected}.json"
                    with http.open(url + f"/v1/packages/example/service/{expected}/schema.json") as response: original = response.read()
                    assert cached.read_bytes() == original
                    assert entry["digest"] == "sha256:" + hashlib.sha256(original).hexdigest()
                    # Both native frozen readers accept every registry installation.
                    for reader in native.values(): run([*reader, "deps", "sync", "--frozen"], project)

                project = directory / (language + "-rejections"); project.mkdir()
                write(project / "betterportal.json", {})
                for selector in ("missing", "example/missing", "com.example.missing", "service@3.0.0"):
                    before = snapshot(project); run([*command, "deps", "add", selector, "--registry", url], project, False); assert snapshot(project) == before
                for kind in ("redirect", "denied", "media", "compressed", "missing-ref", "wrong-plugin", "wrong-version", "invalid-schema", "duplicate", "utf8", "large", "slow"):
                    before = snapshot(project); started = time.monotonic()
                    run([*command, "deps", "add", "com.example.service@1.0.0", "--registry", url + "/fault/" + kind], project, False)
                    assert snapshot(project) == before, kind
                    if kind == "slow": assert 28 <= time.monotonic() - started < 40, "Total deadline did not bound a trickling response"
                # A valid reference header must still agree with an explicit package selector.
                run([*command, "deps", "add", "example/service@1.0.0", "--registry", url + "/fault/wrong-ref"], project, False)
                for endpoint in ("http://example.org", "http://127.1", "http://localhost.evil", "https://user:password@example.org", url + "?secret=1", url + "#fragment"):
                    before = snapshot(project); run([*command, "deps", "add", "example/service", "--registry", endpoint], project, False); assert snapshot(project) == before
                for kind in ("redirect", "denied", "publish-identity"):
                    run([*command, "publish", "--contract", "bp-contract.json", "--registry", url + "/fault/" + kind], provider, False)
                missing_token = {k: v for k, v in environment.items() if k != "BP_REGISTRY_TOKEN"}
                run([*command, "publish", "--contract", "bp-contract.json"], provider, False, missing_token)
                run([*command, "publish", "--contract", "bp-contract.json"], provider, False, {**environment, "BP_REGISTRY_TOKEN": "invalid-token"})
                changed = deepcopy(contract); changed["manifest"]["title"] = "Conflicting content"
                write(provider / "conflict.json", changed)
                before = snapshot(directory / "store")
                run([*command, "publish", "--contract", "conflict.json"], provider, False)
                assert snapshot(directory / "store") == before
                wrong_binding = directory / (language + "-wrong-binding"); wrong_binding.mkdir()
                write(wrong_binding / "betterportal.json", {"registryRef": "example/renamed"})
                write(wrong_binding / "bp-contract.json", contract)
                run([*command, "publish", "--contract", "bp-contract.json"], wrong_binding, False)
                assert snapshot(directory / "store") == before
                wrong_prefix = deepcopy(contract); wrong_prefix["manifest"]["pluginId"] = "com.other.service"
                write(wrong_binding / "bp-contract.json", wrong_prefix)
                run([*command, "publish", "--contract", "bp-contract.json"], wrong_binding, False)
                assert snapshot(directory / "store") == before
                # A catalog cookie cannot accompany the subsequent exact-version request.
                run([*command, "deps", "add", "service@1.0.0", "--registry", url + "/fault/catalog"], project)

            other = directory / "other"; other.mkdir()
            write(other / "betterportal.json", {"registryRef": "other/service"})
            competing = deepcopy(contract); competing["manifest"]["pluginId"] = "com.other.service"
            write(other / "bp-contract.json", competing)
            run([*native["dotnet"], "publish", "--contract", "bp-contract.json"], other)
            for language, command in native.items():
                project = directory / (language + "-ambiguous"); project.mkdir()
                write(project / "betterportal.json", {})
                before = snapshot(project); run([*command, "deps", "add", "service", "--registry", url], project, False); assert snapshot(project) == before
                write(project / "betterportal.json", {"defaultNamespace": "example"})
                entry = json.loads(run([*command, "deps", "add", "service@1.0.0", "--registry", url], project))
                assert entry["registryRef"] == "example/service"
            # Default installation prefers a matching local export and otherwise falls back to the registry.
            for language, command in native.items():
                sandbox = directory / (language + "-discovery"); project = sandbox / "repo"
                project.mkdir(parents=True); (project / ".git").mkdir()
                write(project / "betterportal.json", {})
                env = {**environment, "BP_DEV_PATHS": ""}
                source = sandbox / "provider"
                write(source / "betterportal.json", {"registryRef": "example/service"})
                write(source / "bp-contract.json", contract)
                with http.open(url + "/__requests") as response: before = len(json.load(response))
                entry = json.loads(run([*command, "deps", "add", "example/service@1.0.0"], project, env=env))
                with http.open(url + "/__requests") as response: assert len(json.load(response)) == before
                assert entry["version"] == "1.0.0"
                # An exact version not available locally reaches the real Node registry.
                entry = json.loads(run([*command, "deps", "add", "example/service@2.0.0"], project, env=env))
                assert entry["version"] == "2.0.0"
                assert json.loads((project / ".betterportal/local-lock.json").read_text()) == {}, "Registry fallback retained a stale local override"
                # Explicit registry selection bypasses a matching local contract.
                entry = json.loads(run([*command, "deps", "add", "example/service", "--registry", url], project, env=env))
                assert entry["version"] == "2.0.0"
            with http.open(url + "/__requests") as response: requests = json.load(response)
            assert not any(item["cookie"] or item["url"] == "/__sink" or item["method"] == "GET" and item["authorization"] for item in requests)
        finally:
            peer.terminate()
            try: peer.wait(timeout=5)
            except subprocess.TimeoutExpired: peer.kill(); peer.wait()
        # No registry process remains. Frozen builds still verify and generate locally.
        for language, project in consumers:
            run([*native[language], "deps", "sync", "--frozen", "--check"], project)
print(f"{checks} native registry install/publish and hostile HTTP CLI checks passed")
