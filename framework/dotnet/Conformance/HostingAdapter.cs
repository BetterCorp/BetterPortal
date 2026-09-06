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
        var stream = new Node { ["reads"] = 0, ["closed"] = false };
        var hasStream = false;
        var firstWrite = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseWrite = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var registry = new Registry(((List<object?>)body["routes"]!).Cast<Node>().Select(item => new Route((string)item["viewId"]!, (string)item["path"]!,
            ((List<object?>)item["operations"]!).Cast<Node>().Select(spec =>
            {
                var schemas = (Node)spec.GetValueOrDefault("schemas", new Node())!;
                AnyVali.Schema? Schema(string name) => schemas.TryGetValue(name, out var value) ? Contracts.Import(Json.Write(value)) : null;
                async ValueTask<object?> Execute(HandlerContext<object?, object?, object?, object?> context)
                {
                    Interlocked.Increment(ref invoked);
                    if (spec.TryGetValue("status", out var statusCode)) context.Response.Status = Convert.ToInt32(statusCode);
                    foreach (var header in ((List<object?>)spec.GetValueOrDefault("responseHeaders", new List<object?>())!).Cast<List<object?>>()) context.Response.SetHeader((string)header[0]!, (string)header[1]!, append: true);
                    if (spec.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-password-must-not-leak");
                    if (spec.GetValueOrDefault("urlCalls") is List<object?> calls) return UrlCalls(context.Urls, calls);
                    if (spec.GetValueOrDefault("wait") is true)
                    {
                        started.TrySetResult();
                        try { await Task.Delay(30000, context.Cancellation); }
                        catch (OperationCanceledException) when (spec.GetValueOrDefault("returnOnCancel") is true) { }
                        finally { cancelled = true; if (spec.GetValueOrDefault("returnOnCancel") is not true) finished.TrySetResult(); }
                    }
                    if (spec.TryGetValue("result", out var result)) return result;
                    if (spec.GetValueOrDefault("raw") is Node raw)
                    {
                        var status = Convert.ToInt32(raw.GetValueOrDefault("status", 200));
                        var headers = ((List<object?>)raw.GetValueOrDefault("headers", new List<object?>())!).Cast<List<object?>>()
                            .Select(pair => new KeyValuePair<string, string>((string)pair[0]!, (string)pair[1]!)).ToArray();
                        var filename = (string?)raw.GetValueOrDefault("filename");
                        var contentType = (string)raw.GetValueOrDefault("contentType", "application/octet-stream")!;
                        if (raw.ContainsKey("chunks"))
                        {
                            hasStream = true;
                            var producer = new RawBody(raw, stream, started, finished, () => cancelled = true);
                            return filename is null ? new RawResponse(producer, status, headers) : RawResponse.File(producer, filename, contentType, raw.GetValueOrDefault("inline") is true);
                        }
                        var bytes = Convert.FromBase64String((string)raw.GetValueOrDefault("body", "")!);
                        return filename is null ? new RawResponse(bytes, status, headers) : RawResponse.File(bytes, filename, contentType, raw.GetValueOrDefault("inline") is true);
                    }
                    var request = context.RequestContext;
                    return new Node { ["params"] = context.Params, ["query"] = context.Query, ["request"] = context.Request, ["multipart"] = request.Multipart,
                        ["tenantId"] = request.Scope.TenantId, ["appId"] = request.Scope.AppId, ["caller"] = request.Caller.Mode, ["user"] = request.Caller.User?.GetValueOrDefault("sub") };
                }
                Handler handler = spec.ContainsKey("raw") && spec.GetValueOrDefault("jsonHandler") is not true
                    ? new RawHandler<object?, object?, object?, object?>(async context => (RawResponse)(await Execute(context))!, Schema("params"), Schema("query"), Schema("headers"), Schema("request"))
                    : new Handler<object?, object?, object?, object?, object?>(Contracts.Import(Json.Write(spec["response"])), Execute, Schema("params"), Schema("query"), Schema("headers"), Schema("request"),
                        ((List<object?>)spec.GetValueOrDefault("renderers", new List<object?>())!).Cast<Node>().Select(item => new Renderer<object?>(
                            Contracts.Parse<BetterPortal.Generated.RendererDeclarationInput>("RendererDeclarationSchema", item["declaration"]), async (data, context) =>
                            {
                                if (item.GetValueOrDefault("wait") is true)
                                {
                                    started.TrySetResult();
                                    try { await Task.Delay(30000, context.Cancellation); }
                                    finally { cancelled = true; finished.TrySetResult(); }
                                }
                                if (item.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-render-secret");
                                if (item.TryGetValue("text", out var text)) return (string)text!;
                                return "<pre>" + System.Net.WebUtility.HtmlEncode(Json.Write(item.GetValueOrDefault("urlCalls") is List<object?> calls ? UrlCalls(context.Urls, calls) : new { data, context = context.Data })) + "</pre>";
                            })));
                return new Operation(handler, Contracts.Parse<BetterPortal.Generated.OperationDeclarationInput>("OperationDeclarationSchema", spec["declaration"]),
                    ((List<object?>)spec.GetValueOrDefault("errorRenderers", new List<object?>())!).Cast<Node>().Select(item => new Renderer<BetterPortal.Generated.ViewRenderError>(
                        Contracts.Parse<BetterPortal.Generated.RendererDeclarationInput>("RendererDeclarationSchema", item["declaration"]), async (data, context) =>
                        {
                            if (item.GetValueOrDefault("wait") is true)
                            {
                                started.TrySetResult();
                                try { await Task.Delay(30000, context.Cancellation); }
                                finally { cancelled = true; finished.TrySetResult(); }
                            }
                            if (item.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-render-secret");
                            if (item.TryGetValue("text", out var text)) return (string)text!;
                            return "<pre>" + System.Net.WebUtility.HtmlEncode(Json.Write(item.GetValueOrDefault("urlCalls") is List<object?> calls ? UrlCalls(context.Urls, calls) : new { data, context = context.Data })) + "</pre>";
                        })));
            }), ((List<object?>)item.GetValueOrDefault("pathVariants", new List<object?>())!).Cast<string>())),
            ((Node)body.GetValueOrDefault("dependencies", new Node())!).ToDictionary(pair => pair.Key, pair => (string)pair.Value!));
        await using var service = new Service(registry, Contracts.Parse<BetterPortal.Generated.ManifestDeclarationInput>("ManifestDeclarationSchema", body["declaration"]),
            body.GetValueOrDefault("snapshot") is { } snapshot ? new ScopedConfig(snapshot) : null);
        if (body.GetValueOrDefault("closed") is true) await service.DisposeAsync();
        var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders(); builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var host = builder.Build();
        if (body.GetValueOrDefault("rawOutputProbe") is "backpressure") host.Use(async (context, next) =>
        {
            var original = context.Response.Body;
            await using var output = new GatedOutput(original, firstWrite, releaseWrite);
            context.Response.Body = output;
            try { await next(context); }
            finally { context.Response.Body = original; }
        });
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
                var observed = 0;
                if (body.GetValueOrDefault("rawOutputProbe") is "backpressure")
                {
                    await firstWrite.Task.WaitAsync(TimeSpan.FromSeconds(3));
                    observed = Convert.ToInt32(stream["reads"]); releaseWrite.TrySetResult();
                }
                if (body.GetValueOrDefault("cancel") is true)
                {
                    await started.Task.WaitAsync(TimeSpan.FromSeconds(3));
                    await timeout.CancelAsync();
                }
                using var response = await call;
                var content = await response.Content.ReadAsByteArrayAsync(timeout.Token);
                if (hasStream) await finished.Task.WaitAsync(TimeSpan.FromSeconds(3));
                if (body.GetValueOrDefault("rawOutputProbe") is "backpressure") return new { observed, stream, invoked };
                return new { status = (int)response.StatusCode, headers = response.Headers.Concat(response.Content.Headers).ToDictionary(pair => pair.Key.ToLowerInvariant(), pair => string.Join(", ", pair.Value)),
                    body = System.Text.Encoding.UTF8.GetString(content), bodyBase64 = Convert.ToBase64String(content),
                    cookies = response.Headers.TryGetValues("set-cookie", out var cookies) ? cookies.ToArray() : [], stream, invoked };
            }
            catch (OperationCanceledException) when (body.GetValueOrDefault("cancel") is true)
            {
                await finished.Task.WaitAsync(TimeSpan.FromSeconds(3));
                if (body.GetValueOrDefault("rawProbe") is true) return new { cancelled, invoked, stream };
                return new { cancelled, invoked };
            }
            catch (HttpRequestException) when (body.GetValueOrDefault("rawProbe") is true)
            {
                if (hasStream) await finished.Task.WaitAsync(TimeSpan.FromSeconds(3));
                return new { transportError = true, stream, invoked };
            }
        }
        finally { releaseWrite.TrySetResult(); await host.StopAsync(); }
    }
    private static object?[] UrlCalls(Urls urls, List<object?> calls) => calls.Cast<Node>().Select(call =>
    {
        try
        {
            var options = call.GetValueOrDefault("options", new Node());
            BetterPortal.Generated.RouteUrlOptionsInput UrlOptions() => Contracts.Parse<BetterPortal.Generated.RouteUrlOptionsInput>("RouteUrlOptionsSchema", options);
            BetterPortal.Generated.RouteUiOptionsInput UiOptions() => Contracts.Parse<BetterPortal.Generated.RouteUiOptionsInput>("RouteUiOptionsSchema", options);
            return (string)call["kind"]! switch
            {
                "route" => urls.Route((string)call["viewId"]!, UrlOptions()),
                "uiRoute" => urls.UiRoute((string)call["viewId"]!, UrlOptions()),
                "path" => Urls.Path((string)call["path"]!, UrlOptions()),
                "current" => urls.Current(UrlOptions()),
                "currentUi" => (object)urls.CurrentUi(UiOptions()),
                "link" => Urls.Link((string)call["url"]!, UiOptions()),
                "form" => Urls.Form((string)call["url"]!, UiOptions()),
                "element" => urls.Element(Contracts.Parse<BetterPortal.Generated.BPElementReferenceInput>("BPElementReferenceSchema", call["reference"])),
                _ => throw new ArgumentException("Unknown URL fixture call")
            };
        }
        catch (Exception error) when (error is ArgumentException or AnyVali.ValidationError) { return new { invalid = true }; }
    }).ToArray();
    private sealed class GatedOutput(Stream destination, TaskCompletionSource first, TaskCompletionSource release) : MemoryStream
    {
        public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (first.TrySetResult()) await release.Task.WaitAsync(cancellationToken);
            await destination.WriteAsync(buffer, cancellationToken);
        }
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => WriteAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();
        public override Task FlushAsync(CancellationToken cancellationToken) => destination.FlushAsync(cancellationToken);
    }
    private sealed class RawBody(Node spec, Node state, TaskCompletionSource started, TaskCompletionSource finished, Action cancelled) : Stream
    {
        private int index;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var chunks = (List<object?>)spec["chunks"]!;
            if (index >= chunks.Count) return 0;
            state["reads"] = Convert.ToInt32(state["reads"]) + 1;
            if (index == 1 && spec.GetValueOrDefault("wait") is true)
            {
                started.TrySetResult();
                try { await Task.Delay(30000, cancellationToken); }
                finally { cancelled(); }
            }
            if (index == 1 && spec.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-stream-secret");
            var data = Convert.FromBase64String((string)chunks[index++]!);
            data.CopyTo(buffer); return data.Length;
        }
        public override ValueTask DisposeAsync() { state["closed"] = true; finished.TrySetResult(); return ValueTask.CompletedTask; }
    }
}
