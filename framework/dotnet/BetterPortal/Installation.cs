using AnyVali;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>One owner for pinned installation, protected credentials and synchronization.</summary>
public sealed class ServiceInstallation : IAsyncDisposable
{
    public Service Service { get; }
    private readonly BootstrapStateStore store;
    private readonly string cp, address, jwks;
    private readonly IStateStore? settingsStore;
    private readonly SettingsSchema? settingsSchema;
    private readonly Generated.AuthProviderRuntimeMetadataInput? provider;
    private readonly Generated.ServiceConfigManagementMode? configMode;
    private readonly string? customUiPath;
    private readonly bool writable;
    private readonly TimeSpan timeout, delay;
    private readonly JwksClient keys;
    private readonly HttpClient client;
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly CancellationTokenSource shutdown = new();
    private KeyPair? identity;
    private ControlPlaneSync? sync;
    private volatile bool closed, started, provisioned, installed;
    public bool Installed => installed;
    public KeyPair Identity => !closed && identity is not null ? identity : throw new InvalidOperationException("Installation identity is not available");
    public Node Jwks() => new() { ["keys"] = new[] { Identity.PublicJwk() } };
    public object Status => new { installed, closed, sync = sync?.Status };

    public ServiceInstallation(Service service, BootstrapStateStore state, string cpUrl, string serviceUrl,
        IStateStore? settingsStore = null, string? cpJwksUri = null, Generated.AuthProviderRuntimeMetadataInput? authProvider = null,
        Generated.ServiceConfigManagementMode? configMode = null, string? customUiPath = null, bool writable = true,
        TimeSpan? retryDelay = null, TimeSpan? requestTimeout = null)
    {
        if (!service.Managed || !service.Provisionable) throw new ArgumentException("Installation requires an unprovisioned managed Service");
        Service = service; store = state;
        TrustedKeys.SecureEndpoint(cpUrl); cp = cpUrl.TrimEnd('/');
        address = HttpAddress.Origin(TrustedKeys.SecureEndpoint(serviceUrl).AbsoluteUri);
        jwks = cpJwksUri ?? cp + "/.well-known/jwks.json"; TrustedKeys.SecureEndpoint(jwks, allowQuery: true);
        timeout = requestTimeout ?? TimeSpan.FromSeconds(30); delay = retryDelay ?? TimeSpan.FromSeconds(5);
        if (new[] { timeout, delay }.Any(value => value <= TimeSpan.Zero || value.TotalMilliseconds > uint.MaxValue - 1)) throw new ArgumentException("Invalid installation timing");
        var descriptors = service.Manifest.ConfigSchemas;
        settingsSchema = descriptors.Count != 0 ? new SettingsSchema(descriptors.Select(item => Contracts.Parse<Generated.ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", item))) : null;
        if (settingsSchema is not null && settingsStore is null) throw new ArgumentException("Installed settings require an explicit state store");
        this.settingsStore = settingsStore; this.configMode = configMode; this.customUiPath = customUiPath; this.writable = writable;
        provider = authProvider is null ? null : Contracts.Parse<Generated.AuthProviderRuntimeMetadataInput>("AuthProviderRuntimeMetadataSchema", authProvider);
        keys = new JwksClient(cp, jwks);
        client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, UseCookies = false }) { Timeout = Timeout.InfiniteTimeSpan };
    }
    private Node Binding(object? value, bool checkAddress = true)
    {
        var binding = (Node)Contracts.Parse("ServiceInstallationBindingSchema", value)!;
        var origin = HttpAddress.Origin(TrustedKeys.SecureEndpoint((string)binding["serviceUrl"]!).AbsoluteUri);
        if (((string)binding["cpUrl"]!).TrimEnd('/') != cp || !Equals(binding["cpJwksUri"], jwks)
            || checkAddress && origin != address)
            throw new TokenException("Setup token does not match the configured installation");
        return binding;
    }
    private void Credentials(Node value, bool checkAddress = true)
    {
        if ((value.GetValueOrDefault("cpUrl") as string ?? "").TrimEnd('/') != cp || !Equals(value.GetValueOrDefault("cpJwksUri", jwks), jwks))
            throw new ArgumentException("Stored credentials do not match the configured control plane");
        if (value.TryGetValue("installation", out var binding))
        {
            var tenant = (Binding(binding, checkAddress).GetValueOrDefault("scope") as Node)?.GetValueOrDefault("tenantId");
            if (tenant is not null && !Equals(value.GetValueOrDefault("tenantLock", tenant), tenant)) throw new ArgumentException("Stored installation tenant does not match its lock");
        }
    }
    private async Task<bool> Activate(Node value, CancellationToken cancellation)
    {
        Credentials(value);
        Service.SuspendSync();
        if (sync is not null) { var previous = sync; sync = null; await previous.DisposeAsync(); }
        var binding = value.GetValueOrDefault("installation") as Node;
        var tenant = (binding?.GetValueOrDefault("scope") as Node)?.GetValueOrDefault("tenantId");
        await Service.BindInstallation(binding?.GetValueOrDefault("instanceId") as string, value.GetValueOrDefault("tenantLock", tenant) as string, cancellation);
        var next = new ControlPlaneSync(Service, cp, (string)value["apiKey"]!, Identity, provider, delay, timeout);
        try
        {
            if (!provisioned)
            {
                var settings = settingsSchema is null ? null : new ServiceSettings(settingsSchema, new ConfigCipher((string)value["configEncryptionKey"]!), settingsStore);
                var api = new ConfigApi(settings, cp, jwks, configMode, customUiPath, writable);
                await Service.Provision(api, cancellation); provisioned = true;
            }
            sync = next;
            return await next.StartAsync(cancellation);
        }
        catch { await next.DisposeAsync(); sync = null; throw; }
    }
    public async Task<bool> StartAsync(CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await gate.WaitAsync(linked.Token);
        try
        {
            if (closed || started) throw new InvalidOperationException("Installation is closed or already started");
            started = true;
            var value = await store.Read(cancellation: linked.Token);
            if (value.ContainsKey("apiKey")) Credentials(value, checkAddress: false);
            identity = await store.Identity(linked.Token);
            if (!value.ContainsKey("apiKey")) return false;
            installed = true;
            if (value.GetValueOrDefault("installation") is Node binding && HttpAddress.Origin((string)binding["serviceUrl"]!) != address) return false;
            return await Activate(value, linked.Token);
        }
        finally { gate.Release(); }
    }
    private async Task<Node> Post(string path, object payload, string schema, CancellationToken cancellation, string? apiKey = null, int limit = 1024 * 1024)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation); deadline.CancelAfter(timeout);
        var content = Envelope.Utf8.GetBytes(Json.Write(payload));
        if (content.Length > limit) throw new ArgumentException("Control-plane request exceeds limit");
        using var request = new HttpRequestMessage(HttpMethod.Post, cp + "/.well-known/bp/" + path) { Content = new ByteArrayContent(content) };
        request.Content.Headers.ContentType = new("application/json");
        request.Headers.Accept.ParseAdd("application/json");
        if (apiKey is not null) request.Headers.Authorization = new("Bearer", apiKey);
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if ((int)response.StatusCode is 400 or 401 or 403 or 404 or 409) throw new RequestException((int)response.StatusCode, "Control plane rejected the request");
        if (response.StatusCode != System.Net.HttpStatusCode.OK || !string.Equals(response.Content.Headers.ContentType?.MediaType, "application/json", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Invalid control-plane response");
        await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
        using var data = new MemoryStream(); var buffer = new byte[8192]; int count;
        while ((count = await stream.ReadAsync(buffer, deadline.Token)) != 0)
        {
            if (data.Length + count > limit) throw new ArgumentException("Control-plane response exceeds limit");
            data.Write(buffer, 0, count);
        }
        return (Node)Contracts.Parse(schema, Json.Read(Envelope.Utf8.GetString(data.ToArray())))!;
    }
    private async Task<Node> Redeem(string token, CancellationToken cancellation)
    {
        var payload = new Node { ["setupToken"] = token, ["pluginId"] = Service.Manifest.PluginId, ["serviceUrl"] = address, ["jwks"] = Jwks() };
        if (provider is not null) payload["authProvider"] = provider;
        var value = await Post("services/redeem", payload, "ServiceRedeemResponseSchema", cancellation);
        if (!Equals(value["cpJwksUri"], jwks) || ((string)value["apiKey"]!).Any(c => c < 33 || c > 126)) throw new ArgumentException("Invalid redemption credentials");
        return value;
    }
    public async Task<(int Status, Node Body)> ChangeHostname(object? body, CancellationToken cancellation = default)
    {
        Node request;
        try { request = (Node)Contracts.Parse("ServiceHostnameChangeRequestSchema", body)!; }
        catch (ValidationError) { throw new RequestException(400, "Invalid hostname-change request"); }
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await gate.WaitAsync(linked.Token);
        try
        {
            if (closed || !started) throw new RequestException(503, "Installation is not available");
            var value = await store.Read(cancellation: linked.Token);
            if (!value.ContainsKey("apiKey") || value.GetValueOrDefault("installation") is not Node binding)
                throw new RequestException(409, "An installed service binding is required");
            Credentials(value, checkAddress: false);
            Node result;
            using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(linked.Token))
            {
                deadline.CancelAfter(timeout);
                try
                {
                    request["serviceUrl"] = address;
                    result = await Post("services/confirm-hostname-change", request, "ServiceHostnameChangeResponseSchema", deadline.Token, (string)value["apiKey"]!);
                    if (HttpAddress.Origin(TrustedKeys.SecureEndpoint((string)result["serviceUrl"]!).AbsoluteUri) != address) throw new ArgumentException("Unexpected confirmed address");
                    // Verify current credential-bound state even if CP replayed a cached result.
                    var snapshot = new ScopedConfig(await Post("sync/poll", ControlPlaneSync.BuildSubmission(Service.Manifest, Identity, provider),
                        "ScopedServiceConfigSchema", deadline.Token, (string)value["apiKey"]!, 16 * 1024 * 1024)).Document();
                    var services = ((List<object?>)snapshot["tenants"]!).Cast<Node>().SelectMany(tenant => ((List<object?>)tenant["services"]!).Cast<Node>());
                    if (snapshot.GetValueOrDefault("m2m") is Node m2m) services = services.Concat(((List<object?>)m2m["services"]!).Cast<Node>());
                    var addresses = services.Where(item => Equals(item["id"], binding["instanceId"])).Select(item => HttpAddress.Origin(TrustedKeys.SecureEndpoint((string)item["hostname"]!).AbsoluteUri)).ToHashSet(StringComparer.Ordinal);
                    if (snapshot.GetValueOrDefault("serviceIdentity") is not Node identity || !Equals(identity.GetValueOrDefault("id"), binding["instanceId"]) || !addresses.SetEquals([address]))
                        throw new ArgumentException("Control plane did not bind this instance to the configured address");
                }
                catch (RequestException) { throw; }
                catch (Exception) when (!linked.IsCancellationRequested) { throw new RequestException(502, "Control-plane hostname confirmation failed"); }
            }
            value = await store.Write(new Node { ["installation"] = new Node(binding) { ["serviceUrl"] = address } }, linked.Token);
            return await Activate(value, linked.Token) ? (200, result)
                : (503, new Node { ["error"] = "Hostname confirmed; awaiting valid control-plane configuration", ["installed"] = true });
        }
        finally { gate.Release(); }
    }
    public async Task<(int Status, Node Body)> Install(object? body, CancellationToken cancellation = default)
    {
        Node request;
        try { request = (Node)Contracts.Parse("ServiceInstallRequestSchema", body)!; }
        catch (ValidationError) { throw new RequestException(400, "Invalid installation request"); }
        if (((string)request["cpUrl"]!).TrimEnd('/') != cp) throw new RequestException(403, "Installation control plane does not match configured trust");
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await gate.WaitAsync(linked.Token);
        try
        {
            if (closed || !started) throw new RequestException(503, "Installation is not available");
            Node binding;
            try
            {
                var claims = await Tokens.VerifyAsync((string)request["setupToken"]!, keys.ResolveAsync, cp, null, TokenPurpose.Setup, cancellationToken: linked.Token);
                binding = Binding(claims.Where(pair => new[] { "instanceId", "serviceUrl", "cpUrl", "cpJwksUri", "scope", "jti" }.Contains(pair.Key)).ToDictionary(pair => pair.Key, pair => pair.Value));
            }
            catch (Exception error) when (error is TokenException or ArgumentException or ValidationError)
            { throw new RequestException(401, "A valid setup token for this installation is required"); }
            var value = await store.Read(cancellation: linked.Token);
            var tenant = (binding.GetValueOrDefault("scope") as Node)?.GetValueOrDefault("tenantId") as string;
            if (tenant is not null && value.GetValueOrDefault("tenantLock") is string tenantLock && tenant != tenantLock) throw new RequestException(409, "Setup cannot change the installed tenant");
            if (value.ContainsKey("apiKey"))
            {
                Credentials(value, checkAddress: false);
                var previous = value.GetValueOrDefault("installation") as Node;
                if (previous is not null && HttpAddress.Origin((string)previous["serviceUrl"]!) != address)
                    throw new RequestException(409, "Confirm the configured hostname before reconfiguration");
                var expected = previous?.GetValueOrDefault("instanceId") ?? (Service.Snapshot()?.GetValueOrDefault("serviceIdentity") as Node)?.GetValueOrDefault("id");
                if (!Equals(expected, binding["instanceId"])) throw new RequestException(409, "Setup cannot replace the installed service instance");
                if (previous is not null && Equals(previous["jti"], binding["jti"])) return Response(sync is not null ? Service.Ready : await Activate(value, linked.Token));
            }
            Node credentials;
            try { credentials = await Redeem((string)request["setupToken"]!, linked.Token); }
            catch (Exception) when (!linked.IsCancellationRequested) { throw new RequestException(502, "Control-plane redemption failed"); }
            credentials["cpUrl"] = cp; credentials["installation"] = binding;
            if (tenant is not null) credentials["tenantLock"] = tenant;
            credentials["configEncryptionKey"] = value.GetValueOrDefault("configEncryptionKey") ?? ConfigCipher.GenerateKey();
            credentials["installedAt"] = DateTimeOffset.UtcNow.ToString("O", System.Globalization.CultureInfo.InvariantCulture);
            value = await store.Write(credentials, linked.Token); installed = true;
            return Response(await Activate(value, linked.Token));
        }
        finally { gate.Release(); }
    }
    private (int Status, Node Body) Response(bool ready) => ready
        ? (200, (Node)Contracts.Parse("ServiceInstallResponseSchema", new Node { ["ok"] = true, ["pluginId"] = Service.Manifest.PluginId, ["cpUrl"] = cp, ["manifestVersion"] = Service.Manifest.Version })!)
        : (503, new Node { ["error"] = "Installed; awaiting valid control-plane configuration", ["installed"] = true, ["pluginId"] = Service.Manifest.PluginId });

    public async ValueTask DisposeAsync()
    {
        closed = true; Service.SuspendSync(); shutdown.Cancel();
        await gate.WaitAsync();
        try
        {
            if (sync is not null) await sync.DisposeAsync();
            await keys.DisposeAsync(); client.Dispose();
        }
        finally { gate.Release(); }
    }
}
