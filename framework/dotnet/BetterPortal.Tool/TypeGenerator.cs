using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.Tool;

/// <summary>Native C# type projection. Constraints and defaults remain in the AnyVali documents.</summary>
internal sealed class TypeGenerator
{
    private readonly SortedDictionary<string, Node> _documents;
    private readonly Dictionary<(string Identity, bool Input), string> _names = [];
    private readonly Dictionary<(string Scope, string Key, bool Input), string> _definitions = [];
    private readonly HashSet<string> _reserved = ["Optional", "Variant", "JsonNull", "Never", "IWireValue", "WireValueConverterFactory",
        "System", "BetterPortal", "IReadOnlyList", "IReadOnlyDictionary", "Dictionary", "JsonConverter", "JsonPropertyName",
        "JsonIgnore", "JsonIgnoreCondition", "JsonExtensionData", "JsonStringEnumMemberName", "JsonStringEnumConverter"];
    private readonly SortedDictionary<string, string> _emitted = new(StringComparer.Ordinal);
    private static string Identifier(string value)
    {
        var result = string.Concat(Regex.Split(value, "[^A-Za-z0-9_]+").Where(part => part.Length > 0)
            .Select(part => char.ToUpperInvariant(part[0]) + part[1..]));
        return result.Length == 0 ? "Value" : char.IsDigit(result[0]) ? "T" + result : result;
    }
    private static string RootName(string contract, bool input) => Identifier(contract.EndsWith("Schema", StringComparison.Ordinal) ? contract[..^6] : contract) + (input ? "Input" : "");
    private static string Quote(string value) => Json.Write(value);
    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static object? Ordered(object? value) => value switch
    {
        Node node => node.OrderBy(pair => pair.Key, StringComparer.Ordinal).ToDictionary(pair => pair.Key, pair => Ordered(pair.Value)),
        IEnumerable<object?> list => list.Select(Ordered).ToArray(), _ => value
    };
    private static string Canonical(object? value) => Json.Write(Ordered(value));
    private static string Fingerprint(Node node, Node document) => Canonical(new object?[] { node, document.GetValueOrDefault("definitions", new Node()) });
    private static string Kind(Node node) => (string)node["kind"]!;
    private static Node Child(Node node, string key, string alias) => (Node)(node.TryGetValue(key, out var value) ? value! : node[alias]!);
    private static Node[] Nodes(object? value) => ((IEnumerable<object?>)value!).Cast<Node>().ToArray();

    public TypeGenerator(IDictionary<string, Node> documents)
    {
        _documents = new(documents, StringComparer.Ordinal);
        foreach (var document in _documents.Values) Contracts.Import(document);
        foreach (var (contract, document) in _documents)
            foreach (var input in new[] { false, true })
            {
                var name = RootName(contract, input);
                if (!_reserved.Add(name)) throw new ArgumentException($"Generated type name collision: {name}");
                _names.TryAdd((Fingerprint((Node)document["root"]!, document), input), name);
            }
    }

    private string Reserve(string hint, string identity)
    {
        var name = Identifier(hint);
        if (_reserved.Contains(name)) name += "_" + Hash(identity)[..12];
        if (!_reserved.Add(name)) throw new ArgumentException($"Generated type name collision: {name}");
        return name;
    }

    private string Reference(string reference, Node document, bool input)
    {
        const string prefix = "#/definitions/";
        if (!reference.StartsWith(prefix, StringComparison.Ordinal)) throw new ArgumentException("Only local AnyVali references are supported");
        var key = reference[prefix.Length..].Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal);
        var definitions = (Node?)document.GetValueOrDefault("definitions") ?? [];
        if (!definitions.TryGetValue(key, out var value)) throw new ArgumentException($"Unresolved AnyVali definition: {key}");
        var identity = (Canonical(definitions), key, input);
        if (!_definitions.TryGetValue(identity, out var name))
        {
            name = Reserve(key + (input ? "Input" : ""), identity.ToString());
            _definitions.Add(identity, name);
            Emit(name, (Node)value!, document, input);
        }
        return name;
    }

    private static string Union(IEnumerable<string> candidates)
    {
        var values = candidates.Where(value => value != "Never").Distinct(StringComparer.Ordinal).ToArray();
        return values.Length switch { 0 => "Never", 1 => values[0], _ => $"Variant<{values[0]}, {Union(values.Skip(1))}>" };
    }

    private static bool IsRecursiveJson(Node node, Node document)
    {
        if (Kind(node) != "ref" || node["ref"] is not string reference || !reference.StartsWith("#/definitions/", StringComparison.Ordinal)) return false;
        var key = reference["#/definitions/".Length..].Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal);
        if (document.GetValueOrDefault("definitions") is not Node definitions || definitions.GetValueOrDefault(key) is not Node definition || Kind(definition) != "union") return false;
        var variants = Nodes(definition["variants"]);
        if (variants.Length != 6 || !variants.Select(Kind).ToHashSet().SetEquals(["null", "bool", "string", "number", "array", "record"])) return false;
        return Equals(((Node)variants.Single(value => Kind(value) == "array")["items"]!).GetValueOrDefault("ref"), reference)
            && Equals(Child(variants.Single(value => Kind(value) == "record"), "valueSchema", "values").GetValueOrDefault("ref"), reference);
    }

    private string TypeOf(Node node, Node document, bool input, string hint, bool expand = false)
    {
        var identity = (Fingerprint(node, document), input);
        if (IsRecursiveJson(node, document)) return "System.Text.Json.Nodes.JsonNode?";
        if (!expand && Kind(node) is ("object" or "enum" or "union" or "intersection" or "record" or "ref") && _names.TryGetValue(identity, out var known)) return known;
        if (input && node.GetValueOrDefault("coerce") is Node { Count: > 0 }) return "System.Text.Json.JsonElement";
        var kind = Kind(node);
        if (kind == "ref") return Reference((string)node["ref"]!, document, input);
        if (kind is "optional" or "nullable")
        {
            var value = TypeOf(Child(node, "inner", "schema"), document, input, hint);
            return kind == "nullable" && !value.EndsWith('?') ? value + "?" : value;
        }
        if (kind is "string" or "bool" or "number" or "null" or "never" or "any" or "unknown")
            return kind switch { "string" => "string", "bool" => "bool", "number" => "double", "null" => "JsonNull", "never" => "Never", _ => "System.Text.Json.JsonElement" };
        if (kind is "int" or "int8" or "int16" or "int32" or "int64" or "uint8" or "uint16" or "uint32" or "uint64" or "uint")
            return kind switch { "uint8" => "byte", "uint16" => "ushort", "uint32" => "uint", "uint64" or "uint" => "ulong", _ => "long" };
        if (kind == "array") return $"IReadOnlyList<{TypeOf((Node)node["items"]!, document, input, hint + "Item")}>";
        if (kind == "record") return $"IReadOnlyDictionary<string, {TypeOf(Child(node, "valueSchema", "values"), document, input, hint + "Item")}>";
        if (kind is "union" or "tuple")
        {
            var children = Nodes(kind == "union" ? node["variants"] : node.GetValueOrDefault("items", node.GetValueOrDefault("elements", Array.Empty<object?>())));
            var types = new List<string>();
            foreach (var (child, index) in children.Select((value, index) => (value, index)))
            {
                // Explicit null branches avoid erased nullable-reference annotations in generic union converters.
                if (Kind(child) == "nullable")
                {
                    types.Add(TypeOf(Child(child, "inner", "schema"), document, input, hint + $"Variant{index + 1}"));
                    types.Add("JsonNull");
                }
                else types.Add(TypeOf(child, document, input, hint + $"Variant{index + 1}"));
            }
            var union = Union(types);
            return kind == "tuple" ? $"IReadOnlyList<{union}>" : union;
        }
        if (kind == "literal" && node["value"] is not string)
            return node["value"] switch { null => "JsonNull", bool => "bool", long or int => "long", double => "double", _ => "System.Text.Json.JsonElement" };
        if (kind == "intersection")
        {
            var children = Nodes(node["allOf"]);
            if (children.All(child => Kind(child) is "object" or "record"))
            {
                var properties = new Node();
                var required = new List<object?>();
                var open = false;
                foreach (var child in children)
                {
                    if (Kind(child) == "record") { open = true; continue; }
                    foreach (var (key, value) in (Node)child["properties"]!)
                        properties[key] = properties.TryGetValue(key, out var existing) && Canonical(existing) != Canonical(value)
                            ? new Node { ["kind"] = "intersection", ["allOf"] = new object?[] { existing, value } } : value;
                    required.AddRange(child.TryGetValue("required", out var fields) ? (IEnumerable<object?>)fields! : ((Node)child["properties"]!).Keys);
                    open |= Equals(child.GetValueOrDefault("unknownKeys"), "allow");
                }
                var merged = new Node { ["kind"] = "object", ["properties"] = properties, ["required"] = required.Distinct().ToArray(), ["unknownKeys"] = open ? "allow" : "strip" };
                return TypeOf(merged, document, input, hint + "Fields");
            }
            var values = children.Select((child, index) => TypeOf(child, document, input, hint + $"Part{index + 1}")).Distinct().ToArray();
            // CLR has no arbitrary intersection type. AnyVali retains every constraint before typed decoding.
            return values.Length == 1 ? values[0] : "System.Text.Json.JsonElement";
        }
        if (kind is "object" or "enum" or "literal")
        {
            if (!_names.TryGetValue(identity, out var name))
            {
                name = Reserve(hint, identity.ToString());
                _names.Add(identity, name);
                Emit(name, node, document, input);
            }
            return name;
        }
        throw new ArgumentException($"Unsupported AnyVali kind for C# typing: {kind}");
    }

    private void Emit(string name, Node node, Node document, bool input)
    {
        if (_emitted.ContainsKey(name)) return;
        _emitted.Add(name, "");
        var lines = new List<string>();
        var kind = Kind(node);
        if (kind == "object")
        {
            lines.Add($"public sealed record {name}\n{{");
            var properties = (Node)node["properties"]!;
            var required = node.TryGetValue("required", out var fields) ? ((IEnumerable<object?>)fields!).Cast<string>().ToHashSet() : properties.Keys.ToHashSet();
            var members = new HashSet<string> { name, "EqualityContract", "Clone", "Equals", "GetHashCode", "ToString", "PrintMembers", "Deconstruct" };
            foreach (var (field, value) in properties)
            {
                var child = (Node)value!;
                var member = Identifier(field);
                if (!members.Add(member)) { member += "_" + Hash(field)[..12]; members.Add(member); }
                var type = TypeOf(child, document, input, name + member);
                var present = required.Contains(field) && Kind(child) != "optional" && !(input && child.ContainsKey("default"));
                lines.Add($"    [JsonPropertyName({Quote(field)})]");
                if (!present) lines.Add("    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]");
                lines.Add(present ? $"    public required {type} {member} {{ get; init; }}" : $"    public Optional<{type}> {member} {{ get; init; }}");
            }
            if (Equals(node.GetValueOrDefault("unknownKeys"), "allow"))
            {
                var extras = members.Contains("AdditionalProperties") ? "AdditionalProperties_" + Hash(name)[..12] : "AdditionalProperties";
                lines.Add($"    [JsonExtensionData]\n    public Dictionary<string, System.Text.Json.JsonElement>? {extras} {{ get; init; }}");
            }
            lines.Add("}");
        }
        else if (kind == "enum" || kind == "literal" && node["value"] is string)
        {
            var values = kind == "literal" ? new[] { node["value"] } : ((IEnumerable<object?>)node["values"]!).ToArray();
            if (values.All(value => value is string))
            {
                lines.Add($"[JsonConverter(typeof(JsonStringEnumConverter<{name}>))]\npublic enum {name}\n{{");
                var members = new HashSet<string>();
                foreach (var value in values.Cast<string>())
                {
                    var member = Identifier(value);
                    if (!members.Add(member)) { member += "_" + Hash(value)[..12]; members.Add(member); }
                    lines.Add($"    [JsonStringEnumMemberName({Quote(value)})]\n    {member},");
                }
                lines.Add("}");
            }
            else Wrapper(name, "System.Text.Json.JsonElement", lines);
        }
        else Wrapper(name, TypeOf(node, document, input, name, expand: true), lines);
        _emitted[name] = string.Join("\n", lines);
    }

    private static void Wrapper(string name, string type, List<string> lines)
    {
        var member = name == "Value" ? "Data" : "Value";
        lines.Add($"[JsonConverter(typeof(WireValueConverterFactory))]\npublic readonly record struct {name}({type} {member}) : IWireValue<{name}, {type}>\n{{");
        if (member != "Value") lines.Add($"    {type} IWireValue<{name}, {type}>.Value => {member};");
        lines.Add($"    public static {name} FromValue({type} value) => new(value);");
        if (!type.StartsWith("IReadOnly", StringComparison.Ordinal))
        {
            lines.Add($"    public static implicit operator {name}({type} value) => new(value);");
            lines.Add($"    public static implicit operator {type}({name} value) => value.{member};");
        }
        lines.Add("}");
    }

    public string Generate(string nameSpace)
    {
        if (!Regex.IsMatch(nameSpace, @"\A[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*\z")) throw new ArgumentException("Invalid namespace");
        foreach (var (contract, document) in _documents)
            foreach (var input in new[] { false, true }) Emit(RootName(contract, input), (Node)document["root"]!, document, input);
        var escapedNamespace = string.Join(".", nameSpace.Split('.').Select(part => "@" + part));
        return $"// Generated from AnyVali documents; do not edit. SHA256: {Hash(Canonical(_documents.ToDictionary(pair => pair.Key, pair => (object?)pair.Value)))}\n#nullable enable\nusing BetterPortal;\nusing System.Collections.Generic;\nusing System.Text.Json.Serialization;\n\nnamespace {escapedNamespace};\n\n" + string.Join("\n\n", _emitted.Values) + "\n";
    }
}
