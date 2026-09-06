using System.Text.Json.Nodes;
using System.Collections.Frozen;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>Ticket-protected settings policy. Service coordinates snapshots and lifetime.</summary>
public sealed class ConfigApi : IAsyncDisposable
{
    public ServiceSettings? Settings { get; }
    private readonly string? issuer;
    private readonly JwksClient? keys;
    private readonly string? devToken;
    private readonly Node options;
    public ConfigApi(ServiceSettings? settings = null, string? issuer = null, string? jwksUri = null,
        Generated.ServiceConfigManagementMode? mode = null, string? customUiPath = null, bool writable = true, string? devToken = null)
    {
        if ((issuer is null) != (jwksUri is null)) throw new ArgumentException("Config tickets require both issuer and JWKS URI");
        Settings = settings;
        this.devToken = !string.IsNullOrEmpty(devToken) && Environment.GetEnvironmentVariable("BP_ALLOW_DEV_CONFIG_TOKEN") == "true" ? devToken : null;
        if (issuer is not null) { TrustedKeys.SecureEndpoint(issuer); this.issuer = issuer; keys = new JwksClient(issuer, jwksUri!); }
        options = new() { ["mode"] = mode ?? (settings is null ? Generated.ServiceConfigManagementMode.Static : Generated.ServiceConfigManagementMode.Hybrid),
            ["supportsWrite"] = settings is not null && writable, ["supportsCustomUi"] = customUiPath is not null };
        if (customUiPath is not null) options["customUiPath"] = customUiPath;
    }
    internal Node Schema(string serviceId, IEnumerable<Generated.ConfigSchemaDescriptor> descriptors)
    {
        var value = (Node)Contracts.Parse("ServiceConfigSchemaResponseSchema", new Node(options) { ["serviceId"] = serviceId, ["configSchemas"] = descriptors })!;
        if (Settings is not null && !JsonNode.DeepEquals(JsonNode.Parse(Json.Write(Settings.Schema.Descriptors())), JsonNode.Parse(Json.Write(value["configSchemas"])) ))
            throw new ArgumentException("Settings descriptors must match the service manifest");
        return value;
    }
    internal bool Ready => Settings is null || Settings.Ready;
    internal async Task Initialize(CancellationToken cancellation) { if (Settings is not null) await Settings.Initialize(cancellation: cancellation); }
    internal async Task<Node> Authorize(string serviceId, IReadOnlyDictionary<string, string> headers, string action, CancellationToken cancellation)
    {
        var bearer = headers.GetValueOrDefault("authorization", "");
        if (!bearer.StartsWith("Bearer ", StringComparison.Ordinal)) throw new TokenException("A valid config ticket is required");
        var token = bearer[7..];
        if (keys is not null && issuer is not null)
        {
            try { return await Tokens.VerifyConfigTicketAsync(token, keys.ResolveAsync, issuer, serviceId, null, action, cancellation); }
            catch (TokenException) { }
        }
        cancellation.ThrowIfCancellationRequested();
        if (devToken is not null && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(token), System.Text.Encoding.UTF8.GetBytes(devToken)))
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            try { return (Node)Contracts.Parse("ServiceConfigTicketClaimsSchema", new Node {
                ["iss"] = "betterportal-dev", ["aud"] = new[] { Tokens.ConfigTicketAudience }, ["sub"] = "admin.dev", ["exp"] = now + 300, ["iat"] = now,
                ["jti"] = Guid.CreateVersion7().ToString(), ["realm"] = "control-plane", ["tenantId"] = headers.GetValueOrDefault("x-bp-tenant-id", ""), ["serviceId"] = serviceId, ["actions"] = new[] { action }
            })!; }
            catch (AnyVali.ValidationError) { }
        }
        throw new TokenException("A valid config ticket is required");
    }
    internal async Task<Node> Apply(string serviceId, Node snapshot, Node claims, IReadOnlyDictionary<string, string> headers, string action, object? body, CancellationToken cancellation)
    {
        if (Settings is null || action == "config.write" && options["supportsWrite"] is not true) throw new RequestException(501, "Dynamic config operation is not supported");
        var tenantId = (string)claims["tenantId"]!; string? appId; Node? request = null;
        if (action == "config.write")
        {
            try { request = (Node)Contracts.Parse("ServiceConfigWriteRequestSchema", body)!; }
            catch (AnyVali.ValidationError) { throw new RequestException(400, "Invalid config write payload"); }
            if (!Equals(request["tenantId"], tenantId)) throw new RequestException(403, "Config ticket tenant mismatch");
            appId = request.GetValueOrDefault("appId") as string;
            if (headers.TryGetValue("x-bp-app-id", out var hint) && hint != appId) throw new RequestException(403, "Config app header does not match the write");
        }
        else appId = headers.GetValueOrDefault("x-bp-app-id");
        if (headers.TryGetValue("x-bp-tenant-id", out var tenantHint) && tenantHint != tenantId) throw new RequestException(403, "Config tenant header does not match the ticket");
        if (!((List<object?>)snapshot["tenants"]!).Cast<Node>().Any(tenant => Equals(tenant["id"], tenantId) && tenant["active"] is true))
            throw new RequestException(403, "Config scope is not allowed");
        if (appId is not null && !((List<object?>)snapshot.GetValueOrDefault("configApps", snapshot["apps"])!).Cast<Node>().Any(app => Equals(app["id"], appId) && Equals(app["tenantId"], tenantId)))
            throw new RequestException(403, "Config scope is not allowed");
        Node values;
        if (action == "config.write")
        {
            try { values = await Settings.Write(tenantId, request!["values"]!, appId, ((List<object?>)request["clearKeys"]!).Cast<string>(), cancellation); }
            catch (SettingsInputException) { throw new RequestException(400, "Invalid config values"); }
            values = Settings.Schema.Redact(appId is null ? "tenant" : "app", values);
        }
        else values = Settings.Values(tenantId, appId, redacted: true);
        var response = new Node { ["serviceId"] = serviceId, ["tenantId"] = tenantId, ["values"] = values };
        if (appId is not null) response["appId"] = appId;
        if (action == "config.write") response["ok"] = true;
        return (Node)Contracts.Parse(action == "config.write" ? "ServiceConfigWriteResponseSchema" : "ServiceConfigReadResponseSchema", response)!;
    }
    public async ValueTask DisposeAsync()
    {
        try { if (keys is not null) await keys.DisposeAsync(); }
        finally { if (Settings is not null) await Settings.DisposeAsync(); }
    }
}

public sealed partial class Service
{
    private ConfigApi configApi;
    private Node configSchema;
    private bool provisionable;
    internal bool Provisionable => provisionable;
    private string? installedInstanceId;
    private string? installedTenantLock;
    internal async Task BindInstallation(string? instanceId, string? tenantLock, CancellationToken cancellation)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await updates.WaitAsync(linked.Token);
        try
        {
            ObjectDisposedException.ThrowIf(closed, this);
            if (installedInstanceId is not null && installedInstanceId != instanceId) throw new ArgumentException("Installed instance cannot change");
            if (installedTenantLock is not null && installedTenantLock != tenantLock) throw new ArgumentException("Installed tenant cannot change");
            if (instanceId is not null && state is not null && (state.Config.GetValueOrDefault("serviceIdentity") is not Node identity || !Equals(identity.GetValueOrDefault("id"), instanceId)))
                throw new ArgumentException("Current snapshot does not belong to the installed instance");
            installedInstanceId = instanceId; installedTenantLock = tenantLock;
        }
        finally { updates.Release(); }
    }
    internal async Task Provision(ConfigApi candidate, CancellationToken cancellation)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        var published = false;
        try
        {
            var candidateSchema = candidate.Schema(schema.Manifest.PluginId, schema.Manifest.ConfigSchemas);
            await candidate.Initialize(linked.Token);
            await updates.WaitAsync(linked.Token);
            try
            {
                if (closed || !provisionable || state is not null || submitted) throw new InvalidOperationException("Provisioning requires an empty managed service");
                await configApi.DisposeAsync();
                linked.Token.ThrowIfCancellationRequested();
                ObjectDisposedException.ThrowIf(closed, this);
                configApi = candidate; configSchema = candidateSchema;
                provisionable = false; published = true;
            }
            finally { updates.Release(); }
        }
        finally { if (!published) await candidate.DisposeAsync(); }
    }
    public Node ConfigSchema() => (Node)Json.Read(Json.Write(configSchema))!;
    public async Task Initialize(CancellationToken cancellation = default)
    {
        ObjectDisposedException.ThrowIf(closed, this);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await configApi.Initialize(linked.Token);
    }
    public Dictionary<string, string> ConfigHeaders(IReadOnlyDictionary<string, string> headers, bool preflight = false)
    {
        var normalized = Headers(headers); var current = state;
        var origins = (current is null ? [] : ((List<object?>)current.Config["managementOrigins"]!).Cast<string>().Select(origin => HttpAddress.Origin(origin))).ToFrozenSet();
        var cors = new Cors(new OriginPolicy(origins, origins), ["GET", "POST"]);
        var requested = normalized.GetValueOrDefault("access-control-request-method");
        var result = preflight ? cors.Preflight(normalized.GetValueOrDefault("origin"), requested == "HEAD" ? "GET" : requested, normalized.GetValueOrDefault("access-control-request-headers"))
            : cors.Headers(normalized.GetValueOrDefault("origin"));
        if (preflight) result["access-control-allow-methods"] = "GET, HEAD, POST, OPTIONS";
        if (result.ContainsKey("access-control-allow-origin")) result["access-control-allow-credentials"] = "true";
        result["cache-control"] = "no-store";
        return result;
    }
    public async Task<Node> ConfigRequest(string action, IReadOnlyDictionary<string, string> headers, object? body = null, CancellationToken cancellation = default)
    {
        if (action is not ("config.read" or "config.write")) throw new ArgumentException("Unknown config action");
        var normalized = Headers(headers); var current = state;
        var responseHeaders = ConfigHeaders(normalized);
        if (!Ready || current is null) throw new RequestException(503, "Service is not ready", responseHeaders);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        Node claims;
        try { claims = await configApi.Authorize(schema.Manifest.PluginId, normalized, action, linked.Token); }
        catch (TokenException) { throw new RequestException(401, "A valid config ticket is required", responseHeaders); }
        await updates.WaitAsync(linked.Token);
        try
        {
            if (!ReferenceEquals(state, current) || !Ready) throw new RequestException(503, "Configuration changed during authentication", responseHeaders);
            if (installedTenantLock is not null && !Equals(claims["tenantId"], installedTenantLock)) throw new RequestException(403, "Config scope is not allowed", responseHeaders);
            // Scope cannot be revoked between this check and the atomic settings commit.
            return await configApi.Apply(schema.Manifest.PluginId, current.Config, claims, normalized, action, body, linked.Token);
        }
        finally { updates.Release(); }
    }
}
