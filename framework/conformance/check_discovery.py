"""Compile/load real route modules, compare Node paths, and export through both CLIs."""
from copy import deepcopy
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import anyvali as av

root = Path(__file__).resolve().parents[2]
environment = {**os.environ, "PYTHONPATH": str(root / "framework/python")}
tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
checks = 0


def run(command, directory, valid=True, case=None):
    global checks
    env = {**environment, "BP_DISCOVERY_CASE": case or "basic"}
    result = subprocess.run(command, cwd=directory, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)
    assert (result.returncode == 0) == valid, (case, command, result.stdout, result.stderr)
    checks += 1
    return result.stdout + result.stderr


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def document(node):
    return {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": node, "definitions": {}, "extensions": {}}


def normalized(value):
    if isinstance(value, dict):
        if "anyvaliVersion" in value and "root" in value:
            # Compare validation, not optional-wrapper count or child spellings.
            # The full schema HTTP gate separately tests native export/reimport.
            schema = av.import_schema(value)
            outcomes = []
            for probe in (None, True, 3, "value", "any", [], ["value"], {}, {"id":"value"}, {"tenant":"value"},
                          {"user":"value"}, {"tenant":"a","user":"b"}, {"id":3}, {"items":["value"]}, {"nested":[None,True,3.5]}):
                try: outcomes.append({"value": schema.parse(probe)})
                except av.ValidationError: outcomes.append({"invalid": True})
            return outcomes
        return {key: normalized(child) for key, child in value.items()}
    if isinstance(value, list): return [normalized(child) for child in value]
    return value


cases = [
    {"name": "basic", "path": "hello", "paths": ["/hello"], "view": "hello.index"},
    {"name": "root", "path": "", "paths": ["/"], "view": "index"},
    {"name": "required", "path": "users/[id]", "paths": ["/users/:id"], "view": "users.$id.index"},
    {"name": "optional", "path": "tenants/[[tenant]]/users/[[user]]", "paths": ["/tenants/users", "/tenants/:tenant/users", "/tenants/users/:user", "/tenants/:tenant/users/:user"], "view": "tenants.$tenant.users.$user.index"},
    {"name": "dots", "path": "v1.2/café", "paths": ["/v1.2/café"], "view": "v1.2.café.index"},
    {"name": "well_known", "path": ".well-known/example", "paths": ["/.well-known/example"], "view": ".well-known.example.index"},
    {"name": "explicit", "path": "moved/[id]", "paths": ["/moved/:id"], "view": "stable.view", "declaration": {"viewId": "stable.view", "title": "View title", "description": "View description"}},
    {"name": "all_methods", "path": "verbs", "paths": ["/verbs"], "view": "verbs.index", "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]},
    {"name": "rendering", "path": "feed", "paths": ["/feed"], "view": "feed.index", "methods": ["GET", "POST"], "sse": True, "rendering": True},
    {"name": "raw", "path": "file", "paths": ["/file"], "view": "file.index"},
    {"name": "finite", "path": "stream", "paths": ["/stream"], "view": "stream.index"},
    {"name": "recursive", "path": "json", "paths": ["/json"], "view": "json.index", "schema": json.loads((root / "framework/conformance/contracts/JsonValueSchema.json").read_text())},
    {"name": "default_data", "path": "defaults", "paths": ["/defaults"], "view": "defaults.index", "schema": document({"kind": "record", "valueSchema": {"kind": "string"}, "default": {"kind": "any", "unknownKeys": "allow"}})},
    {"name": "enum_data", "path": "enum", "paths": ["/enum"], "view": "enum.index", "schema": document({"kind": "enum", "values": ["any", "unknown", "allow"]})},
]
for name, path in (("catchall", "[...id]"), ("brace", "{id}"), ("bracket", "bad[id]"), ("duplicate_param", "[id]/[[id]]"), ("invalid_param", "[0id]")):
    cases.append({"name": name, "path": path, "error": True})
for name in ("no_index", "empty_index", "wrong_method", "unknown_metadata", "null_metadata", "async_factory", "wrong_factory", "sse_no_get", "sse_wrong_owner", "sse_wrong_view", "qualified_sse", "lower_method", "duplicate_operation", "params_mismatch", "duplicate_view", "ambiguous_path"):
    cases.append({"name": name, "path": "bad", "error": True})
for name, schema in (
    ("loose", {"kind": "unknown"}),
    ("nested_loose", {"kind": "array", "items": {"kind": "optional", "inner": {"kind": "any"}}}),
    ("tuple_loose", {"kind": "tuple", "items": [{"kind": "unknown"}]}),
    ("union_loose", {"kind": "union", "variants": [{"kind": "string"}, {"kind": "unknown"}]}),
    ("intersection_allow", {"kind": "intersection", "allOf": [{"kind": "object", "properties": {}, "required": [], "unknownKeys": "allow"}]}),
    ("nested_allow", {"kind": "record", "valueSchema": {"kind": "object", "properties": {}, "required": [], "unknownKeys": "allow"}}),
): cases.append({"name": name, "path": "bad", "schema": document(schema), "error": True, "message": "Route schemas must be concrete"})

with tempfile.TemporaryDirectory(prefix="bp-discovery-", dir=root / ".tmp-run") as temporary:
    directory = Path(temporary)
    assert directory.resolve().is_relative_to(root / ".tmp-run")
    python = directory / "python"
    dotnet = directory / "dotnet"
    node = directory / "node"
    write(python / "entry.py", '''import os
from betterportal.discovery import discover
def export():
    if os.environ["BP_DISCOVERY_CASE"] == "example":
        from my_service.definition import contract
        return contract()
    registry = discover("routes_" + os.environ["BP_DISCOVERY_CASE"])
    for route in registry.routes:
        if route.sse is not None:
            assert route.sse.owner is next(op.handler for op in route.operations if op.method == "GET")
    return registry.schema({"pluginId":"com.example.discovered", "title":"Discovered", "description":"Example", "version":"1.0.0"})
''')
    cs_project = ET.Element("Project", Sdk="Microsoft.NET.Sdk")
    props = ET.SubElement(cs_project, "PropertyGroup")
    for name, value in {"TargetFramework":"net10.0", "Nullable":"enable", "ImplicitUsings":"enable", "TreatWarningsAsErrors":"true"}.items(): ET.SubElement(props, name).text = value
    ET.SubElement(ET.SubElement(cs_project, "ItemGroup"), "ProjectReference", Include=str(root / "framework/dotnet/BetterPortal/BetterPortal.csproj"))
    guide = (root / "framework/ROUTE-AUTHORING.md").read_text(encoding="utf-8")
    cs_project.append(ET.fromstring(re.search(r"<!-- well-known-compile -->\n```xml\n(.*?)```", guide, re.S)[1]))
    # Even explicitly compiled hidden helper factories must be ignored.
    ET.SubElement(ET.SubElement(cs_project, "ItemGroup"), "Compile", Include="**/.internal/**/*.cs")
    dotnet.mkdir()
    ET.ElementTree(cs_project).write(dotnet / "Routes.csproj", encoding="unicode")
    write(dotnet / "Entry.cs", '''using BetterPortal;
using BetterPortal.Generated;
public static class Entry {
    public static BpSchemaOutput Export() {
        if(Environment.GetEnvironmentVariable("BP_DISCOVERY_CASE")=="example") return HelloService.Definition.Export();
        var registry = Discovery.Discover(typeof(Entry).Assembly, "routes_" + Environment.GetEnvironmentVariable("BP_DISCOVERY_CASE"));
        foreach(var route in registry.Routes) if(route.Sse is not null && !ReferenceEquals(route.Sse.Owner,route.Operations.Single(op=>op.Method=="GET").Handler)) throw new Exception("Wrong SSE owner");
        return registry.Schema(new() {PluginId="com.example.discovered",Title="Discovered",Description="Example",Version="1.0.0"});
    }
}
''')
    for spec in cases:
        case = spec["name"]
        package = "routes_" + case
        write(python / package / "__init__.py", "")
        if case == "basic":
            for number, hidden in enumerate((".internal", "_renderer.bootstrap5", "__pycache__")):
                write(python / package / hidden / "index.py", 'raise AssertionError("Imported a helper directory")\n')
                write(dotnet / package / hidden / "index.cs", f'using BetterPortal; public static class Hidden{number} {{ [RouteModule] public static int Invalid() => throw new Exception("Loaded a helper directory"); }}')
        locations = [spec["path"]]
        if case in ("duplicate_view", "ambiguous_path"): locations = ["users/[a]", "users/[b]"]
        for index, location in enumerate(locations):
            py_dir = python / package / location
            cs_dir = dotnet / package / location
            ns = f"Fixture_{case}_{index}"
            declaration = deepcopy(spec.get("declaration", {}))
            if case == "unknown_metadata": declaration["auth"] = {}
            if case == "duplicate_view": declaration["viewId"] = "duplicate"
            schema = spec.get("schema", document({"kind": "string"}))
            params = {"kind": "object", "properties": {}, "required": [], "unknownKeys": "strip"}
            for part in location.split("/"):
                if part.startswith("[") and not part.startswith("[..."):
                    key = part.strip("[]")
                    params["properties"][key] = {"kind": "optional", "inner": {"kind": "string"}} if part.startswith("[[") else {"kind": "string"}
                    if not part.startswith("[["): params["required"].append(key)
            py_index = f'''import anyvali as av
response_schema = av.import_schema({schema!r})
params_schema = av.import_schema({document(params)!r})
def create(): return {declaration!r}
'''
            cs_index = f'''using AnyVali;
using BetterPortal;
using BetterPortal.Generated;
namespace {ns};
public static class Index {{
    public static Schema Response => Contracts.Import({json.dumps(json.dumps(schema))});
    public static Schema Params => Contracts.Import({json.dumps(json.dumps(document(params)))});
    [RouteModule] public static RouteDeclarationInput Create() => Contracts.Parse<RouteDeclarationInput>("RouteDeclarationSchema", Json.Read({json.dumps(json.dumps(declaration))}));
}}
'''
            # Negative metadata is checked by the native AnyVali declaration parser.
            if case == "null_metadata":
                py_index = py_index.replace(f"return {declaration!r}", "return None")
                cs_index = cs_index[:cs_index.index("    [RouteModule]")] + "    [RouteModule] public static RouteDeclarationInput Create() => null!;\n}\n"
            if case != "no_index":
                write(py_dir / "index.py", py_index)
                write(cs_dir / "index.cs", cs_index)
            else:
                write(py_dir / "support.py", py_index)
                write(cs_dir / "support.cs", cs_index.replace("[RouteModule] ", ""))
            methods = spec.get("methods", ["GET"])
            if case == "empty_index": methods = []
            if case == "sse_no_get": methods = ["POST"]
            if case in ("duplicate_operation", "params_mismatch"): methods = ["GET", "POST"]
            for method in methods:
                actual = "POST" if case == "wrong_method" else method
                op_id = f"op.{index}." + ("same" if case == "duplicate_operation" else method.lower())
                auth = {"required": method != "GET", "callers": ["service"] if method != "GET" else ["user"]}
                op = {"operationId": op_id, "method": actual, "title": method + " title", "description": method + " description", "auth": auth}
                renderers = [{"renderer": "bootstrap5"}, {"renderer":"bootstrap5", "kind":"fragment", "key":"nav.menu"}, {"renderer":"bootstrap5", "kind":"component", "key":"card"}] if spec.get("rendering") else []
                py_method = f'''from betterportal.handler import Handler
from betterportal.registry import Operation
from betterportal.rendering import Renderer
from .{"support" if case == "no_index" else "index"} import response_schema, params_schema
def handle(context): raise AssertionError("Discovery invoked a request handler")
def render(value, context): raise AssertionError("Discovery invoked a renderer")
def create():
    return Operation(Handler(response_schema, handle, params={"None" if case == "params_mismatch" and method == "POST" else "params_schema"}, renderers=[Renderer(value, render) for value in {renderers!r}]), {op!r})
'''
                cs_renderers = ", ".join(f'new Renderer<object?>(Contracts.Parse<BetterPortal.Generated.RendererDeclarationInput>("RendererDeclarationSchema",Json.Read({json.dumps(json.dumps(value))})), Render)' for value in renderers)
                cs_method = f'''using AnyVali;
using BetterPortal;
namespace {ns};
public static class {method} {{
    public static string Render(object? value, RenderContext context) => throw new Exception("Discovery invoked a renderer");
    [RouteModule] public static Operation Create() => new(new Handler<object?,object?,object?,object?,object?>(Index.Response,
        _=>throw new Exception("Discovery invoked a request handler"), @params:{"null" if case == "params_mismatch" and method == "POST" else "Index.Params"}, renderers:[{cs_renderers}]),
        Contracts.Parse<BetterPortal.Generated.OperationDeclarationInput>("OperationDeclarationSchema",Json.Read({json.dumps(json.dumps(op))})));
}}
'''
                if case == "raw":
                    py_method = py_method.replace("from betterportal.handler import Handler", "from betterportal.response import RawHandler").replace("Handler(response_schema, handle,", "RawHandler(handle,").replace(f", renderers=[Renderer(value, render) for value in {renderers!r}]", "")
                    cs_method = cs_method.replace("new Handler<object?,object?,object?,object?,object?>(Index.Response,", "new RawHandler<object?,object?,object?,object?>(").replace(", renderers:[]", "")
                if case == "finite":
                    py_method = py_method.replace("from betterportal.handler import Handler", "from betterportal.finite import FiniteHandler, StreamRenderers").replace("Handler(response_schema, handle,", "FiniteHandler(response_schema, handle, stream_renderers=[StreamRenderers('bootstrap5', render, render)],")
                    cs_method = cs_method.replace("new Handler<object?,object?,object?,object?,object?>(Index.Response,", "new FiniteHandler<object?,object?,object?,object?,object?,object?>(Index.Response,").replace("_=>throw new Exception(\"Discovery invoked a request handler\")", "(_,_)=>throw new Exception(\"Discovery invoked a request handler\")").replace("renderers:[]", "streamRenderers:[new StreamRenderers<object?,object?>(\"bootstrap5\",(_,_)=>throw new Exception(\"shell executed\"),(_,_)=>throw new Exception(\"item executed\"))]")
                if case == "async_factory":
                    py_method = py_method.replace("def create():", "async def create():")
                    cs_method = cs_method.replace("public static Operation Create() => new(", "public static Task<Operation> Create() => Task.FromResult(new Operation(").replace(")));\n}", "))));\n}")
                if case == "wrong_factory":
                    py_method = "def create(): return 42\n"
                    cs_method = f"using BetterPortal; namespace {ns}; public static class GET {{ [RouteModule] public static int Create() => 42; }}"
                filename = method.lower() if case == "lower_method" else method
                write(py_dir / (filename + ".py"), py_method)
                write(cs_dir / (filename + ".cs"), cs_method)
            if spec.get("sse") or case.startswith("sse_") or case == "qualified_sse":
                py_feed = '''import anyvali as av
from betterportal.feeds import SseFeed
from betterportal.sse import SseRoute, LocalEvents
def create(owner, view_id):
    return SseFeed(owner, SseRoute(view_id, av.string(), av.string(), lambda value, context: value, transport=LocalEvents()))
'''
                cs_feed = f'''using AnyVali; using BetterPortal; namespace {ns};
public static class Feed {{
    [RouteModule] public static SseFeed<string,string> Create(Handler<object?,object?,object?,object?> owner, string viewId) => SseFeed<string,string>.Bind(owner,
        new SseRoute<string,string,HandlerContext<object?,object?,object?,object?>>(viewId,V.String(),V.String(),(value,context,signal)=>ValueTask.FromResult(value),new LocalEvents()));
}}
'''
                if case == "sse_wrong_view":
                    py_feed = py_feed.replace("SseRoute(view_id,", 'SseRoute("other",')
                    cs_feed = cs_feed.replace("(viewId,V.String()", '("other",V.String()')
                if case == "sse_wrong_owner":
                    py_feed = py_feed.replace("def create(owner, view_id):", "from .GET import create as get\ndef create(owner, view_id):\n    owner = get().handler")
                    cs_feed = cs_feed.replace(".Bind(owner,", ".Bind((Handler<object?,object?,object?,object?>)GET.Create().Handler,")
                if spec.get("rendering"):
                    py_feed = py_feed.replace("from betterportal.feeds", "from betterportal.rendering import Renderer\nfrom betterportal.feeds").replace("transport=LocalEvents()))", "transport=LocalEvents()), renderers=[Renderer({'renderer':'bootstrap5','kind':'fragment','key':'nav.menu'}, lambda value, context: value)])")
                    cs_feed = cs_feed.replace("new LocalEvents()));", 'new LocalEvents()), [new Renderer<string>(new() {Renderer="bootstrap5",Kind=BetterPortal.Generated.RendererDeclarationInputKind.Fragment,Key="nav.menu"}, (value,context)=>value)]);')
                filename = "GET.sse" if case == "qualified_sse" else "sse"
                write(py_dir / (filename + ".py"), py_feed)
                write(cs_dir / (filename + ".cs"), cs_feed)
        if not spec.get("error") and spec["path"]:
            node_dir = node / case / "bp-routes" / spec["path"]
            write(node_dir / "index.ts", "\n".join(f"export const {key} = {json.dumps(value)};" for key, value in spec.get("declaration", {}).items()))
            for method in spec.get("methods", ["GET"]):
                write(node_dir / (method + ".ts"), f'export const operationId="op.0.{method.lower()}"; export default () => {{ throw new Error("must not execute"); }};')
    for filename, source in re.findall(r"<!-- file: ([^ ]+) -->\n```\w+\n(.*?)```", guide, re.S):
        write(directory / filename, source)
    for filename in ("my_service/__init__.py", "my_service/bp_routes/__init__.py"): write(python / filename, "")
    run(["dotnet", "build", str(dotnet), "-m:1", "-p:UseSharedCompilation=false"], directory)
    assembly = dotnet / "bin/Debug/net10.0/Routes.dll"
    # The deployed assembly must not consult C# source files or PDBs.
    for path in dotnet.rglob("*.cs"):
        assert path.resolve().is_relative_to(dotnet.resolve())
        path.unlink()
    for path in assembly.parent.glob("*.pdb"): path.unlink()
    node_script = directory / "scan.mjs"
    write(node_script, f'''import {{scanRoutes}} from {json.dumps((root / "framework/nodejs/lib/codegen/scanner.js").as_uri())};
console.log(JSON.stringify(scanRoutes(process.argv[2]).routes.map(route=>({{path:route.path,viewId:route.viewId,operationIds:route.methodModules.map(method=>method.operationId)}}))));
''')
    results = {}
    for language, command, source, project in (
        ("python", [sys.executable, "-m", "betterportal"], ["--module", "entry:export"], python),
        ("dotnet", ["dotnet", str(tool)], ["--assembly", str(assembly), "--factory", "Entry:Export"], dotnet),
    ):
        print("Checking route discovery in " + language, flush=True)
        output = project / "bp-contract.json"
        export_command = [*command, "export", *source, "--project", str(project), "--output", "bp-contract.json"]
        run(export_command, directory, case="example")
        example = json.loads(output.read_bytes())
        assert example["manifest"]["pluginId"] == "com.example.hello" and example["routes"][0]["path"] == "/hello"
        assert example["routes"][0]["renderers"] == ["bootstrap5"]
        run([*export_command, "--check"], directory, case="example")
        for spec in cases:
            case = spec["name"]
            output.write_bytes(b"previous contract")
            message = run(export_command, directory, not spec.get("error"), case)
            if spec.get("error"):
                assert output.read_bytes() == b"previous contract", case
                if "message" in spec: assert spec["message"] in message, (case, message)
                continue
            value = json.loads(output.read_bytes())
            route = value["routes"][0]; view = value["manifest"]["views"][0]
            assert set(route["pathVariants"] or [route["path"]]) == set(spec["paths"]), (case, route)
            assert route["viewId"] == view["viewId"] == spec["view"], (case, route)
            assert view["title"] == spec.get("declaration", {}).get("title", "GET title")
            assert view["description"] == spec.get("declaration", {}).get("description", "GET description")
            for operation in view["operations"]:
                assert operation["operationId"] == "op.0." + operation["method"].lower()
                assert operation["auth"]["required"] == (operation["method"] != "GET")
                assert operation["auth"]["callers"] == (["user"] if operation["method"] == "GET" else ["service"])
            if spec.get("rendering"):
                assert len(route["fragments"]) == 2 and {item["method"] for item in route["fragments"]} == {"GET", "POST"}
                assert route["components"] == ["card"] and route["renderers"] == ["bootstrap5"]
            if case == "raw": assert view["operations"][0]["raw"] and not route["renderers"]
            if case == "finite": assert view["operations"][0]["streaming"]["itemSchema"]["root"]["kind"] == "string" and route["renderers"] == ["bootstrap5"]
            run([*export_command, "--check"], directory, case=case)
            results[language, case] = value
    for spec in cases:
        if spec.get("error"): continue
        case = spec["name"]
        assert normalized(results["python", case]) == normalized(results["dotnet", case]), (case, results["python", case], results["dotnet", case])
        if spec["path"]:
            scanned = json.loads(run(["node", str(node_script), str(node / case)], directory))
            assert {item["path"] for item in scanned} == set(spec["paths"]), (case, scanned)
            assert {item["viewId"] for item in scanned} == {spec["view"]}, (case, scanned)
            assert all(set(item["operationIds"]) == {"op.0." + method.lower() for method in spec.get("methods", ["GET"])} for item in scanned)
print(f"{checks} compiled/module discovery, Node path, and native contract-export checks passed")
