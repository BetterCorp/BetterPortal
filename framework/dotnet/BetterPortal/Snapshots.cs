using System.Collections.Frozen;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed partial class Service
{
    private sealed class SnapshotState(ScopedConfig snapshot, Node config, Node preview, Node previewValues, (string, string)? previewScope,
        FrozenDictionary<(string Issuer, string Uri), JwksClient> keys)
    {
        public ScopedConfig Snapshot { get; } = snapshot;
        public Node Config { get; } = config;
        public Node Preview { get; } = preview;
        public Node PreviewValues { get; } = previewValues;
        public (string, string)? PreviewScope { get; } = previewScope;
        public FrozenDictionary<(string Issuer, string Uri), JwksClient> Keys { get; } = keys;
        public Task Close() => Task.WhenAll(Keys.Values.Select(client => client.DisposeAsync().AsTask()));
    }
    private volatile SnapshotState? state;
    private readonly IStateStore? store;
    private readonly string? previewKey;
    private readonly bool managed;
    private volatile bool submitted;
    private readonly SemaphoreSlim updates = new(1, 1);
    private readonly CancellationTokenSource shutdown = new();
    private readonly HashSet<Task> cleanup = [];
    private SnapshotState Build(ScopedConfig snapshot)
    {
        var config = snapshot.Document(); var preview = new Node(); var previewValues = new Node { ["tenant"] = new Node(), ["app"] = new Node() }; (string, string)? previewScope = null;
        if (config.GetValueOrDefault("previewConfig") is Node encrypted)
        {
            if (previewKey is null) throw new ArgumentException("Preview configuration requires its decryption key");
            var tenants = ((List<object?>)config["tenants"]!).Cast<Node>().ToArray();
            var apps = ((List<object?>)config["apps"]!).Cast<Node>().ToArray();
            if (tenants.Length != 1 || apps.Length != 1 || tenants[0]["active"] is not true || !Equals(apps[0]["tenantId"], tenants[0]["id"]))
                throw new ArgumentException("Preview configuration requires an unambiguous active tenant/app scope");
            previewScope = ((string)tenants[0]["id"]!, (string)apps[0]["id"]!);
            var descriptors = schema.Manifest.ConfigSchemas.Select(item => (Node)Contracts.Parse("ConfigSchemaDescriptorSchema", item)!);
            foreach (var scope in new[] { "tenant", "app" })
            {
                previewValues[scope] = PreviewConfig.Decrypt(PreviewConfig.Schema(descriptors, scope), previewKey, scope, encrypted[scope]);
                if (configApi.Settings is { } settings) previewValues[scope] = settings.Schema.Values(scope, previewValues[scope]);
                foreach (var (key, value) in (Node)previewValues[scope]!)
                    preview[key] = value;
            }
        }
        // Validate every endpoint before allocating clients or publishing any policy.
        var addresses = ((List<object?>)config["apps"]!).Cast<Node>().Where(app => app.ContainsKey("auth")).Select(app => (Node)app["auth"]!)
            .Select(auth => (Issuer: (string)auth["expectedIssuer"]!, Uri: TrustedKeys.SecureEndpoint((string)auth["jwksUri"]!, allowQuery: true).AbsoluteUri)).Distinct().ToArray();
        return new(snapshot, config, preview, previewValues, previewScope, addresses.ToFrozenDictionary(address => address, address => new JwksClient(address.Issuer, address.Uri)));
    }
    public Node? Snapshot() => state?.Snapshot.Document();

    /// <summary>Restore a validated cache before startup; managed services remain unready.</summary>
    public async Task<bool> RestoreSnapshot(CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await updates.WaitAsync(linked.Token);
        try
        {
            if (closed || state is not null) throw new InvalidOperationException("Restore requires an empty, open service");
            if (store is null || await store.Load(linked.Token) is not { } data) return false;
            if (data.Length > 16 * 1024 * 1024) throw new ArgumentException("Snapshot exceeds 16 MiB");
            var next = Build(new ScopedConfig(Json.Read(new UTF8Encoding(false, true).GetString(data))!));
            if (closed || linked.IsCancellationRequested) { await next.Close(); linked.Token.ThrowIfCancellationRequested(); throw new ObjectDisposedException(nameof(Service)); }
            state = next;
            return true;
        }
        finally { updates.Release(); }
    }

    /// <summary>Validate, persist, then atomically publish. Submission means an acknowledged manifest POST.</summary>
    public async Task ApplySnapshot(object value, bool manifestSubmitted = false, CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, shutdown.Token);
        await updates.WaitAsync(linked.Token);
        try
        {
            ObjectDisposedException.ThrowIf(closed, this);
            var next = Build(new ScopedConfig(value));
            try
            {
                var data = Encoding.UTF8.GetBytes(Json.Write(next.Config));
                if (data.Length > 16 * 1024 * 1024) throw new ArgumentException("Snapshot exceeds 16 MiB");
                linked.Token.ThrowIfCancellationRequested();
                if (store is not null) await store.Save(data, linked.Token);
            }
            catch { await next.Close(); throw; }
            // No await or cancellation check between a committed save and publication.
            var previous = state; state = next; submitted |= manifestSubmitted;
            if (previous is not null)
            {
                foreach (var client in previous.Keys.Values) client.Invalidate();
                var task = previous.Close();
                lock (cleanup) cleanup.Add(task);
                _ = task.ContinueWith(completed => { _ = completed.Exception; lock (cleanup) cleanup.Remove(completed); }, TaskScheduler.Default);
            }
        }
        finally { updates.Release(); }
    }
}
