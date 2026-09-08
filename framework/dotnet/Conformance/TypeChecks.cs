using BetterPortal;
using BetterPortal.Generated;
using System.Text.Json;
using Json = BetterPortal.Json;

internal static class TypeChecks
{
    private static void Check(bool valid, string message) { if (!valid) throw new Exception(message); }
    internal static void Run()
    {
        var empty = new ApiAuthRequirementInput();
        Check(Json.Write(empty) == "{}", "Missing input defaults must remain omitted");
        var auth = Contracts.Parse<ApiAuthRequirement>("ApiAuthRequirementSchema", empty);
        Check(!auth.Required && auth.Callers.SequenceEqual([ApiCallerMode.User]) && auth.Permissions.Count == 0, "AnyVali must materialize output defaults");
        Check(Json.Write(new ApiAuthRequirementInput { Required = false }) == "{\"required\":false}", "Present false must not become missing");
        var write = new ServiceConfigWriteRequestInput { TenantId = "tenant", Values = new JsonObjectInput(new Dictionary<string, System.Text.Json.Nodes.JsonNode?>()) };
        var absent = (Dictionary<string, object?>)Json.Read(Json.Write(write))!;
        Check(!absent.ContainsKey("appId"), "Omitted app ID must not become null");
        var present = (Dictionary<string, object?>)Json.Read(Json.Write(write with { AppId = new Optional<string>(null!) }))!;
        Check(present.ContainsKey("appId") && present["appId"] is null, "Explicit null must remain present");
        Check(!Contracts.Get("ServiceConfigWriteRequestSchema").SafeParse(present).Success, "AnyVali must reject a non-nullable null");
        var recursive = Contracts.Parse<JsonValue>("JsonValueSchema", new { items = new object?[] { null, true, 2, new { text = "value" } } });
        Check(recursive.Value!["items"]![3]!["text"]!.GetValue<string>() == "value", "Recursive JSON must use the native DOM");
        Check(Json.Write(Contracts.Parse<JsonValue>("JsonValueSchema", null)) == "null", "Root null must survive typed decoding");
        var defaults = Contracts.Parse<AppAuthProviderConfig>("AppAuthProviderConfigSchema", new { kind = "betterportal.default" });
        Check(defaults.Value.Match(value => value.Kind == DefaultAuthProviderConfigKind.BetterportalDefault, _ => false), "First union branch must decode");
        var external = Contracts.Parse<AppAuthProviderConfig>("AppAuthProviderConfigSchema", new { kind = "authress.io" });
        Check(external.Value.Match(_ => false, value => value.RoleClaimPath == "roles" && value.SubjectClaimPath == "sub"), "Second union branch must decode with defaults");
        var scalar = Contracts.Parse<ObservabilityValue>("ObservabilityValueSchema", true);
        Check(Json.Write(scalar) == "true", "Nested scalar union must remain a JSON boolean");
        var resource = Contracts.Parse<BetterPortalResource>("BetterPortalResourceSchema", new { serviceName = "service", customCounter = 2 });
        Check(Json.Read(Json.Write(resource)) is Dictionary<string, object?> value && Equals(value["customCounter"], 2L), "Open intersection must retain extra keys");
        var nullChoice = JsonSerializer.Deserialize<Variant<string, JsonNull>>("null", Json.Options);
        Check(nullChoice.Match(_ => false, _ => true), "A null union must select the explicit null branch");
        var child = Contracts.Document("JsonValueSchema");
        var composed = Contracts.ObjectDocument(new Dictionary<string, Dictionary<string, object?>> { ["first"] = child, ["second"] = child }, "reject");
        Check(Contracts.Import(composed).SafeParse(Json.Read("{\"first\":[null],\"second\":{\"x\":true}}")).Success, "Portable composition must retain shared definitions");
        var conflicting = Contracts.Document("JsonValueSchema");
        var definitions = (Dictionary<string, object?>)conflicting["definitions"]!;
        definitions[definitions.Keys.First()] = new Dictionary<string, object?> { ["kind"] = "bool" };
        try
        {
            Contracts.ObjectDocument(new Dictionary<string, Dictionary<string, object?>> { ["first"] = child, ["second"] = conflicting });
            throw new Exception("Conflicting definitions were accepted");
        }
        catch (ArgumentException error) when (error.Message.StartsWith("Conflicting definitions", StringComparison.Ordinal)) { }
        ((Dictionary<string, object?>)composed["definitions"]!).Clear();
        Check(((Dictionary<string, object?>)child["definitions"]!).Count > 0, "Composition must not mutate its inputs");
        var handler = new Handler<object?, ApiAuthRequirement, object?, object?, TokenLifetimeConfig>(Contracts.Get("TokenLifetimeConfigSchema"),
            context => ValueTask.FromResult(new TokenLifetimeConfig { AccessTokenSeconds = context.Query.Required ? 300 : 900, RefreshTokenSeconds = 604800 }),
            query: Contracts.Get("ApiAuthRequirementSchema"));
        var tenantId = Guid.CreateVersion7().ToString(); var appId = Guid.CreateVersion7().ToString();
        var config = new ScopedConfig(new { managementOrigins = Array.Empty<string>(), tenants = new[] { new { id = tenantId, slug = "tenant", title = "Tenant", services = Array.Empty<object>() } },
            apps = new[] { new { id = appId, tenantId, slug = "app", title = "App", hostnames = new[] { "example.test" } } } });
        var context = new RequestContext(config.ById(tenantId, appId)!, new(), "GET", "/");
        var inputs = new Dictionary<string, object?>();
        Check(handler.Invoke(context, inputs).AsTask().GetAwaiter().GetResult().AccessTokenSeconds == 900, "Typed handler input/output defaults changed");
        var prepared = handler.Prepare(context, inputs);
        var payload = new { @params = prepared.Params, query = prepared.Query, headers = prepared.Headers, request = prepared.Request };
        Check(Json.Write(Contracts.Parse(Contracts.Import(handler.InputDocument), payload)) == Json.Write(payload), "Handler type document differs from parsed inputs");
        Console.WriteLine("Native C# generated types: defaults, presence, recursion, unions and open mappings passed");
    }
}
