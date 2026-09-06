using System.Collections.Frozen;
using System.Text.RegularExpressions;

namespace BetterPortal;

public static class HttpAddress
{
    public static string Origin(string value, bool allowPath = false)
    {
        if (value.Length > 8192 || value.Any(c => char.IsWhiteSpace(c) || c < 32 || c == 127) || value.Contains('\\'))
            throw new ArgumentException("Invalid HTTP address");
        var address = Regex.Match(value, @"\A[^:]+://([^/?#]*)");
        var authority = address.Groups[1].Value;
        if (authority.Length == 0 || authority.Contains('@') || authority.Contains('%')
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || uri.Host.Length == 0 || uri.Port == 0)
            throw new ArgumentException("Invalid HTTP authority");
        if (!allowPath && value[address.Length..] is not ("" or "/"))
            throw new ArgumentException("Expected an origin without path, query or fragment");
        var host = uri.IdnHost.ToLowerInvariant();
        if (host.Contains(':')) host = "[" + System.Net.IPAddress.Parse(host.Trim('[', ']')).ToString() + "]";
        return uri.Scheme + "://" + host + (uri.IsDefaultPort ? "" : ":" + uri.Port);
    }
    internal static IEnumerable<string> Origins(string hostname) => hostname.Contains("://", StringComparison.Ordinal)
        ? [Origin(hostname)] : [Origin("https://" + hostname), Origin("http://" + hostname)];
    internal static string Referer(string value)
    {
        var origin = Origin(value, allowPath: true);
        if (value.Contains('#')) throw new ArgumentException("Referer must not contain a fragment");
        var path = new Uri(value).PathAndQuery;
        return origin + (path == "/" ? "" : path);
    }
}

public sealed record OriginPolicy(FrozenSet<string> Origins, FrozenSet<string> Referers)
{
    public static OriginPolicy FromApp(Dictionary<string, object?> app)
    {
        var origins = ((List<object?>)app["hostnames"]!).Cast<string>().SelectMany(HttpAddress.Origins)
            .Concat(((List<object?>)app["originOverrides"]!).Cast<string>().Select(value => HttpAddress.Origin(value))).ToFrozenSet(StringComparer.Ordinal);
        return new(origins, origins.Concat(((List<object?>)app["refererOverrides"]!).Cast<string>().Select(HttpAddress.Referer)).ToFrozenSet(StringComparer.Ordinal));
    }
    public bool Allows(string? value, bool referer = false)
    {
        if (value is null) return false;
        try
        {
            return referer ? Referers.Contains(HttpAddress.Referer(value)) || Referers.Contains(HttpAddress.Origin(value, allowPath: true))
                : Origins.Contains(HttpAddress.Origin(value));
        }
        catch (ArgumentException) { return false; }
        catch (UriFormatException) { return false; }
    }
}

public sealed record ScopedContext(Dictionary<string, object?> Tenant, Dictionary<string, object?> App, OriginPolicy OriginPolicy)
{
    public string TenantId => (string)Tenant["id"]!;
    public string AppId => (string)App["id"]!;
}

/// <summary>One validated scoped snapshot. Request contexts receive owned copies.</summary>
public sealed class ScopedConfig
{
    private readonly Dictionary<string, object?> snapshot;
    private readonly Dictionary<string, Dictionary<string, object?>> tenants;
    private readonly Dictionary<string, Dictionary<string, object?>> apps;
    private readonly Dictionary<string, string> hosts = new(StringComparer.Ordinal);
    private readonly Dictionary<string, OriginPolicy> policies = new(StringComparer.Ordinal);
    public ScopedConfig(object value)
    {
        snapshot = (Dictionary<string, object?>)Contracts.Parse("ScopedServiceConfigSchema", value)!;
        tenants = Index((List<object?>)snapshot["tenants"]!);
        apps = Index((List<object?>)snapshot["apps"]!);
        foreach (var tenant in tenants.Values) Index((List<object?>)tenant["services"]!);
        foreach (var (id, app) in apps)
        {
            if (!tenants.ContainsKey((string)app["tenantId"]!)) throw new ArgumentException("App refers to an unknown tenant");
            policies[id] = OriginPolicy.FromApp(app);
            foreach (var origin in ((List<object?>)app["hostnames"]!).Cast<string>().SelectMany(HttpAddress.Origins))
            {
                if (hosts.TryGetValue(origin, out var existing) && existing != id) throw new ArgumentException("App host is ambiguous");
                hosts[origin] = id;
            }
        }
        foreach (var app in Index((List<object?>?)snapshot.GetValueOrDefault("configApps") ?? []).Values)
            if (!tenants.ContainsKey((string)app["tenantId"]!)) throw new ArgumentException("Config app refers to an unknown tenant");
        foreach (var origin in ((List<object?>)snapshot["managementOrigins"]!).Cast<string>()) HttpAddress.Origin(origin);
    }
    private static Dictionary<string, Dictionary<string, object?>> Index(IEnumerable<object?> values)
    {
        var result = new Dictionary<string, Dictionary<string, object?>>(StringComparer.Ordinal);
        foreach (var value in values.Cast<Dictionary<string, object?>>())
            if (!result.TryAdd((string)value["id"]!, value)) throw new ArgumentException("Duplicate scoped identity");
        return result;
    }
    private static Dictionary<string, object?> Copy(Dictionary<string, object?> value) => (Dictionary<string, object?>)Json.Read(Json.Write(value))!;
    public Dictionary<string, object?> Document() => Copy(snapshot);
    public ScopedContext? ById(string tenantId, string appId)
    {
        if (!apps.TryGetValue(appId, out var app) || !tenants.TryGetValue(tenantId, out var tenant) || tenant["active"] is not true
            || !Equals(app["tenantId"], tenantId)) return null;
        return new(Copy(tenant), Copy(app), policies[appId]);
    }
    /// <summary>Only host-verified proxy addresses are accepted; raw proxy/HTMX/scope headers confer no authority.</summary>
    public ScopedContext? Resolve(IReadOnlyDictionary<string, string> headers, string scheme = "https", string mode = "service", IEnumerable<string>? trustedAddresses = null)
    {
        if (scheme is not ("http" or "https") || mode is not ("service" or "theme")) throw new ArgumentException("Invalid request addressing mode");
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in headers) if (!normalized.TryAdd(key, value)) throw new ArgumentException("Duplicate request headers");
        var direct = new[] { "host", ":authority", "authority" }.Where(normalized.ContainsKey).Select(key => (Url: scheme + "://" + normalized[key], AllowPath: false));
        var embedded = new[] { "origin", "referer" }.Where(normalized.ContainsKey).Select(key => (Url: normalized[key], AllowPath: key == "referer"));
        var trusted = (trustedAddresses ?? []).Select(value => (Url: value, AllowPath: false));
        var candidates = mode == "theme" ? direct.Concat(trusted).Concat(embedded) : embedded.Concat(direct).Concat(trusted);
        if (normalized.TryGetValue("alt-used", out var alternative)) candidates = candidates.Append((scheme + "://" + alternative, false));
        foreach (var candidate in candidates)
        {
            string origin;
            try { origin = HttpAddress.Origin(candidate.Url, candidate.AllowPath); }
            catch (ArgumentException) { continue; }
            catch (UriFormatException) { continue; }
            if (hosts.TryGetValue(origin, out var id) && ById((string)apps[id]["tenantId"]!, id) is { } context) return context;
        }
        return null;
    }
}
