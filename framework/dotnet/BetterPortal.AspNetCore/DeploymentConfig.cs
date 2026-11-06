using AnyVali;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal.AspNetCore;

/// <summary>Explicit, AnyVali-validated host configuration. No environment lookup.</summary>
public sealed record DeploymentConfig(string? ControlPlaneUrl, string PublicOrigin, string BootstrapMasterKey, string StateDirectory)
{
    private static readonly Schema Settings = Contracts.Import("""
        {"anyvaliVersion":"1.0","schemaVersion":"1.1","definitions":{},"extensions":{},"root":{
          "kind":"object","unknownKeys":"reject","required":["publicOrigin","bootstrapMasterKeyFile"],"properties":{
            "controlPlaneUrl":{"kind":"optional","inner":{"kind":"string","minLength":1}},
            "publicOrigin":{"kind":"string","minLength":1},
            "bootstrapMasterKeyFile":{"kind":"string","minLength":1},
            "stateDirectory":{"kind":"optional","inner":{"kind":"string","minLength":1}}
          }}}
        """);

    public static DeploymentConfig Load(string file)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(file))!;
        var value = (Node)Settings.Parse(Json.Read(File.ReadAllText(file)))!;
        var cp = value.GetValueOrDefault("controlPlaneUrl") as string;
        var origin = (string)value["publicOrigin"]!;
        if (cp is not null) TrustedKeys.SecureEndpoint(cp);
        var publicUri = TrustedKeys.SecureEndpoint(origin);
        if (publicUri.AbsolutePath != "/") throw new ArgumentException("Public origin must not contain a path");
        var key = File.ReadAllText(Path.GetFullPath((string)value["bootstrapMasterKeyFile"]!, directory)).Trim();
        _ = new BootstrapCipher(key);
        return new(cp, origin, key, Path.GetFullPath((string)value.GetValueOrDefault("stateDirectory", ".bp-state")!, directory));
    }

    // Record diagnostics must never print the bootstrap master key.
    public override string ToString() => $"DeploymentConfig {{ PublicOrigin = {PublicOrigin}, StateDirectory = {StateDirectory} }}";
}
