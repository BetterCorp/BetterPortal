namespace BetterPortal;

public sealed record AuthorizedService(Dictionary<string, object?> Claims, IReadOnlyList<string> Permissions);

public static class Authorization
{
    private static IEnumerable<Dictionary<string, object?>> Objects(Dictionary<string, object?> value, string key) =>
        ((IEnumerable<object?>)value[key]!).Cast<Dictionary<string, object?>>();
    private static IEnumerable<string> Strings(Dictionary<string, object?> value, string key) =>
        ((IEnumerable<object?>)value[key]!).Cast<string>();

    /// <summary>Checks a service envelope against current scoped policy. Delegated calls additionally require user authorization.</summary>
    public static async Task<AuthorizedService> AuthorizeServiceAsync(string token, IDictionary<string, object?> policy,
        string sourceServiceId, string tenantId, string appId, string viewId, string method, string mode,
        IReadOnlyList<string>? requiredPermissions = null, CancellationToken cancellationToken = default)
    {
        if (mode is not ("service" or "delegated")) throw new ArgumentException("Invalid service caller mode");
        var current = (Dictionary<string, object?>)Contracts.Parse(Contracts.Get("ScopedServiceConfigSchema", "m2m"), policy)!;
        var audience = Tokens.UnverifiedClaims(token).GetValueOrDefault("aud") as string;
        if (audience is null || !Strings(current, "localServiceIds").Contains(audience))
            throw new TokenException("Service token targets another service");
        Task<string> Resolve(string kid, CancellationToken _)
        {
            var sources = Objects(current, "services").Where(service => Equals(service["id"], sourceServiceId)
                && Equals(service.GetValueOrDefault("keyId"), kid) && service.GetValueOrDefault("publicKeyPem") is string { Length: > 0 }).ToArray();
            if (sources.Length != 1) throw new TokenException("Service signing key is not uniquely trusted");
            return Task.FromResult((string)sources[0]["publicKeyPem"]!);
        }
        var claims = await Tokens.VerifyAsync(token, Resolve, sourceServiceId, audience, TokenPurpose.Service, cancellationToken: cancellationToken);
        if (!Equals(claims["tenantId"], tenantId) || !Equals(claims["appId"], appId))
            throw new TokenException("Service token tenant or app mismatch");
        var bindings = Objects(current, "bindings").Where(binding => binding["enabled"] is true
            && Equals(binding["id"], claims["bindingId"]) && Equals(binding["sourceServiceId"], claims["iss"])
            && Equals(binding["targetServiceId"], claims["aud"]) && Equals(binding["mode"], mode)
            && Equals(binding["tenantId"], tenantId) && (!binding.ContainsKey("appId") || Equals(binding["appId"], appId))
            && Equals(binding["targetViewId"], viewId)).ToArray();
        if (bindings.Length != 1) throw new TokenException("Service binding is unavailable or ambiguous", 403);
        var grant = Objects(current, "grants").FirstOrDefault(grant => grant["enabled"] is true
            && Equals(grant["bindingId"], bindings[0]["id"]) && Equals(grant["tenantId"], tenantId)
            && (!grant.ContainsKey("appId") || Equals(grant["appId"], appId)) && Strings(grant, "methods").Contains(method)
            && (requiredPermissions ?? []).All(permission => Strings(grant, "permissions").Contains(permission)));
        if (grant is null) throw new TokenException("Service grant is unavailable or insufficient", 403);
        return new(claims, Strings(grant, "permissions").ToArray());
    }
}
