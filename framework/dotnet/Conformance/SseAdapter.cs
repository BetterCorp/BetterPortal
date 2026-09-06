using AnyVali;
using BetterPortal;

internal static class SseAdapter
{
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
        return result;
    }
}
