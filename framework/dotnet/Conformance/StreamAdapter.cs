using BetterPortal;

internal static class StreamAdapter
{
    private sealed class BrokenIterable : IAsyncEnumerable<StreamValue<object?, object?>>
    {
        public IAsyncEnumerator<StreamValue<object?, object?>> GetAsyncEnumerator(CancellationToken cancellation = default) => throw new Exception("private iterator error");
    }

    public static async Task<Dictionary<string, bool>> Probe()
    {
        var results = new Dictionary<string, bool>();
        var produced = new List<int>();
        var closed = 0;
        async IAsyncEnumerable<StreamValue<object?, object?>> Values(object? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken signal)
        {
            await Task.CompletedTask;
            try { for (var index = 0; index < 3; index++) { produced.Add(index); yield return StreamValue<object?, object?>.Item(index); } }
            finally { closed++; }
        }
        var handler = new StreamHandler<object?, object?, object?>(Contracts.Get("JsonValueSchema"), Values);
        var iterator = handler.Frames(null).GetAsyncEnumerator();
        if (!await iterator.MoveNextAsync()) throw new Exception("Missing item");
        await Task.Delay(20);
        if (!produced.SequenceEqual(new[] { 0 })) throw new Exception("Producer advanced without demand");
        await iterator.DisposeAsync();
        if (closed != 1) throw new Exception("Producer not closed");
        results["backpressure-close"] = true;
        foreach (var buffered in new[] { false, true })
        {
            using var cancel = new CancellationTokenSource();
            var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async IAsyncEnumerable<StreamValue<object?, object?>> Pending(object? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken signal)
            {
                try
                {
                    yield return StreamValue<object?, object?>.Item(1);
                    started.SetResult();
                    await Task.Delay(Timeout.Infinite, signal);
                }
                finally { finished.TrySetResult(); }
            }
            var stream = new StreamHandler<object?, object?, object?>(Contracts.Get("JsonValueSchema"), Pending);
            var seen = new List<Dictionary<string, object?>>();
            async Task Consume()
            {
                if (buffered) await stream.Buffered(null, cancellation: cancel.Token);
                else await foreach (var frame in stream.Frames(null, cancel.Token)) seen.Add(frame);
            }
            var work = Consume();
            await started.Task.WaitAsync(TimeSpan.FromSeconds(1));
            cancel.Cancel();
            try { await work.WaitAsync(TimeSpan.FromSeconds(1)); throw new Exception("Cancellation returned success"); }
            catch (OperationCanceledException) { }
            await finished.Task.WaitAsync(TimeSpan.FromSeconds(1));
            if (seen.Any(frame => frame["kind"] is "end" or "error")) throw new Exception("Terminal after cancellation");
            results[buffered ? "cancel-buffered" : "cancel-producer"] = true;
        }
        using (var cancel = new CancellationTokenSource())
        {
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async IAsyncEnumerable<StreamValue<object?, object?>> Uncooperative(object? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken signal)
            {
                try { await gate.Task; yield return StreamValue<object?, object?>.Item(1); }
                finally { finished.TrySetResult(); }
            }
            var stream = new StreamHandler<object?, object?, object?>(Contracts.Get("JsonValueSchema"), Uncooperative);
            var frames = stream.Frames(null, cancel.Token).GetAsyncEnumerator();
            var next = frames.MoveNextAsync().AsTask();
            cancel.Cancel();
            try
            {
                try { await next.WaitAsync(TimeSpan.FromSeconds(1)); throw new Exception("Cancellation blocked"); }
                catch (OperationCanceledException) { }
            }
            finally { gate.TrySetResult(); await frames.DisposeAsync(); }
            await finished.Task.WaitAsync(TimeSpan.FromSeconds(1));
            results["cancel-uncooperative"] = true;
        }
        var recursive = new StreamHandler<object?, object?, object?>(Contracts.Get("JsonValueSchema"), Values, Contracts.Get("JsonValueSchema"));
        var value = Json.Read("{\"items\":[{\"a\":[null,{\"b\":1}]}],\"summary\":null}");
        if (Json.Write(Contracts.Parse(recursive.ResponseSchema, value)) != Json.Write(value)
            || Json.Write(Contracts.Parse(recursive.ResponseSchema, new Dictionary<string, object?>())) != "{\"items\":[]}"
            || recursive.ResponseSchema.SafeParse(new Dictionary<string, object?> { ["items"] = false }).Success) throw new Exception("Derived schema changed");
        results["derived-recursive-schema"] = true;
        return results;
    }
    public static async Task<IResult> Run(Dictionary<string, object?> body, CancellationToken cancellation)
    {
        async IAsyncEnumerable<StreamValue<object?, object?>> Produce(object? context, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken signal)
        {
            await Task.CompletedTask;
            foreach (var item in (List<object?>?)body.GetValueOrDefault("items") ?? [])
            {
                signal.ThrowIfCancellationRequested();
                if (body.TryGetValue("delay", out var delay)) await Task.Delay(Convert.ToInt32(delay), signal);
                yield return StreamValue<object?, object?>.Item(item);
            }
            if (body.GetValueOrDefault("fail") is true) throw new Exception("private producer error");
            if (body.TryGetValue("summary", out var summary)) yield return StreamValue<object?, object?>.Summary(summary);
            foreach (var item in (List<object?>?)body.GetValueOrDefault("afterSummary") ?? []) yield return StreamValue<object?, object?>.Item(item);
        }
        IAsyncEnumerable<StreamValue<object?, object?>> Factory(object? context, CancellationToken signal)
        {
            if (body.GetValueOrDefault("factoryFail") is true) throw new Exception("private factory error");
            return body.GetValueOrDefault("iteratorFail") is true ? new BrokenIterable() : Produce(context, signal);
        }
        var handler = new StreamHandler<object?, object?, object?>(Contracts.Import(Json.Write(body["itemSchema"])), Factory,
            body.TryGetValue("summarySchema", out var schema) ? Contracts.Import(Json.Write(schema)) : null,
            Convert.ToInt32(body.GetValueOrDefault("maxFrameBytes", 1024 * 1024)));
        if (body.GetValueOrDefault("format") is "buffered")
        {
            try
            {
                return Results.Text(Json.Write(await handler.Buffered(null, Convert.ToInt32(body.GetValueOrDefault("maxItems", 10000)),
                    Convert.ToInt32(body.GetValueOrDefault("maxBytes", 8 * 1024 * 1024)), cancellation)), "application/json");
            }
            catch (StreamException) { return Results.Json(new { error = "Stream failed" }, statusCode: 500); }
        }
        if (body.GetValueOrDefault("format") is "sse") return Results.Stream(output => SseWire.Write(handler.Sse(null, cancellation), output,
            Convert.ToInt32(body.GetValueOrDefault("maxFrameBytes", 1024 * 1024)), cancellation), "text/event-stream; charset=utf-8");
        return Results.Stream(async output =>
        {
            await foreach (var frame in handler.Ndjson(null, cancellation))
            {
                await output.WriteAsync(frame, cancellation);
                await output.FlushAsync(cancellation);
            }
        }, "application/x-ndjson; charset=utf-8");
    }
}
