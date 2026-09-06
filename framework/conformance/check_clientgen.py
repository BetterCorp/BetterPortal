"""Compile native clients from all three registries, reject bad callers, and check fixture drift."""
import argparse
from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import typing
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "framework/python"))
from betterportal.clients import ClientContract
from betterportal.clientgen import generate_client
from client_cases import target_fixture
from python_registry import registry_request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--write-fixtures", action="store_true")
args = parser.parse_args()
directory = root / ".tmp-run/ports-clientgen"
directory.mkdir(parents=True, exist_ok=True)
environment = {**os.environ, "PYTHONPATH": str(root / "framework/python")}
tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
adapter = root / "framework/dotnet/Conformance/bin/Debug/net10.0/Conformance.dll"
python = sys.executable

def run(command, *, success=True, **kwargs):
    result = subprocess.run(command, env=environment, capture_output=True, text=True, **kwargs)
    assert (result.returncode == 0) == success, result.stdout + result.stderr
    return result.stdout + result.stderr

def generate(contract, py_output, cs_output, name="PeerClient", namespace="ClientChecks", check=False):
    source = directory / "input.json"
    source.write_text(json.dumps(contract), encoding="utf-8")
    for command, output, options in (
        ([python, "-m", "betterportal"], py_output, []),
        (["dotnet", str(tool)], cs_output, ["--namespace", namespace]),
    ):
        run([*command, "client", "--contract", str(source), "--output", str(output), "--class-name", name, *options, *(["--check"] if check else [])])

base = registry_request(target_fixture())["schema"]
py_fixture = root / "framework/conformance/generated_peer.py"
cs_fixture = root / "framework/dotnet/Conformance/GeneratedPeer.cs"
generate(base, py_fixture, cs_fixture, namespace="ConformanceClients", check=not args.write_fixtures)
if args.write_fixtures:
    print("Wrote native client fixtures; run check_clientgen.py and the clients HTTP suite")
    raise SystemExit(0)

def portable(node, **extra):
    return {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": node, **extra}

def record(properties):
    return {"kind": "object", "properties": properties, "required": [name for name, node in properties.items() if node["kind"] != "optional"], "unknownKeys": "reject"}

fixture = target_fixture()
get = fixture["routes"][0]["operations"][0]
get["schemas"] = {
    "params": portable(record({"key": {"kind": "string"}})),
    "query": portable(record({"limit": {"kind": "int", "default": 5}})),
    "headers": portable(record({"tag": {"kind": "optional", "inner": {"kind": "string"}}})),
}
get["response"] = portable(record({"value": {"kind": "ref", "ref": "#/definitions/Value"}}), definitions={"Value": {"kind": "string"}})
write = deepcopy(get)
write["declaration"].update(operationId="check.post", method="POST", apiContracts=[])
write["schemas"]["request"] = portable(record({"value": {"kind": "ref", "ref": "#/definitions/Value"},
    "note": {"kind": "optional", "inner": {"kind": "nullable", "inner": {"kind": "string"}}}}), definitions={"Value": {"kind": "bool"}})
fixture["routes"][0]["operations"].append(write)
optional = deepcopy(get)
optional["declaration"].update(operationId="optional.get", apiContracts=[])
optional["schemas"]["params"] = portable(record({"key": {"kind": "optional", "inner": {"kind": "string"}}}))
fixture["routes"].append({"viewId": "optional", "path": "/optional/:key", "pathVariants": ["/optional"], "operations": [optional]})
# Name collisions and recursive values must compile without losing definition scope.
for index, identifier in enumerate(("name.dot", "name-dot", "class", "checkGet")):
    entry = deepcopy(optional); entry["declaration"].update(operationId=identifier)
    entry["response"] = target_fixture()["routes"][0]["operations"][0]["response"]
    fixture["routes"].append({"viewId": "extra" + str(index), "path": "/extra" + str(index), "operations": [entry]})
source = directory / "registry-input.json"
source.write_text(json.dumps(fixture), encoding="utf-8")
node = "import {registryRequest} from './framework/conformance/node-registry.mjs'; import{readFileSync}from'node:fs'; process.stdout.write(JSON.stringify(registryRequest(JSON.parse(readFileSync(0,'utf8')))));"
exports = {
    "python": registry_request(fixture),
    "node": json.loads(run(["node", "--input-type=module", "--eval", node], input=json.dumps(fixture), cwd=root)),
    "dotnet": json.loads(run(["dotnet", str(adapter), "--registry", str(source)])),
}
for label, result in exports.items():
    print("Checking clients from " + label, flush=True)
    assert result["status"] == 200, (label, result)
    contract = result["schema"]
    projection = ClientContract(contract)
    operations = projection.json_operations()
    original = deepcopy(operations)
    assert operations["check.get"].required_inputs == {"params"}, operations["check.get"]
    assert operations["check.post"].required_inputs == {"params", "body"}, operations["check.post"]
    assert not operations["optional.get"].required_inputs
    operations["check.get"].output["root"].clear()
    operations["check.get"].output["definitions"].clear()
    operations["check.get"].inputs["params"]["root"]["properties"].clear()
    projection.schema()["manifest"]["views"].clear()
    assert projection.json_operations() == original and projection.schema()["manifest"]["views"]
    target = directory / label
    target.mkdir(exist_ok=True)
    generated_py, generated_cs = target / "peer.py", target / "Peer.cs"
    generate(contract, generated_py, generated_cs)
    generate(contract, generated_py, generated_cs, check=True)
    if label == "python":
        # Empty coercion is active. Python export loss is separately gated by AnyVali #134.
        coercion = directory / "CoercedSchema.json"
        coercion.write_text(json.dumps(portable({"kind": "int", "coerce": {}})), encoding="utf-8")
        run([python, "-m", "betterportal", "types", "--contracts", str(coercion), "--output", str(target / "coerced.py")])
        run(["dotnet", str(tool), "types", "--contracts", str(coercion), "--output", str(target / "Coerced.cs"), "--namespace", "ClientChecks"])
        generate(base, target / "collision.py", target / "Collision.cs", "CheckGetAsync", "ClientChecks.Collision")
    spec = importlib.util.spec_from_file_location("peer", generated_py)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    for declaration in vars(module).values():
        if isinstance(declaration, type) and hasattr(declaration, "__required_keys__"):
            typing.get_type_hints(declaration, vars(module), include_extras=True)
    (target / "positive.py").write_text('''from peer import PeerClient
async def call(client: PeerClient) -> str:
    await client.optional_get()
    await client.check_post({"params": {"key": "one"}, "body": {"value": True, "note": None}})
    await client.check_post({"params": {"key": "one"}, "body": {"value": False}})
    value = await client.check_get({"params": {"key": "one"}, "query": {"limit": 7}})
    return value["value"]
''', encoding="utf-8")
    command = [python, "-m", "mypy", "--follow-imports=silent", "--follow-untyped-imports", "--cache-dir", str(directory / "mypy")]
    if label == "python":
        with (target / "positive.py").open("a", encoding="utf-8") as file:
            file.write("from coerced import CoercedInput\ncoerced: CoercedInput = '7'\n")
    run([*command, str(generated_py), str(target / "positive.py")])
    (target / "negative.py").write_text('''from peer import PeerClient
async def call(client: PeerClient) -> None:
    await client.check_get()
    await client.check_get({})
    await client.check_get({"params": {"key": 42}})
    await client.check_post({"params": {"key": "one"}})
    await client.check_post({"params": {"key": "one"}, "body": {"value": "wrong"}})
    value: bool = (await client.check_get({"params": {"key": "one"}}))["value"]
''', encoding="utf-8")
    rejected = run([*command, str(target / "negative.py")], success=False)
    assert rejected.count(": error:") == 6, rejected
    project = ET.Element("Project", Sdk="Microsoft.NET.Sdk")
    properties = ET.SubElement(project, "PropertyGroup")
    for key, value in {"TargetFramework": "net10.0", "OutputType": "Exe", "Nullable": "enable", "TreatWarningsAsErrors": "true"}.items():
        ET.SubElement(properties, key).text = value
    ET.SubElement(ET.SubElement(project, "ItemGroup"), "ProjectReference", Include=str(root / "framework/dotnet/BetterPortal/BetterPortal.csproj"))
    ET.ElementTree(project).write(target / "ClientChecks.csproj", encoding="unicode")
    positive = '''using BetterPortal;
using ClientChecks;
using System.Threading.Tasks;
static async Task<string> Call(PeerClient client) {
    await client.OptionalGetAsync();
    await client.CheckPostAsync(new() { Params = new() { Key = "one" }, Body = new() { Value = true, Note = (string?)null } });
    await client.CheckPostAsync(new() { Params = new() { Key = "one" }, Body = new() { Value = false } });
    return (string)(await client.CheckGetAsync(new() { Params = new() { Key = "one" }, Query = new PeerClient_CheckGet_queryInput { Limit = 7 } })).Value;
}
_ = (System.Func<PeerClient, Task<string>>)Call;
var input = new PeerClient_CheckPostInputs { Params = new() { Key = "one" }, Body = new() { Value = true } };
if (Json.Write(input) != "{\\"params\\":{\\"key\\":\\"one\\"},\\"body\\":{\\"value\\":true}}") throw new System.Exception("Omission changed");
var withNull = input with { Body = input.Body with { Note = (string?)null } };
if (!Json.Write(withNull).Contains("\\"note\\":null")) throw new System.Exception("Explicit null omitted");
'''
    program = target / "Program.cs"
    if label == "python":
        positive += '''var coerced = new CoercedInput(System.Text.Json.JsonSerializer.SerializeToElement("7"));
if (Json.Write(coerced) != "\\\"7\\\"") throw new System.Exception("Coercion input was narrowed");
'''
    program.write_text(positive, encoding="utf-8")
    run(["dotnet", "run", "--project", str(target), "-p:UseSharedCompilation=false"])
    program.write_text('''using ClientChecks;
using System.Threading.Tasks;
static async Task<bool> Bad(PeerClient client) {
    await client.CheckGetAsync();
    await client.CheckGetAsync(new());
    await client.CheckGetAsync(new() { Params = new() { Key = 42 } });
    await client.CheckPostAsync(new() { Params = new() { Key = "one" } });
    await client.CheckPostAsync(new() { Params = new() { Key = "one" }, Body = new() { Value = "wrong" } });
    return (await client.CheckGetAsync(new() { Params = new() { Key = "one" } })).Value;
}
_ = (System.Func<PeerClient, Task<bool>>)Bad;
''', encoding="utf-8")
    rejected = run(["dotnet", "build", str(target), "--no-restore", "-m:1", "-p:UseSharedCompilation=false"], success=False)
    assert all(code in rejected for code in ("CS7036", "CS9035", "CS0029")), rejected
    program.write_text(positive, encoding="utf-8")

# Refuse invalid contracts and unsafe symbols before writing an output file.
for name in ("int", "TypedDict", "ValueError", "class", "broken-name"):
    try: generate_client(base, name)
    except ValueError: pass
    else: raise AssertionError("Invalid Python client name accepted: " + name)
source = directory / "invalid.json"
source.write_text(json.dumps(base), encoding="utf-8")
for name in ("System", "Optional", "broken-name"):
    run(["dotnet", str(tool), "client", "--contract", str(source), "--output", str(directory / "invalid.cs"), "--class-name", name], success=False)
for contract in ({}, {**base, "manifest": {**base["manifest"], "views": []}}):
    source.write_text(json.dumps(contract), encoding="utf-8")
    for command in ([python, "-m", "betterportal"], ["dotnet", str(tool)]):
        run([*command, "client", "--contract", str(source), "--output", str(directory / "invalid.txt")], success=False)
source.write_text(json.dumps(base), encoding="utf-8")
for command in ([python, "-m", "betterportal"], ["dotnet", str(tool)]):
    stale = directory / "stale.txt"; stale.write_text("stale", encoding="utf-8")
    run([*command, "client", "--contract", str(source), "--output", str(stale), "--check"], success=False)
    assert stale.read_text() == "stale"
print("Native client generation: three registry exports, compiler acceptance/rejection, wire presence and CLI drift checks passed")
