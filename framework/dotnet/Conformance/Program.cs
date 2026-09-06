using AnyVali;
using BetterPortal;

if (args.Contains("--types", StringComparer.Ordinal))
{
    TypeChecks.Run();
    return;
}

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapPost("/", async (HttpRequest request) =>
{
    if (request.HttpContext.Connection.RemoteIpAddress is not { } remote || !System.Net.IPAddress.IsLoopback(remote))
        return Results.StatusCode(403);
    try
    {
        using var reader = new StreamReader(request.Body);
        var body = (Dictionary<string, object?>)Json.Read(await reader.ReadToEndAsync())!;
        if (body.GetValueOrDefault("action") is string securityAction && (securityAction.StartsWith("jwt-", StringComparison.Ordinal) || securityAction.StartsWith("keys-", StringComparison.Ordinal)))
            return Results.Text(Json.Write(await SecurityAdapter.Run(body)), "application/json");
        var schema = body.TryGetValue("document", out var document) ? Contracts.Import(Json.Write(document)) : Contracts.Get((string)body["contract"]!);
        var action = body.GetValueOrDefault("action") as string;
        if (body.GetValueOrDefault("wrapDocument") is true)
            schema = Contracts.Import(Contracts.ObjectDocument(new Dictionary<string, Dictionary<string, object?>>
            {
                ["payload"] = (Dictionary<string, object?>)Json.Read(Json.Write(V.Export(schema)))!
            }));
        if (body.GetValueOrDefault("wrap") is true) schema = V.Object(new() { ["payload"] = schema });
        if (body.GetValueOrDefault("roundtrip") is true || action == "roundtrip") schema = V.Import(V.Export(schema));
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
