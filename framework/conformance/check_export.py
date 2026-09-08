"""Export real native registry factories, check drift, and consume their contracts."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
environment = {**os.environ, "PYTHONPATH": str(root / "framework/python")}
tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
commands = {"python": [sys.executable, "-m", "betterportal"], "dotnet": ["dotnet", str(tool)]}
checks = 0
(root / ".tmp-run").mkdir(exist_ok=True)

def run(command, directory, valid=True):
    global checks
    result = subprocess.run(command, cwd=directory, env=environment, capture_output=True, text=True, encoding="utf-8", timeout=120)
    assert (result.returncode == 0) == valid, (command, result.stdout, result.stderr)
    checks += 1
    return result.stdout + result.stderr

def project(path, references, sdk="Microsoft.NET.Sdk"):
    path.parent.mkdir(parents=True, exist_ok=True)
    element = ET.Element("Project", Sdk=sdk)
    props = ET.SubElement(element, "PropertyGroup")
    for name, value in {"TargetFramework":"net10.0", "Nullable":"enable", "ImplicitUsings":"enable", "TreatWarningsAsErrors":"true"}.items():
        ET.SubElement(props, name).text = value
    group = ET.SubElement(element, "ItemGroup")
    for reference in references: ET.SubElement(group, "ProjectReference", Include=str(reference))
    ET.ElementTree(element).write(path, encoding="unicode")

with tempfile.TemporaryDirectory(prefix="bp-export-", dir=root / ".tmp-run") as temporary:
    directory = Path(temporary)
    python = directory / "python"; (python / "sample").mkdir(parents=True)
    (python / "sample/__init__.py").write_text("", encoding="utf-8")
    (python / "sample/support.py").write_text('declaration = {"pluginId":"com.example.exported", "title":"From support", "description":"Example", "version":"1.0.0"}\n', encoding="utf-8")
    (python / "sample/definition.py").write_text('''import anyvali as av
from betterportal.handler import Handler
from betterportal.registry import Operation, Route, Registry
from .support import declaration

def handler(context): raise AssertionError("Export executed a request handler")
def export():
    return Registry([Route("hello.index", "/hello", [Operation(Handler(av.string(), handler),
        {"operationId":"hello.get", "method":"GET", "title":"Hello", "description":"Hello", "auth":{}})])]).schema(declaration)
def invalid(): return {}
def parameters(value): return export()
async def asynchronous(): return export()
def large():
    value = export(); value["manifest"]["description"] = "x" * (16 * 1024 * 1024); return value
''', encoding="utf-8")
    dotnet = directory / "dotnet"; dotnet.mkdir()
    support = directory / "support"
    core = root / "framework/dotnet/BetterPortal/BetterPortal.csproj"
    project(support / "Support.csproj", [core])
    (support / "Support.cs").write_text('''namespace ExportSupport;
public static class Metadata {
    public static BetterPortal.Generated.ManifestDeclarationInput Declaration() => new() {
        PluginId="com.example.exported", Title="From support", Description="Example", Version="1.0.0"
    };
}
''', encoding="utf-8")
    project(dotnet / "Example.csproj", [core, support / "Support.csproj"], "Microsoft.NET.Sdk.Web")
    (dotnet / "Program.cs").write_text('throw new Exception("Export executed the application entry point");\n', encoding="utf-8")
    (dotnet / "Definition.cs").write_text('''using AnyVali;
using BetterPortal;
using BetterPortal.Generated;
namespace Example;
public static class Definition {
    public static BpSchemaOutput Export() => new Registry([new BetterPortal.Route("hello.index", "/hello", [new Operation(
        new Handler<object?,object?,object?,object?,string>(V.String(), _ => throw new Exception("Export executed a request handler")),
        new() {OperationId="hello.get", Method=HttpMethodInput.GET, Title="Hello", Description="Hello", Auth=new()})])]).Schema(ExportSupport.Metadata.Declaration());
    public static BpSchemaOutput Invalid() => null!;
    public static BpSchemaOutput Parameters(string value) => Export();
    public static object WrongType() => Export();
    public static BpSchemaOutput Large() => Export() with {Manifest=Export().Manifest with {Description=new string('x',16*1024*1024)}};
}
''', encoding="utf-8")
    run(["dotnet", "build", str(dotnet), "-m:1", "-p:UseSharedCompilation=false"], directory)
    assembly = dotnet / "bin/Debug/net10.0/Example.dll"
    for language, target in (("python", python), ("dotnet", dotnet)):
        print("Checking native export from " + language, flush=True)
        command = commands[language]
        source = ["--module", "sample.definition:export"] if language == "python" else ["--assembly", str(assembly), "--factory", "Example.Definition:Export"]
        output = target / "bp-contract.json"
        export = [*command, "export", *source, "--project", str(target), "--output", "bp-contract.json"]
        run(export, directory)
        original = output.read_bytes(); stamp = output.stat().st_mtime_ns
        contract = json.loads(original)
        assert contract["manifest"]["pluginId"] == "com.example.exported" and contract["manifest"]["title"] == "From support"
        assert contract["manifest"]["views"][0]["operations"][0]["operationId"] == "hello.get"
        run([*export, "--check"], directory)
        assert (output.read_bytes(), output.stat().st_mtime_ns) == (original, stamp)
        output.write_bytes(b"stale")
        run([*export, "--check"], directory, False); assert output.read_bytes() == b"stale"
        run(export, directory); assert output.read_bytes() == original
        bad = ("missing", "invalid", "parameters", "asynchronous", "large") if language == "python" else ("Missing", "Invalid", "Parameters", "WrongType", "Large")
        for member in bad:
            failure = source.copy(); failure[-1] = ("sample.definition:" if language == "python" else "Example.Definition:") + member
            message = run([*command, "export", *failure, "--project", str(target), "--output", "bp-contract.json"], directory, False)
            assert output.read_bytes() == original
            if member.lower() == "large": assert "Exported contract exceeds its size limit" in message
        for consumer, generator in commands.items():
            consumer_path = directory / (language + "-to-" + consumer); consumer_path.mkdir()
            # Full references supply identity without any Node project marker.
            run([*generator, "deps", "add", "example/exported@1.0.0", "--path", str(target)], consumer_path)
            run([*generator, "deps", "sync", "--frozen", "--check"], consumer_path)
        assert not (target / "package.json").exists()
print(f"{checks} native contract export and cross-language consumption checks passed")
