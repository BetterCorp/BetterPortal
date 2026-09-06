// Generated from AnyVali documents; do not edit. SHA256: 9bc3d73163be14e9d943f2d593f6fc8becf25ad0514a4b1a1e308bb06226cd83
#nullable enable
using BetterPortal;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace @BetterPortal.@Generated;

public sealed record AdminApiDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<AdminApiDescriptorMethodsItem> Methods { get; init; }
    [JsonPropertyName("supportsCustomUi")]
    public required bool SupportsCustomUi { get; init; }
}

public sealed record AdminApiDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<AdminApiDescriptorInputMethodsItem> Methods { get; init; }
    [JsonPropertyName("supportsCustomUi")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> SupportsCustomUi { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AdminApiDescriptorInputMethodsItem>))]
public enum AdminApiDescriptorInputMethodsItem
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
}

[JsonConverter(typeof(JsonStringEnumConverter<AdminApiDescriptorMethodsItem>))]
public enum AdminApiDescriptorMethodsItem
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
}

public sealed record ApiAuthRequirement
{
    [JsonPropertyName("required")]
    public required bool Required { get; init; }
    [JsonPropertyName("callers")]
    public required IReadOnlyList<ApiCallerMode> Callers { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<ApiAuthRequirementPermissionsItem> Permissions { get; init; }
}

public sealed record ApiAuthRequirementInput
{
    [JsonPropertyName("required")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Required { get; init; }
    [JsonPropertyName("callers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiCallerModeInput>> Callers { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiAuthRequirementInputPermissionsItem>> Permissions { get; init; }
}

public sealed record ApiAuthRequirementInputPermissionsItem
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionActionInput> Permissions { get; init; }
}

public sealed record ApiAuthRequirementPermissionsItem
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionAction> Permissions { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ApiCallerMode>))]
public enum ApiCallerMode
{
    [JsonStringEnumMemberName("user")]
    User,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

[JsonConverter(typeof(JsonStringEnumConverter<ApiCallerModeInput>))]
public enum ApiCallerModeInput
{
    [JsonStringEnumMemberName("user")]
    User,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

public sealed record ApiContractDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethod> Methods { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<string> Permissions { get; init; }
    [JsonPropertyName("modes")]
    public required IReadOnlyList<M2MCallerMode> Modes { get; init; }
}

public sealed record ApiContractDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethodInput> Methods { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Permissions { get; init; }
    [JsonPropertyName("modes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MCallerModeInput>> Modes { get; init; }
}

public sealed record App
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("shell")]
    public required AppShell Shell { get; init; }
    [JsonPropertyName("routes")]
    public required IReadOnlyList<AppRoute> Routes { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyDictionary<string, IReadOnlyList<FragmentAssignment>> Fragments { get; init; }
}

public sealed record AppAuthConfig
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthProviderConfig> Provider { get; init; }
    [JsonPropertyName("roleAuthority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthRoleAuthority> RoleAuthority { get; init; }
    [JsonPropertyName("loginViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LoginViewId { get; init; }
    [JsonPropertyName("logoutViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoutViewId { get; init; }
    [JsonPropertyName("refreshViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RefreshViewId { get; init; }
    [JsonPropertyName("redirects")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthRedirects> Redirects { get; init; }
    [JsonPropertyName("expectedIssuer")]
    public required string ExpectedIssuer { get; init; }
    [JsonPropertyName("expectedAudience")]
    public required string ExpectedAudience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwks> PublicKeys { get; init; }
    [JsonPropertyName("roles")]
    public required IReadOnlyList<AppAuthRole> Roles { get; init; }
}

public sealed record AppAuthConfigInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthProviderConfigInput> Provider { get; init; }
    [JsonPropertyName("roleAuthority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthRoleAuthorityInput> RoleAuthority { get; init; }
    [JsonPropertyName("loginViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LoginViewId { get; init; }
    [JsonPropertyName("logoutViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoutViewId { get; init; }
    [JsonPropertyName("refreshViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RefreshViewId { get; init; }
    [JsonPropertyName("redirects")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthRedirectsInput> Redirects { get; init; }
    [JsonPropertyName("expectedIssuer")]
    public required string ExpectedIssuer { get; init; }
    [JsonPropertyName("expectedAudience")]
    public required string ExpectedAudience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwksInput> PublicKeys { get; init; }
    [JsonPropertyName("roles")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AppAuthRoleInput>> Roles { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AppAuthPermissionAction>))]
public enum AppAuthPermissionAction
{
    [JsonStringEnumMemberName("read")]
    Read,
    [JsonStringEnumMemberName("create")]
    Create,
    [JsonStringEnumMemberName("update")]
    Update,
    [JsonStringEnumMemberName("delete")]
    Delete,
}

[JsonConverter(typeof(JsonStringEnumConverter<AppAuthPermissionActionInput>))]
public enum AppAuthPermissionActionInput
{
    [JsonStringEnumMemberName("read")]
    Read,
    [JsonStringEnumMemberName("create")]
    Create,
    [JsonStringEnumMemberName("update")]
    Update,
    [JsonStringEnumMemberName("delete")]
    Delete,
}

public sealed record AppAuthPermissionGrant
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionAction> Permissions { get; init; }
}

public sealed record AppAuthPermissionGrantInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionActionInput> Permissions { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct AppAuthProviderConfig(Variant<DefaultAuthProviderConfig, AuthressProviderConfig> Value) : IWireValue<AppAuthProviderConfig, Variant<DefaultAuthProviderConfig, AuthressProviderConfig>>
{
    public static AppAuthProviderConfig FromValue(Variant<DefaultAuthProviderConfig, AuthressProviderConfig> value) => new(value);
    public static implicit operator AppAuthProviderConfig(Variant<DefaultAuthProviderConfig, AuthressProviderConfig> value) => new(value);
    public static implicit operator Variant<DefaultAuthProviderConfig, AuthressProviderConfig>(AppAuthProviderConfig value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct AppAuthProviderConfigInput(Variant<DefaultAuthProviderConfigInput, AuthressProviderConfigInput> Value) : IWireValue<AppAuthProviderConfigInput, Variant<DefaultAuthProviderConfigInput, AuthressProviderConfigInput>>
{
    public static AppAuthProviderConfigInput FromValue(Variant<DefaultAuthProviderConfigInput, AuthressProviderConfigInput> value) => new(value);
    public static implicit operator AppAuthProviderConfigInput(Variant<DefaultAuthProviderConfigInput, AuthressProviderConfigInput> value) => new(value);
    public static implicit operator Variant<DefaultAuthProviderConfigInput, AuthressProviderConfigInput>(AppAuthProviderConfigInput value) => value.Value;
}

public sealed record AppAuthRedirects
{
    [JsonPropertyName("afterLogin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReference> AfterLogin { get; init; }
    [JsonPropertyName("afterLogout")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReference> AfterLogout { get; init; }
}

public sealed record AppAuthRedirectsInput
{
    [JsonPropertyName("afterLogin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReferenceInput> AfterLogin { get; init; }
    [JsonPropertyName("afterLogout")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReferenceInput> AfterLogout { get; init; }
}

public sealed record AppAuthRole
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionGrant> Permissions { get; init; }
}

public sealed record AppAuthRoleInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AppAuthPermissionGrantInput>> Permissions { get; init; }
}

public sealed record AppAuthViewReference
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
}

public sealed record AppAuthViewReferenceInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
}

public sealed record AppInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("shell")]
    public required AppInputShell Shell { get; init; }
    [JsonPropertyName("routes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AppRouteInput>> Routes { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyList<FragmentAssignmentInput>>> Fragments { get; init; }
}

public sealed record AppInputShell
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
}

public sealed record AppRoute
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record AppRouteInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record AppShell
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
}

public sealed record AuthAudienceRule
{
    [JsonPropertyName("realm")]
    public required IdentityRealm Realm { get; init; }
    [JsonPropertyName("audiences")]
    public required IReadOnlyList<string> Audiences { get; init; }
}

public sealed record AuthAudienceRuleInput
{
    [JsonPropertyName("realm")]
    public required IdentityRealmInput Realm { get; init; }
    [JsonPropertyName("audiences")]
    public required IReadOnlyList<string> Audiences { get; init; }
}

public sealed record AuthProviderRuntimeMetadata
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwks> PublicKeys { get; init; }
}

public sealed record AuthProviderRuntimeMetadataInput
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwksInput> PublicKeys { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AuthRoleAuthority>))]
public enum AuthRoleAuthority
{
    [JsonStringEnumMemberName("provider")]
    Provider,
    [JsonStringEnumMemberName("betterportal")]
    Betterportal,
}

[JsonConverter(typeof(JsonStringEnumConverter<AuthRoleAuthorityInput>))]
public enum AuthRoleAuthorityInput
{
    [JsonStringEnumMemberName("provider")]
    Provider,
    [JsonStringEnumMemberName("betterportal")]
    Betterportal,
}

public sealed record AuthressProviderConfig
{
    [JsonPropertyName("kind")]
    public required AuthressProviderConfigKind Kind { get; init; }
    [JsonPropertyName("roleClaimPath")]
    public required string RoleClaimPath { get; init; }
    [JsonPropertyName("subjectClaimPath")]
    public required string SubjectClaimPath { get; init; }
    [JsonPropertyName("nameClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NameClaimPath { get; init; }
    [JsonPropertyName("emailClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> EmailClaimPath { get; init; }
    [JsonPropertyName("pictureClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PictureClaimPath { get; init; }
}

public sealed record AuthressProviderConfigInput
{
    [JsonPropertyName("kind")]
    public required AuthressProviderConfigInputKind Kind { get; init; }
    [JsonPropertyName("roleClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RoleClaimPath { get; init; }
    [JsonPropertyName("subjectClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SubjectClaimPath { get; init; }
    [JsonPropertyName("nameClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NameClaimPath { get; init; }
    [JsonPropertyName("emailClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> EmailClaimPath { get; init; }
    [JsonPropertyName("pictureClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PictureClaimPath { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AuthressProviderConfigInputKind>))]
public enum AuthressProviderConfigInputKind
{
    [JsonStringEnumMemberName("authress.io")]
    AuthressIo,
}

[JsonConverter(typeof(JsonStringEnumConverter<AuthressProviderConfigKind>))]
public enum AuthressProviderConfigKind
{
    [JsonStringEnumMemberName("authress.io")]
    AuthressIo,
}

public sealed record BetterPortalApp
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("hostnames")]
    public required IReadOnlyList<string> Hostnames { get; init; }
    [JsonPropertyName("originOverrides")]
    public required IReadOnlyList<string> OriginOverrides { get; init; }
    [JsonPropertyName("refererOverrides")]
    public required IReadOnlyList<string> RefererOverrides { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalAppShell> Shell { get; init; }
    [JsonPropertyName("themeConfig")]
    public required BetterPortalThemeConfig ThemeConfig { get; init; }
    [JsonPropertyName("layoutId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LayoutId { get; init; }
    [JsonPropertyName("defaultRoute")]
    public required string DefaultRoute { get; init; }
    [JsonPropertyName("seo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfig> Seo { get; init; }
    [JsonPropertyName("routes")]
    public required IReadOnlyList<BetterPortalRouteMount> Routes { get; init; }
    [JsonPropertyName("menu")]
    public required IReadOnlyList<BetterPortalMenuItem> Menu { get; init; }
    [JsonPropertyName("slots")]
    public required IReadOnlyList<BetterPortalSlotAssignment> Slots { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignment>> Fragments { get; init; }
    [JsonPropertyName("shellFragments")]
    public required IReadOnlyDictionary<string, IReadOnlyDictionary<string, BetterPortalShellFragmentSetting>> ShellFragments { get; init; }
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthConfig> Auth { get; init; }
    [JsonPropertyName("statusViewIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> StatusViewIds { get; init; }
}

public sealed record BetterPortalAppInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("hostnames")]
    public required IReadOnlyList<string> Hostnames { get; init; }
    [JsonPropertyName("originOverrides")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> OriginOverrides { get; init; }
    [JsonPropertyName("refererOverrides")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> RefererOverrides { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalAppShellInput> Shell { get; init; }
    [JsonPropertyName("themeConfig")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeConfigInput> ThemeConfig { get; init; }
    [JsonPropertyName("layoutId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LayoutId { get; init; }
    [JsonPropertyName("defaultRoute")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DefaultRoute { get; init; }
    [JsonPropertyName("seo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInput> Seo { get; init; }
    [JsonPropertyName("routes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInput>> Routes { get; init; }
    [JsonPropertyName("menu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInput>> Menu { get; init; }
    [JsonPropertyName("slots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalSlotAssignmentInput>> Slots { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignmentInput>>> Fragments { get; init; }
    [JsonPropertyName("shellFragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyDictionary<string, BetterPortalShellFragmentSettingInput>>> ShellFragments { get; init; }
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthConfigInput> Auth { get; init; }
    [JsonPropertyName("statusViewIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> StatusViewIds { get; init; }
}

public sealed record BetterPortalAppShell
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
}

public sealed record BetterPortalAppShellInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
}

public sealed record BetterPortalBranding
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record BetterPortalBrandingInput
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record BetterPortalConfig
{
    [JsonPropertyName("configManagement")]
    public required BetterPortalConfigManagement ConfigManagement { get; init; }
    [JsonPropertyName("platformServices")]
    public required IReadOnlyList<PlatformService> PlatformServices { get; init; }
    [JsonPropertyName("tenants")]
    public required IReadOnlyList<BetterPortalTenant> Tenants { get; init; }
    [JsonPropertyName("apps")]
    public required IReadOnlyList<BetterPortalApp> Apps { get; init; }
    [JsonPropertyName("sharedServiceCatalog")]
    public required IReadOnlyList<SharedServiceDefinition> SharedServiceCatalog { get; init; }
    [JsonPropertyName("sharedServiceActivations")]
    public required IReadOnlyList<TenantSharedServiceActivation> SharedServiceActivations { get; init; }
    [JsonPropertyName("manifestCache")]
    public required IReadOnlyList<ServiceManifestCacheEntry> ManifestCache { get; init; }
    [JsonPropertyName("m2m")]
    public required M2MConfig M2m { get; init; }
    [JsonPropertyName("previewEnvironmentGroups")]
    public required IReadOnlyList<PreviewEnvironmentGroup> PreviewEnvironmentGroups { get; init; }
    [JsonPropertyName("previewEnvironmentDeployments")]
    public required IReadOnlyList<PreviewEnvironmentDeployment> PreviewEnvironmentDeployments { get; init; }
    [JsonPropertyName("webhooks")]
    public required BetterPortalConfigWebhooks Webhooks { get; init; }
}

public sealed record BetterPortalConfigInput
{
    [JsonPropertyName("configManagement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalConfigManagementInput> ConfigManagement { get; init; }
    [JsonPropertyName("platformServices")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<PlatformServiceInput>> PlatformServices { get; init; }
    [JsonPropertyName("tenants")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalTenantInput>> Tenants { get; init; }
    [JsonPropertyName("apps")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalAppInput>> Apps { get; init; }
    [JsonPropertyName("sharedServiceCatalog")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<SharedServiceDefinitionInput>> SharedServiceCatalog { get; init; }
    [JsonPropertyName("sharedServiceActivations")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<TenantSharedServiceActivationInput>> SharedServiceActivations { get; init; }
    [JsonPropertyName("manifestCache")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ServiceManifestCacheEntryInput>> ManifestCache { get; init; }
    [JsonPropertyName("m2m")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<M2MConfigInput> M2m { get; init; }
    [JsonPropertyName("previewEnvironmentGroups")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<PreviewEnvironmentGroupInput>> PreviewEnvironmentGroups { get; init; }
    [JsonPropertyName("previewEnvironmentDeployments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<PreviewEnvironmentDeploymentInput>> PreviewEnvironmentDeployments { get; init; }
    [JsonPropertyName("webhooks")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalConfigInputWebhooks> Webhooks { get; init; }
}

public sealed record BetterPortalConfigInputWebhooks
{
    [JsonPropertyName("targets")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<WebhookTargetInput>> Targets { get; init; }
}

public sealed record BetterPortalConfigManagement
{
    [JsonPropertyName("adminTenantId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AdminTenantId { get; init; }
    [JsonPropertyName("managementAppId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ManagementAppId { get; init; }
    [JsonPropertyName("auth")]
    public required BetterPortalConfigManagementAuth Auth { get; init; }
}

public sealed record BetterPortalConfigManagementAuth
{
    [JsonPropertyName("mechanism")]
    public required BetterPortalConfigManagementAuthMechanism Mechanism { get; init; }
    [JsonPropertyName("issuer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Issuer { get; init; }
    [JsonPropertyName("audience")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Audience { get; init; }
    [JsonPropertyName("requiredPermissions")]
    public required IReadOnlyList<string> RequiredPermissions { get; init; }
}

public sealed record BetterPortalConfigManagementAuthInput
{
    [JsonPropertyName("mechanism")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalConfigManagementAuthInputMechanism> Mechanism { get; init; }
    [JsonPropertyName("issuer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Issuer { get; init; }
    [JsonPropertyName("audience")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Audience { get; init; }
    [JsonPropertyName("requiredPermissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> RequiredPermissions { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalConfigManagementAuthInputMechanism>))]
public enum BetterPortalConfigManagementAuthInputMechanism
{
    [JsonStringEnumMemberName("none")]
    None,
    [JsonStringEnumMemberName("dev-token")]
    DevToken,
    [JsonStringEnumMemberName("jwt")]
    Jwt,
    [JsonStringEnumMemberName("oidc")]
    Oidc,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalConfigManagementAuthMechanism>))]
public enum BetterPortalConfigManagementAuthMechanism
{
    [JsonStringEnumMemberName("none")]
    None,
    [JsonStringEnumMemberName("dev-token")]
    DevToken,
    [JsonStringEnumMemberName("jwt")]
    Jwt,
    [JsonStringEnumMemberName("oidc")]
    Oidc,
}

public sealed record BetterPortalConfigManagementInput
{
    [JsonPropertyName("adminTenantId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AdminTenantId { get; init; }
    [JsonPropertyName("managementAppId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ManagementAppId { get; init; }
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalConfigManagementAuthInput> Auth { get; init; }
}

public sealed record BetterPortalConfigWebhooks
{
    [JsonPropertyName("targets")]
    public required IReadOnlyList<WebhookTarget> Targets { get; init; }
}

public sealed record BetterPortalFragmentAssignment
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record BetterPortalFragmentAssignmentInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalLogLevel>))]
public enum BetterPortalLogLevel
{
    [JsonStringEnumMemberName("debug")]
    Debug,
    [JsonStringEnumMemberName("info")]
    Info,
    [JsonStringEnumMemberName("warn")]
    Warn,
    [JsonStringEnumMemberName("error")]
    Error,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalLogLevelInput>))]
public enum BetterPortalLogLevelInput
{
    [JsonStringEnumMemberName("debug")]
    Debug,
    [JsonStringEnumMemberName("info")]
    Info,
    [JsonStringEnumMemberName("warn")]
    Warn,
    [JsonStringEnumMemberName("error")]
    Error,
}

public sealed record BetterPortalMenuItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItem> Children { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemAuthStatus>))]
public enum BetterPortalMenuItemAuthStatus
{
    [JsonStringEnumMemberName("show")]
    Show,
    [JsonStringEnumMemberName("hide-unauthenticated")]
    HideUnauthenticated,
    [JsonStringEnumMemberName("hide-unauthorized")]
    HideUnauthorized,
}

public sealed record BetterPortalMenuItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<Never> Children { get; init; }
}

public sealed record BetterPortalMenuItemInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItem>> Children { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemInputAuthStatus>))]
public enum BetterPortalMenuItemInputAuthStatus
{
    [JsonStringEnumMemberName("show")]
    Show,
    [JsonStringEnumMemberName("hide-unauthenticated")]
    HideUnauthenticated,
    [JsonStringEnumMemberName("hide-unauthorized")]
    HideUnauthorized,
}

public sealed record BetterPortalMenuItemInputChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<Never>> Children { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemInputServiceStatus>))]
public enum BetterPortalMenuItemInputServiceStatus
{
    [JsonStringEnumMemberName("show")]
    Show,
    [JsonStringEnumMemberName("hide")]
    Hide,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemInputType>))]
public enum BetterPortalMenuItemInputType
{
    [JsonStringEnumMemberName("link")]
    Link,
    [JsonStringEnumMemberName("group")]
    Group,
    [JsonStringEnumMemberName("section")]
    Section,
    [JsonStringEnumMemberName("divider")]
    Divider,
    [JsonStringEnumMemberName("external")]
    External,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemServiceStatus>))]
public enum BetterPortalMenuItemServiceStatus
{
    [JsonStringEnumMemberName("show")]
    Show,
    [JsonStringEnumMemberName("hide")]
    Hide,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalMenuItemType>))]
public enum BetterPortalMenuItemType
{
    [JsonStringEnumMemberName("link")]
    Link,
    [JsonStringEnumMemberName("group")]
    Group,
    [JsonStringEnumMemberName("section")]
    Section,
    [JsonStringEnumMemberName("divider")]
    Divider,
    [JsonStringEnumMemberName("external")]
    External,
}

public sealed record BetterPortalOriginPolicy
{
    [JsonPropertyName("allowedOrigins")]
    public required IReadOnlyList<string> AllowedOrigins { get; init; }
    [JsonPropertyName("allowedReferers")]
    public required IReadOnlyList<string> AllowedReferers { get; init; }
}

public sealed record BetterPortalOriginPolicyInput
{
    [JsonPropertyName("allowedOrigins")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> AllowedOrigins { get; init; }
    [JsonPropertyName("allowedReferers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> AllowedReferers { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalResource(BetterPortalResourceFields Value) : IWireValue<BetterPortalResource, BetterPortalResourceFields>
{
    public static BetterPortalResource FromValue(BetterPortalResourceFields value) => new(value);
    public static implicit operator BetterPortalResource(BetterPortalResourceFields value) => new(value);
    public static implicit operator BetterPortalResourceFields(BetterPortalResource value) => value.Value;
}

public sealed record BetterPortalResourceFields
{
    [JsonPropertyName("serviceName")]
    public required string ServiceName { get; init; }
    [JsonPropertyName("serviceVersion")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceVersion { get; init; }
    [JsonPropertyName("serviceInstanceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceInstanceId { get; init; }
    [JsonPropertyName("environment")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Environment { get; init; }
    [JsonPropertyName("region")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Region { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalResourceInput(BetterPortalResourceInputFields Value) : IWireValue<BetterPortalResourceInput, BetterPortalResourceInputFields>
{
    public static BetterPortalResourceInput FromValue(BetterPortalResourceInputFields value) => new(value);
    public static implicit operator BetterPortalResourceInput(BetterPortalResourceInputFields value) => new(value);
    public static implicit operator BetterPortalResourceInputFields(BetterPortalResourceInput value) => value.Value;
}

public sealed record BetterPortalResourceInputFields
{
    [JsonPropertyName("serviceName")]
    public required string ServiceName { get; init; }
    [JsonPropertyName("serviceVersion")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceVersion { get; init; }
    [JsonPropertyName("serviceInstanceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceInstanceId { get; init; }
    [JsonPropertyName("environment")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Environment { get; init; }
    [JsonPropertyName("region")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Region { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalRouteChrome(BetterPortalRouteChromeFields Value) : IWireValue<BetterPortalRouteChrome, BetterPortalRouteChromeFields>
{
    public static BetterPortalRouteChrome FromValue(BetterPortalRouteChromeFields value) => new(value);
    public static implicit operator BetterPortalRouteChrome(BetterPortalRouteChromeFields value) => new(value);
    public static implicit operator BetterPortalRouteChromeFields(BetterPortalRouteChrome value) => value.Value;
}

public sealed record BetterPortalRouteChromeFields
{
    [JsonPropertyName("hideMenu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideMenu { get; init; }
    [JsonPropertyName("hideHeader")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideHeader { get; init; }
    [JsonPropertyName("hideFooter")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideFooter { get; init; }
    [JsonPropertyName("fullScreen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> FullScreen { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalRouteChromeInput(BetterPortalRouteChromeInputFields Value) : IWireValue<BetterPortalRouteChromeInput, BetterPortalRouteChromeInputFields>
{
    public static BetterPortalRouteChromeInput FromValue(BetterPortalRouteChromeInputFields value) => new(value);
    public static implicit operator BetterPortalRouteChromeInput(BetterPortalRouteChromeInputFields value) => new(value);
    public static implicit operator BetterPortalRouteChromeInputFields(BetterPortalRouteChromeInput value) => value.Value;
}

public sealed record BetterPortalRouteChromeInputFields
{
    [JsonPropertyName("hideMenu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideMenu { get; init; }
    [JsonPropertyName("hideHeader")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideHeader { get; init; }
    [JsonPropertyName("hideFooter")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideFooter { get; init; }
    [JsonPropertyName("fullScreen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> FullScreen { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalRouteChromeValue(Variant<string, Variant<double, bool>> Value) : IWireValue<BetterPortalRouteChromeValue, Variant<string, Variant<double, bool>>>
{
    public static BetterPortalRouteChromeValue FromValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator BetterPortalRouteChromeValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator Variant<string, Variant<double, bool>>(BetterPortalRouteChromeValue value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalRouteChromeValueInput(Variant<string, Variant<double, bool>> Value) : IWireValue<BetterPortalRouteChromeValueInput, Variant<string, Variant<double, bool>>>
{
    public static BetterPortalRouteChromeValueInput FromValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator BetterPortalRouteChromeValueInput(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator Variant<string, Variant<double, bool>>(BetterPortalRouteChromeValueInput value) => value.Value;
}

public sealed record BetterPortalRouteMount
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountKind Kind { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("servicePathVariant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServicePathVariant { get; init; }
    [JsonPropertyName("fixedParams")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> FixedParams { get; init; }
    [JsonPropertyName("authRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountRobotsItem>> Robots { get; init; }
    [JsonPropertyName("targetPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TargetPath { get; init; }
    [JsonPropertyName("resolvedServicePath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ResolvedServicePath { get; init; }
    [JsonPropertyName("resolvedMethods")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<HttpMethod>> ResolvedMethods { get; init; }
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Query { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("enablement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountEnablement> Enablement { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<string> Operations { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChrome> Chrome { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountEnablement>))]
public enum BetterPortalRouteMountEnablement
{
    [JsonStringEnumMemberName("auto")]
    Auto,
    [JsonStringEnumMemberName("enabled")]
    Enabled,
    [JsonStringEnumMemberName("disabled")]
    Disabled,
}

public sealed record BetterPortalRouteMountInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputKind> Kind { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("servicePathVariant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServicePathVariant { get; init; }
    [JsonPropertyName("fixedParams")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> FixedParams { get; init; }
    [JsonPropertyName("authRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInputRobotsItem>> Robots { get; init; }
    [JsonPropertyName("targetPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TargetPath { get; init; }
    [JsonPropertyName("resolvedServicePath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ResolvedServicePath { get; init; }
    [JsonPropertyName("resolvedMethods")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<HttpMethodInput>> ResolvedMethods { get; init; }
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Query { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("enablement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputEnablement> Enablement { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<string> Operations { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChromeInput> Chrome { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountInputEnablement>))]
public enum BetterPortalRouteMountInputEnablement
{
    [JsonStringEnumMemberName("auto")]
    Auto,
    [JsonStringEnumMemberName("enabled")]
    Enabled,
    [JsonStringEnumMemberName("disabled")]
    Disabled,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountInputKind>))]
public enum BetterPortalRouteMountInputKind
{
    [JsonStringEnumMemberName("page")]
    Page,
    [JsonStringEnumMemberName("api")]
    Api,
}

public sealed record BetterPortalRouteMountInputRobotsItem
{
    [JsonPropertyName("userAgent")]
    public required string UserAgent { get; init; }
    [JsonPropertyName("access")]
    public required BetterPortalRouteMountInputRobotsItemAccess Access { get; init; }
    [JsonPropertyName("crawlDelaySeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> CrawlDelaySeconds { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountInputRobotsItemAccess>))]
public enum BetterPortalRouteMountInputRobotsItemAccess
{
    [JsonStringEnumMemberName("allow")]
    Allow,
    [JsonStringEnumMemberName("disallow")]
    Disallow,
}

public sealed record BetterPortalRouteMountInputSitemap
{
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountInputSitemapKind Kind { get; init; }
    [JsonPropertyName("lastModified")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastModified { get; init; }
    [JsonPropertyName("changeFrequency")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemapChangeFrequency> ChangeFrequency { get; init; }
    [JsonPropertyName("priority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Priority { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountInputSitemapChangeFrequency>))]
public enum BetterPortalRouteMountInputSitemapChangeFrequency
{
    [JsonStringEnumMemberName("always")]
    Always,
    [JsonStringEnumMemberName("hourly")]
    Hourly,
    [JsonStringEnumMemberName("daily")]
    Daily,
    [JsonStringEnumMemberName("weekly")]
    Weekly,
    [JsonStringEnumMemberName("monthly")]
    Monthly,
    [JsonStringEnumMemberName("yearly")]
    Yearly,
    [JsonStringEnumMemberName("never")]
    Never,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountInputSitemapKind>))]
public enum BetterPortalRouteMountInputSitemapKind
{
    [JsonStringEnumMemberName("default")]
    Default,
    [JsonStringEnumMemberName("exclude")]
    Exclude,
    [JsonStringEnumMemberName("metadata")]
    Metadata,
    [JsonStringEnumMemberName("provider")]
    Provider,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountKind>))]
public enum BetterPortalRouteMountKind
{
    [JsonStringEnumMemberName("page")]
    Page,
    [JsonStringEnumMemberName("api")]
    Api,
}

public sealed record BetterPortalRouteMountRobotsItem
{
    [JsonPropertyName("userAgent")]
    public required string UserAgent { get; init; }
    [JsonPropertyName("access")]
    public required BetterPortalRouteMountRobotsItemAccess Access { get; init; }
    [JsonPropertyName("crawlDelaySeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> CrawlDelaySeconds { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountRobotsItemAccess>))]
public enum BetterPortalRouteMountRobotsItemAccess
{
    [JsonStringEnumMemberName("allow")]
    Allow,
    [JsonStringEnumMemberName("disallow")]
    Disallow,
}

public sealed record BetterPortalRouteMountSitemap
{
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountSitemapKind Kind { get; init; }
    [JsonPropertyName("lastModified")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastModified { get; init; }
    [JsonPropertyName("changeFrequency")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemapChangeFrequency> ChangeFrequency { get; init; }
    [JsonPropertyName("priority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Priority { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountSitemapChangeFrequency>))]
public enum BetterPortalRouteMountSitemapChangeFrequency
{
    [JsonStringEnumMemberName("always")]
    Always,
    [JsonStringEnumMemberName("hourly")]
    Hourly,
    [JsonStringEnumMemberName("daily")]
    Daily,
    [JsonStringEnumMemberName("weekly")]
    Weekly,
    [JsonStringEnumMemberName("monthly")]
    Monthly,
    [JsonStringEnumMemberName("yearly")]
    Yearly,
    [JsonStringEnumMemberName("never")]
    Never,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalRouteMountSitemapKind>))]
public enum BetterPortalRouteMountSitemapKind
{
    [JsonStringEnumMemberName("default")]
    Default,
    [JsonStringEnumMemberName("exclude")]
    Exclude,
    [JsonStringEnumMemberName("metadata")]
    Metadata,
    [JsonStringEnumMemberName("provider")]
    Provider,
}

public sealed record BetterPortalSeoConfig
{
    [JsonPropertyName("visibility")]
    public required BetterPortalSeoConfigVisibility Visibility { get; init; }
    [JsonPropertyName("serviceFailure")]
    public required BetterPortalSeoConfigServiceFailure ServiceFailure { get; init; }
    [JsonPropertyName("serviceCache")]
    public required BetterPortalSeoConfigServiceCache ServiceCache { get; init; }
    [JsonPropertyName("canonicalOrigin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CanonicalOrigin { get; init; }
}

public sealed record BetterPortalSeoConfigInput
{
    [JsonPropertyName("visibility")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputVisibility> Visibility { get; init; }
    [JsonPropertyName("serviceFailure")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputServiceFailure> ServiceFailure { get; init; }
    [JsonPropertyName("serviceCache")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputServiceCache> ServiceCache { get; init; }
    [JsonPropertyName("canonicalOrigin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CanonicalOrigin { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigInputServiceCache>))]
public enum BetterPortalSeoConfigInputServiceCache
{
    [JsonStringEnumMemberName("none")]
    None,
    [JsonStringEnumMemberName("1h")]
    T1h,
    [JsonStringEnumMemberName("24h")]
    T24h,
    [JsonStringEnumMemberName("7d")]
    T7d,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigInputServiceFailure>))]
public enum BetterPortalSeoConfigInputServiceFailure
{
    [JsonStringEnumMemberName("known-routes")]
    KnownRoutes,
    [JsonStringEnumMemberName("omit-service")]
    OmitService,
    [JsonStringEnumMemberName("error")]
    Error,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigInputVisibility>))]
public enum BetterPortalSeoConfigInputVisibility
{
    [JsonStringEnumMemberName("auto")]
    Auto,
    [JsonStringEnumMemberName("public")]
    Public,
    [JsonStringEnumMemberName("private")]
    Private,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigServiceCache>))]
public enum BetterPortalSeoConfigServiceCache
{
    [JsonStringEnumMemberName("none")]
    None,
    [JsonStringEnumMemberName("1h")]
    T1h,
    [JsonStringEnumMemberName("24h")]
    T24h,
    [JsonStringEnumMemberName("7d")]
    T7d,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigServiceFailure>))]
public enum BetterPortalSeoConfigServiceFailure
{
    [JsonStringEnumMemberName("known-routes")]
    KnownRoutes,
    [JsonStringEnumMemberName("omit-service")]
    OmitService,
    [JsonStringEnumMemberName("error")]
    Error,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalSeoConfigVisibility>))]
public enum BetterPortalSeoConfigVisibility
{
    [JsonStringEnumMemberName("auto")]
    Auto,
    [JsonStringEnumMemberName("public")]
    Public,
    [JsonStringEnumMemberName("private")]
    Private,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalShellFragmentItem(Variant<BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2> Value) : IWireValue<BetterPortalShellFragmentItem, Variant<BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2>>
{
    public static BetterPortalShellFragmentItem FromValue(Variant<BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2> value) => new(value);
    public static implicit operator BetterPortalShellFragmentItem(Variant<BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2> value) => new(value);
    public static implicit operator Variant<BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2>(BetterPortalShellFragmentItem value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalShellFragmentItemInput(Variant<BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2> Value) : IWireValue<BetterPortalShellFragmentItemInput, Variant<BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2>>
{
    public static BetterPortalShellFragmentItemInput FromValue(Variant<BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2> value) => new(value);
    public static implicit operator BetterPortalShellFragmentItemInput(Variant<BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2> value) => new(value);
    public static implicit operator Variant<BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2>(BetterPortalShellFragmentItemInput value) => value.Value;
}

public sealed record BetterPortalShellFragmentItemInputVariant1
{
    [JsonPropertyName("source")]
    public required BetterPortalShellFragmentItemInputVariant1Source Source { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentItemInputVariant1Source>))]
public enum BetterPortalShellFragmentItemInputVariant1Source
{
    [JsonStringEnumMemberName("shell")]
    Shell,
}

public sealed record BetterPortalShellFragmentItemInputVariant2
{
    [JsonPropertyName("source")]
    public required BetterPortalShellFragmentItemInputVariant2Source Source { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentItemInputVariant2Source>))]
public enum BetterPortalShellFragmentItemInputVariant2Source
{
    [JsonStringEnumMemberName("service")]
    Service,
}

public sealed record BetterPortalShellFragmentItemVariant1
{
    [JsonPropertyName("source")]
    public required BetterPortalShellFragmentItemVariant1Source Source { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentItemVariant1Source>))]
public enum BetterPortalShellFragmentItemVariant1Source
{
    [JsonStringEnumMemberName("shell")]
    Shell,
}

public sealed record BetterPortalShellFragmentItemVariant2
{
    [JsonPropertyName("source")]
    public required BetterPortalShellFragmentItemVariant2Source Source { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentItemVariant2Source>))]
public enum BetterPortalShellFragmentItemVariant2Source
{
    [JsonStringEnumMemberName("service")]
    Service,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalShellFragmentSetting(Variant<BetterPortalShellFragmentSettingVariant1, Variant<BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3>> Value) : IWireValue<BetterPortalShellFragmentSetting, Variant<BetterPortalShellFragmentSettingVariant1, Variant<BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3>>>
{
    public static BetterPortalShellFragmentSetting FromValue(Variant<BetterPortalShellFragmentSettingVariant1, Variant<BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3>> value) => new(value);
    public static implicit operator BetterPortalShellFragmentSetting(Variant<BetterPortalShellFragmentSettingVariant1, Variant<BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3>> value) => new(value);
    public static implicit operator Variant<BetterPortalShellFragmentSettingVariant1, Variant<BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3>>(BetterPortalShellFragmentSetting value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct BetterPortalShellFragmentSettingInput(Variant<BetterPortalShellFragmentSettingInputVariant1, Variant<BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3>> Value) : IWireValue<BetterPortalShellFragmentSettingInput, Variant<BetterPortalShellFragmentSettingInputVariant1, Variant<BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3>>>
{
    public static BetterPortalShellFragmentSettingInput FromValue(Variant<BetterPortalShellFragmentSettingInputVariant1, Variant<BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3>> value) => new(value);
    public static implicit operator BetterPortalShellFragmentSettingInput(Variant<BetterPortalShellFragmentSettingInputVariant1, Variant<BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3>> value) => new(value);
    public static implicit operator Variant<BetterPortalShellFragmentSettingInputVariant1, Variant<BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3>>(BetterPortalShellFragmentSettingInput value) => value.Value;
}

public sealed record BetterPortalShellFragmentSettingInputVariant1
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingInputVariant1Mode Mode { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingInputVariant1Mode>))]
public enum BetterPortalShellFragmentSettingInputVariant1Mode
{
    [JsonStringEnumMemberName("none")]
    None,
}

public sealed record BetterPortalShellFragmentSettingInputVariant2
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingInputVariant2Mode Mode { get; init; }
    [JsonPropertyName("item")]
    public required BetterPortalShellFragmentItemInput Item { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingInputVariant2Mode>))]
public enum BetterPortalShellFragmentSettingInputVariant2Mode
{
    [JsonStringEnumMemberName("override")]
    Override,
}

public sealed record BetterPortalShellFragmentSettingInputVariant3
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingInputVariant3Mode Mode { get; init; }
    [JsonPropertyName("items")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalShellFragmentItemInput>> Items { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingInputVariant3Mode>))]
public enum BetterPortalShellFragmentSettingInputVariant3Mode
{
    [JsonStringEnumMemberName("items")]
    Items,
}

public sealed record BetterPortalShellFragmentSettingVariant1
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingVariant1Mode Mode { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingVariant1Mode>))]
public enum BetterPortalShellFragmentSettingVariant1Mode
{
    [JsonStringEnumMemberName("none")]
    None,
}

public sealed record BetterPortalShellFragmentSettingVariant2
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingVariant2Mode Mode { get; init; }
    [JsonPropertyName("item")]
    public required BetterPortalShellFragmentItem Item { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingVariant2Mode>))]
public enum BetterPortalShellFragmentSettingVariant2Mode
{
    [JsonStringEnumMemberName("override")]
    Override,
}

public sealed record BetterPortalShellFragmentSettingVariant3
{
    [JsonPropertyName("mode")]
    public required BetterPortalShellFragmentSettingVariant3Mode Mode { get; init; }
    [JsonPropertyName("items")]
    public required IReadOnlyList<BetterPortalShellFragmentItem> Items { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalShellFragmentSettingVariant3Mode>))]
public enum BetterPortalShellFragmentSettingVariant3Mode
{
    [JsonStringEnumMemberName("items")]
    Items,
}

public sealed record BetterPortalSlotAssignment
{
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("renderer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Renderer { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record BetterPortalSlotAssignmentInput
{
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("renderer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Renderer { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record BetterPortalTenant
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("active")]
    public required bool Active { get; init; }
    [JsonPropertyName("branding")]
    public required BetterPortalBranding Branding { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<TenantServiceRegistration> Services { get; init; }
    [JsonPropertyName("activatedPlatformServices")]
    public required IReadOnlyList<string> ActivatedPlatformServices { get; init; }
}

public sealed record BetterPortalTenantInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("active")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Active { get; init; }
    [JsonPropertyName("branding")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalBrandingInput> Branding { get; init; }
    [JsonPropertyName("services")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<TenantServiceRegistrationInput>> Services { get; init; }
    [JsonPropertyName("activatedPlatformServices")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> ActivatedPlatformServices { get; init; }
}

public sealed record BetterPortalThemeBootstrapPalette
{
    [JsonPropertyName("primary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Primary { get; init; }
    [JsonPropertyName("secondary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Secondary { get; init; }
    [JsonPropertyName("success")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Success { get; init; }
    [JsonPropertyName("info")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Info { get; init; }
    [JsonPropertyName("warning")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Warning { get; init; }
    [JsonPropertyName("danger")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Danger { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Dark { get; init; }
}

public sealed record BetterPortalThemeBootstrapPaletteInput
{
    [JsonPropertyName("primary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Primary { get; init; }
    [JsonPropertyName("secondary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Secondary { get; init; }
    [JsonPropertyName("success")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Success { get; init; }
    [JsonPropertyName("info")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Info { get; init; }
    [JsonPropertyName("warning")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Warning { get; init; }
    [JsonPropertyName("danger")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Danger { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Dark { get; init; }
}

public sealed record BetterPortalThemeConfig
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("documentTitle")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DocumentTitle { get; init; }
    [JsonPropertyName("lightLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LightLogoUrl { get; init; }
    [JsonPropertyName("darkLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DarkLogoUrl { get; init; }
    [JsonPropertyName("faviconUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> FaviconUrl { get; init; }
    [JsonPropertyName("mode")]
    public required BetterPortalThemeConfigMode Mode { get; init; }
    [JsonPropertyName("bootstrap")]
    public required BetterPortalThemeBootstrapPalette Bootstrap { get; init; }
    [JsonPropertyName("light")]
    public required BetterPortalThemeSurface Light { get; init; }
    [JsonPropertyName("dark")]
    public required BetterPortalThemeSurface Dark { get; init; }
}

public sealed record BetterPortalThemeConfigInput
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("documentTitle")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DocumentTitle { get; init; }
    [JsonPropertyName("lightLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LightLogoUrl { get; init; }
    [JsonPropertyName("darkLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DarkLogoUrl { get; init; }
    [JsonPropertyName("faviconUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> FaviconUrl { get; init; }
    [JsonPropertyName("mode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeConfigInputMode> Mode { get; init; }
    [JsonPropertyName("bootstrap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeBootstrapPaletteInput> Bootstrap { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeSurfaceInput> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeSurfaceInput> Dark { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalThemeConfigInputMode>))]
public enum BetterPortalThemeConfigInputMode
{
    [JsonStringEnumMemberName("light")]
    Light,
    [JsonStringEnumMemberName("dark")]
    Dark,
    [JsonStringEnumMemberName("system")]
    System,
}

[JsonConverter(typeof(JsonStringEnumConverter<BetterPortalThemeConfigMode>))]
public enum BetterPortalThemeConfigMode
{
    [JsonStringEnumMemberName("light")]
    Light,
    [JsonStringEnumMemberName("dark")]
    Dark,
    [JsonStringEnumMemberName("system")]
    System,
}

public sealed record BetterPortalThemeSurface
{
    [JsonPropertyName("background")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Background { get; init; }
    [JsonPropertyName("surface")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Surface { get; init; }
    [JsonPropertyName("surfaceAlt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SurfaceAlt { get; init; }
    [JsonPropertyName("text")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Text { get; init; }
    [JsonPropertyName("textSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TextSoft { get; init; }
    [JsonPropertyName("border")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Border { get; init; }
    [JsonPropertyName("accentSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AccentSoft { get; init; }
}

public sealed record BetterPortalThemeSurfaceInput
{
    [JsonPropertyName("background")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Background { get; init; }
    [JsonPropertyName("surface")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Surface { get; init; }
    [JsonPropertyName("surfaceAlt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SurfaceAlt { get; init; }
    [JsonPropertyName("text")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Text { get; init; }
    [JsonPropertyName("textSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TextSoft { get; init; }
    [JsonPropertyName("border")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Border { get; init; }
    [JsonPropertyName("accentSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AccentSoft { get; init; }
}

public sealed record BetterPortalTraceContext
{
    [JsonPropertyName("traceId")]
    public required string TraceId { get; init; }
    [JsonPropertyName("spanId")]
    public required string SpanId { get; init; }
}

public sealed record BetterPortalTraceContextInput
{
    [JsonPropertyName("traceId")]
    public required string TraceId { get; init; }
    [JsonPropertyName("spanId")]
    public required string SpanId { get; init; }
}

public sealed record BindingRecord
{
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appIds")]
    public required IReadOnlyList<string> AppIds { get; init; }
    [JsonPropertyName("endpointBaseUrl")]
    public required string EndpointBaseUrl { get; init; }
    [JsonPropertyName("deploymentMode")]
    public required DeploymentMode DeploymentMode { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("importedManifestVersion")]
    public required string ImportedManifestVersion { get; init; }
    [JsonPropertyName("lastSyncAtIso")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAtIso { get; init; }
    [JsonPropertyName("trust")]
    public required BindingTrust Trust { get; init; }
}

public sealed record BindingRecordInput
{
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> AppIds { get; init; }
    [JsonPropertyName("endpointBaseUrl")]
    public required string EndpointBaseUrl { get; init; }
    [JsonPropertyName("deploymentMode")]
    public required DeploymentModeInput DeploymentMode { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("importedManifestVersion")]
    public required string ImportedManifestVersion { get; init; }
    [JsonPropertyName("lastSyncAtIso")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAtIso { get; init; }
    [JsonPropertyName("trust")]
    public required BindingTrustInput Trust { get; init; }
}

public sealed record BindingTrust
{
    [JsonPropertyName("credentialId")]
    public required string CredentialId { get; init; }
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("scopes")]
    public required IReadOnlyList<string> Scopes { get; init; }
    [JsonPropertyName("rotationVersion")]
    public required string RotationVersion { get; init; }
}

public sealed record BindingTrustInput
{
    [JsonPropertyName("credentialId")]
    public required string CredentialId { get; init; }
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("scopes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Scopes { get; init; }
    [JsonPropertyName("rotationVersion")]
    public required string RotationVersion { get; init; }
}

public sealed record BpSchemaOutput
{
    [JsonPropertyName("manifest")]
    public required PluginManifest Manifest { get; init; }
    [JsonPropertyName("routes")]
    public required IReadOnlyList<BpSchemaRoute> Routes { get; init; }
}

public sealed record BpSchemaOutputInput
{
    [JsonPropertyName("manifest")]
    public required PluginManifestInput Manifest { get; init; }
    [JsonPropertyName("routes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BpSchemaRouteInput>> Routes { get; init; }
}

public sealed record BpSchemaRoute
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    public required IReadOnlyList<string> PathVariants { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<BpSchemaRouteOperationsItem> Operations { get; init; }
    [JsonPropertyName("paramNames")]
    public required IReadOnlyList<string> ParamNames { get; init; }
    [JsonPropertyName("renderers")]
    public required IReadOnlyList<string> Renderers { get; init; }
    [JsonPropertyName("hasFragments")]
    public required bool HasFragments { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyList<BpSchemaRouteFragmentsItem> Fragments { get; init; }
    [JsonPropertyName("components")]
    public required IReadOnlyList<string> Components { get; init; }
}

public sealed record BpSchemaRouteFragmentsItem
{
    [JsonPropertyName("fragmentLocation")]
    public required string FragmentLocation { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
    [JsonPropertyName("renderers")]
    public required IReadOnlyList<string> Renderers { get; init; }
}

public sealed record BpSchemaRouteInput
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> PathVariants { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<BpSchemaRouteInputOperationsItem> Operations { get; init; }
    [JsonPropertyName("paramNames")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> ParamNames { get; init; }
    [JsonPropertyName("renderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Renderers { get; init; }
    [JsonPropertyName("hasFragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HasFragments { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BpSchemaRouteInputFragmentsItem>> Fragments { get; init; }
    [JsonPropertyName("components")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Components { get; init; }
}

public sealed record BpSchemaRouteInputFragmentsItem
{
    [JsonPropertyName("fragmentLocation")]
    public required string FragmentLocation { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
    [JsonPropertyName("renderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Renderers { get; init; }
}

public sealed record BpSchemaRouteInputOperationsItem
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
}

public sealed record BpSchemaRouteOperationsItem
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
}

public sealed record CacheHints
{
    [JsonPropertyName("ttlSeconds")]
    public required long TtlSeconds { get; init; }
    [JsonPropertyName("varyBy")]
    public required IReadOnlyList<string> VaryBy { get; init; }
}

public sealed record CacheHintsInput
{
    [JsonPropertyName("ttlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> TtlSeconds { get; init; }
    [JsonPropertyName("varyBy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> VaryBy { get; init; }
}

public sealed record ConfigFieldDescriptor
{
    [JsonPropertyName("key")]
    public required string Key { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("scope")]
    public required ConfigScope Scope { get; init; }
    [JsonPropertyName("visibility")]
    public required ConfigVisibility Visibility { get; init; }
    [JsonPropertyName("ownership")]
    public required ConfigOwnership Ownership { get; init; }
    [JsonPropertyName("sourceOfTruth")]
    public required ConfigFieldDescriptorSourceOfTruth SourceOfTruth { get; init; }
    [JsonPropertyName("groupId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> GroupId { get; init; }
    [JsonPropertyName("order")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Order { get; init; }
    [JsonPropertyName("defaultValue")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<System.Text.Json.Nodes.JsonNode?> DefaultValue { get; init; }
    [JsonPropertyName("ui")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptor> Ui { get; init; }
    [JsonPropertyName("required")]
    public required bool Required { get; init; }
}

public sealed record ConfigFieldDescriptorInput
{
    [JsonPropertyName("key")]
    public required string Key { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("scope")]
    public required ConfigScopeInput Scope { get; init; }
    [JsonPropertyName("visibility")]
    public required ConfigVisibilityInput Visibility { get; init; }
    [JsonPropertyName("ownership")]
    public required ConfigOwnershipInput Ownership { get; init; }
    [JsonPropertyName("sourceOfTruth")]
    public required ConfigFieldDescriptorInputSourceOfTruth SourceOfTruth { get; init; }
    [JsonPropertyName("groupId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> GroupId { get; init; }
    [JsonPropertyName("order")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Order { get; init; }
    [JsonPropertyName("defaultValue")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<System.Text.Json.Nodes.JsonNode?> DefaultValue { get; init; }
    [JsonPropertyName("ui")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptorInput> Ui { get; init; }
    [JsonPropertyName("required")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Required { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldDescriptorInputSourceOfTruth>))]
public enum ConfigFieldDescriptorInputSourceOfTruth
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("plugin")]
    Plugin,
    [JsonStringEnumMemberName("external")]
    External,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldDescriptorSourceOfTruth>))]
public enum ConfigFieldDescriptorSourceOfTruth
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("plugin")]
    Plugin,
    [JsonStringEnumMemberName("external")]
    External,
}

public sealed record ConfigFieldGroupDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("order")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Order { get; init; }
    [JsonPropertyName("optional")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Optional { get; init; }
}

public sealed record ConfigFieldGroupDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("order")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Order { get; init; }
    [JsonPropertyName("optional")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Optional { get; init; }
}

public sealed record ConfigFieldUiDescriptor
{
    [JsonPropertyName("control")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptorControl> Control { get; init; }
    [JsonPropertyName("placeholder")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Placeholder { get; init; }
    [JsonPropertyName("options")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigFieldUiDescriptorOptionsItem>> Options { get; init; }
    [JsonPropertyName("optionsSource")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptorOptionsSource> OptionsSource { get; init; }
    [JsonPropertyName("min")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<double, string>> Min { get; init; }
    [JsonPropertyName("max")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<double, string>> Max { get; init; }
    [JsonPropertyName("step")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Step { get; init; }
    [JsonPropertyName("rows")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Rows { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldUiDescriptorControl>))]
public enum ConfigFieldUiDescriptorControl
{
    [JsonStringEnumMemberName("text")]
    Text,
    [JsonStringEnumMemberName("textarea")]
    Textarea,
    [JsonStringEnumMemberName("password")]
    Password,
    [JsonStringEnumMemberName("number")]
    Number,
    [JsonStringEnumMemberName("checkbox")]
    Checkbox,
    [JsonStringEnumMemberName("select")]
    Select,
    [JsonStringEnumMemberName("multiselect")]
    Multiselect,
    [JsonStringEnumMemberName("color")]
    Color,
    [JsonStringEnumMemberName("date")]
    Date,
    [JsonStringEnumMemberName("time")]
    Time,
    [JsonStringEnumMemberName("datetime-local")]
    DatetimeLocal,
    [JsonStringEnumMemberName("url")]
    Url,
    [JsonStringEnumMemberName("email")]
    Email,
}

public sealed record ConfigFieldUiDescriptorInput
{
    [JsonPropertyName("control")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptorInputControl> Control { get; init; }
    [JsonPropertyName("placeholder")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Placeholder { get; init; }
    [JsonPropertyName("options")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigFieldUiDescriptorInputOptionsItem>> Options { get; init; }
    [JsonPropertyName("optionsSource")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ConfigFieldUiDescriptorInputOptionsSource> OptionsSource { get; init; }
    [JsonPropertyName("min")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<double, string>> Min { get; init; }
    [JsonPropertyName("max")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<double, string>> Max { get; init; }
    [JsonPropertyName("step")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Step { get; init; }
    [JsonPropertyName("rows")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Rows { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldUiDescriptorInputControl>))]
public enum ConfigFieldUiDescriptorInputControl
{
    [JsonStringEnumMemberName("text")]
    Text,
    [JsonStringEnumMemberName("textarea")]
    Textarea,
    [JsonStringEnumMemberName("password")]
    Password,
    [JsonStringEnumMemberName("number")]
    Number,
    [JsonStringEnumMemberName("checkbox")]
    Checkbox,
    [JsonStringEnumMemberName("select")]
    Select,
    [JsonStringEnumMemberName("multiselect")]
    Multiselect,
    [JsonStringEnumMemberName("color")]
    Color,
    [JsonStringEnumMemberName("date")]
    Date,
    [JsonStringEnumMemberName("time")]
    Time,
    [JsonStringEnumMemberName("datetime-local")]
    DatetimeLocal,
    [JsonStringEnumMemberName("url")]
    Url,
    [JsonStringEnumMemberName("email")]
    Email,
}

public sealed record ConfigFieldUiDescriptorInputOptionsItem
{
    [JsonPropertyName("value")]
    public required string Value { get; init; }
    [JsonPropertyName("label")]
    public required string Label { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldUiDescriptorInputOptionsSource>))]
public enum ConfigFieldUiDescriptorInputOptionsSource
{
    [JsonStringEnumMemberName("app.routes")]
    AppRoutes,
}

public sealed record ConfigFieldUiDescriptorOptionsItem
{
    [JsonPropertyName("value")]
    public required string Value { get; init; }
    [JsonPropertyName("label")]
    public required string Label { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigFieldUiDescriptorOptionsSource>))]
public enum ConfigFieldUiDescriptorOptionsSource
{
    [JsonStringEnumMemberName("app.routes")]
    AppRoutes,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigOwnership>))]
public enum ConfigOwnership
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("plugin")]
    Plugin,
    [JsonStringEnumMemberName("mixed")]
    Mixed,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigOwnershipInput>))]
public enum ConfigOwnershipInput
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("plugin")]
    Plugin,
    [JsonStringEnumMemberName("mixed")]
    Mixed,
}

public sealed record ConfigSchemaDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("scope")]
    public required ConfigScope Scope { get; init; }
    [JsonPropertyName("jsonSchema")]
    public required JsonObject JsonSchema { get; init; }
    [JsonPropertyName("groups")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigFieldGroupDescriptor>> Groups { get; init; }
    [JsonPropertyName("fields")]
    public required IReadOnlyList<ConfigFieldDescriptor> Fields { get; init; }
}

public sealed record ConfigSchemaDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("scope")]
    public required ConfigScopeInput Scope { get; init; }
    [JsonPropertyName("jsonSchema")]
    public required JsonObjectInput JsonSchema { get; init; }
    [JsonPropertyName("groups")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigFieldGroupDescriptorInput>> Groups { get; init; }
    [JsonPropertyName("fields")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigFieldDescriptorInput>> Fields { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigScope>))]
public enum ConfigScope
{
    [JsonStringEnumMemberName("tenant")]
    Tenant,
    [JsonStringEnumMemberName("app")]
    App,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigScopeInput>))]
public enum ConfigScopeInput
{
    [JsonStringEnumMemberName("tenant")]
    Tenant,
    [JsonStringEnumMemberName("app")]
    App,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigVisibility>))]
public enum ConfigVisibility
{
    [JsonStringEnumMemberName("public")]
    Public,
    [JsonStringEnumMemberName("protected")]
    Protected,
    [JsonStringEnumMemberName("secret")]
    Secret,
}

[JsonConverter(typeof(JsonStringEnumConverter<ConfigVisibilityInput>))]
public enum ConfigVisibilityInput
{
    [JsonStringEnumMemberName("public")]
    Public,
    [JsonStringEnumMemberName("protected")]
    Protected,
    [JsonStringEnumMemberName("secret")]
    Secret,
}

public sealed record CpEnvelopeClaims
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required string Aud { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required CpEnvelopeClaimsTokenType TokenType { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("originUserJti")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> OriginUserJti { get; init; }
    [JsonPropertyName("cpId")]
    public required string CpId { get; init; }
    [JsonPropertyName("cpJwksUri")]
    public required string CpJwksUri { get; init; }
}

public sealed record CpEnvelopeClaimsInput
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required string Aud { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required CpEnvelopeClaimsInputTokenType TokenType { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("originUserJti")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> OriginUserJti { get; init; }
    [JsonPropertyName("cpId")]
    public required string CpId { get; init; }
    [JsonPropertyName("cpJwksUri")]
    public required string CpJwksUri { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<CpEnvelopeClaimsInputTokenType>))]
public enum CpEnvelopeClaimsInputTokenType
{
    [JsonStringEnumMemberName("cp-envelope")]
    CpEnvelope,
}

[JsonConverter(typeof(JsonStringEnumConverter<CpEnvelopeClaimsTokenType>))]
public enum CpEnvelopeClaimsTokenType
{
    [JsonStringEnumMemberName("cp-envelope")]
    CpEnvelope,
}

public sealed record DefaultAuthProviderConfig
{
    [JsonPropertyName("kind")]
    public required DefaultAuthProviderConfigKind Kind { get; init; }
}

public sealed record DefaultAuthProviderConfigInput
{
    [JsonPropertyName("kind")]
    public required DefaultAuthProviderConfigInputKind Kind { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<DefaultAuthProviderConfigInputKind>))]
public enum DefaultAuthProviderConfigInputKind
{
    [JsonStringEnumMemberName("betterportal.default")]
    BetterportalDefault,
}

[JsonConverter(typeof(JsonStringEnumConverter<DefaultAuthProviderConfigKind>))]
public enum DefaultAuthProviderConfigKind
{
    [JsonStringEnumMemberName("betterportal.default")]
    BetterportalDefault,
}

public sealed record DemoScenario
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("match")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<DemoScenarioMatch> Match { get; init; }
    [JsonPropertyName("response")]
    public required System.Text.Json.Nodes.JsonNode? Response { get; init; }
}

public sealed record DemoScenarioInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("match")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<DemoScenarioMatchInput> Match { get; init; }
    [JsonPropertyName("response")]
    public required System.Text.Json.Nodes.JsonNode? Response { get; init; }
}

public sealed record DemoScenarioMatch
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Query { get; init; }
    [JsonPropertyName("params")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Params { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Request { get; init; }
}

public sealed record DemoScenarioMatchInput
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Query { get; init; }
    [JsonPropertyName("params")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Params { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Request { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<DeploymentMode>))]
public enum DeploymentMode
{
    [JsonStringEnumMemberName("bp-hosted")]
    BpHosted,
    [JsonStringEnumMemberName("customer-hosted")]
    CustomerHosted,
    [JsonStringEnumMemberName("third-party-saas")]
    ThirdPartySaas,
    [JsonStringEnumMemberName("self-hosted")]
    SelfHosted,
    [JsonStringEnumMemberName("saas-managed")]
    SaasManaged,
}

[JsonConverter(typeof(JsonStringEnumConverter<DeploymentModeInput>))]
public enum DeploymentModeInput
{
    [JsonStringEnumMemberName("bp-hosted")]
    BpHosted,
    [JsonStringEnumMemberName("customer-hosted")]
    CustomerHosted,
    [JsonStringEnumMemberName("third-party-saas")]
    ThirdPartySaas,
    [JsonStringEnumMemberName("self-hosted")]
    SelfHosted,
    [JsonStringEnumMemberName("saas-managed")]
    SaasManaged,
}

public sealed record DeveloperResource
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required DeveloperResourceKind Kind { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("mediaType")]
    public required string MediaType { get; init; }
    [JsonPropertyName("language")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Language { get; init; }
    [JsonPropertyName("content")]
    public required string Content { get; init; }
}

public sealed record DeveloperResourceInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required DeveloperResourceInputKind Kind { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("mediaType")]
    public required string MediaType { get; init; }
    [JsonPropertyName("language")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Language { get; init; }
    [JsonPropertyName("content")]
    public required string Content { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<DeveloperResourceInputKind>))]
public enum DeveloperResourceInputKind
{
    [JsonStringEnumMemberName("guide")]
    Guide,
    [JsonStringEnumMemberName("template")]
    Template,
    [JsonStringEnumMemberName("skill")]
    Skill,
    [JsonStringEnumMemberName("example")]
    Example,
}

[JsonConverter(typeof(JsonStringEnumConverter<DeveloperResourceKind>))]
public enum DeveloperResourceKind
{
    [JsonStringEnumMemberName("guide")]
    Guide,
    [JsonStringEnumMemberName("template")]
    Template,
    [JsonStringEnumMemberName("skill")]
    Skill,
    [JsonStringEnumMemberName("example")]
    Example,
}

public sealed record FragmentAssignment
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record FragmentAssignmentInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record HtmlRepresentationSupport
{
    [JsonPropertyName("renderers")]
    public required IReadOnlyDictionary<string, ViewRendererSupport> Renderers { get; init; }
}

public sealed record HtmlRepresentationSupportInput
{
    [JsonPropertyName("renderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, ViewRendererSupportInput>> Renderers { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<HttpMethod>))]
public enum HttpMethod
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
    [JsonStringEnumMemberName("OPTIONS")]
    OPTIONS,
}

[JsonConverter(typeof(JsonStringEnumConverter<HttpMethodInput>))]
public enum HttpMethodInput
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
    [JsonStringEnumMemberName("OPTIONS")]
    OPTIONS,
}

[JsonConverter(typeof(JsonStringEnumConverter<IdentityRealm>))]
public enum IdentityRealm
{
    [JsonStringEnumMemberName("runtime")]
    Runtime,
    [JsonStringEnumMemberName("control-plane")]
    ControlPlane,
}

[JsonConverter(typeof(JsonStringEnumConverter<IdentityRealmInput>))]
public enum IdentityRealmInput
{
    [JsonStringEnumMemberName("runtime")]
    Runtime,
    [JsonStringEnumMemberName("control-plane")]
    ControlPlane,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct JsonObject(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<JsonObject, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static JsonObject FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct JsonObjectInput(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Value) : IWireValue<JsonObjectInput, IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>>
{
    public static JsonObjectInput FromValue(IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct JsonValue(System.Text.Json.Nodes.JsonNode? Value) : IWireValue<JsonValue, System.Text.Json.Nodes.JsonNode?>
{
    public static JsonValue FromValue(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator JsonValue(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator System.Text.Json.Nodes.JsonNode?(JsonValue value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct JsonValueInput(System.Text.Json.Nodes.JsonNode? Value) : IWireValue<JsonValueInput, System.Text.Json.Nodes.JsonNode?>
{
    public static JsonValueInput FromValue(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator JsonValueInput(System.Text.Json.Nodes.JsonNode? value) => new(value);
    public static implicit operator System.Text.Json.Nodes.JsonNode?(JsonValueInput value) => value.Value;
}

public sealed record JwtClaims
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required Variant<string, IReadOnlyList<string>> Aud { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("nbf")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Nbf { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("realm")]
    public required IdentityRealm Realm { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("roles")]
    public required IReadOnlyList<string> Roles { get; init; }
    [JsonPropertyName("tokenType")]
    public required TokenType TokenType { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AuthProvider { get; init; }
    [JsonPropertyName("refreshContext")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> RefreshContext { get; init; }
    [JsonPropertyName("providerSubject")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ProviderSubject { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JwtClaimsProvider> Provider { get; init; }
    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Name { get; init; }
    [JsonPropertyName("email")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Email { get; init; }
    [JsonPropertyName("picture")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Picture { get; init; }
}

public sealed record JwtClaimsInput
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required Variant<string, IReadOnlyList<string>> Aud { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("nbf")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Nbf { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("realm")]
    public required IdentityRealmInput Realm { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("roles")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Roles { get; init; }
    [JsonPropertyName("tokenType")]
    public required TokenTypeInput TokenType { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AuthProvider { get; init; }
    [JsonPropertyName("refreshContext")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> RefreshContext { get; init; }
    [JsonPropertyName("providerSubject")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ProviderSubject { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JwtClaimsInputProvider> Provider { get; init; }
    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Name { get; init; }
    [JsonPropertyName("email")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Email { get; init; }
    [JsonPropertyName("picture")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Picture { get; init; }
}

public sealed record JwtClaimsInputProvider
{
    [JsonPropertyName("username")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Username { get; init; }
    [JsonPropertyName("profileUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ProfileUrl { get; init; }
    [JsonPropertyName("accountId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<string, double>> AccountId { get; init; }
    [JsonPropertyName("nodeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NodeId { get; init; }
    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Scope { get; init; }
}

public sealed record JwtClaimsProvider
{
    [JsonPropertyName("username")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Username { get; init; }
    [JsonPropertyName("profileUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ProfileUrl { get; init; }
    [JsonPropertyName("accountId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<string, double>> AccountId { get; init; }
    [JsonPropertyName("nodeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NodeId { get; init; }
    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Scope { get; init; }
}

public sealed record M2MBinding
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("sourceServiceId")]
    public required string SourceServiceId { get; init; }
    [JsonPropertyName("requestId")]
    public required string RequestId { get; init; }
    [JsonPropertyName("contractId")]
    public required string ContractId { get; init; }
    [JsonPropertyName("targetServiceId")]
    public required string TargetServiceId { get; init; }
    [JsonPropertyName("targetViewId")]
    public required string TargetViewId { get; init; }
    [JsonPropertyName("mode")]
    public required M2MBindingMode Mode { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
}

public sealed record M2MBindingInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("sourceServiceId")]
    public required string SourceServiceId { get; init; }
    [JsonPropertyName("requestId")]
    public required string RequestId { get; init; }
    [JsonPropertyName("contractId")]
    public required string ContractId { get; init; }
    [JsonPropertyName("targetServiceId")]
    public required string TargetServiceId { get; init; }
    [JsonPropertyName("targetViewId")]
    public required string TargetViewId { get; init; }
    [JsonPropertyName("mode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<M2MBindingInputMode> Mode { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MBindingInputMode>))]
public enum M2MBindingInputMode
{
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MBindingMode>))]
public enum M2MBindingMode
{
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MCallerMode>))]
public enum M2MCallerMode
{
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MCallerModeInput>))]
public enum M2MCallerModeInput
{
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("delegated")]
    Delegated,
}

public sealed record M2MConfig
{
    [JsonPropertyName("bindings")]
    public required IReadOnlyList<M2MBinding> Bindings { get; init; }
    [JsonPropertyName("grants")]
    public required IReadOnlyList<M2MGrant> Grants { get; init; }
}

public sealed record M2MConfigInput
{
    [JsonPropertyName("bindings")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MBindingInput>> Bindings { get; init; }
    [JsonPropertyName("grants")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MGrantInput>> Grants { get; init; }
}

public sealed record M2MGrant
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethod> Methods { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<string> Permissions { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
}

public sealed record M2MGrantInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethodInput> Methods { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Permissions { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MMethod>))]
public enum M2MMethod
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
    [JsonStringEnumMemberName("OPTIONS")]
    OPTIONS,
}

[JsonConverter(typeof(JsonStringEnumConverter<M2MMethodInput>))]
public enum M2MMethodInput
{
    [JsonStringEnumMemberName("GET")]
    GET,
    [JsonStringEnumMemberName("POST")]
    POST,
    [JsonStringEnumMemberName("PUT")]
    PUT,
    [JsonStringEnumMemberName("PATCH")]
    PATCH,
    [JsonStringEnumMemberName("DELETE")]
    DELETE,
    [JsonStringEnumMemberName("OPTIONS")]
    OPTIONS,
}

public sealed record M2MRequestDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("contractId")]
    public required string ContractId { get; init; }
    [JsonPropertyName("version")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Version { get; init; }
    [JsonPropertyName("requiredCapabilities")]
    public required IReadOnlyList<string> RequiredCapabilities { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethod> Methods { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<string> Permissions { get; init; }
    [JsonPropertyName("mode")]
    public required M2MBindingMode Mode { get; init; }
    [JsonPropertyName("optional")]
    public required bool Optional { get; init; }
}

public sealed record M2MRequestDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("contractId")]
    public required string ContractId { get; init; }
    [JsonPropertyName("version")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Version { get; init; }
    [JsonPropertyName("requiredCapabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> RequiredCapabilities { get; init; }
    [JsonPropertyName("methods")]
    public required IReadOnlyList<HttpMethodInput> Methods { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Permissions { get; init; }
    [JsonPropertyName("mode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<M2MBindingInputMode> Mode { get; init; }
    [JsonPropertyName("optional")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Optional { get; init; }
}

public sealed record ManifestDeclaration
{
    [JsonPropertyName("pluginId")]
    public required string PluginId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("category")]
    public required ManifestDeclarationCategory Category { get; init; }
    [JsonPropertyName("deploymentModes")]
    public required IReadOnlyList<DeploymentMode> DeploymentModes { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("configSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> ConfigSchemas { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<ViewPermissionDefinition> Permissions { get; init; }
    [JsonPropertyName("adminApis")]
    public required IReadOnlyList<AdminApiDescriptor> AdminApis { get; init; }
    [JsonPropertyName("webhooks")]
    public required IReadOnlyList<WebhookEventDescriptor> Webhooks { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<ApiContractDescriptor> ApiContracts { get; init; }
    [JsonPropertyName("m2mRequests")]
    public required IReadOnlyList<M2MRequestDescriptor> M2mRequests { get; init; }
    [JsonPropertyName("developerResources")]
    public required IReadOnlyList<DeveloperResource> DeveloperResources { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifest> Shell { get; init; }
    [JsonPropertyName("cacheHints")]
    public required ManifestDeclarationCacheHints CacheHints { get; init; }
}

public sealed record ManifestDeclarationCacheHints
{
    [JsonPropertyName("metadataTtlSeconds")]
    public required long MetadataTtlSeconds { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ManifestDeclarationCategory>))]
public enum ManifestDeclarationCategory
{
    [JsonStringEnumMemberName("framework")]
    Framework,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
}

public sealed record ManifestDeclarationInput
{
    [JsonPropertyName("pluginId")]
    public required string PluginId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ManifestDeclarationInputCategory> Category { get; init; }
    [JsonPropertyName("deploymentModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DeploymentModeInput>> DeploymentModes { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("configSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> ConfigSchemas { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ViewPermissionDefinitionInput>> Permissions { get; init; }
    [JsonPropertyName("adminApis")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AdminApiDescriptorInput>> AdminApis { get; init; }
    [JsonPropertyName("webhooks")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<WebhookEventDescriptorInput>> Webhooks { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiContractDescriptorInput>> ApiContracts { get; init; }
    [JsonPropertyName("m2mRequests")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MRequestDescriptorInput>> M2mRequests { get; init; }
    [JsonPropertyName("developerResources")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DeveloperResourceInput>> DeveloperResources { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifestInput> Shell { get; init; }
    [JsonPropertyName("cacheHints")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ManifestDeclarationInputCacheHints> CacheHints { get; init; }
}

public sealed record ManifestDeclarationInputCacheHints
{
    [JsonPropertyName("metadataTtlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> MetadataTtlSeconds { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ManifestDeclarationInputCategory>))]
public enum ManifestDeclarationInputCategory
{
    [JsonStringEnumMemberName("framework")]
    Framework,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
}

public sealed record MultipartRequest
{
    [JsonPropertyName("fields")]
    public required IReadOnlyDictionary<string, Variant<string, IReadOnlyList<string>>> Fields { get; init; }
    [JsonPropertyName("files")]
    public required IReadOnlyDictionary<string, Variant<MultipartRequestFilesItemVariant1, IReadOnlyList<MultipartRequestFilesItemVariant1>>> Files { get; init; }
}

public sealed record MultipartRequestFilesItemVariant1
{
    [JsonPropertyName("fieldName")]
    public required string FieldName { get; init; }
    [JsonPropertyName("filename")]
    public required string Filename { get; init; }
    [JsonPropertyName("contentType")]
    public required string ContentType { get; init; }
    [JsonPropertyName("size")]
    public required long Size { get; init; }
    [JsonPropertyName("data")]
    public required IReadOnlyList<byte> Data { get; init; }
}

public sealed record MultipartRequestInput
{
    [JsonPropertyName("fields")]
    public required IReadOnlyDictionary<string, Variant<string, IReadOnlyList<string>>> Fields { get; init; }
    [JsonPropertyName("files")]
    public required IReadOnlyDictionary<string, Variant<MultipartRequestInputFilesItemVariant1, IReadOnlyList<MultipartRequestInputFilesItemVariant1>>> Files { get; init; }
}

public sealed record MultipartRequestInputFilesItemVariant1
{
    [JsonPropertyName("fieldName")]
    public required string FieldName { get; init; }
    [JsonPropertyName("filename")]
    public required string Filename { get; init; }
    [JsonPropertyName("contentType")]
    public required string ContentType { get; init; }
    [JsonPropertyName("size")]
    public required long Size { get; init; }
    [JsonPropertyName("data")]
    public required IReadOnlyList<byte> Data { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ObservabilityAttributes(IReadOnlyDictionary<string, BetterPortalRouteChromeValue> Value) : IWireValue<ObservabilityAttributes, IReadOnlyDictionary<string, BetterPortalRouteChromeValue>>
{
    public static ObservabilityAttributes FromValue(IReadOnlyDictionary<string, BetterPortalRouteChromeValue> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ObservabilityAttributesInput(IReadOnlyDictionary<string, BetterPortalRouteChromeValueInput> Value) : IWireValue<ObservabilityAttributesInput, IReadOnlyDictionary<string, BetterPortalRouteChromeValueInput>>
{
    public static ObservabilityAttributesInput FromValue(IReadOnlyDictionary<string, BetterPortalRouteChromeValueInput> value) => new(value);
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ObservabilityValue(Variant<string, Variant<double, bool>> Value) : IWireValue<ObservabilityValue, Variant<string, Variant<double, bool>>>
{
    public static ObservabilityValue FromValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator ObservabilityValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator Variant<string, Variant<double, bool>>(ObservabilityValue value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ObservabilityValueInput(Variant<string, Variant<double, bool>> Value) : IWireValue<ObservabilityValueInput, Variant<string, Variant<double, bool>>>
{
    public static ObservabilityValueInput FromValue(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator ObservabilityValueInput(Variant<string, Variant<double, bool>> value) => new(value);
    public static implicit operator Variant<string, Variant<double, bool>>(ObservabilityValueInput value) => value.Value;
}

public sealed record OperationDeclaration
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("auth")]
    public required ApiAuthRequirement Auth { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    public required IReadOnlyList<BetterPortalRouteMountRobotsItem> Robots { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("dependencies")]
    public required IReadOnlyList<OperationDependency> Dependencies { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChrome> Chrome { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<OperationDeclarationApiContractsItem> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    public required IReadOnlyList<DemoScenario> DemoScenarios { get; init; }
    [JsonPropertyName("cacheHints")]
    public required OperationDeclarationCacheHints CacheHints { get; init; }
}

public sealed record OperationDeclarationApiContractsItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<string> Permissions { get; init; }
    [JsonPropertyName("modes")]
    public required IReadOnlyList<M2MCallerMode> Modes { get; init; }
}

public sealed record OperationDeclarationCacheHints
{
    [JsonPropertyName("ttlSeconds")]
    public required long TtlSeconds { get; init; }
    [JsonPropertyName("varyBy")]
    public required IReadOnlyList<string> VaryBy { get; init; }
}

public sealed record OperationDeclarationInput
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("auth")]
    public required ApiAuthRequirementInput Auth { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInputRobotsItem>> Robots { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("dependencies")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<OperationDependencyInput>> Dependencies { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChromeInput> Chrome { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<OperationDeclarationInputApiContractsItem>> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DemoScenarioInput>> DemoScenarios { get; init; }
    [JsonPropertyName("cacheHints")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<OperationDeclarationInputCacheHints> CacheHints { get; init; }
}

public sealed record OperationDeclarationInputApiContractsItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Permissions { get; init; }
    [JsonPropertyName("modes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MCallerModeInput>> Modes { get; init; }
}

public sealed record OperationDeclarationInputCacheHints
{
    [JsonPropertyName("ttlSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> TtlSeconds { get; init; }
    [JsonPropertyName("varyBy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> VaryBy { get; init; }
}

public sealed record OperationDependency
{
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
}

public sealed record OperationDependencyInput
{
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
}

public sealed record PlatformService
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("apiKeyHash")]
    public required string ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadata> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record PlatformServiceInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("apiKeyHash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadataInput> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<PluginCategory>))]
public enum PluginCategory
{
    [JsonStringEnumMemberName("framework")]
    Framework,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
}

[JsonConverter(typeof(JsonStringEnumConverter<PluginCategoryInput>))]
public enum PluginCategoryInput
{
    [JsonStringEnumMemberName("framework")]
    Framework,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("service")]
    Service,
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PluginId(string Value) : IWireValue<PluginId, string>
{
    public static PluginId FromValue(string value) => new(value);
    public static implicit operator PluginId(string value) => new(value);
    public static implicit operator string(PluginId value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct PluginIdInput(string Value) : IWireValue<PluginIdInput, string>
{
    public static PluginIdInput FromValue(string value) => new(value);
    public static implicit operator PluginIdInput(string value) => new(value);
    public static implicit operator string(PluginIdInput value) => value.Value;
}

public sealed record PluginManifest
{
    [JsonPropertyName("protocolVersion")]
    public required long ProtocolVersion { get; init; }
    [JsonPropertyName("pluginId")]
    public required string PluginId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("category")]
    public required PluginCategory Category { get; init; }
    [JsonPropertyName("deploymentModes")]
    public required IReadOnlyList<DeploymentMode> DeploymentModes { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("supportedRenderers")]
    public required IReadOnlyList<string> SupportedRenderers { get; init; }
    [JsonPropertyName("supportedRenderModes")]
    public required IReadOnlyList<RenderMode> SupportedRenderModes { get; init; }
    [JsonPropertyName("views")]
    public required IReadOnlyList<ViewMetadata> Views { get; init; }
    [JsonPropertyName("configSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> ConfigSchemas { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<ViewPermissionDefinition> Permissions { get; init; }
    [JsonPropertyName("adminApis")]
    public required IReadOnlyList<AdminApiDescriptor> AdminApis { get; init; }
    [JsonPropertyName("webhooks")]
    public required IReadOnlyList<WebhookEventDescriptor> Webhooks { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<ApiContractDescriptor> ApiContracts { get; init; }
    [JsonPropertyName("m2mRequests")]
    public required IReadOnlyList<M2MRequestDescriptor> M2mRequests { get; init; }
    [JsonPropertyName("developerResources")]
    public required IReadOnlyList<DeveloperResource> DeveloperResources { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifest> Shell { get; init; }
    [JsonPropertyName("cacheHints")]
    public required ManifestDeclarationCacheHints CacheHints { get; init; }
}

public sealed record PluginManifestInput
{
    [JsonPropertyName("protocolVersion")]
    public required long ProtocolVersion { get; init; }
    [JsonPropertyName("pluginId")]
    public required string PluginId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("version")]
    public required string Version { get; init; }
    [JsonPropertyName("category")]
    public required PluginCategoryInput Category { get; init; }
    [JsonPropertyName("deploymentModes")]
    public required IReadOnlyList<DeploymentModeInput> DeploymentModes { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("supportedRenderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> SupportedRenderers { get; init; }
    [JsonPropertyName("supportedRenderModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<RenderModeInput>> SupportedRenderModes { get; init; }
    [JsonPropertyName("views")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ViewMetadataInput>> Views { get; init; }
    [JsonPropertyName("configSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> ConfigSchemas { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ViewPermissionDefinitionInput>> Permissions { get; init; }
    [JsonPropertyName("adminApis")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AdminApiDescriptorInput>> AdminApis { get; init; }
    [JsonPropertyName("webhooks")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<WebhookEventDescriptorInput>> Webhooks { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiContractDescriptorInput>> ApiContracts { get; init; }
    [JsonPropertyName("m2mRequests")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MRequestDescriptorInput>> M2mRequests { get; init; }
    [JsonPropertyName("developerResources")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DeveloperResourceInput>> DeveloperResources { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifestInput> Shell { get; init; }
    [JsonPropertyName("cacheHints")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ManifestDeclarationInputCacheHints> CacheHints { get; init; }
}

public sealed record PreviewEnvironmentDeployment
{
    [JsonPropertyName("credentialReplay")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PreviewEnvironmentDeploymentCredentialReplay> CredentialReplay { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("groupId")]
    public required string GroupId { get; init; }
    [JsonPropertyName("key")]
    public required string Key { get; init; }
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("expiresInDays")]
    public required long? ExpiresInDays { get; init; }
    [JsonPropertyName("expiresAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ExpiresAt { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<PreviewEnvironmentDeploymentService> Services { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("updatedAt")]
    public required string UpdatedAt { get; init; }
}

public sealed record PreviewEnvironmentDeploymentCredentialReplay
{
    [JsonPropertyName("requestHash")]
    public required string RequestHash { get; init; }
    [JsonPropertyName("ciphertext")]
    public required string Ciphertext { get; init; }
    [JsonPropertyName("expiresAt")]
    public required string ExpiresAt { get; init; }
}

public sealed record PreviewEnvironmentDeploymentInput
{
    [JsonPropertyName("credentialReplay")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PreviewEnvironmentDeploymentInputCredentialReplay> CredentialReplay { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("groupId")]
    public required string GroupId { get; init; }
    [JsonPropertyName("key")]
    public required string Key { get; init; }
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("expiresInDays")]
    public required long? ExpiresInDays { get; init; }
    [JsonPropertyName("expiresAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ExpiresAt { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<PreviewEnvironmentDeploymentServiceInput> Services { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("updatedAt")]
    public required string UpdatedAt { get; init; }
}

public sealed record PreviewEnvironmentDeploymentInputCredentialReplay
{
    [JsonPropertyName("requestHash")]
    public required string RequestHash { get; init; }
    [JsonPropertyName("ciphertext")]
    public required string Ciphertext { get; init; }
    [JsonPropertyName("expiresAt")]
    public required string ExpiresAt { get; init; }
}

public sealed record PreviewEnvironmentDeploymentService
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("instanceId")]
    public required string InstanceId { get; init; }
    [JsonPropertyName("url")]
    public required string Url { get; init; }
}

public sealed record PreviewEnvironmentDeploymentServiceInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("instanceId")]
    public required string InstanceId { get; init; }
    [JsonPropertyName("url")]
    public required string Url { get; init; }
}

public sealed record PreviewEnvironmentGroup
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    [JsonPropertyName("sourceTenantId")]
    public required string SourceTenantId { get; init; }
    [JsonPropertyName("sourceAppId")]
    public required string SourceAppId { get; init; }
    [JsonPropertyName("expiresInDays")]
    public required long? ExpiresInDays { get; init; }
    [JsonPropertyName("elevatedRoleIds")]
    public required IReadOnlyList<string> ElevatedRoleIds { get; init; }
    [JsonPropertyName("apiKeyHash")]
    public required string ApiKeyHash { get; init; }
    [JsonPropertyName("oidc")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PreviewEnvironmentOidc> Oidc { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<PreviewEnvironmentGroupService> Services { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("updatedAt")]
    public required string UpdatedAt { get; init; }
}

public sealed record PreviewEnvironmentGroupInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    [JsonPropertyName("sourceTenantId")]
    public required string SourceTenantId { get; init; }
    [JsonPropertyName("sourceAppId")]
    public required string SourceAppId { get; init; }
    [JsonPropertyName("expiresInDays")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long?> ExpiresInDays { get; init; }
    [JsonPropertyName("elevatedRoleIds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> ElevatedRoleIds { get; init; }
    [JsonPropertyName("apiKeyHash")]
    public required string ApiKeyHash { get; init; }
    [JsonPropertyName("oidc")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PreviewEnvironmentOidcInput> Oidc { get; init; }
    [JsonPropertyName("services")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<PreviewEnvironmentGroupServiceInput>> Services { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("updatedAt")]
    public required string UpdatedAt { get; init; }
}

public sealed record PreviewEnvironmentGroupService
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("config")]
    public required PreviewEnvironmentServiceConfig Config { get; init; }
}

public sealed record PreviewEnvironmentGroupServiceInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("config")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PreviewEnvironmentServiceConfigInput> Config { get; init; }
}

public sealed record PreviewEnvironmentOidc
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("subjectPrefix")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SubjectPrefix { get; init; }
    [JsonPropertyName("requiredClaims")]
    public required IReadOnlyDictionary<string, string> RequiredClaims { get; init; }
}

public sealed record PreviewEnvironmentOidcInput
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("subjectPrefix")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SubjectPrefix { get; init; }
    [JsonPropertyName("requiredClaims")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> RequiredClaims { get; init; }
}

public sealed record PreviewEnvironmentServiceConfig
{
    [JsonPropertyName("tenant")]
    public required IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Tenant { get; init; }
    [JsonPropertyName("app")]
    public required IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> App { get; init; }
}

public sealed record PreviewEnvironmentServiceConfigInput
{
    [JsonPropertyName("tenant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>> Tenant { get; init; }
    [JsonPropertyName("app")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>> App { get; init; }
}

public sealed record PublicJwks
{
    [JsonPropertyName("keys")]
    public required IReadOnlyList<RsaPublicJwk> Keys { get; init; }
}

public sealed record PublicJwksInput
{
    [JsonPropertyName("keys")]
    public required IReadOnlyList<RsaPublicJwkInput> Keys { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<RenderMode>))]
public enum RenderMode
{
    [JsonStringEnumMemberName("page")]
    Page,
    [JsonStringEnumMemberName("fragment")]
    Fragment,
    [JsonStringEnumMemberName("embed")]
    Embed,
}

[JsonConverter(typeof(JsonStringEnumConverter<RenderModeInput>))]
public enum RenderModeInput
{
    [JsonStringEnumMemberName("page")]
    Page,
    [JsonStringEnumMemberName("fragment")]
    Fragment,
    [JsonStringEnumMemberName("embed")]
    Embed,
}

public sealed record RsaPublicJwk
{
    [JsonPropertyName("kty")]
    public required RsaPublicJwkKty Kty { get; init; }
    [JsonPropertyName("use")]
    public required RsaPublicJwkUse Use { get; init; }
    [JsonPropertyName("alg")]
    public required RsaPublicJwkAlg Alg { get; init; }
    [JsonPropertyName("kid")]
    public required string Kid { get; init; }
    [JsonPropertyName("n")]
    public required string N { get; init; }
    [JsonPropertyName("e")]
    public required string E { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkAlg>))]
public enum RsaPublicJwkAlg
{
    [JsonStringEnumMemberName("RS256")]
    RS256,
}

public sealed record RsaPublicJwkInput
{
    [JsonPropertyName("kty")]
    public required RsaPublicJwkInputKty Kty { get; init; }
    [JsonPropertyName("use")]
    public required RsaPublicJwkInputUse Use { get; init; }
    [JsonPropertyName("alg")]
    public required RsaPublicJwkInputAlg Alg { get; init; }
    [JsonPropertyName("kid")]
    public required string Kid { get; init; }
    [JsonPropertyName("n")]
    public required string N { get; init; }
    [JsonPropertyName("e")]
    public required string E { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkInputAlg>))]
public enum RsaPublicJwkInputAlg
{
    [JsonStringEnumMemberName("RS256")]
    RS256,
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkInputKty>))]
public enum RsaPublicJwkInputKty
{
    [JsonStringEnumMemberName("RSA")]
    RSA,
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkInputUse>))]
public enum RsaPublicJwkInputUse
{
    [JsonStringEnumMemberName("sig")]
    Sig,
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkKty>))]
public enum RsaPublicJwkKty
{
    [JsonStringEnumMemberName("RSA")]
    RSA,
}

[JsonConverter(typeof(JsonStringEnumConverter<RsaPublicJwkUse>))]
public enum RsaPublicJwkUse
{
    [JsonStringEnumMemberName("sig")]
    Sig,
}

public sealed record ScopedApp
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("hostnames")]
    public required IReadOnlyList<string> Hostnames { get; init; }
    [JsonPropertyName("originOverrides")]
    public required IReadOnlyList<string> OriginOverrides { get; init; }
    [JsonPropertyName("refererOverrides")]
    public required IReadOnlyList<string> RefererOverrides { get; init; }
    [JsonPropertyName("themeConfig")]
    public required ScopedAppThemeConfig ThemeConfig { get; init; }
    [JsonPropertyName("defaultRoute")]
    public required string DefaultRoute { get; init; }
    [JsonPropertyName("seo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppSeo> Seo { get; init; }
    [JsonPropertyName("routes")]
    public required IReadOnlyList<ScopedAppRoutesItem> Routes { get; init; }
    [JsonPropertyName("menu")]
    public required IReadOnlyList<ScopedAppMenuItem> Menu { get; init; }
    [JsonPropertyName("slots")]
    public required IReadOnlyList<ScopedAppSlotsItem> Slots { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignment>> Fragments { get; init; }
    [JsonPropertyName("shellFragments")]
    public required IReadOnlyDictionary<string, IReadOnlyDictionary<string, BetterPortalShellFragmentSetting>> ShellFragments { get; init; }
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppAuth> Auth { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppShell> Shell { get; init; }
    [JsonPropertyName("appRoutes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMount>> AppRoutes { get; init; }
    [JsonPropertyName("appFragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignment>>> AppFragments { get; init; }
}

public sealed record ScopedAppAuth
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<DefaultAuthProviderConfig, ScopedAppAuthProviderVariant2>> Provider { get; init; }
    [JsonPropertyName("roleAuthority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthRoleAuthority> RoleAuthority { get; init; }
    [JsonPropertyName("loginViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LoginViewId { get; init; }
    [JsonPropertyName("logoutViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoutViewId { get; init; }
    [JsonPropertyName("refreshViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RefreshViewId { get; init; }
    [JsonPropertyName("redirects")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppAuthRedirects> Redirects { get; init; }
    [JsonPropertyName("expectedIssuer")]
    public required string ExpectedIssuer { get; init; }
    [JsonPropertyName("expectedAudience")]
    public required string ExpectedAudience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwks> PublicKeys { get; init; }
    [JsonPropertyName("roles")]
    public required IReadOnlyList<ScopedAppAuthRolesItem> Roles { get; init; }
}

public sealed record ScopedAppAuthProviderVariant2
{
    [JsonPropertyName("kind")]
    public required AuthressProviderConfigKind Kind { get; init; }
    [JsonPropertyName("roleClaimPath")]
    public required string RoleClaimPath { get; init; }
    [JsonPropertyName("subjectClaimPath")]
    public required string SubjectClaimPath { get; init; }
    [JsonPropertyName("nameClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NameClaimPath { get; init; }
    [JsonPropertyName("emailClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> EmailClaimPath { get; init; }
    [JsonPropertyName("pictureClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PictureClaimPath { get; init; }
}

public sealed record ScopedAppAuthRedirects
{
    [JsonPropertyName("afterLogin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReference> AfterLogin { get; init; }
    [JsonPropertyName("afterLogout")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReference> AfterLogout { get; init; }
}

public sealed record ScopedAppAuthRolesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<AppAuthPermissionGrant> Permissions { get; init; }
}

public sealed record ScopedAppInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("hostnames")]
    public required IReadOnlyList<string> Hostnames { get; init; }
    [JsonPropertyName("originOverrides")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> OriginOverrides { get; init; }
    [JsonPropertyName("refererOverrides")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> RefererOverrides { get; init; }
    [JsonPropertyName("themeConfig")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputThemeConfig> ThemeConfig { get; init; }
    [JsonPropertyName("defaultRoute")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DefaultRoute { get; init; }
    [JsonPropertyName("seo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputSeo> Seo { get; init; }
    [JsonPropertyName("routes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputRoutesItem>> Routes { get; init; }
    [JsonPropertyName("menu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItem>> Menu { get; init; }
    [JsonPropertyName("slots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputSlotsItem>> Slots { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignmentInput>>> Fragments { get; init; }
    [JsonPropertyName("shellFragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyDictionary<string, BetterPortalShellFragmentSettingInput>>> ShellFragments { get; init; }
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputAuth> Auth { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputShell> Shell { get; init; }
    [JsonPropertyName("appRoutes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInput>> AppRoutes { get; init; }
    [JsonPropertyName("appFragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, IReadOnlyList<BetterPortalFragmentAssignmentInput>>> AppFragments { get; init; }
}

public sealed record ScopedAppInputAuth
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("provider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<Variant<DefaultAuthProviderConfigInput, ScopedAppInputAuthProviderVariant2>> Provider { get; init; }
    [JsonPropertyName("roleAuthority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthRoleAuthorityInput> RoleAuthority { get; init; }
    [JsonPropertyName("loginViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LoginViewId { get; init; }
    [JsonPropertyName("logoutViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoutViewId { get; init; }
    [JsonPropertyName("refreshViewId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RefreshViewId { get; init; }
    [JsonPropertyName("redirects")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputAuthRedirects> Redirects { get; init; }
    [JsonPropertyName("expectedIssuer")]
    public required string ExpectedIssuer { get; init; }
    [JsonPropertyName("expectedAudience")]
    public required string ExpectedAudience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwksInput> PublicKeys { get; init; }
    [JsonPropertyName("roles")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputAuthRolesItem>> Roles { get; init; }
}

public sealed record ScopedAppInputAuthProviderVariant2
{
    [JsonPropertyName("kind")]
    public required AuthressProviderConfigInputKind Kind { get; init; }
    [JsonPropertyName("roleClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RoleClaimPath { get; init; }
    [JsonPropertyName("subjectClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SubjectClaimPath { get; init; }
    [JsonPropertyName("nameClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> NameClaimPath { get; init; }
    [JsonPropertyName("emailClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> EmailClaimPath { get; init; }
    [JsonPropertyName("pictureClaimPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PictureClaimPath { get; init; }
}

public sealed record ScopedAppInputAuthRedirects
{
    [JsonPropertyName("afterLogin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReferenceInput> AfterLogin { get; init; }
    [JsonPropertyName("afterLogout")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AppAuthViewReferenceInput> AfterLogout { get; init; }
}

public sealed record ScopedAppInputAuthRolesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<AppAuthPermissionGrantInput>> Permissions { get; init; }
}

public sealed record ScopedAppInputMenuItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem>> Children { get; init; }
}

public sealed record ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputType> Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputServiceStatus> ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalMenuItemInputAuthStatus> AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<Never>> Children { get; init; }
}

public sealed record ScopedAppInputRoutesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputKind> Kind { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("servicePathVariant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServicePathVariant { get; init; }
    [JsonPropertyName("fixedParams")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> FixedParams { get; init; }
    [JsonPropertyName("authRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputRoutesItemSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppInputRoutesItemRobotsItem>> Robots { get; init; }
    [JsonPropertyName("targetPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TargetPath { get; init; }
    [JsonPropertyName("resolvedServicePath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ResolvedServicePath { get; init; }
    [JsonPropertyName("resolvedMethods")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<HttpMethodInput>> ResolvedMethods { get; init; }
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Query { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("enablement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputEnablement> Enablement { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<string> Operations { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputRoutesItemChromeFields> Chrome { get; init; }
}

public sealed record ScopedAppInputRoutesItemChromeFields
{
    [JsonPropertyName("hideMenu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideMenu { get; init; }
    [JsonPropertyName("hideHeader")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideHeader { get; init; }
    [JsonPropertyName("hideFooter")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideFooter { get; init; }
    [JsonPropertyName("fullScreen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> FullScreen { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

public sealed record ScopedAppInputRoutesItemRobotsItem
{
    [JsonPropertyName("userAgent")]
    public required string UserAgent { get; init; }
    [JsonPropertyName("access")]
    public required BetterPortalRouteMountInputRobotsItemAccess Access { get; init; }
    [JsonPropertyName("crawlDelaySeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> CrawlDelaySeconds { get; init; }
}

public sealed record ScopedAppInputRoutesItemSitemap
{
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountInputSitemapKind Kind { get; init; }
    [JsonPropertyName("lastModified")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastModified { get; init; }
    [JsonPropertyName("changeFrequency")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemapChangeFrequency> ChangeFrequency { get; init; }
    [JsonPropertyName("priority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Priority { get; init; }
}

public sealed record ScopedAppInputSeo
{
    [JsonPropertyName("visibility")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputVisibility> Visibility { get; init; }
    [JsonPropertyName("serviceFailure")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputServiceFailure> ServiceFailure { get; init; }
    [JsonPropertyName("serviceCache")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalSeoConfigInputServiceCache> ServiceCache { get; init; }
    [JsonPropertyName("canonicalOrigin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CanonicalOrigin { get; init; }
}

public sealed record ScopedAppInputShell
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("service")]
    public required string Service { get; init; }
    [JsonPropertyName("renderer")]
    public required string Renderer { get; init; }
}

public sealed record ScopedAppInputSlotsItem
{
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("renderer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Renderer { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record ScopedAppInputThemeConfig
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("documentTitle")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DocumentTitle { get; init; }
    [JsonPropertyName("lightLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LightLogoUrl { get; init; }
    [JsonPropertyName("darkLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DarkLogoUrl { get; init; }
    [JsonPropertyName("faviconUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> FaviconUrl { get; init; }
    [JsonPropertyName("mode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalThemeConfigInputMode> Mode { get; init; }
    [JsonPropertyName("bootstrap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputThemeConfigBootstrap> Bootstrap { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputThemeConfigLight> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppInputThemeConfigLight> Dark { get; init; }
}

public sealed record ScopedAppInputThemeConfigBootstrap
{
    [JsonPropertyName("primary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Primary { get; init; }
    [JsonPropertyName("secondary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Secondary { get; init; }
    [JsonPropertyName("success")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Success { get; init; }
    [JsonPropertyName("info")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Info { get; init; }
    [JsonPropertyName("warning")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Warning { get; init; }
    [JsonPropertyName("danger")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Danger { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Dark { get; init; }
}

public sealed record ScopedAppInputThemeConfigLight
{
    [JsonPropertyName("background")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Background { get; init; }
    [JsonPropertyName("surface")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Surface { get; init; }
    [JsonPropertyName("surfaceAlt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SurfaceAlt { get; init; }
    [JsonPropertyName("text")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Text { get; init; }
    [JsonPropertyName("textSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TextSoft { get; init; }
    [JsonPropertyName("border")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Border { get; init; }
    [JsonPropertyName("accentSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AccentSoft { get; init; }
}

public sealed record ScopedAppMenuItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem> Children { get; init; }
}

public sealed record ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("type")]
    public required BetterPortalMenuItemType Type { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("routeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> RouteId { get; init; }
    [JsonPropertyName("href")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Href { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("serviceStatus")]
    public required BetterPortalMenuItemServiceStatus ServiceStatus { get; init; }
    [JsonPropertyName("authStatus")]
    public required BetterPortalMenuItemAuthStatus AuthStatus { get; init; }
    [JsonPropertyName("defaultExpanded")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> DefaultExpanded { get; init; }
    [JsonPropertyName("children")]
    public required IReadOnlyList<Never> Children { get; init; }
}

public sealed record ScopedAppRoutesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountKind Kind { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("servicePathVariant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServicePathVariant { get; init; }
    [JsonPropertyName("fixedParams")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> FixedParams { get; init; }
    [JsonPropertyName("authRequired")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppRoutesItemSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedAppRoutesItemRobotsItem>> Robots { get; init; }
    [JsonPropertyName("targetPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TargetPath { get; init; }
    [JsonPropertyName("resolvedServicePath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ResolvedServicePath { get; init; }
    [JsonPropertyName("resolvedMethods")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<HttpMethod>> ResolvedMethods { get; init; }
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Query { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("icon")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Icon { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("enablement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountEnablement> Enablement { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<string> Operations { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedAppRoutesItemChromeFields> Chrome { get; init; }
}

public sealed record ScopedAppRoutesItemChromeFields
{
    [JsonPropertyName("hideMenu")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideMenu { get; init; }
    [JsonPropertyName("hideHeader")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideHeader { get; init; }
    [JsonPropertyName("hideFooter")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HideFooter { get; init; }
    [JsonPropertyName("fullScreen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> FullScreen { get; init; }
    [JsonExtensionData]
    public Dictionary<string, System.Text.Json.JsonElement>? AdditionalProperties { get; init; }
}

public sealed record ScopedAppRoutesItemRobotsItem
{
    [JsonPropertyName("userAgent")]
    public required string UserAgent { get; init; }
    [JsonPropertyName("access")]
    public required BetterPortalRouteMountRobotsItemAccess Access { get; init; }
    [JsonPropertyName("crawlDelaySeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> CrawlDelaySeconds { get; init; }
}

public sealed record ScopedAppRoutesItemSitemap
{
    [JsonPropertyName("kind")]
    public required BetterPortalRouteMountSitemapKind Kind { get; init; }
    [JsonPropertyName("lastModified")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastModified { get; init; }
    [JsonPropertyName("changeFrequency")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemapChangeFrequency> ChangeFrequency { get; init; }
    [JsonPropertyName("priority")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<double> Priority { get; init; }
}

public sealed record ScopedAppSeo
{
    [JsonPropertyName("visibility")]
    public required BetterPortalSeoConfigVisibility Visibility { get; init; }
    [JsonPropertyName("serviceFailure")]
    public required BetterPortalSeoConfigServiceFailure ServiceFailure { get; init; }
    [JsonPropertyName("serviceCache")]
    public required BetterPortalSeoConfigServiceCache ServiceCache { get; init; }
    [JsonPropertyName("canonicalOrigin")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CanonicalOrigin { get; init; }
}

public sealed record ScopedAppShell
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("service")]
    public required string Service { get; init; }
    [JsonPropertyName("renderer")]
    public required string Renderer { get; init; }
}

public sealed record ScopedAppSlotsItem
{
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("renderer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Renderer { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record ScopedAppThemeConfig
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("documentTitle")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DocumentTitle { get; init; }
    [JsonPropertyName("lightLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LightLogoUrl { get; init; }
    [JsonPropertyName("darkLogoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DarkLogoUrl { get; init; }
    [JsonPropertyName("faviconUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> FaviconUrl { get; init; }
    [JsonPropertyName("mode")]
    public required BetterPortalThemeConfigMode Mode { get; init; }
    [JsonPropertyName("bootstrap")]
    public required ScopedAppThemeConfigBootstrap Bootstrap { get; init; }
    [JsonPropertyName("light")]
    public required ScopedAppThemeConfigLight Light { get; init; }
    [JsonPropertyName("dark")]
    public required ScopedAppThemeConfigLight Dark { get; init; }
}

public sealed record ScopedAppThemeConfigBootstrap
{
    [JsonPropertyName("primary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Primary { get; init; }
    [JsonPropertyName("secondary")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Secondary { get; init; }
    [JsonPropertyName("success")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Success { get; init; }
    [JsonPropertyName("info")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Info { get; init; }
    [JsonPropertyName("warning")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Warning { get; init; }
    [JsonPropertyName("danger")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Danger { get; init; }
    [JsonPropertyName("light")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Light { get; init; }
    [JsonPropertyName("dark")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Dark { get; init; }
}

public sealed record ScopedAppThemeConfigLight
{
    [JsonPropertyName("background")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Background { get; init; }
    [JsonPropertyName("surface")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Surface { get; init; }
    [JsonPropertyName("surfaceAlt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SurfaceAlt { get; init; }
    [JsonPropertyName("text")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Text { get; init; }
    [JsonPropertyName("textSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> TextSoft { get; init; }
    [JsonPropertyName("border")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Border { get; init; }
    [JsonPropertyName("accentSoft")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AccentSoft { get; init; }
}

public sealed record ScopedServiceConfig
{
    [JsonPropertyName("serviceIdentity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigServiceIdentity> ServiceIdentity { get; init; }
    [JsonPropertyName("m2m")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigM2m> M2m { get; init; }
    [JsonPropertyName("previewConfig")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigPreviewConfig> PreviewConfig { get; init; }
    [JsonPropertyName("configManagement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigConfigManagement> ConfigManagement { get; init; }
    [JsonPropertyName("managementOrigins")]
    public required IReadOnlyList<string> ManagementOrigins { get; init; }
    [JsonPropertyName("tenants")]
    public required IReadOnlyList<ScopedTenant> Tenants { get; init; }
    [JsonPropertyName("configApps")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedServiceConfigConfigAppsItem>> ConfigApps { get; init; }
    [JsonPropertyName("apps")]
    public required IReadOnlyList<ScopedApp> Apps { get; init; }
}

public sealed record ScopedServiceConfigConfigAppsItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
}

public sealed record ScopedServiceConfigConfigManagement
{
    [JsonPropertyName("adminTenantId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AdminTenantId { get; init; }
    [JsonPropertyName("managementAppId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ManagementAppId { get; init; }
    [JsonPropertyName("context")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigConfigManagementContext> Context { get; init; }
}

public sealed record ScopedServiceConfigConfigManagementContext
{
    [JsonPropertyName("tenant")]
    public required ScopedTenant Tenant { get; init; }
    [JsonPropertyName("app")]
    public required ScopedApp App { get; init; }
}

public sealed record ScopedServiceConfigInput
{
    [JsonPropertyName("serviceIdentity")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigInputServiceIdentity> ServiceIdentity { get; init; }
    [JsonPropertyName("m2m")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigInputM2m> M2m { get; init; }
    [JsonPropertyName("previewConfig")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigInputPreviewConfig> PreviewConfig { get; init; }
    [JsonPropertyName("configManagement")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigInputConfigManagement> ConfigManagement { get; init; }
    [JsonPropertyName("managementOrigins")]
    public required IReadOnlyList<string> ManagementOrigins { get; init; }
    [JsonPropertyName("tenants")]
    public required IReadOnlyList<ScopedTenantInput> Tenants { get; init; }
    [JsonPropertyName("configApps")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ScopedServiceConfigInputConfigAppsItem>> ConfigApps { get; init; }
    [JsonPropertyName("apps")]
    public required IReadOnlyList<ScopedAppInput> Apps { get; init; }
}

public sealed record ScopedServiceConfigInputConfigAppsItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
}

public sealed record ScopedServiceConfigInputConfigManagement
{
    [JsonPropertyName("adminTenantId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AdminTenantId { get; init; }
    [JsonPropertyName("managementAppId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ManagementAppId { get; init; }
    [JsonPropertyName("context")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedServiceConfigInputConfigManagementContext> Context { get; init; }
}

public sealed record ScopedServiceConfigInputConfigManagementContext
{
    [JsonPropertyName("tenant")]
    public required ScopedTenantInput Tenant { get; init; }
    [JsonPropertyName("app")]
    public required ScopedAppInput App { get; init; }
}

public sealed record ScopedServiceConfigInputM2m
{
    [JsonPropertyName("localServiceIds")]
    public required IReadOnlyList<string> LocalServiceIds { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<ScopedServiceConfigInputM2mServicesItem> Services { get; init; }
    [JsonPropertyName("bindings")]
    public required IReadOnlyList<M2MBindingInput> Bindings { get; init; }
    [JsonPropertyName("grants")]
    public required IReadOnlyList<M2MGrantInput> Grants { get; init; }
}

public sealed record ScopedServiceConfigInputM2mServicesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
}

public sealed record ScopedServiceConfigInputPreviewConfig
{
    [JsonPropertyName("revision")]
    public required string Revision { get; init; }
    [JsonPropertyName("tenant")]
    public required JsonObjectInput Tenant { get; init; }
    [JsonPropertyName("app")]
    public required JsonObjectInput App { get; init; }
}

public sealed record ScopedServiceConfigInputServiceIdentity
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
}

public sealed record ScopedServiceConfigM2m
{
    [JsonPropertyName("localServiceIds")]
    public required IReadOnlyList<string> LocalServiceIds { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<ScopedServiceConfigM2mServicesItem> Services { get; init; }
    [JsonPropertyName("bindings")]
    public required IReadOnlyList<M2MBinding> Bindings { get; init; }
    [JsonPropertyName("grants")]
    public required IReadOnlyList<M2MGrant> Grants { get; init; }
}

public sealed record ScopedServiceConfigM2mServicesItem
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
}

public sealed record ScopedServiceConfigPreviewConfig
{
    [JsonPropertyName("revision")]
    public required string Revision { get; init; }
    [JsonPropertyName("tenant")]
    public required JsonObject Tenant { get; init; }
    [JsonPropertyName("app")]
    public required JsonObject App { get; init; }
}

public sealed record ScopedServiceConfigServiceIdentity
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
}

public sealed record ScopedTenant
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("active")]
    public required bool Active { get; init; }
    [JsonPropertyName("branding")]
    public required ScopedTenantBranding Branding { get; init; }
    [JsonPropertyName("activatedPlatformServices")]
    public required IReadOnlyList<string> ActivatedPlatformServices { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<ScopedTenantService> Services { get; init; }
}

public sealed record ScopedTenantBranding
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record ScopedTenantInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("active")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Active { get; init; }
    [JsonPropertyName("branding")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantInputBranding> Branding { get; init; }
    [JsonPropertyName("activatedPlatformServices")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> ActivatedPlatformServices { get; init; }
    [JsonPropertyName("services")]
    public required IReadOnlyList<ScopedTenantServiceInput> Services { get; init; }
}

public sealed record ScopedTenantInputBranding
{
    [JsonPropertyName("brandName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BrandName { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record ScopedTenantService
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceAuthProvider> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("deploymentMode")]
    public required ScopedTenantServiceDeploymentMode DeploymentMode { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("lastSeenAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSeenAt { get; init; }
    [JsonPropertyName("lastSyncAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("source")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceSource> Source { get; init; }
    [JsonPropertyName("sharedServiceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SharedServiceId { get; init; }
    [JsonPropertyName("baseUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BaseUrl { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Tags { get; init; }
}

public sealed record ScopedTenantServiceAuthProvider
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwks> PublicKeys { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ScopedTenantServiceDeploymentMode>))]
public enum ScopedTenantServiceDeploymentMode
{
    [JsonStringEnumMemberName("bp-hosted")]
    BpHosted,
    [JsonStringEnumMemberName("customer-hosted")]
    CustomerHosted,
    [JsonStringEnumMemberName("third-party-saas")]
    ThirdPartySaas,
    [JsonStringEnumMemberName("self-hosted")]
    SelfHosted,
    [JsonStringEnumMemberName("saas-managed")]
    SaasManaged,
}

public sealed record ScopedTenantServiceInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceInputAuthProvider> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("deploymentMode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceInputDeploymentMode> DeploymentMode { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("lastSeenAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSeenAt { get; init; }
    [JsonPropertyName("lastSyncAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("source")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceInputSource> Source { get; init; }
    [JsonPropertyName("sharedServiceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SharedServiceId { get; init; }
    [JsonPropertyName("baseUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BaseUrl { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Tags { get; init; }
}

public sealed record ScopedTenantServiceInputAuthProvider
{
    [JsonPropertyName("issuer")]
    public required string Issuer { get; init; }
    [JsonPropertyName("audience")]
    public required string Audience { get; init; }
    [JsonPropertyName("jwksUri")]
    public required string JwksUri { get; init; }
    [JsonPropertyName("publicKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<PublicJwksInput> PublicKeys { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ScopedTenantServiceInputDeploymentMode>))]
public enum ScopedTenantServiceInputDeploymentMode
{
    [JsonStringEnumMemberName("bp-hosted")]
    BpHosted,
    [JsonStringEnumMemberName("customer-hosted")]
    CustomerHosted,
    [JsonStringEnumMemberName("third-party-saas")]
    ThirdPartySaas,
    [JsonStringEnumMemberName("self-hosted")]
    SelfHosted,
    [JsonStringEnumMemberName("saas-managed")]
    SaasManaged,
}

[JsonConverter(typeof(JsonStringEnumConverter<ScopedTenantServiceInputSource>))]
public enum ScopedTenantServiceInputSource
{
    [JsonStringEnumMemberName("tenant")]
    Tenant,
    [JsonStringEnumMemberName("platform")]
    Platform,
    [JsonStringEnumMemberName("shared")]
    Shared,
}

[JsonConverter(typeof(JsonStringEnumConverter<ScopedTenantServiceSource>))]
public enum ScopedTenantServiceSource
{
    [JsonStringEnumMemberName("tenant")]
    Tenant,
    [JsonStringEnumMemberName("platform")]
    Platform,
    [JsonStringEnumMemberName("shared")]
    Shared,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct Semver(string Value) : IWireValue<Semver, string>
{
    public static Semver FromValue(string value) => new(value);
    public static implicit operator Semver(string value) => new(value);
    public static implicit operator string(Semver value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct SemverInput(string Value) : IWireValue<SemverInput, string>
{
    public static SemverInput FromValue(string value) => new(value);
    public static implicit operator SemverInput(string value) => new(value);
    public static implicit operator string(SemverInput value) => value.Value;
}

public sealed record ServiceCatalogEntry
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("category")]
    public required ServiceCatalogEntryCategory Category { get; init; }
    [JsonPropertyName("manifestUrl")]
    public required string ManifestUrl { get; init; }
    [JsonPropertyName("defaultEndpointBaseUrl")]
    public required string DefaultEndpointBaseUrl { get; init; }
    [JsonPropertyName("deploymentModes")]
    public required IReadOnlyList<DeploymentMode> DeploymentModes { get; init; }
    [JsonPropertyName("tenantConfigSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> TenantConfigSchemas { get; init; }
    [JsonPropertyName("appConfigSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> AppConfigSchemas { get; init; }
    [JsonPropertyName("hostedByBetterPortal")]
    public required bool HostedByBetterPortal { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceCatalogEntryCategory>))]
public enum ServiceCatalogEntryCategory
{
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("service")]
    Service,
}

public sealed record ServiceCatalogEntryInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("category")]
    public required ServiceCatalogEntryInputCategory Category { get; init; }
    [JsonPropertyName("manifestUrl")]
    public required string ManifestUrl { get; init; }
    [JsonPropertyName("defaultEndpointBaseUrl")]
    public required string DefaultEndpointBaseUrl { get; init; }
    [JsonPropertyName("deploymentModes")]
    public required IReadOnlyList<DeploymentModeInput> DeploymentModes { get; init; }
    [JsonPropertyName("tenantConfigSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> TenantConfigSchemas { get; init; }
    [JsonPropertyName("appConfigSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> AppConfigSchemas { get; init; }
    [JsonPropertyName("hostedByBetterPortal")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> HostedByBetterPortal { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceCatalogEntryInputCategory>))]
public enum ServiceCatalogEntryInputCategory
{
    [JsonStringEnumMemberName("utility")]
    Utility,
    [JsonStringEnumMemberName("integration")]
    Integration,
    [JsonStringEnumMemberName("theme")]
    Theme,
    [JsonStringEnumMemberName("auth")]
    Auth,
    [JsonStringEnumMemberName("service")]
    Service,
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigAction>))]
public enum ServiceConfigAction
{
    [JsonStringEnumMemberName("schema.read")]
    SchemaRead,
    [JsonStringEnumMemberName("config.read")]
    ConfigRead,
    [JsonStringEnumMemberName("config.write")]
    ConfigWrite,
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigActionInput>))]
public enum ServiceConfigActionInput
{
    [JsonStringEnumMemberName("schema.read")]
    SchemaRead,
    [JsonStringEnumMemberName("config.read")]
    ConfigRead,
    [JsonStringEnumMemberName("config.write")]
    ConfigWrite,
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigManagementMode>))]
public enum ServiceConfigManagementMode
{
    [JsonStringEnumMemberName("static")]
    Static,
    [JsonStringEnumMemberName("bp-managed")]
    BpManaged,
    [JsonStringEnumMemberName("hybrid")]
    Hybrid,
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigManagementModeInput>))]
public enum ServiceConfigManagementModeInput
{
    [JsonStringEnumMemberName("static")]
    Static,
    [JsonStringEnumMemberName("bp-managed")]
    BpManaged,
    [JsonStringEnumMemberName("hybrid")]
    Hybrid,
}

public sealed record ServiceConfigReadResponse
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("values")]
    public required JsonObject Values { get; init; }
}

public sealed record ServiceConfigReadResponseInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("values")]
    public required JsonObjectInput Values { get; init; }
}

public sealed record ServiceConfigSchemaResponse
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("mode")]
    public required ServiceConfigManagementMode Mode { get; init; }
    [JsonPropertyName("configSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> ConfigSchemas { get; init; }
    [JsonPropertyName("supportsCustomUi")]
    public required bool SupportsCustomUi { get; init; }
    [JsonPropertyName("customUiPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CustomUiPath { get; init; }
    [JsonPropertyName("supportsWrite")]
    public required bool SupportsWrite { get; init; }
}

public sealed record ServiceConfigSchemaResponseInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("mode")]
    public required ServiceConfigManagementModeInput Mode { get; init; }
    [JsonPropertyName("configSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> ConfigSchemas { get; init; }
    [JsonPropertyName("supportsCustomUi")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> SupportsCustomUi { get; init; }
    [JsonPropertyName("customUiPath")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> CustomUiPath { get; init; }
    [JsonPropertyName("supportsWrite")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> SupportsWrite { get; init; }
}

public sealed record ServiceConfigState
{
    [JsonPropertyName("tenant")]
    public required IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?> Tenant { get; init; }
    [JsonPropertyName("app")]
    public required IReadOnlyDictionary<string, JsonObject> App { get; init; }
}

public sealed record ServiceConfigStateInput
{
    [JsonPropertyName("tenant")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, System.Text.Json.Nodes.JsonNode?>> Tenant { get; init; }
    [JsonPropertyName("app")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, JsonObjectInput>> App { get; init; }
}

public sealed record ServiceConfigTicketClaims
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required Variant<string, IReadOnlyList<string>> Aud { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("realm")]
    public required ServiceConfigTicketClaimsRealm Realm { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("bindingId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BindingId { get; init; }
    [JsonPropertyName("actions")]
    public required IReadOnlyList<ServiceConfigAction> Actions { get; init; }
}

public sealed record ServiceConfigTicketClaimsInput
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("aud")]
    public required Variant<string, IReadOnlyList<string>> Aud { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("realm")]
    public required ServiceConfigTicketClaimsInputRealm Realm { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("bindingId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> BindingId { get; init; }
    [JsonPropertyName("actions")]
    public required IReadOnlyList<ServiceConfigActionInput> Actions { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigTicketClaimsInputRealm>))]
public enum ServiceConfigTicketClaimsInputRealm
{
    [JsonStringEnumMemberName("control-plane")]
    ControlPlane,
}

[JsonConverter(typeof(JsonStringEnumConverter<ServiceConfigTicketClaimsRealm>))]
public enum ServiceConfigTicketClaimsRealm
{
    [JsonStringEnumMemberName("control-plane")]
    ControlPlane,
}

public sealed record ServiceConfigWriteRequest
{
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("values")]
    public required JsonObject Values { get; init; }
    [JsonPropertyName("clearKeys")]
    public required IReadOnlyList<string> ClearKeys { get; init; }
}

public sealed record ServiceConfigWriteRequestInput
{
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("values")]
    public required JsonObjectInput Values { get; init; }
    [JsonPropertyName("clearKeys")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> ClearKeys { get; init; }
}

public sealed record ServiceManifestCacheEntry
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("manifestVersion")]
    public required string ManifestVersion { get; init; }
    [JsonPropertyName("fetchedAt")]
    public required string FetchedAt { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadata> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("m2mRequests")]
    public required IReadOnlyList<M2MRequestDescriptor> M2mRequests { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<ApiContractDescriptor> ApiContracts { get; init; }
    [JsonPropertyName("developerResources")]
    public required IReadOnlyList<DeveloperResource> DeveloperResources { get; init; }
    [JsonPropertyName("configSchemas")]
    public required IReadOnlyList<ConfigSchemaDescriptor> ConfigSchemas { get; init; }
    [JsonPropertyName("webhooks")]
    public required IReadOnlyList<WebhookEventDescriptor> Webhooks { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifest> Shell { get; init; }
    [JsonPropertyName("viewIndex")]
    public required IReadOnlyDictionary<string, ServiceManifestCacheEntryViewIndexItem> ViewIndex { get; init; }
}

public sealed record ServiceManifestCacheEntryInput
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("manifestVersion")]
    public required string ManifestVersion { get; init; }
    [JsonPropertyName("fetchedAt")]
    public required string FetchedAt { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadataInput> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("m2mRequests")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<M2MRequestDescriptorInput>> M2mRequests { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiContractDescriptorInput>> ApiContracts { get; init; }
    [JsonPropertyName("developerResources")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DeveloperResourceInput>> DeveloperResources { get; init; }
    [JsonPropertyName("configSchemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ConfigSchemaDescriptorInput>> ConfigSchemas { get; init; }
    [JsonPropertyName("webhooks")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<WebhookEventDescriptorInput>> Webhooks { get; init; }
    [JsonPropertyName("shell")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ShellManifestInput> Shell { get; init; }
    [JsonPropertyName("viewIndex")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, ServiceManifestCacheEntryInputViewIndexItem>> ViewIndex { get; init; }
}

public sealed record ServiceManifestCacheEntryInputViewIndexItem
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> PathVariants { get; init; }
    [JsonPropertyName("paramsSchema")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> ParamsSchema { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<ServiceManifestCacheEntryInputViewIndexItemOperationsItem> Operations { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ServiceManifestCacheEntryInputViewIndexItemFragmentsItem>> Fragments { get; init; }
}

public sealed record ServiceManifestCacheEntryInputViewIndexItemFragmentsItem
{
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
}

public sealed record ServiceManifestCacheEntryInputViewIndexItemOperationsItem
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("renderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Renderers { get; init; }
    [JsonPropertyName("renderModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<RenderModeInput>> RenderModes { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("authRequired")]
    public required bool AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInputRobotsItem>> Robots { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChromeInput> Chrome { get; init; }
    [JsonPropertyName("dependencies")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<OperationDependencyInput>> Dependencies { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ServiceManifestCacheEntryInputViewIndexItemOperationsItemPermissionsItem>> Permissions { get; init; }
    [JsonPropertyName("renderable")]
    public required bool Renderable { get; init; }
    [JsonPropertyName("schemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ServiceManifestCacheEntryInputViewIndexItemOperationsItemSchemas> Schemas { get; init; }
    [JsonPropertyName("raw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Raw { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiContractDescriptorInput>> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DemoScenarioInput>> DemoScenarios { get; init; }
}

public sealed record ServiceManifestCacheEntryInputViewIndexItemOperationsItemPermissionsItem
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Permissions { get; init; }
}

public sealed record ServiceManifestCacheEntryInputViewIndexItemOperationsItemSchemas
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Query { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Request { get; init; }
    [JsonPropertyName("multipart")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Multipart { get; init; }
    [JsonPropertyName("response")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Response { get; init; }
}

public sealed record ServiceManifestCacheEntryViewIndexItem
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    public required IReadOnlyList<string> PathVariants { get; init; }
    [JsonPropertyName("paramsSchema")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> ParamsSchema { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<ServiceManifestCacheEntryViewIndexItemOperationsItem> Operations { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyList<ServiceManifestCacheEntryViewIndexItemFragmentsItem> Fragments { get; init; }
}

public sealed record ServiceManifestCacheEntryViewIndexItemFragmentsItem
{
    [JsonPropertyName("fragmentId")]
    public required string FragmentId { get; init; }
    [JsonPropertyName("targetPath")]
    public required string TargetPath { get; init; }
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
}

public sealed record ServiceManifestCacheEntryViewIndexItemOperationsItem
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("renderers")]
    public required IReadOnlyList<string> Renderers { get; init; }
    [JsonPropertyName("renderModes")]
    public required IReadOnlyList<RenderMode> RenderModes { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("authRequired")]
    public required bool AuthRequired { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    public required IReadOnlyList<BetterPortalRouteMountRobotsItem> Robots { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChrome> Chrome { get; init; }
    [JsonPropertyName("dependencies")]
    public required IReadOnlyList<OperationDependency> Dependencies { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<ServiceManifestCacheEntryViewIndexItemOperationsItemPermissionsItem> Permissions { get; init; }
    [JsonPropertyName("renderable")]
    public required bool Renderable { get; init; }
    [JsonPropertyName("schemas")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ServiceManifestCacheEntryViewIndexItemOperationsItemSchemas> Schemas { get; init; }
    [JsonPropertyName("raw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Raw { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<ApiContractDescriptor> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    public required IReadOnlyList<DemoScenario> DemoScenarios { get; init; }
}

public sealed record ServiceManifestCacheEntryViewIndexItemOperationsItemPermissionsItem
{
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("permissions")]
    public required IReadOnlyList<string> Permissions { get; init; }
}

public sealed record ServiceManifestCacheEntryViewIndexItemOperationsItemSchemas
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Query { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Request { get; init; }
    [JsonPropertyName("multipart")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Multipart { get; init; }
    [JsonPropertyName("response")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Response { get; init; }
}

public sealed record ServiceTokenClaims
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("aud")]
    public required string Aud { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("nbf")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Nbf { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required BetterPortalShellFragmentItemVariant2Source TokenType { get; init; }
}

public sealed record ServiceTokenClaimsInput
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("sub")]
    public required string Sub { get; init; }
    [JsonPropertyName("aud")]
    public required string Aud { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    public required string AppId { get; init; }
    [JsonPropertyName("bindingId")]
    public required string BindingId { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("nbf")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> Nbf { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required BetterPortalShellFragmentItemInputVariant2Source TokenType { get; init; }
}

public sealed record SetupTokenClaims
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required SetupTokenClaimsTokenType TokenType { get; init; }
    [JsonPropertyName("instanceId")]
    public required string InstanceId { get; init; }
    [JsonPropertyName("serviceUrl")]
    public required string ServiceUrl { get; init; }
    [JsonPropertyName("cpUrl")]
    public required string CpUrl { get; init; }
    [JsonPropertyName("cpJwksUri")]
    public required string CpJwksUri { get; init; }
    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<SetupTokenClaimsScope> Scope { get; init; }
}

public sealed record SetupTokenClaimsInput
{
    [JsonPropertyName("iss")]
    public required string Iss { get; init; }
    [JsonPropertyName("exp")]
    public required long Exp { get; init; }
    [JsonPropertyName("iat")]
    public required long Iat { get; init; }
    [JsonPropertyName("jti")]
    public required string Jti { get; init; }
    [JsonPropertyName("tokenType")]
    public required SetupTokenClaimsInputTokenType TokenType { get; init; }
    [JsonPropertyName("instanceId")]
    public required string InstanceId { get; init; }
    [JsonPropertyName("serviceUrl")]
    public required string ServiceUrl { get; init; }
    [JsonPropertyName("cpUrl")]
    public required string CpUrl { get; init; }
    [JsonPropertyName("cpJwksUri")]
    public required string CpJwksUri { get; init; }
    [JsonPropertyName("scope")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<SetupTokenClaimsInputScope> Scope { get; init; }
}

public sealed record SetupTokenClaimsInputScope
{
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<SetupTokenClaimsInputTokenType>))]
public enum SetupTokenClaimsInputTokenType
{
    [JsonStringEnumMemberName("setup")]
    Setup,
}

public sealed record SetupTokenClaimsScope
{
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<SetupTokenClaimsTokenType>))]
public enum SetupTokenClaimsTokenType
{
    [JsonStringEnumMemberName("setup")]
    Setup,
}

public sealed record SharedServiceDefinition
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("baseUrl")]
    public required string BaseUrl { get; init; }
    [JsonPropertyName("apiKeyHash")]
    public required string ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadata> AuthProvider { get; init; }
    [JsonPropertyName("supportedDeploymentModes")]
    public required IReadOnlyList<DeploymentMode> SupportedDeploymentModes { get; init; }
    [JsonPropertyName("owner")]
    public required SharedServiceDefinitionOwner Owner { get; init; }
    [JsonPropertyName("upgradeUrlTemplate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> UpgradeUrlTemplate { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("tags")]
    public required IReadOnlyList<string> Tags { get; init; }
    [JsonPropertyName("pricingHint")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<SharedServiceDefinitionPricingHint> PricingHint { get; init; }
    [JsonPropertyName("publishedAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublishedAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record SharedServiceDefinitionInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("baseUrl")]
    public required string BaseUrl { get; init; }
    [JsonPropertyName("apiKeyHash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadataInput> AuthProvider { get; init; }
    [JsonPropertyName("supportedDeploymentModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DeploymentModeInput>> SupportedDeploymentModes { get; init; }
    [JsonPropertyName("owner")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<SharedServiceDefinitionInputOwner> Owner { get; init; }
    [JsonPropertyName("upgradeUrlTemplate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> UpgradeUrlTemplate { get; init; }
    [JsonPropertyName("category")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Category { get; init; }
    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Tags { get; init; }
    [JsonPropertyName("pricingHint")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<SharedServiceDefinitionInputPricingHint> PricingHint { get; init; }
    [JsonPropertyName("publishedAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublishedAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<SharedServiceDefinitionInputOwner>))]
public enum SharedServiceDefinitionInputOwner
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("3p")]
    T3p,
}

[JsonConverter(typeof(JsonStringEnumConverter<SharedServiceDefinitionInputPricingHint>))]
public enum SharedServiceDefinitionInputPricingHint
{
    [JsonStringEnumMemberName("free")]
    Free,
    [JsonStringEnumMemberName("freemium")]
    Freemium,
    [JsonStringEnumMemberName("paid")]
    Paid,
}

[JsonConverter(typeof(JsonStringEnumConverter<SharedServiceDefinitionOwner>))]
public enum SharedServiceDefinitionOwner
{
    [JsonStringEnumMemberName("bp")]
    Bp,
    [JsonStringEnumMemberName("3p")]
    T3p,
}

[JsonConverter(typeof(JsonStringEnumConverter<SharedServiceDefinitionPricingHint>))]
public enum SharedServiceDefinitionPricingHint
{
    [JsonStringEnumMemberName("free")]
    Free,
    [JsonStringEnumMemberName("freemium")]
    Freemium,
    [JsonStringEnumMemberName("paid")]
    Paid,
}

public sealed record ShellFragmentDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required ShellFragmentDescriptorKind Kind { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("defaultItems")]
    public required IReadOnlyList<string> DefaultItems { get; init; }
}

public sealed record ShellFragmentDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required ShellFragmentDescriptorInputKind Kind { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("defaultItems")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> DefaultItems { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ShellFragmentDescriptorInputKind>))]
public enum ShellFragmentDescriptorInputKind
{
    [JsonStringEnumMemberName("fragment")]
    Fragment,
    [JsonStringEnumMemberName("block")]
    Block,
}

[JsonConverter(typeof(JsonStringEnumConverter<ShellFragmentDescriptorKind>))]
public enum ShellFragmentDescriptorKind
{
    [JsonStringEnumMemberName("fragment")]
    Fragment,
    [JsonStringEnumMemberName("block")]
    Block,
}

public sealed record ShellManifest
{
    [JsonPropertyName("service")]
    public required string Service { get; init; }
    [JsonPropertyName("renderer")]
    public required string Renderer { get; init; }
    [JsonPropertyName("fragments")]
    public required IReadOnlyList<ShellFragmentDescriptor> Fragments { get; init; }
}

public sealed record ShellManifestInput
{
    [JsonPropertyName("service")]
    public required string Service { get; init; }
    [JsonPropertyName("renderer")]
    public required string Renderer { get; init; }
    [JsonPropertyName("fragments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ShellFragmentDescriptorInput>> Fragments { get; init; }
}

public sealed record StreamEndFrame
{
    [JsonPropertyName("kind")]
    public required StreamEndFrameKind Kind { get; init; }
    [JsonPropertyName("count")]
    public required long Count { get; init; }
}

public sealed record StreamEndFrameInput
{
    [JsonPropertyName("kind")]
    public required StreamEndFrameInputKind Kind { get; init; }
    [JsonPropertyName("count")]
    public required long Count { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<StreamEndFrameInputKind>))]
public enum StreamEndFrameInputKind
{
    [JsonStringEnumMemberName("end")]
    End,
}

[JsonConverter(typeof(JsonStringEnumConverter<StreamEndFrameKind>))]
public enum StreamEndFrameKind
{
    [JsonStringEnumMemberName("end")]
    End,
}

public sealed record StreamErrorFrame
{
    [JsonPropertyName("kind")]
    public required StreamErrorFrameKind Kind { get; init; }
    [JsonPropertyName("error")]
    public required string Error { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
    [JsonPropertyName("issues")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<StreamErrorFrameIssuesItem>> Issues { get; init; }
}

public sealed record StreamErrorFrameInput
{
    [JsonPropertyName("kind")]
    public required StreamErrorFrameInputKind Kind { get; init; }
    [JsonPropertyName("error")]
    public required string Error { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
    [JsonPropertyName("issues")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<StreamErrorFrameInputIssuesItem>> Issues { get; init; }
}

public sealed record StreamErrorFrameInputIssuesItem
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }
    [JsonPropertyName("path")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Path { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<StreamErrorFrameInputKind>))]
public enum StreamErrorFrameInputKind
{
    [JsonStringEnumMemberName("error")]
    Error,
}

public sealed record StreamErrorFrameIssuesItem
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }
    [JsonPropertyName("path")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Path { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<StreamErrorFrameKind>))]
public enum StreamErrorFrameKind
{
    [JsonStringEnumMemberName("error")]
    Error,
}

public sealed record Tenant
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("branding")]
    public required TenantBranding Branding { get; init; }
}

public sealed record TenantAppValidation
{
    [JsonPropertyName("allowed")]
    public required bool Allowed { get; init; }
    [JsonPropertyName("reason")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Reason { get; init; }
    [JsonPropertyName("upgradeUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> UpgradeUrl { get; init; }
    [JsonPropertyName("retryAfterSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> RetryAfterSeconds { get; init; }
}

public sealed record TenantAppValidationInput
{
    [JsonPropertyName("allowed")]
    public required bool Allowed { get; init; }
    [JsonPropertyName("reason")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Reason { get; init; }
    [JsonPropertyName("upgradeUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> UpgradeUrl { get; init; }
    [JsonPropertyName("retryAfterSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> RetryAfterSeconds { get; init; }
}

public sealed record TenantBranding
{
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record TenantInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("branding")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<TenantInputBranding> Branding { get; init; }
}

public sealed record TenantInputBranding
{
    [JsonPropertyName("logoUrl")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LogoUrl { get; init; }
    [JsonPropertyName("primaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PrimaryColor { get; init; }
    [JsonPropertyName("secondaryColor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> SecondaryColor { get; init; }
}

public sealed record TenantServiceRegistration
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("apiKeyHash")]
    public required string ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadata> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    public required IReadOnlyList<string> Capabilities { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("deploymentMode")]
    public required ScopedTenantServiceDeploymentMode DeploymentMode { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("lastSeenAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSeenAt { get; init; }
    [JsonPropertyName("lastSyncAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record TenantServiceRegistrationInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("hostname")]
    public required string Hostname { get; init; }
    [JsonPropertyName("apiKeyHash")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ApiKeyHash { get; init; }
    [JsonPropertyName("publicKeyPem")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> PublicKeyPem { get; init; }
    [JsonPropertyName("keyId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> KeyId { get; init; }
    [JsonPropertyName("serviceId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> ServiceId { get; init; }
    [JsonPropertyName("authProvider")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<AuthProviderRuntimeMetadataInput> AuthProvider { get; init; }
    [JsonPropertyName("capabilities")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Capabilities { get; init; }
    [JsonPropertyName("title")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("deploymentMode")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ScopedTenantServiceInputDeploymentMode> DeploymentMode { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("lastSeenAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSeenAt { get; init; }
    [JsonPropertyName("lastSyncAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> LastSyncAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record TenantSharedServiceActivation
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("sharedServiceId")]
    public required string SharedServiceId { get; init; }
    [JsonPropertyName("activatedAt")]
    public required string ActivatedAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
}

public sealed record TenantSharedServiceActivationInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("sharedServiceId")]
    public required string SharedServiceId { get; init; }
    [JsonPropertyName("activatedAt")]
    public required string ActivatedAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
}

public sealed record TokenLifetimeConfig
{
    [JsonPropertyName("accessTokenSeconds")]
    public required long AccessTokenSeconds { get; init; }
    [JsonPropertyName("refreshTokenSeconds")]
    public required long RefreshTokenSeconds { get; init; }
}

public sealed record TokenLifetimeConfigInput
{
    [JsonPropertyName("accessTokenSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> AccessTokenSeconds { get; init; }
    [JsonPropertyName("refreshTokenSeconds")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> RefreshTokenSeconds { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<TokenType>))]
public enum TokenType
{
    [JsonStringEnumMemberName("access")]
    Access,
    [JsonStringEnumMemberName("refresh")]
    Refresh,
    [JsonStringEnumMemberName("cp-envelope")]
    CpEnvelope,
    [JsonStringEnumMemberName("setup")]
    Setup,
    [JsonStringEnumMemberName("install")]
    Install,
}

[JsonConverter(typeof(JsonStringEnumConverter<TokenTypeInput>))]
public enum TokenTypeInput
{
    [JsonStringEnumMemberName("access")]
    Access,
    [JsonStringEnumMemberName("refresh")]
    Refresh,
    [JsonStringEnumMemberName("cp-envelope")]
    CpEnvelope,
    [JsonStringEnumMemberName("setup")]
    Setup,
    [JsonStringEnumMemberName("install")]
    Install,
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct UuidV7(string Value) : IWireValue<UuidV7, string>
{
    public static UuidV7 FromValue(string value) => new(value);
    public static implicit operator UuidV7(string value) => new(value);
    public static implicit operator string(UuidV7 value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct UuidV7Input(string Value) : IWireValue<UuidV7Input, string>
{
    public static UuidV7Input FromValue(string value) => new(value);
    public static implicit operator UuidV7Input(string value) => new(value);
    public static implicit operator string(UuidV7Input value) => value.Value;
}

public sealed record ViewDemoScenario
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("match")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<DemoScenarioMatch> Match { get; init; }
    [JsonPropertyName("response")]
    public required System.Text.Json.Nodes.JsonNode? Response { get; init; }
}

public sealed record ViewDemoScenarioInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("match")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<DemoScenarioMatchInput> Match { get; init; }
    [JsonPropertyName("response")]
    public required System.Text.Json.Nodes.JsonNode? Response { get; init; }
}

public sealed record ViewDemoScenarioMatch
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Query { get; init; }
    [JsonPropertyName("params")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Params { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> Request { get; init; }
}

public sealed record ViewDemoScenarioMatchInput
{
    [JsonPropertyName("query")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Query { get; init; }
    [JsonPropertyName("params")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Params { get; init; }
    [JsonPropertyName("headers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyDictionary<string, string>> Headers { get; init; }
    [JsonPropertyName("request")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> Request { get; init; }
}

public sealed record ViewMetadata
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    public required IReadOnlyList<string> PathVariants { get; init; }
    [JsonPropertyName("paramsSchema")]
    public required JsonObject ParamsSchema { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<ViewOperationMetadata> Operations { get; init; }
}

public sealed record ViewMetadataInput
{
    [JsonPropertyName("viewId")]
    public required string ViewId { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("path")]
    public required string Path { get; init; }
    [JsonPropertyName("pathVariants")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> PathVariants { get; init; }
    [JsonPropertyName("paramsSchema")]
    public required JsonObjectInput ParamsSchema { get; init; }
    [JsonPropertyName("operations")]
    public required IReadOnlyList<ViewOperationMetadataInput> Operations { get; init; }
}

public sealed record ViewOperationMetadata
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethod Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("querySchema")]
    public required JsonObject QuerySchema { get; init; }
    [JsonPropertyName("headersSchema")]
    public required JsonObject HeadersSchema { get; init; }
    [JsonPropertyName("bodySchema")]
    public required JsonObject BodySchema { get; init; }
    [JsonPropertyName("jsonResponseSchema")]
    public required JsonObject JsonResponseSchema { get; init; }
    [JsonPropertyName("metadataResponseSchema")]
    public required JsonObject MetadataResponseSchema { get; init; }
    [JsonPropertyName("renderable")]
    public required bool Renderable { get; init; }
    [JsonPropertyName("raw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Raw { get; init; }
    [JsonPropertyName("streaming")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ViewStreamingSupport> Streaming { get; init; }
    [JsonPropertyName("html")]
    public required HtmlRepresentationSupport Html { get; init; }
    [JsonPropertyName("auth")]
    public required ApiAuthRequirement Auth { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    public required IReadOnlyList<BetterPortalRouteMountRobotsItem> Robots { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("dependencies")]
    public required IReadOnlyList<OperationDependency> Dependencies { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChrome> Chrome { get; init; }
    [JsonPropertyName("apiContracts")]
    public required IReadOnlyList<ApiContractDescriptor> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    public required IReadOnlyList<DemoScenario> DemoScenarios { get; init; }
    [JsonPropertyName("cacheHints")]
    public required CacheHints CacheHints { get; init; }
}

public sealed record ViewOperationMetadataInput
{
    [JsonPropertyName("operationId")]
    public required string OperationId { get; init; }
    [JsonPropertyName("method")]
    public required HttpMethodInput Method { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("querySchema")]
    public required JsonObjectInput QuerySchema { get; init; }
    [JsonPropertyName("headersSchema")]
    public required JsonObjectInput HeadersSchema { get; init; }
    [JsonPropertyName("bodySchema")]
    public required JsonObjectInput BodySchema { get; init; }
    [JsonPropertyName("jsonResponseSchema")]
    public required JsonObjectInput JsonResponseSchema { get; init; }
    [JsonPropertyName("metadataResponseSchema")]
    public required JsonObjectInput MetadataResponseSchema { get; init; }
    [JsonPropertyName("renderable")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Renderable { get; init; }
    [JsonPropertyName("raw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Raw { get; init; }
    [JsonPropertyName("streaming")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<ViewStreamingSupportInput> Streaming { get; init; }
    [JsonPropertyName("html")]
    public required HtmlRepresentationSupportInput Html { get; init; }
    [JsonPropertyName("auth")]
    public required ApiAuthRequirementInput Auth { get; init; }
    [JsonPropertyName("sitemap")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteMountInputSitemap> Sitemap { get; init; }
    [JsonPropertyName("robots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<BetterPortalRouteMountInputRobotsItem>> Robots { get; init; }
    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Role { get; init; }
    [JsonPropertyName("dependencies")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<OperationDependencyInput>> Dependencies { get; init; }
    [JsonPropertyName("chrome")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<BetterPortalRouteChromeInput> Chrome { get; init; }
    [JsonPropertyName("apiContracts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ApiContractDescriptorInput>> ApiContracts { get; init; }
    [JsonPropertyName("demoScenarios")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<DemoScenarioInput>> DemoScenarios { get; init; }
    [JsonPropertyName("cacheHints")]
    public required CacheHintsInput CacheHints { get; init; }
}

public sealed record ViewPermissionDefinition
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("defaultRoles")]
    public required IReadOnlyList<string> DefaultRoles { get; init; }
}

public sealed record ViewPermissionDefinitionInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("defaultRoles")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> DefaultRoles { get; init; }
}

public sealed record ViewRendererSupport
{
    [JsonPropertyName("defaultRenderer")]
    public required string DefaultRenderer { get; init; }
    [JsonPropertyName("renderModes")]
    public required IReadOnlyList<RenderMode> RenderModes { get; init; }
    [JsonPropertyName("slots")]
    public required IReadOnlyList<string> Slots { get; init; }
    [JsonPropertyName("renderers")]
    public required IReadOnlyList<ViewRendererVariant> Renderers { get; init; }
}

public sealed record ViewRendererSupportInput
{
    [JsonPropertyName("defaultRenderer")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> DefaultRenderer { get; init; }
    [JsonPropertyName("renderModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<RenderModeInput>> RenderModes { get; init; }
    [JsonPropertyName("slots")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<string>> Slots { get; init; }
    [JsonPropertyName("renderers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<ViewRendererVariantInput>> Renderers { get; init; }
}

public sealed record ViewRendererVariant
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("renderModes")]
    public required IReadOnlyList<RenderMode> RenderModes { get; init; }
}

public sealed record ViewRendererVariantInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("slotId")]
    public required string SlotId { get; init; }
    [JsonPropertyName("renderModes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<IReadOnlyList<RenderModeInput>> RenderModes { get; init; }
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ViewRole(string Value) : IWireValue<ViewRole, string>
{
    public static ViewRole FromValue(string value) => new(value);
    public static implicit operator ViewRole(string value) => new(value);
    public static implicit operator string(ViewRole value) => value.Value;
}

[JsonConverter(typeof(WireValueConverterFactory))]
public readonly record struct ViewRoleInput(string Value) : IWireValue<ViewRoleInput, string>
{
    public static ViewRoleInput FromValue(string value) => new(value);
    public static implicit operator ViewRoleInput(string value) => new(value);
    public static implicit operator string(ViewRoleInput value) => value.Value;
}

public sealed record ViewStreamingSupport
{
    [JsonPropertyName("itemSchema")]
    public required JsonObject ItemSchema { get; init; }
    [JsonPropertyName("summarySchema")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObject> SummarySchema { get; init; }
}

public sealed record ViewStreamingSupportInput
{
    [JsonPropertyName("itemSchema")]
    public required JsonObjectInput ItemSchema { get; init; }
    [JsonPropertyName("summarySchema")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<JsonObjectInput> SummarySchema { get; init; }
}

public sealed record WebhookEventDescriptor
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("payloadSchema")]
    public required JsonObject PayloadSchema { get; init; }
}

public sealed record WebhookEventDescriptorInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> Description { get; init; }
    [JsonPropertyName("payloadSchema")]
    public required JsonObjectInput PayloadSchema { get; init; }
}

public sealed record WebhookTarget
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("eventId")]
    public required string EventId { get; init; }
    [JsonPropertyName("url")]
    public required string Url { get; init; }
    [JsonPropertyName("secret")]
    public required string Secret { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("enabled")]
    public required bool Enabled { get; init; }
    [JsonPropertyName("maxAttempts")]
    public required long MaxAttempts { get; init; }
}

public sealed record WebhookTargetInput
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("tenantId")]
    public required string TenantId { get; init; }
    [JsonPropertyName("appId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<string> AppId { get; init; }
    [JsonPropertyName("serviceId")]
    public required string ServiceId { get; init; }
    [JsonPropertyName("eventId")]
    public required string EventId { get; init; }
    [JsonPropertyName("url")]
    public required string Url { get; init; }
    [JsonPropertyName("secret")]
    public required string Secret { get; init; }
    [JsonPropertyName("createdAt")]
    public required string CreatedAt { get; init; }
    [JsonPropertyName("enabled")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<bool> Enabled { get; init; }
    [JsonPropertyName("maxAttempts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public Optional<long> MaxAttempts { get; init; }
}
