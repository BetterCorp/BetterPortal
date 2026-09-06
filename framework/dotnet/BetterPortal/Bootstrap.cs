using AnyVali;
using Microsoft.IdentityModel.Tokens;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Generators;
using System.Security.Cryptography;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class BootstrapException(string message) : Exception(message);

/// <summary>Node-compatible whole-state AES-GCM. Supply the master key from a protected host secret.</summary>
public sealed class BootstrapCipher
{
    private readonly byte[] key;
    public BootstrapCipher(string masterKey)
    {
        try
        {
            if (!masterKey.StartsWith("bp_bsk_", StringComparison.Ordinal) || Envelope.Decode(masterKey[7..], url: true).Length != 32)
                throw new ArgumentException();
            key = SCrypt.Generate(Envelope.Utf8.GetBytes(masterKey), "bp-bootstrap-state-v1"u8.ToArray(), 16384, 8, 1, 32);
        }
        catch (Exception error) when (error is ArgumentException or ConfigEncryptionException)
        { throw new BootstrapException("Invalid bootstrap master key"); }
    }
    public static string GenerateKey() => "bp_bsk_" + Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    internal static KeyPair Identity(Node value)
    {
        var pair = new KeyPair((string)value["privateKeyPem"]!, (string)value["kid"]!);
        // Compare the complete Node SPKI PEM: ImportFromPem can also accept private
        // material or ignore trailing content, neither belongs in a public field.
        if (string.Concat(((string)value["publicKeyPem"]!).Where(c => !char.IsWhiteSpace(c))) != string.Concat(pair.PublicKeyPem.Where(c => !char.IsWhiteSpace(c))))
            throw new BootstrapException("Signing identity public/private keys do not match");
        return pair;
    }
    internal static Node State(object? value)
    {
        try
        {
            var result = (Node)Contracts.Parse("BootstrapStateSchema", value)!;
            foreach (var field in new[] { "cpUrl", "cpJwksUri" })
                if (result.TryGetValue(field, out var uri)) TrustedKeys.SecureEndpoint((string)uri!, allowQuery: field == "cpJwksUri");
            if (result.GetValueOrDefault("apiKey") is string apiKey && apiKey.Any(c => c < 33 || c > 126)) throw new ArgumentException();
            if (result.GetValueOrDefault("identity") is Node identity) Identity(identity);
            return result;
        }
        catch (Exception error) when (error is ArgumentException or ValidationError or CryptographicException or BootstrapException)
        { throw new BootstrapException("Invalid bootstrap state"); }
    }
    public byte[] Encrypt(object? value)
    {
        var plain = Envelope.Utf8.GetBytes(Json.Write(State(value)));
        if (plain.Length > Envelope.Limit) throw new BootstrapException("Bootstrap state exceeds 1 MiB");
        var nonce = RandomNumberGenerator.GetBytes(12);
        var encrypted = Envelope.Crypt(true, key, nonce, plain);
        return Envelope.Utf8.GetBytes(Json.Write(Contracts.Parse("BootstrapStateEnvelopeSchema", new Node
        {
            ["v"] = 1, ["iv"] = Convert.ToBase64String(nonce),
            ["tag"] = Convert.ToBase64String(encrypted[^16..]), ["ct"] = Convert.ToBase64String(encrypted[..^16])
        })));
    }
    public Node Decrypt(ReadOnlySpan<byte> value)
    {
        try
        {
            if (value.Length > 2 * Envelope.Limit) throw new ArgumentException();
            var envelope = (Node)Contracts.Parse("BootstrapStateEnvelopeSchema", Json.Read(Envelope.Utf8.GetString(value)))!;
            var iv = Envelope.Decode((string)envelope["iv"]!); var tag = Envelope.Decode((string)envelope["tag"]!);
            var ct = Envelope.Decode((string)envelope["ct"]!);
            if (iv.Length != 12 || tag.Length != 16 || ct.Length > Envelope.Limit) throw new ArgumentException();
            return State(Json.Read(Envelope.Utf8.GetString(Envelope.Crypt(false, key, iv, [.. ct, .. tag]))));
        }
        catch (Exception error) when (error is ArgumentException or ValidationError or InvalidCipherTextException or ConfigEncryptionException or BootstrapException or System.Text.Json.JsonException)
        { throw new BootstrapException("Bootstrap state authentication failed"); }
    }
}

/// <summary>One owner per store. Operations reload state and retain no plaintext cache or background work.</summary>
public sealed class BootstrapStateStore(IStateStore store, string key)
{
    private readonly BootstrapCipher cipher = new(key);
    private readonly SemaphoreSlim gate = new(1, 1);
    private async ValueTask<Node> ReadState(CancellationToken cancellation)
    {
        var raw = await store.Load(cancellation);
        return raw is null ? new Node { ["version"] = 1 } : cipher.Decrypt(raw);
    }
    public async ValueTask<Node> Read(bool redacted = false, CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try
        {
            var value = await ReadState(cancellation);
            if (!redacted) return value;
            var paths = new List<string[]>();
            var result = (Node)V.Encrypt(Contracts.Get("BootstrapStateSchema"), value, (path, _) =>
            {
                paths.Add(path.Cast<string>().ToArray()); return "encrypted:redacted";
            })!;
            // This canonical object has no unions; every native sensitive path is retained.
            foreach (var path in paths)
            {
                var parent = result;
                foreach (var part in path[..^1]) parent = (Node)parent[part]!;
                parent[path[^1]] = "__redacted__";
            }
            return result;
        }
        finally { gate.Release(); }
    }
    public async ValueTask<Node> Write(IDictionary<string, object?> patch, CancellationToken cancellation = default)
    {
        var copied = new Node(patch); copied.TryAdd("version", 1); copied = BootstrapCipher.State(copied);
        await gate.WaitAsync(cancellation);
        try
        {
            var value = await ReadState(cancellation);
            foreach (var (name, field) in copied) value[name] = field;
            value = BootstrapCipher.State(value);
            await store.Save(cipher.Encrypt(value), cancellation);
            return value;
        }
        finally { gate.Release(); }
    }
    public async ValueTask Clear(CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try { await store.Save(cipher.Encrypt(new Node { ["version"] = 1 }), cancellation); }
        finally { gate.Release(); }
    }
    public async ValueTask<KeyPair> Identity(CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try
        {
            var value = await ReadState(cancellation);
            if (value.GetValueOrDefault("identity") is Node identity) return BootstrapCipher.Identity(identity);
            var pair = KeyPair.Generate();
            value["identity"] = new Node { ["privateKeyPem"] = pair.PrivateKeyPem, ["publicKeyPem"] = pair.PublicKeyPem, ["kid"] = pair.Kid };
            await store.Save(cipher.Encrypt(value), cancellation);
            return pair;
        }
        finally { gate.Release(); }
    }
}
