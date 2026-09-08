using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class SettingsAdapter
{
    internal static async Task<object> Store(Node body)
    {
        var directory = Directory.CreateTempSubdirectory("bp-settings-");
        var path = Path.Combine(directory.FullName, "state.json");
        var store = new FaultStore(directory.FullName, Convert.ToInt32(body.GetValueOrDefault("maxBytes", 16 * 1024 * 1024)));
        if (body.GetValueOrDefault("stored") is string saved) await File.WriteAllTextAsync(path, saved);
        var schema = new SettingsSchema(((List<object?>)body["descriptors"]!).Select(item => Contracts.Parse<BetterPortal.Generated.ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", item)));
        var cipher = new ConfigCipher((string)body["key"]!);
        var settings = new ServiceSettings(schema, cipher, body.GetValueOrDefault("memory") is true ? null : store);
        var outcomes = new List<Node>();
        Task<Node> Write(Node step, CancellationToken cancellation = default) => settings.Write((string)step["tenantId"]!, step["values"]!, step.GetValueOrDefault("appId") as string,
            ((List<object?>)step.GetValueOrDefault("clearKeys", new List<object?>())!).Cast<string>(), cancellation);
        try
        {
            foreach (var step in ((List<object?>)body["steps"]!).Cast<Node>())
            {
                var result = new Node();
                try
                {
                    var kind = (string)step["kind"]!;
                    switch (kind)
                    {
                        case "initialize": store.Mode = (string)step.GetValueOrDefault("mode", "ok")!; result["loaded"] = await settings.Initialize(step.GetValueOrDefault("legacyTenantId") as string); break;
                        case "write": store.Mode = (string)step.GetValueOrDefault("mode", "ok")!; result["values"] = await Write(step); break;
                        case "read": result["values"] = settings.Values((string)step["tenantId"]!, step.GetValueOrDefault("appId") as string, step.GetValueOrDefault("redacted") is true); break;
                        case "effective": result["values"] = settings.Effective((string)step["tenantId"]!, (string)step["appId"]!); break;
                        case "mutate": ((Node)settings.Read((string)step["tenantId"]!)["tenant"]!)["secret"] = "MUTATED"; break;
                        case "restart": await settings.DisposeAsync(); settings = new(schema, cipher, store); break;
                        case "close": await settings.DisposeAsync(); break;
                        case "concurrent": await Task.WhenAll(((List<object?>)step["writes"]!).Cast<Node>().Select(value => Write(value))); break;
                        case "cancel-write": case "close-write": case "concurrent-save": case "cancel-initialize": case "cancel-migration":
                            store.Mode = "block"; store.Started = new(TaskCreationOptions.RunContinuationsAsynchronously); store.Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
                            if (kind == "cancel-initialize") store.LoadMode = "block";
                            using (var cancellation = new CancellationTokenSource())
                            {
                                Task pending = kind is "cancel-initialize" or "cancel-migration" ? settings.Initialize(step.GetValueOrDefault("legacyTenantId") as string, cancellation.Token) : Write(step, cancellation.Token);
                                await store.Started.Task.WaitAsync(TimeSpan.FromSeconds(2));
                                if (kind == "concurrent-save")
                                {
                                    var following = Write((Node)step["following"]!);
                                    store.Release.TrySetResult(); await Task.WhenAll(pending, following);
                                }
                                else
                                {
                                    if (kind == "close-write") await settings.DisposeAsync();
                                    else cancellation.Cancel();
                                    try { await pending; throw new Exception("Expected cancellation"); }
                                    catch (OperationCanceledException) { result["cancelled"] = true; }
                                }
                            }
                            store.Mode = store.LoadMode = "ok";
                            break;
                        default: throw new ArgumentException("Unknown test step");
                    }
                    result["valid"] = true;
                }
                catch (Exception error) { result["valid"] = false; result["errorType"] = error.GetType().Name; }
                result["ready"] = settings.Ready; result["saves"] = store.Saves; result["stored"] = File.Exists(path) ? await File.ReadAllTextAsync(path) : null;
                outcomes.Add(result);
            }
            return new { outcomes, stored = File.Exists(path) ? await File.ReadAllTextAsync(path) : null };
        }
        finally { await settings.DisposeAsync(); directory.Delete(recursive: true); }
    }
    internal static object Run(Node body)
    {
        try
        {
            var schema = new SettingsSchema(((List<object?>)body["descriptors"]!).Select(item => Contracts.Parse<BetterPortal.Generated.ConfigSchemaDescriptorInput>("ConfigSchemaDescriptorSchema", item)));
            var scope = (string)body.GetValueOrDefault("scope", "tenant")!;
            var output = body["command"] switch
            {
                "values" => schema.Values(scope, body["values"], body.GetValueOrDefault("partial", true) is true),
                "encode" => schema.Encode(scope, body["values"], new ConfigCipher((string)body["key"]!)),
                "decode" => schema.Decode(scope, body["values"], new ConfigCipher((string)body["key"]!)),
                "redact" => schema.Redact(scope, body["values"]),
                "merge" => schema.Merge(scope, body["current"], body["values"], ((List<object?>)body.GetValueOrDefault("clearKeys", new List<object?>())!).Cast<string>()),
                "effective" => schema.Effective(body["tenant"], body["app"]),
                _ => throw new ArgumentException("Unknown test command")
            };
            return new { valid = true, output };
        }
        catch (Exception error) { return new { valid = false, errorType = error.GetType().Name }; }
    }
}
