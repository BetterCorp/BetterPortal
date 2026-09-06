using BetterPortal;
using BetterPortal.Generated;
using Route = BetterPortal.Route;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class SnapshotAdapter
{
    internal static async Task<object> Run(Node body)
    {
        var directory = Directory.CreateTempSubdirectory("bp-snapshots-");
        try
        {
            if (body.GetValueOrDefault("fileProbe") is true)
            {
                var target = Directory.CreateDirectory(Path.Combine(directory.FullName, "blocked"));
                var sentinel = Path.Combine(target.FullName, "sentinel"); await File.WriteAllTextAsync(sentinel, "old");
                var failed = false;
                try { await new FileStateStore(target.FullName).Save("new"u8.ToArray()); }
                catch (IOException) { failed = true; }
                catch (UnauthorizedAccessException) { failed = true; }
                return new { failed, preserved = await File.ReadAllTextAsync(sentinel) == "old", temporaryFiles = directory.GetFiles("*.tmp").Length };
            }
            var store = new FaultStore(directory.FullName, Convert.ToInt32(body.GetValueOrDefault("maxBytes", 16 * 1024 * 1024)));
            if (body.GetValueOrDefault("stored") is string storedText) await File.WriteAllTextAsync(Path.Combine(directory.FullName, "state.json"), storedText);
            var route = new Route("check", "/check/:key", [new Operation(new Handler<object?, object?, object?, object?, object?>(Contracts.Get("JsonObjectSchema"), _ => ValueTask.FromResult<object?>(new Node())),
                new OperationDeclarationInput { OperationId = "check.get", Method = HttpMethodInput.GET, Title = "Check", Description = "Check", Auth = Contracts.Parse<ApiAuthRequirementInput>("ApiAuthRequirementSchema", body.GetValueOrDefault("auth", new Node())) })]);
            await using var service = new Service(new Registry([route]), Contracts.Parse<ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]),
                stateStore: store, managed: body.GetValueOrDefault("managed", true) is true, previewKey: body.GetValueOrDefault("previewKey") as string);
            async Task<Node> Prepare(Node supplied, CancellationToken cancellation = default)
            {
                try
                {
                    var request = await service.PrepareAsync(route, "GET", "/check/item", supplied.ToDictionary(pair => pair.Key, pair => (string)pair.Value!), cancellationToken: cancellation);
                    return new() { ["status"] = 200, ["config"] = request.Context.Config,
                        ["url"] = request.Context.Urls.Route("check", new RouteUrlOptionsInput { Params = new Dictionary<string, BetterPortalRouteChromeValueInput?> { ["key"] = "item" }, Absolute = true }) };
                }
                catch (RequestException error) { return new() { ["status"] = error.Status }; }
            }
            Node State() => new() { ["ready"] = service.Ready, ["snapshot"] = service.Snapshot() };
            var outcomes = new List<Node>();
            foreach (var step in ((List<object?>)body["steps"]!).Cast<Node>())
            {
                var result = new Node();
                try
                {
                    if (step.GetValueOrDefault("kind") is "restore") result["restored"] = await service.RestoreSnapshot();
                    else if (step.GetValueOrDefault("kind") is "read") result["request"] = await Prepare((Node)step["headers"]!);
                    else if (step.GetValueOrDefault("kind") is "close") await service.DisposeAsync();
                    else if (step.GetValueOrDefault("kind") is "mutate") ((Node)((List<object?>)service.Snapshot()!["tenants"]!)[0]!)["title"] = "MUTATED";
                    else if (step.GetValueOrDefault("kind") is "auth-race")
                    {
                        using var cancellation = new CancellationTokenSource();
                        var task = Prepare((Node)step["headers"]!, cancellation.Token);
                        using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false });
                        try
                        {
                            using var response = await client.GetAsync((string)step["uri"]! + "/control/started"); response.EnsureSuccessStatusCode();
                            if (step.GetValueOrDefault("cancel") is true) await cancellation.CancelAsync();
                            else await service.ApplySnapshot(step["snapshot"]!);
                        }
                        finally { using var response = await client.GetAsync((string)step["uri"]! + "/control/release"); }
                        try { result["request"] = await task; }
                        catch (OperationCanceledException) { result["request"] = new { cancelled = true }; }
                    }
                    else
                    {
                        store.Mode = (string)step.GetValueOrDefault("save", "ok")!;
                        if (store.Mode == "block")
                        {
                            store.Started = new(TaskCreationOptions.RunContinuationsAsynchronously); store.Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
                            using var cancellation = new CancellationTokenSource();
                            var task = service.ApplySnapshot(step["snapshot"]!, step.GetValueOrDefault("submitted") is true, cancellation.Token);
                            await store.Started.Task.WaitAsync(TimeSpan.FromSeconds(3)); result["during"] = State();
                            var queued = step.TryGetValue("queued", out var pending) ? service.ApplySnapshot(pending!) : null;
                            if (step.GetValueOrDefault("cancel") is true) await cancellation.CancelAsync();
                            else if (step.GetValueOrDefault("shutdown") is true) await service.DisposeAsync();
                            else store.Release.TrySetResult();
                            try { await task; }
                            catch (OperationCanceledException) { result["cancelled"] = true; }
                            if (queued is not null) await queued;
                        }
                        else await service.ApplySnapshot(step["snapshot"]!, step.GetValueOrDefault("submitted") is true);
                    }
                    result["accepted"] = true;
                }
                catch (Exception) { result["accepted"] = false; }
                foreach (var (key, value) in State()) result[key] = value;
                outcomes.Add(result);
            }
            var stored = await store.Load();
            return new { steps = outcomes, stored = stored is null ? null : System.Text.Encoding.UTF8.GetString(stored), saves = store.Saves, temporaryFiles = directory.GetFiles("*.tmp").Length };
        }
        finally { directory.Delete(recursive: true); }
    }
}
