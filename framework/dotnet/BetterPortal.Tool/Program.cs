using BetterPortal;
using BetterPortal.Tool;

if (args.Length > 0 && args[0] == "deps") return Project.Command(args[1..]);
if (args.Length == 0 || args[0] is not ("types" or "client"))
{
    Console.Error.WriteLine("bp-dotnet types (--platform | --contracts PATH) --output FILE [--namespace NAME] [--check]");
    Console.Error.WriteLine("bp-dotnet client --contract FILE --output FILE [--class-name NAME] [--namespace NAME] [--check]");
    Console.Error.WriteLine("bp-dotnet deps add SELECTOR --path PROJECT [--alias NAME] [--project DIR]");
    Console.Error.WriteLine("bp-dotnet deps sync --frozen [--check] [--project DIR]");
    return 2;
}
var options = new Dictionary<string, string?>();
for (var index = 1; index < args.Length; index++)
{
    var option = args[index];
    if (option is "--platform" or "--check") options.Add(option, null);
    else if (option is "--contracts" or "--contract" or "--output" or "--namespace" or "--class-name" && index + 1 < args.Length) options.Add(option, args[++index]);
    else throw new ArgumentException($"Unknown or incomplete argument: {option}");
}
if (!options.TryGetValue("--output", out var output) || output is null) throw new ArgumentException("An --output file is required");
string generated; string description;
if (args[0] == "client")
{
    if (!options.TryGetValue("--contract", out var contract) || contract is null || options.ContainsKey("--platform") || options.ContainsKey("--contracts"))
        throw new ArgumentException("Select a --contract file for client generation");
    generated = ClientGenerator.Generate(Json.Read(File.ReadAllText(contract))!, options.GetValueOrDefault("--namespace") ?? "BetterPortal.Dependencies", options.GetValueOrDefault("--class-name") ?? "DependencyClient");
    description = "dependency client";
}
else
{
    if (options.ContainsKey("--platform") == options.ContainsKey("--contracts") || options.ContainsKey("--contract") || options.ContainsKey("--class-name"))
        throw new ArgumentException("Select --platform or --contracts for type generation");
    Dictionary<string, Dictionary<string, object?>> documents;
    if (options.ContainsKey("--platform")) documents = Contracts.Names.ToDictionary(name => name, name => Contracts.Document(name));
    else
    {
        var source = options["--contracts"]!;
        var files = Directory.Exists(source) ? Directory.GetFiles(source, "*.json").Order(StringComparer.Ordinal).ToArray() : [source];
        if (files.Length == 0) throw new ArgumentException("No contract documents found");
        documents = files.ToDictionary(path => Path.GetFileNameWithoutExtension(path), path => (Dictionary<string, object?>)Json.Read(File.ReadAllText(path))!);
    }
    generated = new TypeGenerator(documents).Generate(options.GetValueOrDefault("--namespace") ?? "BetterPortal.Generated");
    description = $"{documents.Count} AnyVali contracts";
}
if (options.ContainsKey("--check"))
{
    if (!File.Exists(output) || File.ReadAllText(output).Replace("\r\n", "\n", StringComparison.Ordinal) != generated)
        throw new InvalidOperationException("Generated output is stale");
}
else
{
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output))!);
    File.WriteAllText(output, generated, new System.Text.UTF8Encoding(false));
}
Console.WriteLine($"Checked {description}");
return 0;
