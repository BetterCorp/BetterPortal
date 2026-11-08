using BetterPortal;
using BetterPortal.AspNetCore;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class HealthChecks
{
    private const string Tenant = "01952200-0000-7000-8000-000000000001";
    private const string App = "01952200-0000-7000-8000-000000000002";
    private const string Other = "01952200-0000-7000-8000-000000000003";
    private const string Issuer = "https://auth.example";
    private const string Audience = "management";
    private sealed class Gate
    {
        internal TaskCompletionSource Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
    private static void Public(Node value, bool ready = true) =>
        Require(value.Count == 1 && Equals(value.GetValueOrDefault("ok"), ready), "Unexpected public health: " + Json.Write(value));
    private static WebApplication Host()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
        return builder.Build();
    }
    private static string Address(WebApplication app) => app.Services.GetRequiredService<IServer>()
        .Features.Get<IServerAddressesFeature>()!.Addresses.Single();
    private static Node Copy(Node value) => (Node)Json.Read(Json.Write(value))!;
    private static Node Snapshot(string jwks) => new()
    {
        ["managementOrigins"] = Array.Empty<object>(),
        ["configManagement"] = new Node { ["adminTenantId"] = Tenant, ["managementAppId"] = App },
        ["tenants"] = new[] { new Node { ["id"] = Tenant, ["slug"] = "tenant", ["title"] = "Tenant", ["active"] = true, ["services"] = Array.Empty<object>() } },
        ["apps"] = new[] { new Node { ["id"] = App, ["tenantId"] = Tenant, ["slug"] = "management", ["title"] = "Management",
            ["hostnames"] = new[] { "app.test" }, ["auth"] = new Node { ["serviceId"] = Other, ["expectedIssuer"] = Issuer,
                ["expectedAudience"] = Audience, ["jwksUri"] = jwks, ["roles"] = Array.Empty<object>() } } }
    };
    private static Node First(Node value, string key) => ((List<object?>)value[key]!)[0] as Node ?? throw new Exception("Missing " + key);
    private static Node Claims() => new()
    {
        ["iss"] = Issuer, ["aud"] = Audience, ["sub"] = "management-user", ["realm"] = "runtime",
        ["tenantId"] = Tenant, ["appId"] = App, ["roles"] = Array.Empty<string>(), ["jti"] = Guid.NewGuid().ToString(),
        ["iat"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), ["exp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 600, ["tokenType"] = "access"
    };
    internal static async Task Run()
    {
        var key = KeyPair.Generate(); var requests = 0; Gate? gate = null;
        await using var peer = Host();
        peer.MapGet("/jwks", async (HttpContext context) =>
        {
            Interlocked.Increment(ref requests);
            var current = gate;
            if (current is not null)
            {
                current.Started.TrySetResult();
                await current.Release.Task.WaitAsync(context.RequestAborted);
            }
            return Results.Json(new { keys = new[] { key.PublicJwk() } });
        });
        peer.MapGet("/unavailable", () => Results.StatusCode(503));
        await peer.StartAsync();
        var snapshot = Copy(Snapshot(Address(peer) + "/jwks"));
        var declaration = new BetterPortal.Generated.ManifestDeclarationInput
            { PluginId = "com.example.health", Title = "Health", Description = "Health checks", Version = "1.0.0" };
        await using var service = new Service(new Registry([]), declaration, new ScopedConfig(snapshot));
        await using var host = Host();
        host.MapBetterPortal(service);
        await host.StartAsync();
        using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false })
            { BaseAddress = new Uri(Address(host)), Timeout = TimeSpan.FromSeconds(8) };
        var checks = 0;
        string Token(Node? overrides = null, KeyPair? signer = null, TokenPurpose purpose = TokenPurpose.Access)
        {
            var claims = Claims();
            if (overrides is not null) foreach (var (name, value) in overrides) claims[name] = value;
            return Tokens.Sign(signer ?? key, claims, purpose);
        }
        Dictionary<string, string> Bearer(string token) => new() { ["authorization"] = "Bearer " + token };
        async Task<Node> Probe(string? credential = null, string method = "GET", int status = 200, Dictionary<string, string>? extra = null)
        {
            using var request = new HttpRequestMessage(new HttpMethod(method), "/.well-known/bp/health");
            if (credential is not null) request.Headers.TryAddWithoutValidation("Authorization", credential);
            if (extra is not null) foreach (var (name, value) in extra) request.Headers.TryAddWithoutValidation(name, value);
            using var response = await client.SendAsync(request);
            Require((int)response.StatusCode == status, $"Health {method}: {response.StatusCode} instead of {status}");
            Require(response.Headers.CacheControl is { Private: true, NoStore: true }, "Health cache policy");
            Require(string.Join(", ", response.Headers.GetValues("vary")) == "Authorization", "Health cache variation");
            var body = await response.Content.ReadAsStringAsync();
            checks++;
            if (method == "HEAD" || status == 204) { Require(body.Length == 0, "Health HEAD/preflight has a body"); return new(); }
            return (Node)Json.Read(body)!;
        }
        void Diagnostic(Node value, bool ready = true, string sync = "local")
        {
            Require(value.Count == 6 && Equals(value["ok"], ready) && Equals(value["ready"], ready)
                && Equals(value["pluginId"], "com.example.health") && Equals(value["version"], "1.0.0"), "Diagnostic projection");
            var config = (Node)value["config"]!;
            Require(config.Count == 4 && Convert.ToInt32(config["tenants"]) == 1 && Convert.ToInt32(config["apps"]) == 1, "Diagnostic config projection");
            Require(Equals(((Node)value["manifestSync"]!)["state"], sync), "Diagnostic sync state");
        }
        try
        {
            Public(await Probe());
            foreach (var credential in new[] { "Bearer invalid", "Basic invalid", "Bearer a.b.c", "Bearer " }) Public(await Probe(credential));
            await Probe(method: "HEAD");
            await Probe("Bearer " + Token(), "OPTIONS", 204, new() { ["origin"] = "https://management.test", ["access-control-request-method"] = "GET",
                ["access-control-request-headers"] = "Authorization" });
            Require(requests == 0, "Public/preflight probes attempted authentication network I/O");
            Diagnostic(await Probe("Bearer " + Token()));
            Diagnostic(await Probe("Bearer " + Token(), extra: new() { ["host"] = "unrelated.test", ["x-bp-tenant-id"] = Other, ["x-bp-app-id"] = Other }));
            foreach (var overrides in new[] { new Node { ["appId"] = Other }, new Node { ["tenantId"] = Other },
                new Node { ["iss"] = "https://untrusted.test" }, new Node { ["aud"] = "ordinary-app" },
                new Node { ["iat"] = 1, ["exp"] = 2 }, new Node { ["iat"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 600,
                    ["exp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 1200 } }) Public(await Probe("Bearer " + Token(overrides)));
            Public(await Probe("Bearer " + Token(new() { ["tokenType"] = "refresh" }, purpose: TokenPurpose.Refresh)));
            Public(await Probe("Bearer " + Token(signer: KeyPair.Generate(key.Kid))));
            Public(await Probe("Bearer " + Token(), extra: new() { ["x-bp-service-id"] = Other }));
            Public(await Probe("Bearer " + Token(), extra: new() { ["x-bp-service-authorization"] = "Bearer invalid" }));
            await Probe("Bearer " + Token(), "HEAD");
            await Probe(method: "POST", status: 405);
            await Probe(method: "GET", status: 400, extra: new() { ["bp-protocol-version"] = "invalid" });
            using (var preflight = new HttpRequestMessage(HttpMethod.Options, "/.well-known/bp/health"))
            {
                preflight.Headers.Add("access-control-request-method", "HEAD");
                using var response = await client.SendAsync(preflight);
                Require(response.StatusCode == System.Net.HttpStatusCode.NoContent
                    && response.Headers.GetValues("access-control-allow-headers").Single().Contains("Authorization"), "Health bearer preflight"); checks++;
            }
            // Replacing live policy revokes an otherwise valid access token.
            foreach (var change in new Action<Node>[] {
                value => ((Node)value["configManagement"]!)["managementAppId"] = Other,
                value => ((Node)value["configManagement"]!)["adminTenantId"] = Other,
                value => First(value, "tenants")["active"] = false,
                value => First(value, "apps").Remove("auth"),
                value => value.Remove("configManagement"),
                value => ((Node)First(value, "apps")["auth"]!)["jwksUri"] = Address(peer) + "/unavailable" })
            {
                var changed = Copy(snapshot); change(changed);
                await service.ApplySnapshot(changed);
                Public(await Probe("Bearer " + Token()));
            }
            await service.ApplySnapshot(snapshot);
            Diagnostic(await Probe("Bearer " + Token()));
            // Readiness and authentication are independent: authorized operators can diagnose an unready managed cache.
            await using (var managed = new Service(new Registry([]), declaration, new ScopedConfig(snapshot), managed: true))
            {
                Public(await managed.HealthAsync(new Dictionary<string, string>()), false);
                Diagnostic(await managed.HealthAsync(Bearer(Token())), false, "awaiting-sync");
                await managed.ApplySnapshot(snapshot, manifestSubmitted: true);
                var diagnostic = await managed.HealthAsync(Bearer(Token())); Diagnostic(diagnostic, sync: "synced");
                Require(((Node)diagnostic["config"]!)["synced"] is true && ((Node)diagnostic["config"]!)["localConfig"] is false, "Managed config projection");
                checks += 3;
            }
            await using (var empty = new Service(new Registry([]), declaration))
            { Public(await empty.HealthAsync(Bearer(Token())), false); checks++; }
            using (var cancelled = new CancellationTokenSource())
            {
                cancelled.Cancel();
                try { await service.HealthAsync(Bearer(Token()), cancelled.Token); throw new Exception("Pre-cancelled health did not cancel"); }
                catch (OperationCanceledException) when (cancelled.IsCancellationRequested) { checks++; }
            }
            // Cancellation releases this caller while JWKS retrieval may still serve other waiters.
            await service.ApplySnapshot(snapshot); gate = new();
            using (var cancellation = new CancellationTokenSource())
            {
                var pending = service.HealthAsync(Bearer(Token()), cancellation.Token);
                await gate.Started.Task.WaitAsync(TimeSpan.FromSeconds(3)); cancellation.Cancel();
                try { await pending.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Health verification ignored cancellation"); }
                catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { checks++; }
                gate.Release.TrySetResult(); gate = null;
            }
            // Policy changes during JWKS I/O must retire the old authorization result.
            await service.ApplySnapshot(snapshot); gate = new();
            var stale = service.HealthAsync(Bearer(Token()));
            await gate.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
            var revoked = Copy(snapshot); ((Node)revoked["configManagement"]!)["managementAppId"] = Other;
            await service.ApplySnapshot(revoked);
            Public(await stale.WaitAsync(TimeSpan.FromSeconds(2))); checks++;
            gate.Release.TrySetResult(); gate = null;
            await service.ApplySnapshot(snapshot); gate = new();
            var closing = service.HealthAsync(Bearer(Token()));
            await gate.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
            await service.DisposeAsync();
            Public(await closing.WaitAsync(TimeSpan.FromSeconds(2)), false); checks++;
            gate.Release.TrySetResult(); gate = null;
            Public(await Probe("Bearer " + Token(), status: 503), false);
            using (var trailing = await client.GetAsync("/.well-known/bp/health/"))
            {
                Require((int)trailing.StatusCode == 503 && trailing.Headers.CacheControl is { Private: true, NoStore: true }
                    && trailing.Headers.Vary.Contains("Authorization"), "Trailing-slash unready health cache policy"); checks++;
            }
            // Stopping a mapped host must cancel verification even without AddBetterPortal owning the service.
            await using var stoppingService = new Service(new Registry([]), declaration, new ScopedConfig(snapshot));
            await using var stoppingHost = Host(); stoppingHost.MapBetterPortal(stoppingService); await stoppingHost.StartAsync();
            using var stoppingClient = new HttpClient(new SocketsHttpHandler { UseProxy = false }) { BaseAddress = new Uri(Address(stoppingHost)) };
            using var request = new HttpRequestMessage(HttpMethod.Get, "/.well-known/bp/health");
            request.Headers.Add("Authorization", "Bearer " + Token()); gate = new();
            var disconnected = stoppingClient.SendAsync(request);
            await gate.Started.Task.WaitAsync(TimeSpan.FromSeconds(3));
            await stoppingHost.StopAsync().WaitAsync(TimeSpan.FromSeconds(3));
            try { using var response = await disconnected.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Stopped host returned a health response"); }
            catch (HttpRequestException) { checks++; }
            gate.Release.TrySetResult(); gate = null;
        }
        finally { gate?.Release.TrySetResult(); await host.StopAsync(); await peer.StopAsync(); }
        Console.WriteLine($".NET health: {checks} authorization, HTTP/cache, readiness, revocation and cancellation checks passed");
    }
}
