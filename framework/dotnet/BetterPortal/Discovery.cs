using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>The compiler records this factory's source file; deployment needs no source tree.</summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class RouteModuleAttribute([CallerFilePath] string sourceFile = "") : Attribute
{
    public string SourceFile { get; } = sourceFile;
}

/// <summary>Discover compiled index.cs / METHOD.cs / sse.cs factories, without invoking handlers.</summary>
public static class Discovery
{
    private static readonly string[] Methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

    public static Registry Discover(Assembly assembly, string rootDirectory = "bp-routes", IReadOnlyDictionary<string, string>? dependencies = null)
    {
        if (string.IsNullOrWhiteSpace(rootDirectory) || rootDirectory.IndexOfAny(['/', '\\']) >= 0 || rootDirectory is "." or "..")
            throw new ArgumentException("Expected a route root directory name");
        var modules = new SortedDictionary<string, Dictionary<string, MethodInfo>>(StringComparer.Ordinal);
        foreach (var method in assembly.GetTypes().SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly)))
        {
            if (method.GetCustomAttribute<RouteModuleAttribute>() is not { } attribute) continue;
            var parts = attribute.SourceFile.Replace('\\', '/').Split('/');
            var root = Array.IndexOf(parts, rootDirectory);
            if (root < 0) continue;
            if (root != Array.LastIndexOf(parts, rootDirectory) || root == parts.Length - 1)
                throw new ArgumentException("Route factory must have one unambiguous source root: " + attribute.SourceFile);
            var segments = parts[(root + 1)..^1];
            if (segments.Any(part => part == "__pycache__" || part.StartsWith("_renderer.", StringComparison.Ordinal) || part.StartsWith('.') && part != ".well-known")) continue;
            var file = parts[^1];
            if (!file.EndsWith(".cs", StringComparison.Ordinal)) throw new ArgumentException("Route factories require .cs source files");
            var kind = file[..^3];
            if (kind is not ("index" or "sse") && !Methods.Contains(kind, StringComparer.Ordinal))
                throw new ArgumentException("Use index.cs, uppercase method files, and one sse.cs for GET");
            if (!method.IsPublic || !method.IsStatic || method.ContainsGenericParameters || method.DeclaringType?.IsVisible != true)
                throw new ArgumentException("Route factories must be public static non-generic methods: " + method);
            var parameters = method.GetParameters();
            var valid = kind switch
            {
                "index" => parameters.Length == 0 && method.ReturnType == typeof(Generated.RouteDeclarationInput),
                "sse" => parameters.Length == 2 && typeof(Handler).IsAssignableFrom(parameters[0].ParameterType)
                    && parameters[1].ParameterType == typeof(string) && typeof(SseFeed).IsAssignableFrom(method.ReturnType),
                _ => parameters.Length == 0 && method.ReturnType == typeof(Operation)
            };
            if (!valid) throw new ArgumentException("Invalid synchronous route factory signature: " + method);
            var directory = string.Join('/', segments);
            if (!modules.TryGetValue(directory, out var entries)) modules[directory] = entries = new(StringComparer.Ordinal);
            if (!entries.TryAdd(kind, method)) throw new ArgumentException("Duplicate route factory: " + attribute.SourceFile);
        }
        if (modules.Count == 0) throw new ArgumentException("No compiled route factories found");
        var routes = new List<Route>();
        foreach (var (directory, entries) in modules)
        {
            if (!entries.TryGetValue("index", out var index)) throw new ArgumentException("Route modules require index.cs: " + directory);
            var (paths, defaultId) = Paths(directory.Length == 0 ? [] : directory.Split('/'));
            var declaration = (Node)Contracts.Parse("RouteDeclarationSchema", Create(index))!;
            var viewId = (string)declaration.GetValueOrDefault("viewId", defaultId)!;
            var operations = new List<Operation>();
            foreach (var method in Methods)
            {
                if (!entries.TryGetValue(method, out var factory)) continue;
                if (Create(factory) is not Operation operation || operation.Method != method)
                    throw new ArgumentException("Method factory must return a matching Operation: " + method);
                foreach (var schema in operation.Handler.Schemas.Values) Concrete(Operation.Export(schema));
                if (operation.Handler.ResponseSchema is { } response) Concrete(Operation.Export(response));
                operations.Add(operation);
            }
            SseFeed? feed = null;
            if (entries.TryGetValue("sse", out var sse))
            {
                var owner = operations.FirstOrDefault(operation => operation.Method == "GET")?.Handler
                    ?? throw new ArgumentException("SSE requires a GET operation");
                if (!sse.GetParameters()[0].ParameterType.IsInstanceOfType(owner)) throw new ArgumentException("SSE factory must accept its owning GET handler type");
                feed = Create(sse, owner, viewId) as SseFeed ?? throw new ArgumentException("SSE factory must return SseFeed");
                Concrete(Operation.Export(feed.InputSchema)); Concrete(Operation.Export(feed.EventSchema));
            }
            routes.Add(new(viewId, paths[0], operations, paths.Skip(1), feed,
                declaration.GetValueOrDefault("title") as string, declaration.GetValueOrDefault("description") as string));
        }
        return new(routes, dependencies);
    }

    private static object? Create(MethodInfo factory, params object?[] args)
    {
        try { return factory.Invoke(null, args); }
        catch (TargetInvocationException error) when (error.InnerException is not null)
        { ExceptionDispatchInfo.Capture(error.InnerException).Throw(); throw; }
    }

    private static (string[] Paths, string ViewId) Paths(string[] parts)
    {
        List<string[]> variants = [[]]; var identifiers = new List<string>();
        foreach (var part in parts)
        {
            var optional = Regex.Match(part, @"\A\[\[([A-Za-z_][A-Za-z0-9_]*)\]\]\z");
            var parameter = optional.Success ? optional : Regex.Match(part, @"\A\[([A-Za-z_][A-Za-z0-9_]*)\]\z");
            var segment = parameter.Success ? ":" + parameter.Groups[1].Value : part;
            if (!parameter.Success && part.Contains(':')) throw new ArgumentException("Filesystem parameters use [id] or [[id]]");
            variants = variants.SelectMany(path => optional.Success ? new[] { path, path.Append(segment).ToArray() } : new[] { path.Append(segment).ToArray() }).ToList();
            identifiers.Add(parameter.Success ? "$" + parameter.Groups[1].Value : part);
        }
        var paths = variants.Select(path => "/" + string.Join('/', path)).ToArray();
        foreach (var path in paths) Route.Segments(path);
        return (paths, string.Join('.', identifiers.Append("index")));
    }

    private static void Concrete(Node document)
    {
        // Visit schema children only; defaults, enum values and metadata are data.
        static void Visit(Node node)
        {
            if (node["kind"] is "any" or "unknown" || node.GetValueOrDefault("unknownKeys") is "allow")
                throw new ArgumentException("Route schemas must be concrete and cannot allow unknown keys");
            IEnumerable<Node> children = node["kind"] switch
            {
                "object" => ((Node)node["properties"]!).Values.Cast<Node>(),
                "optional" or "nullable" => [(Node)(node.GetValueOrDefault("inner") ?? node["schema"])!],
                "array" => [(Node)node["items"]!],
                "record" => [(Node)(node.GetValueOrDefault("valueSchema") ?? node["values"])!],
                "tuple" => ((List<object?>)(node.GetValueOrDefault("items") ?? node["elements"])!).Cast<Node>(),
                "union" => ((List<object?>)node["variants"]!).Cast<Node>(),
                "intersection" => ((List<object?>)node["allOf"]!).Cast<Node>(),
                _ => []
            };
            foreach (var child in children) Visit(child);
        }
        Visit((Node)document["root"]!);
        if (document.GetValueOrDefault("definitions") is Node definitions) foreach (var definition in definitions.Values.Cast<Node>()) Visit(definition);
    }
}
