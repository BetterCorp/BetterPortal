using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed partial class Service
{
    /// <summary>Readiness with diagnostics only for a verified user of the current management tenant/app.</summary>
    public async Task<Node> HealthAsync(IReadOnlyDictionary<string, string> headers, CancellationToken cancellation = default)
    {
        cancellation.ThrowIfCancellationRequested();
        Node Public() => new() { ["ok"] = Ready };
        var current = state;
        if (current is null || closed) return Public();
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token, current.Retirement.Token);
        try
        {
            var normalized = Headers(headers);
            // Service/delegated envelopes and caller-supplied scope hints cannot grant diagnostics.
            if (RequestAuthorization.IsMachineRequest(normalized)) return Public();
            var token = RequestAuthorization.Bearer(normalized.GetValueOrDefault("authorization"));
            if (token is null || current.Config.GetValueOrDefault("configManagement") is not Node management
                || management.GetValueOrDefault("adminTenantId") is not string tenantId
                || management.GetValueOrDefault("managementAppId") is not string appId) return Public();
            var scope = current.Snapshot.ById(tenantId, appId);
            if (scope is null || installedTenantLock is not null && tenantId != installedTenantLock
                || scope.App.GetValueOrDefault("auth") is not Node policy) return Public();
            var address = TrustedKeys.SecureEndpoint((string)policy["jwksUri"]!, allowQuery: true).AbsoluteUri;
            if (!current.Keys.TryGetValue(((string)policy["expectedIssuer"]!, address), out var keys)) return Public();
            await RequestAuthorization.AuthorizeUserAsync(token, new Node { ["required"] = true },
                new AuthContext(tenantId, appId, policy, keys.ResolveAsync), lifetime.Token);
            lifetime.Token.ThrowIfCancellationRequested();
            if (!ReferenceEquals(state, current) || closed) return Public();
            var synced = submitted;
            var ready = !closed && configApi.Ready && (!managed || synced);
            var diagnostics = new Node { ["ok"] = ready, ["ready"] = ready, ["pluginId"] = schema.Manifest.PluginId, ["version"] = schema.Manifest.Version,
                ["config"] = new Node { ["synced"] = synced, ["localConfig"] = !managed,
                    ["tenants"] = ((List<object?>)current.Config["tenants"]!).Count, ["apps"] = ((List<object?>)current.Config["apps"]!).Count },
                ["manifestSync"] = new Node { ["state"] = synced ? "synced" : managed ? "awaiting-sync" : "local" } };
            // Projection must finish before the final revision check: replacement also revokes completed verification.
            lifetime.Token.ThrowIfCancellationRequested();
            return ReferenceEquals(state, current) && !closed && submitted == synced && Ready == ready ? diagnostics : Public();
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
        catch (Exception) { return Public(); } // Invalid/unavailable/retired authentication keeps the probe public.
    }
}
