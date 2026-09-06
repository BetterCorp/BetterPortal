using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class RequestException(int status, string message, IReadOnlyDictionary<string, string>? headers = null, ScopedContext? scope = null) : Exception(message)
{
    public int Status { get; } = status;
    public IReadOnlyDictionary<string, string> Headers { get; } = headers ?? new Dictionary<string, string>();
    public ScopedContext? Scope { get; } = scope;
}
public sealed record PreparedRequest(RequestContext Context, IReadOnlyDictionary<string, string> Headers);

/// <summary>Standalone BP request policy, independent of ASP.NET Core.</summary>
public sealed partial class Service : IAsyncDisposable
{
    public Registry Registry { get; }
    private readonly Generated.BpSchemaOutput schema;
    private volatile bool closed;
    public Service(Registry registry, Generated.ManifestDeclarationInput declaration, ScopedConfig? snapshot = null,
        IStateStore? stateStore = null, bool managed = false, string? previewKey = null, ConfigApi? configApi = null, KeyPair? signingKey = null)
    {
        Registry = registry; schema = registry.Schema(declaration);
        SigningKey = signingKey; clients = new(() => new ServiceClients(this));
        this.configApi = configApi ?? new ConfigApi(); configSchema = this.configApi.Schema(schema.Manifest.PluginId, schema.Manifest.ConfigSchemas);
        provisionable = managed && configApi is null && snapshot is null;
        store = stateStore; this.managed = managed; this.previewKey = previewKey;
        state = snapshot is null ? null : Build(snapshot);
    }
    public bool Ready => state is not null && !closed && configApi.Ready && (!managed || submitted);
    public bool Managed => managed;
    /// <summary>Cancelled when service shutdown begins. Does not own caller transports.</summary>
    public CancellationToken Stopping => shutdown.Token;
    internal void SuspendSync() => submitted = false;
    public Generated.PluginManifest Manifest => Contracts.Parse<Generated.PluginManifest>("PluginManifestSchema", schema.Manifest);
    public Generated.BpSchemaOutput Schema() => Contracts.Parse<Generated.BpSchemaOutput>("BpSchemaOutputSchema", schema);
    private static Dictionary<string, string> Headers(IReadOnlyDictionary<string, string> headers)
    {
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in headers) if (!normalized.TryAdd(key, value)) throw new RequestException(400, "Duplicate request headers");
        return normalized;
    }
    private ScopedContext Resolve(SnapshotState? current, IReadOnlyDictionary<string, string> headers, string scheme, string mode, IEnumerable<string>? trustedAddresses, bool preflight = false)
    {
        if (!Ready || current is null) throw new RequestException(503, "Service is not ready");
        var machine = !preflight && RequestAuthorization.IsMachineRequest(headers);
        var snapshot = current.Snapshot;
        var scope = machine ? snapshot.ById(headers.GetValueOrDefault("x-bp-tenant-id", ""), headers.GetValueOrDefault("x-bp-app-id", ""))
            : snapshot.Resolve(headers, scheme, mode, trustedAddresses);
        if (scope is null) throw new RequestException(machine ? 401 : 400, "BetterPortal tenant/app context required");
        if (installedTenantLock is not null && scope.TenantId != installedTenantLock) throw new RequestException(426, "Service is locked to another tenant");
        return scope;
    }
    public IReadOnlyDictionary<string, string> Preflight(Route route, IReadOnlyDictionary<string, string> headers, string? matchedPath = null, string? fragment = null,
        string scheme = "https", string mode = "service", IEnumerable<string>? trustedAddresses = null)
    {
        var current = state;
        var normalized = Headers(headers); var scope = Resolve(current, normalized, scheme, mode, trustedAddresses, preflight: true);
        var access = new AppAccess(scope, current!.Snapshot.LocalServiceIds);
        var methods = route.Operations.Where(operation => access.AllowsPreflight(route, operation.Method, matchedPath, fragment)).Select(operation => operation.Method);
        return new Cors(scope.OriginPolicy, methods).Preflight(normalized.GetValueOrDefault("origin"), normalized.GetValueOrDefault("access-control-request-method"), normalized.GetValueOrDefault("access-control-request-headers"));
    }
    public async Task<PreparedRequest> PrepareAsync(Route route, string method, string path, IReadOnlyDictionary<string, string> headers,
        string? matchedPath = null, string? fragment = null, string scheme = "https", string mode = "service", IEnumerable<string>? trustedAddresses = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var current = state;
        var normalized = Headers(headers); var scope = Resolve(current, normalized, scheme, mode, trustedAddresses);
        var responseHeaders = new Cors(scope.OriginPolicy, route.Operations.Select(operation => operation.Method)).Headers(normalized.GetValueOrDefault("origin"));
        var access = new AppAccess(scope, current!.Snapshot.LocalServiceIds);
        if (!access.Allows(route, method, matchedPath, fragment)) throw new RequestException(404, "Route not found", responseHeaders, scope);
        var operation = route.Operations.Single(item => item.Method == method);
        var appAuth = (Node?)scope.App.GetValueOrDefault("auth");
        var client = appAuth is null ? null : current.Keys.GetValueOrDefault(((string)appAuth["expectedIssuer"]!, TrustedKeys.SecureEndpoint((string)appAuth["jwksUri"]!, allowQuery: true).AbsoluteUri));
        var config = current.Config;
        var management = (Node)config.GetValueOrDefault("configManagement", new Node())!;
        (string, string)? root = management.ContainsKey("adminTenantId") && management.ContainsKey("managementAppId")
            ? ((string)management["adminTenantId"]!, (string)management["managementAppId"]!) : null;
        var auth = new AuthContext(scope.TenantId, scope.AppId, appAuth, client is null ? null : client.ResolveAsync,
            (Node?)config.GetValueOrDefault("m2m"), access.PermissionAliases(route, method, matchedPath, fragment), root);
        try
        {
            var caller = await RequestAuthorization.AuthorizeAsync(normalized, (Node)Contracts.Parse("ApiAuthRequirementSchema", operation.Declaration.Auth)!, auth, route.ViewId, method, cancellationToken);
            if (!ReferenceEquals(state, current) || !Ready) throw new RequestException(503, "Configuration changed during authentication");
            if (caller.Service is not null && !access.Allows(route, method, matchedPath, fragment, (string)caller.Service["aud"]!)) throw new RequestException(403, "Access denied", responseHeaders, scope);
            var values = current.PreviewScope == (scope.TenantId, scope.AppId) ? (Node)Json.Read(Json.Write(current.Preview))! : new Node();
            if (configApi.Settings is { } settings)
            {
                var stored = settings.Read(scope.TenantId);
                var tenant = (Node)stored["tenant"]!; var app = (Node)((Node)stored["app"]!).GetValueOrDefault(scope.AppId, new Node())!;
                if (current.PreviewScope == (scope.TenantId, scope.AppId))
                {
                    foreach (var (key, value) in (Node)current.PreviewValues["tenant"]!) tenant[key] = value;
                    foreach (var (key, value) in (Node)current.PreviewValues["app"]!) app[key] = value;
                }
                try { values = settings.Schema.Effective(tenant, app); }
                catch (Exception) { throw new RequestException(503, "Service settings are incomplete", responseHeaders, scope); }
            }
            return new(new RequestContext(scope, caller, method, path, values) { Urls = BuildUrls(current, scope, path, normalized, scheme),
                ClientContext = new(Clients, scope.TenantId, scope.AppId, current, caller.User is not null ? RequestAuthorization.Bearer(normalized.GetValueOrDefault("authorization")) : null, cancellationToken) }, responseHeaders);
        }
        catch (Exception error) when ((error is not OperationCanceledException || !cancellationToken.IsCancellationRequested) && (!ReferenceEquals(state, current) || !Ready))
        { throw new RequestException(503, "Configuration changed during authentication"); }
        catch (TokenException error)
        {
            var message = error.Status switch { 401 => "Authentication required or invalid", 403 => "Access denied", 503 => "Authentication unavailable", _ => "Authentication failed" };
            throw new RequestException(error.Status, message, responseHeaders, scope);
        }
    }
    public Urls Urls(ScopedContext scope, string path, IReadOnlyDictionary<string, string>? headers = null, string scheme = "https")
        => BuildUrls(state, scope, path, headers, scheme);
    private Urls BuildUrls(SnapshotState? current, ScopedContext scope, string path, IReadOnlyDictionary<string, string>? headers, string scheme)
    {
        headers ??= new Dictionary<string, string>();
        var config = current?.Config ?? new Node();
        var identifier = (string?)((Node)config.GetValueOrDefault("serviceIdentity", new Node())!).GetValueOrDefault("id") ?? schema.Manifest.PluginId;
        return new(scope, Registry, identifier, path, [headers.GetValueOrDefault("origin", ""), headers.GetValueOrDefault("referer", ""), scheme + "://" + headers.GetValueOrDefault("host", "")]);
    }
    public static Node Metadata(Route route, Operation operation, string matchedPath)
    {
        var declaration = operation.Declaration;
        var primary = route.Operations.FirstOrDefault(item => item.Method == "GET")?.Declaration ?? declaration;
        return new() { ["viewId"] = route.ViewId, ["title"] = primary.Title, ["description"] = primary.Description, ["path"] = matchedPath,
            ["operationId"] = declaration.OperationId, ["method"] = operation.Method, ["auth"] = declaration.Auth, ["cacheHints"] = declaration.CacheHints };
    }
    public async ValueTask DisposeAsync()
    {
        closed = true;
        await shutdown.CancelAsync();
        if (clients.IsValueCreated) await clients.Value.DisposeAsync();
        await updates.WaitAsync();
        try
        {
            if (state is not null) await state.Close();
            Task[] pending; lock (cleanup) pending = cleanup.ToArray();
            await Task.WhenAll(pending);
            await configApi.DisposeAsync();
        }
        finally { updates.Release(); }
    }
}
