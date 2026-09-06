using BetterPortal;
using System.Text.Json;
using Json = BetterPortal.Json;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class RegistryAdapter
{
    public static object Run(Node body)
    {
        try
        {
            var registry = Build(body);
            var manifest = Contracts.Parse<BetterPortal.Generated.ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]);
            return new { status = 200, schema = registry.Schema(manifest) };
        }
        catch (Exception error) when (error is AnyVali.ValidationError or ArgumentException or JsonException) { return new { status = 400 }; }
    }
    public static Registry Build(Node body)
    {
        var routes = new List<BetterPortal.Route>();
        foreach (var item in ((List<object?>)body["routes"]!).Cast<Node>())
        {
            var operations = new List<Operation>();
            foreach (var operation in ((List<object?>)item["operations"]!).Cast<Node>())
            {
                var schemas = (Node?)operation.GetValueOrDefault("schemas") ?? [];
                AnyVali.Schema? Schema(string name) => schemas.TryGetValue(name, out var schema) ? Contracts.Import(Json.Write(schema)) : null;
                Handler handler = operation.GetValueOrDefault("raw") is true
                    ? new RawHandler<object?, object?, object?, object?>(_ => ValueTask.FromResult(new RawResponse()), Schema("params"), Schema("query"), Schema("headers"), Schema("request"))
                    : new Handler<object?, object?, object?, object?, object?>(Contracts.Import(Json.Write(operation["response"])), context => ValueTask.FromResult<object?>(body.GetValueOrDefault("returnConfig") is true ? context.RequestContext.Config : null),
                    Schema("params"), Schema("query"), Schema("headers"), Schema("request"),
                    ((List<object?>)operation.GetValueOrDefault("renderers", new List<object?>())!).Cast<Node>().Select(item => new Renderer<object?>(
                        Contracts.Parse<BetterPortal.Generated.RendererDeclarationInput>("RendererDeclarationSchema", item["declaration"]), (data, context) => "")));
                // Validate JSON before generated decoding so unknown declaration fields cannot disappear.
                var declaration = Contracts.Parse<BetterPortal.Generated.OperationDeclarationInput>("OperationDeclarationSchema", operation["declaration"]);
                operations.Add(new(handler, declaration));
            }
            routes.Add(new((string)item["viewId"]!, (string)item["path"]!, operations,
                ((List<object?>?)item.GetValueOrDefault("pathVariants"))?.Cast<string>()));
        }
        var dependencies = ((Node?)body.GetValueOrDefault("dependencies"))?.ToDictionary(pair => pair.Key, pair => (string)pair.Value!);
        return new Registry(routes, dependencies);
    }
}
