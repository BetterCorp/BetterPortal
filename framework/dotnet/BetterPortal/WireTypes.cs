using System.Text.Json;
using System.Text.Json.Serialization;

namespace BetterPortal;

/// <summary>Missing and present-null are distinct wire states. Generated fields omit the default value.</summary>
[JsonConverter(typeof(OptionalConverterFactory))]
public readonly struct Optional<T>
{
    public bool HasValue { get; }
    private readonly T _value;
    public T Value => HasValue ? _value : throw new InvalidOperationException("Field is omitted");
    public Optional(T value) { _value = value; HasValue = true; }
    public static implicit operator Optional<T>(T value) => new(value);
}

internal sealed class OptionalConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type type) => type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Optional<>);
    public override JsonConverter CreateConverter(Type type, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(OptionalConverter<>).MakeGenericType(type.GetGenericArguments()))!;

    private sealed class OptionalConverter<T> : JsonConverter<Optional<T>>
    {
        public override bool HandleNull => true;
        public override Optional<T> Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
            new(JsonSerializer.Deserialize<T>(ref reader, options)!);
        public override void Write(Utf8JsonWriter writer, Optional<T> value, JsonSerializerOptions options)
        {
            if (!value.HasValue) throw new JsonException("Omitted fields must use JsonIgnoreCondition.WhenWritingDefault");
            JsonSerializer.Serialize(writer, value.Value, options);
        }
    }
}

/// <summary>A typed JSON union. AnyVali validates first; decoding preserves the validated wire value.</summary>
[JsonConverter(typeof(VariantConverterFactory))]
public readonly struct Variant<TFirst, TSecond>
{
    private readonly object? _value;
    private readonly byte _branch;
    public object? Value => _branch != 0 ? _value : throw new JsonException("Uninitialized union value");
    public Variant(TFirst value) { _value = value; _branch = 1; }
    public Variant(TSecond value) { _value = value; _branch = 2; }
    public static implicit operator Variant<TFirst, TSecond>(TFirst value) => new(value);
    public static implicit operator Variant<TFirst, TSecond>(TSecond value) => new(value);
    public TResult Match<TResult>(Func<TFirst, TResult> first, Func<TSecond, TResult> second) => _branch switch
    {
        1 => first((TFirst)_value!), 2 => second((TSecond)_value!), _ => throw new InvalidOperationException("Uninitialized union value")
    };
}

internal sealed class VariantConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type type) => type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Variant<,>);
    public override JsonConverter CreateConverter(Type type, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(VariantConverter<,>).MakeGenericType(type.GetGenericArguments()))!;

    private sealed class VariantConverter<TFirst, TSecond> : JsonConverter<Variant<TFirst, TSecond>>
    {
        public override bool HandleNull => true;
        private static T Decode<T>(JsonElement element, JsonSerializerOptions options)
        {
            var value = element.Deserialize<T>(options);
            if (value is null || !JsonElement.DeepEquals(element, JsonSerializer.SerializeToElement(value, options)))
                throw new JsonException("Union branch cannot preserve the wire value");
            return value;
        }
        public override Variant<TFirst, TSecond> Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options)
        {
            using var document = JsonDocument.ParseValue(ref reader);
            try
            {
                return new(Decode<TFirst>(document.RootElement, options));
            }
            catch (Exception error) when (error is JsonException or NotSupportedException)
            {
                return new(Decode<TSecond>(document.RootElement, options));
            }
        }
        public override void Write(Utf8JsonWriter writer, Variant<TFirst, TSecond> value, JsonSerializerOptions options) =>
            JsonSerializer.Serialize(writer, value.Value, options);
    }
}

/// <summary>Native JSON null as a non-nullable union branch.</summary>
[JsonConverter(typeof(JsonNullConverter))]
public readonly record struct JsonNull;

internal sealed class JsonNullConverter : JsonConverter<JsonNull>
{
    public override bool HandleNull => true;
    public override JsonNull Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.Null ? default : throw new JsonException("Expected JSON null");
    public override void Write(Utf8JsonWriter writer, JsonNull value, JsonSerializerOptions options) => writer.WriteNullValue();
}

/// <summary>No valid wire value exists; useful for the element type of empty tuples/arrays.</summary>
public sealed class Never
{
    private Never() { }
}

/// <summary>Transparent named contract values, without independently maintained validation.</summary>
public interface IWireValue<TSelf, TValue> where TSelf : IWireValue<TSelf, TValue>
{
    TValue Value { get; }
    static abstract TSelf FromValue(TValue value);
}

public sealed class WireValueConverterFactory : JsonConverterFactory
{
    private static Type? ContractInterface(Type type) => type.GetInterfaces().FirstOrDefault(candidate =>
        candidate.IsGenericType && candidate.GetGenericTypeDefinition() == typeof(IWireValue<,>));
    public override bool CanConvert(Type type) => ContractInterface(type) is not null;
    public override JsonConverter CreateConverter(Type type, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(WireValueConverter<,>).MakeGenericType(ContractInterface(type)!.GetGenericArguments()))!;

    private sealed class WireValueConverter<TSelf, TValue> : JsonConverter<TSelf> where TSelf : IWireValue<TSelf, TValue>
    {
        public override bool HandleNull => true;
        public override TSelf Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
            TSelf.FromValue(JsonSerializer.Deserialize<TValue>(ref reader, options)!);
        public override void Write(Utf8JsonWriter writer, TSelf value, JsonSerializerOptions options) =>
            JsonSerializer.Serialize(writer, value.Value, options);
    }
}
