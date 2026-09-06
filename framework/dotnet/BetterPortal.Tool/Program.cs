using BetterPortal;
using BetterPortal.Tool;

if (args.Length == 0 || args[0] != "types")
{
    Console.Error.WriteLine("bp-dotnet types (--platform | --contracts PATH) --output FILE [--namespace NAME] [--check]");
    return 2;
}
var options = new Dictionary<string, string?>();
for (var index = 1; index < args.Length; index++)
{
    var option = args[index];
    if (option is "--platform" or "--check") options.Add(option, null);
    else if (option is "--contracts" or "--output" or "--namespace" && index + 1 < args.Length) options.Add(option, args[++index]);
    else throw new ArgumentException($"Unknown or incomplete argument: {option}");
}
if (!options.TryGetValue("--output", out var output) || output is null || options.ContainsKey("--platform") == options.ContainsKey("--contracts"))
    throw new ArgumentException("Select --platform or --contracts and an --output file");
Dictionary<string, Dictionary<string, object?>> documents;
if (options.ContainsKey("--platform")) documents = Contracts.Names.ToDictionary(name => name, name => Contracts.Document(name));
else
{
    var source = options["--contracts"]!;
    var files = Directory.Exists(source) ? Directory.GetFiles(source, "*.json").Order(StringComparer.Ordinal).ToArray() : [source];
    if (files.Length == 0) throw new ArgumentException("No contract documents found");
    documents = files.ToDictionary(path => Path.GetFileNameWithoutExtension(path), path => (Dictionary<string, object?>)Json.Read(File.ReadAllText(path))!);
}
var generated = new TypeGenerator(documents).Generate(options.GetValueOrDefault("--namespace") ?? "BetterPortal.Generated");
if (options.ContainsKey("--check"))
{
    if (!File.Exists(output) || File.ReadAllText(output).Replace("\r\n", "\n", StringComparison.Ordinal) != generated)
        throw new InvalidOperationException("Generated types are stale");
}
else
{
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output))!);
    File.WriteAllText(output, generated, new System.Text.UTF8Encoding(false));
}
Console.WriteLine($"Checked {documents.Count} AnyVali contracts");
return 0;
