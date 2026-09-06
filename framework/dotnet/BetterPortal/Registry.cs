using AnyVali;
using System.Collections.Frozen;
using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class Operation
{
    private readonly Node declaration;
    public Handler Handler { get; }
    public string Id => (string)declaration["operationId"]!;
    public string Method => (string)declaration["method"]!;
    public Generated.OperationDeclaration Declaration => Contracts.Parse<Generated.OperationDeclaration>("OperationDeclarationSchema", declaration);
    public Operation(Handler handler, Generated.OperationDeclarationInput declaration)
    { Handler = handler; this.declaration = (Node)Contracts.Parse("OperationDeclarationSchema", declaration)!; }
    public ValueTask<object?> Invoke(RequestContext context, IReadOnlyDictionary<string, object?> values, CancellationToken cancellation = default)
    {
        if (context.Method != Method) throw new ArgumentException("Operation method does not match the request context");
        return Handler.InvokeBoxed(context, values, cancellation);
    }
    internal static Node Export(Schema schema) => (Node)Json.Read(Json.Write(V.Export(schema)))!;
    internal Node Metadata(string viewId, IReadOnlyDictionary<string, string> aliases, string pluginId)
    {
        var result = (Node)Json.Read(Json.Write(declaration))!;
        foreach (var (source, target) in new[] { ("query", "querySchema"), ("headers", "headersSchema"), ("request", "bodySchema") })
            result[target] = Handler.Schemas.TryGetValue(source, out var schema) ? Export(schema) : new Node();
        result["jsonResponseSchema"] = Handler.ResponseSchema is { } response ? Export(response) : new Node(); result["metadataResponseSchema"] = new Node();
        if (Handler.IsRaw) result["raw"] = true;
        result["renderable"] = false; result["html"] = new Node { ["renderers"] = new Node() };
        result.TryAdd("sitemap", new Node { ["kind"] = "default" });
        foreach (var dependency in ((List<object?>)result["dependencies"]!).Cast<Node>())
        {
            if (!dependency.TryGetValue("serviceId", out var alias)) continue;
            if (!aliases.TryGetValue((string)alias!, out var service)) throw new ArgumentException("Unknown dependency alias: " + alias);
            if (service == pluginId) dependency.Remove("serviceId"); else dependency["serviceId"] = service;
        }
        var callers = ((List<object?>)((Node)result["auth"]!)["callers"]!).Cast<string>().ToHashSet(StringComparer.Ordinal);
        foreach (var descriptor in ((List<object?>)result["apiContracts"]!).Cast<Node>())
        {
            if (!((List<object?>)descriptor["modes"]!).Cast<string>().All(callers.Contains))
                throw new ArgumentException("API contract caller modes are not allowed by the operation");
            descriptor["viewId"] = viewId; descriptor["methods"] = new List<object?> { Method };
        }
        foreach (var rule in ((List<object?>)result["robots"]!).Cast<Node>())
            if (!Regex.IsMatch((string)rule["userAgent"]!, @"\A[A-Za-z0-9*._-]{1,100}\z")) throw new ArgumentException("Invalid robots user-agent token");
        return (Node)Contracts.Parse("ViewOperationMetadataSchema", result)!;
    }
}

public sealed class Route
{
    public string ViewId { get; }
    public IReadOnlyList<string> Paths { get; }
    public IReadOnlyList<Operation> Operations { get; }
    public IReadOnlyList<string> ParamNames => Paths.SelectMany(path => Segments(path).Where(part => part.StartsWith(':')).Select(part => part[1..])).Distinct(StringComparer.Ordinal).ToArray();
    public Route(string viewId, string path, IEnumerable<Operation> operations, IEnumerable<string>? pathVariants = null)
    {
        ViewId = (string)Contracts.Parse(Contracts.Get("ViewMetadataSchema", "viewId"), viewId)!;
        Paths = Array.AsReadOnly(new[] { path }.Concat(pathVariants ?? []).Distinct(StringComparer.Ordinal)
            .OrderByDescending(value => Segments(value).Count(part => part.StartsWith(':'))).ThenByDescending(value => value.Length).ThenBy(value => value, StringComparer.Ordinal).ToArray());
        Operations = Array.AsReadOnly(operations.ToArray());
        if (Operations.Count == 0 || Operations.Select(operation => operation.Method).Distinct(StringComparer.Ordinal).Count() != Operations.Count)
            throw new ArgumentException("A route needs unique method operations");
        var schemas = Operations.Select(operation => operation.Handler.Schemas.TryGetValue("params", out var schema) ? Operation.Export(schema) : new Node()).ToArray();
        if (schemas.Skip(1).Any(schema => !System.Text.Json.Nodes.JsonNode.DeepEquals(System.Text.Json.Nodes.JsonNode.Parse(Json.Write(schemas[0])),
            System.Text.Json.Nodes.JsonNode.Parse(Json.Write(schema))))) throw new ArgumentException("A view must publish one consistent params schema");
    }
    internal static string[] Segments(string path)
    {
        if (!path.StartsWith('/') || path.IndexOfAny(['?', '#', '\\', '%']) >= 0 || path.Any(c => c < 33)) throw new ArgumentException("Expected a root-relative route path");
        var segments = path == "/" ? [] : path[1..].Split('/');
        if (segments.Any(part => part.Length == 0 || part is "." or ".." || part.IndexOfAny(['[', ']', '{', '}']) >= 0)) throw new ArgumentException("Invalid route segment");
        var parameters = segments.Where(part => part.StartsWith(':')).Select(part => part[1..]).ToArray();
        if (parameters.Any(name => !Regex.IsMatch(name, @"\A[A-Za-z_][A-Za-z0-9_]*\z")) || parameters.Distinct(StringComparer.Ordinal).Count() != parameters.Length)
            throw new ArgumentException("Invalid or duplicate route parameter");
        if (segments.Any(part => part.Contains(':') && !part.StartsWith(':'))) throw new ArgumentException("Parameters must occupy a complete route segment");
        return segments;
    }
}

public sealed class Registry
{
    public IReadOnlyList<Route> Routes { get; }
    public IReadOnlyDictionary<string, string> Dependencies { get; }
    public Registry(IEnumerable<Route> routes, IReadOnlyDictionary<string, string>? dependencies = null)
    {
        Routes = Array.AsReadOnly(routes.ToArray());
        Dependencies = (dependencies ?? new Dictionary<string, string>()).ToFrozenDictionary(pair => pair.Key,
            pair => (string)Contracts.Parse("PluginIdSchema", pair.Value)!, StringComparer.Ordinal);
        var viewIds = new HashSet<string>(StringComparer.Ordinal); var operationIds = new HashSet<string>(StringComparer.Ordinal); var paths = new HashSet<(string, string)>();
        foreach (var route in Routes)
        {
            if (!viewIds.Add(route.ViewId)) throw new ArgumentException("Duplicate view ID: " + route.ViewId);
            foreach (var operation in route.Operations)
            {
                if (!operationIds.Add(operation.Id)) throw new ArgumentException("Duplicate operation ID: " + operation.Id);
                foreach (var path in route.Paths)
                    if (!paths.Add((operation.Method, string.Join('/', Route.Segments(path).Select(part => part.StartsWith(':') ? ":" : part)))))
                        throw new ArgumentException("Ambiguous route path: " + path);
            }
        }
    }
    private Node ManifestNode(Generated.ManifestDeclarationInput declaration)
    {
        var result = (Node)Contracts.Parse("ManifestDeclarationSchema", declaration)!;
        var pluginId = (string)result["pluginId"]!;
        var local = Routes.SelectMany(route => route.Operations.Select(operation => (operation.Id, operation.Method))).ToHashSet();
        var views = new List<object?>(); var contracts = new List<object?>((List<object?>)result["apiContracts"]!);
        foreach (var route in Routes)
        {
            var operations = route.Operations.Select(operation => operation.Metadata(route.ViewId, Dependencies, pluginId)).ToArray();
            foreach (var operation in operations)
            {
                foreach (var dependency in ((List<object?>)operation["dependencies"]!).Cast<Node>())
                    if (!dependency.ContainsKey("serviceId") && !local.Contains(((string)dependency["operationId"]!, (string)dependency["method"]!)))
                        throw new ArgumentException("Unavailable local operation dependency");
                contracts.AddRange((List<object?>)operation["apiContracts"]!);
            }
            var primary = operations.FirstOrDefault(operation => operation["method"] is "GET") ?? operations[0];
            views.Add(new Node { ["viewId"] = route.ViewId, ["path"] = route.Paths[0], ["pathVariants"] = route.Paths.Count > 1 ? route.Paths : [],
                ["title"] = primary["title"], ["description"] = primary["description"], ["operations"] = operations,
                ["paramsSchema"] = route.Operations[0].Handler.Schemas.TryGetValue("params", out var schema) ? Operation.Export(schema) : new Node() });
        }
        var capabilities = ((List<object?>)result["capabilities"]!).Cast<string>().Concat(["view.json", "view.metadata"]).ToList();
        var renderers = new List<string>();
        if (result.TryGetValue("shell", out var shell)) { renderers.Add((string)((Node)shell!)["renderer"]!); capabilities.Add("renderer." + renderers[0]); }
        if (((List<object?>)result["configSchemas"]!).Count > 0)
        {
            var apis = (List<object?>)result["adminApis"]!;
            var existing = apis.Cast<Node>().Select(api => (string)api["id"]!).ToHashSet(StringComparer.Ordinal);
            foreach (var (id, title, description, path, methods) in new[] {
                ("config.schema", "Config Schema", "BetterPortal-managed config schemas for this service.", "/.well-known/bp/config/schema", new[] { "GET" }),
                ("config.values", "Config Values", "Read and write BetterPortal-managed config values.", "/.well-known/bp/config", new[] { "GET", "POST" }) })
                if (!existing.Contains(id)) apis.Add(new Node { ["id"] = id, ["title"] = title, ["description"] = description, ["path"] = path, ["methods"] = methods, ["supportsCustomUi"] = false });
        }
        result["protocolVersion"] = 2; result["views"] = views; result["capabilities"] = capabilities.Distinct(StringComparer.Ordinal).ToArray();
        result["supportedRenderers"] = renderers; result["supportedRenderModes"] = Array.Empty<string>(); result["apiContracts"] = contracts;
        return (Node)Contracts.Parse("PluginManifestSchema", result)!;
    }
    public Generated.PluginManifest Manifest(Generated.ManifestDeclarationInput declaration) => Contracts.Parse<Generated.PluginManifest>("PluginManifestSchema", ManifestNode(declaration));
    public Generated.BpSchemaOutput Schema(Generated.ManifestDeclarationInput declaration) => Contracts.Parse<Generated.BpSchemaOutput>("BpSchemaOutputSchema", new Node
    {
        ["manifest"] = ManifestNode(declaration), ["routes"] = Routes.Select(route => new Node
        {
            ["viewId"] = route.ViewId, ["path"] = route.Paths[0], ["pathVariants"] = route.Paths.Count > 1 ? route.Paths : [],
            ["operations"] = route.Operations.Select(operation => new { operationId = operation.Id, method = operation.Method }).ToArray(),
            ["paramNames"] = route.ParamNames, ["renderers"] = Array.Empty<string>(), ["hasFragments"] = false,
            ["fragments"] = Array.Empty<object>(), ["components"] = Array.Empty<string>()
        }).ToArray()
    });
}
