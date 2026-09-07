// Generated from AnyVali documents; do not edit. SHA256: f05f7f8a8bf7772af1c152794041169e0836e952eddcc3d0219b2456dd8ac9fd
#nullable enable
using BetterPortal;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace @ConformanceClients;

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_Response(System.Text.Json.Nodes.JsonNode? Value) : IWireValue<PeerClient_CheckGet_Response, System.Text.Json.Nodes.JsonNode?>
{
    public static PeerClient_CheckGet_Response FromValue(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator PeerClient_CheckGet_Response(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator System.Text.Json.Nodes.JsonNode?(PeerClient_CheckGet_Response value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_ResponseInput(System.Text.Json.Nodes.JsonNode? Value) : IWireValue<PeerClient_CheckGet_ResponseInput, System.Text.Json.Nodes.JsonNode?>
{
    public static PeerClient_CheckGet_ResponseInput FromValue(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator PeerClient_CheckGet_ResponseInput(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator System.Text.Json.Nodes.JsonNode?(PeerClient_CheckGet_ResponseInput value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_body(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_body, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_body FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_bodyInput(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_bodyInput, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_bodyInput FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_headers(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_headers, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_headers FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_headersInput(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_headersInput, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_headersInput FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_params(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_params, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_params FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_paramsInput(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_paramsInput, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_paramsInput FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_query(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_query, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_query FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PeerClient_CheckGet_queryInput(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<PeerClient_CheckGet_queryInput, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static PeerClient_CheckGet_queryInput FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

public sealed record PeerClient_CheckGetInputs
{
    [JsonPropertyName("params")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PeerClient_CheckGet_paramsInput> Params { get; init; }
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PeerClient_CheckGet_queryInput> Query { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PeerClient_CheckGet_headersInput> Headers { get; init; }
    [JsonPropertyName("body")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PeerClient_CheckGet_bodyInput> Body { get; init; }
}

public sealed class @PeerClient
{
    private static readonly global::BetterPortal.ClientContract _bpContract = new(global::BetterPortal.Json.Read("{\u0022manifest\u0022:{\u0022protocolVersion\u0022:2,\u0022pluginId\u0022:\u0022com.example.service\u0022,\u0022title\u0022:\u0022Host\u0022,\u0022description\u0022:\u0022Host service\u0022,\u0022version\u0022:\u00221.0.0\u0022,\u0022category\u0022:\u0022service\u0022,\u0022deploymentModes\u0022:[\u0022self-hosted\u0022],\u0022capabilities\u0022:[\u0022view.json\u0022,\u0022view.metadata\u0022],\u0022supportedRenderers\u0022:[],\u0022supportedRenderModes\u0022:[],\u0022views\u0022:[{\u0022viewId\u0022:\u0022check\u0022,\u0022title\u0022:\u0022GET\u0022,\u0022description\u0022:\u0022Check\u0022,\u0022path\u0022:\u0022/check/:key\u0022,\u0022pathVariants\u0022:[],\u0022paramsSchema\u0022:{},\u0022operations\u0022:[{\u0022operationId\u0022:\u0022check.get\u0022,\u0022method\u0022:\u0022GET\u0022,\u0022title\u0022:\u0022GET\u0022,\u0022description\u0022:\u0022Check\u0022,\u0022querySchema\u0022:{},\u0022headersSchema\u0022:{},\u0022bodySchema\u0022:{},\u0022jsonResponseSchema\u0022:{\u0022anyvaliVersion\u0022:\u00221.0\u0022,\u0022schemaVersion\u0022:\u00221.1\u0022,\u0022root\u0022:{\u0022kind\u0022:\u0022ref\u0022,\u0022ref\u0022:\u0022#/definitions/BetterPortalJsonValue\u0022},\u0022definitions\u0022:{\u0022BetterPortalJsonValue\u0022:{\u0022kind\u0022:\u0022union\u0022,\u0022variants\u0022:[{\u0022kind\u0022:\u0022null\u0022},{\u0022kind\u0022:\u0022bool\u0022},{\u0022kind\u0022:\u0022string\u0022},{\u0022kind\u0022:\u0022number\u0022},{\u0022kind\u0022:\u0022array\u0022,\u0022items\u0022:{\u0022kind\u0022:\u0022ref\u0022,\u0022ref\u0022:\u0022#/definitions/BetterPortalJsonValue\u0022}},{\u0022kind\u0022:\u0022record\u0022,\u0022valueSchema\u0022:{\u0022kind\u0022:\u0022ref\u0022,\u0022ref\u0022:\u0022#/definitions/BetterPortalJsonValue\u0022}}]}},\u0022extensions\u0022:{}},\u0022metadataResponseSchema\u0022:{},\u0022renderable\u0022:false,\u0022html\u0022:{\u0022renderers\u0022:{}},\u0022auth\u0022:{\u0022required\u0022:true,\u0022callers\u0022:[\u0022user\u0022,\u0022service\u0022,\u0022delegated\u0022],\u0022permissions\u0022:[{\u0022serviceId\u0022:\u0022com.example.service\u0022,\u0022viewId\u0022:\u0022check\u0022,\u0022permissions\u0022:[\u0022read\u0022]}]},\u0022sitemap\u0022:{\u0022kind\u0022:\u0022default\u0022},\u0022robots\u0022:[],\u0022dependencies\u0022:[],\u0022apiContracts\u0022:[{\u0022id\u0022:\u0022read-item\u0022,\u0022title\u0022:\u0022Read\u0022,\u0022version\u0022:\u00221.0.0\u0022,\u0022viewId\u0022:\u0022check\u0022,\u0022methods\u0022:[\u0022GET\u0022],\u0022capabilities\u0022:[],\u0022permissions\u0022:[\u0022read\u0022],\u0022modes\u0022:[\u0022service\u0022,\u0022delegated\u0022]}],\u0022demoScenarios\u0022:[],\u0022cacheHints\u0022:{\u0022ttlSeconds\u0022:0,\u0022varyBy\u0022:[]}}]}],\u0022configSchemas\u0022:[],\u0022permissions\u0022:[],\u0022adminApis\u0022:[],\u0022webhooks\u0022:[],\u0022apiContracts\u0022:[{\u0022id\u0022:\u0022read-item\u0022,\u0022title\u0022:\u0022Read\u0022,\u0022version\u0022:\u00221.0.0\u0022,\u0022viewId\u0022:\u0022check\u0022,\u0022methods\u0022:[\u0022GET\u0022],\u0022capabilities\u0022:[],\u0022permissions\u0022:[\u0022read\u0022],\u0022modes\u0022:[\u0022service\u0022,\u0022delegated\u0022]}],\u0022m2mRequests\u0022:[],\u0022developerResources\u0022:[],\u0022cacheHints\u0022:{\u0022metadataTtlSeconds\u0022:1800}},\u0022routes\u0022:[{\u0022viewId\u0022:\u0022check\u0022,\u0022path\u0022:\u0022/check/:key\u0022,\u0022pathVariants\u0022:[],\u0022operations\u0022:[{\u0022operationId\u0022:\u0022check.get\u0022,\u0022method\u0022:\u0022GET\u0022}],\u0022paramNames\u0022:[\u0022key\u0022],\u0022renderers\u0022:[],\u0022hasFragments\u0022:false,\u0022fragments\u0022:[],\u0022components\u0022:[]}]}")!);
    private readonly global::BetterPortal.Client _bpClient;
    public @PeerClient(global::BetterPortal.RequestClients context, string? serviceId = null, string? requestId = null)
    {
        if (serviceId is not null && requestId is not null) throw new global::System.ArgumentException("Select a user service or a declared M2M request");
        _bpClient = requestId is not null ? context.M2m(requestId, _bpContract) : context.User(_bpContract, serviceId);
    }

    public global::System.Threading.Tasks.Task<PeerClient_CheckGet_Response> CheckGetAsync(PeerClient_CheckGetInputs? values = null, global::System.Threading.CancellationToken cancellation = default)
        => _bpClient.RequestAsync<PeerClient_CheckGet_Response>("check.get", values, cancellation);
}
