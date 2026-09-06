using BetterPortal;
using BetterPortal.AspNetCore;
using BetterPortal.Generated;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class SyncAdapter
{
    private sealed class Store(string directory, int failures, bool failOnCancellation) : IStateStore
    {
        private readonly FileStateStore file = new(Path.Combine(directory, "snapshot.json"));
        internal int Saves;
        internal TaskCompletionSource Saving = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ValueTask<byte[]?> Load(CancellationToken cancellation = default) => file.Load(cancellation);
        public async ValueTask Save(ReadOnlyMemory<byte> data, CancellationToken cancellation = default)
        {
            Saves++;
            if (failures > 0) { failures--; throw new IOException("Injected save failure"); }
            if (failOnCancellation)
            {
                Saving.TrySetResult();
                try { await Task.Delay(Timeout.Infinite, cancellation); }
                catch (OperationCanceledException) { throw new InvalidDataException("Storage failed during shutdown"); }
            }
            await file.Save(data, cancellation);
        }
    }
    internal static async Task<object> Run(Node body)
    {
        var directory = Directory.CreateTempSubdirectory("bp-sync-");
        try
        {
            var store = new Store(directory.FullName, Convert.ToInt32(body.GetValueOrDefault("saveFailures", 0)), body.GetValueOrDefault("cancelFailedSave") is true);
            if (body.GetValueOrDefault("stored") is string cached) await File.WriteAllTextAsync(Path.Combine(directory.FullName, "snapshot.json"), cached);
            await using var service = new Service(RegistryAdapter.Build(body), Contracts.Parse<ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]),
                stateStore: store, managed: body.GetValueOrDefault("managed", true) is true, previewKey: body.GetValueOrDefault("previewKey") as string);
            ControlPlaneSync sync;
            try
            {
                var key = body.GetValueOrDefault("key") is Node value ? new KeyPair((string)value["privateKeyPem"]!, (string)value["kid"]!) : body.GetValueOrDefault("generateKey") is true ? KeyPair.Generate() : null;
                sync = new(service, (string)body["baseUrl"]!, (string)body.GetValueOrDefault("apiKey", "bp-test-key")!, key,
                    body.TryGetValue("authProvider", out var auth) ? Contracts.Parse<AuthProviderRuntimeMetadataInput>("AuthProviderRuntimeMetadataSchema", auth) : null,
                    TimeSpan.FromSeconds(Convert.ToDouble(body.GetValueOrDefault("retryDelay", 0.05))), TimeSpan.FromSeconds(Convert.ToDouble(body.GetValueOrDefault("requestTimeout", 1))));
            }
            catch (Exception) { return new { valid = false }; }
            await using (sync)
            {
                if (body.GetValueOrDefault("cancelStartup") is true || body.GetValueOrDefault("cancelFailedSave") is true)
                {
                    using var cancellation = new CancellationTokenSource();
                    var starting = sync.StartAsync(cancellation.Token);
                    if (body.GetValueOrDefault("cancelFailedSave") is true) await store.Saving.Task.WaitAsync(TimeSpan.FromSeconds(3));
                    else while (sync.Status.Attempts == 0) await Task.Yield();
                    cancellation.Cancel();
                    try { await starting; throw new Exception("Startup should cancel"); }
                    catch (OperationCanceledException) { }
                    var cancelledStatus = sync.Status;
                    await Task.Delay(100);
                    if (sync.Status != cancelledStatus || cancelledStatus.Phase != "closed") throw new Exception("Sync continued after startup cancellation");
                    return new { valid = true, cancelled = true, ready = service.Ready, stored = await store.Load() };
                }
                var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
                var hosted = body.GetValueOrDefault("hosted") is true;
                if (hosted) builder.Services.AddBetterPortal(service, sync);
                await using var app = builder.Build(); app.MapBetterPortal(service);
                bool started;
                if (hosted) { await app.StartAsync(); started = service.Ready; }
                else { started = await sync.StartAsync(); await app.StartAsync(); }
                Node State() => new() { ["ready"] = service.Ready, ["snapshot"] = service.Snapshot(), ["sync"] = sync.Status };
                var first = State(); var until = (Node)body.GetValueOrDefault("until", new Node())!;
                bool Reached()
                {
                    var status = (Node)Json.Read(System.Text.Json.JsonSerializer.Serialize(sync.Status, new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase }))!;
                    var current = service.Snapshot();
                    return until.All(pair => pair.Value is string text ? Equals(status[pair.Key], text) : Convert.ToInt32(status[pair.Key]) >= Convert.ToInt32(pair.Value))
                        && (!body.TryGetValue("untilTitle", out var title) || current is not null && Equals(((Node)((List<object?>)current["tenants"]!)[0]!)["title"], title));
                }
                var deadline = System.Diagnostics.Stopwatch.StartNew();
                while (!Reached())
                {
                    if (deadline.Elapsed > TimeSpan.FromSeconds(4)) throw new TimeoutException("Sync probe did not reach its expected state");
                    await Task.Delay(5);
                }
                var final = State();
                using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false });
                using var response = await client.GetAsync(app.Urls.Single() + "/.well-known/bp/health");
                var health = new { status = (int)response.StatusCode, body = Json.Read(await response.Content.ReadAsStringAsync()) };
                object? operation = null;
                if (body.GetValueOrDefault("probeRequest", body.GetValueOrDefault("request")) is Node probe)
                {
                    using var request = new HttpRequestMessage(new System.Net.Http.HttpMethod((string)probe["method"]!), app.Urls.Single() + (string)probe["path"]!);
                    request.Content = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes((string)probe.GetValueOrDefault("body", "")!));
                    foreach (var (name, value) in (Node)probe.GetValueOrDefault("headers", new Node())!)
                        if (!request.Headers.TryAddWithoutValidation(name, (string)value!)) request.Content.Headers.TryAddWithoutValidation(name, (string)value!);
                    using var reply = await client.SendAsync(request);
                    operation = new { status = (int)reply.StatusCode, body = await reply.Content.ReadAsStringAsync() };
                }
                await app.StopAsync(); await sync.DisposeAsync();
                var stopped = sync.Status; await Task.Delay(30);
                if (stopped != sync.Status) throw new Exception("Sync continued after shutdown");
                var stored = await store.Load();
                return new { valid = true, started, first, final, closed = sync.Status, serviceClosed = hosted ? (bool?)!service.Ready : null,
                    readyAfterClose = service.Ready,
                    health, submission = sync.Submission(), stored = stored is null ? null : System.Text.Encoding.UTF8.GetString(stored), saves = store.Saves, operation };
            }
        }
        finally { directory.Delete(recursive: true); }
    }
}
