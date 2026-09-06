using BetterPortal;
using AnyVali;
using System.Runtime.CompilerServices;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal sealed class FeedProbe : IEventTransport
{
    private readonly Node body;
    private readonly TaskCompletionSource started, subscribed = new(TaskCreationOptions.RunContinuationsAsynchronously), closed = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly CancellationTokenSource stop = new();
    private readonly SemaphoreSlim mapped = new(0);
    private readonly SemaphoreSlim consumed = new(0);
    private readonly TaskCompletionSource overflowed = new(TaskCreationOptions.RunContinuationsAsynchronously), callbackStopped = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly LocalEvents inner;
    private readonly Dictionary<string, Node> specs;
    private readonly Dictionary<string, SseFeed<object?, object?>> feeds = [];
    private EventAddress? address;
    private Task? delivery;
    private int active, mappedCount, inputErrors;
    private bool wasClosed, cancelled;
    internal bool Enabled => specs.Count > 0;
    internal int Mapped => Volatile.Read(ref mappedCount);
    internal object Result => new { active = Volatile.Read(ref active), closed = wasClosed, mapped = Mapped, inputErrors, cancelled };
    internal FeedProbe(Node body, TaskCompletionSource started)
    {
        this.body = body; this.started = started;
        specs = ((List<object?>)body["routes"]!).Cast<Node>().Where(route => route.ContainsKey("feed")).ToDictionary(route => (string)route["viewId"]!, route => (Node)route["feed"]!);
        inner = new(Convert.ToInt32(body.GetValueOrDefault("feedCapacity", 256)));
    }
    internal Registry Bind(Registry registry)
    {
        if (!Enabled) return registry;
        return new(registry.Routes.Select(route =>
        {
            if (!specs.TryGetValue(route.ViewId, out var spec)) return route;
            var owner = (Handler<object?, object?, object?, object?>)route.Operations.Single(operation => operation.Method == "GET").Handler;
            async ValueTask<object?> Map(object? value, HandlerContext<object?, object?, object?, object?> context, CancellationToken cancellation)
            {
                Interlocked.Increment(ref mappedCount); mapped.Release();
                if (body.GetValueOrDefault("feedOverflow") is true) await overflowed.Task.WaitAsync(cancellation);
                if (spec.GetValueOrDefault("wait") is true && Mapped > Convert.ToInt32(spec.GetValueOrDefault("waitAfter", 0)))
                {
                    started.TrySetResult();
                    try { await Task.Delay(30000, cancellation); }
                    finally { cancelled = true; callbackStopped.TrySetResult(); }
                }
                if (spec.GetValueOrDefault("throw") is true) throw new InvalidOperationException("private-mapper-secret");
                if (spec.GetValueOrDefault("contextEvent") is true)
                {
                    var request = context.RequestContext;
                    return new Node { ["params"] = context.Params, ["query"] = context.Query, ["tenantId"] = request.Scope.TenantId, ["appId"] = request.Scope.AppId,
                        ["caller"] = request.Caller.Mode, ["user"] = request.Caller.User?.GetValueOrDefault("sub") };
                }
                return spec.GetValueOrDefault("result", value);
            }
            var contract = new SseRoute<object?, object?, HandlerContext<object?, object?, object?, object?>>(route.ViewId,
                Contracts.Import(Json.Write(spec["inputSchema"])), Contracts.Import(Json.Write(spec["eventSchema"])), Map, this,
                Convert.ToInt32(spec.GetValueOrDefault("maxPayloadBytes", 1024 * 1024)));
            var feed = SseFeed<object?, object?>.Bind(owner, contract, ((List<object?>)spec.GetValueOrDefault("renderers", new List<object?>())!).Cast<Node>().Select(item =>
                new Renderer<object?>(Contracts.Parse<BetterPortal.Generated.RendererDeclarationInput>("RendererDeclarationSchema", item["declaration"]), async (data, context) =>
                {
                    if (item.GetValueOrDefault("wait") is true)
                    {
                        started.TrySetResult();
                        try { await Task.Delay(30000, context.Cancellation); }
                        finally { cancelled = true; callbackStopped.TrySetResult(); }
                    }
                    if (item.GetValueOrDefault("throw") is true || item.TryGetValue("throwOn", out var marker) && Json.Write(data) == Json.Write(marker)) throw new InvalidOperationException("private-render-secret");
                    if (item.TryGetValue("text", out var text)) return (string)text!;
                    return "<pre>" + System.Net.WebUtility.HtmlEncode(Json.Write(item.GetValueOrDefault("dataOnly") is true ? data : new { data, context = context.Data })) + "</pre>";
                })));
            feeds[route.ViewId] = feed;
            return new BetterPortal.Route(route.ViewId, route.Paths[0], route.Operations, route.Paths.Skip(1), feed);
        }), registry.Dependencies);
    }
    public ValueTask Publish(EventAddress address, ReadOnlyMemory<byte> data, CancellationToken cancellation = default) => inner.Publish(address, data, cancellation);
    public async ValueTask<IEventSubscription> Subscribe(EventAddress address, CancellationToken cancellation = default)
    {
        var subscription = await inner.Subscribe(address, cancellation);
        this.address = address; Interlocked.Increment(ref active); subscribed.TrySetResult();
        if (body.GetValueOrDefault("feedCancelStage") is "subscribe") started.TrySetResult();
        return new Observed(this, subscription);
    }
    private sealed class Observed(FeedProbe owner, IEventSubscription subscription) : IEventSubscription
    {
        public async IAsyncEnumerable<ReadOnlyMemory<byte>> Read([EnumeratorCancellation] CancellationToken cancellation = default)
        {
            await foreach (var value in subscription.Read(cancellation)) { owner.consumed.Release(); yield return value; }
        }
        public async ValueTask DisposeAsync()
        {
            await subscription.DisposeAsync(); Interlocked.Decrement(ref owner.active); owner.wasClosed = true; owner.closed.TrySetResult();
        }
    }
    internal void Start() { if (Enabled) delivery = Deliver(stop.Token); }
    internal async Task WaitClosed()
    {
        await closed.Task.WaitAsync(TimeSpan.FromSeconds(3));
        if (body.GetValueOrDefault("feedCancelStage") is "mapper" or "renderer") await callbackStopped.Task.WaitAsync(TimeSpan.FromSeconds(3));
    }
    internal async Task<bool> TransportOpen()
    {
        await inner.Publish(address!.Value, "null"u8.ToArray());
        return true;
    }
    private async Task Deliver(CancellationToken cancellation)
    {
        await subscribed.Task.WaitAsync(cancellation);
        if (body.GetValueOrDefault("feedCancelStage") is "subscribe") await Task.Delay(Timeout.Infinite, cancellation);
        var target = address!.Value; var spec = specs[target.ViewId]; var app = (Node)((List<object?>)((Node)body["snapshot"]!)["apps"]!)[0]!;
        try
        {
            var index = 0;
            foreach (var publication in ((List<object?>)spec.GetValueOrDefault("publications", new List<object?>())!).Cast<Node>())
            {
                var destination = new EventAddress((string)publication.GetValueOrDefault("viewId", target.ViewId)!,
                    new((string)publication.GetValueOrDefault("tenantId", app["tenantId"])!, (string)publication.GetValueOrDefault("appId", app["id"])!));
                try
                {
                    if (publication.TryGetValue("raw", out var raw)) await inner.Publish(destination, System.Text.Encoding.UTF8.GetBytes((string)raw!), cancellation);
                    else if (destination.ViewId != target.ViewId) await inner.Publish(destination, System.Text.Encoding.UTF8.GetBytes(Json.Write(publication["value"])), cancellation);
                    else await feeds[target.ViewId].Publish(destination.Scope, publication["value"], cancellation);
                }
                catch (ValidationError) { inputErrors++; continue; }
                if (destination == target)
                {
                    if (publication.ContainsKey("raw")) await consumed.WaitAsync(cancellation);
                    else if (body.GetValueOrDefault("feedOverflow") is not true || index == 0) await mapped.WaitAsync(cancellation);
                }
                index++;
            }
        }
        finally { overflowed.TrySetResult(); await inner.DisposeAsync(); }
    }
    public async ValueTask DisposeAsync()
    {
        await stop.CancelAsync();
        if (delivery is not null) try { await delivery; } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        await inner.DisposeAsync(); stop.Dispose(); mapped.Dispose(); consumed.Dispose();
    }
}
