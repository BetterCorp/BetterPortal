using AnyVali;
using System.Collections.Concurrent;
using System.Text.Json;

namespace BetterPortal;

public static class Contracts
{
    private static readonly ConcurrentDictionary<string, Schema> Schemas = new();
    public static IReadOnlyList<string> Names => typeof(Contracts).Assembly.GetManifestResourceNames()
        .Where(name => name.StartsWith("BetterPortal.Contracts.", StringComparison.Ordinal) && name.EndsWith(".json", StringComparison.Ordinal))
        .Select(name => name["BetterPortal.Contracts.".Length..^5]).Order(StringComparer.Ordinal).ToArray();
    public static Schema Get(string name, params string[] path) => Schemas.GetOrAdd(name + "/" + string.Join("/", path), _ => Import(Json.Write(Document(name, path))));

    public static Dictionary<string, object?> Document(string name, params string[] path)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, "\\A[A-Za-z][A-Za-z0-9_]*\\z"))
            throw new ArgumentException("Invalid contract name");
        var assembly = typeof(Contracts).Assembly;
        using var stream = assembly.GetManifestResourceStream($"BetterPortal.Contracts.{name}.json")
            ?? throw new ArgumentException($"Unknown contract {name}");
        using var reader = new StreamReader(stream);
        var document = (Dictionary<string, object?>)Json.Read(reader.ReadToEnd())!;
        foreach (var field in path)
        {
            var node = (Dictionary<string, object?>)document["root"]!;
            while (node["kind"] is "optional" or "nullable") node = (Dictionary<string, object?>)node["inner"]!;
            document["root"] = ((Dictionary<string, object?>)node["properties"]!)[field];
        }
        return document;
    }

    public static Schema Import(string json) => Import((Dictionary<string, object?>)Json.Read(json)!);

    public static Schema Import(Dictionary<string, object?> document)
    {
        return V.Import(new AnyValiDocument
        {
            AnyvaliVersion = (string)document["anyvaliVersion"]!,
            SchemaVersion = (string)document["schemaVersion"]!,
            Root = (Dictionary<string, object?>)document["root"]!,
            Definitions = (Dictionary<string, object?>?)document.GetValueOrDefault("definitions") ?? [],
            Extensions = (Dictionary<string, object?>?)document.GetValueOrDefault("extensions") ?? []
        });
    }

    public static object? Parse(string name, object? value) => Parse(Get(name), value);
    public static object? Parse(Schema schema, object? value) => schema.Parse(Json.Read(Json.Write(value)));

    public static T Parse<T>(string name, object? value) => Parse<T>(Get(name), value);
    public static T Parse<T>(Schema schema, object? value) => JsonSerializer.Deserialize<T>(
        Json.Write(Parse(schema, value)), Json.Options)!;

    /// <summary>Compose portable roots before importing, preserving definitions and rejecting name conflicts.</summary>
    public static Dictionary<string, object?> ObjectDocument(IDictionary<string, Dictionary<string, object?>> properties, string unknownKeys = "strip")
    {
        if (unknownKeys is not ("strip" or "reject" or "allow")) throw new ArgumentException("Invalid unknown-key policy");
        var fields = new Dictionary<string, object?>();
        var required = new List<object?>();
        var result = new Dictionary<string, object?>
        {
            ["anyvaliVersion"] = "1.0", ["schemaVersion"] = "1.1", ["definitions"] = new Dictionary<string, object?>(),
            ["extensions"] = new Dictionary<string, object?>(), ["root"] = new Dictionary<string, object?>
            {
                ["kind"] = "object", ["properties"] = fields, ["required"] = required, ["unknownKeys"] = unknownKeys
            }
        };
        if (properties.Count > 0)
            foreach (var key in new[] { "anyvaliVersion", "schemaVersion" }) result[key] = properties.First().Value[key];
        foreach (var (name, child) in properties)
        {
            Import(child);
            if (!Equals(child["anyvaliVersion"], result["anyvaliVersion"]) || !Equals(child["schemaVersion"], result["schemaVersion"]))
                throw new ArgumentException("Cannot compose different document versions");
            var root = (Dictionary<string, object?>)child["root"]!;
            fields[name] = Json.Read(Json.Write(root));
            if (!Equals(root["kind"], "optional")) required.Add(name);
            foreach (var section in new[] { "definitions", "extensions" })
            {
                var merged = (Dictionary<string, object?>)result[section]!;
                foreach (var (key, value) in (Dictionary<string, object?>?)child.GetValueOrDefault(section) ?? [])
                {
                    if (merged.TryGetValue(key, out var existing) && !System.Text.Json.Nodes.JsonNode.DeepEquals(
                        System.Text.Json.Nodes.JsonNode.Parse(Json.Write(existing)), System.Text.Json.Nodes.JsonNode.Parse(Json.Write(value))))
                        throw new ArgumentException($"Conflicting {section} name: {key}");
                    merged[key] = Json.Read(Json.Write(value));
                }
            }
        }
        Import(result);
        return result;
    }
}

/// <summary>JSON representation conversion, with missing dictionary keys distinct from null.</summary>
public static class Json
{
    public static readonly JsonSerializerOptions Options = new() { MaxDepth = 512 };
    public static object? Read(string json)
    {
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 512 });
        return Value(document.RootElement);
    }
    public static string Write(object? value) => JsonSerializer.Serialize(value, Options);
    public static object? Value(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => value.EnumerateObject().ToDictionary(p => p.Name, p => Value(p.Value)),
        JsonValueKind.Array => value.EnumerateArray().Select(Value).ToList(),
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.TryGetInt64(out var n) ? (object)n : value.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => throw new JsonException("Unsupported JSON value")
    };
}
