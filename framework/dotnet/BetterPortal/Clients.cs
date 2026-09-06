using AnyVali;
using System.Text;
using System.Text.Json;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class ClientException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed record ClientOperationSchemas(IReadOnlyDictionary<string, Node> Inputs, IReadOnlySet<string> RequiredInputs, Node Output);

/// <summary>A dependency's exported BP contract. Inputs and outputs use its AnyVali documents.</summary>
public sealed class ClientContract
{
    internal Node Document { get; }
    public string PluginId => (string)((Node)Document["manifest"]!)["pluginId"]!;
    private sealed record Entry(Node View, Node Operation, Schema Keys, Dictionary<string, Schema> Fields, Schema? Output);
    private readonly Dictionary<string, Entry> operations = new(StringComparer.Ordinal);
    public ClientContract(object value)
    {
        Document = (Node)Contracts.Parse("BpSchemaOutputSchema", value)!;
        foreach (var view in Items((Node)Document["manifest"]!, "views"))
        {
            foreach (var path in new[] { (string)view["path"]! }.Concat(((List<object?>)view["pathVariants"]!).Cast<string>())) _ = Route.Segments(path);
            foreach (var operation in Items(view, "operations"))
            {
                var fields = new Node { ["params"] = view["paramsSchema"], ["query"] = operation["querySchema"], ["headers"] = operation["headersSchema"] };
                var body = (Node)operation["bodySchema"]!;
                if (body.Count == 0)
                {
                    body = Contracts.Document("JsonObjectSchema");
                    body["root"] = new Node { ["kind"] = "optional", ["inner"] = body["root"] };
                }
                fields["body"] = body;
                var schemas = new Dictionary<string, Schema>(); var keys = new Dictionary<string, Node>();
                foreach (var (name, field) in fields)
                {
                    var document = (Node)Json.Read(Json.Write(field is Node { Count: > 0 } ? field : Contracts.Document("JsonObjectSchema")))!;
                    if (!document.ContainsKey("root")) throw new ArgumentException("Dependency schemas must be AnyVali documents");
                    if (name != "body") ((Node)document["root"]!).TryAdd("default", new Node());
                    // Separate wrappers preserve independent definitions and omitted-versus-null fields.
                    schemas[name] = Contracts.Import(Contracts.ObjectDocument(new Dictionary<string, Node> { [name] = document }, "reject"));
                    var optional = Contracts.Document("JsonValueSchema");
                    optional["root"] = new Node { ["kind"] = "optional", ["inner"] = optional["root"] }; keys[name] = optional;
                }
                var entry = new Entry(view, operation, Contracts.Import(Contracts.ObjectDocument(keys, "reject")), schemas,
                    operation["jsonResponseSchema"] is Node { Count: > 0 } response ? Contracts.Import(response) : null);
                if (!operations.TryAdd((string)operation["operationId"]!, entry)) throw new ArgumentException("Duplicate dependency operation ID");
            }
        }
    }
    internal static IEnumerable<Node> Items(Node node, string key) => ((List<object?>)node.GetValueOrDefault(key, new List<object?>())!).Cast<Node>();
    public Generated.BpSchemaOutput Schema() => Contracts.Parse<Generated.BpSchemaOutput>("BpSchemaOutputSchema", Document);
    /// <summary>Owned documents for native authoring. AnyVali determines input presence.</summary>
    public IReadOnlyDictionary<string, ClientOperationSchemas> JsonOperations()
    {
        var result = new Dictionary<string, ClientOperationSchemas>(StringComparer.Ordinal);
        foreach (var (identifier, entry) in operations)
        {
            if (entry.Output is null) continue;
            var inputs = new Dictionary<string, Node>();
            foreach (var (name, field) in entry.Fields)
            {
                var document = (Node)Json.Read(Json.Write(V.Export(field)))!;
                document["root"] = ((Node)((Node)document["root"]!)["properties"]!)[name]; inputs[name] = document;
            }
            result[identifier] = new(inputs, entry.Fields.Where(pair => !pair.Value.SafeParse(new Node()).Success).Select(pair => pair.Key).ToHashSet(StringComparer.Ordinal),
                (Node)Json.Read(Json.Write(V.Export(entry.Output)))!);
        }
        return result;
    }
    internal (Node View, Node Operation, Node Values, string Path, string Variant, Schema Output) Prepare(string identifier, object? values)
    {
        if (!operations.TryGetValue(identifier, out var entry)) throw new ArgumentException("Unknown dependency operation");
        if (entry.Output is null) throw new ArgumentException("Dependency operation does not declare JSON output");
        var source = (Node)Contracts.Parse(entry.Keys, values ?? new Node())!; var parsed = new Node();
        foreach (var (name, schema) in entry.Fields)
            foreach (var pair in (Node)Contracts.Parse(schema, source.TryGetValue(name, out var value) ? new Node { [name] = value } : new Node())!) parsed.Add(pair.Key, pair.Value);
        if (new[] { "params", "query", "headers" }.Any(name => parsed.GetValueOrDefault(name) is not Node))
            throw new ArgumentException("Dependency params, query and headers must be objects");
        var selected = new[] { (string)entry.View["path"]! }.Concat(((List<object?>)entry.View["pathVariants"]!).Cast<string>())
            .Select(variant => (Variant: variant, Path: Urls.Fill(variant, (Node)parsed["params"]!))).FirstOrDefault(value => value.Path is not null);
        if (selected.Path is null) throw new ArgumentException("Dependency route parameters do not select a path");
        return (entry.View, entry.Operation, parsed, selected.Path, selected.Variant, entry.Output);
    }
}

/// <summary>One connection pool per service; BP owns credentials, destinations and limits.</summary>
public sealed class ServiceClients : IAsyncDisposable
{
    internal Service Service { get; }
    private readonly Lazy<HttpClient> http = new(() => new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, UseCookies = false }) { Timeout = Timeout.InfiniteTimeSpan });
    private readonly object gate = new();
    private readonly HashSet<TaskCompletionSource> pending = [];
    private readonly CancellationTokenSource shutdown = new();
    private bool closed;
    internal ServiceClients(Service service) => Service = service;
    /// <summary>Background callers may use declared service-mode dependencies only.</summary>
    public RequestClients Scope(string tenantId, string appId) => new(this, tenantId, appId);
    internal async Task<object?> Send(Client client, string identifier, object? values, CancellationToken cancellation)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        lock (gate) { if (closed) throw new ClientException(503, "Dependency client is closed"); pending.Add(done); }
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation, Service.Stopping, client.Context.Cancellation, shutdown.Token);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        try
        {
            var (view, operation, parsed, path, variant, output) = client.Contract.Prepare(identifier, values);
            var (state, scope) = client.Context.Current();
            var (origin, headers) = client.Authorize(state, scope, view, operation, variant);
            var custom = ((Node)parsed["headers"]!).Select(pair => new KeyValuePair<string, string>(pair.Key,
                pair.Value is string or bool or sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal
                    ? Urls.Scalar(pair.Value) : throw new ArgumentException("Dependency header values must be strings, numbers or booleans"))).ToArray();
            _ = new RawResponse(headers: custom);
            string[] forbidden = ["authorization", "cookie", "set-cookie", "host", "origin", "referer", "accept", "accept-encoding", "content-type", "content-encoding"];
            if (custom.Select(pair => pair.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count() != custom.Length
                || custom.Any(pair => forbidden.Contains(pair.Key, StringComparer.OrdinalIgnoreCase) || pair.Key.StartsWith("x-bp-", StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("Dependency headers cannot replace framework credentials or routing");
            foreach (var (name, value) in custom) headers[name] = value;
            var pairs = new List<KeyValuePair<string, string>>();
            foreach (var (name, value) in (Node)parsed["query"]!)
                foreach (var item in value is List<object?> array ? array : [value])
                    if (item is not null) pairs.Add(new(name, Urls.Scalar(item)));
            using var query = new FormUrlEncodedContent(pairs);
            var address = origin + path + (pairs.Count > 0 ? "?" + await query.ReadAsStringAsync(timeout.Token) : "");
            var data = parsed.TryGetValue("body", out var body) ? Encoding.UTF8.GetBytes(Json.Write(body)) : null;
            if (address.Length > 8192 || data?.Length > 16 * 1024 * 1024) throw new ArgumentException("Dependency request exceeds its size limit");
            var method = (string)operation["method"]!;
            if (data is not null && method is "GET" or "HEAD") throw new ArgumentException("Dependency GET/HEAD requests cannot carry a body");
            using var request = new HttpRequestMessage(new HttpMethod(method), address);
            if (data is not null) { request.Content = new ByteArrayContent(data); request.Content.Headers.ContentType = new("application/json"); }
            headers["accept"] = "application/json";
            headers["accept-encoding"] = "identity";
            foreach (var (name, value) in headers)
                if (!request.Headers.TryAddWithoutValidation(name, value)) throw new ArgumentException("Unsupported dependency request header");
            try
            {
                using var response = await http.Value.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                var status = (int)response.StatusCode;
                if (!response.IsSuccessStatusCode) throw new ClientException(status, "Dependency returned an unsuccessful status");
                if (status is not (204 or 205) && response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() != "application/json")
                    throw new ClientException(502, "Dependency did not return JSON");
                if (response.Content.Headers.ContentEncoding.Any(value => !value.Equals("identity", StringComparison.OrdinalIgnoreCase)))
                    throw new ClientException(502, "Dependency returned unsupported content encoding");
                await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
                using var buffer = new MemoryStream(); var chunk = new byte[8192]; int count;
                while ((count = await stream.ReadAsync(chunk, timeout.Token)) != 0)
                {
                    if (buffer.Length + count > 16 * 1024 * 1024) throw new ClientException(502, "Dependency response exceeds its size limit");
                    buffer.Write(chunk, 0, count);
                }
                client.Context.Current(state);
                return Contracts.Parse(output, status is 204 or 205 && buffer.Length == 0 ? null : Json.Read(new UTF8Encoding(false, true).GetString(buffer.ToArray())));
            }
            catch (ClientException) { throw; }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested || Service.Stopping.IsCancellationRequested || client.Context.Cancellation.IsCancellationRequested || shutdown.IsCancellationRequested) { throw; }
            catch (Exception) { throw new ClientException(502, "Dependency request or response validation failed"); }
        }
        finally { lock (gate) pending.Remove(done); done.TrySetResult(); }
    }
    public async ValueTask DisposeAsync()
    {
        Task[] tasks; lock (gate) { if (closed) return; closed = true; tasks = pending.Select(item => item.Task).ToArray(); }
        await shutdown.CancelAsync();
        await Task.WhenAll(tasks);
        if (http.IsValueCreated) http.Value.Dispose();
    }
}

/// <summary>Opaque request binding. User credentials never enter render contexts.</summary>
public sealed class RequestClients
{
    internal ServiceClients Owner { get; }
    private readonly string tenant, app;
    private readonly Service.SnapshotState? revision;
    internal string? UserToken { get; }
    internal CancellationToken Cancellation { get; }
    internal RequestClients(ServiceClients owner, string tenant, string app, Service.SnapshotState? revision = null, string? userToken = null, CancellationToken cancellation = default)
    { Owner = owner; this.tenant = tenant; this.app = app; this.revision = revision; UserToken = userToken; Cancellation = cancellation; }
    internal (Service.SnapshotState State, ScopedContext Scope) Current(Service.SnapshotState? expected = null) => Owner.Service.ClientState(tenant, app, revision, expected);
    public Client User(ClientContract contract, string? serviceId = null) => revision is null
        ? throw new ArgumentException("User clients require a service request context") : new(this, contract, serviceId ?? contract.PluginId);
    public Client M2m(string requestId, ClientContract contract) => new(this, contract, requestId: requestId);
}

public sealed class Client
{
    internal RequestClients Context { get; }
    internal ClientContract Contract { get; }
    private readonly string? serviceId, requestId;
    internal Client(RequestClients context, ClientContract contract, string? serviceId = null, string? requestId = null)
    { Context = context; Contract = contract; this.serviceId = serviceId; this.requestId = requestId; }
    public Task<object?> RequestAsync(string operationId, object? values = null, CancellationToken cancellation = default) => Context.Owner.Send(this, operationId, values, cancellation);
    public async Task<T> RequestAsync<T>(string operationId, object? values = null, CancellationToken cancellation = default)
        => JsonSerializer.Deserialize<T>(Json.Write(await RequestAsync(operationId, values, cancellation)), Json.Options)!;
    private static IEnumerable<Node> Items(Node node, string key) => ClientContract.Items(node, key);
    internal (string Origin, Dictionary<string, string> Headers) Authorize(Service.SnapshotState state, ScopedContext scope, Node view, Node operation, string path)
    {
        var service = Context.Owner.Service; var auth = (Node)operation["auth"]!;
        var callers = (List<object?>)auth["callers"]!; var method = (string)operation["method"]!;
        Node target; var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (requestId is null)
        {
            var reference = service.Registry.Dependencies.GetValueOrDefault(serviceId!, serviceId!);
            var targets = Items(scope.Tenant, "services").Where(item => item["enabled"] is true && (Equals(item["id"], reference) || Equals(item.GetValueOrDefault("serviceId"), reference)) && Equals(item.GetValueOrDefault("serviceId"), Contract.PluginId)).ToArray();
            if (targets.Length != 1) throw new ClientException(403, "Dependency service is unavailable or ambiguous");
            target = targets[0];
            if (!callers.Contains("user")) throw new ClientException(403, "Dependency operation does not allow user calls");
            var app = new Node(scope.App) { ["routes"] = scope.App.GetValueOrDefault("appRoutes", scope.App["routes"]) };
            var access = new AppAccess(new(scope.Tenant, app, scope.OriginPolicy), [(string)target["id"]!]);
            if (!access.AllowsOperation((string)view["viewId"]!, (string)operation["operationId"]!, method, path, serviceId: (string)target["id"]!)) throw new ClientException(403, "Dependency operation is not mounted");
            headers["origin"] = ((List<object?>)scope.App["hostnames"]!).Cast<string>().SelectMany(HttpAddress.Origins).FirstOrDefault()
                ?? throw new ClientException(503, "Dependency app origin is unavailable");
            if (Context.UserToken is { } user) headers["authorization"] = "Bearer " + user;
            else if (auth["required"] is true) throw new ClientException(401, "Dependency requires a BP user");
        }
        else
        {
            var manifest = (Node)Contracts.Parse("PluginManifestSchema", service.Manifest)!;
            var requests = Items(manifest, "m2mRequests").Where(item => Equals(item["id"], requestId)).ToArray();
            if (requests.Length != 1) throw new ClientException(403, "Dependency request is not uniquely declared");
            var request = requests[0]; var mode = (string)request["mode"]!;
            if (!callers.Contains(mode) || !((List<object?>)request["methods"]!).Contains(method)) throw new ClientException(403, "Dependency caller mode or method is not allowed");
            var policy = (Node)state.Config.GetValueOrDefault("m2m", new Node())!;
            var bindings = Items(policy, "bindings").Where(item => item["enabled"] is true && Equals(item["requestId"], requestId)
                && ((List<object?>)policy["localServiceIds"]!).Contains(item["sourceServiceId"]) && Equals(item["tenantId"], scope.TenantId)
                && Equals(item.GetValueOrDefault("appId", scope.AppId), scope.AppId) && Equals(item["mode"], mode)
                && Equals(item["contractId"], request["contractId"]) && Equals(item["targetViewId"], view["viewId"])).ToArray();
            if (bindings.Length != 1) throw new ClientException(403, "Dependency binding is unavailable or ambiguous");
            var binding = bindings[0];
            var contracts = Items((Node)Contract.Document["manifest"]!, "apiContracts").Where(item => Equals(item["id"], binding["contractId"]) && Equals(item["viewId"], view["viewId"])).ToArray();
            if (contracts.Length != 1 || !Items(operation, "apiContracts").Any(item => Equals(item["id"], binding["contractId"])) || !((List<object?>)contracts[0]["methods"]!).Contains(method) || !((List<object?>)contracts[0]["modes"]!).Contains(mode))
                throw new ClientException(403, "Dependency contract does not cover the operation");
            if (!((List<object?>)request["requiredCapabilities"]!).ToHashSet().IsSubsetOf((List<object?>)contracts[0]["capabilities"]!))
                throw new ClientException(403, "Dependency contract capabilities are insufficient");
            var required = ((List<object?>)request["permissions"]!).Concat((List<object?>)contracts[0]["permissions"]!)
                .Concat(Items(auth, "permissions").SelectMany(item => (List<object?>)item["permissions"]!)).ToHashSet();
            if (!Items(policy, "grants").Any(item => item["enabled"] is true && Equals(item["bindingId"], binding["id"]) && Equals(item["tenantId"], scope.TenantId)
                && Equals(item.GetValueOrDefault("appId", scope.AppId), scope.AppId) && ((List<object?>)item["methods"]!).Contains(method) && required.IsSubsetOf((List<object?>)item["permissions"]!)))
                throw new ClientException(403, "Dependency grant is unavailable or insufficient");
            var targets = Items(policy, "services").Where(item => Equals(item["id"], binding["targetServiceId"]) && Equals(item.GetValueOrDefault("serviceId"), Contract.PluginId)).ToArray();
            if (targets.Length != 1) throw new ClientException(403, "Dependency target is unavailable or ambiguous");
            target = targets[0]; var key = service.SigningKey; var identity = (Node)state.Config.GetValueOrDefault("serviceIdentity", new Node())!;
            static string Pem(string value) => string.Concat(value.Where(c => !char.IsWhiteSpace(c)));
            if (key is null || !Equals(identity.GetValueOrDefault("keyId"), key.Kid) || Pem((string)identity.GetValueOrDefault("publicKeyPem", "")!) != Pem(key.PublicKeyPem))
                throw new ClientException(503, "Dependency signing identity is not registered");
            headers["x-bp-service-id"] = (string)binding["sourceServiceId"]!; headers["x-bp-tenant-id"] = scope.TenantId; headers["x-bp-app-id"] = scope.AppId;
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var token = Tokens.Sign(key, new Node { ["iss"] = binding["sourceServiceId"], ["sub"] = binding["sourceServiceId"], ["aud"] = target["id"],
                ["tenantId"] = scope.TenantId, ["appId"] = scope.AppId, ["bindingId"] = binding["id"], ["iat"] = now, ["exp"] = now + 60, ["jti"] = Guid.CreateVersion7().ToString(), ["tokenType"] = "service" }, TokenPurpose.Service);
            if (mode == "delegated")
            {
                if (Context.UserToken is not { } user) throw new ClientException(401, "Delegated dependency calls require a BP user");
                headers["authorization"] = "Bearer " + user; headers["x-bp-service-authorization"] = "Bearer " + token;
            }
            else headers["authorization"] = "Bearer " + token;
        }
        return (HttpAddress.Origin(TrustedKeys.SecureEndpoint((string)target["hostname"]!).AbsoluteUri), headers);
    }
}

public sealed partial class Service
{
    internal KeyPair? SigningKey { get; set; }
    private readonly Lazy<ServiceClients> clients;
    public ServiceClients Clients => clients.Value;
    internal (SnapshotState State, ScopedContext Scope) ClientState(string tenant, string app, SnapshotState? revision, SnapshotState? expected)
    {
        var current = state;
        if (!Ready || current is null || revision is not null && !ReferenceEquals(current, revision) || expected is not null && !ReferenceEquals(current, expected))
            throw new ClientException(503, "Dependency configuration is unavailable or changed");
        if (installedTenantLock is not null && tenant != installedTenantLock) throw new ClientException(403, "Dependency tenant is not allowed");
        return (current, current.Snapshot.ById(tenant, app) ?? throw new ClientException(403, "Dependency tenant/app is unavailable"));
    }
}
