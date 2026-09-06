"""Native local installation and frozen byte locks, including Node CLI compatibility."""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "framework/python"))
from client_cases import target_fixture
from python_registry import registry_request

environment = {**os.environ, "PYTHONPATH": str(root / "framework/python")}
tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
native = {"python": [sys.executable, "-m", "betterportal"], "dotnet": ["dotnet", str(tool)]}
node_module = (root / "framework/nodejs/lib/cli/client.js").as_uri()
node_code = "import {syncClients} from " + json.dumps(node_module) + "; console.log(JSON.stringify(await syncClients({frozen:true,registryOnly:true})));"
checks = 0
(root / ".tmp-run").mkdir(exist_ok=True)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def read(path): return json.loads(path.read_text(encoding="utf-8"))
def run(command, directory, valid=True):
    global checks
    result = subprocess.run(command, cwd=directory, env=environment, capture_output=True, text=True, encoding="utf-8")
    assert (result.returncode == 0) == valid, (command, result.stdout, result.stderr)
    checks += 1
    return result.stdout + result.stderr

def sync(language, directory, valid=True, check=False):
    command = (["node", "--input-type=module", "--eval", node_code] if language == "node" else
               [*native[language], "deps", "sync", "--frozen", "--project", str(directory), *(["--check"] if check else [])])
    return run(command, directory, valid)

def snapshot(directory):
    return {str(path.relative_to(directory)): path.read_bytes() for path in directory.rglob("*") if path.is_file()}

with tempfile.TemporaryDirectory(prefix="bp-projects-", dir=root / ".tmp-run") as temporary:
    directory = Path(temporary); provider = directory / "provider"; provider.mkdir()
    contract = registry_request(target_fixture())["schema"]
    contract["manifest"]["description"] = "Shared Unicode contract: \u00e4 \u03a9 \U0001f30d"
    write(provider / "bp-contract.json", contract)
    write(provider / "betterportal.json", {"registryRef": "example/service"})
    source_bytes = (provider / "bp-contract.json").read_bytes()
    digest = "sha256:" + hashlib.sha256(source_bytes).hexdigest()
    for author in native:
        print("Checking project locks from " + author, flush=True)
        project = directory / author; project.mkdir()
        write(project / "betterportal.json", {"registryRef": "example/caller", "defaultNamespace": "example"})
        # Native commands run successfully before a Node package marker exists.
        run([*native[author], "deps", "add", "service", "--path", str(provider), "--alias", "peer", "--project", str(project)], project)
        entry = read(project / "betterportal.lock.json")["dependencies"]["peer"]
        assert entry == {"registryRef": "example/service", "pluginId": "com.example.service", "version": "1.0.0", "digest": digest, "digestFormat": "json-bytes"}, entry
        assert read(project / "betterportal.json")["registryRef"] == "example/caller"
        for language in native:
            sync(language, project); before = snapshot(project); sync(language, project, check=True)
            assert snapshot(project) == before, "Frozen --check wrote files"
        write(project / "package.json", {"name": "native-lock-test", "type": "module"})
        sync("node", project)
        before = snapshot(project)
        # Frozen builds consume pinned cache bytes, independent of mutable local discovery.
        (project / ".betterportal/local-lock.json").write_text("invalid local metadata", encoding="utf-8")
        for language in (*native, "node"): sync(language, project)
        for file, data in before.items():
            (project / file).write_bytes(data)
        cached_relative = Path(".betterportal/contracts/com.example.service/1.0.0.json")
        assert (project / cached_relative).read_bytes() == source_bytes
        base = directory / (author + "-base"); shutil.copytree(project, base)

        def variant(name, change, *, languages=(*native, "node")):
            target = directory / (author + "-" + name); shutil.copytree(base, target)
            change(target)
            for language in languages:
                before = snapshot(target); sync(language, target, valid=False)
                assert snapshot(target) == before, (language, name, "Failed frozen build wrote files")

        def config(target, change):
            path = target / "betterportal.json"; value = read(path); change(value); write(path, value)

        def lock(target, change):
            path = target / "betterportal.lock.json"; value = read(path); change(value["dependencies"]["peer"]); write(path, value)

        variant("changed-bytes", lambda target: (target / cached_relative).write_bytes(source_bytes + b" "))
        variant("missing-cache", lambda target: (target / cached_relative).unlink())
        variant("changed-registry", lambda target: config(target, lambda value: value["dependencies"].update(peer="other/service@1.0.0")))
        variant("changed-plugin", lambda target: config(target, lambda value: value["dependencies"].update(peer="com.example.other@1.0.0")))
        variant("changed-version", lambda target: config(target, lambda value: value["dependencies"].update(peer="example/service@2.0.0")))
        variant("wrong-digest", lambda target: lock(target, lambda value: value.update(digest="sha256:" + "0" * 64)))
        variant("unknown-format", lambda target: lock(target, lambda value: value.update(digestFormat="unknown")))
        variant("unlocked", lambda target: config(target, lambda value: value["dependencies"].update(other="example/other@1.0.0")))
        variant("alias-collision", lambda target: config(target, lambda value: value["dependencies"].update(Peer="example/service@1.0.0")), languages=native)
        variant("invalid-alias", lambda target: config(target, lambda value: value["dependencies"].update({"../unsafe": "example/service@1.0.0"})), languages=native)
        legacy = directory / (author + "-legacy"); shutil.copytree(base, legacy)
        digest_module = (root / "framework/nodejs/lib/runtime/contract.js").as_uri()
        code = "import {contractDigest} from " + json.dumps(digest_module) + "; import{readFileSync}from'node:fs'; console.log(contractDigest(JSON.parse(readFileSync(process.argv[1],'utf8'))));"
        legacy_digest = run(["node", "--input-type=module", "--eval", code, str(legacy / cached_relative)], legacy).strip()
        lock(legacy, lambda value: (value.pop("digestFormat"), value.update(digest=legacy_digest)))
        sync("node", legacy)
        for language in native:
            assert "Legacy locale-based lock" in sync(language, legacy, valid=False)
        # Explicit installation upgrades one legacy lock; frozen mode never silently re-pins it.
        run([*native[author], "deps", "add", "example/service@1.0.0", "--path", str(provider), "--alias", "peer", "--project", str(legacy)], legacy)
        for language in (*native, "node"): sync(language, legacy)

        shared = directory / (author + "-shared-legacy"); shutil.copytree(base, shared)
        config(shared, lambda value: value["dependencies"].update(other="example/service@1.0.0"))
        shared_lock = read(shared / "betterportal.lock.json")
        shared_lock["dependencies"]["peer"].pop("digestFormat")
        shared_lock["dependencies"]["peer"]["digest"] = legacy_digest
        shared_lock["dependencies"]["other"] = deepcopy(shared_lock["dependencies"]["peer"])
        write(shared / "betterportal.lock.json", shared_lock)
        for alias in ("peer", "other"):
            run([*native[author], "deps", "add", "example/service", "--path", str(provider), "--alias", alias, "--project", str(shared)], shared)
        for language in (*native, "node"): sync(language, shared)

        for selector in ("example/service@2.0.0", "other/service", "com.example.other", "service@", "service@^1.0.0"):
            before = snapshot(project)
            run([*native[author], "deps", "add", selector, "--path", str(provider), "--project", str(project)], project, False)
            assert snapshot(project) == before, (selector, "Invalid install wrote files")
        # Distinct aliases cannot silently overwrite the shared plugin/version cache with different bytes.
        conflicting = directory / (author + "-conflicting-provider"); shutil.copytree(provider, conflicting)
        (conflicting / "bp-contract.json").write_bytes(source_bytes + b" ")
        before = snapshot(project)
        run([*native[author], "deps", "add", "example/service", "--path", str(conflicting), "--alias", "second", "--project", str(project)], project, False)
        assert snapshot(project) == before
        # A short selector may name the plugin suffix, even when the registry package differs.
        renamed = directory / (author + "-renamed-provider"); shutil.copytree(provider, renamed)
        write(renamed / "betterportal.json", {"registryRef": "example/renamed"})
        consumer = directory / (author + "-keyword-alias"); consumer.mkdir()
        write(consumer / "betterportal.json", {})
        run([*native[author], "deps", "add", "service", "--path", str(renamed), "--alias", "class", "--project", str(consumer)], consumer)
        for language in native: sync(language, consumer)
        compile((consumer / "bp_dependencies/dep_class.py").read_text(encoding="utf-8"), "dep_class.py", "exec")
        # Stale generated files are checked without rewriting; normal frozen generation repairs them.
        for language, relative in (("python", "bp_dependencies/dep_peer.py"), ("dotnet", "BpDependencies/peer.cs")):
            path = project / relative; path.write_text("stale", encoding="utf-8")
            before = snapshot(project); sync(language, project, False, check=True); assert snapshot(project) == before
            sync(language, project); sync(language, project, check=True)
print(f"{checks} native project/lock and Node compatibility CLI checks passed")
