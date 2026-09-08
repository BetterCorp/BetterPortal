using BetterPortal;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.Tool;

internal static class ClientGenerator
{
    private sealed record Entry(string Id, string Method, string Input, Dictionary<string, string> Fields, IReadOnlySet<string> Required, string Output);
    public static string Generate(object value, string nameSpace, string className = "DependencyClient")
    {
        if (!Regex.IsMatch(className, @"\A[A-Za-z][A-Za-z0-9_]*\z") || TypeGenerator.ReservedNames.Contains(className)) throw new ArgumentException("Invalid C# client class name");
        var contract = new ClientContract(value); var operations = contract.JsonOperations();
        if (operations.Count == 0) throw new ArgumentException("Dependency contract has no JSON operations");
        var documents = new Dictionary<string, Node>(); var entries = new List<Entry>();
        var reserved = new HashSet<string>(StringComparer.Ordinal) { className };
        var methods = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (identifier, schemas) in operations.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var method = TypeGenerator.Identifier(identifier);
            if (method + "Async" == className || !methods.Add(method))
            {
                method += "_" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(identifier)))[..12];
                if (!methods.Add(method)) throw new ArgumentException("Generated client method name collision");
            }
            var prefix = TypeGenerator.Identifier(className) + "_" + method;
            var inputs = prefix + "Inputs"; reserved.Add(inputs);
            var fields = new Dictionary<string, string>();
            foreach (var (name, document) in schemas.Inputs)
            {
                var key = prefix + "_" + name + "Schema"; documents[key] = document;
                fields[name] = TypeGenerator.RootName(key, true);
            }
            var output = prefix + "_ResponseSchema"; documents[output] = schemas.Output;
            entries.Add(new(identifier, method + "Async", inputs, fields, schemas.RequiredInputs, TypeGenerator.RootName(output, false)));
        }
        var source = new StringBuilder(new TypeGenerator(documents, reserved).Generate(nameSpace));
        foreach (var entry in entries)
        {
            source.Append($"\npublic sealed record {entry.Input}\n{{\n");
            foreach (var (name, type) in entry.Fields)
            {
                source.Append($"    [JsonPropertyName({Json.Write(name)})]\n");
                if (!entry.Required.Contains(name)) source.Append("    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]\n");
                source.Append(entry.Required.Contains(name) ? $"    public required {type} {TypeGenerator.Identifier(name)} {{ get; init; }}\n"
                    : $"    public Optional<{type}> {TypeGenerator.Identifier(name)} {{ get; init; }}\n");
            }
            source.Append("}\n");
        }
        source.Append($"\npublic sealed class @{className}\n{{\n");
        source.Append("    private static readonly global::BetterPortal.ClientContract _bpContract = new(global::BetterPortal.Json.Read(");
        source.Append(Json.Write(Json.Write(contract.Schema()))); source.Append(")!);\n");
        source.Append("    private readonly global::BetterPortal.Client _bpClient;\n");
        source.Append($"    public @{className}(global::BetterPortal.RequestClients context, string? serviceId = null, string? requestId = null)\n    {{\n");
        source.Append("        if (serviceId is not null && requestId is not null) throw new global::System.ArgumentException(\"Select a user service or a declared M2M request\");\n");
        source.Append("        _bpClient = requestId is not null ? context.M2m(requestId, _bpContract) : context.User(_bpContract, serviceId);\n    }\n");
        foreach (var entry in entries)
        {
            var argument = entry.Required.Count > 0 ? entry.Input + " values" : entry.Input + "? values = null";
            source.Append($"\n    public global::System.Threading.Tasks.Task<{entry.Output}> {entry.Method}({argument}, global::System.Threading.CancellationToken cancellation = default)\n");
            source.Append($"        => _bpClient.RequestAsync<{entry.Output}>({Json.Write(entry.Id)}, values, cancellation);\n");
        }
        source.Append("}\n");
        return source.ToString();
    }
}
