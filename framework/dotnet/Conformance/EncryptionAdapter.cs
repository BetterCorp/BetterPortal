using AnyVali;
using BetterPortal;
using System.Collections.Concurrent;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class EncryptionAdapter
{
    private static readonly ConcurrentDictionary<string, ConfigCipher> Ciphers = new();
    internal static object Run(Node body)
    {
        try
        {
            string Text(string name) => (string)body[name]!;
            var action = Text("action");
            if (action == "crypto-keys") return new { valid = true, output = new { storage = ConfigCipher.GenerateKey(), preview = PreviewConfig.GenerateKey() } };
            var key = Text("key");
            var value = body["value"];
            object? output;
            if (action is "crypto-store-encrypt" or "crypto-store-decrypt")
            {
                if (Ciphers.Count >= 4 && !Ciphers.ContainsKey(key)) Ciphers.Clear();
                var cipher = Ciphers.GetOrAdd(key, key => new ConfigCipher(key));
                output = action.EndsWith("-encrypt", StringComparison.Ordinal) ? cipher.Encrypt(value) : cipher.Decrypt((string)value!);
            }
            else if (action is "crypto-preview-encrypt" or "crypto-preview-decrypt")
            {
                var path = ((IEnumerable<object>)body["path"]!);
                output = action.EndsWith("-encrypt", StringComparison.Ordinal)
                    ? PreviewConfig.EncryptValue(key, Text("scope"), path, (string)value!)
                    : PreviewConfig.DecryptValue(key, Text("scope"), path, (string)value!);
            }
            else if (action is "crypto-preview-fields-encrypt" or "crypto-preview-fields-decrypt")
            {
                var schema = PreviewConfig.Schema(((IEnumerable<object?>)body["descriptors"]!).Cast<Node>(), Text("scope"));
                if (body.GetValueOrDefault("roundtrip") is true) schema = V.Import(V.Export(schema));
                output = action.EndsWith("-encrypt", StringComparison.Ordinal)
                    ? PreviewConfig.Encrypt(schema, key, Text("scope"), value) : PreviewConfig.Decrypt(schema, key, Text("scope"), value);
            }
            else throw new ArgumentException("Unknown encryption action");
            return new { valid = true, output };
        }
        catch (Exception error) { return new { valid = false, errorType = error.GetType().Name }; }
    }
}
