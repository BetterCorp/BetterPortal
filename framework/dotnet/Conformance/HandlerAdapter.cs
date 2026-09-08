using BetterPortal;

internal static class HandlerAdapter
{
    public static async Task<object> Run(Dictionary<string, object?> body)
    {
        var called = false;
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var closed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var schemas = (Dictionary<string, object?>)body["schemas"]!;
        AnyVali.Schema? Schema(string name) => schemas.TryGetValue(name, out var value) ? Contracts.Import(Json.Write(value)) : null;
        var handler = new Handler<object?, object?, object?, object?, object?>(Contracts.Import(Json.Write(body["response"])), async context =>
        {
            called = true;
            if (body.GetValueOrDefault("cancel") is true)
            {
                try { started.SetResult(); await Task.Delay(Timeout.Infinite, context.Cancellation); }
                finally { closed.SetResult(); }
            }
            return body.TryGetValue("result", out var result) ? result : new Dictionary<string, object?>
                { ["params"] = context.Params, ["query"] = context.Query, ["headers"] = context.Headers, ["request"] = context.Request };
        }, Schema("params"), Schema("query"), Schema("headers"), Schema("request"));
        var scope = new ScopedConfig(body["config"]!).ById((string)body["tenantId"]!, (string)body["appId"]!)!;
        var context = new RequestContext(scope, new(), "POST", "/check/item");
        if (body.GetValueOrDefault("cancel") is true)
        {
            using var cancel = new CancellationTokenSource();
            var task = handler.Invoke(context, (Dictionary<string, object?>)body["values"]!, cancel.Token).AsTask();
            await started.Task.WaitAsync(TimeSpan.FromSeconds(2));
            cancel.Cancel();
            try { await task.WaitAsync(TimeSpan.FromSeconds(2)); throw new Exception("Cancelled handler returned success"); }
            catch (OperationCanceledException)
            {
                await closed.Task.WaitAsync(TimeSpan.FromSeconds(2));
                return new { cancelled = true, closed = true };
            }
        }
        try { return new { status = 200, output = await handler.Invoke(context, (Dictionary<string, object?>)body["values"]!), invoked = called }; }
        catch (HandlerInputException error) { return new { status = error.Status, field = error.Field, invoked = called }; }
        catch (HandlerOutputException error) { return new { status = error.Status, invoked = called }; }
    }
}
