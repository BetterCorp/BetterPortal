using AnyVali;
using Microsoft.IdentityModel.Tokens;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Engines;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Modes;
using Org.BouncyCastle.Crypto.Parameters;
using System.Security.Cryptography;
using System.Text;
using Node = System.Collections.Generic.Dictionary<string, object?>;

namespace BetterPortal;

public sealed class ConfigEncryptionException(string message) : Exception(message);

/// <summary>One service key: write strings as v2, other JSON as v3; retain v1 read compatibility.</summary>
public sealed class ConfigCipher
{
    private readonly byte[] _current;
    private readonly byte[] _legacy;
    public ConfigCipher(string secret)
    {
        var material = Envelope.Utf8.GetBytes(secret);
        if (material.Length is < 32 or > 4096) throw new ConfigEncryptionException("Use a service-generated key of at least 256 bits");
        try
        {
            _current = SCrypt.Generate(material, "bp-config-store"u8.ToArray(), 32768, 8, 1, 32);
            _legacy = SCrypt.Generate(material, "bp-config-store"u8.ToArray(), 16384, 8, 1, 32);
        }
        finally { CryptographicOperations.ZeroMemory(material); }
    }
    public static string GenerateKey() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
    public string Encrypt(object? value)
    {
        value = Contracts.Parse("JsonValueSchema", Json.Read(Json.Write(value)));
        var plain = Envelope.Utf8.GetBytes(value is string text ? text : Json.Write(value));
        if (plain.Length > Envelope.Limit) throw new ConfigEncryptionException("Configuration value exceeds 1 MiB");
        var nonce = RandomNumberGenerator.GetBytes(12);
        var encrypted = Envelope.Crypt(true, _current, nonce, plain);
        byte[] payload = [.. nonce, .. encrypted[^16..], .. encrypted[..^16]];
        return (value is string ? "enc:aes256gcm2:" : "enc:aes256gcm3:") + Convert.ToBase64String(payload);
    }
    public object? Decrypt(string value)
    {
        var prefix = new[] { "enc:aes256gcm:", "enc:aes256gcm2:", "enc:aes256gcm3:" }.FirstOrDefault(prefix => value.StartsWith(prefix, StringComparison.Ordinal))
            ?? throw new ConfigEncryptionException("Unknown configuration envelope");
        var legacy = prefix == "enc:aes256gcm:";
        var length = legacy ? 16 : 12;
        var payload = Envelope.Decode(value[prefix.Length..]);
        if (payload.Length < length + 16 || payload.Length > Envelope.Limit + length + 16) throw new ConfigEncryptionException("Invalid configuration envelope length");
        try
        {
            var plain = Envelope.Utf8.GetString(Envelope.Crypt(false, legacy ? _legacy : _current, payload[..length], [.. payload[(length + 16)..], .. payload[length..(length + 16)]]));
            return Contracts.Parse("JsonValueSchema", prefix == "enc:aes256gcm3:" ? Json.Read(plain) : plain);
        }
        catch (Exception error) when (error is InvalidCipherTextException or DecoderFallbackException or System.Text.Json.JsonException or ArgumentException or ValidationError)
        { throw new ConfigEncryptionException("Configuration authentication failed"); }
    }
}

internal static class Envelope
{
    internal const int Limit = 1024 * 1024;
    internal static readonly UTF8Encoding Utf8 = new(false, true);
    internal static byte[] Decode(string value, bool url = false)
    {
        if (value.Length is 0 or > 2 * Limit) throw new ConfigEncryptionException("Invalid configuration envelope");
        try
        {
            var bytes = url ? Base64UrlEncoder.DecodeBytes(value) : Convert.FromBase64String(value);
            if ((url ? Base64UrlEncoder.Encode(bytes) : Convert.ToBase64String(bytes)) != value) throw new FormatException();
            return bytes;
        }
        catch (Exception error) when (error is FormatException or ArgumentException)
        { throw new ConfigEncryptionException("Invalid configuration encoding"); }
    }
    internal static byte[] Crypt(bool encrypt, byte[] key, byte[] nonce, byte[] value, byte[]? aad = null)
    {
        var cipher = new GcmBlockCipher(new AesEngine());
        cipher.Init(encrypt, new AeadParameters(new KeyParameter(key), 128, nonce, aad));
        var output = new byte[cipher.GetOutputSize(value.Length)];
        var written = cipher.ProcessBytes(value, 0, value.Length, output, 0);
        written += cipher.DoFinal(output, written);
        return output[..written];
    }
}

public static class PreviewConfig
{
    private const string Prefix = "encrypted:bp-aes256gcm-v1:";
    private const string KeyPrefix = "bp_pck_";
    public static string GenerateKey() => KeyPrefix + Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
    private static byte[] Key(string value)
    {
        if (!value.StartsWith(KeyPrefix, StringComparison.Ordinal)) throw new ConfigEncryptionException("Invalid preview key");
        var key = Envelope.Decode(value[KeyPrefix.Length..], true);
        return key.Length == 32 ? key : throw new ConfigEncryptionException("Invalid preview key length");
    }
    private static byte[] Aad(string scope, IEnumerable<object> path)
    {
        if (scope is not ("tenant" or "app")) throw new ConfigEncryptionException("Invalid preview scope");
        var parts = path.ToArray();
        if (parts.Any(part => part is not (string or int or long))) throw new ConfigEncryptionException("Invalid preview field path");
        return Envelope.Utf8.GetBytes("betterportal.preview-config.v1\n" + scope + "\n" + string.Join(".", parts));
    }
    public static string EncryptValue(string key, string scope, IEnumerable<object> path, string value)
    {
        var plain = Envelope.Utf8.GetBytes(value);
        if (plain.Length > Envelope.Limit) throw new ConfigEncryptionException("Configuration value exceeds 1 MiB");
        var nonce = RandomNumberGenerator.GetBytes(12);
        var payload = Envelope.Crypt(true, Key(key), nonce, plain, Aad(scope, path));
        return Prefix + Base64UrlEncoder.Encode(nonce) + ":" + Base64UrlEncoder.Encode(payload);
    }
    public static string DecryptValue(string key, string scope, IEnumerable<object> path, string value)
    {
        if (!value.StartsWith(Prefix, StringComparison.Ordinal)) throw new ConfigEncryptionException("Unknown preview envelope");
        var parts = value[Prefix.Length..].Split(':');
        if (parts.Length != 2) throw new ConfigEncryptionException("Invalid preview envelope");
        var nonce = Envelope.Decode(parts[0], true);
        var payload = Envelope.Decode(parts[1], true);
        if (nonce.Length != 12 || payload.Length is < 16 or > Envelope.Limit + 16) throw new ConfigEncryptionException("Invalid preview envelope length");
        try { return Envelope.Utf8.GetString(Envelope.Crypt(false, Key(key), nonce, payload, Aad(scope, path))); }
        catch (Exception error) when (error is InvalidCipherTextException or DecoderFallbackException)
        { throw new ConfigEncryptionException("Preview authentication failed"); }
    }
    public static Schema Schema(IEnumerable<Node> descriptors, string scope)
    {
        Aad(scope, []);
        var fields = new Dictionary<string, Schema>();
        foreach (var descriptor in descriptors)
            foreach (var field in ((IEnumerable<object?>)((Node)Contracts.Parse("ConfigSchemaDescriptorSchema", descriptor)!)["fields"]!).Cast<Node>())
            {
                if (!Equals(field["scope"], scope)) continue;
                Schema schema = V.String().MaxLength(255).Describe((string)field["description"]!, new DescribeOptions { Title = (string)field["title"]!, Sensitive = Equals(field["visibility"], "secret") });
                fields.Add((string)field["key"]!, field["required"] is true ? schema : V.Optional(schema));
            }
        return V.Object(fields, UnknownKeyMode.Reject);
    }
    public static object? Encrypt(Schema schema, string key, string scope, object? values) =>
        V.Encrypt(schema, values, (path, value) => value is string text ? EncryptValue(key, scope, path, text) : throw new ConfigEncryptionException("Preview values must be strings"));
    public static object? Decrypt(Schema schema, string key, string scope, object? values) =>
        V.Decrypt(schema, values, (path, value) => value is string text ? DecryptValue(key, scope, path, text) : throw new ConfigEncryptionException("Unknown preview envelope"));
}
