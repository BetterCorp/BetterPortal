using System.Collections.Frozen;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>Inbound mounts and permission aliases restricted to local service instances.</summary>
public sealed class AppAccess
{
    private readonly Node app;
    private readonly Dictionary<string, Node> services;
    private static IEnumerable<Node> Items(Node node, string key) => ((List<object?>)node[key]!).Cast<Node>();
    private IEnumerable<Node> Fragments => ((Node)app["fragments"]!).Values.SelectMany(value => ((List<object?>)value!).Cast<Node>());
    public AppAccess(ScopedContext scope, IEnumerable<string> localServiceIds)
    {
        app = scope.App;
        var local = localServiceIds.ToHashSet(StringComparer.Ordinal);
        services = Items(scope.Tenant, "services").Where(service => scope.Tenant["active"] is true && service["enabled"] is true && local.Contains((string)service["id"]!))
            .ToDictionary(service => (string)service["id"]!, StringComparer.Ordinal);
    }
    public IReadOnlyDictionary<string, string> PermissionAliases(Route? route = null, string method = "GET", string? path = null, string? fragment = null)
    {
        var references = Items(app, "routes").Concat(Items(app, "slots")).Concat(Fragments)
            .Concat(new[] { "shell", "auth" }.Where(app.ContainsKey).Select(key => (Node)app[key]!));
        var mounted = references.Where(item => item.GetValueOrDefault("enabled", true) is true).Select(item => (string)item["serviceId"]!).ToHashSet(StringComparer.Ordinal);
        return services.Where(pair => mounted.Contains(pair.Key) && pair.Value.ContainsKey("serviceId") && (route is null || Allows(route, method, path, fragment, pair.Key)))
            .ToFrozenDictionary(pair => pair.Key, pair => (string)pair.Value["serviceId"]!, StringComparer.Ordinal);
    }
    private static bool PathMatches(string mounted, string registered)
    {
        try
        {
            var trimmed = mounted.TrimEnd('/');
            var left = Route.Segments(trimmed.Length == 0 ? "/" : trimmed); var right = Route.Segments(registered);
            return left.Length == right.Length && left.Zip(right).All(pair => pair.First == pair.Second || pair.First.StartsWith(':') || pair.Second.StartsWith(':'));
        }
        catch (ArgumentException) { return false; }
    }
    public bool Allows(Route route, string method, string? path = null, string? fragment = null, string? serviceId = null)
    {
        path ??= route.Paths[0];
        if (!route.Paths.Contains(path)) throw new ArgumentException("The matched path is not registered on this view");
        var operation = route.Operations.FirstOrDefault(item => item.Method == method);
        if (operation is null) return false;
        // Discovery/control-plane routes still require their separately declared auth policy.
        if (path.StartsWith("/.well-known/", StringComparison.Ordinal)) return true;
        var legacy = $"legacy:{route.ViewId}:{method}";
        bool Local(string identifier) => services.ContainsKey(identifier) && (serviceId is null || identifier == serviceId);
        foreach (var mount in Items(app, "routes"))
        {
            var target = (string?)mount.GetValueOrDefault("resolvedServicePath", mount.GetValueOrDefault("servicePathVariant", mount.GetValueOrDefault("targetPath")));
            var operations = (List<object?>)mount["operations"]!;
            if (mount["enabled"] is true && Local((string)mount["serviceId"]!) && Equals(mount["viewId"], route.ViewId)
                && (operations.Contains(operation.Id) || operations.Contains(legacy)) && (target is null || PathMatches(target, path))) return true;
        }
        if (method == "GET")
        {
            if (!string.IsNullOrEmpty(fragment))
            {
                var dot = fragment.IndexOf('.'); var location = dot > 0 ? fragment[..dot] : ""; var identifier = dot > 0 ? fragment[(dot + 1)..] : fragment;
                var candidates = location.Length > 0 ? ((List<object?>)((Node)app["fragments"]!).GetValueOrDefault(location, new List<object?>())!).Cast<Node>() : Fragments;
                if (candidates.Any(item => Equals(item["fragmentId"], identifier) && FragmentAllowed(item, path, serviceId))) return true;
            }
            if (Items(app, "slots").Any(item => item["enabled"] is true && Local((string)item["serviceId"]!) && Equals(item["viewId"], route.ViewId))) return true;
        }
        return false;
    }
    private bool FragmentAllowed(Node item, string path, string? serviceId = null) => item["enabled"] is true && services.ContainsKey((string)item["serviceId"]!)
        && (serviceId is null || Equals(item["serviceId"], serviceId)) && PathMatches((string)item["targetPath"]!, path);
    public bool AllowsPreflight(Route route, string method, string? path = null, string? fragment = null)
    {
        if (Allows(route, method, path, fragment)) return true;
        // OPTIONS does not carry the subsequent request's Accept fragment parameter.
        return method == "GET" && fragment is null && route.Operations.Any(item => item.Method == method)
            && Fragments.Any(item => FragmentAllowed(item, path ?? route.Paths[0]));
    }
}
