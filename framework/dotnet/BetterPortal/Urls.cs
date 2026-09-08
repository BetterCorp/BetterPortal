using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>Scoped service requests and mounted page links. No credentials are retained.</summary>
public sealed class Urls
{
    private readonly Node[] services, mounts;
    private readonly Node shell;
    private readonly string[] hosts;
    private readonly IReadOnlyDictionary<string, string> aliases;
    private readonly Dictionary<string, IReadOnlyList<string>> routes;
    private readonly string? serviceId, appOrigin;
    private readonly string currentPath;
    public Urls(ScopedContext scope, Registry? registry, string? serviceId, string path, IEnumerable<string>? appOrigins = null)
    {
        var enabled = new List<Node>();
        foreach (var item in ((List<object?>)scope.Tenant["services"]!).Cast<Node>().Where(item => scope.Tenant["active"] is true && item["enabled"] is true))
            try
            {
                var service = item.Where(pair => pair.Key is "id" or "serviceId").ToDictionary();
                service["hostname"] = HttpAddress.Origin((string)item["hostname"]!, allowPath: true); enabled.Add(service);
            }
            catch (ArgumentException) { }
        services = enabled.ToArray();
        mounts = ((List<object?>)Json.Read(Json.Write(scope.App.GetValueOrDefault("appRoutes", scope.App["routes"])))!).Cast<Node>().ToArray();
        shell = (Node)Json.Read(Json.Write(scope.App.GetValueOrDefault("shell", new Node())))!;
        hosts = ((List<object?>)scope.App["hostnames"]!).Cast<string>().ToArray();
        aliases = registry?.Dependencies ?? new Dictionary<string, string>();
        routes = registry?.Routes.ToDictionary(route => route.ViewId, route => route.Paths) ?? new();
        this.serviceId = serviceId; currentPath = path;
        var allowed = hosts.SelectMany(HttpAddress.Origins).ToHashSet(StringComparer.Ordinal);
        foreach (var candidate in appOrigins ?? [])
            try { var origin = HttpAddress.Origin(candidate, allowPath: true); if (allowed.Contains(origin)) { appOrigin = origin; break; } }
            catch (ArgumentException) { }
    }
    internal static string Scalar(object value)
    {
        if (value is string text) return text;
        if (value is bool flag) return flag ? "true" : "false";
        if (value is sbyte or byte or short or ushort or int or uint or long or ulong)
            return Convert.ToString(value, CultureInfo.InvariantCulture)!;
        var number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
        if (number == 0) return "0";
        var result = number.ToString("R", CultureInfo.InvariantCulture).ToLowerInvariant();
        if (Math.Abs(number) >= 1e-6 && Math.Abs(number) < 1e21)
            return decimal.Parse(result, NumberStyles.Float, CultureInfo.InvariantCulture).ToString("0.############################", CultureInfo.InvariantCulture);
        var parts = result.Split('e'); var exponent = int.Parse(parts[1], CultureInfo.InvariantCulture);
        return parts[0] + "e" + (exponent >= 0 ? "+" : "-") + Math.Abs(exponent);
    }
    internal static string Component(string value) => Uri.EscapeDataString(value).Replace("%21", "!").Replace("%27", "'").Replace("%28", "(").Replace("%29", ")").Replace("%2A", "*");
    private static string Origin(string value) => HttpAddress.Origin(value.Contains("://", StringComparison.Ordinal) ? value : "https://" + value);
    private static Uri Relative(string value)
    {
        if (!value.StartsWith('/') || value.StartsWith("//", StringComparison.Ordinal) || value.Contains('\\') || value.Any(c => c < 32 || c == 127))
            throw new ArgumentException("Expected a root-relative URL");
        if (Regex.IsMatch(value, "%(?![0-9A-Fa-f]{2})")) throw new ArgumentException("Invalid URL escape");
        if (value.Split('?', '#')[0].Split('/').Any(part => Uri.UnescapeDataString(part) is "." or "..")) throw new ArgumentException("URL must not traverse path segments");
        return new Uri("http://betterportal.invalid" + value);
    }
    internal static string? Fill(string path, Node parameters)
    {
        var parts = path.Split('?', 2); var segments = parts[0].Split('/');
        for (var i = 0; i < segments.Length; i++)
            if (segments[i].StartsWith(':'))
            {
                var value = parameters.GetValueOrDefault(segments[i][1..]);
                if (value is null) return null;
                segments[i] = Component(Scalar(value));
            }
        var result = string.Join('/', segments) + (parts.Length == 2 ? "?" + parts[1] : "");
        try { _ = Relative(result); return result; }
        catch (ArgumentException) { return null; }
    }
    private static string FormEncode(string value) => Uri.EscapeDataString(value).Replace("%20", "+").Replace("%2A", "*").Replace("~", "%7E");
    private static string Render(string path, Node options)
    {
        var uri = Relative(path); var encoded = uri.AbsolutePath;
        if (options.GetValueOrDefault("sse") is true) encoded = encoded.TrimEnd('/') + "/__sse";
        var changes = new Node((Node)options.GetValueOrDefault("query", new Node())!);
        if (options.ContainsKey("component") && options.ContainsKey("fragment")) throw new ArgumentException("Ambiguous renderer selector");
        if (options.TryGetValue("component", out var component)) changes["_c"] = component;
        if (options.TryGetValue("fragment", out var fragment)) changes["_f"] = fragment;
        var query = uri.Query.TrimStart('?').Replace("'", "%27");
        if (changes.Any(pair => pair.Value is not null))
        {
            var utf8 = new UTF8Encoding(false, true);
            string Decode(string value) => utf8.GetString(System.Web.HttpUtility.UrlDecodeToBytes(value, utf8));
            var pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries).Select(part => part.Split('=', 2))
                .Select(parts => (Name: Decode(parts[0]), Value: parts.Length == 2 ? Decode(parts[1]) : "")).ToList();
            foreach (var (name, value) in changes)
            {
                if (value is null) continue;
                var index = pairs.FindIndex(pair => pair.Name == name); if (index < 0) index = pairs.Count;
                pairs.RemoveAll(pair => pair.Name == name); pairs.Insert(index, (name, Scalar(value)));
            }
            query = string.Join('&', pairs.Select(pair => FormEncode(pair.Name) + "=" + FormEncode(pair.Value)));
        }
        var result = encoded + (query.Length > 0 ? "?" + query : "") + uri.Fragment;
        return options.GetValueOrDefault("absolute") is true && options.GetValueOrDefault("origin") is string origin ? Origin(origin) + result : result;
    }
    private HashSet<string> Ids(string? reference)
    {
        if (reference is null) return new(StringComparer.Ordinal);
        reference = aliases.GetValueOrDefault(reference, reference);
        return services.Where(item => (string)item["id"]! == reference || (string?)item.GetValueOrDefault("serviceId") == reference)
            .Select(item => (string)item["id"]!).ToHashSet(StringComparer.Ordinal);
    }
    private string? ServiceOrigin(string reference, string? replacement = null)
    {
        var ids = Ids(reference); if (ids.Count == 0) return null;
        try
        {
            var origins = services.Where(item => ids.Contains((string)item["id"]!)).Select(item => (string)item["hostname"]!).Distinct().ToArray();
            return replacement is not null ? Origin(replacement) : origins.Length == 1 ? origins[0] : null;
        }
        catch (ArgumentException) { return null; }
    }
    private static string? ServicePath(Node mount) => (string?)mount.GetValueOrDefault("resolvedServicePath", mount.GetValueOrDefault("servicePathVariant", mount.GetValueOrDefault("targetPath")));
    private static Node Options(object? value, string schema = "RouteUrlOptionsSchema") => (Node)Contracts.Parse(schema, value ?? new Node())!;
    public string Current(Generated.RouteUrlOptionsInput? options = null) => Path(currentPath, options);
    public static string Path(string path, Generated.RouteUrlOptionsInput? options = null) => Render(path, Options(options));
    public string? Route(string viewId, Generated.RouteUrlOptionsInput? options = null)
    {
        var opts = Options(options); var target = (string?)opts.GetValueOrDefault("serviceId", serviceId); var ids = Ids(target);
        if (ids.Count == 0) return null;
        string? path;
        if (ids.Count == 1 && ids.SetEquals(Ids(serviceId))) path = routes.GetValueOrDefault(viewId, []).Select(candidate => Fill(candidate, (Node)opts["params"]!)).FirstOrDefault(value => value is not null);
        else
        {
            var targets = mounts.Where(item => item["enabled"] is true && ids.Contains((string)item["serviceId"]!) && (string)item["viewId"]! == viewId && ServicePath(item) is not null)
                .GroupBy(item => ((string)item["serviceId"]!, ServicePath(item)!)).Select(group => group.Last()).ToArray();
            if (targets.Length != 1) return null;
            var mount = targets[0]; target = (string)mount["serviceId"]!;
            var parameters = new Node((Node)mount["fixedParams"]!); foreach (var pair in (Node)opts["params"]!) parameters[pair.Key] = pair.Value;
            path = Fill(ServicePath(mount)!, parameters);
        }
        if (path is null) return null;
        if (opts["absolute"] is true)
        {
            opts["origin"] = ServiceOrigin(target!, (string?)opts.GetValueOrDefault("origin"));
            if (opts["origin"] is null) return null;
        }
        return Render(path, opts);
    }
    public string? UiRoute(string viewId, Generated.RouteUrlOptionsInput? options = null)
    {
        var opts = Options(options); var ids = Ids((string?)opts.GetValueOrDefault("serviceId", serviceId));
        var paths = mounts.Where(item => item["enabled"] is true && (string)item["kind"]! == "page" && (string)item["viewId"]! == viewId
            && ids.Contains((string)item["serviceId"]!) && ((List<object?>)item.GetValueOrDefault("resolvedMethods", new List<object?>())!).Contains("GET"))
            .Select(item => Fill((string)item["path"]!, (Node)opts["params"]!)).Where(value => value is not null).Distinct().ToArray();
        if (paths.Length != 1) return null;
        if (opts["absolute"] is true)
        {
            var origin = (string?)opts.GetValueOrDefault("origin") ?? appOrigin ?? hosts.FirstOrDefault();
            if (origin is null) return null;
            try { opts["origin"] = Origin(origin); } catch (ArgumentException) { return null; }
        }
        return Render(paths[0]!, opts.Where(pair => pair.Key is "query" or "absolute" or "origin").ToDictionary());
    }
    public Generated.ResolvedBPElementReference Element(Generated.BPElementReferenceInput reference)
    {
        var value = (Node)Contracts.Parse("BPElementReferenceSchema", reference)!; var args = (Node)value["args"]!;
        Generated.ResolvedBPElementReference Unavailable(string reason) => Contracts.Parse<Generated.ResolvedBPElementReference>("ResolvedBPElementReferenceSchema", new { unavailable = reason });
        var fragment = (string)value["fragment"]!;
        if (fragment.Trim().Length == 0) return Unavailable("fragment_required");
        string? target, origin, path; var opts = new Node { ["query"] = args["query"], ["absolute"] = true };
        if ((string)value["service"]! == "shell")
        {
            target = (string?)shell.GetValueOrDefault("serviceId"); origin = target is null ? null : ServiceOrigin(target);
            if (origin is null) return Unavailable("shell_unavailable");
            path = "/.well-known/bp/shell/fragment/" + Component(fragment);
        }
        else
        {
            if (value.GetValueOrDefault("path") is not string template || !template.StartsWith('/')) return Unavailable("service_path_required");
            var ids = Ids((string)value["service"]!);
            var matches = mounts.Where(item => item["enabled"] is true && ids.Contains((string)item["serviceId"]!) && ServicePath(item) is string candidate && AppAccess.PathMatches(candidate, template)).ToArray();
            if (matches.Length != 1) return Unavailable(matches.Length > 0 ? "ambiguous_provider" : "service_unavailable");
            var mount = matches[0]; target = (string)mount["serviceId"]!; origin = ServiceOrigin(target);
            if (origin is null) return Unavailable("service_unavailable");
            var parameters = new Node((Node)mount["fixedParams"]!); foreach (var pair in (Node)args["params"]!) parameters[pair.Key] = pair.Value;
            path = Fill(ServicePath(mount)!, parameters);
            if (path is null) return Unavailable("path_params_required");
            opts["fragment"] = fragment;
        }
        opts["origin"] = origin;
        try { return Contracts.Parse<Generated.ResolvedBPElementReference>("ResolvedBPElementReferenceSchema", new { url = Render(path, opts), serviceId = target }); }
        catch (ArgumentException) { return Unavailable("service_path_required"); }
    }
    private static IReadOnlyDictionary<string, string> Attributes(string url, Node opts, bool form)
    {
        if (url.StartsWith('/')) _ = Relative(url); else _ = HttpAddress.Origin(url, allowPath: true);
        var method = (string)opts["method"]!;
        var attributes = form ? new Dictionary<string, string> { ["action"] = url, ["method"] = method } : new() { ["href"] = url };
        attributes["hx-" + method.ToLowerInvariant()] = url;
        foreach (var (source, target) in new[] { ("target", "hx-target"), ("swap", "hx-swap"), ("push", "hx-push-url") })
            if (opts.TryGetValue(source, out var value)) attributes[target] = Scalar(value!);
        return attributes;
    }
    public static IReadOnlyDictionary<string, string> Link(string url, Generated.RouteUiOptionsInput? options = null) => Attributes(url, Options(options, "RouteUiOptionsSchema"), false);
    public static IReadOnlyDictionary<string, string> Form(string url, Generated.RouteUiOptionsInput? options = null) => Attributes(url, Options(options, "RouteUiOptionsSchema"), true);
    public IReadOnlyDictionary<string, string> CurrentUi(Generated.RouteUiOptionsInput? options = null)
    {
        var opts = Options(options, "RouteUiOptionsSchema"); return Attributes(Render(currentPath, opts), opts, false);
    }
    public string Rewrite(string html) => Regex.Replace(html, "(?<![\\w:-])(href|action|hx-get|hx-post|hx-put|hx-patch|hx-delete|hx-download)=([\"'])\\{([A-Za-z0-9_$.-]+)\\}\\2", match =>
        Route(match.Groups[3].Value) is { } value ? match.Groups[1].Value + "=" + match.Groups[2].Value + System.Net.WebUtility.HtmlEncode(value) + match.Groups[2].Value : match.Value);
}
