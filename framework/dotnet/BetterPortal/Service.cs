using System.Collections.Frozen;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class RequestException(int status, string message, IReadOnlyDictionary<string, string>? headers = null) : Exception(message)
{
    public int Status { get; } = status;
    public IReadOnlyDictionary<string, string> Headers { get; } = headers ?? new Dictionary<string, string>();
}
public sealed record PreparedRequest(RequestContext Context, IReadOnlyDictionary<string, string> Headers);

/// <summary>Standalone BP request policy, independent of ASP.NET Core.</summary>
public sealed class Service : IAsyncDisposable
{
    public Registry Registry { get; }
    private readonly Generated.BpSchemaOutput schema;
    private readonly ScopedConfig? snapshot;
    private readonly Node config;
    private readonly FrozenDictionary<(string Issuer, string Uri), JwksClient> keys;
    private volatile bool closed;
    public Service(Registry registry, Generated.ManifestDeclarationInput declaration, ScopedConfig? snapshot = null)
    {
        Registry = registry; schema = registry.Schema(declaration); this.snapshot = snapshot; config = snapshot?.Document() ?? new();
        var addresses = ((List<object?>)config.GetValueOrDefault("apps", new List<object?>())!).Cast<Node>().Where(app => app.ContainsKey("auth"))
            .Select(app => (Node)app["auth"]!).Select(auth => (Issuer: (string)auth["expectedIssuer"]!, Uri: TrustedKeys.SecureEndpoint((string)auth["jwksUri"]!, allowQuery: true).AbsoluteUri))
            .Distinct().ToArray();
        keys = addresses.ToFrozenDictionary(address => address, address => new JwksClient(address.Issuer, address.Uri));
    }
    public bool Ready => snapshot is not null && !closed;
    public Generated.PluginManifest Manifest => Contracts.Parse<Generated.PluginManifest>("PluginManifestSchema", schema.Manifest);
    public Generated.BpSchemaOutput Schema() => Contracts.Parse<Generated.BpSchemaOutput>("BpSchemaOutputSchema", schema);
    private static Dictionary<string, string> Headers(IReadOnlyDictionary<string, string> headers)
    {
        var normalized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in headers) if (!normalized.TryAdd(key, value)) throw new RequestException(400, "Duplicate request headers");
        return normalized;
    }
    private ScopedContext Resolve(IReadOnlyDictionary<string, string> headers, string scheme, string mode, IEnumerable<string>? trustedAddresses, bool preflight = false)
    {
        if (!Ready || snapshot is null) throw new RequestException(503, "Service is not ready");
        var machine = !preflight && RequestAuthorization.IsMachineRequest(headers);
        var scope = machine ? snapshot.ById(headers.GetValueOrDefault("x-bp-tenant-id", ""), headers.GetValueOrDefault("x-bp-app-id", ""))
            : snapshot.Resolve(headers, scheme, mode, trustedAddresses);
        return scope ?? throw new RequestException(machine ? 401 : 400, "BetterPortal tenant/app context required");
    }
    public IReadOnlyDictionary<string, string> Preflight(Route route, IReadOnlyDictionary<string, string> headers, string? matchedPath = null, string? fragment = null,
        string scheme = "https", string mode = "service", IEnumerable<string>? trustedAddresses = null)
    {
        var normalized = Headers(headers); var scope = Resolve(normalized, scheme, mode, trustedAddresses, preflight: true);
        var access = new AppAccess(scope, snapshot!.LocalServiceIds);
        var methods = route.Operations.Where(operation => access.Allows(route, operation.Method, matchedPath, fragment)).Select(operation => operation.Method);
        return new Cors(scope.OriginPolicy, methods).Preflight(normalized.GetValueOrDefault("origin"), normalized.GetValueOrDefault("access-control-request-method"), normalized.GetValueOrDefault("access-control-request-headers"));
    }
    public async Task<PreparedRequest> PrepareAsync(Route route, string method, string path, IReadOnlyDictionary<string, string> headers,
        string? matchedPath = null, string? fragment = null, string scheme = "https", string mode = "service", IEnumerable<string>? trustedAddresses = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var normalized = Headers(headers); var scope = Resolve(normalized, scheme, mode, trustedAddresses);
        var responseHeaders = new Cors(scope.OriginPolicy, route.Operations.Select(operation => operation.Method)).Headers(normalized.GetValueOrDefault("origin"));
        var access = new AppAccess(scope, snapshot!.LocalServiceIds);
        if (!access.Allows(route, method, matchedPath, fragment)) throw new RequestException(404, "Route not found", responseHeaders);
        var operation = route.Operations.Single(item => item.Method == method);
        var appAuth = (Node?)scope.App.GetValueOrDefault("auth");
        var client = appAuth is null ? null : keys.GetValueOrDefault(((string)appAuth["expectedIssuer"]!, TrustedKeys.SecureEndpoint((string)appAuth["jwksUri"]!, allowQuery: true).AbsoluteUri));
        var management = (Node)config.GetValueOrDefault("configManagement", new Node())!;
        (string, string)? root = management.ContainsKey("adminTenantId") && management.ContainsKey("managementAppId")
            ? ((string)management["adminTenantId"]!, (string)management["managementAppId"]!) : null;
        var auth = new AuthContext(scope.TenantId, scope.AppId, appAuth, client is null ? null : client.ResolveAsync,
            (Node?)config.GetValueOrDefault("m2m"), access.PermissionAliases(route, method, matchedPath, fragment), root);
        try
        {
            var caller = await RequestAuthorization.AuthorizeAsync(normalized, (Node)Contracts.Parse("ApiAuthRequirementSchema", operation.Declaration.Auth)!, auth, route.ViewId, method, cancellationToken);
            if (caller.Service is not null && !access.Allows(route, method, matchedPath, fragment, (string)caller.Service["aud"]!)) throw new RequestException(403, "Access denied", responseHeaders);
            return new(new(scope, caller, method, path), responseHeaders);
        }
        catch (TokenException error)
        {
            var message = error.Status switch { 401 => "Authentication required or invalid", 403 => "Access denied", 503 => "Authentication unavailable", _ => "Authentication failed" };
            throw new RequestException(error.Status, message, responseHeaders);
        }
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
        await Task.WhenAll(keys.Values.Select(client => client.DisposeAsync().AsTask()));
    }
}
