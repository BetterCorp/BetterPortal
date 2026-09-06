using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>Trusted resolved scope and policy from one snapshot revision.</summary>
public sealed record AuthContext(string TenantId, string AppId,
    Node? AppAuth = null, Func<string, CancellationToken, Task<string>>? KeyResolver = null,
    Node? ServicePolicy = null, IReadOnlyDictionary<string, string>? ServiceAliases = null,
    (string TenantId, string AppId)? ManagementScope = null);

public sealed record AuthorizedCaller(string? Mode = null, Node? User = null, Node? Service = null);

public static class RequestAuthorization
{
    public static async Task<Node> AuthorizeUserAsync(string token, Node requirement, AuthContext context,
        CancellationToken cancellationToken = default)
    {
        if (context.AppAuth is null || context.KeyResolver is null) throw new TokenException("User authentication context unavailable", 503);
        var policy = (Node)Contracts.Parse("AppAuthConfigSchema", context.AppAuth)!;
        var required = (Node)Contracts.Parse("ApiAuthRequirementSchema", requirement)!;
        var aliases = new Dictionary<string, string>(context.ServiceAliases ?? new Dictionary<string, string>());
        var roles = ((IEnumerable<object?>)policy["roles"]!).Cast<Node>().ToArray();
        if (roles.Select(role => (string)role["id"]!).Distinct(StringComparer.Ordinal).Count() != roles.Length)
            throw new TokenException("Ambiguous role configuration", 503);
        var claims = await Tokens.VerifyAsync(token, context.KeyResolver, (string)policy["expectedIssuer"]!,
            (string)policy["expectedAudience"]!, TokenPurpose.Access, cancellationToken: cancellationToken);
        if (!Equals(claims["tenantId"], context.TenantId) || !Equals(claims["appId"], context.AppId)) throw new TokenException("User token tenant or app mismatch");
        var ids = ((IEnumerable<object?>)claims["roles"]!).Cast<string>().ToHashSet(StringComparer.Ordinal);
        if (ids.Contains("*") && context.ManagementScope == (context.TenantId, context.AppId)) return claims;
        var grants = roles.Where(role => ids.Contains((string)role["id"]!)).SelectMany(role => ((IEnumerable<object?>)role["permissions"]!).Cast<Node>()).ToArray();
        bool Matches(string granted, string requested) => granted == requested || aliases.GetValueOrDefault(granted) == requested || aliases.GetValueOrDefault(requested) == granted;
        foreach (var item in ((IEnumerable<object?>)required["permissions"]!).Cast<Node>())
            foreach (var action in (IEnumerable<object?>)item["permissions"]!)
                if (!grants.Any(grant => Matches((string)grant["serviceId"]!, (string)item["serviceId"]!) && Equals(grant["viewId"], item["viewId"])
                    && ((IEnumerable<object?>)grant["permissions"]!).Contains(action))) throw new TokenException("Insufficient user permissions", 403);
        return claims;
    }

    private static string? Bearer(string? value)
    {
        if (value is null) return null;
        var separator = value.IndexOf(' ');
        if (separator < 0 || !value[..separator].Equals("Bearer", StringComparison.OrdinalIgnoreCase)) throw new TokenException("Invalid bearer credential");
        var token = value[(separator + 1)..];
        return token.Length is > 0 and <= 32768 && !token.Any(char.IsWhiteSpace) ? token : throw new TokenException("Invalid bearer credential");
    }

    /// <summary>Scope classification only; never credential verification or authorization.</summary>
    public static bool IsMachineRequest(IReadOnlyDictionary<string, string> headers)
    {
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, value) in headers) if (!normalized.TryAdd(name, value)) throw new TokenException("Duplicate request headers");
        if (normalized.ContainsKey("x-bp-service-id") || normalized.ContainsKey("x-bp-service-authorization")) return true;
        try { return Bearer(normalized.GetValueOrDefault("authorization")) is { } token && Tokens.IsServiceToken(token); }
        catch (TokenException) { return false; }
    }

    /// <summary>Complete request policy. Machine envelopes fail closed even when user auth is optional.</summary>
    public static async Task<AuthorizedCaller> AuthorizeAsync(IReadOnlyDictionary<string, string> headers, Node requirement,
        AuthContext context, string viewId, string method, CancellationToken cancellationToken = default)
    {
        var policy = (Node)Contracts.Parse("ApiAuthRequirementSchema", requirement)!;
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, value) in headers)
            if (!normalized.TryAdd(name, value)) throw new TokenException("Duplicate request headers");
        string[] scopeHeaders = ["x-bp-service-id", "x-bp-tenant-id", "x-bp-app-id"];
        var machine = IsMachineRequest(normalized);
        try
        {
            var primary = Bearer(normalized.GetValueOrDefault("authorization"));
            var delegated = normalized.ContainsKey("x-bp-service-authorization");
            var service = primary is not null && Tokens.IsServiceToken(primary);
            machine |= delegated || service;
            if (primary is null) throw new TokenException("Authentication required");
            var mode = delegated ? "delegated" : service ? "service" : "user";
            if (machine && (mode == "user" || scopeHeaders.Any(name => string.IsNullOrEmpty(normalized.GetValueOrDefault(name)))))
                throw new TokenException("Incomplete service envelope");
            if (!((IEnumerable<object?>)policy["callers"]!).Contains(mode)) throw new TokenException("Caller mode is not allowed", 403);
            if (!machine) return new("user", await AuthorizeUserAsync(primary, policy, context, cancellationToken));
            if (normalized["x-bp-tenant-id"] != context.TenantId || normalized["x-bp-app-id"] != context.AppId)
                throw new TokenException("Service headers do not match resolved scope");
            if (context.ServicePolicy is null) throw new TokenException("Service authentication context unavailable", 503);
            var secondary = Bearer(normalized.GetValueOrDefault("x-bp-service-authorization"));
            if (delegated && (secondary is null || service)) throw new TokenException("Delegated calls require user and service credentials");
            var user = delegated ? await AuthorizeUserAsync(primary, policy, context, cancellationToken) : null;
            var caller = await Authorization.AuthorizeServiceAsync(delegated ? secondary! : primary, context.ServicePolicy,
                normalized["x-bp-service-id"], context.TenantId, context.AppId, viewId, method, mode,
                ((IEnumerable<object?>)policy["permissions"]!).Cast<Node>().SelectMany(item => ((IEnumerable<object?>)item["permissions"]!).Cast<string>()).ToArray(), cancellationToken);
            return new(mode, user, caller.Claims);
        }
        catch (TokenException) when (policy["required"] is not true && !machine) { return new(); }
    }
}
