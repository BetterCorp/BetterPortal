using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class ClientAdapter
{
    public static async Task<object> Run(Node body)
    {
        var results = new List<object>();
        try
        {
            var registry = RegistryAdapter.Build(body);
            await using var service = new Service(registry, Contracts.Parse<BetterPortal.Generated.ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]),
                body.GetValueOrDefault("snapshot") is { } snapshot ? new ScopedConfig(snapshot) : null, signingKey: body.GetValueOrDefault("noKey") is true ? null : SecurityAdapter.Key);
            var contract = new ClientContract(body["contract"]!);
            var scope = body.GetValueOrDefault("background") is true ? service.Clients.Scope((string)body["tenantId"]!, (string)body["appId"]!)
                : (await service.PrepareAsync(registry.Routes[0], "GET", "/check/item", ((Node)body.GetValueOrDefault("headers", new Node { ["origin"] = "https://app.test" })!).ToDictionary(pair => pair.Key, pair => (string)pair.Value!))).Context.Clients;
            var client = body.TryGetValue("requestId", out var requestId) ? scope.M2m((string)requestId!, contract) : scope.User(contract, (string?)body.GetValueOrDefault("serviceId"));
            foreach (var step in ((List<object?>)body.GetValueOrDefault("steps", new List<object?> { new Node() })!).Cast<Node>())
                try
                {
                    if (step.TryGetValue("snapshot", out var next)) await service.ApplySnapshot(next!);
                    if (step.GetValueOrDefault("close") is true) await service.DisposeAsync();
                    using var cancellation = new CancellationTokenSource();
                    var pending = client.RequestAsync((string)step.GetValueOrDefault("operation", "check.get")!, step.GetValueOrDefault("values", new Node { ["params"] = new Node { ["key"] = "item" } }), cancellation.Token);
                    if (step.GetValueOrDefault("during") is Node control)
                    {
                        using var http = new HttpClient(new SocketsHttpHandler { UseProxy = false });
                        (await http.GetAsync(control["url"] + "/control/started")).EnsureSuccessStatusCode();
                        if (control.TryGetValue("snapshot", out var update)) await service.ApplySnapshot(update!);
                        if (control.GetValueOrDefault("close") is true) await service.DisposeAsync();
                        if (control.GetValueOrDefault("cancel") is true) await cancellation.CancelAsync();
                        (await http.GetAsync(control["url"] + "/control/release")).EnsureSuccessStatusCode();
                    }
                    results.Add(new { status = 200, output = await pending });
                }
                catch (OperationCanceledException) { results.Add(new { status = 499 }); }
                catch (ClientException error) { results.Add(new { status = error.Status, error = error.Message }); }
                catch (Exception error) when (error is AnyVali.ValidationError or ArgumentException or InvalidCastException) { results.Add(new { status = 400 }); }
            return new { results };
        }
        catch (ClientException error) { return new { status = error.Status, error = error.Message }; }
        catch (RequestException error) { return new { status = error.Status, error = error.Message }; }
        catch (Exception error) when (error is AnyVali.ValidationError or ArgumentException or InvalidCastException) { return new { status = 400 }; }
    }
}
