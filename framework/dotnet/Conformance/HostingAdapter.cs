using BetterPortal;
using BetterPortal.AspNetCore;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Route = BetterPortal.Route;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class HostingAdapter
{
    internal static async Task<object> Run(Node body)
    {
        var invoked = 0; var cancelled = false;
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var registry = new Registry(((List<object?>)body["routes"]!).Cast<Node>().Select(item => new Route((string)item["viewId"]!, (string)item["path"]!,
            ((List<object?>)item["operations"]!).Cast<Node>().Select(spec =>
            {
                var schemas = (Node)spec.GetValueOrDefault("schemas", new Node())!;
                AnyVali.Schema? Schema(string name) => schemas.TryGetValue(name, out var value) ? Contracts.Import(Json.Write(value)) : null;
                var handler = new Handler<object?, object?, object?, object?, object?>(Contracts.Import(Json.Write(spec["response"])), async context =>
                {
                    Interlocked.Increment(ref invoked);
                    if (spec.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-password-must-not-leak");
                    if (spec.GetValueOrDefault("wait") is true)
                    {
                        started.TrySetResult();
                        try { await Task.Delay(30000, context.Cancellation); }
                        finally { cancelled = true; finished.TrySetResult(); }
                    }
                    if (spec.TryGetValue("result", out var result)) return result;
                    var request = context.RequestContext;
                    return new Node { ["params"] = context.Params, ["query"] = context.Query, ["request"] = context.Request, ["multipart"] = request.Multipart,
                        ["tenantId"] = request.Scope.TenantId, ["appId"] = request.Scope.AppId, ["caller"] = request.Caller.Mode, ["user"] = request.Caller.User?.GetValueOrDefault("sub") };
                }, Schema("params"), Schema("query"), Schema("headers"), Schema("request"));
                return new Operation(handler, Contracts.Parse<BetterPortal.Generated.OperationDeclarationInput>("OperationDeclarationSchema", spec["declaration"]));
            }), ((List<object?>)item.GetValueOrDefault("pathVariants", new List<object?>())!).Cast<string>())));
        await using var service = new Service(registry, Contracts.Parse<BetterPortal.Generated.ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]),
            body.GetValueOrDefault("snapshot") is { } snapshot ? new ScopedConfig(snapshot) : null);
        if (body.GetValueOrDefault("closed") is true) await service.DisposeAsync();
        var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var host = builder.Build();
        host.MapBetterPortal(service, Convert.ToInt32(body.GetValueOrDefault("maxBodyBytes", 1024 * 1024)));
        await host.StartAsync();
        try
        {
            var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            var input = (Node)body["request"]!;
            using var client = new HttpClient(new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false });
            using var request = new HttpRequestMessage(new HttpMethod((string)input["method"]!), address + (string)input["path"]!);
            var payload = input.TryGetValue("bodyBase64", out var encoded) ? Convert.FromBase64String((string)encoded!) : System.Text.Encoding.UTF8.GetBytes((string)input.GetValueOrDefault("body", "")!);
            request.Content = new ByteArrayContent(payload);
            foreach (var (name, value) in (Node)input.GetValueOrDefault("headers", new Node())!)
                if (!request.Headers.TryAddWithoutValidation(name, (string)value!)) request.Content.Headers.TryAddWithoutValidation(name, (string)value!);
            using var timeout = new CancellationTokenSource(8000);
            try
            {
                var call = client.SendAsync(request, timeout.Token);
                if (body.GetValueOrDefault("cancel") is true)
                {
                    await started.Task.WaitAsync(TimeSpan.FromSeconds(3));
                    await timeout.CancelAsync();
                }
                using var response = await call;
                return new { status = (int)response.StatusCode, headers = response.Headers.Concat(response.Content.Headers).ToDictionary(pair => pair.Key.ToLowerInvariant(), pair => string.Join(", ", pair.Value)),
                    body = await response.Content.ReadAsStringAsync(timeout.Token), invoked };
            }
            catch (OperationCanceledException) when (body.GetValueOrDefault("cancel") is true)
            {
                await finished.Task.WaitAsync(TimeSpan.FromSeconds(3));
                return new { cancelled, invoked };
            }
        }
        finally { await host.StopAsync(); }
    }
}
