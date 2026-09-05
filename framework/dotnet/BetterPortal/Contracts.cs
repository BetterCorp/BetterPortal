using AnyVali;
using System.Collections.Concurrent;
using System.Text.Json;

namespace BetterPortal;

public static class Contracts
{
    private static readonly ConcurrentDictionary<string, Schema> Schemas = new();
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

    public static Schema Import(string json)
    {
        var document = (Dictionary<string, object?>)Json.Read(json)!;
        return V.Import(new AnyValiDocument
        {
            AnyvaliVersion = (string)document["anyvaliVersion"]!,
            SchemaVersion = (string)document["schemaVersion"]!,
            Root = (Dictionary<string, object?>)document["root"]!,
            Definitions = (Dictionary<string, object?>?)document.GetValueOrDefault("definitions") ?? [],
            Extensions = (Dictionary<string, object?>?)document.GetValueOrDefault("extensions") ?? []
        });
    }

    public static object? Parse(string name, object? value) => Get(name).Parse(value);
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
