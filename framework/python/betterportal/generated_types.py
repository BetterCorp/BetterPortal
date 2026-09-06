# Generated from AnyVali documents; do not edit. SHA256: d57532514396287116565fc9f9299f7d5de52d65a7ce88cc05f0cc23df9221a1
from __future__ import annotations
from typing import Any, Literal, NoReturn, TypeAlias, Union
from typing_extensions import NotRequired, Required, TypedDict

AdminApiDescriptor = TypedDict('AdminApiDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']]"],
    'supportsCustomUi': Required['bool'],
})

AdminApiDescriptorInput = TypedDict('AdminApiDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']]"],
    'supportsCustomUi': NotRequired['bool'],
})

ApiAuthRequirement = TypedDict('ApiAuthRequirement', {
    'required': Required['bool'],
    'callers': Required['list[ApiCallerMode]'],
    'permissions': Required['list[ApiAuthRequirementPermissionsItem]'],
})

ApiAuthRequirementInput = TypedDict('ApiAuthRequirementInput', {
    'required': NotRequired['bool'],
    'callers': NotRequired['list[ApiCallerModeInput]'],
    'permissions': NotRequired['list[ApiAuthRequirementInputPermissionsItem]'],
})

ApiAuthRequirementInputPermissionsItem = TypedDict('ApiAuthRequirementInputPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[AppAuthPermissionActionInput]'],
})

ApiAuthRequirementPermissionsItem = TypedDict('ApiAuthRequirementPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[AppAuthPermissionAction]'],
})

ApiCallerMode: TypeAlias = "Literal['user', 'service', 'delegated']"

ApiCallerModeInput: TypeAlias = "Literal['user', 'service', 'delegated']"

ApiContractDescriptor = TypedDict('ApiContractDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'viewId': Required['str'],
    'methods': Required['list[HttpMethod]'],
    'capabilities': Required['list[str]'],
    'permissions': Required['list[str]'],
    'modes': Required['list[M2MCallerMode]'],
})

ApiContractDescriptorInput = TypedDict('ApiContractDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'viewId': Required['str'],
    'methods': Required['list[HttpMethodInput]'],
    'capabilities': NotRequired['list[str]'],
    'permissions': NotRequired['list[str]'],
    'modes': NotRequired['list[M2MCallerModeInput]'],
})

App = TypedDict('App', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'hostname': Required['str'],
    'title': Required['str'],
    'shell': Required['AppShell'],
    'routes': Required['list[AppRoute]'],
    'fragments': Required['dict[str, list[FragmentAssignment]]'],
})

AppAuthConfig = TypedDict('AppAuthConfig', {
    'serviceId': Required['str'],
    'provider': NotRequired['AppAuthProviderConfig'],
    'roleAuthority': NotRequired['AuthRoleAuthority'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['AppAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwks'],
    'roles': Required['list[AppAuthRole]'],
})

AppAuthConfigInput = TypedDict('AppAuthConfigInput', {
    'serviceId': Required['str'],
    'provider': NotRequired['AppAuthProviderConfigInput'],
    'roleAuthority': NotRequired['AuthRoleAuthorityInput'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['AppAuthRedirectsInput'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwksInput'],
    'roles': NotRequired['list[AppAuthRoleInput]'],
})

AppAuthPermissionAction: TypeAlias = "Literal['read', 'create', 'update', 'delete']"

AppAuthPermissionActionInput: TypeAlias = "Literal['read', 'create', 'update', 'delete']"

AppAuthPermissionGrant = TypedDict('AppAuthPermissionGrant', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[AppAuthPermissionAction]'],
})

AppAuthPermissionGrantInput = TypedDict('AppAuthPermissionGrantInput', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[AppAuthPermissionActionInput]'],
})

AppAuthProviderConfig: TypeAlias = 'Union[DefaultAuthProviderConfig, AuthressProviderConfig]'

AppAuthProviderConfigInput: TypeAlias = 'Union[DefaultAuthProviderConfigInput, AuthressProviderConfigInput]'

AppAuthRedirects = TypedDict('AppAuthRedirects', {
    'afterLogin': NotRequired['AppAuthViewReference'],
    'afterLogout': NotRequired['AppAuthViewReference'],
})

AppAuthRedirectsInput = TypedDict('AppAuthRedirectsInput', {
    'afterLogin': NotRequired['AppAuthViewReferenceInput'],
    'afterLogout': NotRequired['AppAuthViewReferenceInput'],
})

AppAuthRole = TypedDict('AppAuthRole', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': Required['list[AppAuthPermissionGrant]'],
})

AppAuthRoleInput = TypedDict('AppAuthRoleInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': NotRequired['list[AppAuthPermissionGrantInput]'],
})

AppAuthViewReference = TypedDict('AppAuthViewReference', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
})

AppAuthViewReferenceInput = TypedDict('AppAuthViewReferenceInput', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
})

AppInput = TypedDict('AppInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'hostname': Required['str'],
    'title': Required['str'],
    'shell': Required['AppInputShell'],
    'routes': NotRequired['list[AppRouteInput]'],
    'fragments': NotRequired['dict[str, list[FragmentAssignmentInput]]'],
})

AppInputShell = TypedDict('AppInputShell', {
    'serviceId': Required['str'],
})

AppRoute = TypedDict('AppRoute', {
    'id': Required['str'],
    'title': Required['str'],
    'path': Required['str'],
    'viewId': Required['str'],
    'serviceId': Required['str'],
    'enabled': Required['bool'],
})

AppRouteInput = TypedDict('AppRouteInput', {
    'id': Required['str'],
    'title': Required['str'],
    'path': Required['str'],
    'viewId': Required['str'],
    'serviceId': Required['str'],
    'enabled': NotRequired['bool'],
})

AppShell = TypedDict('AppShell', {
    'serviceId': Required['str'],
})

AuthAudienceRule = TypedDict('AuthAudienceRule', {
    'realm': Required['IdentityRealm'],
    'audiences': Required['list[str]'],
})

AuthAudienceRuleInput = TypedDict('AuthAudienceRuleInput', {
    'realm': Required['IdentityRealmInput'],
    'audiences': Required['list[str]'],
})

AuthProviderRuntimeMetadata = TypedDict('AuthProviderRuntimeMetadata', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwks'],
})

AuthProviderRuntimeMetadataInput = TypedDict('AuthProviderRuntimeMetadataInput', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwksInput'],
})

AuthRoleAuthority: TypeAlias = "Literal['provider', 'betterportal']"

AuthRoleAuthorityInput: TypeAlias = "Literal['provider', 'betterportal']"

AuthressProviderConfig = TypedDict('AuthressProviderConfig', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': Required['str'],
    'subjectClaimPath': Required['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

AuthressProviderConfigInput = TypedDict('AuthressProviderConfigInput', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': NotRequired['str'],
    'subjectClaimPath': NotRequired['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

BPElementReference = TypedDict('BPElementReference', {
    'service': Required['str'],
    'path': NotRequired['str'],
    'fragment': Required['str'],
    'args': Required['BPElementReferenceArgs'],
})

BPElementReferenceArgs = TypedDict('BPElementReferenceArgs', {
    'params': Required['dict[str, BetterPortalRouteChromeValue]'],
    'query': Required['dict[str, Union[BetterPortalRouteChromeValue, None]]'],
})

BPElementReferenceInput = TypedDict('BPElementReferenceInput', {
    'service': Required['str'],
    'path': NotRequired['str'],
    'fragment': Required['str'],
    'args': NotRequired['BPElementReferenceInputArgs'],
})

BPElementReferenceInputArgs = TypedDict('BPElementReferenceInputArgs', {
    'params': NotRequired['dict[str, BetterPortalRouteChromeValueInput]'],
    'query': NotRequired['dict[str, Union[BetterPortalRouteChromeValueInput, None]]'],
})

BetterPortalApp = TypedDict('BetterPortalApp', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': Required['list[str]'],
    'refererOverrides': Required['list[str]'],
    'shell': NotRequired['BetterPortalAppShell'],
    'themeConfig': Required['BetterPortalThemeConfig'],
    'layoutId': NotRequired['str'],
    'defaultRoute': Required['str'],
    'seo': NotRequired['BetterPortalSeoConfig'],
    'routes': Required['list[BetterPortalRouteMount]'],
    'menu': Required['list[BetterPortalMenuItem]'],
    'slots': Required['list[BetterPortalSlotAssignment]'],
    'fragments': Required['dict[str, list[BetterPortalFragmentAssignment]]'],
    'shellFragments': Required['dict[str, dict[str, BetterPortalShellFragmentSetting]]'],
    'auth': NotRequired['AppAuthConfig'],
    'statusViewIds': NotRequired['dict[str, str]'],
})

BetterPortalAppInput = TypedDict('BetterPortalAppInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': NotRequired['list[str]'],
    'refererOverrides': NotRequired['list[str]'],
    'shell': NotRequired['BetterPortalAppShellInput'],
    'themeConfig': NotRequired['BetterPortalThemeConfigInput'],
    'layoutId': NotRequired['str'],
    'defaultRoute': NotRequired['str'],
    'seo': NotRequired['BetterPortalSeoConfigInput'],
    'routes': NotRequired['list[BetterPortalRouteMountInput]'],
    'menu': NotRequired['list[BetterPortalMenuItemInput]'],
    'slots': NotRequired['list[BetterPortalSlotAssignmentInput]'],
    'fragments': NotRequired['dict[str, list[BetterPortalFragmentAssignmentInput]]'],
    'shellFragments': NotRequired['dict[str, dict[str, BetterPortalShellFragmentSettingInput]]'],
    'auth': NotRequired['AppAuthConfigInput'],
    'statusViewIds': NotRequired['dict[str, str]'],
})

BetterPortalAppShell = TypedDict('BetterPortalAppShell', {
    'serviceId': Required['str'],
})

BetterPortalAppShellInput = TypedDict('BetterPortalAppShellInput', {
    'serviceId': Required['str'],
})

BetterPortalBranding = TypedDict('BetterPortalBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

BetterPortalBrandingInput = TypedDict('BetterPortalBrandingInput', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

BetterPortalConfig = TypedDict('BetterPortalConfig', {
    'configManagement': Required['BetterPortalConfigManagement'],
    'platformServices': Required['list[PlatformService]'],
    'tenants': Required['list[BetterPortalTenant]'],
    'apps': Required['list[BetterPortalApp]'],
    'sharedServiceCatalog': Required['list[SharedServiceDefinition]'],
    'sharedServiceActivations': Required['list[TenantSharedServiceActivation]'],
    'manifestCache': Required['list[ServiceManifestCacheEntry]'],
    'm2m': Required['M2MConfig'],
    'previewEnvironmentGroups': Required['list[PreviewEnvironmentGroup]'],
    'previewEnvironmentDeployments': Required['list[PreviewEnvironmentDeployment]'],
    'webhooks': Required['BetterPortalConfigWebhooks'],
})

BetterPortalConfigInput = TypedDict('BetterPortalConfigInput', {
    'configManagement': NotRequired['BetterPortalConfigManagementInput'],
    'platformServices': NotRequired['list[PlatformServiceInput]'],
    'tenants': NotRequired['list[BetterPortalTenantInput]'],
    'apps': NotRequired['list[BetterPortalAppInput]'],
    'sharedServiceCatalog': NotRequired['list[SharedServiceDefinitionInput]'],
    'sharedServiceActivations': NotRequired['list[TenantSharedServiceActivationInput]'],
    'manifestCache': NotRequired['list[ServiceManifestCacheEntryInput]'],
    'm2m': NotRequired['M2MConfigInput'],
    'previewEnvironmentGroups': NotRequired['list[PreviewEnvironmentGroupInput]'],
    'previewEnvironmentDeployments': NotRequired['list[PreviewEnvironmentDeploymentInput]'],
    'webhooks': NotRequired['BetterPortalConfigInputWebhooks'],
})

BetterPortalConfigInputWebhooks = TypedDict('BetterPortalConfigInputWebhooks', {
    'targets': NotRequired['list[WebhookTargetInput]'],
})

BetterPortalConfigManagement = TypedDict('BetterPortalConfigManagement', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'auth': Required['BetterPortalConfigManagementAuth'],
})

BetterPortalConfigManagementAuth = TypedDict('BetterPortalConfigManagementAuth', {
    'mechanism': Required["Literal['none', 'dev-token', 'jwt', 'oidc']"],
    'issuer': NotRequired['str'],
    'audience': NotRequired['str'],
    'requiredPermissions': Required['list[str]'],
})

BetterPortalConfigManagementAuthInput = TypedDict('BetterPortalConfigManagementAuthInput', {
    'mechanism': NotRequired["Literal['none', 'dev-token', 'jwt', 'oidc']"],
    'issuer': NotRequired['str'],
    'audience': NotRequired['str'],
    'requiredPermissions': NotRequired['list[str]'],
})

BetterPortalConfigManagementInput = TypedDict('BetterPortalConfigManagementInput', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'auth': NotRequired['BetterPortalConfigManagementAuthInput'],
})

BetterPortalConfigWebhooks = TypedDict('BetterPortalConfigWebhooks', {
    'targets': Required['list[WebhookTarget]'],
})

BetterPortalFragmentAssignment = TypedDict('BetterPortalFragmentAssignment', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'enabled': Required['bool'],
})

BetterPortalFragmentAssignmentInput = TypedDict('BetterPortalFragmentAssignmentInput', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalJsonValue: TypeAlias = 'Union[None, bool, str, float, list[JsonValue], JsonObject]'

BetterPortalJsonValueInput: TypeAlias = 'Union[None, bool, str, float, list[JsonValueInput], JsonObjectInput]'

BetterPortalLock = TypedDict('BetterPortalLock', {
    'dependencies': Required['dict[str, LockedDependency]'],
})

BetterPortalLockInput = TypedDict('BetterPortalLockInput', {
    'dependencies': NotRequired['dict[str, LockedDependencyInput]'],
})

BetterPortalLogLevel: TypeAlias = "Literal['debug', 'info', 'warn', 'error']"

BetterPortalLogLevelInput: TypeAlias = "Literal['debug', 'info', 'warn', 'error']"

BetterPortalMenuItem = TypedDict('BetterPortalMenuItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[NoReturn]'],
})

BetterPortalMenuItemInput = TypedDict('BetterPortalMenuItemInput', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalMenuItemInputChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[NoReturn]'],
})

BetterPortalOriginPolicy = TypedDict('BetterPortalOriginPolicy', {
    'allowedOrigins': Required['list[str]'],
    'allowedReferers': Required['list[str]'],
})

BetterPortalOriginPolicyInput = TypedDict('BetterPortalOriginPolicyInput', {
    'allowedOrigins': NotRequired['list[str]'],
    'allowedReferers': NotRequired['list[str]'],
})

BetterPortalProjectConfig = TypedDict('BetterPortalProjectConfig', {
    '$schema': NotRequired['str'],
    'registryRef': NotRequired['str'],
    'defaultNamespace': NotRequired['str'],
    'dependencies': NotRequired['dict[str, str]'],
})

BetterPortalProjectConfigInput = TypedDict('BetterPortalProjectConfigInput', {
    '$schema': NotRequired['str'],
    'registryRef': NotRequired['str'],
    'defaultNamespace': NotRequired['str'],
    'dependencies': NotRequired['dict[str, str]'],
})

BetterPortalResource: TypeAlias = 'dict[str, BetterPortalRouteChromeValue]'

BetterPortalResourceInput: TypeAlias = 'dict[str, BetterPortalRouteChromeValueInput]'

BetterPortalRouteChrome: TypeAlias = 'dict[str, BetterPortalRouteChromeValue]'

BetterPortalRouteChromeInput: TypeAlias = 'dict[str, BetterPortalRouteChromeValueInput]'

BetterPortalRouteChromeValue: TypeAlias = 'Union[str, float, bool]'

BetterPortalRouteChromeValueInput: TypeAlias = 'Union[str, float, bool]'

BetterPortalRouteMount = TypedDict('BetterPortalRouteMount', {
    'id': Required['str'],
    'kind': Required["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired['list[HttpMethod]'],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': Required['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['BetterPortalRouteChrome'],
})

BetterPortalRouteMountInput = TypedDict('BetterPortalRouteMountInput', {
    'id': Required['str'],
    'kind': NotRequired["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountInputSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountInputRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired['list[HttpMethodInput]'],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['BetterPortalRouteChromeInput'],
})

BetterPortalRouteMountInputRobotsItem = TypedDict('BetterPortalRouteMountInputRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

BetterPortalRouteMountInputSitemap = TypedDict('BetterPortalRouteMountInputSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

BetterPortalRouteMountRobotsItem = TypedDict('BetterPortalRouteMountRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

BetterPortalRouteMountSitemap = TypedDict('BetterPortalRouteMountSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

BetterPortalSeoConfig = TypedDict('BetterPortalSeoConfig', {
    'visibility': Required["Literal['auto', 'public', 'private']"],
    'serviceFailure': Required["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': Required["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

BetterPortalSeoConfigInput = TypedDict('BetterPortalSeoConfigInput', {
    'visibility': NotRequired["Literal['auto', 'public', 'private']"],
    'serviceFailure': NotRequired["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': NotRequired["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

BetterPortalShellFragmentItem: TypeAlias = 'Union[BetterPortalShellFragmentItemVariant1, BetterPortalShellFragmentItemVariant2]'

BetterPortalShellFragmentItemInput: TypeAlias = 'Union[BetterPortalShellFragmentItemInputVariant1, BetterPortalShellFragmentItemInputVariant2]'

BetterPortalShellFragmentItemInputVariant1 = TypedDict('BetterPortalShellFragmentItemInputVariant1', {
    'source': Required["Literal['shell']"],
    'fragmentId': Required['str'],
})

BetterPortalShellFragmentItemInputVariant2 = TypedDict('BetterPortalShellFragmentItemInputVariant2', {
    'source': Required["Literal['service']"],
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
})

BetterPortalShellFragmentItemVariant1 = TypedDict('BetterPortalShellFragmentItemVariant1', {
    'source': Required["Literal['shell']"],
    'fragmentId': Required['str'],
})

BetterPortalShellFragmentItemVariant2 = TypedDict('BetterPortalShellFragmentItemVariant2', {
    'source': Required["Literal['service']"],
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
})

BetterPortalShellFragmentSetting: TypeAlias = 'Union[BetterPortalShellFragmentSettingVariant1, BetterPortalShellFragmentSettingVariant2, BetterPortalShellFragmentSettingVariant3]'

BetterPortalShellFragmentSettingInput: TypeAlias = 'Union[BetterPortalShellFragmentSettingInputVariant1, BetterPortalShellFragmentSettingInputVariant2, BetterPortalShellFragmentSettingInputVariant3]'

BetterPortalShellFragmentSettingInputVariant1 = TypedDict('BetterPortalShellFragmentSettingInputVariant1', {
    'mode': Required["Literal['none']"],
})

BetterPortalShellFragmentSettingInputVariant2 = TypedDict('BetterPortalShellFragmentSettingInputVariant2', {
    'mode': Required["Literal['override']"],
    'item': Required['BetterPortalShellFragmentItemInput'],
})

BetterPortalShellFragmentSettingInputVariant3 = TypedDict('BetterPortalShellFragmentSettingInputVariant3', {
    'mode': Required["Literal['items']"],
    'items': NotRequired['list[BetterPortalShellFragmentItemInput]'],
})

BetterPortalShellFragmentSettingVariant1 = TypedDict('BetterPortalShellFragmentSettingVariant1', {
    'mode': Required["Literal['none']"],
})

BetterPortalShellFragmentSettingVariant2 = TypedDict('BetterPortalShellFragmentSettingVariant2', {
    'mode': Required["Literal['override']"],
    'item': Required['BetterPortalShellFragmentItem'],
})

BetterPortalShellFragmentSettingVariant3 = TypedDict('BetterPortalShellFragmentSettingVariant3', {
    'mode': Required["Literal['items']"],
    'items': Required['list[BetterPortalShellFragmentItem]'],
})

BetterPortalSlotAssignment = TypedDict('BetterPortalSlotAssignment', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': Required['bool'],
})

BetterPortalSlotAssignmentInput = TypedDict('BetterPortalSlotAssignmentInput', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalTenant = TypedDict('BetterPortalTenant', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': Required['bool'],
    'branding': Required['BetterPortalBranding'],
    'services': Required['list[TenantServiceRegistration]'],
    'activatedPlatformServices': Required['list[str]'],
})

BetterPortalTenantInput = TypedDict('BetterPortalTenantInput', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': NotRequired['bool'],
    'branding': NotRequired['BetterPortalBrandingInput'],
    'services': NotRequired['list[TenantServiceRegistrationInput]'],
    'activatedPlatformServices': NotRequired['list[str]'],
})

BetterPortalThemeBootstrapPalette = TypedDict('BetterPortalThemeBootstrapPalette', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

BetterPortalThemeBootstrapPaletteInput = TypedDict('BetterPortalThemeBootstrapPaletteInput', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

BetterPortalThemeConfig = TypedDict('BetterPortalThemeConfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': Required["Literal['light', 'dark', 'system']"],
    'bootstrap': Required['BetterPortalThemeBootstrapPalette'],
    'light': Required['BetterPortalThemeSurface'],
    'dark': Required['BetterPortalThemeSurface'],
})

BetterPortalThemeConfigInput = TypedDict('BetterPortalThemeConfigInput', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': NotRequired["Literal['light', 'dark', 'system']"],
    'bootstrap': NotRequired['BetterPortalThemeBootstrapPaletteInput'],
    'light': NotRequired['BetterPortalThemeSurfaceInput'],
    'dark': NotRequired['BetterPortalThemeSurfaceInput'],
})

BetterPortalThemeSurface = TypedDict('BetterPortalThemeSurface', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

BetterPortalThemeSurfaceInput = TypedDict('BetterPortalThemeSurfaceInput', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

BetterPortalTraceContext = TypedDict('BetterPortalTraceContext', {
    'traceId': Required['str'],
    'spanId': Required['str'],
})

BetterPortalTraceContextInput = TypedDict('BetterPortalTraceContextInput', {
    'traceId': Required['str'],
    'spanId': Required['str'],
})

BindingRecord = TypedDict('BindingRecord', {
    'bindingId': Required['str'],
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appIds': Required['list[str]'],
    'endpointBaseUrl': Required['str'],
    'deploymentMode': Required['DeploymentMode'],
    'enabled': Required['bool'],
    'importedManifestVersion': Required['str'],
    'lastSyncAtIso': NotRequired['str'],
    'trust': Required['BindingTrust'],
})

BindingRecordInput = TypedDict('BindingRecordInput', {
    'bindingId': Required['str'],
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appIds': NotRequired['list[str]'],
    'endpointBaseUrl': Required['str'],
    'deploymentMode': Required['DeploymentModeInput'],
    'enabled': NotRequired['bool'],
    'importedManifestVersion': Required['str'],
    'lastSyncAtIso': NotRequired['str'],
    'trust': Required['BindingTrustInput'],
})

BindingTrust = TypedDict('BindingTrust', {
    'credentialId': Required['str'],
    'issuer': Required['str'],
    'audience': Required['str'],
    'scopes': Required['list[str]'],
    'rotationVersion': Required['str'],
})

BindingTrustInput = TypedDict('BindingTrustInput', {
    'credentialId': Required['str'],
    'issuer': Required['str'],
    'audience': Required['str'],
    'scopes': NotRequired['list[str]'],
    'rotationVersion': Required['str'],
})

BootstrapState = TypedDict('BootstrapState', {
    'version': Required['Literal[1]'],
    'apiKey': NotRequired['str'],
    'cpUrl': NotRequired['str'],
    'cpId': NotRequired['str'],
    'cpJwksUri': NotRequired['str'],
    'configEncryptionKey': NotRequired['str'],
    'tenantLock': NotRequired['str'],
    'installedAt': NotRequired['str'],
    'identity': NotRequired['SigningKeyPair'],
    'installation': NotRequired['ServiceInstallationBinding'],
})

BootstrapStateEnvelope = TypedDict('BootstrapStateEnvelope', {
    'v': Required['Literal[1]'],
    'iv': Required['str'],
    'tag': Required['str'],
    'ct': Required['str'],
})

BootstrapStateEnvelopeInput = TypedDict('BootstrapStateEnvelopeInput', {
    'v': Required['Literal[1]'],
    'iv': Required['str'],
    'tag': Required['str'],
    'ct': Required['str'],
})

BootstrapStateInput = TypedDict('BootstrapStateInput', {
    'version': Required['Literal[1]'],
    'apiKey': NotRequired['str'],
    'cpUrl': NotRequired['str'],
    'cpId': NotRequired['str'],
    'cpJwksUri': NotRequired['str'],
    'configEncryptionKey': NotRequired['str'],
    'tenantLock': NotRequired['str'],
    'installedAt': NotRequired['str'],
    'identity': NotRequired['SigningKeyPairInput'],
    'installation': NotRequired['ServiceInstallationBindingInput'],
})

BpSchemaOutput = TypedDict('BpSchemaOutput', {
    'manifest': Required['PluginManifest'],
    'routes': Required['list[BpSchemaRoute]'],
})

BpSchemaOutputInput = TypedDict('BpSchemaOutputInput', {
    'manifest': Required['PluginManifestInput'],
    'routes': NotRequired['list[BpSchemaRouteInput]'],
})

BpSchemaRoute = TypedDict('BpSchemaRoute', {
    'viewId': Required['str'],
    'path': Required['str'],
    'pathVariants': Required['list[str]'],
    'operations': Required['list[BpSchemaRouteOperationsItem]'],
    'paramNames': Required['list[str]'],
    'renderers': Required['list[str]'],
    'hasFragments': Required['bool'],
    'fragments': Required['list[BpSchemaRouteFragmentsItem]'],
    'components': Required['list[str]'],
})

BpSchemaRouteFragmentsItem = TypedDict('BpSchemaRouteFragmentsItem', {
    'fragmentLocation': Required['str'],
    'fragmentId': Required['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
    'renderers': Required['list[str]'],
})

BpSchemaRouteInput = TypedDict('BpSchemaRouteInput', {
    'viewId': Required['str'],
    'path': Required['str'],
    'pathVariants': NotRequired['list[str]'],
    'operations': Required['list[BpSchemaRouteInputOperationsItem]'],
    'paramNames': NotRequired['list[str]'],
    'renderers': NotRequired['list[str]'],
    'hasFragments': NotRequired['bool'],
    'fragments': NotRequired['list[BpSchemaRouteInputFragmentsItem]'],
    'components': NotRequired['list[str]'],
})

BpSchemaRouteInputFragmentsItem = TypedDict('BpSchemaRouteInputFragmentsItem', {
    'fragmentLocation': Required['str'],
    'fragmentId': Required['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
    'renderers': NotRequired['list[str]'],
})

BpSchemaRouteInputOperationsItem = TypedDict('BpSchemaRouteInputOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
})

BpSchemaRouteOperationsItem = TypedDict('BpSchemaRouteOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
})

CacheHints = TypedDict('CacheHints', {
    'ttlSeconds': Required['int'],
    'varyBy': Required['list[str]'],
})

CacheHintsInput = TypedDict('CacheHintsInput', {
    'ttlSeconds': NotRequired['int'],
    'varyBy': NotRequired['list[str]'],
})

ConfigFieldDescriptor = TypedDict('ConfigFieldDescriptor', {
    'key': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required['ConfigScope'],
    'visibility': Required['ConfigVisibility'],
    'ownership': Required['ConfigOwnership'],
    'sourceOfTruth': Required["Literal['bp', 'plugin', 'external']"],
    'groupId': NotRequired['str'],
    'order': NotRequired['int'],
    'defaultValue': NotRequired['JsonValue'],
    'ui': NotRequired['ConfigFieldUiDescriptor'],
    'required': Required['bool'],
})

ConfigFieldDescriptorInput = TypedDict('ConfigFieldDescriptorInput', {
    'key': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required['ConfigScopeInput'],
    'visibility': Required['ConfigVisibilityInput'],
    'ownership': Required['ConfigOwnershipInput'],
    'sourceOfTruth': Required["Literal['bp', 'plugin', 'external']"],
    'groupId': NotRequired['str'],
    'order': NotRequired['int'],
    'defaultValue': NotRequired['JsonValueInput'],
    'ui': NotRequired['ConfigFieldUiDescriptorInput'],
    'required': NotRequired['bool'],
})

ConfigFieldGroupDescriptor = TypedDict('ConfigFieldGroupDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'order': NotRequired['int'],
    'optional': NotRequired['bool'],
})

ConfigFieldGroupDescriptorInput = TypedDict('ConfigFieldGroupDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'order': NotRequired['int'],
    'optional': NotRequired['bool'],
})

ConfigFieldUiDescriptor = TypedDict('ConfigFieldUiDescriptor', {
    'control': NotRequired["Literal['text', 'textarea', 'password', 'number', 'checkbox', 'select', 'multiselect', 'color', 'date', 'time', 'datetime-local', 'url', 'email']"],
    'placeholder': NotRequired['str'],
    'options': NotRequired['list[ConfigFieldUiDescriptorOptionsItem]'],
    'optionsSource': NotRequired["Literal['app.routes']"],
    'min': NotRequired['Union[float, str]'],
    'max': NotRequired['Union[float, str]'],
    'step': NotRequired['float'],
    'rows': NotRequired['int'],
})

ConfigFieldUiDescriptorInput = TypedDict('ConfigFieldUiDescriptorInput', {
    'control': NotRequired["Literal['text', 'textarea', 'password', 'number', 'checkbox', 'select', 'multiselect', 'color', 'date', 'time', 'datetime-local', 'url', 'email']"],
    'placeholder': NotRequired['str'],
    'options': NotRequired['list[ConfigFieldUiDescriptorInputOptionsItem]'],
    'optionsSource': NotRequired["Literal['app.routes']"],
    'min': NotRequired['Union[float, str]'],
    'max': NotRequired['Union[float, str]'],
    'step': NotRequired['float'],
    'rows': NotRequired['int'],
})

ConfigFieldUiDescriptorInputOptionsItem = TypedDict('ConfigFieldUiDescriptorInputOptionsItem', {
    'value': Required['str'],
    'label': Required['str'],
})

ConfigFieldUiDescriptorOptionsItem = TypedDict('ConfigFieldUiDescriptorOptionsItem', {
    'value': Required['str'],
    'label': Required['str'],
})

ConfigOwnership: TypeAlias = "Literal['bp', 'plugin', 'mixed']"

ConfigOwnershipInput: TypeAlias = "Literal['bp', 'plugin', 'mixed']"

ConfigSchemaDescriptor = TypedDict('ConfigSchemaDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required['ConfigScope'],
    'jsonSchema': Required['JsonObject'],
    'groups': NotRequired['list[ConfigFieldGroupDescriptor]'],
    'fields': Required['list[ConfigFieldDescriptor]'],
})

ConfigSchemaDescriptorInput = TypedDict('ConfigSchemaDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required['ConfigScopeInput'],
    'jsonSchema': Required['JsonObjectInput'],
    'groups': NotRequired['list[ConfigFieldGroupDescriptorInput]'],
    'fields': NotRequired['list[ConfigFieldDescriptorInput]'],
})

ConfigScope: TypeAlias = "Literal['tenant', 'app']"

ConfigScopeInput: TypeAlias = "Literal['tenant', 'app']"

ConfigVisibility: TypeAlias = "Literal['public', 'protected', 'secret']"

ConfigVisibilityInput: TypeAlias = "Literal['public', 'protected', 'secret']"

ControlPlaneSubmission = TypedDict('ControlPlaneSubmission', {
    'manifestVersion': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadata'],
    'capabilities': Required['list[str]'],
    'm2mRequests': Required['list[M2MRequestDescriptor]'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'developerResources': Required['list[DeveloperResource]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'shell': NotRequired['ShellManifest'],
    'viewIndex': Required['dict[str, ControlPlaneSubmissionViewindexItem]'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ControlPlaneSubmissionInput = TypedDict('ControlPlaneSubmissionInput', {
    'manifestVersion': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadataInput'],
    'capabilities': NotRequired['list[str]'],
    'm2mRequests': NotRequired['list[M2MRequestDescriptorInput]'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'developerResources': NotRequired['list[DeveloperResourceInput]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'shell': NotRequired['ShellManifestInput'],
    'viewIndex': NotRequired['dict[str, ControlPlaneSubmissionInputViewindexItem]'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ControlPlaneSubmissionInputViewindexItem = TypedDict('ControlPlaneSubmissionInputViewindexItem', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': NotRequired['list[str]'],
    'paramsSchema': NotRequired['JsonObjectInput'],
    'operations': Required['list[ControlPlaneSubmissionInputViewindexItemOperationsItem]'],
    'fragments': NotRequired['list[ControlPlaneSubmissionInputViewindexItemFragmentsItem]'],
})

ControlPlaneSubmissionInputViewindexItemFragmentsItem = TypedDict('ControlPlaneSubmissionInputViewindexItemFragmentsItem', {
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
})

ControlPlaneSubmissionInputViewindexItemOperationsItem = TypedDict('ControlPlaneSubmissionInputViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': NotRequired['list[str]'],
    'renderModes': NotRequired['list[RenderModeInput]'],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountInputSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountInputRobotsItem]'],
    'chrome': NotRequired['BetterPortalRouteChromeInput'],
    'dependencies': NotRequired['list[OperationDependencyInput]'],
    'permissions': NotRequired['list[ControlPlaneSubmissionInputViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ControlPlaneSubmissionInputViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
})

ControlPlaneSubmissionInputViewindexItemOperationsItemPermissionsItem = TypedDict('ControlPlaneSubmissionInputViewindexItemOperationsItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': NotRequired['list[str]'],
})

ControlPlaneSubmissionInputViewindexItemOperationsItemSchemas = TypedDict('ControlPlaneSubmissionInputViewindexItemOperationsItemSchemas', {
    'query': NotRequired['JsonObjectInput'],
    'headers': NotRequired['JsonObjectInput'],
    'request': NotRequired['JsonObjectInput'],
    'multipart': NotRequired['JsonObjectInput'],
    'response': NotRequired['JsonObjectInput'],
    'metadataResponse': NotRequired['JsonObjectInput'],
})

ControlPlaneSubmissionViewindexItem = TypedDict('ControlPlaneSubmissionViewindexItem', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': Required['list[str]'],
    'paramsSchema': NotRequired['JsonObject'],
    'operations': Required['list[ControlPlaneSubmissionViewindexItemOperationsItem]'],
    'fragments': Required['list[ControlPlaneSubmissionViewindexItemFragmentsItem]'],
})

ControlPlaneSubmissionViewindexItemFragmentsItem = TypedDict('ControlPlaneSubmissionViewindexItemFragmentsItem', {
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
})

ControlPlaneSubmissionViewindexItemOperationsItem = TypedDict('ControlPlaneSubmissionViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': Required['list[str]'],
    'renderModes': Required['list[RenderMode]'],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountSitemap'],
    'robots': Required['list[BetterPortalRouteMountRobotsItem]'],
    'chrome': NotRequired['BetterPortalRouteChrome'],
    'dependencies': Required['list[OperationDependency]'],
    'permissions': Required['list[ControlPlaneSubmissionViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ControlPlaneSubmissionViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'demoScenarios': Required['list[DemoScenario]'],
})

ControlPlaneSubmissionViewindexItemOperationsItemPermissionsItem = TypedDict('ControlPlaneSubmissionViewindexItemOperationsItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[str]'],
})

ControlPlaneSubmissionViewindexItemOperationsItemSchemas = TypedDict('ControlPlaneSubmissionViewindexItemOperationsItemSchemas', {
    'query': NotRequired['JsonObject'],
    'headers': NotRequired['JsonObject'],
    'request': NotRequired['JsonObject'],
    'multipart': NotRequired['JsonObject'],
    'response': NotRequired['JsonObject'],
    'metadataResponse': NotRequired['JsonObject'],
})

CpEnvelopeClaims = TypedDict('CpEnvelopeClaims', {
    'iss': Required['str'],
    'aud': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['cp-envelope']"],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'originUserJti': NotRequired['str'],
    'cpId': Required['str'],
    'cpJwksUri': Required['str'],
})

CpEnvelopeClaimsInput = TypedDict('CpEnvelopeClaimsInput', {
    'iss': Required['str'],
    'aud': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['cp-envelope']"],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'originUserJti': NotRequired['str'],
    'cpId': Required['str'],
    'cpJwksUri': Required['str'],
})

DefaultAuthProviderConfig = TypedDict('DefaultAuthProviderConfig', {
    'kind': Required["Literal['betterportal.default']"],
})

DefaultAuthProviderConfigInput = TypedDict('DefaultAuthProviderConfigInput', {
    'kind': Required["Literal['betterportal.default']"],
})

DemoScenario = TypedDict('DemoScenario', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'match': NotRequired['DemoScenarioMatch'],
    'response': Required['JsonValue'],
})

DemoScenarioInput = TypedDict('DemoScenarioInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'match': NotRequired['DemoScenarioMatchInput'],
    'response': Required['JsonValueInput'],
})

DemoScenarioMatch = TypedDict('DemoScenarioMatch', {
    'query': NotRequired['JsonObject'],
    'params': NotRequired['JsonObject'],
    'headers': NotRequired['dict[str, str]'],
    'request': NotRequired['JsonObject'],
})

DemoScenarioMatchInput = TypedDict('DemoScenarioMatchInput', {
    'query': NotRequired['JsonObjectInput'],
    'params': NotRequired['JsonObjectInput'],
    'headers': NotRequired['dict[str, str]'],
    'request': NotRequired['JsonObjectInput'],
})

DependencyAlias: TypeAlias = 'str'

DependencyAliasInput: TypeAlias = 'str'

DeploymentMode: TypeAlias = "Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"

DeploymentModeInput: TypeAlias = "Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"

DeveloperResource = TypedDict('DeveloperResource', {
    'id': Required['str'],
    'kind': Required["Literal['guide', 'template', 'skill', 'example']"],
    'title': Required['str'],
    'description': NotRequired['str'],
    'mediaType': Required['str'],
    'language': NotRequired['str'],
    'content': Required['str'],
})

DeveloperResourceInput = TypedDict('DeveloperResourceInput', {
    'id': Required['str'],
    'kind': Required["Literal['guide', 'template', 'skill', 'example']"],
    'title': Required['str'],
    'description': NotRequired['str'],
    'mediaType': Required['str'],
    'language': NotRequired['str'],
    'content': Required['str'],
})

FragmentAssignment = TypedDict('FragmentAssignment', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'enabled': Required['bool'],
})

FragmentAssignmentInput = TypedDict('FragmentAssignmentInput', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'enabled': NotRequired['bool'],
})

HtmlRepresentationSupport = TypedDict('HtmlRepresentationSupport', {
    'renderers': Required['dict[str, ViewRendererSupport]'],
})

HtmlRepresentationSupportInput = TypedDict('HtmlRepresentationSupportInput', {
    'renderers': NotRequired['dict[str, ViewRendererSupportInput]'],
})

HttpMethod: TypeAlias = "Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"

HttpMethodInput: TypeAlias = "Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"

IdentityRealm: TypeAlias = "Literal['runtime', 'control-plane']"

IdentityRealmInput: TypeAlias = "Literal['runtime', 'control-plane']"

JsonObject: TypeAlias = 'dict[str, JsonValue]'

JsonObjectInput: TypeAlias = 'dict[str, JsonValueInput]'

JsonValue: TypeAlias = 'BetterPortalJsonValue'

JsonValueInput: TypeAlias = 'BetterPortalJsonValueInput'

JwtClaims = TypedDict('JwtClaims', {
    'iss': Required['str'],
    'aud': Required['Union[str, list[str]]'],
    'sub': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'nbf': NotRequired['int'],
    'jti': Required['str'],
    'realm': Required['IdentityRealm'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'roles': Required['list[str]'],
    'tokenType': Required['TokenType'],
    'authProvider': NotRequired['str'],
    'refreshContext': NotRequired['JsonObject'],
    'providerSubject': NotRequired['str'],
    'provider': NotRequired['JwtClaimsProvider'],
    'name': NotRequired['str'],
    'email': NotRequired['str'],
    'picture': NotRequired['str'],
})

JwtClaimsInput = TypedDict('JwtClaimsInput', {
    'iss': Required['str'],
    'aud': Required['Union[str, list[str]]'],
    'sub': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'nbf': NotRequired['int'],
    'jti': Required['str'],
    'realm': Required['IdentityRealmInput'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'roles': NotRequired['list[str]'],
    'tokenType': Required['TokenTypeInput'],
    'authProvider': NotRequired['str'],
    'refreshContext': NotRequired['JsonObjectInput'],
    'providerSubject': NotRequired['str'],
    'provider': NotRequired['JwtClaimsInputProvider'],
    'name': NotRequired['str'],
    'email': NotRequired['str'],
    'picture': NotRequired['str'],
})

JwtClaimsInputProvider = TypedDict('JwtClaimsInputProvider', {
    'username': NotRequired['str'],
    'profileUrl': NotRequired['str'],
    'accountId': NotRequired['Union[str, float]'],
    'nodeId': NotRequired['str'],
    'scope': NotRequired['str'],
})

JwtClaimsProvider = TypedDict('JwtClaimsProvider', {
    'username': NotRequired['str'],
    'profileUrl': NotRequired['str'],
    'accountId': NotRequired['Union[str, float]'],
    'nodeId': NotRequired['str'],
    'scope': NotRequired['str'],
})

LocalDependencyLock: TypeAlias = 'dict[str, LocalDependencyLockItem]'

LocalDependencyLockInput: TypeAlias = 'dict[str, LocalDependencyLockInputItem]'

LocalDependencyLockInputItem = TypedDict('LocalDependencyLockInputItem', {
    'registryRef': Required['str'],
    'pluginId': Required['str'],
    'version': Required['str'],
    'digest': Required['str'],
    'digestFormat': NotRequired["Literal['json-bytes']"],
    'path': Required['str'],
})

LocalDependencyLockItem = TypedDict('LocalDependencyLockItem', {
    'registryRef': Required['str'],
    'pluginId': Required['str'],
    'version': Required['str'],
    'digest': Required['str'],
    'digestFormat': NotRequired["Literal['json-bytes']"],
    'path': Required['str'],
})

LockedDependency = TypedDict('LockedDependency', {
    'registryRef': Required['str'],
    'pluginId': Required['str'],
    'version': Required['str'],
    'digest': Required['str'],
    'digestFormat': NotRequired["Literal['json-bytes']"],
})

LockedDependencyInput = TypedDict('LockedDependencyInput', {
    'registryRef': Required['str'],
    'pluginId': Required['str'],
    'version': Required['str'],
    'digest': Required['str'],
    'digestFormat': NotRequired["Literal['json-bytes']"],
})

M2MBinding = TypedDict('M2MBinding', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sourceServiceId': Required['str'],
    'requestId': Required['str'],
    'contractId': Required['str'],
    'targetServiceId': Required['str'],
    'targetViewId': Required['str'],
    'mode': Required["Literal['service', 'delegated']"],
    'enabled': Required['bool'],
    'createdAt': Required['str'],
})

M2MBindingInput = TypedDict('M2MBindingInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sourceServiceId': Required['str'],
    'requestId': Required['str'],
    'contractId': Required['str'],
    'targetServiceId': Required['str'],
    'targetViewId': Required['str'],
    'mode': NotRequired["Literal['service', 'delegated']"],
    'enabled': NotRequired['bool'],
    'createdAt': Required['str'],
})

M2MCallerMode: TypeAlias = "Literal['service', 'delegated']"

M2MCallerModeInput: TypeAlias = "Literal['service', 'delegated']"

M2MConfig = TypedDict('M2MConfig', {
    'bindings': Required['list[M2MBinding]'],
    'grants': Required['list[M2MGrant]'],
})

M2MConfigInput = TypedDict('M2MConfigInput', {
    'bindings': NotRequired['list[M2MBindingInput]'],
    'grants': NotRequired['list[M2MGrantInput]'],
})

M2MGrant = TypedDict('M2MGrant', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'bindingId': Required['str'],
    'methods': Required['list[HttpMethod]'],
    'permissions': Required['list[str]'],
    'enabled': Required['bool'],
    'createdAt': Required['str'],
})

M2MGrantInput = TypedDict('M2MGrantInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'bindingId': Required['str'],
    'methods': Required['list[HttpMethodInput]'],
    'permissions': NotRequired['list[str]'],
    'enabled': NotRequired['bool'],
    'createdAt': Required['str'],
})

M2MMethod: TypeAlias = "Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"

M2MMethodInput: TypeAlias = "Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"

M2MRequestDescriptor = TypedDict('M2MRequestDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'contractId': Required['str'],
    'version': NotRequired['str'],
    'requiredCapabilities': Required['list[str]'],
    'methods': Required['list[HttpMethod]'],
    'permissions': Required['list[str]'],
    'mode': Required["Literal['service', 'delegated']"],
    'optional': Required['bool'],
})

M2MRequestDescriptorInput = TypedDict('M2MRequestDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'contractId': Required['str'],
    'version': NotRequired['str'],
    'requiredCapabilities': NotRequired['list[str]'],
    'methods': Required['list[HttpMethodInput]'],
    'permissions': NotRequired['list[str]'],
    'mode': NotRequired["Literal['service', 'delegated']"],
    'optional': NotRequired['bool'],
})

ManifestDeclaration = TypedDict('ManifestDeclaration', {
    'pluginId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'version': Required['str'],
    'category': Required["Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"],
    'deploymentModes': Required['list[DeploymentMode]'],
    'capabilities': Required['list[str]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'permissions': Required['list[ViewPermissionDefinition]'],
    'adminApis': Required['list[AdminApiDescriptor]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'm2mRequests': Required['list[M2MRequestDescriptor]'],
    'developerResources': Required['list[DeveloperResource]'],
    'shell': NotRequired['ShellManifest'],
    'cacheHints': Required['ManifestDeclarationCachehints'],
})

ManifestDeclarationCachehints = TypedDict('ManifestDeclarationCachehints', {
    'metadataTtlSeconds': Required['int'],
})

ManifestDeclarationInput = TypedDict('ManifestDeclarationInput', {
    'pluginId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'version': Required['str'],
    'category': NotRequired["Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"],
    'deploymentModes': NotRequired['list[DeploymentModeInput]'],
    'capabilities': NotRequired['list[str]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'permissions': NotRequired['list[ViewPermissionDefinitionInput]'],
    'adminApis': NotRequired['list[AdminApiDescriptorInput]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'm2mRequests': NotRequired['list[M2MRequestDescriptorInput]'],
    'developerResources': NotRequired['list[DeveloperResourceInput]'],
    'shell': NotRequired['ShellManifestInput'],
    'cacheHints': NotRequired['ManifestDeclarationInputCachehints'],
})

ManifestDeclarationInputCachehints = TypedDict('ManifestDeclarationInputCachehints', {
    'metadataTtlSeconds': NotRequired['int'],
})

MultipartRequest = TypedDict('MultipartRequest', {
    'fields': Required['dict[str, Union[str, list[str]]]'],
    'files': Required['dict[str, Union[MultipartRequestFilesItemVariant1, list[MultipartRequestFilesItemVariant1]]]'],
})

MultipartRequestFilesItemVariant1 = TypedDict('MultipartRequestFilesItemVariant1', {
    'fieldName': Required['str'],
    'filename': Required['str'],
    'contentType': Required['str'],
    'size': Required['int'],
    'data': Required['list[int]'],
})

MultipartRequestInput = TypedDict('MultipartRequestInput', {
    'fields': Required['dict[str, Union[str, list[str]]]'],
    'files': Required['dict[str, Union[MultipartRequestInputFilesItemVariant1, list[MultipartRequestInputFilesItemVariant1]]]'],
})

MultipartRequestInputFilesItemVariant1 = TypedDict('MultipartRequestInputFilesItemVariant1', {
    'fieldName': Required['str'],
    'filename': Required['str'],
    'contentType': Required['str'],
    'size': Required['int'],
    'data': Required['list[int]'],
})

ObservabilityAttributes: TypeAlias = 'dict[str, BetterPortalRouteChromeValue]'

ObservabilityAttributesInput: TypeAlias = 'dict[str, BetterPortalRouteChromeValueInput]'

ObservabilityValue: TypeAlias = 'Union[str, float, bool]'

ObservabilityValueInput: TypeAlias = 'Union[str, float, bool]'

OperationDeclaration = TypedDict('OperationDeclaration', {
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
    'title': Required['str'],
    'description': Required['str'],
    'auth': Required['ApiAuthRequirement'],
    'sitemap': NotRequired['BetterPortalRouteMountSitemap'],
    'robots': Required['list[BetterPortalRouteMountRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': Required['list[OperationDependency]'],
    'chrome': NotRequired['BetterPortalRouteChrome'],
    'apiContracts': Required['list[OperationDeclarationApicontractsItem]'],
    'demoScenarios': Required['list[DemoScenario]'],
    'cacheHints': Required['OperationDeclarationCachehints'],
})

OperationDeclarationApicontractsItem = TypedDict('OperationDeclarationApicontractsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'capabilities': Required['list[str]'],
    'permissions': Required['list[str]'],
    'modes': Required['list[M2MCallerMode]'],
})

OperationDeclarationCachehints = TypedDict('OperationDeclarationCachehints', {
    'ttlSeconds': Required['int'],
    'varyBy': Required['list[str]'],
})

OperationDeclarationInput = TypedDict('OperationDeclarationInput', {
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
    'title': Required['str'],
    'description': Required['str'],
    'auth': Required['ApiAuthRequirementInput'],
    'sitemap': NotRequired['BetterPortalRouteMountInputSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountInputRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': NotRequired['list[OperationDependencyInput]'],
    'chrome': NotRequired['BetterPortalRouteChromeInput'],
    'apiContracts': NotRequired['list[OperationDeclarationInputApicontractsItem]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
    'cacheHints': NotRequired['OperationDeclarationInputCachehints'],
})

OperationDeclarationInputApicontractsItem = TypedDict('OperationDeclarationInputApicontractsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'capabilities': NotRequired['list[str]'],
    'permissions': NotRequired['list[str]'],
    'modes': NotRequired['list[M2MCallerModeInput]'],
})

OperationDeclarationInputCachehints = TypedDict('OperationDeclarationInputCachehints', {
    'ttlSeconds': NotRequired['int'],
    'varyBy': NotRequired['list[str]'],
})

OperationDependency = TypedDict('OperationDependency', {
    'serviceId': NotRequired['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
})

OperationDependencyInput = TypedDict('OperationDependencyInput', {
    'serviceId': NotRequired['str'],
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
})

PersistedServiceConfigState = TypedDict('PersistedServiceConfigState', {
    'tenants': Required['dict[str, ServiceConfigState]'],
    'legacy': NotRequired['ServiceConfigState'],
})

PersistedServiceConfigStateInput = TypedDict('PersistedServiceConfigStateInput', {
    'tenants': NotRequired['dict[str, ServiceConfigStateInput]'],
    'legacy': NotRequired['ServiceConfigStateInput'],
})

PlatformService = TypedDict('PlatformService', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadata'],
    'capabilities': Required['list[str]'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'category': NotRequired['str'],
    'createdAt': Required['str'],
    'enabled': Required['bool'],
})

PlatformServiceInput = TypedDict('PlatformServiceInput', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadataInput'],
    'capabilities': NotRequired['list[str]'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'category': NotRequired['str'],
    'createdAt': Required['str'],
    'enabled': NotRequired['bool'],
})

PluginCategory: TypeAlias = "Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"

PluginCategoryInput: TypeAlias = "Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"

PluginId: TypeAlias = 'str'

PluginIdInput: TypeAlias = 'str'

PluginManifest = TypedDict('PluginManifest', {
    'protocolVersion': Required['Literal[2]'],
    'pluginId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'version': Required['str'],
    'category': Required['PluginCategory'],
    'deploymentModes': Required['list[DeploymentMode]'],
    'capabilities': Required['list[str]'],
    'supportedRenderers': Required['list[str]'],
    'supportedRenderModes': Required['list[RenderMode]'],
    'views': Required['list[ViewMetadata]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'permissions': Required['list[ViewPermissionDefinition]'],
    'adminApis': Required['list[AdminApiDescriptor]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'm2mRequests': Required['list[M2MRequestDescriptor]'],
    'developerResources': Required['list[DeveloperResource]'],
    'shell': NotRequired['ShellManifest'],
    'cacheHints': Required['ManifestDeclarationCachehints'],
})

PluginManifestInput = TypedDict('PluginManifestInput', {
    'protocolVersion': Required['Literal[2]'],
    'pluginId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'version': Required['str'],
    'category': Required['PluginCategoryInput'],
    'deploymentModes': Required['list[DeploymentModeInput]'],
    'capabilities': NotRequired['list[str]'],
    'supportedRenderers': NotRequired['list[str]'],
    'supportedRenderModes': NotRequired['list[RenderModeInput]'],
    'views': NotRequired['list[ViewMetadataInput]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'permissions': NotRequired['list[ViewPermissionDefinitionInput]'],
    'adminApis': NotRequired['list[AdminApiDescriptorInput]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'm2mRequests': NotRequired['list[M2MRequestDescriptorInput]'],
    'developerResources': NotRequired['list[DeveloperResourceInput]'],
    'shell': NotRequired['ShellManifestInput'],
    'cacheHints': NotRequired['ManifestDeclarationInputCachehints'],
})

PreviewEnvironmentDeployment = TypedDict('PreviewEnvironmentDeployment', {
    'credentialReplay': NotRequired['PreviewEnvironmentDeploymentCredentialreplay'],
    'id': Required['str'],
    'groupId': Required['str'],
    'key': Required['str'],
    'name': Required['str'],
    'hostname': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'expiresInDays': Required['Union[int, None]'],
    'expiresAt': NotRequired['str'],
    'services': Required['list[PreviewEnvironmentDeploymentService]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

PreviewEnvironmentDeploymentCredentialreplay = TypedDict('PreviewEnvironmentDeploymentCredentialreplay', {
    'requestHash': Required['str'],
    'ciphertext': Required['str'],
    'expiresAt': Required['str'],
})

PreviewEnvironmentDeploymentInput = TypedDict('PreviewEnvironmentDeploymentInput', {
    'credentialReplay': NotRequired['PreviewEnvironmentDeploymentInputCredentialreplay'],
    'id': Required['str'],
    'groupId': Required['str'],
    'key': Required['str'],
    'name': Required['str'],
    'hostname': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'expiresInDays': Required['Union[int, None]'],
    'expiresAt': NotRequired['str'],
    'services': Required['list[PreviewEnvironmentDeploymentServiceInput]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

PreviewEnvironmentDeploymentInputCredentialreplay = TypedDict('PreviewEnvironmentDeploymentInputCredentialreplay', {
    'requestHash': Required['str'],
    'ciphertext': Required['str'],
    'expiresAt': Required['str'],
})

PreviewEnvironmentDeploymentService = TypedDict('PreviewEnvironmentDeploymentService', {
    'serviceId': Required['str'],
    'instanceId': Required['str'],
    'url': Required['str'],
})

PreviewEnvironmentDeploymentServiceInput = TypedDict('PreviewEnvironmentDeploymentServiceInput', {
    'serviceId': Required['str'],
    'instanceId': Required['str'],
    'url': Required['str'],
})

PreviewEnvironmentGroup = TypedDict('PreviewEnvironmentGroup', {
    'id': Required['str'],
    'name': Required['str'],
    'sourceTenantId': Required['str'],
    'sourceAppId': Required['str'],
    'expiresInDays': Required['Union[int, None]'],
    'elevatedRoleIds': Required['list[str]'],
    'apiKeyHash': Required['str'],
    'oidc': NotRequired['PreviewEnvironmentOidc'],
    'services': Required['list[PreviewEnvironmentGroupService]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

PreviewEnvironmentGroupInput = TypedDict('PreviewEnvironmentGroupInput', {
    'id': Required['str'],
    'name': Required['str'],
    'sourceTenantId': Required['str'],
    'sourceAppId': Required['str'],
    'expiresInDays': NotRequired['Union[int, None]'],
    'elevatedRoleIds': NotRequired['list[str]'],
    'apiKeyHash': Required['str'],
    'oidc': NotRequired['PreviewEnvironmentOidcInput'],
    'services': NotRequired['list[PreviewEnvironmentGroupServiceInput]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

PreviewEnvironmentGroupService = TypedDict('PreviewEnvironmentGroupService', {
    'serviceId': Required['str'],
    'title': NotRequired['str'],
    'config': Required['PreviewEnvironmentServiceConfig'],
})

PreviewEnvironmentGroupServiceInput = TypedDict('PreviewEnvironmentGroupServiceInput', {
    'serviceId': Required['str'],
    'title': NotRequired['str'],
    'config': NotRequired['PreviewEnvironmentServiceConfigInput'],
})

PreviewEnvironmentOidc = TypedDict('PreviewEnvironmentOidc', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'subjectPrefix': NotRequired['str'],
    'requiredClaims': Required['dict[str, str]'],
})

PreviewEnvironmentOidcInput = TypedDict('PreviewEnvironmentOidcInput', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'subjectPrefix': NotRequired['str'],
    'requiredClaims': NotRequired['dict[str, str]'],
})

PreviewEnvironmentServiceConfig = TypedDict('PreviewEnvironmentServiceConfig', {
    'tenant': Required['dict[str, JsonValue]'],
    'app': Required['dict[str, JsonValue]'],
})

PreviewEnvironmentServiceConfigInput = TypedDict('PreviewEnvironmentServiceConfigInput', {
    'tenant': NotRequired['dict[str, JsonValueInput]'],
    'app': NotRequired['dict[str, JsonValueInput]'],
})

PublicJwks = TypedDict('PublicJwks', {
    'keys': Required['list[RsaPublicJwk]'],
})

PublicJwksInput = TypedDict('PublicJwksInput', {
    'keys': Required['list[RsaPublicJwkInput]'],
})

RegistryReference: TypeAlias = 'str'

RegistryReferenceInput: TypeAlias = 'str'

RenderMode: TypeAlias = "Literal['page', 'fragment', 'embed']"

RenderModeInput: TypeAlias = "Literal['page', 'fragment', 'embed']"

RendererDeclaration = TypedDict('RendererDeclaration', {
    'renderer': Required['str'],
    'kind': Required["Literal['page', 'fragment', 'component']"],
    'key': NotRequired['str'],
    'status': Required['int'],
})

RendererDeclarationInput = TypedDict('RendererDeclarationInput', {
    'renderer': Required['str'],
    'kind': NotRequired["Literal['page', 'fragment', 'component']"],
    'key': NotRequired['str'],
    'status': NotRequired['int'],
})

ResolvedBPElementReference = TypedDict('ResolvedBPElementReference', {
    'url': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'unavailable': NotRequired['str'],
})

ResolvedBPElementReferenceInput = TypedDict('ResolvedBPElementReferenceInput', {
    'url': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'unavailable': NotRequired['str'],
})

RouteUiOptions = TypedDict('RouteUiOptions', {
    'serviceId': NotRequired['str'],
    'params': Required['dict[str, Union[BetterPortalRouteChromeValue, None]]'],
    'query': Required['dict[str, Union[BetterPortalRouteChromeValue, None]]'],
    'absolute': Required['bool'],
    'origin': NotRequired['str'],
    'component': NotRequired['str'],
    'fragment': NotRequired['str'],
    'sse': Required['bool'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'target': NotRequired['str'],
    'swap': NotRequired['str'],
    'push': NotRequired['Union[str, bool]'],
})

RouteUiOptionsInput = TypedDict('RouteUiOptionsInput', {
    'serviceId': NotRequired['str'],
    'params': NotRequired['dict[str, Union[BetterPortalRouteChromeValueInput, None]]'],
    'query': NotRequired['dict[str, Union[BetterPortalRouteChromeValueInput, None]]'],
    'absolute': NotRequired['bool'],
    'origin': NotRequired['str'],
    'component': NotRequired['str'],
    'fragment': NotRequired['str'],
    'sse': NotRequired['bool'],
    'method': NotRequired["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'target': NotRequired['str'],
    'swap': NotRequired['str'],
    'push': NotRequired['Union[str, bool]'],
})

RouteUrlOptions = TypedDict('RouteUrlOptions', {
    'serviceId': NotRequired['str'],
    'params': Required['dict[str, Union[BetterPortalRouteChromeValue, None]]'],
    'query': Required['dict[str, Union[BetterPortalRouteChromeValue, None]]'],
    'absolute': Required['bool'],
    'origin': NotRequired['str'],
    'component': NotRequired['str'],
    'fragment': NotRequired['str'],
    'sse': Required['bool'],
})

RouteUrlOptionsInput = TypedDict('RouteUrlOptionsInput', {
    'serviceId': NotRequired['str'],
    'params': NotRequired['dict[str, Union[BetterPortalRouteChromeValueInput, None]]'],
    'query': NotRequired['dict[str, Union[BetterPortalRouteChromeValueInput, None]]'],
    'absolute': NotRequired['bool'],
    'origin': NotRequired['str'],
    'component': NotRequired['str'],
    'fragment': NotRequired['str'],
    'sse': NotRequired['bool'],
})

RsaPublicJwk = TypedDict('RsaPublicJwk', {
    'kty': Required["Literal['RSA']"],
    'use': Required["Literal['sig']"],
    'alg': Required["Literal['RS256']"],
    'kid': Required['str'],
    'n': Required['str'],
    'e': Required['str'],
})

RsaPublicJwkInput = TypedDict('RsaPublicJwkInput', {
    'kty': Required["Literal['RSA']"],
    'use': Required["Literal['sig']"],
    'alg': Required["Literal['RS256']"],
    'kid': Required['str'],
    'n': Required['str'],
    'e': Required['str'],
})

ScopedApp = TypedDict('ScopedApp', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': Required['list[str]'],
    'refererOverrides': Required['list[str]'],
    'themeConfig': Required['ScopedAppThemeconfig'],
    'defaultRoute': Required['str'],
    'seo': NotRequired['ScopedAppSeo'],
    'routes': Required['list[ScopedAppRoutesItem]'],
    'menu': Required['list[ScopedAppMenuItem]'],
    'slots': Required['list[ScopedAppSlotsItem]'],
    'fragments': Required['dict[str, list[BetterPortalFragmentAssignment]]'],
    'shellFragments': Required['dict[str, dict[str, BetterPortalShellFragmentSetting]]'],
    'auth': NotRequired['ScopedAppAuth'],
    'shell': NotRequired['ScopedAppShell'],
    'appRoutes': NotRequired['list[BetterPortalRouteMount]'],
    'appFragments': NotRequired['dict[str, list[BetterPortalFragmentAssignment]]'],
})

ScopedAppAuth = TypedDict('ScopedAppAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[DefaultAuthProviderConfig, ScopedAppAuthProviderVariant2]'],
    'roleAuthority': NotRequired['AuthRoleAuthority'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['ScopedAppAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwks'],
    'roles': Required['list[ScopedAppAuthRolesItem]'],
})

ScopedAppAuthProviderVariant2 = TypedDict('ScopedAppAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': Required['str'],
    'subjectClaimPath': Required['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

ScopedAppAuthRedirects = TypedDict('ScopedAppAuthRedirects', {
    'afterLogin': NotRequired['AppAuthViewReference'],
    'afterLogout': NotRequired['AppAuthViewReference'],
})

ScopedAppAuthRolesItem = TypedDict('ScopedAppAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': Required['list[AppAuthPermissionGrant]'],
})

ScopedAppInput = TypedDict('ScopedAppInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': NotRequired['list[str]'],
    'refererOverrides': NotRequired['list[str]'],
    'themeConfig': NotRequired['ScopedAppInputThemeconfig'],
    'defaultRoute': NotRequired['str'],
    'seo': NotRequired['ScopedAppInputSeo'],
    'routes': NotRequired['list[ScopedAppInputRoutesItem]'],
    'menu': NotRequired['list[ScopedAppInputMenuItem]'],
    'slots': NotRequired['list[ScopedAppInputSlotsItem]'],
    'fragments': NotRequired['dict[str, list[BetterPortalFragmentAssignmentInput]]'],
    'shellFragments': NotRequired['dict[str, dict[str, BetterPortalShellFragmentSettingInput]]'],
    'auth': NotRequired['ScopedAppInputAuth'],
    'shell': NotRequired['ScopedAppInputShell'],
    'appRoutes': NotRequired['list[BetterPortalRouteMountInput]'],
    'appFragments': NotRequired['dict[str, list[BetterPortalFragmentAssignmentInput]]'],
})

ScopedAppInputAuth = TypedDict('ScopedAppInputAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[DefaultAuthProviderConfigInput, ScopedAppInputAuthProviderVariant2]'],
    'roleAuthority': NotRequired['AuthRoleAuthorityInput'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['ScopedAppInputAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwksInput'],
    'roles': NotRequired['list[ScopedAppInputAuthRolesItem]'],
})

ScopedAppInputAuthProviderVariant2 = TypedDict('ScopedAppInputAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': NotRequired['str'],
    'subjectClaimPath': NotRequired['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

ScopedAppInputAuthRedirects = TypedDict('ScopedAppInputAuthRedirects', {
    'afterLogin': NotRequired['AppAuthViewReferenceInput'],
    'afterLogout': NotRequired['AppAuthViewReferenceInput'],
})

ScopedAppInputAuthRolesItem = TypedDict('ScopedAppInputAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': NotRequired['list[AppAuthPermissionGrantInput]'],
})

ScopedAppInputMenuItem = TypedDict('ScopedAppInputMenuItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppInputMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': NotRequired["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'serviceStatus': NotRequired["Literal['show', 'hide']"],
    'authStatus': NotRequired["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': NotRequired['list[NoReturn]'],
})

ScopedAppInputRoutesItem = TypedDict('ScopedAppInputRoutesItem', {
    'id': Required['str'],
    'kind': NotRequired["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['ScopedAppInputRoutesItemSitemap'],
    'robots': NotRequired['list[ScopedAppInputRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired['list[HttpMethodInput]'],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, BetterPortalRouteChromeValueInput]'],
})

ScopedAppInputRoutesItemRobotsItem = TypedDict('ScopedAppInputRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

ScopedAppInputRoutesItemSitemap = TypedDict('ScopedAppInputRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

ScopedAppInputSeo = TypedDict('ScopedAppInputSeo', {
    'visibility': NotRequired["Literal['auto', 'public', 'private']"],
    'serviceFailure': NotRequired["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': NotRequired["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

ScopedAppInputShell = TypedDict('ScopedAppInputShell', {
    'serviceId': Required['str'],
    'service': Required['str'],
    'renderer': Required['str'],
})

ScopedAppInputSlotsItem = TypedDict('ScopedAppInputSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

ScopedAppInputThemeconfig = TypedDict('ScopedAppInputThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': NotRequired["Literal['light', 'dark', 'system']"],
    'bootstrap': NotRequired['ScopedAppInputThemeconfigBootstrap'],
    'light': NotRequired['ScopedAppInputThemeconfigLight'],
    'dark': NotRequired['ScopedAppInputThemeconfigLight'],
})

ScopedAppInputThemeconfigBootstrap = TypedDict('ScopedAppInputThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

ScopedAppInputThemeconfigLight = TypedDict('ScopedAppInputThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

ScopedAppMenuItem = TypedDict('ScopedAppMenuItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
    'id': Required['str'],
    'type': Required["Literal['link', 'group', 'section', 'divider', 'external']"],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'routeId': NotRequired['str'],
    'href': NotRequired['str'],
    'enabled': Required['bool'],
    'serviceStatus': Required["Literal['show', 'hide']"],
    'authStatus': Required["Literal['show', 'hide-unauthenticated', 'hide-unauthorized']"],
    'defaultExpanded': NotRequired['bool'],
    'children': Required['list[NoReturn]'],
})

ScopedAppRoutesItem = TypedDict('ScopedAppRoutesItem', {
    'id': Required['str'],
    'kind': Required["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['ScopedAppRoutesItemSitemap'],
    'robots': NotRequired['list[ScopedAppRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired['list[HttpMethod]'],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': Required['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, BetterPortalRouteChromeValue]'],
})

ScopedAppRoutesItemRobotsItem = TypedDict('ScopedAppRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

ScopedAppRoutesItemSitemap = TypedDict('ScopedAppRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

ScopedAppSeo = TypedDict('ScopedAppSeo', {
    'visibility': Required["Literal['auto', 'public', 'private']"],
    'serviceFailure': Required["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': Required["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

ScopedAppShell = TypedDict('ScopedAppShell', {
    'serviceId': Required['str'],
    'service': Required['str'],
    'renderer': Required['str'],
})

ScopedAppSlotsItem = TypedDict('ScopedAppSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': Required['bool'],
})

ScopedAppThemeconfig = TypedDict('ScopedAppThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': Required["Literal['light', 'dark', 'system']"],
    'bootstrap': Required['ScopedAppThemeconfigBootstrap'],
    'light': Required['ScopedAppThemeconfigLight'],
    'dark': Required['ScopedAppThemeconfigLight'],
})

ScopedAppThemeconfigBootstrap = TypedDict('ScopedAppThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

ScopedAppThemeconfigLight = TypedDict('ScopedAppThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

ScopedServiceConfig = TypedDict('ScopedServiceConfig', {
    'serviceIdentity': NotRequired['ScopedServiceConfigServiceidentity'],
    'm2m': NotRequired['ScopedServiceConfigM2m'],
    'previewConfig': NotRequired['ScopedServiceConfigPreviewconfig'],
    'configManagement': NotRequired['ScopedServiceConfigConfigmanagement'],
    'managementOrigins': Required['list[str]'],
    'tenants': Required['list[ScopedTenant]'],
    'configApps': NotRequired['list[ScopedServiceConfigConfigappsItem]'],
    'apps': Required['list[ScopedApp]'],
})

ScopedServiceConfigConfigappsItem = TypedDict('ScopedServiceConfigConfigappsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'title': Required['str'],
})

ScopedServiceConfigConfigmanagement = TypedDict('ScopedServiceConfigConfigmanagement', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'context': NotRequired['ScopedServiceConfigConfigmanagementContext'],
})

ScopedServiceConfigConfigmanagementContext = TypedDict('ScopedServiceConfigConfigmanagementContext', {
    'tenant': Required['ScopedTenant'],
    'app': Required['ScopedApp'],
})

ScopedServiceConfigInput = TypedDict('ScopedServiceConfigInput', {
    'serviceIdentity': NotRequired['ScopedServiceConfigInputServiceidentity'],
    'm2m': NotRequired['ScopedServiceConfigInputM2m'],
    'previewConfig': NotRequired['ScopedServiceConfigInputPreviewconfig'],
    'configManagement': NotRequired['ScopedServiceConfigInputConfigmanagement'],
    'managementOrigins': Required['list[str]'],
    'tenants': Required['list[ScopedTenantInput]'],
    'configApps': NotRequired['list[ScopedServiceConfigInputConfigappsItem]'],
    'apps': Required['list[ScopedAppInput]'],
})

ScopedServiceConfigInputConfigappsItem = TypedDict('ScopedServiceConfigInputConfigappsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'title': Required['str'],
})

ScopedServiceConfigInputConfigmanagement = TypedDict('ScopedServiceConfigInputConfigmanagement', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'context': NotRequired['ScopedServiceConfigInputConfigmanagementContext'],
})

ScopedServiceConfigInputConfigmanagementContext = TypedDict('ScopedServiceConfigInputConfigmanagementContext', {
    'tenant': Required['ScopedTenantInput'],
    'app': Required['ScopedAppInput'],
})

ScopedServiceConfigInputM2m = TypedDict('ScopedServiceConfigInputM2m', {
    'localServiceIds': Required['list[str]'],
    'services': Required['list[ScopedServiceConfigInputM2mServicesItem]'],
    'bindings': Required['list[M2MBindingInput]'],
    'grants': Required['list[M2MGrantInput]'],
})

ScopedServiceConfigInputM2mServicesItem = TypedDict('ScopedServiceConfigInputM2mServicesItem', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ScopedServiceConfigInputPreviewconfig = TypedDict('ScopedServiceConfigInputPreviewconfig', {
    'revision': Required['str'],
    'tenant': Required['JsonObjectInput'],
    'app': Required['JsonObjectInput'],
})

ScopedServiceConfigInputServiceidentity = TypedDict('ScopedServiceConfigInputServiceidentity', {
    'id': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ScopedServiceConfigM2m = TypedDict('ScopedServiceConfigM2m', {
    'localServiceIds': Required['list[str]'],
    'services': Required['list[ScopedServiceConfigM2mServicesItem]'],
    'bindings': Required['list[M2MBinding]'],
    'grants': Required['list[M2MGrant]'],
})

ScopedServiceConfigM2mServicesItem = TypedDict('ScopedServiceConfigM2mServicesItem', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ScopedServiceConfigPreviewconfig = TypedDict('ScopedServiceConfigPreviewconfig', {
    'revision': Required['str'],
    'tenant': Required['JsonObject'],
    'app': Required['JsonObject'],
})

ScopedServiceConfigServiceidentity = TypedDict('ScopedServiceConfigServiceidentity', {
    'id': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
})

ScopedTenant = TypedDict('ScopedTenant', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': Required['bool'],
    'branding': Required['ScopedTenantBranding'],
    'activatedPlatformServices': Required['list[str]'],
    'services': Required['list[ScopedTenantService]'],
})

ScopedTenantBranding = TypedDict('ScopedTenantBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

ScopedTenantInput = TypedDict('ScopedTenantInput', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': NotRequired['bool'],
    'branding': NotRequired['ScopedTenantInputBranding'],
    'activatedPlatformServices': NotRequired['list[str]'],
    'services': Required['list[ScopedTenantServiceInput]'],
})

ScopedTenantInputBranding = TypedDict('ScopedTenantInputBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

ScopedTenantService = TypedDict('ScopedTenantService', {
    'id': Required['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['ScopedTenantServiceAuthprovider'],
    'capabilities': Required['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': Required["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': Required['bool'],
    'source': NotRequired["Literal['tenant', 'platform', 'shared']"],
    'sharedServiceId': NotRequired['str'],
    'baseUrl': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': NotRequired['list[str]'],
})

ScopedTenantServiceAuthprovider = TypedDict('ScopedTenantServiceAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwks'],
})

ScopedTenantServiceInput = TypedDict('ScopedTenantServiceInput', {
    'id': Required['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['ScopedTenantServiceInputAuthprovider'],
    'capabilities': NotRequired['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': NotRequired["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'source': NotRequired["Literal['tenant', 'platform', 'shared']"],
    'sharedServiceId': NotRequired['str'],
    'baseUrl': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': NotRequired['list[str]'],
})

ScopedTenantServiceInputAuthprovider = TypedDict('ScopedTenantServiceInputAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['PublicJwksInput'],
})

Semver: TypeAlias = 'str'

SemverInput: TypeAlias = 'str'

ServiceCatalogEntry = TypedDict('ServiceCatalogEntry', {
    'serviceId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'category': Required["Literal['utility', 'integration', 'theme', 'auth', 'service']"],
    'manifestUrl': Required['str'],
    'defaultEndpointBaseUrl': Required['str'],
    'deploymentModes': Required['list[DeploymentMode]'],
    'tenantConfigSchemas': Required['list[ConfigSchemaDescriptor]'],
    'appConfigSchemas': Required['list[ConfigSchemaDescriptor]'],
    'hostedByBetterPortal': Required['bool'],
})

ServiceCatalogEntryInput = TypedDict('ServiceCatalogEntryInput', {
    'serviceId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'category': Required["Literal['utility', 'integration', 'theme', 'auth', 'service']"],
    'manifestUrl': Required['str'],
    'defaultEndpointBaseUrl': Required['str'],
    'deploymentModes': Required['list[DeploymentModeInput]'],
    'tenantConfigSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'appConfigSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'hostedByBetterPortal': NotRequired['bool'],
})

ServiceConfigAction: TypeAlias = "Literal['schema.read', 'config.read', 'config.write']"

ServiceConfigActionInput: TypeAlias = "Literal['schema.read', 'config.read', 'config.write']"

ServiceConfigManagementMode: TypeAlias = "Literal['static', 'bp-managed', 'hybrid']"

ServiceConfigManagementModeInput: TypeAlias = "Literal['static', 'bp-managed', 'hybrid']"

ServiceConfigReadResponse = TypedDict('ServiceConfigReadResponse', {
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObject'],
})

ServiceConfigReadResponseInput = TypedDict('ServiceConfigReadResponseInput', {
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObjectInput'],
})

ServiceConfigSchemaResponse = TypedDict('ServiceConfigSchemaResponse', {
    'serviceId': Required['str'],
    'mode': Required['ServiceConfigManagementMode'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'supportsCustomUi': Required['bool'],
    'customUiPath': NotRequired['str'],
    'supportsWrite': Required['bool'],
})

ServiceConfigSchemaResponseInput = TypedDict('ServiceConfigSchemaResponseInput', {
    'serviceId': Required['str'],
    'mode': Required['ServiceConfigManagementModeInput'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'supportsCustomUi': NotRequired['bool'],
    'customUiPath': NotRequired['str'],
    'supportsWrite': NotRequired['bool'],
})

ServiceConfigState = TypedDict('ServiceConfigState', {
    'tenant': Required['dict[str, JsonValue]'],
    'app': Required['dict[str, JsonObject]'],
})

ServiceConfigStateInput = TypedDict('ServiceConfigStateInput', {
    'tenant': NotRequired['dict[str, JsonValueInput]'],
    'app': NotRequired['dict[str, JsonObjectInput]'],
})

ServiceConfigTicketClaims = TypedDict('ServiceConfigTicketClaims', {
    'iss': Required['str'],
    'aud': Required['Union[str, list[str]]'],
    'sub': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'realm': Required["Literal['control-plane']"],
    'tenantId': Required['str'],
    'serviceId': Required['str'],
    'bindingId': NotRequired['str'],
    'actions': Required['list[ServiceConfigAction]'],
})

ServiceConfigTicketClaimsInput = TypedDict('ServiceConfigTicketClaimsInput', {
    'iss': Required['str'],
    'aud': Required['Union[str, list[str]]'],
    'sub': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'realm': Required["Literal['control-plane']"],
    'tenantId': Required['str'],
    'serviceId': Required['str'],
    'bindingId': NotRequired['str'],
    'actions': Required['list[ServiceConfigActionInput]'],
})

ServiceConfigWriteRequest = TypedDict('ServiceConfigWriteRequest', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObject'],
    'clearKeys': Required['list[str]'],
})

ServiceConfigWriteRequestInput = TypedDict('ServiceConfigWriteRequestInput', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObjectInput'],
    'clearKeys': NotRequired['list[str]'],
})

ServiceConfigWriteResponse = TypedDict('ServiceConfigWriteResponse', {
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObject'],
    'ok': Required['Literal[True]'],
})

ServiceConfigWriteResponseInput = TypedDict('ServiceConfigWriteResponseInput', {
    'serviceId': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'values': Required['JsonObjectInput'],
    'ok': Required['Literal[True]'],
})

ServiceHostnameChangeRequest = TypedDict('ServiceHostnameChangeRequest', {
    'changeToken': Required['str'],
})

ServiceHostnameChangeRequestInput = TypedDict('ServiceHostnameChangeRequestInput', {
    'changeToken': Required['str'],
})

ServiceHostnameChangeResponse = TypedDict('ServiceHostnameChangeResponse', {
    'ok': Required['Literal[True]'],
    'serviceUrl': Required['str'],
})

ServiceHostnameChangeResponseInput = TypedDict('ServiceHostnameChangeResponseInput', {
    'ok': Required['Literal[True]'],
    'serviceUrl': Required['str'],
})

ServiceInstallRequest = TypedDict('ServiceInstallRequest', {
    'setupToken': Required['str'],
    'cpUrl': Required['str'],
})

ServiceInstallRequestInput = TypedDict('ServiceInstallRequestInput', {
    'setupToken': Required['str'],
    'cpUrl': Required['str'],
})

ServiceInstallResponse = TypedDict('ServiceInstallResponse', {
    'ok': Required['Literal[True]'],
    'pluginId': Required['str'],
    'cpUrl': Required['str'],
    'manifestVersion': Required['str'],
    'apiKey': NotRequired['str'],
})

ServiceInstallResponseInput = TypedDict('ServiceInstallResponseInput', {
    'ok': Required['Literal[True]'],
    'pluginId': Required['str'],
    'cpUrl': Required['str'],
    'manifestVersion': Required['str'],
    'apiKey': NotRequired['str'],
})

ServiceInstallationBinding = TypedDict('ServiceInstallationBinding', {
    'instanceId': Required['str'],
    'serviceUrl': Required['str'],
    'cpUrl': Required['str'],
    'cpJwksUri': Required['str'],
    'scope': NotRequired['ServiceInstallationBindingScope'],
    'jti': Required['str'],
})

ServiceInstallationBindingInput = TypedDict('ServiceInstallationBindingInput', {
    'instanceId': Required['str'],
    'serviceUrl': Required['str'],
    'cpUrl': Required['str'],
    'cpJwksUri': Required['str'],
    'scope': NotRequired['ServiceInstallationBindingInputScope'],
    'jti': Required['str'],
})

ServiceInstallationBindingInputScope = TypedDict('ServiceInstallationBindingInputScope', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
})

ServiceInstallationBindingScope = TypedDict('ServiceInstallationBindingScope', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
})

ServiceManifestCacheEntry = TypedDict('ServiceManifestCacheEntry', {
    'serviceId': Required['str'],
    'manifestVersion': Required['str'],
    'fetchedAt': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadata'],
    'capabilities': Required['list[str]'],
    'm2mRequests': Required['list[M2MRequestDescriptor]'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'developerResources': Required['list[DeveloperResource]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'shell': NotRequired['ShellManifest'],
    'viewIndex': Required['dict[str, ServiceManifestCacheEntryViewindexItem]'],
})

ServiceManifestCacheEntryInput = TypedDict('ServiceManifestCacheEntryInput', {
    'serviceId': Required['str'],
    'manifestVersion': Required['str'],
    'fetchedAt': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadataInput'],
    'capabilities': NotRequired['list[str]'],
    'm2mRequests': NotRequired['list[M2MRequestDescriptorInput]'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'developerResources': NotRequired['list[DeveloperResourceInput]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'shell': NotRequired['ShellManifestInput'],
    'viewIndex': NotRequired['dict[str, ServiceManifestCacheEntryInputViewindexItem]'],
})

ServiceManifestCacheEntryInputViewindexItem = TypedDict('ServiceManifestCacheEntryInputViewindexItem', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': NotRequired['list[str]'],
    'paramsSchema': NotRequired['JsonObjectInput'],
    'operations': Required['list[ServiceManifestCacheEntryInputViewindexItemOperationsItem]'],
    'fragments': NotRequired['list[ControlPlaneSubmissionInputViewindexItemFragmentsItem]'],
})

ServiceManifestCacheEntryInputViewindexItemOperationsItem = TypedDict('ServiceManifestCacheEntryInputViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': NotRequired['list[str]'],
    'renderModes': NotRequired['list[RenderModeInput]'],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountInputSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountInputRobotsItem]'],
    'chrome': NotRequired['BetterPortalRouteChromeInput'],
    'dependencies': NotRequired['list[OperationDependencyInput]'],
    'permissions': NotRequired['list[ControlPlaneSubmissionInputViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ServiceManifestCacheEntryInputViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
})

ServiceManifestCacheEntryInputViewindexItemOperationsItemSchemas = TypedDict('ServiceManifestCacheEntryInputViewindexItemOperationsItemSchemas', {
    'query': NotRequired['JsonObjectInput'],
    'headers': NotRequired['JsonObjectInput'],
    'request': NotRequired['JsonObjectInput'],
    'multipart': NotRequired['JsonObjectInput'],
    'response': NotRequired['JsonObjectInput'],
})

ServiceManifestCacheEntryViewindexItem = TypedDict('ServiceManifestCacheEntryViewindexItem', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': Required['list[str]'],
    'paramsSchema': NotRequired['JsonObject'],
    'operations': Required['list[ServiceManifestCacheEntryViewindexItemOperationsItem]'],
    'fragments': Required['list[ControlPlaneSubmissionViewindexItemFragmentsItem]'],
})

ServiceManifestCacheEntryViewindexItemOperationsItem = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': Required['list[str]'],
    'renderModes': Required['list[RenderMode]'],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalRouteMountSitemap'],
    'robots': Required['list[BetterPortalRouteMountRobotsItem]'],
    'chrome': NotRequired['BetterPortalRouteChrome'],
    'dependencies': Required['list[OperationDependency]'],
    'permissions': Required['list[ControlPlaneSubmissionViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ServiceManifestCacheEntryViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'demoScenarios': Required['list[DemoScenario]'],
})

ServiceManifestCacheEntryViewindexItemOperationsItemSchemas = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItemSchemas', {
    'query': NotRequired['JsonObject'],
    'headers': NotRequired['JsonObject'],
    'request': NotRequired['JsonObject'],
    'multipart': NotRequired['JsonObject'],
    'response': NotRequired['JsonObject'],
})

ServiceRedeemResponse = TypedDict('ServiceRedeemResponse', {
    'apiKey': Required['str'],
    'cpId': Required['str'],
    'cpJwksUri': Required['str'],
})

ServiceRedeemResponseInput = TypedDict('ServiceRedeemResponseInput', {
    'apiKey': Required['str'],
    'cpId': Required['str'],
    'cpJwksUri': Required['str'],
})

ServiceTokenClaims = TypedDict('ServiceTokenClaims', {
    'iss': Required['str'],
    'sub': Required['str'],
    'aud': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'bindingId': Required['str'],
    'iat': Required['int'],
    'nbf': NotRequired['int'],
    'exp': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['service']"],
})

ServiceTokenClaimsInput = TypedDict('ServiceTokenClaimsInput', {
    'iss': Required['str'],
    'sub': Required['str'],
    'aud': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'bindingId': Required['str'],
    'iat': Required['int'],
    'nbf': NotRequired['int'],
    'exp': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['service']"],
})

SetupTokenClaims = TypedDict('SetupTokenClaims', {
    'iss': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['setup']"],
    'instanceId': Required['str'],
    'serviceUrl': Required['str'],
    'cpUrl': Required['str'],
    'cpJwksUri': Required['str'],
    'scope': NotRequired['ServiceInstallationBindingScope'],
})

SetupTokenClaimsInput = TypedDict('SetupTokenClaimsInput', {
    'iss': Required['str'],
    'exp': Required['int'],
    'iat': Required['int'],
    'jti': Required['str'],
    'tokenType': Required["Literal['setup']"],
    'instanceId': Required['str'],
    'serviceUrl': Required['str'],
    'cpUrl': Required['str'],
    'cpJwksUri': Required['str'],
    'scope': NotRequired['ServiceInstallationBindingInputScope'],
})

SharedServiceDefinition = TypedDict('SharedServiceDefinition', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'baseUrl': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadata'],
    'supportedDeploymentModes': Required['list[DeploymentMode]'],
    'owner': Required["Literal['bp', '3p']"],
    'upgradeUrlTemplate': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': Required['list[str]'],
    'pricingHint': NotRequired["Literal['free', 'freemium', 'paid']"],
    'publishedAt': NotRequired['str'],
    'enabled': Required['bool'],
})

SharedServiceDefinitionInput = TypedDict('SharedServiceDefinitionInput', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'baseUrl': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadataInput'],
    'supportedDeploymentModes': NotRequired['list[DeploymentModeInput]'],
    'owner': NotRequired["Literal['bp', '3p']"],
    'upgradeUrlTemplate': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': NotRequired['list[str]'],
    'pricingHint': NotRequired["Literal['free', 'freemium', 'paid']"],
    'publishedAt': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

ShellFragmentDescriptor = TypedDict('ShellFragmentDescriptor', {
    'id': Required['str'],
    'kind': Required["Literal['fragment', 'block']"],
    'title': Required['str'],
    'description': Required['str'],
    'defaultItems': Required['list[str]'],
})

ShellFragmentDescriptorInput = TypedDict('ShellFragmentDescriptorInput', {
    'id': Required['str'],
    'kind': Required["Literal['fragment', 'block']"],
    'title': Required['str'],
    'description': Required['str'],
    'defaultItems': NotRequired['list[str]'],
})

ShellManifest = TypedDict('ShellManifest', {
    'service': Required['str'],
    'renderer': Required['str'],
    'fragments': Required['list[ShellFragmentDescriptor]'],
})

ShellManifestInput = TypedDict('ShellManifestInput', {
    'service': Required['str'],
    'renderer': Required['str'],
    'fragments': NotRequired['list[ShellFragmentDescriptorInput]'],
})

SigningKeyPair = TypedDict('SigningKeyPair', {
    'privateKeyPem': Required['str'],
    'publicKeyPem': Required['str'],
    'kid': Required['str'],
})

SigningKeyPairInput = TypedDict('SigningKeyPairInput', {
    'privateKeyPem': Required['str'],
    'publicKeyPem': Required['str'],
    'kid': Required['str'],
})

StreamEndFrame = TypedDict('StreamEndFrame', {
    'kind': Required["Literal['end']"],
    'count': Required['int'],
})

StreamEndFrameInput = TypedDict('StreamEndFrameInput', {
    'kind': Required["Literal['end']"],
    'count': Required['int'],
})

StreamErrorFrame = TypedDict('StreamErrorFrame', {
    'kind': Required["Literal['error']"],
    'error': Required['str'],
    'message': Required['str'],
    'issues': NotRequired['list[StreamErrorFrameIssuesItem]'],
})

StreamErrorFrameInput = TypedDict('StreamErrorFrameInput', {
    'kind': Required["Literal['error']"],
    'error': Required['str'],
    'message': Required['str'],
    'issues': NotRequired['list[StreamErrorFrameInputIssuesItem]'],
})

StreamErrorFrameInputIssuesItem = TypedDict('StreamErrorFrameInputIssuesItem', {
    'code': Required['str'],
    'path': NotRequired['str'],
    'message': Required['str'],
})

StreamErrorFrameIssuesItem = TypedDict('StreamErrorFrameIssuesItem', {
    'code': Required['str'],
    'path': NotRequired['str'],
    'message': Required['str'],
})

StreamShellContext = TypedDict('StreamShellContext', {
    'sseConnectPath': Required['str'],
    'params': Required['JsonObject'],
    'query': Required['JsonObject'],
})

StreamShellContextInput = TypedDict('StreamShellContextInput', {
    'sseConnectPath': Required['str'],
    'params': Required['JsonObjectInput'],
    'query': Required['JsonObjectInput'],
})

Tenant = TypedDict('Tenant', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'branding': Required['TenantBranding'],
})

TenantAppValidation = TypedDict('TenantAppValidation', {
    'allowed': Required['bool'],
    'reason': NotRequired['str'],
    'upgradeUrl': NotRequired['str'],
    'retryAfterSeconds': NotRequired['int'],
})

TenantAppValidationInput = TypedDict('TenantAppValidationInput', {
    'allowed': Required['bool'],
    'reason': NotRequired['str'],
    'upgradeUrl': NotRequired['str'],
    'retryAfterSeconds': NotRequired['int'],
})

TenantBranding = TypedDict('TenantBranding', {
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

TenantInput = TypedDict('TenantInput', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'branding': NotRequired['TenantInputBranding'],
})

TenantInputBranding = TypedDict('TenantInputBranding', {
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

TenantServiceRegistration = TypedDict('TenantServiceRegistration', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadata'],
    'capabilities': Required['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': Required["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': Required['bool'],
})

TenantServiceRegistrationInput = TypedDict('TenantServiceRegistrationInput', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['AuthProviderRuntimeMetadataInput'],
    'capabilities': NotRequired['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': NotRequired["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

TenantSharedServiceActivation = TypedDict('TenantSharedServiceActivation', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sharedServiceId': Required['str'],
    'activatedAt': Required['str'],
    'enabled': Required['bool'],
})

TenantSharedServiceActivationInput = TypedDict('TenantSharedServiceActivationInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sharedServiceId': Required['str'],
    'activatedAt': Required['str'],
    'enabled': NotRequired['bool'],
})

TokenLifetimeConfig = TypedDict('TokenLifetimeConfig', {
    'accessTokenSeconds': Required['int'],
    'refreshTokenSeconds': Required['int'],
})

TokenLifetimeConfigInput = TypedDict('TokenLifetimeConfigInput', {
    'accessTokenSeconds': NotRequired['int'],
    'refreshTokenSeconds': NotRequired['int'],
})

TokenType: TypeAlias = "Literal['access', 'refresh', 'cp-envelope', 'setup', 'install']"

TokenTypeInput: TypeAlias = "Literal['access', 'refresh', 'cp-envelope', 'setup', 'install']"

UuidV7: TypeAlias = 'str'

UuidV7Input: TypeAlias = 'str'

ViewAppContext = TypedDict('ViewAppContext', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'defaultRoute': Required['str'],
    'auth': NotRequired['ViewAppContextAuth'],
    'shell': NotRequired['ScopedAppShell'],
})

ViewAppContextAuth = TypedDict('ViewAppContextAuth', {
    'serviceId': Required['str'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
})

ViewAppContextInput = TypedDict('ViewAppContextInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'defaultRoute': NotRequired['str'],
    'auth': NotRequired['ViewAppContextInputAuth'],
    'shell': NotRequired['ScopedAppInputShell'],
})

ViewAppContextInputAuth = TypedDict('ViewAppContextInputAuth', {
    'serviceId': Required['str'],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
})

ViewDemoScenario = TypedDict('ViewDemoScenario', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'match': NotRequired['DemoScenarioMatch'],
    'response': Required['JsonValue'],
})

ViewDemoScenarioInput = TypedDict('ViewDemoScenarioInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'match': NotRequired['DemoScenarioMatchInput'],
    'response': Required['JsonValueInput'],
})

ViewDemoScenarioMatch = TypedDict('ViewDemoScenarioMatch', {
    'query': NotRequired['JsonObject'],
    'params': NotRequired['JsonObject'],
    'headers': NotRequired['dict[str, str]'],
    'request': NotRequired['JsonObject'],
})

ViewDemoScenarioMatchInput = TypedDict('ViewDemoScenarioMatchInput', {
    'query': NotRequired['JsonObjectInput'],
    'params': NotRequired['JsonObjectInput'],
    'headers': NotRequired['dict[str, str]'],
    'request': NotRequired['JsonObjectInput'],
})

ViewMetadata = TypedDict('ViewMetadata', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': Required['list[str]'],
    'paramsSchema': Required['JsonObject'],
    'operations': Required['list[ViewOperationMetadata]'],
})

ViewMetadataInput = TypedDict('ViewMetadataInput', {
    'viewId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'pathVariants': NotRequired['list[str]'],
    'paramsSchema': Required['JsonObjectInput'],
    'operations': Required['list[ViewOperationMetadataInput]'],
})

ViewOperationMetadata = TypedDict('ViewOperationMetadata', {
    'operationId': Required['str'],
    'method': Required['HttpMethod'],
    'title': Required['str'],
    'description': Required['str'],
    'querySchema': Required['JsonObject'],
    'headersSchema': Required['JsonObject'],
    'bodySchema': Required['JsonObject'],
    'jsonResponseSchema': Required['JsonObject'],
    'metadataResponseSchema': Required['JsonObject'],
    'renderable': Required['bool'],
    'raw': NotRequired['bool'],
    'streaming': NotRequired['ViewStreamingSupport'],
    'html': Required['HtmlRepresentationSupport'],
    'auth': Required['ApiAuthRequirement'],
    'sitemap': NotRequired['BetterPortalRouteMountSitemap'],
    'robots': Required['list[BetterPortalRouteMountRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': Required['list[OperationDependency]'],
    'chrome': NotRequired['BetterPortalRouteChrome'],
    'apiContracts': Required['list[ApiContractDescriptor]'],
    'demoScenarios': Required['list[DemoScenario]'],
    'cacheHints': Required['CacheHints'],
})

ViewOperationMetadataInput = TypedDict('ViewOperationMetadataInput', {
    'operationId': Required['str'],
    'method': Required['HttpMethodInput'],
    'title': Required['str'],
    'description': Required['str'],
    'querySchema': Required['JsonObjectInput'],
    'headersSchema': Required['JsonObjectInput'],
    'bodySchema': Required['JsonObjectInput'],
    'jsonResponseSchema': Required['JsonObjectInput'],
    'metadataResponseSchema': Required['JsonObjectInput'],
    'renderable': NotRequired['bool'],
    'raw': NotRequired['bool'],
    'streaming': NotRequired['ViewStreamingSupportInput'],
    'html': Required['HtmlRepresentationSupportInput'],
    'auth': Required['ApiAuthRequirementInput'],
    'sitemap': NotRequired['BetterPortalRouteMountInputSitemap'],
    'robots': NotRequired['list[BetterPortalRouteMountInputRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': NotRequired['list[OperationDependencyInput]'],
    'chrome': NotRequired['BetterPortalRouteChromeInput'],
    'apiContracts': NotRequired['list[ApiContractDescriptorInput]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
    'cacheHints': Required['CacheHintsInput'],
})

ViewPermissionDefinition = TypedDict('ViewPermissionDefinition', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'defaultRoles': Required['list[str]'],
})

ViewPermissionDefinitionInput = TypedDict('ViewPermissionDefinitionInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'defaultRoles': NotRequired['list[str]'],
})

ViewRenderData = TypedDict('ViewRenderData', {
    'tenant': Required['ViewTenantContext'],
    'app': Required['ViewAppContext'],
    'request': Required['ViewRenderDataRequest'],
    'route': Required['ViewRenderDataRoute'],
})

ViewRenderDataInput = TypedDict('ViewRenderDataInput', {
    'tenant': Required['ViewTenantContextInput'],
    'app': Required['ViewAppContextInput'],
    'request': Required['ViewRenderDataInputRequest'],
    'route': Required['ViewRenderDataInputRoute'],
})

ViewRenderDataInputRequest = TypedDict('ViewRenderDataInputRequest', {
    'method': Required['HttpMethodInput'],
    'path': Required['str'],
    'params': Required['JsonObjectInput'],
    'query': Required['JsonObjectInput'],
})

ViewRenderDataInputRoute = TypedDict('ViewRenderDataInputRoute', {
    'viewId': Required['str'],
    'path': Required['str'],
    'renderer': Required['str'],
    'mode': Required['RenderModeInput'],
    'kind': Required["Literal['page', 'fragment', 'component']"],
    'key': NotRequired['str'],
    'status': Required['int'],
})

ViewRenderDataRequest = TypedDict('ViewRenderDataRequest', {
    'method': Required['HttpMethod'],
    'path': Required['str'],
    'params': Required['JsonObject'],
    'query': Required['JsonObject'],
})

ViewRenderDataRoute = TypedDict('ViewRenderDataRoute', {
    'viewId': Required['str'],
    'path': Required['str'],
    'renderer': Required['str'],
    'mode': Required['RenderMode'],
    'kind': Required["Literal['page', 'fragment', 'component']"],
    'key': NotRequired['str'],
    'status': Required['int'],
})

ViewRenderError = TypedDict('ViewRenderError', {
    'error': Required['str'],
    'status': Required['int'],
})

ViewRenderErrorInput = TypedDict('ViewRenderErrorInput', {
    'error': Required['str'],
    'status': Required['int'],
})

ViewRendererSupport = TypedDict('ViewRendererSupport', {
    'defaultRenderer': Required['str'],
    'renderModes': Required['list[RenderMode]'],
    'slots': Required['list[str]'],
    'renderers': Required['list[ViewRendererVariant]'],
})

ViewRendererSupportInput = TypedDict('ViewRendererSupportInput', {
    'defaultRenderer': NotRequired['str'],
    'renderModes': NotRequired['list[RenderModeInput]'],
    'slots': NotRequired['list[str]'],
    'renderers': NotRequired['list[ViewRendererVariantInput]'],
})

ViewRendererVariant = TypedDict('ViewRendererVariant', {
    'id': Required['str'],
    'title': Required['str'],
    'slotId': Required['str'],
    'renderModes': Required['list[RenderMode]'],
})

ViewRendererVariantInput = TypedDict('ViewRendererVariantInput', {
    'id': Required['str'],
    'title': Required['str'],
    'slotId': Required['str'],
    'renderModes': NotRequired['list[RenderModeInput]'],
})

ViewRole: TypeAlias = 'str'

ViewRoleInput: TypeAlias = 'str'

ViewStreamingSupport = TypedDict('ViewStreamingSupport', {
    'itemSchema': Required['JsonObject'],
    'summarySchema': NotRequired['JsonObject'],
})

ViewStreamingSupportInput = TypedDict('ViewStreamingSupportInput', {
    'itemSchema': Required['JsonObjectInput'],
    'summarySchema': NotRequired['JsonObjectInput'],
})

ViewTenantContext = TypedDict('ViewTenantContext', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'branding': Required['ScopedTenantBranding'],
})

ViewTenantContextInput = TypedDict('ViewTenantContextInput', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'branding': NotRequired['ScopedTenantInputBranding'],
})

WebhookEventDescriptor = TypedDict('WebhookEventDescriptor', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'payloadSchema': Required['JsonObject'],
})

WebhookEventDescriptorInput = TypedDict('WebhookEventDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'payloadSchema': Required['JsonObjectInput'],
})

WebhookTarget = TypedDict('WebhookTarget', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'serviceId': Required['str'],
    'eventId': Required['str'],
    'url': Required['str'],
    'secret': Required['str'],
    'createdAt': Required['str'],
    'enabled': Required['bool'],
    'maxAttempts': Required['int'],
})

WebhookTargetInput = TypedDict('WebhookTargetInput', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'serviceId': Required['str'],
    'eventId': Required['str'],
    'url': Required['str'],
    'secret': Required['str'],
    'createdAt': Required['str'],
    'enabled': NotRequired['bool'],
    'maxAttempts': NotRequired['int'],
})
