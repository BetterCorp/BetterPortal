using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;

internal static class SettingsAdapter
{
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
