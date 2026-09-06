using BetterPortal;
using System.Reflection;
using System.Runtime.Loader;
using System.Text;

namespace BetterPortal.Tool;

internal static class ContractExporter
{
    public static int Command(string[] args)
    {
        var options = new Dictionary<string, string?>();
        for (var index = 0; index < args.Length; index++)
        {
            var option = args[index];
            if (option == "--check") options.Add(option, null);
            else if (option is "--assembly" or "--factory" or "--project" or "--output" && index + 1 < args.Length) options.Add(option, args[++index]);
            else throw new ArgumentException("Unknown or incomplete argument: " + option);
        }
        if (options.GetValueOrDefault("--assembly") is not string file || options.GetValueOrDefault("--factory") is not string factory || options.GetValueOrDefault("--output") is not string output)
            throw new ArgumentException("Use export --assembly FILE --factory Namespace.Type:Method --output FILE [--project DIR] [--check]");
        var project = Path.GetFullPath(options.GetValueOrDefault("--project") ?? Directory.GetCurrentDirectory());
        var assemblyPath = Path.GetFullPath(file, project);
        var parts = factory.Split(':');
        if (parts.Length != 2 || parts.Any(string.IsNullOrEmpty)) throw new ArgumentException("Use --factory Namespace.Type:Method");
        var resolver = new AssemblyDependencyResolver(assemblyPath);
        Assembly? Resolve(AssemblyLoadContext context, AssemblyName name) => resolver.ResolveAssemblyToPath(name) is { } path ? context.LoadFromAssemblyPath(path) : null;
        AssemblyLoadContext.Default.Resolving += Resolve;
        object? value;
        try
        {
            var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);
            var type = assembly.GetType(parts[0], throwOnError: true)!;
            var method = type.GetMethod(parts[1], BindingFlags.Public | BindingFlags.Static, Type.EmptyTypes);
            if (method is null || method.ContainsGenericParameters || method.ReturnType != typeof(BetterPortal.Generated.BpSchemaOutput))
                throw new ArgumentException("The contract factory must be public, static, take no arguments and return BetterPortal.Generated.BpSchemaOutput");
            value = Contracts.Parse("BpSchemaOutputSchema", method.Invoke(null, null));
        }
        finally { AssemblyLoadContext.Default.Resolving -= Resolve; }
        var data = new UTF8Encoding(false, true).GetBytes(Json.Write(value) + "\n");
        if (data.Length > 16 * 1024 * 1024) throw new ArgumentException("Exported contract exceeds its size limit");
        var target = Path.GetFullPath(output, project);
        if (options.ContainsKey("--check"))
        {
            if (!File.Exists(target) || !Project.Read(target).AsSpan().SequenceEqual(data)) throw new ArgumentException("Exported contract is stale");
        }
        else Project.Write(target, data);
        Console.WriteLine(target); return 0;
    }
}
