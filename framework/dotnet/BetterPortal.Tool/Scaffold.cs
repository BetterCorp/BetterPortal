using System.Reflection;
using System.Text;
using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.Tool;

internal static class Scaffold
{
    public static int Command(string[] args)
    {
        if (args.Length == 0) throw new ArgumentException("Use init DIRECTORY --plugin-id ID --registry-ref NAMESPACE/NAME --title TITLE");
        var options = new Dictionary<string, string>();
        for (var index = 1; index < args.Length; index++)
        {
            if (args[index] is not ("--plugin-id" or "--registry-ref" or "--title") || index + 1 >= args.Length)
                throw new ArgumentException("Unknown or incomplete argument: " + args[index]);
            options.Add(args[index], args[++index]);
        }
        if (!options.TryGetValue("--plugin-id", out var pluginId) || !options.TryGetValue("--registry-ref", out var registryRef) || !options.TryGetValue("--title", out var title))
            throw new ArgumentException("Use init DIRECTORY --plugin-id ID --registry-ref NAMESPACE/NAME --title TITLE");
        Contracts.Parse("ManifestDeclarationSchema", new Node { ["pluginId"] = pluginId, ["title"] = title, ["description"] = title, ["version"] = "1.0.0" });
        var config = Contracts.Parse("BetterPortalProjectConfigSchema", new Node { ["registryRef"] = registryRef, ["defaultNamespace"] = registryRef.Split('/')[0] });
        var runtime = typeof(Scaffold).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion.Split('+')[0];
        var files = new Dictionary<string, string>
        {
            ["betterportal.json"] = Json.Write(config),
            ["betterportal.lock.json"] = Json.Write(Contracts.Parse("BetterPortalLockSchema", new Node())),
            [".gitignore"] = "bin/\nobj/\n.bp-state/\n.bp-generated/\n.env",
            ["BpService.csproj"] = $$"""
                <Project Sdk="Microsoft.NET.Sdk.Web">
                  <PropertyGroup>
                    <TargetFramework>net10.0</TargetFramework>
                    <Nullable>enable</Nullable>
                    <ImplicitUsings>enable</ImplicitUsings>
                    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
                    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
                  </PropertyGroup>
                  <ItemGroup>
                    <PackageReference Include="BetterPortal.AspNetCore" Version="[{{runtime}}]" />
                    <Compile Include="**/.well-known/**/*.cs" />
                  </ItemGroup>
                </Project>
                """,
            ["bp-routes/hello/index.cs"] = """
                using BetterPortal;
                using BetterPortal.Generated;

                namespace BpService.Routes;
                public static class Index
                {
                    [RouteModule]
                    public static RouteDeclarationInput Create() => new() { ViewId = "hello.index", Title = "Hello" };
                }
                """,
            ["bp-routes/hello/GET.cs"] = """
                using AnyVali;
                using BetterPortal;
                using BetterPortal.Generated;

                namespace BpService.Routes;
                public static class Hello
                {
                    [RouteModule]
                    public static Operation Create()
                    {
                        var page = new Renderer<string>(new() { Renderer = "bootstrap5" }, (value, context) => "<p>Hello</p>");
                        var handler = new Handler<object?, object?, object?, object?, string>(
                            V.String(), context => ValueTask.FromResult("Hello"), renderers: [page]);
                        return new(handler, new() { OperationId = "hello.get", Method = HttpMethodInput.GET,
                            Title = "Hello", Description = "Return a greeting", Auth = new() { Required = true } });
                    }
                }
                """,
            ["Definition.cs"] = $$"""
                using BetterPortal;
                using BetterPortal.Generated;

                namespace BpService;
                public static class Definition
                {
                    public static ManifestDeclarationInput Declaration() => new() {
                        PluginId = {{Json.Write(pluginId)}}, Title = {{Json.Write(title)}},
                        Description = {{Json.Write(title)}}, Version = "1.0.0"
                    };
                    public static Registry Registry() => Discovery.Discover(typeof(Definition).Assembly);
                    public static BpSchemaOutput Export() => Registry().Schema(Declaration());
                }
                """,
            ["Program.cs"] = """
                using BetterPortal;
                using BetterPortal.AspNetCore;
                using BpService;

                if (args.SequenceEqual(["--new-bootstrap-key"]))
                {
                    Console.WriteLine(BootstrapCipher.GenerateKey());
                    return;
                }
                static string Required(string name) => Environment.GetEnvironmentVariable(name)
                    ?? throw new InvalidOperationException("Configure " + name);
                var builder = WebApplication.CreateBuilder(args);
                var directory = Environment.GetEnvironmentVariable("BP_STATE_DIRECTORY")
                    ?? Path.Combine(builder.Environment.ContentRootPath, ".bp-state");
                var service = new Service(Definition.Registry(), Definition.Declaration(), managed: true,
                    stateStore: new FileStateStore(Path.Combine(directory, "snapshot.json")));
                var installation = new ServiceInstallation(service,
                    new BootstrapStateStore(new FileStateStore(Path.Combine(directory, "bootstrap.json")), Required("BP_BOOTSTRAP_MASTER_KEY")),
                    Required("BP_CP_URL"), Required("BP_PUBLIC_ORIGIN"),
                    settingsStore: new FileStateStore(Path.Combine(directory, "settings.json")));
                builder.Services.AddBetterPortal(service, installation: installation);
                var app = builder.Build();
                app.MapBetterPortal(service, installation: installation);
                await app.RunAsync();
                """,
            ["README.md"] = """
                # Standalone BP service

                Install the matching native BP packages with .NET 10, then run:

                    dotnet build
                    bp-dotnet export --assembly bin/Debug/net10.0/BpService.dll --factory BpService.Definition:Export --output bp-contract.json
                    bp-dotnet deps sync --frozen --check

                For unpublished packages, first restore with --source /path/to/local/packages
                and --source https://api.nuget.org/v3/index.json. Commit packages.lock.json and
                use dotnet restore --locked-mode for subsequent builds.
                No Node or BSB installation is needed by this service.

                Configure BP_CP_URL (trusted config manager), BP_PUBLIC_ORIGIN (this service's
                public origin), and BP_BOOTSTRAP_MASTER_KEY through your host's protected secrets.
                Generate a master key once and retain it across restarts:

                    dotnet run -- --new-bootstrap-key

                BP_STATE_DIRECTORY defaults to .bp-state under the content root; mount persistent
                storage there in a container. Keep the master key separate from that directory.
                URLs require HTTPS except the runtime's exact loopback development exceptions.

                    dotnet run -- --urls http://127.0.0.1:8000

                Install through the existing config manager using the configured public origin.
                Health at /.well-known/bp/health returns 503 until installation, manifest submission
                and a valid scoped snapshot succeed. Mount hello.index / hello.get in an app;
                /hello then returns JSON or Bootstrap HTML with valid user authentication.
                The ASP.NET hosted service owns installation, sync and shutdown cancellation.

                Edit Definition.cs for BP identity/version and bp-routes for operations. Keep
                betterportal.json and betterportal.lock.json in source control. Use native deps
                commands for dependency contracts and repeat export after changing the registry.
                """
        };
        var directory = Path.GetFullPath(args[0]);
        if (Directory.Exists(directory) || File.Exists(directory)) throw new IOException("The output directory must not exist");
        Directory.CreateDirectory(directory);
        foreach (var (name, content) in files)
        {
            var target = Path.Combine(directory, name);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var output = new StreamWriter(new FileStream(target, FileMode.CreateNew, FileAccess.Write), new UTF8Encoding(false));
            output.Write(content + "\n");
        }
        Console.WriteLine(Path.Combine(directory, "README.md"));
        return 0;
    }
}
