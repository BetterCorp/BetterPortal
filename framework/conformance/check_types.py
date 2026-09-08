"""Native type checks: generation drift, compiler rejection and typed wire round trips."""
from pathlib import Path
import os
import json
import subprocess
import sys
import typing
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
environment = {**os.environ, "PYTHONPATH": str(root / "framework/python")}
sys.path.insert(0, environment["PYTHONPATH"])
import betterportal.generated_types as generated_types
from betterportal.contracts import document, object_document
from betterportal.typegen import generate_types
import anyvali as av

for declaration in vars(generated_types).values():
    if isinstance(declaration, type) and hasattr(declaration, "__required_keys__"):
        typing.get_type_hints(declaration, vars(generated_types), include_extras=True)

recursive = document("JsonValueSchema")
composed = object_document({"first": recursive, "second": recursive}, unknown_keys="reject")
assert av.import_schema(composed).parse({"first": [None], "second": {"x": True}}) == {"first": [None], "second": {"x": True}}
conflicting = json.loads(json.dumps(recursive))
definition = next(iter(conflicting["definitions"]))
conflicting["definitions"][definition] = {"kind": "bool"}
try:
    object_document({"first": recursive, "second": conflicting})
    raise AssertionError("Conflicting definitions were accepted")
except ValueError as error:
    assert "Conflicting definitions" in str(error), str(error)
composed["definitions"].clear()
assert recursive["definitions"], "Composition must not mutate its inputs"
python = sys.executable
subprocess.run([python, "-m", "betterportal", "types", "--platform", "--output",
    str(root / "framework/python/betterportal/generated_types.py"), "--check"], env=environment, check=True)
subprocess.run([python, "-m", "mypy", str(root / "framework/python/betterportal"), "--follow-imports=silent", "--follow-untyped-imports",
    "--cache-dir", str(root / ".tmp-run/mypy-ports")], env=environment, check=True)

directory = root / ".tmp-run/ports-types"
directory.mkdir(parents=True, exist_ok=True)
positive = directory / "positive.py"
positive.write_text('''from betterportal.generated_types import ApiAuthRequirementInput, ApiAuthRequirement, TokenLifetimeConfig, TokenType, JsonValue
request: ApiAuthRequirementInput = {}
output: TokenLifetimeConfig = {"accessTokenSeconds": 900, "refreshTokenSeconds": 604800}
purpose: TokenType = "access"
value: JsonValue = {"nested": [None, True, 1.5, {"x": "value"}]}
from typing import Any
from betterportal.handler import Handler, HandlerContext
from betterportal.contracts import contract
def handle(context: HandlerContext[Any, ApiAuthRequirement, Any, Any]) -> TokenLifetimeConfig:
    return {"accessTokenSeconds": 900, "refreshTokenSeconds": 604800}
handler = Handler[Any, ApiAuthRequirement, Any, Any, TokenLifetimeConfig](contract("TokenLifetimeConfigSchema"), handle, query=contract("ApiAuthRequirementSchema"))
from betterportal.response import RawHandler, RawResponse
download = RawHandler[Any, Any, Any, Any](lambda context: RawResponse.file(b"hello", "report.txt"))
from betterportal.rendering import Renderer, RenderContext
def render(value: TokenLifetimeConfig, context: RenderContext) -> str:
    return str(value["accessTokenSeconds"]) + context.tenant["title"]
renderer = Renderer[TokenLifetimeConfig]({"renderer": "bootstrap5"}, render)
html = Handler[Any, ApiAuthRequirement, Any, Any, TokenLifetimeConfig](contract("TokenLifetimeConfigSchema"), handle, renderers=[renderer])
from betterportal.urls import Urls
url: str = Urls.path("/hello", {"query": {"count": 42, "missing": None}, "fragment": "nav.profile"})
from typing import AsyncIterator
from betterportal.finite import FiniteHandler, StreamRenderers
from betterportal.streaming import Summary
async def produce(context: HandlerContext[Any, ApiAuthRequirement, Any, Any]) -> AsyncIterator[TokenLifetimeConfig | Summary[TokenLifetimeConfig]]:
    yield output
    yield Summary(output)
stream_renderers = StreamRenderers[TokenLifetimeConfig, TokenLifetimeConfig]("bootstrap5",
    lambda data, context: data["sseConnectPath"], lambda data, context: str(data["accessTokenSeconds"]),
    summary=lambda data, context: str(data["refreshTokenSeconds"]))
finite = FiniteHandler[Any, ApiAuthRequirement, Any, Any, TokenLifetimeConfig, TokenLifetimeConfig](
    contract("TokenLifetimeConfigSchema"), produce, summary=contract("TokenLifetimeConfigSchema"),
    query=contract("ApiAuthRequirementSchema"), stream_renderers=[stream_renderers])
import anyvali as av
from betterportal.feeds import SseFeed
from betterportal.sse import LocalEvents, SseRoute, EventScope
from betterportal.registry import Operation, Route
from betterportal.generated_types import OperationDeclarationInput
initial = Renderer[TokenLifetimeConfig]({"renderer": "bootstrap5", "kind": "fragment", "key": "nav.clock"}, render)
owner = Handler[Any, ApiAuthRequirement, Any, Any, TokenLifetimeConfig](contract("TokenLifetimeConfigSchema"), handle, renderers=[initial])
transport = LocalEvents()
events = SseRoute[str, TokenLifetimeConfig, HandlerContext[Any, ApiAuthRequirement, Any, Any]]("clock", av.string(),
    contract("TokenLifetimeConfigSchema"), lambda value, context: output, transport=transport)
feed = SseFeed(owner, events, renderers=[initial])
operation_input: OperationDeclarationInput = {"operationId": "clock.get", "method": "GET", "title": "Clock", "description": "Clock", "auth": {}}
operation = Operation(owner, operation_input)
route = Route("clock", "/clock", [operation], sse=feed)
assert route.sse is feed
for build in (
    lambda: Route("wrong", "/clock", [operation], sse=feed),
    lambda: Route("clock", "/clock", [Operation(handler, operation_input)], sse=feed),
    lambda: SseFeed(handler, events, renderers=[initial]),
    lambda: SseFeed(owner, events, renderers=[initial, initial]),
    lambda: SseFeed(owner, events, renderers=[renderer]),
    lambda: Route("clock", "/clock", [Operation(owner, {**operation_input, "method": "POST"})], sse=feed),
):
    try: build()
    except ValueError: pass
    else: raise AssertionError("Invalid subscriber binding accepted")
''', encoding="utf-8")
command = [python, "-m", "mypy", "--follow-imports=silent", "--follow-untyped-imports", "--cache-dir", str(root / ".tmp-run/mypy-ports")]
subprocess.run([*command, str(positive)], env=environment, check=True)
subprocess.run([python, str(positive)], env=environment, check=True)
negative = directory / "negative.py"
negative.write_text('''from betterportal.generated_types import ApiAuthRequirement, TokenType, TokenLifetimeConfigInput
missing: ApiAuthRequirement = {}
purpose: TokenType = "not-a-token"
value: TokenLifetimeConfigInput = {"accessTokenSeconds": None}
from typing import Any
from betterportal.handler import HandlerContext
def bad(context: HandlerContext[Any, ApiAuthRequirement, Any, Any]) -> int:
    context.query["required"].upper()
    return "invalid response"
from betterportal.response import RawHandler
raw = RawHandler[Any, Any, Any, Any](lambda context: 42)
from betterportal.rendering import Renderer, RenderContext
def bad_render(value: ApiAuthRequirement, context: RenderContext) -> str:
    return context.tenant["services"]
renderer = Renderer[ApiAuthRequirement]({"renderer": "bootstrap5"}, lambda value, context: 42)
from betterportal.urls import Urls
invalid_url = Urls.path("/hello", {"query": {"array": [1]}})
from betterportal.finite import StreamRenderers
bad_stream = StreamRenderers[ApiAuthRequirement, ApiAuthRequirement]("bootstrap5", lambda data, context: data["missing"], lambda data, context: 42)
from betterportal.feeds import SseFeed
from betterportal.sse import EventScope
async def bad_publish(feed: SseFeed[Any, Any, Any, Any, ApiAuthRequirement, ApiAuthRequirement]) -> None:
    await feed.publish(EventScope("tenant", "app"), "wrong input type")
''', encoding="utf-8")
result = subprocess.run([*command, str(negative)], env=environment, capture_output=True, text=True)
assert result.returncode == 1 and result.stdout.count(": error:") == 15, result.stdout + result.stderr

tool = root / "framework/dotnet/BetterPortal.Tool/bin/Debug/net10.0/BetterPortal.Tool.dll"
subprocess.run(["dotnet", str(tool), "types", "--platform", "--output", str(root / "framework/dotnet/BetterPortal/GeneratedTypes.cs"), "--check"], check=True)
subprocess.run(["dotnet", str(root / "framework/dotnet/Conformance/bin/Debug/net10.0/Conformance.dll"), "--types"], check=True)

# Custom application documents exercise name escaping and lossless union projection.
custom = directory / "custom"
custom.mkdir(exist_ok=True)
def portable(node):
    return {"anyvaliVersion": "1.0", "schemaVersion": "1.1", "root": node}
def object_node(properties):
    return {"kind": "object", "properties": properties, "required": list(properties), "unknownKeys": "strip"}
application = portable(object_node({
    "Clone": {"kind": "string"}, "1 key": {"kind": "nullable", "inner": {"kind": "string"}},
    "with-default": {"kind": "bool", "default": False},
    "choice": {"kind": "union", "variants": [
        object_node({"kind": {"kind": "literal", "value": "lower"}}),
        object_node({"kind": {"kind": "literal", "value": "LOWER"}, "detail": {"kind": "string"}})]},
    "tuple": {"kind": "tuple", "items": [{"kind": "bool"}, {"kind": "string"}]},
}))
source = custom / "ApplicationSchema.json"
source.write_text(json.dumps(application), encoding="utf-8")
custom_py = custom / "application.py"
subprocess.run([python, "-m", "betterportal", "types", "--contracts", str(source), "--output", str(custom_py)], env=environment, check=True)
subprocess.run([*command, str(custom_py)], env=environment, check=True)
for documents in ({"SameSchema": portable({"kind": "string"}), "Same": portable({"kind": "bool"})},):
    try:
        generate_types(documents)
        raise AssertionError("Colliding type names were accepted")
    except ValueError as error:
        assert "collision" in str(error), str(error)
custom_cs = custom / "Application.cs"
subprocess.run(["dotnet", str(tool), "types", "--contracts", str(source), "--output", str(custom_cs), "--namespace", "Application.class"], check=True)
# Unrelated definitions must not hide canonical types; referenced bindings stay distinct.
bindings = custom / "bindings"
bindings.mkdir(exist_ok=True)
method = {"kind": "enum", "values": ["GET", "POST"]}
reference = {"kind": "ref", "ref": "#/definitions/Value"}
documents = {
    "MethodSchema": portable(method),
    "EnvelopeSchema": {**portable(object_node({"method": method})), "definitions": {"Unused": {"kind": "bool"}}},
    "TextEnvelopeSchema": {**portable(object_node({"value": reference})), "definitions": {"Value": {"kind": "string"}}},
    "FlagEnvelopeSchema": {**portable(object_node({"value": reference})), "definitions": {"Value": {"kind": "bool"}}},
}
for name, value in documents.items():
    (bindings / (name + ".json")).write_text(json.dumps(value), encoding="utf-8")
projection = generate_types(documents)
assert "'method': Required['MethodInput']" in projection, projection
scope = {}
exec(projection, scope)
for name, expected in (("TextEnvelope", str), ("FlagEnvelope", bool)):
    assert typing.get_args(typing.get_type_hints(scope[name], scope, include_extras=True)["value"]) == (expected,)
subprocess.run(["dotnet", str(tool), "types", "--contracts", str(bindings), "--output", str(custom / "Bindings.cs"), "--namespace", "Application.class"], check=True)
project = ET.Element("Project", Sdk="Microsoft.NET.Sdk")
properties = ET.SubElement(project, "PropertyGroup")
for key, value in {"TargetFramework": "net10.0", "OutputType": "Exe", "Nullable": "enable", "TreatWarningsAsErrors": "true"}.items():
    ET.SubElement(properties, key).text = value
ET.SubElement(ET.SubElement(project, "ItemGroup"), "ProjectReference", Include=str(root / "framework/dotnet/BetterPortal/BetterPortal.csproj"))
ET.ElementTree(project).write(custom / "Custom.csproj", encoding="unicode")
(custom / "Program.cs").write_text('''using BetterPortal;
using Application.@class;
var schema = Contracts.Import(System.IO.File.ReadAllText(args[0]));
var wire = Json.Read("""{"Clone":"value","1 key":null,"choice":{"kind":"LOWER","detail":"retained"},"tuple":[true,"value"]}""");
var value = Contracts.Parse<global::Application.@class.Application>(schema, wire);
if (value.Choice.Match(_ => false, second => second.Detail == "retained") != true)
    throw new System.Exception("Union decoding lost fields or changed enum case");
if (!Json.Write(value).Contains("\\\"detail\\\":\\\"retained\\\"")) throw new System.Exception("Union wire value changed");
var canonical = new EnvelopeInput { Method = MethodInput.GET };
var text = Contracts.Parse<TextEnvelope>(Contracts.Import(System.IO.File.ReadAllText(System.IO.Path.Combine(args[1], "TextEnvelopeSchema.json"))), new { value = "retained" });
var flag = Contracts.Parse<FlagEnvelope>(Contracts.Import(System.IO.File.ReadAllText(System.IO.Path.Combine(args[1], "FlagEnvelopeSchema.json"))), new { value = true });
if ((string)text.Value != "retained" || !(bool)flag.Value) throw new System.Exception("Different reference bindings were merged");
var renderer = new Renderer<BetterPortal.Generated.ApiAuthRequirement>(new() { Renderer = "bootstrap5" },
    (value, context) => value.Required.ToString() + context.Tenant.Title);
var handler = new Handler<object?, object?, object?, object?, BetterPortal.Generated.ApiAuthRequirement>(
    Contracts.Get("ApiAuthRequirementSchema"), context => System.Threading.Tasks.ValueTask.FromResult(
        Contracts.Parse<BetterPortal.Generated.ApiAuthRequirement>("ApiAuthRequirementSchema", new BetterPortal.Generated.ApiAuthRequirementInput())),
    renderers: new[] { renderer });
if (handler.Renderers.Count != 1) throw new System.Exception("Missing typed renderer");
var url = Urls.Path("/hello", new() { Fragment = "nav.profile", Query = new System.Collections.Generic.Dictionary<string, BetterPortal.Generated.UrlScalarInput?> { ["count"] = 42, ["missing"] = null } });
if (url != "/hello?count=42&_f=nav.profile") throw new System.Exception("Typed URL options changed");
var integers = new System.Collections.Generic.Dictionary<string, BetterPortal.Generated.UrlScalarInput?> {
    ["safe"] = 42, ["large"] = 9007199254740993L, ["min"] = long.MinValue, ["max"] = ulong.MaxValue };
if (Urls.Path("/ids", new() { Query = integers }) != "/ids?safe=42&large=9007199254740993&min=-9223372036854775808&max=18446744073709551615")
    throw new System.Exception("Typed URL integers lost precision");
BetterPortal.Generated.UrlScalarInput[] nativeIntegers = { (sbyte)-1, (byte)2, (short)-3, (ushort)4, 5, 6u };
if (Json.Write(nativeIntegers) != "[-1,2,-3,4,5,6]") throw new System.Exception("Small integer union conversions changed");
static async System.Collections.Generic.IAsyncEnumerable<StreamValue<BetterPortal.Generated.ApiAuthRequirement, BetterPortal.Generated.ApiAuthRequirement>> Produce(
    HandlerContext<object?, object?, object?, object?> context, [System.Runtime.CompilerServices.EnumeratorCancellation] System.Threading.CancellationToken cancellation)
{
    await System.Threading.Tasks.Task.CompletedTask;
    yield return StreamValue<BetterPortal.Generated.ApiAuthRequirement, BetterPortal.Generated.ApiAuthRequirement>.Item(
        Contracts.Parse<BetterPortal.Generated.ApiAuthRequirement>("ApiAuthRequirementSchema", new BetterPortal.Generated.ApiAuthRequirementInput()));
}
var streamed = new FiniteHandler<object?, object?, object?, object?, BetterPortal.Generated.ApiAuthRequirement, BetterPortal.Generated.ApiAuthRequirement>(
    Contracts.Get("ApiAuthRequirementSchema"), Produce, streamRenderers: new[] {
        new StreamRenderers<BetterPortal.Generated.ApiAuthRequirement, BetterPortal.Generated.ApiAuthRequirement>("bootstrap5",
            (data, context) => System.Threading.Tasks.ValueTask.FromResult(data.SseConnectPath),
            (data, context) => System.Threading.Tasks.ValueTask.FromResult(data.Required.ToString())) });
if (!streamed.IsStreaming || streamed.StreamRendererKeys.Count != 1) throw new System.Exception("Missing typed stream renderers");
await using var transport = new LocalEvents();
var fragment = new Renderer<BetterPortal.Generated.ApiAuthRequirement>(new() { Renderer = "bootstrap5", Kind = BetterPortal.Generated.RendererDeclarationInputKind.Fragment, Key = "nav.clock" },
    (data, context) => data.Required.ToString());
var owner = new Handler<object?, object?, object?, object?, BetterPortal.Generated.ApiAuthRequirement>(Contracts.Get("ApiAuthRequirementSchema"),
    context => System.Threading.Tasks.ValueTask.FromResult(Contracts.Parse<BetterPortal.Generated.ApiAuthRequirement>("ApiAuthRequirementSchema", new BetterPortal.Generated.ApiAuthRequirementInput())), renderers: new[] { fragment });
var events = new SseRoute<string, BetterPortal.Generated.ApiAuthRequirement, HandlerContext<object?, object?, object?, object?>>("clock", AnyVali.V.String(), Contracts.Get("ApiAuthRequirementSchema"),
    (input, context, cancellation) => System.Threading.Tasks.ValueTask.FromResult(Contracts.Parse<BetterPortal.Generated.ApiAuthRequirement>("ApiAuthRequirementSchema", new BetterPortal.Generated.ApiAuthRequirementInput())), transport);
var feed = SseFeed<string, BetterPortal.Generated.ApiAuthRequirement>.Bind(owner, events, new[] { fragment });
var operation = new Operation(owner, new() { OperationId = "clock.get", Method = BetterPortal.Generated.HttpMethodInput.GET, Title = "Clock", Description = "Clock", Auth = new() });
var route = new Route("clock", "/clock", new[] { operation }, sse: feed);
if (route.Sse != feed) throw new System.Exception("Missing typed feed");
foreach (System.Action build in new System.Action[] {
    () => { _ = new Route("wrong", "/clock", new[] { operation }, sse: feed); },
    () => { _ = new Route("clock", "/clock", new[] { new Operation(handler, new() { OperationId = "clock.get", Method = BetterPortal.Generated.HttpMethodInput.GET, Title = "Clock", Description = "Clock", Auth = new() }) }, sse: feed); },
    () => { _ = SseFeed<string, BetterPortal.Generated.ApiAuthRequirement>.Bind(handler, events, new[] { fragment }); },
    () => { _ = SseFeed<string, BetterPortal.Generated.ApiAuthRequirement>.Bind(owner, events, new[] { fragment, fragment }); },
    () => { _ = SseFeed<string, BetterPortal.Generated.ApiAuthRequirement>.Bind(owner, events, new[] { renderer }); },
    () => { _ = new Route("clock", "/clock", new[] { new Operation(owner, new() { OperationId = "clock.post", Method = BetterPortal.Generated.HttpMethodInput.POST, Title = "Clock", Description = "Clock", Auth = new() }) }, sse: feed); }
}) {
    try { build(); } catch (System.ArgumentException) { continue; }
    throw new System.Exception("Invalid subscriber binding accepted");
}
''', encoding="utf-8")
subprocess.run(["dotnet", "run", "--project", str(custom), "-p:UseSharedCompilation=false", "--", str(source), str(bindings)], check=True)

negative_dotnet = directory / "csharp-negative"
negative_dotnet.mkdir(exist_ok=True)
project = ET.Element("Project", Sdk="Microsoft.NET.Sdk")
properties = ET.SubElement(project, "PropertyGroup")
for key, value in {"TargetFramework": "net10.0", "OutputType": "Exe", "Nullable": "enable"}.items():
    ET.SubElement(properties, key).text = value
reference = ET.SubElement(ET.SubElement(project, "ItemGroup"), "Reference", Include="BetterPortal")
ET.SubElement(reference, "HintPath").text = str(root / "framework/dotnet/BetterPortal/bin/Debug/net10.0/BetterPortal.dll")
ET.ElementTree(project).write(negative_dotnet / "Negative.csproj", encoding="unicode")
(negative_dotnet / "Program.cs").write_text('''using BetterPortal.Generated;
var missing = new ApiAuthRequirement();
var invalid = new ApiAuthRequirementInput { Required = "yes" };
static int InvalidHandler(BetterPortal.HandlerContext<object, ApiAuthRequirement, object, object> context) {
    context.Query.Required.Trim();
    return "invalid response";
}
var renderer = new BetterPortal.Renderer<ApiAuthRequirement>(new() { Renderer = "bootstrap5" }, (value, context) => 42);
static string PrivateContext(BetterPortal.RenderContext context) => context.Tenant.Services;
var urlOptions = new RouteUrlOptionsInput { Absolute = "true" };
var stream = new BetterPortal.StreamRenderers<ApiAuthRequirement, ApiAuthRequirement>("bootstrap5",
    (data, context) => System.Threading.Tasks.ValueTask.FromResult(data.Missing),
    (data, context) => System.Threading.Tasks.ValueTask.FromResult(data.Required.Trim()));
static System.Threading.Tasks.Task BadPublish(BetterPortal.SseFeed<ApiAuthRequirement, ApiAuthRequirement> feed) =>
    feed.Publish(new("tenant", "app"), "wrong input type").AsTask();
''', encoding="utf-8")
result = subprocess.run(["dotnet", "build", str(negative_dotnet), "-m:1", "-p:UseSharedCompilation=false"], capture_output=True, text=True)
assert result.returncode != 0 and "CS9035" in result.stdout and "CS0029" in result.stdout and "CS1061" in result.stdout and "CS1503" in result.stdout, result.stdout + result.stderr
print("Native generators, positive/negative Python typing and C# wire checks passed")
