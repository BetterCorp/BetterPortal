using BetterPortal;

internal static class KeyAdapter
{
    internal static async Task<object> Run(Dictionary<string, object?> body)
    {
        if (Equals(body["action"], "keys-url"))
        {
            try { TrustedKeys.SecureEndpoint((string)body["uri"]!); return new { valid = true }; }
            catch (ArgumentException) { return new { valid = false }; }
        }
        var results = new List<object>();
        await using var client = new JwksClient((string)body["issuer"]!, (string)body["uri"]!);
        foreach (var step in ((IEnumerable<object?>)body["steps"]!).Cast<Dictionary<string, object?>>())
        {
            if (step.GetValueOrDefault("invalidate") is true)
            {
                client.Invalidate();
                results.Add(new { invalidated = true });
                continue;
            }
            try
            {
                string pem;
                var kid = (string)step["kid"]!;
                if (step.GetValueOrDefault("cancel") is true || step.GetValueOrDefault("close") is true || step.GetValueOrDefault("invalidateDuring") is true)
                {
                    using var cancellation = new CancellationTokenSource();
                    var task = client.ResolveAsync(kid, cancellation.Token);
                    await Task.Delay(25);
                    if (step.GetValueOrDefault("cancel") is true) await cancellation.CancelAsync();
                    else if (step.GetValueOrDefault("close") is true) await client.DisposeAsync();
                    else client.Invalidate();
                    pem = await task;
                }
                else
                {
                    var count = Convert.ToInt32(step.GetValueOrDefault("parallel", 1));
                    var values = await Task.WhenAll(Enumerable.Range(0, count).Select(_ => client.ResolveAsync(kid)));
                    if (values.Distinct().Count() != 1) throw new Exception("Inconsistent parallel keys");
                    pem = values[0];
                }
                results.Add(new { valid = true, pem });
            }
            catch (OperationCanceledException) { results.Add(new { cancelled = true }); }
            catch (TokenException) { results.Add(new { valid = false }); }
        }
        return new { results };
    }
}
