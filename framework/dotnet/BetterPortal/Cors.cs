using System.Text.RegularExpressions;

namespace BetterPortal;

public sealed class CorsDeniedException(string message) : Exception(message)
{
    public int Status => 403;
}

/// <summary>Hosts run preflight before authentication/dispatch and return an empty 204 on success.</summary>
public sealed class Cors
{
    private const string Allow = "Accept, Authorization, Content-Type, HX-Current-URL, HX-Request, HX-Target, HX-Trigger, HX-Trigger-Name, X-BP-Tenant-Id, X-BP-App-Id, X-BP-Service-Id, X-BP-Service-Authorization, BP-SetHeader, BP-RemoveHeader, traceparent, tracestate, baggage";
    private const string Expose = "HX-Trigger, HX-Trigger-After-Swap, HX-Trigger-After-Settle, HX-Location, HX-Push-Url, HX-Redirect, HX-Refresh, HX-Replace-Url, HX-Reswap, HX-Retarget, BP-SetHeader, BP-RemoveHeader";
    private readonly OriginPolicy policy;
    private readonly string[] methods;
    public Cors(OriginPolicy policy, IEnumerable<string> methods)
    {
        this.policy = policy;
        this.methods = methods.Select(method => (string)Contracts.Parse("HttpMethodSchema", method)!).Append("OPTIONS").Distinct(StringComparer.Ordinal).ToArray();
    }
    public Dictionary<string, string> Headers(string? origin)
    {
        var result = new Dictionary<string, string> { ["vary"] = "Origin" };
        if (origin is not null)
        {
            if (!policy.Allows(origin)) throw new CorsDeniedException("Origin is not allowed");
            result["access-control-allow-origin"] = HttpAddress.Origin(origin);
            result["access-control-expose-headers"] = Expose;
        }
        return result;
    }
    public Dictionary<string, string> Preflight(string? origin, string? method, string? requestedHeaders = null)
    {
        if (origin is null || method is null || !methods.Contains(method, StringComparer.Ordinal)) throw new CorsDeniedException("Preflight origin or method is not allowed");
        var result = Headers(origin);
        var allowed = Allow;
        if (requestedHeaders is not null && (requestedHeaders.Length > 8192 || requestedHeaders.Any(c => c < 32 && c != '\t' || c > 126)))
            throw new CorsDeniedException("Invalid preflight headers");
        if (requestedHeaders is not null && requestedHeaders.Trim(' ', '\t').Length > 0)
        {
            var names = requestedHeaders.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (names.Length == 0 || names.Any(name => !Regex.IsMatch(name, @"\A[!#$%&'*+.^_`|~A-Za-z0-9-]+\z"))) throw new CorsDeniedException("Invalid preflight header name");
            allowed = string.Join(", ", names.Select(name => name.ToLowerInvariant()).Distinct(StringComparer.Ordinal));
        }
        result["access-control-allow-methods"] = string.Join(", ", methods);
        result["access-control-allow-headers"] = allowed;
        result["access-control-max-age"] = "600";
        result["vary"] = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers";
        return result;
    }
}
