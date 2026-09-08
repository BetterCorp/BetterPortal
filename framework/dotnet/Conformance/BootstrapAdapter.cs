using BetterPortal;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class BootstrapAdapter
{
    internal static async Task<object> Run(Node body)
    {
        try
        {
            var key = (string)body["key"]!; var cipher = new BootstrapCipher(key);
            if (body["operation"] is "encrypt") return new { valid = true, stored = Encoding.UTF8.GetString(cipher.Encrypt(body["state"])) };
            if (body["operation"] is "decrypt") return new { valid = true, state = cipher.Decrypt(Encoding.UTF8.GetBytes((string)body["stored"]!)) };
            var directory = Path.Combine(Path.GetTempPath(), "bp-bootstrap-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
            try
            {
                var fault = new FaultStore(directory, body.TryGetValue("limit", out var limit) ? Convert.ToInt32(limit) : 2 * 1024 * 1024);
                var file = new FileStateStore(Path.Combine(directory, "state.json"));
                if (body.TryGetValue("stored", out var stored)) await file.Save(Encoding.UTF8.GetBytes((string)stored!));
                var store = new BootstrapStateStore(fault, key); var outcomes = new List<Node>();
                foreach (var step in ((List<object?>)body["steps"]!).Cast<Node>())
                {
                    fault.Mode = step.GetValueOrDefault("mode") as string ?? "ok";
                    var result = new Node { ["valid"] = true };
                    try
                    {
                        switch (step["kind"])
                        {
                            case "read": result["state"] = await store.Read(step.GetValueOrDefault("redacted") is true); break;
                            case "write": result["state"] = await store.Write((Node)step["patch"]!); break;
                            case "clear": await store.Clear(); break;
                            case "identity": result["jwk"] = (await store.Identity()).PublicJwk(); break;
                            case "restart": store = new BootstrapStateStore(fault, key); break;
                            case "parallel": await Task.WhenAll(((List<object?>)step["patches"]!).Cast<Node>().Select(patch => store.Write(patch).AsTask())); break;
                            case "cancel":
                                fault.Mode = "block"; fault.Started = new(TaskCreationOptions.RunContinuationsAsynchronously); fault.Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
                                using (var cancellation = new CancellationTokenSource())
                                {
                                    Task task = step.GetValueOrDefault("identity") is true ? store.Identity(cancellation.Token).AsTask() : store.Write((Node)step["patch"]!, cancellation.Token).AsTask();
                                    await fault.Started.Task.WaitAsync(TimeSpan.FromSeconds(5)); cancellation.Cancel();
                                    try { await task; } catch (OperationCanceledException) { result["cancelled"] = true; }
                                    finally { fault.Release.TrySetResult(); }
                                }
                                break;
                            default: throw new ArgumentException("Unknown bootstrap step");
                        }
                    }
                    catch (Exception error) { result = new Node { ["valid"] = false, ["error"] = error.Message }; }
                    result["stored"] = Encoding.UTF8.GetString(await file.Load() ?? []); outcomes.Add(result);
                }
                return new { valid = true, outcomes };
            }
            finally
            {
                if (!Path.GetFullPath(directory).StartsWith(Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid temporary directory");
                Directory.Delete(directory, recursive: true);
            }
        }
        catch (Exception error) { return new { valid = false, error = error.Message }; }
    }
}
