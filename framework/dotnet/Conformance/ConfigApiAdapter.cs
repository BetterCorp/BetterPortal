using BetterPortal;
using BetterPortal.AspNetCore;
using BetterPortal.Generated;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class ConfigApiAdapter
{
    public static async Task<object> Run(Node body)
    {
        var directory = Path.Combine(Path.GetTempPath(), "bp-config-api-" + Guid.NewGuid()); Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "state.json");
        try
        {
            if (body.GetValueOrDefault("stored") is string stored) await File.WriteAllTextAsync(path, stored);
            var store = new FaultStore(directory, Convert.ToInt32(body.GetValueOrDefault("maxBytes", 16 * 1024 * 1024)));
            var descriptors = ((List<object?>)body["descriptors"]!).Select(value => Contracts.Parse<ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", value)).ToArray();
            var settings = body.GetValueOrDefault("unsupported") is true ? null : new ServiceSettings(new SettingsSchema(descriptors), new ConfigCipher((string)body["key"]!), store);
            var previous = Environment.GetEnvironmentVariable("BP_ALLOW_DEV_CONFIG_TOKEN"); ConfigApi api;
            try
            {
                Environment.SetEnvironmentVariable("BP_ALLOW_DEV_CONFIG_TOKEN", body.GetValueOrDefault("enableDevToken") is true ? "true" : "false");
                api = new ConfigApi(settings, body.GetValueOrDefault("issuer") as string, body.GetValueOrDefault("jwksUri") as string,
                    body.TryGetValue("mode", out var mode) ? Contracts.Parse<ServiceConfigManagementMode>("ServiceConfigManagementModeSchema", mode) : null,
                    body.GetValueOrDefault("customUiPath") as string, body.GetValueOrDefault("writable") is not false, body.GetValueOrDefault("devToken") as string);
            }
            finally { Environment.SetEnvironmentVariable("BP_ALLOW_DEV_CONFIG_TOKEN", previous); }
            var route = new BetterPortal.Route("check", "/check/:key", [new Operation(new Handler<object?, object?, object?, object?, object?>(Contracts.Get("JsonObjectSchema"),
                context => ValueTask.FromResult<object?>(context.RequestContext.Config)), new OperationDeclarationInput {
                    OperationId = "check.get", Method = HttpMethodInput.GET, Title = "Check", Description = "Check", Auth = new ApiAuthRequirementInput() })]);
            var declaration = new Node((Node)body["declaration"]!) { ["configSchemas"] = body["descriptors"] };
            await using var service = new Service(new Registry([route]), Contracts.Parse<ManifestDeclarationInput>("ManifestDeclarationSchema", declaration),
                body.GetValueOrDefault("snapshot") is { } snapshot ? new ScopedConfig(snapshot) : null, managed: body.GetValueOrDefault("managed") is true,
                previewKey: body.GetValueOrDefault("previewKey") as string, configApi: api);
            var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services.AddBetterPortal(service);
            await using var host = builder.Build(); host.MapBetterPortal(service, Convert.ToInt32(body.GetValueOrDefault("maxBodyBytes", 1024 * 1024)));
            var outcomes = new List<object?>();
            try
            {
                await host.StartAsync();
                var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
                using var client = new HttpClient(new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false });
                foreach (var step in ((List<object?>)body["steps"]!).Cast<Node>())
                {
                    if (step.TryGetValue("snapshot", out var replacement))
                    {
                        try { await service.ApplySnapshot(replacement!, step.GetValueOrDefault("submitted") is true); }
                        catch (Exception error)
                        {
                            if (step.GetValueOrDefault("allowFailure") is not true) throw;
                            outcomes.Add(new { rejected = true, errorType = error.GetType().Name }); continue;
                        }
                        if (step.GetValueOrDefault("allowFailure") is true) outcomes.Add(new { rejected = false });
                        continue;
                    }
                    if (step.GetValueOrDefault("close") is true) { await service.DisposeAsync(); continue; }
                    store.Mode = step.GetValueOrDefault("mode", "ok") as string ?? "ok";
                    async Task<object> Request(CancellationToken cancellation)
                    {
                        using var request = new HttpRequestMessage(new System.Net.Http.HttpMethod((string)step["method"]!), address + (string)step["path"]!);
                        request.Content = new ByteArrayContent(step.TryGetValue("bodyBase64", out var encoded) ? Convert.FromBase64String((string)encoded!) : System.Text.Encoding.UTF8.GetBytes((string)step.GetValueOrDefault("body", "")!));
                        foreach (var (name, value) in (Node)step.GetValueOrDefault("headers", new Node())!)
                            if (!request.Headers.TryAddWithoutValidation(name, (string)value!)) request.Content.Headers.TryAddWithoutValidation(name, (string)value!);
                        using var response = await client.SendAsync(request, cancellation);
                        return new { status = (int)response.StatusCode, body = await response.Content.ReadAsStringAsync(cancellation),
                            headers = response.Headers.Concat(response.Content.Headers).ToDictionary(pair => pair.Key.ToLowerInvariant(), pair => string.Join(", ", pair.Value)) };
                    }
                    using var timeout = new CancellationTokenSource(8000);
                    if (step.TryGetValue("duringAuthSnapshot", out var revision))
                    {
                        var pending = Request(timeout.Token);
                        try
                        {
                            using var started = await client.GetAsync((string)body["jwksUri"]! + "/control/started", timeout.Token); started.EnsureSuccessStatusCode();
                            await service.ApplySnapshot(revision!);
                        }
                        finally { using var release = await client.GetAsync((string)body["jwksUri"]! + "/control/release"); }
                        outcomes.Add(await pending);
                    }
                    else if (step.GetValueOrDefault("cancelWrite") is true || step.ContainsKey("duringWriteSnapshot") || step.GetValueOrDefault("closeWrite") is true)
                    {
                        store.Mode = "block"; store.Started = new(); store.Release = new();
                        var pending = Request(timeout.Token); await store.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
                        if (step.TryGetValue("duringWriteSnapshot", out var updated))
                        {
                            var update = service.ApplySnapshot(updated!);
                            if (update.IsCompleted) throw new Exception("Snapshot overtook settings commit");
                            store.Release.TrySetResult(); outcomes.Add(await pending); await update;
                        }
                        else
                        {
                            if (step.GetValueOrDefault("closeWrite") is true) await service.DisposeAsync();
                            await timeout.CancelAsync();
                            try { await pending; throw new Exception("Expected cancellation"); }
                            catch (OperationCanceledException) { outcomes.Add(new { cancelled = true }); }
                        }
                        store.Mode = "ok";
                    }
                    else outcomes.Add(await Request(timeout.Token));
                }
            }
            catch (Exception error) { return new { startupError = error.GetType().Name, ready = service.Ready, stored = File.Exists(path) ? await File.ReadAllTextAsync(path) : null }; }
            finally { await host.StopAsync(); }
            return new { outcomes, ready = service.Ready, stored = File.Exists(path) ? await File.ReadAllTextAsync(path) : null };
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
