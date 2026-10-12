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
    private readonly Dictionary<string, HashSet<string>> methods;
    private readonly string? serviceId, appOrigin;
    private readonly string currentPath;
    private readonly HashSet<string> sseViews;
    public Urls(ScopedContext scope, Registry? registry, string? serviceId, string path, IEnumerable<string>? appOrigins = null)
    {
        var enabled = new List<Node>();
        foreach (var item in ((List<object?>)scope.Tenant["services"]!).Cast<Node>().Where(item => scope.Tenant["active"] is true && item["enabled"] is true))
            try
            {
                var service = item.Where(pair => pair.Key is "id" or "serviceId").ToDictionary();
                service["hostname"] = HttpAddress.BaseUrl((string)item["hostname"]!); enabled.Add(service);
            }
            catch (ArgumentException) { }
        services = enabled.ToArray();
        mounts = ((List<object?>)Json.Read(Json.Write(scope.App.GetValueOrDefault("appRoutes", scope.App["routes"])))!).Cast<Node>().ToArray();
        shell = (Node)Json.Read(Json.Write(scope.App.GetValueOrDefault("shell", new Node())))!;
        hosts = ((List<object?>)scope.App["hostnames"]!).Cast<string>().ToArray();
        aliases = registry?.Dependencies ?? new Dictionary<string, string>();
        routes = registry?.Routes.ToDictionary(route => route.ViewId, route => route.Paths) ?? new();
        methods = registry?.Routes.ToDictionary(route => route.ViewId, route => route.Operations.Select(operation => operation.Method).ToHashSet(StringComparer.Ordinal)) ?? new();
        sseViews = registry?.Routes.Where(route => route.HasSse).Select(route => route.ViewId).ToHashSet(StringComparer.Ordinal) ?? new(StringComparer.Ordinal);
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
        var changes = ((Node)options.GetValueOrDefault("query", new Node())!).Where(pair => pair.Key is not "_c" and not "_f").ToDictionary();
        foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var name = Uri.UnescapeDataString(part.Split('=', 2)[0].Replace("+", " "));
            if (name is "_c" or "_f") changes[name] = null;
        }
        if (options.ContainsKey("component") && options.ContainsKey("fragment")) throw new ArgumentException("Ambiguous renderer selector");
        if (options.TryGetValue("component", out var component)) changes["_c"] = component;
        if (options.TryGetValue("fragment", out var fragment)) changes["_f"] = fragment;
        var query = uri.Query.TrimStart('?').Replace("'", "%27");
        if (changes.Count > 0)
        {
            var utf8 = new UTF8Encoding(false, true);
            string Decode(string value) => utf8.GetString(System.Web.HttpUtility.UrlDecodeToBytes(value, utf8));
            var pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries).Select(part => part.Split('=', 2))
                .Select(parts => (Name: Decode(parts[0]), Value: parts.Length == 2 ? Decode(parts[1]) : "")).ToList();
            foreach (var (name, value) in changes)
            {
                if (value is null) { pairs.RemoveAll(pair => pair.Name == name); continue; }
                var index = pairs.FindIndex(pair => pair.Name == name); if (index < 0) index = pairs.Count;
                pairs.RemoveAll(pair => pair.Name == name);
                var values = value is System.Collections.IEnumerable sequence && value is not string && value is not Node
                    ? sequence.Cast<object?>().Where(item => item is not null).Select(item => Scalar(item!)) : [Scalar(value)];
                pairs.InsertRange(index, values.Select(item => (name, item)));
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
    /// <summary>Resolve self, a service path or a view ID into six explicit destinations.</summary>
    /// <remarks>API/view paths use the service endpoint; UI paths use the mounted GET page.
    /// Absolute API/view paths use the service origin; AbsoluteUiPath is the public app URL.
    /// Resolve internal destinations in renderers, rather than returning them as API fields.</remarks>
    public Generated.ResolvedRouteUrl? RouteUrl(Generated.RouteUrlOptionsInput? input = null)
        => Resolve(input, "GET", null, null);

    internal Generated.ResolvedRouteUrl? Resolve(Generated.RouteUrlOptionsInput? input, string currentMethod, object? currentParams, object? currentQuery)
    {
        var opts = Options(input);
        if (opts.ContainsKey("path") && opts.ContainsKey("viewId")) return null;
        if (opts.GetValueOrDefault("path") is string supplied) { try { if (supplied.Contains('#')) return null; Relative(supplied); } catch (ArgumentException) { return null; } }
        var self = !opts.ContainsKey("path") && !opts.ContainsKey("viewId");
        var target = (string?)opts.GetValueOrDefault("serviceId", serviceId);
        var ids = Ids(target); var own = Ids(serviceId);
        if (ids.Count == 0 || self && !ids.SetEquals(own)) return null;
        var method = (string)opts.GetValueOrDefault("method", self ? currentMethod : "GET")!;
        if (opts["sse"] is true && (method != "GET" || !ids.SetEquals(own) || ids.Count != 1)) return null;
        var parameters = self ? AsNode(currentParams) : new Node();
        foreach (var pair in (Node)opts["params"]!) parameters[pair.Key] = pair.Value;
        var query = self ? AsNode(currentQuery) : new Node();
        if (opts.GetValueOrDefault("path") is string embedded && embedded.Contains('?')) {
            var embeddedQuery = new Node();
            foreach (var pair in embedded.Split('?', 2)[1].Split('&', StringSplitOptions.RemoveEmptyEntries)) {
                var parts = pair.Split('=', 2);
                var name = Uri.UnescapeDataString(parts[0].Replace("+", " "));
                var value = parts.Length > 1 ? Uri.UnescapeDataString(parts[1].Replace("+", " ")) : "";
                if (!embeddedQuery.TryGetValue(name, out var prior)) embeddedQuery[name] = value;
                else if (prior is List<object?> values) values.Add(value);
                else embeddedQuery[name] = new List<object?> { prior, value };
            }
            foreach (var pair in embeddedQuery) query[pair.Key] = pair.Value;
        }
        foreach (var pair in (Node)opts["query"]!) query[pair.Key] = pair.Value;
        opts["query"] = query;
        if (opts.ContainsKey("component") && opts.ContainsKey("fragment")) return null;
        var selector = (string?)opts.GetValueOrDefault("path", self ? currentPath : null);
        var viewId = (string?)opts.GetValueOrDefault("viewId");
        string? path = null;
        if (ids.Count == 1 && ids.SetEquals(own))
        {
            target = ids.Single();
            var candidates = routes.SelectMany(pair => pair.Value.Select(template => (View: pair.Key, Template: template)))
                .Where(item => methods[item.View].Contains(method) && (viewId is not null ? item.View == viewId : selector is not null && Parameters(item.Template, selector) is not null))
                .SelectMany(item => {
                    var matched = mounts.Where(mount => mount["enabled"] is true && ids.Contains((string)mount["serviceId"]!) && (string)mount["viewId"]! == item.View
                        && ((List<object?>)mount.GetValueOrDefault("resolvedMethods", new List<object?>())!).Contains(method)
                        && (!opts.TryGetValue("mountId", out var selected) || Equals(selected, mount["id"]))
                        && (ServicePath(mount) is not { } template || Parameters(item.Template, template) is not null)).ToArray();
                    var defaults = matched.Length == 0 ? new[] { new Node() } : matched.Select(mount => (Node)mount.GetValueOrDefault("fixedParams", new Node())!).ToArray();
                    return defaults.Select(fixedValues => (item.View, item.Template, Path: Fill(self || selector is null ? item.Template : selector,
                        Merge(fixedValues, self ? Merge(Parameters(item.Template, currentPath), parameters) : parameters))));
                })
                .Where(item => item.Path is not null).ToArray();
            var exact = candidates.Where(item => selector is not null && item.Template.TrimEnd('/') == selector.Split('?', 2)[0].TrimEnd('/')).ToArray();
            if (exact.Length != 0) candidates = exact;
            var ordered = viewId is not null ? candidates.OrderByDescending(item => Specificity(item.Template)).ToArray() : candidates.OrderBy(item => PathRank(item.Template), StringComparer.Ordinal).ToArray();
            if (ordered.Length == 0) return null;
            if (ordered.Where(item => viewId is not null ? Specificity(item.Template) == Specificity(ordered[0].Template) : PathRank(item.Template) == PathRank(ordered[0].Template)).Select(item => item.Path).Distinct().Count() != 1) return null;
            viewId = ordered[0].View; path = ordered[0].Path;
        }
        else
        {
            var candidates = mounts.Where(item => item["enabled"] is true && ids.Contains((string)item["serviceId"]!)
                && ((List<object?>)item.GetValueOrDefault("resolvedMethods", new List<object?>())!).Contains(method)
                && (!opts.TryGetValue("mountId", out var id) || Equals(id, item["id"]))
                && (viewId is not null ? (string)item["viewId"]! == viewId : selector is not null && ServicePath(item) is string template && Parameters(template, selector) is not null))
                .Select(item => {
                    var values = new Node((Node)item.GetValueOrDefault("fixedParams", new Node())!); foreach (var pair in parameters) values[pair.Key] = pair.Value;
                    return (Mount: item, Path: Fill(selector ?? ServicePath(item)!, values));
                }).Where(item => item.Path is not null).ToArray();
            var exact = candidates.Where(item => selector is not null && ServicePath(item.Mount)?.TrimEnd('/') == selector.Split('?', 2)[0].TrimEnd('/')).ToArray();
            if (exact.Length != 0) candidates = exact;
            if (selector is not null && candidates.Length != 0) {
                var bestRank = candidates.Select(item => PathRank(ServicePath(item.Mount)!)).Order(StringComparer.Ordinal).First();
                candidates = candidates.Where(item => PathRank(ServicePath(item.Mount)!) == bestRank).ToArray();
            }
            candidates = candidates.GroupBy(item => ((string)item.Mount["serviceId"]!, item.Path)).Select(group => group.First()).ToArray();
            if (candidates.Length != 1) return null;
            var selected = candidates[0]; target = (string)selected.Mount["serviceId"]!; viewId = (string)selected.Mount["viewId"]!; path = selected.Path;
        }
        if (path is null || opts["sse"] is true && !sseViews.Contains(viewId!)) return null;
        var pagePaths = new HashSet<string>(StringComparer.Ordinal);
        if (method == "GET" && opts["sse"] is not true && !opts.ContainsKey("component") && !opts.ContainsKey("fragment"))
        {
            foreach (var mount in mounts.Where(item => item["enabled"] is true && (string)item["kind"]! == "page" && (string)item["viewId"]! == viewId && (string)item["serviceId"]! == target
                && ((List<object?>)item.GetValueOrDefault("resolvedMethods", new List<object?>())!).Contains("GET")
                && (!opts.TryGetValue("mountId", out var id) || Equals(id, item["id"]))))
            {
                var template = ServicePath(mount) ?? (ids.SetEquals(own) ? routes.GetValueOrDefault(viewId!, []).FirstOrDefault(candidate => Parameters(candidate, path) is not null) : null);
                if (template is null) continue;
                var values = new Node((Node)mount.GetValueOrDefault("fixedParams", new Node())!);
                foreach (var pair in parameters) values[pair.Key] = pair.Value;
                foreach (var pair in Parameters(template, path) ?? new Node()) values[pair.Key] = pair.Value;
                var uiNames = ((string)mount["path"]!).Split('/').Where(part => part.StartsWith(':')).Select(part => part[1..]).ToHashSet(StringComparer.Ordinal);
                if (((Node)mount.GetValueOrDefault("fixedParams", new Node())!).Any(pair => !uiNames.Contains(pair.Key) && !Equals(values.GetValueOrDefault(pair.Key), pair.Value))) continue;
                var ui = Fill((string)mount["path"]!, values);
                if (ui is not null && Fill(template, values) is { } service && Parameters(service, path) is not null) pagePaths.Add(Render(ui, new() { ["query"] = query }));
            }
        }
        try
        {
            var api = Render(path, new() { ["query"] = query, ["sse"] = opts["sse"] }); var view = Render(path, opts);
            var ui = pagePaths.Count == 1 ? pagePaths.First() : null; var origin = ServiceOrigin(target!);
            var app = appOrigin;
            if (app is null) foreach (var host in hosts)
            {
                try { app = Origin(host); break; }
                catch (ArgumentException) { }
            }
            return Contracts.Parse<Generated.ResolvedRouteUrl>("ResolvedRouteUrlSchema", new { apiPath = api, viewPath = view, uiPath = ui,
                absoluteApiPath = origin is null ? null : origin + api, absoluteViewPath = origin is null ? null : origin + view,
                absoluteUiPath = ui is null || app is null ? null : app + ui });
        }
        catch (ArgumentException) { return null; }
    }
    private static Node Merge(Node? inherited, Node overrides) { var result = inherited is null ? new Node() : new Node(inherited); foreach (var pair in overrides) result[pair.Key] = pair.Value; return result; }
    private static string PathRank(string template) => string.Concat(template.Split('/').Select(part => part.StartsWith(':') ? "1" : "0"));
    private static int Specificity(string template) => template.Split('/').Count(part => part.StartsWith(':'));
    private static Node AsNode(object? value) => value is null ? new() : Json.Read(Json.Write(value)) as Node ?? new();
    private static Node? Parameters(string template, string path)
    {
        var left = template.Split('?', 2)[0].TrimEnd('/').Split('/'); var right = path.Split('?', 2)[0].TrimEnd('/').Split('/');
        if (left.Length != right.Length) return null;
        var values = new Node();
        for (var index = 0; index < left.Length; index++)
            if (left[index].StartsWith(':')) values[left[index][1..]] = Uri.UnescapeDataString(right[index]);
            else if (Uri.UnescapeDataString(left[index]) != Uri.UnescapeDataString(right[index])) return null;
        return values;
    }
    public Generated.ResolvedBPElementReference Element(Generated.BPElementReferenceInput reference)
    {
        var value = (Node)Contracts.Parse("BPElementReferenceSchema", reference)!; var args = (Node)value["args"]!;
        Generated.ResolvedBPElementReference Unavailable(string reason) => Contracts.Parse<Generated.ResolvedBPElementReference>("ResolvedBPElementReferenceSchema", new { unavailable = reason });
        var fragment = (string)value["fragment"]!;
        if (fragment.Trim().Length == 0) return Unavailable("fragment_required");
        string? target, origin, path; var opts = new Node { ["query"] = args["query"] };
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
            var matches = mounts.Where(item => item["enabled"] is true && ids.Contains((string)item["serviceId"]!) && ServicePath(item) is string candidate && global::BetterPortal.Route.PathMatches(candidate, template)).ToArray();
            if (matches.Length != 1) return Unavailable(matches.Length > 0 ? "ambiguous_provider" : "service_unavailable");
            var mount = matches[0]; target = (string)mount["serviceId"]!; origin = ServiceOrigin(target);
            if (origin is null) return Unavailable("service_unavailable");
            var parameters = new Node((Node)mount.GetValueOrDefault("fixedParams", new Node())!); foreach (var pair in (Node)args["params"]!) parameters[pair.Key] = pair.Value;
            path = Fill(ServicePath(mount)!, parameters);
            if (path is null) return Unavailable("path_params_required");
            opts["fragment"] = fragment;
        }
        try { return Contracts.Parse<Generated.ResolvedBPElementReference>("ResolvedBPElementReferenceSchema", new { url = origin + Render(path, opts), serviceId = target }); }
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
}
