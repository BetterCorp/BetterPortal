using AnyVali;
using BetterPortal;
using System.Net.ServerSentEvents;
using System.Text;
using System.Threading.Channels;

internal static class SseAdapter
{
    public static async Task<IResult> Wire(Dictionary<string, object?> body)
    {
        async IAsyncEnumerable<SseItem<string>> Events()
        {
            await Task.CompletedTask;
            foreach (var item in ((List<object?>)body["events"]!).Cast<Dictionary<string, object?>>())
                yield return new((string)item["data"]!, (string?)item.GetValueOrDefault("event"))
                { EventId = (string?)item.GetValueOrDefault("id"), ReconnectionInterval = item.TryGetValue("retry", out var retry) ? TimeSpan.FromMilliseconds(Convert.ToDouble(retry)) : null };
        }
        try
        {
            using var output = new MemoryStream();
            await SseWire.Write(Events(), output, Convert.ToInt32(body.GetValueOrDefault("maxDataBytes", 1024 * 1024)));
            return Results.Bytes(output.ToArray(), "text/event-stream; charset=utf-8");
        }
        catch (ArgumentException) { return Results.Json(new { error = "Invalid SSE event" }, statusCode: 400); }
    }

    public static async Task<Dictionary<string, bool>> Probe()
    {
        var result = new Dictionary<string, bool>();
        await using var transport = new LocalEvents(capacity: 4, maxPayloadBytes: 1024);
        var route = new SseRoute<string, string, string>("view", V.String(), V.String(), (value, context, _) => ValueTask.FromResult(value + context), transport);
        var other = new SseRoute<string, string, string>("other", V.String(), V.String(), (value, context, _) => ValueTask.FromResult(value + context), transport);
        var scopes = new[] { new EventScope("tenant", "app"), new EventScope("tenant", "other"), new EventScope("other", "app") };
        await using (var first = await route.Subscribe(scopes[0], "-one"))
        await using (var second = await route.Subscribe(scopes[0], "-two"))
        await using (var app = await route.Subscribe(scopes[1], ""))
        await using (var tenant = await route.Subscribe(scopes[2], ""))
        await using (var view = await other.Subscribe(scopes[0], ""))
        {
            await route.Publish(scopes[0], "own"); await route.Publish(scopes[1], "app");
            await route.Publish(scopes[2], "tenant"); await other.Publish(scopes[0], "view");
            foreach (var (subscription, expected) in new[] { (first, "own-one"), (second, "own-two"), (app, "app"), (tenant, "tenant"), (view, "view") })
            {
                await using var iterator = subscription.Read().GetAsyncEnumerator();
                if (!await iterator.MoveNextAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(1)) || iterator.Current != expected) throw new Exception("Scope leaked");
            }
            result["scope-route-fanout"] = true;
            for (var value = 0; value < 5; value++) await route.Publish(scopes[0], value.ToString());
            await using var overflowing = first.Read().GetAsyncEnumerator();
            try { await overflowing.MoveNextAsync(); throw new Exception("Overflow accepted"); }
            catch (SubscriptionOverflowException) { }
            result["overflow"] = true;
            await route.Publish(scopes[1], "still-active");
            await using var active = app.Read().GetAsyncEnumerator();
            if (!await active.MoveNextAsync() || active.Current != "still-active") throw new Exception("Overflow crossed scope");
            result["overflow-isolated"] = true;
        }
        await using (var fresh = await route.Subscribe(scopes[0], ""))
        {
            await route.Publish(scopes[0], "fresh");
            await using var iterator = fresh.Read().GetAsyncEnumerator();
            if (!await iterator.MoveNextAsync() || iterator.Current != "fresh") throw new Exception("Old history leaked");
        }
        result["no-history"] = true;
        await using (var idle = await route.Subscribe(scopes[0], ""))
        {
            using var cancel = new CancellationTokenSource();
            await using var iterator = idle.Read(cancel.Token).GetAsyncEnumerator();
            var waiting = iterator.MoveNextAsync().AsTask();
            cancel.Cancel();
            try { await waiting.WaitAsync(TimeSpan.FromSeconds(1)); throw new Exception("Cancellation returned event"); }
            catch (OperationCanceledException) { }
        }
        result["idle-cancel"] = true;
        var invalidInput = new SseRoute<object?, string, object?>("invalidInput", V.String(), V.String(), (_, _, _) => ValueTask.FromResult(""), transport);
        try { await invalidInput.Publish(scopes[0], 1); throw new Exception("Invalid input accepted"); }
        catch (ValidationError) { }
        result["input-validation"] = true;
        var invalid = new SseRoute<string, object?, object?>("invalid", V.String(), V.String(), (_, _, _) => ValueTask.FromResult<object?>(42), transport);
        await using (var events = await invalid.Subscribe(scopes[0], null))
        {
            await invalid.Publish(scopes[0], "value");
            await using var iterator = events.Read().GetAsyncEnumerator();
            try { await iterator.MoveNextAsync(); throw new Exception("Invalid event accepted"); }
            catch (ValidationError) { }
        }
        result["event-validation"] = true;
        foreach (var payload in new[] { "false"u8.ToArray(), "\"unterminated"u8.ToArray(), new byte[] { 34, 255, 34 } })
        {
            await using var events = await route.Subscribe(scopes[0], "");
            await transport.Publish(new("view", scopes[0]), payload);
            await using var iterator = events.Read().GetAsyncEnumerator();
            try { await iterator.MoveNextAsync(); throw new Exception("Corrupt transport payload accepted"); }
            catch (Exception error) when (error is ValidationError or System.Text.Json.JsonException or System.Text.DecoderFallbackException) { }
        }
        result["transport-validation"] = true;
        var bounded = new SseRoute<string, string, object?>("bounded", V.String(), V.String(), (value, _, _) => ValueTask.FromResult(string.Concat(Enumerable.Repeat(value, 10))), transport, maxPayloadBytes: 16);
        await using (var events = await bounded.Subscribe(scopes[0], null))
        {
            await bounded.Publish(scopes[0], "long");
            await using var iterator = events.Read().GetAsyncEnumerator();
            try { await iterator.MoveNextAsync(); throw new Exception("Oversized event accepted"); }
            catch (ArgumentException) { }
        }
        try { await bounded.Publish(scopes[0], new string('x', 17)); throw new Exception("Oversized input accepted"); }
        catch (ArgumentException) { }
        result["payload-bounds"] = true;
        var snapshot = new SseRoute<Dictionary<string, string>, string, string>("snapshot", V.Object(new() { ["value"] = V.String() }), V.String(),
            (value, context, _) => { var original = value["value"]; value["value"] = context; return ValueTask.FromResult(original); }, transport);
        await using (var first = await snapshot.Subscribe(scopes[0], "one"))
        await using (var second = await snapshot.Subscribe(scopes[0], "two"))
        {
            var value = new Dictionary<string, string> { ["value"] = "before" };
            await snapshot.Publish(scopes[0], value);
            value["value"] = "after";
            foreach (var subscription in new[] { first, second })
            {
                await using var iterator = subscription.Read().GetAsyncEnumerator();
                if (!await iterator.MoveNextAsync() || iterator.Current != "before") throw new Exception("Mutable publication leaked");
            }
        }
        result["publication-snapshot"] = true;
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var mapping = new SseRoute<string, string, object?>("mapping", V.String(), V.String(), async (value, _, signal) =>
        { started.SetResult(); await Task.Delay(Timeout.Infinite, signal); return value; }, transport);
        await using (var events = await mapping.Subscribe(scopes[0], null))
        {
            using var cancel = new CancellationTokenSource();
            await mapping.Publish(scopes[0], "value");
            await using var iterator = events.Read(cancel.Token).GetAsyncEnumerator();
            var waiting = iterator.MoveNextAsync().AsTask();
            await started.Task.WaitAsync(TimeSpan.FromSeconds(1));
            cancel.Cancel();
            try { await waiting.WaitAsync(TimeSpan.FromSeconds(1)); throw new Exception("Mapper cancellation returned event"); }
            catch (OperationCanceledException) { }
        }
        result["mapper-cancel"] = true;
        await using (var idle = await transport.Subscribe(new("raw", scopes[0])))
        {
            await using var iterator = idle.Read().GetAsyncEnumerator();
            var waiting = iterator.MoveNextAsync().AsTask();
            await transport.DisposeAsync();
            if (await waiting.WaitAsync(TimeSpan.FromSeconds(1))) throw new Exception("Closed transport returned an event");
        }
        try { await route.Publish(scopes[0], "closed"); throw new Exception("Closed transport accepted publish"); }
        catch (ObjectDisposedException) { }
        result["shutdown"] = true;
        foreach (var pair in await WireProbe()) result[pair.Key] = pair.Value;
        return result;
    }

    private sealed class Tracked(IEventTransport inner) : IEventTransport
    {
        internal readonly TaskCompletionSource Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal int Closed;
        public ValueTask Publish(EventAddress address, ReadOnlyMemory<byte> data, CancellationToken cancellation = default) => inner.Publish(address, data, cancellation);
        public async ValueTask<IEventSubscription> Subscribe(EventAddress address, CancellationToken cancellation = default)
        { var subscription = await inner.Subscribe(address, cancellation); Started.TrySetResult(); return new Owned(this, subscription); }
        private sealed class Owned(Tracked owner, IEventSubscription inner) : IEventSubscription
        {
            public IAsyncEnumerable<ReadOnlyMemory<byte>> Read(CancellationToken cancellation = default) => inner.Read(cancellation);
            public async ValueTask DisposeAsync() { await inner.DisposeAsync(); owner.Closed++; }
        }
        public ValueTask DisposeAsync() => inner.DisposeAsync();
    }
    private sealed class Capture : MemoryStream
    {
        internal readonly Channel<string> Flushed = Channel.CreateUnbounded<string>();
        internal Task? HoldFlush;
        private int offset;
        public override async Task FlushAsync(CancellationToken cancellation)
        {
            var data = ToArray();
            Flushed.Writer.TryWrite(Encoding.UTF8.GetString(data, offset, data.Length - offset));
            offset = data.Length;
            if (HoldFlush is not null) await HoldFlush.WaitAsync(cancellation);
        }
        internal Task<string> Next() => Flushed.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(2));
    }
    private static async Task<Dictionary<string, bool>> WireProbe()
    {
        await using var transport = new Tracked(new LocalEvents());
        var route = new SseRoute<string, string, object?>("wire", V.String(), V.String(), (value, _, _) => ValueTask.FromResult(value), transport);
        var scope = new EventScope("tenant", "app");
        var rendering = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async ValueTask<string> Render(string value, CancellationToken signal)
        {
            if (value == "bad") throw new Exception("private renderer detail");
            if (value == "oversize") return new string('x', 1024 * 1024 + 1);
            if (value == "pending") { rendering.SetResult(); await Task.Delay(Timeout.Infinite, signal); }
            return "<b>" + value + "</b>\n";
        }
        using var output = new Capture();
        using var cancel = new CancellationTokenSource();
        var work = route.WriteSse(scope, null, output, Render, cancellation: cancel.Token);
        try
        {
            await transport.Started.Task.WaitAsync(TimeSpan.FromSeconds(2));
            await route.Publish(new("other", "app"), "leak");
            await route.Publish(scope, "good");
            if (await output.Next() != "data: <b>good</b>\ndata: \n\n") throw new Exception("Rendered SSE scope/data changed");
            foreach (var value in new[] { "bad", "oversize" })
            {
                await route.Publish(scope, value);
                if (await output.Next() != "event: error\ndata: {\"code\":\"render_failed\",\"message\":\"Event rendering failed\"}\n\n") throw new Exception("Unsafe renderer failure");
            }
            await route.Publish(scope, "after");
            if (!(await output.Next()).Contains("<b>after</b>")) throw new Exception("Renderer failure closed stream");
            await route.Publish(scope, "pending");
            await rendering.Task.WaitAsync(TimeSpan.FromSeconds(2));
        }
        finally { cancel.Cancel(); }
        try { await work.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Renderer cancellation returned success"); }
        catch (OperationCanceledException) { }
        if (transport.Closed != 1) throw new Exception("Subscription leaked");

        using var idle = new CancellationTokenSource();
        var idleWork = route.WriteSse(scope, null, output, cancellation: idle.Token);
        idle.Cancel();
        try { await idleWork.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Idle cancellation returned success"); }
        catch (OperationCanceledException) { }
        if (transport.Closed != 2) throw new Exception("Idle subscription leaked");

        var produced = 0; var closed = false;
        async IAsyncEnumerable<SseItem<string>> Items()
        {
            await Task.CompletedTask;
            try { for (var i = 0; i < 3; i++) { produced++; yield return new(i.ToString()); } }
            finally { closed = true; }
        }
        var hold = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var slow = new Capture { HoldFlush = hold.Task };
        using var stop = new CancellationTokenSource();
        var writing = SseWire.Write(Items(), slow, cancellation: stop.Token);
        await slow.Next();
        if (produced != 1) throw new Exception("SSE producer outran destination");
        stop.Cancel();
        try { await writing.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Cancelled write succeeded"); }
        catch (OperationCanceledException) { }
        if (!closed) throw new Exception("SSE producer leaked");
        return new() { ["wire-render-recovery"] = true, ["wire-render-cancel"] = true, ["wire-close"] = true, ["wire-flush-backpressure"] = true };
    }
}
