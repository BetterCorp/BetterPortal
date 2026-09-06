using AnyVali;
using System.Text.Json.Nodes;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

/// <summary>Settings field policy; native AnyVali owns values, defaults and sensitive traversal.</summary>
public sealed class SettingsSchema
{
    private const string Redacted = "__redacted__", Native = "encrypted:";
    private static readonly string[] Prefixes = ["enc:aes256gcm:", "enc:aes256gcm2:", "enc:aes256gcm3:"];
    private static readonly object Missing = new();
    private readonly List<Node> descriptors;
    private readonly Dictionary<string, Schema> full = [], partial = [];
    private readonly Dictionary<string, HashSet<string>> names = [], secrets = new() { ["tenant"] = [], ["app"] = [] };

    public SettingsSchema(IEnumerable<Generated.ConfigSchemaDescriptorInput> descriptors)
    {
        this.descriptors = descriptors.Select(item => (Node)Contracts.Parse("ConfigSchemaDescriptorSchema", item)!).ToList();
        var documents = new Dictionary<string, Dictionary<string, Node>> { ["tenant"] = [], ["app"] = [] };
        var required = new Dictionary<string, List<object?>> { ["tenant"] = [], ["app"] = [] };
        var seen = new HashSet<string>();
        foreach (var descriptor in this.descriptors)
        {
            if (!seen.Add((string)descriptor["id"]!)) throw new ArgumentException("Duplicate settings descriptor");
            var document = Operation.Export(Contracts.Import(Json.Write(descriptor["jsonSchema"])));
            Supported(document);
            var root = (Node)document["root"]!;
            if (!Equals(root["kind"], "object") || Sensitive(root)) throw new ArgumentException("Settings descriptors require an AnyVali object with individual fields");
            var properties = (Node)root["properties"]!;
            var fields = ((List<object?>)descriptor["fields"]!).Cast<Node>().ToArray();
            var fieldNames = fields.Select(field => (string)field["key"]!).ToHashSet();
            if (fieldNames.Count != fields.Length || !fieldNames.SetEquals(properties.Keys)) throw new ArgumentException("Settings descriptor fields must match its AnyVali properties");
            foreach (var field in fields)
            {
                var scope = (string)field["scope"]!; var key = (string)field["key"]!;
                if (documents[scope].ContainsKey(key)) throw new ArgumentException("Duplicate settings field in one scope");
                var child = (Node)Copy(document)!; child["root"] = Copy(properties[key]);
                var node = (Node)child["root"]!;
                if (field.TryGetValue("defaultValue", out var value) && (!node.ContainsKey("default") || !JsonNode.DeepEquals(
                    JsonNode.Parse(Json.Write(value)), JsonNode.Parse(Json.Write(node["default"]))))) throw new ArgumentException("Descriptor defaultValue must match the AnyVali field default");
                if (Equals(field["visibility"], "secret"))
                {
                    // BP visibility annotates a native wrapper, including recursive refs.
                    child["root"] = node = new Node { ["kind"] = "optional", ["inner"] = node, ["metadata"] = new Node { ["sensitive"] = true } };
                }
                while (true)
                {
                    if (Sensitive(node)) secrets[scope].Add(key);
                    if (node["kind"] is not ("optional" or "nullable")) break;
                    node = (Node)node.GetValueOrDefault("inner", node.GetValueOrDefault("schema"))!;
                }
                documents[scope][key] = child;
                if (((List<object?>)root.GetValueOrDefault("required", new List<object?>())!).Contains(key)) required[scope].Add(key);
            }
        }
        foreach (var (scope, properties) in documents)
        {
            names[scope] = properties.Keys.ToHashSet();
            // BP checks top-level names below. An allow container preserves each
            // nested schema's own unknown-key policy instead of overriding it.
            var document = Contracts.ObjectDocument(properties, "allow");
            var root = (Node)document["root"]!; root["required"] = required[scope];
            full[scope] = Contracts.Import(document);
            var fields = (Node)root["properties"]!;
            foreach (var key in fields.Keys.ToArray())
            {
                var node = (Node)fields[key]!;
                while (true)
                {
                    node.Remove("default");
                    if (node["kind"] is not ("optional" or "nullable")) break;
                    node = (Node)node.GetValueOrDefault("inner", node.GetValueOrDefault("schema"))!;
                }
                fields[key] = new Node { ["kind"] = "optional", ["inner"] = fields[key] };
            }
            root["required"] = new List<object?>();
            partial[scope] = Contracts.Import(document);
        }
    }
    private static bool Sensitive(Node node) => node.GetValueOrDefault("metadata") is Node meta && meta.GetValueOrDefault("sensitive") is true;
    private static void Supported(Node document)
    {
        // AnyVali #128: refs bypass their own sensitive pipeline. Reject unsafe
        // declarations (including unused definitions); this does not validate data.
        var pending = new Stack<Node>(((Node)document.GetValueOrDefault("definitions", new Node())!).Values.Cast<Node>());
        pending.Push((Node)document["root"]!);
        while (pending.TryPop(out var node))
        {
            if (Equals(node["kind"], "ref") && Sensitive(node)) throw new ArgumentException("AnyVali #128: sensitive metadata requires a wrapper or definition, not a ref node");
            foreach (var child in ((Node)node.GetValueOrDefault("properties", new Node())!).Values.Cast<Node>()) pending.Push(child);
            foreach (var key in new[] { "items", "values", "valueSchema", "inner", "schema", "schemas", "variants", "allOf" })
                if (node.GetValueOrDefault(key) is Node child) pending.Push(child);
                else if (node.GetValueOrDefault(key) is List<object?> children) foreach (var item in children.Cast<Node>()) pending.Push(item);
        }
    }
    private static object? Copy(object? value) => Json.Read(Json.Write(value));
    public IReadOnlyList<Generated.ConfigSchemaDescriptor> Descriptors() => descriptors.Select(value => Contracts.Parse<Generated.ConfigSchemaDescriptor>("ConfigSchemaDescriptorSchema", value)).ToArray();
    private Node Check(string scope, object? values)
    {
        if (!names.TryGetValue(scope, out var allowed) || Copy(values) is not Node result || result.Keys.Any(key => !allowed.Contains(key))) throw new ArgumentException("Unknown settings field or scope");
        return result;
    }
    public Node Values(string scope, object? values, bool partial = true)
    {
        var data = Check(scope, values);
        return (Node)Contracts.Parse((partial ? this.partial : full)[scope], data)!;
    }

    public Node Encode(string scope, object? values, ConfigCipher cipher)
    {
        var data = Check(scope, values);
        var paths = new HashSet<string>();
        var encrypted = (Node)V.Encrypt(partial[scope], data, (path, value) => { paths.Add(Json.Write(path)); return Native + cipher.Encrypt(value); })!;
        // Node's legacy marker is used only for top-level sensitive fields.
        // Nested sensitive nodes retain AnyVali's marker without rewriting data.
        foreach (var key in secrets[scope])
        {
            var transformed = paths.Contains(Json.Write(new[] { key }));
            if (encrypted.GetValueOrDefault(key) is not null && !transformed) throw new ConfigEncryptionException("Sensitive setting was not encrypted");
            if (transformed) encrypted[key] = ((string)encrypted[key]!)[Native.Length..];
        }
        return encrypted;
    }
    public Node Decode(string scope, object? values, ConfigCipher cipher)
    {
        var data = Check(scope, values);
        foreach (var key in secrets[scope]) if (data.GetValueOrDefault(key) is string text && Prefixes.Any(prefix => text.StartsWith(prefix, StringComparison.Ordinal))) data[key] = Native + text;
        return (Node)V.Decrypt(partial[scope], data, (_, value) => value is string text && text.StartsWith(Native, StringComparison.Ordinal)
            ? cipher.Decrypt(text[Native.Length..]) : throw new ConfigEncryptionException("Invalid encrypted setting"))!;
    }
    private (Node Value, Dictionary<string, object[]> Paths) Redaction(string scope, object? values)
    {
        var data = Check(scope, values);
        var markers = new Dictionary<string, (object[] Path, string Marker)>();
        var result = (Node)V.Encrypt(partial[scope], data, (path, _) =>
        {
            var parts = path.ToArray(); var marker = Native + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            markers[Json.Write(parts)] = (parts, marker);
            return marker;
        })!;
        // Rejected union branches may invoke callbacks. Only surviving markers
        // identify sensitive values in the selected branch.
        var paths = markers.Where(pair => Equals(At(result, pair.Value.Path), pair.Value.Marker)).ToDictionary(pair => pair.Key, pair => pair.Value.Path);
        // Native nullable values skip transforms; BP redacts present declared
        // secret fields even when their value is null.
        foreach (var key in secrets[scope]) if (result.ContainsKey(key)) paths[Json.Write(new[] { key })] = [key];
        foreach (var path in paths.Values) Put(result, path, Redacted);
        return (result, paths);
    }
    public Node Redact(string scope, object? values) => Redaction(scope, values).Value;
    public Node Merge(string scope, object? current, object? values, IEnumerable<string>? clearKeys = null)
    {
        var changes = Check(scope, values);
        var result = Values(scope, current);
        foreach (var key in clearKeys ?? [])
        {
            if (!names[scope].Contains(key)) throw new ArgumentException("Unknown settings field or scope");
            result.Remove(key);
        }
        var previous = (Node)Copy(result)!; var oldPaths = Redaction(scope, previous).Paths;
        foreach (var (key, value) in changes) result[key] = value;
        var restored = new HashSet<string>();
        foreach (var (id, path) in oldPaths)
            if (Equals(At(result, path), Redacted)) { Put(result, path, Copy(At(previous, path))); restored.Add(id); }
        result = Values(scope, result);
        var paths = Redaction(scope, result).Paths;
        if (!restored.IsSubsetOf(paths.Keys) || paths.Values.Any(path => Equals(At(result, path), Redacted))) throw new ArgumentException("Redaction placeholder has no matching stored secret");
        return result;
    }
    public Node Effective(object? tenant, object? app)
    {
        var values = Values("tenant", tenant, partial: false);
        var changes = Check("app", app);
        var inherited = values.Where(pair => names["app"].Contains(pair.Key)).ToDictionary(pair => pair.Key, pair => pair.Value);
        foreach (var (key, value) in changes) inherited[key] = value;
        foreach (var (key, value) in Values("app", inherited, partial: false)) values[key] = value;
        return values;
    }
    private static object? At(object? value, object[] path)
    {
        foreach (var part in path)
        {
            if (value is Node mapping && part is string key && mapping.TryGetValue(key, out var field)) value = field;
            else if (value is List<object?> list && part is int or long && Convert.ToInt64(part) >= 0 && Convert.ToInt64(part) < list.Count) value = list[Convert.ToInt32(part)];
            else return Missing;
        }
        return value;
    }
    private static void Put(Node value, object[] path, object? replacement)
    {
        var parent = At(value, path[..^1]);
        if (parent is Node mapping) mapping[(string)path[^1]] = replacement;
        else ((List<object?>)parent!)[Convert.ToInt32(path[^1])] = replacement;
    }
}

/// <summary>One writer's encrypted tenant/app state. Service owns credential/scope authorization.</summary>
public sealed class ServiceSettings : IAsyncDisposable
{
    private static readonly System.Text.UTF8Encoding Utf8 = new(false, true);
    public SettingsSchema Schema { get; }
    private readonly ConfigCipher cipher;
    private readonly IStateStore? store;
    private readonly SemaphoreSlim gate = new(1);
    private readonly CancellationTokenSource shutdown = new();
    private volatile Node state = Empty();
    private volatile bool loaded, closed;
    public bool Ready => loaded && !closed;
    private static Node Empty() => new() { ["tenants"] = new Node() };
    public ServiceSettings(SettingsSchema schema, ConfigCipher cipher, IStateStore? store = null)
    { Schema = schema; this.cipher = cipher; this.store = store; }
    private void Open(bool requireLoaded = true)
    {
        if (closed || requireLoaded && !loaded) throw new InvalidOperationException("Settings are closed or not initialized");
    }
    private static void Identity(string tenantId, string? appId = null)
    {
        Contracts.Parse(Contracts.Get("ServiceConfigWriteRequestSchema", "tenantId"), tenantId);
        if (appId is not null) Contracts.Parse(Contracts.Get("ServiceConfigWriteRequestSchema", "appId"), appId);
    }
    private Node Bucket(Node state, string tenantId)
    {
        var bucket = (Node)((Node)state["tenants"]!).GetValueOrDefault(tenantId, new Node { ["tenant"] = new Node(), ["app"] = new Node() })!;
        return new()
        {
            ["tenant"] = Schema.Decode("tenant", bucket["tenant"], cipher),
            ["app"] = ((Node)bucket["app"]!).ToDictionary(pair => pair.Key, pair => (object?)Schema.Decode("app", pair.Value, cipher))
        };
    }
    /// <summary>Validate the entire encrypted cache before publication. Legacy ownership must be explicit.</summary>
    public async Task<bool> Initialize(string? legacyTenantId = null, CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await gate.WaitAsync(linked.Token);
        try
        {
            Open(requireLoaded: false);
            if (loaded) return false;
            var data = store is null ? null : await store.Load(linked.Token);
            if (data?.Length > 16 * 1024 * 1024) throw new ArgumentException("Settings exceed 16 MiB");
            var value = data is null ? Empty() : Json.Read(Utf8.GetString(data));
            if (value is Node legacy && !legacy.ContainsKey("tenants") && legacy.Keys.Any(key => key is "tenant" or "app") && legacy.Keys.All(key => key is "tenant" or "app"))
                value = new Node { ["tenants"] = new Node(), ["legacy"] = legacy };
            var next = (Node)Contracts.Parse("PersistedServiceConfigStateSchema", value)!;
            var tenants = (Node)next["tenants"]!;
            var migrated = next.ContainsKey("legacy");
            if (migrated)
            {
                if (legacyTenantId is null) throw new ArgumentException("Legacy settings require an explicit tenant owner");
                Identity(legacyTenantId);
                if (tenants.ContainsKey(legacyTenantId)) throw new ArgumentException("Legacy settings conflict with an existing tenant");
                tenants[legacyTenantId] = next["legacy"]; next.Remove("legacy");
            }
            foreach (var (tenantId, item) in tenants)
            {
                Identity(tenantId);
                foreach (var appId in ((Node)((Node)item!)["app"]!).Keys) Identity(tenantId, appId);
                Bucket(next, tenantId);
            }
            if (migrated) await Save(next, linked.Token);
            else { Open(requireLoaded: false); linked.Token.ThrowIfCancellationRequested(); }
            state = next; loaded = true;
            return data is not null;
        }
        finally { gate.Release(); }
    }
    private async ValueTask Save(Node next, CancellationToken cancellation)
    {
        var data = Utf8.GetBytes(Json.Write(next));
        if (data.Length > 16 * 1024 * 1024) throw new ArgumentException("Settings exceed 16 MiB");
        if (store is not null) await store.Save(data, cancellation);
        else cancellation.ThrowIfCancellationRequested();
    }
    public Node Read(string tenantId) { Open(); Identity(tenantId); return Bucket(state, tenantId); }
    public Node Values(string tenantId, string? appId = null, bool redacted = false)
    {
        Identity(tenantId, appId);
        var bucket = Read(tenantId);
        var values = appId is null ? (Node)bucket["tenant"]! : (Node)((Node)bucket["app"]!).GetValueOrDefault(appId, new Node())!;
        return redacted ? Schema.Redact(appId is null ? "tenant" : "app", values) : values;
    }
    public Node Effective(string tenantId, string appId)
    {
        Identity(tenantId, appId);
        var bucket = Read(tenantId);
        return Schema.Effective(bucket["tenant"], ((Node)bucket["app"]!).GetValueOrDefault(appId, new Node()));
    }
    public async Task<Node> Write(string tenantId, object values, string? appId = null, IEnumerable<string>? clearKeys = null, CancellationToken cancellation = default)
    {
        var body = new Node { ["tenantId"] = tenantId, ["values"] = values, ["clearKeys"] = (clearKeys ?? []).ToArray() };
        if (appId is not null) body["appId"] = appId;
        var request = (Node)Contracts.Parse("ServiceConfigWriteRequestSchema", body)!;
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await gate.WaitAsync(linked.Token);
        try
        {
            Open();
            var scope = appId is null ? "tenant" : "app";
            var merged = Schema.Merge(scope, Values(tenantId, appId), request["values"], ((List<object?>)request["clearKeys"]!).Cast<string>());
            var encrypted = Schema.Encode(scope, merged, cipher);
            var next = (Node)Json.Read(Json.Write(state))!;
            var tenants = (Node)next["tenants"]!;
            if (!tenants.ContainsKey(tenantId)) tenants[tenantId] = new Node { ["tenant"] = new Node(), ["app"] = new Node() };
            var bucket = (Node)tenants[tenantId]!;
            if (appId is null) bucket["tenant"] = encrypted;
            else ((Node)bucket["app"]!)[appId] = encrypted;
            await Save(next, linked.Token);
            // No suspension between durable commit and in-memory publication.
            state = next;
            return (Node)Json.Read(Json.Write(merged))!;
        }
        finally { gate.Release(); }
    }
    public async ValueTask DisposeAsync()
    {
        closed = true;
        await shutdown.CancelAsync();
        await gate.WaitAsync();
        try { state = Empty(); }
        finally { gate.Release(); }
    }
}
