using BetterPortal;
using BetterPortal.AspNetCore;
using BetterPortal.Generated;
using System.Security.Cryptography;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class InstallationAdapter
{
    internal static async Task<object> Run(Node body)
    {
        var directory = Directory.CreateTempSubdirectory("bp-install-");
        var fault = new FaultStore(directory.FullName);
        var bootstrapFile = new FileStateStore(Path.Combine(directory.FullName, "state.json"));
        var settings = new FileStateStore(Path.Combine(directory.FullName, "settings.json"));
        var snapshots = new FileStateStore(Path.Combine(directory.FullName, "snapshot.json"));
        var key = (string)body["key"]!;
        Service? service = null; ServiceInstallation? installation = null; WebApplication? app = null;
        BootstrapStateStore? bootstrap = null;
        async Task Start()
        {
            service = new Service(RegistryAdapter.Build(body), Contracts.Parse<ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]), managed: body.GetValueOrDefault("managed", true) is true, stateStore: snapshots);
            bootstrap = new BootstrapStateStore(fault, key);
            installation = new ServiceInstallation(service, bootstrap, (string)body["cpUrl"]!, (string)body.GetValueOrDefault("serviceUrl", "https://service.test")!,
                settingsStore: settings, cpJwksUri: body.GetValueOrDefault("jwksUri") as string,
                authProvider: body.TryGetValue("authProvider", out var provider) ? Contracts.Parse<AuthProviderRuntimeMetadataInput>("AuthProviderRuntimeMetadataSchema", provider) : null,
                retryDelay: TimeSpan.FromSeconds(Convert.ToDouble(body.GetValueOrDefault("retryDelay", 0.05))), requestTimeout: TimeSpan.FromSeconds(Convert.ToDouble(body.GetValueOrDefault("requestTimeout", 1))));
            var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services.AddBetterPortal(service, installation: installation);
            app = builder.Build(); app.MapBetterPortal(service, installation: installation, maxBodyBytes: Convert.ToInt32(body.GetValueOrDefault("maxBodyBytes", 1024 * 1024)));
            await app.StartAsync();
        }
        async Task Stop()
        {
            if (app is not null) { var owner = app; app = null; await owner.StopAsync(); await owner.DisposeAsync(); }
            else { if (installation is not null) await installation.DisposeAsync(); if (service is not null) await service.DisposeAsync(); }
        }
        async Task<Node> State()
        {
            var value = await bootstrap!.Read();
            string Hash(string name) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.GetValueOrDefault(name) as string ?? ""))).ToLowerInvariant();
            return new Node { ["ready"] = service!.Ready, ["snapshot"] = service.Snapshot(), ["installation"] = installation!.Status,
                ["bootstrap"] = await bootstrap.Read(redacted: true), ["stored"] = Encoding.UTF8.GetString(await bootstrapFile.Load() ?? []),
                ["settingsStored"] = Encoding.UTF8.GetString(await settings.Load() ?? []),
                ["apiKeyHash"] = Hash("apiKey"), ["configKeyHash"] = Hash("configEncryptionKey") };
        }
        var outcomes = new List<Node>();
        try
        {
            if (body.GetValueOrDefault("stored") is string stored) await bootstrapFile.Save(Encoding.UTF8.GetBytes(stored));
            if (body.GetValueOrDefault("settingsStored") is string settingsStored) await settings.Save(Encoding.UTF8.GetBytes(settingsStored));
            await Start();
            using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false, AllowAutoRedirect = false });
            foreach (var step in ((List<object?>)body["steps"]!).Cast<Node>())
            {
                fault.Mode = step.GetValueOrDefault("mode") as string ?? "ok";
                var result = new Node { ["status"] = 200 };
                switch (step.GetValueOrDefault("kind", "request"))
                {
                    case "restart":
                        await Stop();
                        if (step.TryGetValue("serviceUrl", out var address)) body["serviceUrl"] = address;
                        await Start(); break;
                    case "close": await Stop(); break;
                    case "state": break;
                    case "wait":
                        var deadline = System.Diagnostics.Stopwatch.StartNew();
                        bool Reached()
                        {
                            var status = (Node)Json.Read(Json.Write(installation!.Status))!;
                            var updates = (status["sync"] as Node)?.GetValueOrDefault("Updates", 0) ?? 0;
                            return service!.Ready == (step.GetValueOrDefault("ready", true) is true) && Convert.ToInt32(updates) >= Convert.ToInt32(step.GetValueOrDefault("updates", 0));
                        }
                        while (!Reached())
                        {
                            if (deadline.Elapsed > TimeSpan.FromSeconds(4)) throw new TimeoutException("Installation did not reach expected readiness");
                            await Task.Delay(5);
                        }
                        break;
                    case "snapshot":
                        try { await service!.ApplySnapshot(step["snapshot"]!); }
                        catch (ArgumentException) { result["status"] = 400; }
                        break;
                    case "host-stop":
                        using (var content = new StringContent(Json.Write(step["body"]), Encoding.UTF8, "application/json"))
                        {
                            var pending = client.PostAsync(app!.Urls.Single() + (string)step["path"]!, content);
                            try
                            {
                                using var barrier = await client.GetAsync((string)step["barrier"]! + "/control/started"); barrier.EnsureSuccessStatusCode();
                                await Stop().WaitAsync(TimeSpan.FromSeconds(2));
                                try { using var response = await pending; throw new Exception("Expected HTTP disconnect on host shutdown"); }
                                catch (HttpRequestException) { result["status"] = 0; result["cancelled"] = true; }
                            }
                            finally
                            {
                                using var released = await client.GetAsync((string)step["barrier"]! + "/control/release"); released.EnsureSuccessStatusCode();
                                try { using var response = await pending; } catch (HttpRequestException) { }
                            }
                        }
                        break;
                    case "cancel": case "close-install": case "cancel-after-save": case "parallel-install":
                        var kind = (string)step["kind"]!;
                        fault.Started = new(TaskCreationOptions.RunContinuationsAsynchronously); fault.Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
                        using (var cancellation = new CancellationTokenSource())
                        {
                            if (kind == "cancel-after-save") fault.AfterSave = () => { fault.AfterSave = null; cancellation.Cancel(); };
                            else if (!step.ContainsKey("barrier")) fault.Mode = "block";
                            Task<(int Status, Node Body)> Operation(CancellationToken token = default) => step.GetValueOrDefault("hostname") is true
                                ? installation!.ChangeHostname(step["body"], token) : installation!.Install(step["body"], token);
                            var task = Operation(cancellation.Token);
                            try
                            {
                                if (kind != "cancel-after-save")
                                {
                                    if (step.GetValueOrDefault("barrier") is string barrier)
                                    {
                                        using var response = await client.GetAsync(barrier + "/control/started"); response.EnsureSuccessStatusCode();
                                    }
                                    else await fault.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
                                    if (kind == "parallel-install")
                                    {
                                        var second = Operation();
                                        if (second.IsCompleted) throw new Exception("Concurrent install did not wait");
                                        fault.Release.TrySetResult(); var values = await Task.WhenAll(task, second);
                                        result["statuses"] = values.Select(value => value.Status).ToArray();
                                    }
                                    else if (kind == "close-install") await installation!.DisposeAsync();
                                    else cancellation.Cancel();
                                }
                                if (kind != "parallel-install")
                                {
                                    try { await task; throw new Exception("Expected installation cancellation"); }
                                    catch (OperationCanceledException) { result["status"] = 0; result["cancelled"] = true; }
                                }
                            }
                            finally
                            {
                                fault.Mode = "ok"; fault.AfterSave = null; fault.Release.TrySetResult();
                                if (step.GetValueOrDefault("barrier") is string barrier) { using var response = await client.GetAsync(barrier + "/control/release"); response.EnsureSuccessStatusCode(); }
                            }
                        }
                        break;
                    default:
                        using (var request = new HttpRequestMessage(new System.Net.Http.HttpMethod((string)step.GetValueOrDefault("method", "GET")!), app!.Urls.Single() + (string)step.GetValueOrDefault("path", "/.well-known/bp/health")!))
                        {
                            if (step.ContainsKey("raw") || step.ContainsKey("body"))
                            {
                                request.Content = new ByteArrayContent(Encoding.UTF8.GetBytes(step.GetValueOrDefault("raw") as string ?? Json.Write(step["body"])));
                                if (!step.ContainsKey("raw")) request.Content.Headers.ContentType = new("application/json");
                            }
                            foreach (var (name, value) in (Node)step.GetValueOrDefault("headers", new Node())!)
                                if (!request.Headers.TryAddWithoutValidation(name, (string)value!)) { request.Content ??= new ByteArrayContent([]); request.Content.Headers.Remove(name); request.Content.Headers.TryAddWithoutValidation(name, (string)value!); }
                            using var response = await client.SendAsync(request);
                            result = new Node { ["status"] = (int)response.StatusCode, ["headers"] = response.Headers.Concat(response.Content.Headers).ToDictionary(pair => pair.Key.ToLowerInvariant(), pair => string.Join(", ", pair.Value)), ["body"] = await response.Content.ReadAsStringAsync() };
                        }
                        break;
                }
                foreach (var (name, value) in await State()) result[name] = value;
                outcomes.Add(result);
            }
            return new { valid = true, outcomes };
        }
        catch (Exception error) { return new { valid = false, error = error.Message, outcomes }; }
        finally
        {
            await Stop();
            if (!directory.FullName.StartsWith(Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid temporary directory");
            directory.Delete(recursive: true);
        }
    }
}
