using BetterPortal;
using System.Security.Cryptography;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;
using Candidate = (string Source, string Reference, byte[] Data, System.Collections.Generic.Dictionary<string, object?> Contract);

namespace BetterPortal.Tool;

/// <summary>Local dependency resolution and frozen builds from BP project files.</summary>
internal sealed class Project
{
    private readonly string directory;
    private readonly Node config, locked;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    public Project(string directory)
    {
        this.directory = Path.GetFullPath(directory);
        config = Load("betterportal.json", "BetterPortalProjectConfigSchema");
        locked = Load("betterportal.lock.json", "BetterPortalLockSchema");
        Aliases((Node)config.GetValueOrDefault("dependencies", new Node())!);
    }
    private Node Load(string file, string schema)
    {
        var path = Path.Combine(directory, file);
        return (Node)Contracts.Parse(schema, File.Exists(path) ? Json.Read(Utf8.GetString(Read(path))) : new Node())!;
    }
    internal static byte[] Read(string path)
    {
        using var file = File.OpenRead(path); using var output = new MemoryStream();
        var buffer = new byte[16384]; int count;
        while ((count = file.Read(buffer)) > 0)
        {
            if (output.Length + count > 16 * 1024 * 1024) throw new ArgumentException("Project document exceeds its size limit");
            output.Write(buffer, 0, count);
        }
        return output.ToArray();
    }
    private static string Digest(byte[] data) => "sha256:" + Convert.ToHexStringLower(SHA256.HashData(data));
    internal static void Write(string path, byte[] data)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path) && Read(path).AsSpan().SequenceEqual(data)) return;
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { file.Write(data); file.Flush(true); }
            File.Move(temporary, path, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    private void Document(string file, object value) => Write(Path.Combine(directory, file), Utf8.GetBytes(Json.Write(value) + "\n"));
    private static void Aliases(Node values)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var alias in values.Keys)
        {
            Contracts.Parse("DependencyAliasSchema", alias);
            if (!names.Add(alias.Replace('-', '_'))) throw new ArgumentException("Dependency aliases produce colliding native filenames");
        }
    }
    private (string Kind, string Identity, string? Version) Selector(string value)
    {
        var raw = value.Trim();
        if (raw.Length == 0) throw new ArgumentException("Dependency selector is required");
        var at = raw.LastIndexOf('@'); var identity = at < 0 ? raw : raw[..at]; var version = at < 0 ? null : raw[(at + 1)..];
        if (at >= 0 && (identity.Length == 0 || version!.Length == 0)) throw new ArgumentException("Incomplete dependency selector");
        if (version is not (null or "latest")) Contracts.Parse("SemverSchema", version);
        string kind;
        if (identity.Contains('/')) { kind = "registryRef"; Contracts.Parse("RegistryReferenceSchema", identity); }
        else if (identity.Contains('.')) { kind = "pluginId"; Contracts.Parse("PluginIdSchema", identity); }
        else if (config.GetValueOrDefault("defaultNamespace") is string prefix)
        { kind = "registryRef"; identity = prefix + "/" + identity; Contracts.Parse("RegistryReferenceSchema", identity); }
        else { kind = "shortName"; Contracts.Parse("RegistryReferenceSchema", "example/" + identity); }
        return (kind, identity, version);
    }
    private static bool Matches((string Kind, string Identity, string? Version) selector, string reference, Node contract)
    {
        var manifest = (Node)contract["manifest"]!;
        var actual = selector.Kind == "registryRef" ? reference : selector.Kind == "pluginId" ? (string)manifest["pluginId"]! : reference.Split('/')[^1];
        var matched = actual == selector.Identity || selector.Kind == "shortName" && selector.Identity == ((string)manifest["pluginId"]!).Split('.')[^1];
        return matched && (selector.Version is null or "latest" || Equals(selector.Version, manifest["version"]));
    }
    private static bool InvalidCandidate(Exception error) => error is IOException or UnauthorizedAccessException or ArgumentException or System.Text.Json.JsonException or AnyVali.ValidationError;
    private List<Candidate> LocalCandidates((string Kind, string Identity, string? Version) selector, string path, bool strict)
    {
        var source = Path.GetFullPath(path, directory);
        string reference; string[] files;
        try
        {
            if (!Directory.Exists(source)) throw new ArgumentException("A local dependency path must be a project directory");
            var configPath = Path.Combine(source, "betterportal.json");
            var metadata = (Node)Contracts.Parse("BetterPortalProjectConfigSchema", File.Exists(configPath) ? Json.Read(Utf8.GetString(Read(configPath))) : new Node())!;
            reference = (string)metadata.GetValueOrDefault("registryRef", strict && selector.Kind == "registryRef" ? selector.Identity : "")!;
            Contracts.Parse("RegistryReferenceSchema", reference);
            var direct = Path.Combine(source, "bp-contract.json"); var library = Path.Combine(source, "lib", "bp-contracts");
            files = (File.Exists(direct) ? new[] { direct } : []).Concat(Directory.Exists(library) ? Directory.GetFiles(library, "*.json").Order(StringComparer.Ordinal) : []).ToArray();
        }
        catch (Exception error) when (!strict && InvalidCandidate(error)) { return []; }
        var found = new List<Candidate>();
        foreach (var file in files)
        {
            try
            {
                var data = Read(file); var contract = (Node)Contracts.Parse("BpSchemaOutputSchema", Json.Read(Utf8.GetString(data)))!;
                if (Matches(selector, reference, contract)) found.Add((source, reference, data, contract));
            }
            catch (Exception error) when (!strict && InvalidCandidate(error)) { }
        }
        return found;
    }
    private static Candidate? Select(List<Candidate> found)
    {
        if (found.Select(value => (value.Reference, Digest(value.Data))).Distinct().Count() > 1)
            throw new ArgumentException("Local dependency is ambiguous; select an exact identity, version or --path");
        return found.Count == 0 ? null : found[0];
    }
    private Candidate Local((string Kind, string Identity, string? Version) selector, string path) => Select(LocalCandidates(selector, path, true))
        ?? throw new ArgumentException("No local contract matches the dependency identity and version");
    private static string[] Children(string path)
    {
        try { return Directory.GetDirectories(path).Order(StringComparer.Ordinal).ToArray(); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { return []; }
    }
    private static IEnumerable<string> PackageRoots(string path) => Path.GetFileName(path) == "node_modules"
        ? Children(path).SelectMany(package => Path.GetFileName(package).StartsWith('@') ? Children(package) : [package]) : [path];
    private Candidate? Discover((string Kind, string Identity, string? Version) selector)
    {
        var root = directory;
        for (var current = new DirectoryInfo(directory); current is not null; current = current.Parent)
            if (Path.Exists(Path.Combine(current.FullName, ".git"))) { root = current.FullName; break; }
        var roots = new List<string>(); var package = Path.Combine(root, "package.json");
        if (File.Exists(package))
        {
            var metadata = (Node)Contracts.Parse("LocalWorkspacePackageSchema", Json.Read(Utf8.GetString(Read(package))))!;
            roots.AddRange(((List<object?>)metadata["workspaces"]!).Cast<string>().Where(path => !path.Contains('*')).Select(path => Path.GetFullPath(path, root)));
        }
        roots.Add(Path.Combine(directory, "node_modules"));
        roots.AddRange(Children(Path.GetDirectoryName(root) ?? root));
        roots.AddRange((Environment.GetEnvironmentVariable("BP_DEV_PATHS") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries).Select(path => Path.GetFullPath(path, directory)));
        return Select(roots.Distinct(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal)
            .SelectMany(PackageRoots).SelectMany(path => LocalCandidates(selector, path, false)).ToList());
    }
    public async Task<Node> Add(string value, string? path, string? alias, string? url, CancellationToken cancellation)
    {
        if (path is not null && url is not null) throw new ArgumentException("Select --path or --registry");
        if (path is not null) return AddLocal(value, path, alias);
        if (url is null)
        {
            var selector = Selector(value);
            if (Discover(selector) is { } local) return Install(selector, local.Source, local.Reference, local.Data, local.Contract, alias);
        }
        return await AddRegistry(value, alias, url, cancellation);
    }
    private string Cache(Node entry) => Path.Combine(directory, ".betterportal", "contracts", (string)entry["pluginId"]!, entry["version"] + ".json");
    private string Output(string alias) => Path.Combine(directory, "BpDependencies", alias.Replace('-', '_') + ".cs");
    private static byte[] Generate(Node contract, string alias) => Utf8.GetBytes(ClientGenerator.Generate(contract, "BetterPortal.Dependencies." + alias.Replace('-', '_')));
    public Node AddLocal(string value, string path, string? alias)
    {
        var selector = Selector(value); var (source, reference, data, contract) = Local(selector, path);
        return Install(selector, source, reference, data, contract, alias);
    }
    public async Task<Node> AddRegistry(string value, string? alias, string? url, CancellationToken cancellation)
    {
        var selector = Selector(value);
        if (alias is not null) Aliases(new Node((Node)config.GetValueOrDefault("dependencies", new Node())!) { [alias] = value });
        var (reference, data, contract) = await new RegistryClient(url).Lookup(selector.Kind, selector.Identity, selector.Version, cancellation);
        return Install(selector, null, reference, data, contract, alias);
    }
    public Task<Node> Publish(string file, string? url, CancellationToken cancellation)
    {
        if (config.GetValueOrDefault("registryRef") is not string reference) throw new ArgumentException("betterportal.json must define registryRef before publishing");
        var token = Environment.GetEnvironmentVariable("BP_REGISTRY_TOKEN");
        if (string.IsNullOrEmpty(token)) throw new ArgumentException("BP_REGISTRY_TOKEN is required");
        return new RegistryClient(url).Publish(reference, Json.Read(Utf8.GetString(Read(Path.GetFullPath(file, directory)))), token, cancellation);
    }
    private Node Install((string Kind, string Identity, string? Version) selector, string? source, string reference, byte[] data, Node contract, string? alias)
    {
        alias ??= reference.Split('/')[^1]; var manifest = (Node)contract["manifest"]!;
        var dependencies = new Node((Node)config.GetValueOrDefault("dependencies", new Node())!) { [alias] = reference + "@" + (selector.Version ?? manifest["version"]) };
        Aliases(dependencies);
        var entry = (Node)Contracts.Parse("LockedDependencySchema", new Node { ["registryRef"] = reference, ["pluginId"] = manifest["pluginId"],
            ["version"] = manifest["version"], ["digest"] = Digest(data), ["digestFormat"] = "json-bytes" })!;
        var generated = Generate(contract, alias);
        var locals = Load(".betterportal/local-lock.json", "LocalDependencyLockSchema");
        foreach (var (name, valueLocked) in (Node)locked["dependencies"]!)
        {
            var other = (Node)valueLocked!;
            if (name != alias && Equals(other["pluginId"], entry["pluginId"]) && Equals(other["version"], entry["version"]) && !Equals(other["digest"], entry["digest"]))
            {
                // Migrating one alias can preserve another legacy pin when its cache is untouched.
                var cache = Cache(other);
                if (!other.ContainsKey("digestFormat") && File.Exists(cache) && Equals(Digest(Read(cache)), entry["digest"])) continue;
                throw new ArgumentException("Another dependency locks different content for this plugin and version");
            }
        }
        // Cache and generated code precede the lock update. Interrupted updates fail frozen verification.
        Write(Cache(entry), data); Write(Output(alias), generated);
        config["dependencies"] = dependencies; ((Node)locked["dependencies"]!)[alias] = entry;
        if (source is null) locals.Remove(alias);
        else locals[alias] = new Node(entry) { ["path"] = Path.GetRelativePath(directory, source) };
        Document(".betterportal/local-lock.json", locals); Document("betterportal.json", config); Document("betterportal.lock.json", locked);
        return entry;
    }
    public IReadOnlyList<string> Frozen(bool check)
    {
        var prepared = new List<(string Path, byte[] Data)>();
        foreach (var (alias, value) in (Node)config.GetValueOrDefault("dependencies", new Node())!)
        {
            if (((Node)locked["dependencies"]!).GetValueOrDefault(alias) is not Node entry) throw new ArgumentException("Frozen dependency is not locked: " + alias);
            if (!Equals(entry.GetValueOrDefault("digestFormat"), "json-bytes")) throw new ArgumentException("Legacy locale-based lock requires explicit native dependency installation: " + alias);
            var path = Cache(entry);
            if (!File.Exists(path)) throw new ArgumentException("Frozen dependency is not cached: " + alias);
            var data = Read(path);
            if (Digest(data) != (string)entry["digest"]!) throw new ArgumentException("Frozen dependency changed: " + alias);
            var contract = (Node)Contracts.Parse("BpSchemaOutputSchema", Json.Read(Utf8.GetString(data)))!; var manifest = (Node)contract["manifest"]!;
            if (!Equals(manifest["pluginId"], entry["pluginId"]) || !Equals(manifest["version"], entry["version"]) || !Matches(Selector((string)value!), (string)entry["registryRef"]!, contract))
                throw new ArgumentException("Frozen dependency identity or version changed: " + alias);
            var output = Output(alias); var generated = Generate(contract, alias);
            if (check && (!File.Exists(output) || !Read(output).AsSpan().SequenceEqual(generated))) throw new ArgumentException("Generated dependency is stale: " + alias);
            prepared.Add((output, generated));
        }
        foreach (var (path, data) in prepared) if (!check) Write(path, data);
        return prepared.Select(value => value.Path).ToArray();
    }

    public static async Task<int> Command(string[] args, CancellationToken cancellation)
    {
        if (args.Length == 0 || args[0] is not ("add" or "sync" or "publish")) throw new ArgumentException("Use deps add SELECTOR, deps sync --frozen or publish --contract FILE");
        var add = args[0] == "add";
        var publish = args[0] == "publish";
        if (add && (args.Length < 2 || args[1].StartsWith("--", StringComparison.Ordinal))) throw new ArgumentException("A dependency selector is required");
        var options = new Dictionary<string, string?>();
        for (var index = add ? 2 : 1; index < args.Length; index++)
        {
            var option = args[index];
            if (!add && !publish && option is "--frozen" or "--check") options.Add(option, null);
            else if ((option == "--project" || (add || publish) && option == "--registry" || add && option is "--path" or "--alias" || publish && option == "--contract") && index + 1 < args.Length) options.Add(option, args[++index]);
            else throw new ArgumentException("Unknown or incomplete argument: " + option);
        }
        var project = new Project(options.GetValueOrDefault("--project") ?? Directory.GetCurrentDirectory());
        if (publish)
        {
            if (options.GetValueOrDefault("--contract") is not string file) throw new ArgumentException("A --contract file is required");
            Console.WriteLine(Json.Write(await project.Publish(file, options.GetValueOrDefault("--registry"), cancellation)));
        }
        else if (add)
        {
            var result = await project.Add(args[1], options.GetValueOrDefault("--path"), options.GetValueOrDefault("--alias"), options.GetValueOrDefault("--registry"), cancellation);
            Console.WriteLine(Json.Write(result));
        }
        else
        {
            if (!options.ContainsKey("--frozen")) throw new ArgumentException("Select --frozen for cached dependency generation");
            foreach (var path in project.Frozen(options.ContainsKey("--check"))) Console.WriteLine(path);
        }
        return 0;
    }
}
