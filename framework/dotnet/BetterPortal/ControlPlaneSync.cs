using System.Net.ServerSentEvents;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed record SyncStatus(string Phase, string? LastError, int Attempts, int Updates);

/// <summary>BP manifest submission and scoped SSE/poll synchronization, independent of hosting and BSB.</summary>
public sealed class ControlPlaneSync : IAsyncDisposable
{
    private const int Limit = 16 * 1024 * 1024;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    public Service Service { get; }
    private readonly HttpClient client;
    private readonly string url;
    private readonly string apiKey;
    private readonly byte[] payload;
    private readonly TimeSpan retryDelay;
    private readonly TimeSpan requestTimeout;
    private readonly CancellationTokenSource shutdown = new();
    private readonly TaskCompletionSource<bool> first = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly object gate = new();
    private Task? task;
    private bool closed;
    private volatile SyncStatus status = new("idle", null, 0, 0);
    public SyncStatus Status => status;

    public ControlPlaneSync(Service service, string baseUrl, string apiKey, KeyPair? keyPair = null,
        Generated.AuthProviderRuntimeMetadataInput? authProvider = null, TimeSpan? retryDelay = null, TimeSpan? requestTimeout = null)
    {
        if (!service.Managed) throw new ArgumentException("Control-plane synchronization requires a managed Service");
        Service = service;
        url = TrustedKeys.SecureEndpoint(baseUrl).AbsoluteUri.TrimEnd('/') + "/.well-known/bp/sync";
        if (apiKey.Length is < 1 or > 4096 || apiKey.Any(character => character < 33 || character > 126)) throw new ArgumentException("Invalid control-plane API key");
        this.apiKey = apiKey;
        this.retryDelay = retryDelay ?? TimeSpan.FromSeconds(5); this.requestTimeout = requestTimeout ?? TimeSpan.FromSeconds(30);
        if (new[] { this.retryDelay, this.requestTimeout }.Any(value => value <= TimeSpan.Zero || value.TotalMilliseconds > uint.MaxValue - 1)) throw new ArgumentException("Invalid synchronization timing");
        keyPair ??= service.SigningKey;
        payload = Utf8.GetBytes(Json.Write(BuildSubmission(service.Manifest, keyPair, authProvider)));
        if (payload.Length > Limit) throw new ArgumentException("Manifest submission exceeds 16 MiB");
        client = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, UseCookies = false }) { Timeout = Timeout.InfiniteTimeSpan };
        service.SigningKey = keyPair;
    }

    public static Generated.ControlPlaneSubmission BuildSubmission(Generated.PluginManifest manifest, KeyPair? keyPair = null,
        Generated.AuthProviderRuntimeMetadataInput? authProvider = null)
    {
        var value = (Node)Contracts.Parse("PluginManifestSchema", manifest)!;
        var result = new[] { "title", "capabilities", "configSchemas", "webhooks", "apiContracts", "m2mRequests", "developerResources" }.ToDictionary(key => key, key => value[key]);
        var views = new Node(); result["manifestVersion"] = value["version"]; result["viewIndex"] = views;
        if (value.TryGetValue("shell", out var shell)) result["shell"] = shell;
        if (authProvider is not null) result["authProvider"] = authProvider;
        if (keyPair is not null) { result["publicKeyPem"] = keyPair.PublicKeyPem; result["keyId"] = keyPair.Kid; }
        foreach (var view in ((List<object?>)value["views"]!).Cast<Node>())
        {
            var operations = new List<Node>(); var fragments = new List<Node>(); var seen = new HashSet<(string, string, string)>();
            foreach (var operation in ((List<object?>)view["operations"]!).Cast<Node>())
            {
                var renderers = (Node)((Node)operation["html"]!)["renderers"]!;
                var item = new[] { "operationId", "method", "title", "description", "robots", "dependencies", "renderable", "apiContracts", "demoScenarios" }.ToDictionary(key => key, key => operation[key]);
                item["renderers"] = renderers.Keys.ToArray();
                item["renderModes"] = renderers.Values.Cast<Node>().SelectMany(theme => ((List<object?>)theme["renderModes"]!).Cast<string>()).Distinct().ToArray();
                item["authRequired"] = ((Node)operation["auth"]!)["required"]; item["permissions"] = ((Node)operation["auth"]!)["permissions"];
                item["schemas"] = new[] { ("query", "querySchema"), ("headers", "headersSchema"), ("request", "bodySchema"), ("response", "jsonResponseSchema"), ("metadataResponse", "metadataResponseSchema") }
                    .ToDictionary(pair => pair.Item1, pair => operation[pair.Item2]);
                foreach (var key in new[] { "role", "sitemap", "chrome", "raw" }) if (operation.TryGetValue(key, out var extra)) item[key] = extra;
                operations.Add(item);
                foreach (var theme in renderers.Values.Cast<Node>())
                    foreach (var renderer in ((List<object?>)theme["renderers"]!).Cast<Node>())
                    {
                        var identity = ((string)renderer["slotId"]!, (string)operation["operationId"]!, (string)operation["method"]!);
                        if (identity.Item1 == "main" || !seen.Add(identity)) continue;
                        fragments.Add(new() { ["fragmentId"] = identity.Item1, ["targetPath"] = view["path"], ["operationId"] = identity.Item2, ["method"] = identity.Item3 });
                    }
            }
            var entry = new[] { "viewId", "title", "description", "path", "pathVariants", "paramsSchema" }.ToDictionary(key => key, key => view[key]);
            entry["operations"] = operations; entry["fragments"] = fragments; views[(string)view["viewId"]!] = entry;
        }
        return Contracts.Parse<Generated.ControlPlaneSubmission>("ControlPlaneSubmissionSchema", result);
    }
    public Generated.ControlPlaneSubmission Submission() => Contracts.Parse<Generated.ControlPlaneSubmission>("ControlPlaneSubmissionSchema", Json.Read(Utf8.GetString(payload)));

    /// <summary>Returns the first bootstrap result. Failed bootstrap retries in the background.</summary>
    public async Task<bool> StartAsync(CancellationToken cancellation = default)
    {
        lock (gate)
        {
            if (closed || task is not null) throw new InvalidOperationException("Sync is closed or already started");
            Service.SuspendSync();
            task = Run();
        }
        try { return await first.Task.WaitAsync(cancellation); }
        catch { await DisposeAsync(); throw; }
    }
    private HttpRequestMessage Request(HttpMethod method, string address, string accept)
    {
        var request = new HttpRequestMessage(method, address);
        request.Headers.Authorization = new("Bearer", apiKey); request.Headers.Accept.ParseAdd(accept);
        return request;
    }
    private async Task Poll(CancellationToken cancellation)
    {
        status = status with { Phase = "submitting", Attempts = status.Attempts + 1 };
        using var request = Request(HttpMethod.Post, url + "/poll", "application/json");
        request.Content = new ByteArrayContent(payload); request.Content.Headers.ContentType = new("application/json");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation);
        if ((int)response.StatusCode is 401 or 403 or 409 or 412) Service.SuspendSync();
        if ((int)response.StatusCode != 200 || response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() != "application/json") throw new InvalidDataException("Invalid poll response");
        await using var stream = await response.Content.ReadAsStreamAsync(cancellation);
        using var data = new MemoryStream(); var buffer = new byte[8192]; int count;
        while ((count = await stream.ReadAsync(buffer, cancellation)) != 0)
        {
            if (data.Length + count > Limit) throw new InvalidDataException("Snapshot exceeds 16 MiB");
            data.Write(buffer, 0, count);
        }
        await Service.ApplySnapshot(Json.Read(Utf8.GetString(data.ToArray()))!, manifestSubmitted: true, cancellation: cancellation);
        status = status with { Updates = status.Updates + 1, LastError = null };
    }
    private async Task Stream(CancellationToken cancellation)
    {
        status = status with { Phase = "connecting" };
        using var request = Request(HttpMethod.Get, url, "text/event-stream");
        using var headerTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); headerTimeout.CancelAfter(requestTimeout);
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, headerTimeout.Token);
        if ((int)response.StatusCode is 401 or 403 or 409 or 412) Service.SuspendSync();
        if ((int)response.StatusCode != 200 || response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() != "text/event-stream") throw new InvalidDataException("Invalid SSE response");
        headerTimeout.CancelAfter(Timeout.InfiniteTimeSpan);
        await using var stream = await response.Content.ReadAsStreamAsync(cancellation);
        using var bounded = new BoundedSseStream(stream, requestTimeout);
        status = status with { Phase = "connected" };
        await foreach (var item in SseParser.Create(bounded).EnumerateAsync(cancellation))
        {
            if (item.EventType != "config") continue;
            try { await Service.ApplySnapshot(Json.Read(item.Data)!, cancellation: cancellation); }
            catch (Exception) when (!cancellation.IsCancellationRequested) { status = status with { LastError = "invalid_update" }; continue; }
            status = status with { Updates = status.Updates + 1, LastError = null };
        }
    }
    private async Task Run()
    {
        var cancellation = shutdown.Token;
        try
        {
            if (Service.Snapshot() is null)
            {
                try { await Service.RestoreSnapshot(cancellation); }
                catch (Exception) when (!cancellation.IsCancellationRequested) { status = status with { LastError = "invalid_cache" }; }
            }
            while (true)
            {
                cancellation.ThrowIfCancellationRequested();
                try
                {
                    using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
                    {
                        timeout.CancelAfter(requestTimeout);
                        await Poll(timeout.Token);
                    }
                    first.TrySetResult(true);
                    await Stream(cancellation);
                    status = status with { LastError = "stream_closed" };
                }
                catch (Exception) when (!cancellation.IsCancellationRequested) { status = status with { LastError = "sync_failed" }; }
                status = status with { Phase = "retrying" }; first.TrySetResult(false);
                await Task.Delay(retryDelay, cancellation);
            }
        }
        // Transport/storage can finish with a non-cancellation error as shutdown
        // starts. Normalize that race at the owner's cancellation boundary.
        catch (Exception) when (cancellation.IsCancellationRequested) { throw new OperationCanceledException(cancellation); }
        finally { first.TrySetCanceled(cancellation); status = status with { Phase = "closed" }; }
    }
    public async ValueTask DisposeAsync()
    {
        Task? running;
        lock (gate) { closed = true; running = task; if (running is not null) Service.SuspendSync(); }
        await shutdown.CancelAsync();
        if (running is not null)
        {
            try { await running; } catch (OperationCanceledException) { }
            Service.SuspendSync();
        }
        client.Dispose(); status = status with { Phase = "closed" };
    }

    // The platform SSE parser owns the protocol. This guard bounds input before its
    // buffers grow, validates UTF-8, and supplies cancellation and per-read deadlines.
    private sealed class BoundedSseStream(System.IO.Stream source, TimeSpan timeout) : System.IO.Stream
    {
        private readonly Decoder decoder = Utf8.GetDecoder();
        private readonly char[] characters = new char[2];
        private int size;
        private bool lineContent, carriage;
        private Exception? pendingError;
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellation = default)
        {
            if (buffer.IsEmpty) return 0;
            if (pendingError is not null) throw pendingError;
            while (true)
            {
                using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation); deadline.CancelAfter(timeout);
                var count = await source.ReadAsync(buffer[..Math.Min(buffer.Length, 8192)], deadline.Token);
                if (count == 0) { decoder.GetChars([], characters, flush: true); return 0; }
                var written = 0;
                for (var index = 0; index < count; index++)
                {
                    try
                    {
                        decoder.GetChars(buffer.Span.Slice(index, 1), characters, flush: false);
                        var value = buffer.Span[index];
                        if (carriage && value == 10) { carriage = false; continue; }
                        carriage = value == 13;
                        if (++size > Limit) throw new InvalidDataException("SSE frame exceeds 16 MiB");
                        if (value is 10 or 13) { if (!lineContent) size = 0; lineContent = false; }
                        else lineContent = true;
                        // Normalize line endings so a trailing CR dispatches immediately,
                        // without waiting for the platform parser's CRLF lookahead byte.
                        buffer.Span[written++] = value == 13 ? (byte)10 : value;
                    }
                    catch (Exception error) when (error is DecoderFallbackException or InvalidDataException)
                    {
                        if (written == 0) throw;
                        pendingError = error;
                        return written; // Let earlier complete frames reach the parser first.
                    }
                }
                if (written > 0) return written;
            }
        }
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellation) => ReadAsync(buffer.AsMemory(offset, count), cancellation).AsTask();
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
