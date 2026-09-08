using AnyVali;
using BetterPortal;

if (args.Length == 2 && args[0] == "--registry")
{
    Console.WriteLine(Json.Write(RegistryAdapter.Run((Dictionary<string, object?>)Json.Read(File.ReadAllText(args[1]))!)));
    return;
}

if (args.Contains("--types", StringComparer.Ordinal))
{
    try { TypeChecks.Run(); }
    catch (Exception error) { Console.Error.WriteLine(error); Environment.ExitCode = 1; }
    return;
}

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var corsOrigins = System.Collections.Frozen.FrozenSet.ToFrozenSet(new[] { "https://app.test" }, StringComparer.Ordinal);
var cors = new Cors(new OriginPolicy(corsOrigins, corsOrigins), ["GET"]);
app.MapMethods("/cors", ["GET", "OPTIONS"], (HttpContext context) =>
{
    string? Header(string name) => context.Request.Headers.TryGetValue(name, out var value) ? value.ToString() : null;
    var preflight = context.Request.Method == "OPTIONS";
    try
    {
        var headers = preflight ? cors.Preflight(Header("origin"), Header("access-control-request-method"), Header("access-control-request-headers")) : cors.Headers(Header("origin"));
        foreach (var (name, value) in headers) context.Response.Headers[name] = value;
        if (preflight) return Results.StatusCode(204);
        context.Response.Headers["x-test-handler"] = "ran";
        return Results.Json(new { handled = true });
    }
    catch (CorsDeniedException)
    {
        context.Response.Headers.Vary = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers";
        return Results.StatusCode(403);
    }
});
app.MapPost("/", async (HttpRequest request) =>
{
    if (request.HttpContext.Connection.RemoteIpAddress is not { } remote || !System.Net.IPAddress.IsLoopback(remote))
        return Results.StatusCode(403);
    try
    {
        using var reader = new StreamReader(request.Body);
        var body = (Dictionary<string, object?>)Json.Read(await reader.ReadToEndAsync())!;
        if (body.GetValueOrDefault("action") is "runtime") return Results.Json(new { runtime = "dotnet" });
        if (body.GetValueOrDefault("action") is "clients") return Results.Json(await ClientAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "bootstrap") return Results.Json(await BootstrapAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "installation") return Results.Json(await InstallationAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "config-api") return Results.Json(await ConfigApiAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "handler") return Results.Json(await HandlerAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "registry") return Results.Json(RegistryAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "access") return Results.Json(AccessAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "hosting") return Results.Json(await HostingAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "snapshots") return Results.Json(await SnapshotAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "sync") return Results.Json(await SyncAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "settings-schema") return Results.Json(SettingsAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "settings-store") return Results.Json(await SettingsAdapter.Store(body));
        if (body.GetValueOrDefault("action") is "context" or "http-origin") return Results.Json(ContextAdapter.Run(body));
        if (body.GetValueOrDefault("action") is "sse-probe") return Results.Json(await SseAdapter.Probe());
        if (body.GetValueOrDefault("action") is "sse-wire") return await SseAdapter.Wire(body);
        if (body.GetValueOrDefault("action") is "stream-probe") return Results.Json(await StreamAdapter.Probe());
        if (body.GetValueOrDefault("action") is "stream") return await StreamAdapter.Run(body, request.HttpContext.RequestAborted);
        if (body.GetValueOrDefault("action") is "media")
        {
            try
            {
                var available = body.GetValueOrDefault("available") is List<object?> values ? values.Cast<string>() : null;
                var value = Media.Negotiate(body.GetValueOrDefault("accept") as string, available);
                return Results.Json(new { status = 200, output = new { kind = value.Kind, mode = value.Mode } });
            }
            catch (NotAcceptableException) { return Results.Json(new { status = 406 }); }
        }
        if (body.GetValueOrDefault("action") is "auth-request") return Results.Text(Json.Write(await AuthorizationAdapter.Run(body)), "application/json");
        if (body.GetValueOrDefault("action") is string cryptoAction && cryptoAction.StartsWith("crypto-", StringComparison.Ordinal))
            return Results.Text(Json.Write(EncryptionAdapter.Run(body)), "application/json");
        if (body.GetValueOrDefault("action") is string securityAction && (securityAction.StartsWith("jwt-", StringComparison.Ordinal) || securityAction.StartsWith("keys-", StringComparison.Ordinal)))
            return Results.Text(Json.Write(await SecurityAdapter.Run(body)), "application/json");
        var action = body.GetValueOrDefault("action") as string;
        if (action == "unsupported-extension")
        {
            try
            {
                Contracts.Import(Json.Write(body["document"]));
                return Results.Json(new { valid = false });
            }
            catch (ValidationError error)
            {
                var issue = error.Issues.FirstOrDefault();
                if (issue?.Code != IssueCodes.UnsupportedExtension) return Results.Json(new { valid = false });
                return Results.Json(new { valid = true, output = new { code = issue.Code } });
            }
        }
        var schema = body.TryGetValue("document", out var document) ? Contracts.Import(Json.Write(document)) : Contracts.Get((string)body["contract"]!);
        if (body.GetValueOrDefault("wrapDocument") is true)
            schema = Contracts.Import(Contracts.ObjectDocument(new Dictionary<string, Dictionary<string, object?>>
            {
                ["payload"] = (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(schema)))!
            }));
        if (body.GetValueOrDefault("wrap") is true) schema = V.Object(new() { ["payload"] = schema });
        var exportMode = action == "extension-export" && body.GetValueOrDefault("mode") is "extended" ? ExportMode.Extended : ExportMode.Portable;
        if (body.GetValueOrDefault("roundtrip") is true || action == "roundtrip") schema = V.Import(V.Export(schema, exportMode));
        if (action == "extension-export")
            return Results.Text(Json.Write(new { valid = true, output = V.Export(schema, exportMode).Extensions }), "application/json");
        if (action == "encrypt")
            return Results.Text(Json.Write(new { valid = true, output = V.Encrypt(schema, body["input"], (path, value) => "encrypted:" + Json.Write(value)) }), "application/json");
        if (action == "decrypt")
            return Results.Text(Json.Write(new { valid = true, output = V.Decrypt(schema, body["input"], (path, value) => Json.Read(((string)value!)["encrypted:".Length..])) }), "application/json");
        var result = action == "import" ? ParseResult.Ok(true)
            : action == "encrypted" ? V.SafeParseEncrypted(schema, body["input"])
            : schema.SafeParse(body["input"]);
        var response = new Dictionary<string, object?> { ["valid"] = result.Success, ["document"] = V.Export(schema) };
        if (result.Success) response["output"] = result.Data;
        return Results.Text(Json.Write(response), "application/json");
    }
    catch (Exception error)
    {
        return Results.Text(Json.Write(new { error = error.Message }), "application/json", statusCode: 500);
    }
});
app.Run();
