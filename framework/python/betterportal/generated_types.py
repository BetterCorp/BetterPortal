# Generated from AnyVali documents; do not edit. SHA256: faf0bf1c311dbb254bafe50e741cce327564c2836209d79d066539c6f339ab3f
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
    'configManagement': Required['BetterPortalConfigConfigmanagement'],
    'platformServices': Required['list[BetterPortalConfigPlatformservicesItem]'],
    'tenants': Required['list[BetterPortalConfigTenantsItem]'],
    'apps': Required['list[BetterPortalConfigAppsItem]'],
    'sharedServiceCatalog': Required['list[BetterPortalConfigSharedservicecatalogItem]'],
    'sharedServiceActivations': Required['list[BetterPortalConfigSharedserviceactivationsItem]'],
    'manifestCache': Required['list[ServiceManifestCacheEntry]'],
    'm2m': Required['BetterPortalConfigM2m'],
    'previewEnvironmentGroups': Required['list[PreviewEnvironmentGroup]'],
    'previewEnvironmentDeployments': Required['list[BetterPortalConfigPreviewenvironmentdeploymentsItem]'],
    'webhooks': Required['BetterPortalConfigWebhooks'],
})

BetterPortalConfigAppsItem = TypedDict('BetterPortalConfigAppsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': Required['list[str]'],
    'refererOverrides': Required['list[str]'],
    'shell': NotRequired['BetterPortalConfigAppsItemShell'],
    'themeConfig': Required['BetterPortalConfigAppsItemThemeconfig'],
    'layoutId': NotRequired['str'],
    'defaultRoute': Required['str'],
    'seo': NotRequired['BetterPortalConfigAppsItemSeo'],
    'routes': Required['list[BetterPortalConfigAppsItemRoutesItem]'],
    'menu': Required['list[BetterPortalConfigAppsItemMenuItem]'],
    'slots': Required['list[BetterPortalConfigAppsItemSlotsItem]'],
    'fragments': Required['dict[str, list[BetterPortalConfigAppsItemFragmentsItemItem]]'],
    'shellFragments': Required['dict[str, dict[str, Union[BetterPortalConfigAppsItemShellfragmentsItemItemVariant1, BetterPortalConfigAppsItemShellfragmentsItemItemVariant2, BetterPortalConfigAppsItemShellfragmentsItemItemVariant3]]]'],
    'auth': NotRequired['BetterPortalConfigAppsItemAuth'],
    'statusViewIds': NotRequired['dict[str, str]'],
})

BetterPortalConfigAppsItemAuth = TypedDict('BetterPortalConfigAppsItemAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[BetterPortalConfigAppsItemAuthProviderVariant1, BetterPortalConfigAppsItemAuthProviderVariant2]'],
    'roleAuthority': NotRequired["Literal['provider', 'betterportal']"],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['BetterPortalConfigAppsItemAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigPlatformservicesItemAuthproviderPublickeys'],
    'roles': Required['list[BetterPortalConfigAppsItemAuthRolesItem]'],
})

BetterPortalConfigAppsItemAuthProviderVariant1 = TypedDict('BetterPortalConfigAppsItemAuthProviderVariant1', {
    'kind': Required["Literal['betterportal.default']"],
})

BetterPortalConfigAppsItemAuthProviderVariant2 = TypedDict('BetterPortalConfigAppsItemAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': Required['str'],
    'subjectClaimPath': Required['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

BetterPortalConfigAppsItemAuthRedirects = TypedDict('BetterPortalConfigAppsItemAuthRedirects', {
    'afterLogin': NotRequired['BetterPortalConfigAppsItemAuthRedirectsAfterlogin'],
    'afterLogout': NotRequired['BetterPortalConfigAppsItemAuthRedirectsAfterlogin'],
})

BetterPortalConfigAppsItemAuthRedirectsAfterlogin = TypedDict('BetterPortalConfigAppsItemAuthRedirectsAfterlogin', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
})

BetterPortalConfigAppsItemAuthRolesItem = TypedDict('BetterPortalConfigAppsItemAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': Required['list[BetterPortalConfigAppsItemAuthRolesItemPermissionsItem]'],
})

BetterPortalConfigAppsItemAuthRolesItemPermissionsItem = TypedDict('BetterPortalConfigAppsItemAuthRolesItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required["list[Literal['read', 'create', 'update', 'delete']]"],
})

BetterPortalConfigAppsItemFragmentsItemItem = TypedDict('BetterPortalConfigAppsItemFragmentsItemItem', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigAppsItemMenuItem = TypedDict('BetterPortalConfigAppsItemMenuItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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

BetterPortalConfigAppsItemRoutesItem = TypedDict('BetterPortalConfigAppsItemRoutesItem', {
    'id': Required['str'],
    'kind': Required["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['BetterPortalConfigAppsItemRoutesItemSitemap'],
    'robots': NotRequired['list[BetterPortalConfigAppsItemRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': Required['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
})

BetterPortalConfigAppsItemRoutesItemRobotsItem = TypedDict('BetterPortalConfigAppsItemRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

BetterPortalConfigAppsItemRoutesItemSitemap = TypedDict('BetterPortalConfigAppsItemRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

BetterPortalConfigAppsItemSeo = TypedDict('BetterPortalConfigAppsItemSeo', {
    'visibility': Required["Literal['auto', 'public', 'private']"],
    'serviceFailure': Required["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': Required["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

BetterPortalConfigAppsItemShell = TypedDict('BetterPortalConfigAppsItemShell', {
    'serviceId': Required['str'],
})

BetterPortalConfigAppsItemShellfragmentsItemItemVariant1 = TypedDict('BetterPortalConfigAppsItemShellfragmentsItemItemVariant1', {
    'mode': Required["Literal['none']"],
})

BetterPortalConfigAppsItemShellfragmentsItemItemVariant2 = TypedDict('BetterPortalConfigAppsItemShellfragmentsItemItemVariant2', {
    'mode': Required["Literal['override']"],
    'item': Required['Union[BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant1, BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant2]'],
})

BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant1 = TypedDict('BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant1', {
    'source': Required["Literal['shell']"],
    'fragmentId': Required['str'],
})

BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant2 = TypedDict('BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant2', {
    'source': Required["Literal['service']"],
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
})

BetterPortalConfigAppsItemShellfragmentsItemItemVariant3 = TypedDict('BetterPortalConfigAppsItemShellfragmentsItemItemVariant3', {
    'mode': Required["Literal['items']"],
    'items': Required['list[Union[BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant1, BetterPortalConfigAppsItemShellfragmentsItemItemVariant2ItemVariant2]]'],
})

BetterPortalConfigAppsItemSlotsItem = TypedDict('BetterPortalConfigAppsItemSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigAppsItemThemeconfig = TypedDict('BetterPortalConfigAppsItemThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': Required["Literal['light', 'dark', 'system']"],
    'bootstrap': Required['BetterPortalConfigAppsItemThemeconfigBootstrap'],
    'light': Required['BetterPortalConfigAppsItemThemeconfigLight'],
    'dark': Required['BetterPortalConfigAppsItemThemeconfigLight'],
})

BetterPortalConfigAppsItemThemeconfigBootstrap = TypedDict('BetterPortalConfigAppsItemThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

BetterPortalConfigAppsItemThemeconfigLight = TypedDict('BetterPortalConfigAppsItemThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

BetterPortalConfigConfigmanagement = TypedDict('BetterPortalConfigConfigmanagement', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'auth': Required['BetterPortalConfigConfigmanagementAuth'],
})

BetterPortalConfigConfigmanagementAuth = TypedDict('BetterPortalConfigConfigmanagementAuth', {
    'mechanism': Required["Literal['none', 'dev-token', 'jwt', 'oidc']"],
    'issuer': NotRequired['str'],
    'audience': NotRequired['str'],
    'requiredPermissions': Required['list[str]'],
})

BetterPortalConfigInput = TypedDict('BetterPortalConfigInput', {
    'configManagement': NotRequired['BetterPortalConfigInputConfigmanagement'],
    'platformServices': NotRequired['list[BetterPortalConfigInputPlatformservicesItem]'],
    'tenants': NotRequired['list[BetterPortalConfigInputTenantsItem]'],
    'apps': NotRequired['list[BetterPortalConfigInputAppsItem]'],
    'sharedServiceCatalog': NotRequired['list[BetterPortalConfigInputSharedservicecatalogItem]'],
    'sharedServiceActivations': NotRequired['list[BetterPortalConfigInputSharedserviceactivationsItem]'],
    'manifestCache': NotRequired['list[ServiceManifestCacheEntryInput]'],
    'm2m': NotRequired['BetterPortalConfigInputM2m'],
    'previewEnvironmentGroups': NotRequired['list[PreviewEnvironmentGroupInput]'],
    'previewEnvironmentDeployments': NotRequired['list[BetterPortalConfigInputPreviewenvironmentdeploymentsItem]'],
    'webhooks': NotRequired['BetterPortalConfigInputWebhooks'],
})

BetterPortalConfigInputAppsItem = TypedDict('BetterPortalConfigInputAppsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': NotRequired['list[str]'],
    'refererOverrides': NotRequired['list[str]'],
    'shell': NotRequired['BetterPortalConfigInputAppsItemShell'],
    'themeConfig': NotRequired['BetterPortalConfigInputAppsItemThemeconfig'],
    'layoutId': NotRequired['str'],
    'defaultRoute': NotRequired['str'],
    'seo': NotRequired['BetterPortalConfigInputAppsItemSeo'],
    'routes': NotRequired['list[BetterPortalConfigInputAppsItemRoutesItem]'],
    'menu': NotRequired['list[BetterPortalConfigInputAppsItemMenuItem]'],
    'slots': NotRequired['list[BetterPortalConfigInputAppsItemSlotsItem]'],
    'fragments': NotRequired['dict[str, list[BetterPortalConfigInputAppsItemFragmentsItemItem]]'],
    'shellFragments': NotRequired['dict[str, dict[str, Union[BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant1, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant3]]]'],
    'auth': NotRequired['BetterPortalConfigInputAppsItemAuth'],
    'statusViewIds': NotRequired['dict[str, str]'],
})

BetterPortalConfigInputAppsItemAuth = TypedDict('BetterPortalConfigInputAppsItemAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[BetterPortalConfigInputAppsItemAuthProviderVariant1, BetterPortalConfigInputAppsItemAuthProviderVariant2]'],
    'roleAuthority': NotRequired["Literal['provider', 'betterportal']"],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['BetterPortalConfigInputAppsItemAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys'],
    'roles': NotRequired['list[BetterPortalConfigInputAppsItemAuthRolesItem]'],
})

BetterPortalConfigInputAppsItemAuthProviderVariant1 = TypedDict('BetterPortalConfigInputAppsItemAuthProviderVariant1', {
    'kind': Required["Literal['betterportal.default']"],
})

BetterPortalConfigInputAppsItemAuthProviderVariant2 = TypedDict('BetterPortalConfigInputAppsItemAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': NotRequired['str'],
    'subjectClaimPath': NotRequired['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

BetterPortalConfigInputAppsItemAuthRedirects = TypedDict('BetterPortalConfigInputAppsItemAuthRedirects', {
    'afterLogin': NotRequired['BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin'],
    'afterLogout': NotRequired['BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin'],
})

BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin = TypedDict('BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
})

BetterPortalConfigInputAppsItemAuthRolesItem = TypedDict('BetterPortalConfigInputAppsItemAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': NotRequired['list[BetterPortalConfigInputAppsItemAuthRolesItemPermissionsItem]'],
})

BetterPortalConfigInputAppsItemAuthRolesItemPermissionsItem = TypedDict('BetterPortalConfigInputAppsItemAuthRolesItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required["list[Literal['read', 'create', 'update', 'delete']]"],
})

BetterPortalConfigInputAppsItemFragmentsItemItem = TypedDict('BetterPortalConfigInputAppsItemFragmentsItemItem', {
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputAppsItemMenuItem = TypedDict('BetterPortalConfigInputAppsItemMenuItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('BetterPortalConfigInputAppsItemMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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

BetterPortalConfigInputAppsItemRoutesItem = TypedDict('BetterPortalConfigInputAppsItemRoutesItem', {
    'id': Required['str'],
    'kind': NotRequired["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['BetterPortalConfigInputAppsItemRoutesItemSitemap'],
    'robots': NotRequired['list[BetterPortalConfigInputAppsItemRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
})

BetterPortalConfigInputAppsItemRoutesItemRobotsItem = TypedDict('BetterPortalConfigInputAppsItemRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

BetterPortalConfigInputAppsItemRoutesItemSitemap = TypedDict('BetterPortalConfigInputAppsItemRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

BetterPortalConfigInputAppsItemSeo = TypedDict('BetterPortalConfigInputAppsItemSeo', {
    'visibility': NotRequired["Literal['auto', 'public', 'private']"],
    'serviceFailure': NotRequired["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': NotRequired["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

BetterPortalConfigInputAppsItemShell = TypedDict('BetterPortalConfigInputAppsItemShell', {
    'serviceId': Required['str'],
})

BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant1 = TypedDict('BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant1', {
    'mode': Required["Literal['none']"],
})

BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2 = TypedDict('BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2', {
    'mode': Required["Literal['override']"],
    'item': Required['Union[BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant1, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant2]'],
})

BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant1 = TypedDict('BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant1', {
    'source': Required["Literal['shell']"],
    'fragmentId': Required['str'],
})

BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant2 = TypedDict('BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant2', {
    'source': Required["Literal['service']"],
    'serviceId': Required['str'],
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
})

BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant3 = TypedDict('BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant3', {
    'mode': Required["Literal['items']"],
    'items': NotRequired['list[Union[BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant1, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2ItemVariant2]]'],
})

BetterPortalConfigInputAppsItemSlotsItem = TypedDict('BetterPortalConfigInputAppsItemSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputAppsItemThemeconfig = TypedDict('BetterPortalConfigInputAppsItemThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': NotRequired["Literal['light', 'dark', 'system']"],
    'bootstrap': NotRequired['BetterPortalConfigInputAppsItemThemeconfigBootstrap'],
    'light': NotRequired['BetterPortalConfigInputAppsItemThemeconfigLight'],
    'dark': NotRequired['BetterPortalConfigInputAppsItemThemeconfigLight'],
})

BetterPortalConfigInputAppsItemThemeconfigBootstrap = TypedDict('BetterPortalConfigInputAppsItemThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

BetterPortalConfigInputAppsItemThemeconfigLight = TypedDict('BetterPortalConfigInputAppsItemThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

BetterPortalConfigInputConfigmanagement = TypedDict('BetterPortalConfigInputConfigmanagement', {
    'adminTenantId': NotRequired['str'],
    'managementAppId': NotRequired['str'],
    'auth': NotRequired['BetterPortalConfigInputConfigmanagementAuth'],
})

BetterPortalConfigInputConfigmanagementAuth = TypedDict('BetterPortalConfigInputConfigmanagementAuth', {
    'mechanism': NotRequired["Literal['none', 'dev-token', 'jwt', 'oidc']"],
    'issuer': NotRequired['str'],
    'audience': NotRequired['str'],
    'requiredPermissions': NotRequired['list[str]'],
})

BetterPortalConfigInputM2m = TypedDict('BetterPortalConfigInputM2m', {
    'bindings': NotRequired['list[BetterPortalConfigInputM2mBindingsItem]'],
    'grants': NotRequired['list[BetterPortalConfigInputM2mGrantsItem]'],
})

BetterPortalConfigInputM2mBindingsItem = TypedDict('BetterPortalConfigInputM2mBindingsItem', {
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

BetterPortalConfigInputM2mGrantsItem = TypedDict('BetterPortalConfigInputM2mGrantsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'bindingId': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'permissions': NotRequired['list[str]'],
    'enabled': NotRequired['bool'],
    'createdAt': Required['str'],
})

BetterPortalConfigInputPlatformservicesItem = TypedDict('BetterPortalConfigInputPlatformservicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthprovider'],
    'capabilities': NotRequired['list[str]'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'category': NotRequired['str'],
    'createdAt': Required['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputPlatformservicesItemAuthprovider = TypedDict('BetterPortalConfigInputPlatformservicesItemAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys'],
})

BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys = TypedDict('BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys', {
    'keys': Required['list[BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeysKeysItem]'],
})

BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeysKeysItem = TypedDict('BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeysKeysItem', {
    'kty': Required["Literal['RSA']"],
    'use': Required["Literal['sig']"],
    'alg': Required["Literal['RS256']"],
    'kid': Required['str'],
    'n': Required['str'],
    'e': Required['str'],
})

BetterPortalConfigInputPreviewenvironmentdeploymentsItem = TypedDict('BetterPortalConfigInputPreviewenvironmentdeploymentsItem', {
    'credentialReplay': NotRequired['BetterPortalConfigInputPreviewenvironmentdeploymentsItemCredentialreplay'],
    'id': Required['str'],
    'groupId': Required['str'],
    'key': Required['str'],
    'name': Required['str'],
    'hostname': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'expiresInDays': Required['Union[int, None]'],
    'expiresAt': NotRequired['str'],
    'services': Required['list[BetterPortalConfigInputPreviewenvironmentdeploymentsItemServicesItem]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

BetterPortalConfigInputPreviewenvironmentdeploymentsItemCredentialreplay = TypedDict('BetterPortalConfigInputPreviewenvironmentdeploymentsItemCredentialreplay', {
    'requestHash': Required['str'],
    'ciphertext': Required['str'],
    'expiresAt': Required['str'],
})

BetterPortalConfigInputPreviewenvironmentdeploymentsItemServicesItem = TypedDict('BetterPortalConfigInputPreviewenvironmentdeploymentsItemServicesItem', {
    'serviceId': Required['str'],
    'instanceId': Required['str'],
    'url': Required['str'],
})

BetterPortalConfigInputSharedserviceactivationsItem = TypedDict('BetterPortalConfigInputSharedserviceactivationsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sharedServiceId': Required['str'],
    'activatedAt': Required['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputSharedservicecatalogItem = TypedDict('BetterPortalConfigInputSharedservicecatalogItem', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'baseUrl': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthprovider'],
    'supportedDeploymentModes': NotRequired["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
    'owner': NotRequired["Literal['bp', '3p']"],
    'upgradeUrlTemplate': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': NotRequired['list[str]'],
    'pricingHint': NotRequired["Literal['free', 'freemium', 'paid']"],
    'publishedAt': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputTenantsItem = TypedDict('BetterPortalConfigInputTenantsItem', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': NotRequired['bool'],
    'branding': NotRequired['BetterPortalConfigInputTenantsItemBranding'],
    'services': NotRequired['list[BetterPortalConfigInputTenantsItemServicesItem]'],
    'activatedPlatformServices': NotRequired['list[str]'],
})

BetterPortalConfigInputTenantsItemBranding = TypedDict('BetterPortalConfigInputTenantsItemBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

BetterPortalConfigInputTenantsItemServicesItem = TypedDict('BetterPortalConfigInputTenantsItemServicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': NotRequired['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthprovider'],
    'capabilities': NotRequired['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': NotRequired["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

BetterPortalConfigInputWebhooks = TypedDict('BetterPortalConfigInputWebhooks', {
    'targets': NotRequired['list[BetterPortalConfigInputWebhooksTargetsItem]'],
})

BetterPortalConfigInputWebhooksTargetsItem = TypedDict('BetterPortalConfigInputWebhooksTargetsItem', {
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

BetterPortalConfigM2m = TypedDict('BetterPortalConfigM2m', {
    'bindings': Required['list[BetterPortalConfigM2mBindingsItem]'],
    'grants': Required['list[BetterPortalConfigM2mGrantsItem]'],
})

BetterPortalConfigM2mBindingsItem = TypedDict('BetterPortalConfigM2mBindingsItem', {
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

BetterPortalConfigM2mGrantsItem = TypedDict('BetterPortalConfigM2mGrantsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'bindingId': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'permissions': Required['list[str]'],
    'enabled': Required['bool'],
    'createdAt': Required['str'],
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

BetterPortalConfigPlatformservicesItem = TypedDict('BetterPortalConfigPlatformservicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigPlatformservicesItemAuthprovider'],
    'capabilities': Required['list[str]'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'category': NotRequired['str'],
    'createdAt': Required['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigPlatformservicesItemAuthprovider = TypedDict('BetterPortalConfigPlatformservicesItemAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigPlatformservicesItemAuthproviderPublickeys'],
})

BetterPortalConfigPlatformservicesItemAuthproviderPublickeys = TypedDict('BetterPortalConfigPlatformservicesItemAuthproviderPublickeys', {
    'keys': Required['list[BetterPortalConfigPlatformservicesItemAuthproviderPublickeysKeysItem]'],
})

BetterPortalConfigPlatformservicesItemAuthproviderPublickeysKeysItem = TypedDict('BetterPortalConfigPlatformservicesItemAuthproviderPublickeysKeysItem', {
    'kty': Required["Literal['RSA']"],
    'use': Required["Literal['sig']"],
    'alg': Required["Literal['RS256']"],
    'kid': Required['str'],
    'n': Required['str'],
    'e': Required['str'],
})

BetterPortalConfigPreviewenvironmentdeploymentsItem = TypedDict('BetterPortalConfigPreviewenvironmentdeploymentsItem', {
    'credentialReplay': NotRequired['BetterPortalConfigPreviewenvironmentdeploymentsItemCredentialreplay'],
    'id': Required['str'],
    'groupId': Required['str'],
    'key': Required['str'],
    'name': Required['str'],
    'hostname': Required['str'],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'expiresInDays': Required['Union[int, None]'],
    'expiresAt': NotRequired['str'],
    'services': Required['list[BetterPortalConfigPreviewenvironmentdeploymentsItemServicesItem]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

BetterPortalConfigPreviewenvironmentdeploymentsItemCredentialreplay = TypedDict('BetterPortalConfigPreviewenvironmentdeploymentsItemCredentialreplay', {
    'requestHash': Required['str'],
    'ciphertext': Required['str'],
    'expiresAt': Required['str'],
})

BetterPortalConfigPreviewenvironmentdeploymentsItemServicesItem = TypedDict('BetterPortalConfigPreviewenvironmentdeploymentsItemServicesItem', {
    'serviceId': Required['str'],
    'instanceId': Required['str'],
    'url': Required['str'],
})

BetterPortalConfigSharedserviceactivationsItem = TypedDict('BetterPortalConfigSharedserviceactivationsItem', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
    'sharedServiceId': Required['str'],
    'activatedAt': Required['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigSharedservicecatalogItem = TypedDict('BetterPortalConfigSharedservicecatalogItem', {
    'id': Required['str'],
    'serviceId': NotRequired['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'baseUrl': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigPlatformservicesItemAuthprovider'],
    'supportedDeploymentModes': Required["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
    'owner': Required["Literal['bp', '3p']"],
    'upgradeUrlTemplate': NotRequired['str'],
    'category': NotRequired['str'],
    'tags': Required['list[str]'],
    'pricingHint': NotRequired["Literal['free', 'freemium', 'paid']"],
    'publishedAt': NotRequired['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigTenantsItem = TypedDict('BetterPortalConfigTenantsItem', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': Required['bool'],
    'branding': Required['BetterPortalConfigTenantsItemBranding'],
    'services': Required['list[BetterPortalConfigTenantsItemServicesItem]'],
    'activatedPlatformServices': Required['list[str]'],
})

BetterPortalConfigTenantsItemBranding = TypedDict('BetterPortalConfigTenantsItemBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

BetterPortalConfigTenantsItemServicesItem = TypedDict('BetterPortalConfigTenantsItemServicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'apiKeyHash': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigPlatformservicesItemAuthprovider'],
    'capabilities': Required['list[str]'],
    'title': NotRequired['str'],
    'description': NotRequired['str'],
    'deploymentMode': Required["Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']"],
    'createdAt': Required['str'],
    'lastSeenAt': NotRequired['str'],
    'lastSyncAt': NotRequired['str'],
    'enabled': Required['bool'],
})

BetterPortalConfigWebhooks = TypedDict('BetterPortalConfigWebhooks', {
    'targets': Required['list[BetterPortalConfigWebhooksTargetsItem]'],
})

BetterPortalConfigWebhooksTargetsItem = TypedDict('BetterPortalConfigWebhooksTargetsItem', {
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

BpSchemaOutput = TypedDict('BpSchemaOutput', {
    'manifest': Required['PluginManifest'],
    'routes': Required['list[BpSchemaOutputRoutesItem]'],
})

BpSchemaOutputInput = TypedDict('BpSchemaOutputInput', {
    'manifest': Required['PluginManifestInput'],
    'routes': NotRequired['list[BpSchemaOutputInputRoutesItem]'],
})

BpSchemaOutputInputRoutesItem = TypedDict('BpSchemaOutputInputRoutesItem', {
    'viewId': Required['str'],
    'path': Required['str'],
    'pathVariants': NotRequired['list[str]'],
    'operations': Required['list[BpSchemaOutputInputRoutesItemOperationsItem]'],
    'paramNames': NotRequired['list[str]'],
    'renderers': NotRequired['list[str]'],
    'hasFragments': NotRequired['bool'],
    'fragments': NotRequired['list[BpSchemaOutputInputRoutesItemFragmentsItem]'],
    'components': NotRequired['list[str]'],
})

BpSchemaOutputInputRoutesItemFragmentsItem = TypedDict('BpSchemaOutputInputRoutesItemFragmentsItem', {
    'fragmentLocation': Required['str'],
    'fragmentId': Required['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'renderers': NotRequired['list[str]'],
})

BpSchemaOutputInputRoutesItemOperationsItem = TypedDict('BpSchemaOutputInputRoutesItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
})

BpSchemaOutputRoutesItem = TypedDict('BpSchemaOutputRoutesItem', {
    'viewId': Required['str'],
    'path': Required['str'],
    'pathVariants': Required['list[str]'],
    'operations': Required['list[BpSchemaOutputRoutesItemOperationsItem]'],
    'paramNames': Required['list[str]'],
    'renderers': Required['list[str]'],
    'hasFragments': Required['bool'],
    'fragments': Required['list[BpSchemaOutputRoutesItemFragmentsItem]'],
    'components': Required['list[str]'],
})

BpSchemaOutputRoutesItemFragmentsItem = TypedDict('BpSchemaOutputRoutesItemFragmentsItem', {
    'fragmentLocation': Required['str'],
    'fragmentId': Required['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'renderers': Required['list[str]'],
})

BpSchemaOutputRoutesItemOperationsItem = TypedDict('BpSchemaOutputRoutesItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
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
    'scope': Required["Literal['tenant', 'app']"],
    'visibility': Required["Literal['public', 'protected', 'secret']"],
    'ownership': Required["Literal['bp', 'plugin', 'mixed']"],
    'sourceOfTruth': Required["Literal['bp', 'plugin', 'external']"],
    'groupId': NotRequired['str'],
    'order': NotRequired['int'],
    'defaultValue': NotRequired['JsonValue'],
    'ui': NotRequired['ConfigFieldDescriptorUi'],
    'required': Required['bool'],
})

ConfigFieldDescriptorInput = TypedDict('ConfigFieldDescriptorInput', {
    'key': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required["Literal['tenant', 'app']"],
    'visibility': Required["Literal['public', 'protected', 'secret']"],
    'ownership': Required["Literal['bp', 'plugin', 'mixed']"],
    'sourceOfTruth': Required["Literal['bp', 'plugin', 'external']"],
    'groupId': NotRequired['str'],
    'order': NotRequired['int'],
    'defaultValue': NotRequired['JsonValueInput'],
    'ui': NotRequired['ConfigFieldDescriptorInputUi'],
    'required': NotRequired['bool'],
})

ConfigFieldDescriptorInputUi = TypedDict('ConfigFieldDescriptorInputUi', {
    'control': NotRequired["Literal['text', 'textarea', 'password', 'number', 'checkbox', 'select', 'multiselect', 'color', 'date', 'time', 'datetime-local', 'url', 'email']"],
    'placeholder': NotRequired['str'],
    'options': NotRequired['list[ConfigFieldDescriptorInputUiOptionsItem]'],
    'optionsSource': NotRequired["Literal['app.routes']"],
    'min': NotRequired['Union[float, str]'],
    'max': NotRequired['Union[float, str]'],
    'step': NotRequired['float'],
    'rows': NotRequired['int'],
})

ConfigFieldDescriptorInputUiOptionsItem = TypedDict('ConfigFieldDescriptorInputUiOptionsItem', {
    'value': Required['str'],
    'label': Required['str'],
})

ConfigFieldDescriptorUi = TypedDict('ConfigFieldDescriptorUi', {
    'control': NotRequired["Literal['text', 'textarea', 'password', 'number', 'checkbox', 'select', 'multiselect', 'color', 'date', 'time', 'datetime-local', 'url', 'email']"],
    'placeholder': NotRequired['str'],
    'options': NotRequired['list[ConfigFieldDescriptorUiOptionsItem]'],
    'optionsSource': NotRequired["Literal['app.routes']"],
    'min': NotRequired['Union[float, str]'],
    'max': NotRequired['Union[float, str]'],
    'step': NotRequired['float'],
    'rows': NotRequired['int'],
})

ConfigFieldDescriptorUiOptionsItem = TypedDict('ConfigFieldDescriptorUiOptionsItem', {
    'value': Required['str'],
    'label': Required['str'],
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
    'scope': Required["Literal['tenant', 'app']"],
    'jsonSchema': Required['JsonObject'],
    'groups': NotRequired['list[ConfigSchemaDescriptorGroupsItem]'],
    'fields': Required['list[ConfigFieldDescriptor]'],
})

ConfigSchemaDescriptorGroupsItem = TypedDict('ConfigSchemaDescriptorGroupsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'order': NotRequired['int'],
    'optional': NotRequired['bool'],
})

ConfigSchemaDescriptorInput = TypedDict('ConfigSchemaDescriptorInput', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'scope': Required["Literal['tenant', 'app']"],
    'jsonSchema': Required['JsonObjectInput'],
    'groups': NotRequired['list[ConfigSchemaDescriptorInputGroupsItem]'],
    'fields': NotRequired['list[ConfigFieldDescriptorInput]'],
})

ConfigSchemaDescriptorInputGroupsItem = TypedDict('ConfigSchemaDescriptorInputGroupsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'order': NotRequired['int'],
    'optional': NotRequired['bool'],
})

ConfigScope: TypeAlias = "Literal['tenant', 'app']"

ConfigScopeInput: TypeAlias = "Literal['tenant', 'app']"

ConfigVisibility: TypeAlias = "Literal['public', 'protected', 'secret']"

ConfigVisibilityInput: TypeAlias = "Literal['public', 'protected', 'secret']"

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
    'realm': Required["Literal['runtime', 'control-plane']"],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'roles': Required['list[str]'],
    'tokenType': Required["Literal['access', 'refresh', 'cp-envelope', 'setup', 'install']"],
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
    'realm': Required["Literal['runtime', 'control-plane']"],
    'tenantId': Required['str'],
    'appId': Required['str'],
    'roles': NotRequired['list[str]'],
    'tokenType': Required["Literal['access', 'refresh', 'cp-envelope', 'setup', 'install']"],
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
    'category': Required["Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"],
    'deploymentModes': Required["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
    'capabilities': Required['list[str]'],
    'supportedRenderers': Required['list[str]'],
    'supportedRenderModes': Required["list[Literal['page', 'fragment', 'embed']]"],
    'views': Required['list[ViewMetadata]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'permissions': Required['list[PluginManifestPermissionsItem]'],
    'adminApis': Required['list[PluginManifestAdminapisItem]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'apiContracts': Required['list[PluginManifestApicontractsItem]'],
    'm2mRequests': Required['list[PluginManifestM2mrequestsItem]'],
    'developerResources': Required['list[PluginManifestDeveloperresourcesItem]'],
    'shell': NotRequired['PluginManifestShell'],
    'cacheHints': Required['PluginManifestCachehints'],
})

PluginManifestAdminapisItem = TypedDict('PluginManifestAdminapisItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']]"],
    'supportsCustomUi': Required['bool'],
})

PluginManifestApicontractsItem = TypedDict('PluginManifestApicontractsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'viewId': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'capabilities': Required['list[str]'],
    'permissions': Required['list[str]'],
    'modes': Required["list[Literal['service', 'delegated']]"],
})

PluginManifestCachehints = TypedDict('PluginManifestCachehints', {
    'metadataTtlSeconds': Required['int'],
})

PluginManifestDeveloperresourcesItem = TypedDict('PluginManifestDeveloperresourcesItem', {
    'id': Required['str'],
    'kind': Required["Literal['guide', 'template', 'skill', 'example']"],
    'title': Required['str'],
    'description': NotRequired['str'],
    'mediaType': Required['str'],
    'language': NotRequired['str'],
    'content': Required['str'],
})

PluginManifestInput = TypedDict('PluginManifestInput', {
    'protocolVersion': Required['Literal[2]'],
    'pluginId': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'version': Required['str'],
    'category': Required["Literal['framework', 'auth', 'theme', 'service', 'utility', 'integration']"],
    'deploymentModes': Required["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
    'capabilities': NotRequired['list[str]'],
    'supportedRenderers': NotRequired['list[str]'],
    'supportedRenderModes': NotRequired["list[Literal['page', 'fragment', 'embed']]"],
    'views': NotRequired['list[ViewMetadataInput]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'permissions': NotRequired['list[PluginManifestInputPermissionsItem]'],
    'adminApis': NotRequired['list[PluginManifestInputAdminapisItem]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'apiContracts': NotRequired['list[PluginManifestInputApicontractsItem]'],
    'm2mRequests': NotRequired['list[PluginManifestInputM2mrequestsItem]'],
    'developerResources': NotRequired['list[PluginManifestInputDeveloperresourcesItem]'],
    'shell': NotRequired['PluginManifestInputShell'],
    'cacheHints': NotRequired['PluginManifestInputCachehints'],
})

PluginManifestInputAdminapisItem = TypedDict('PluginManifestInputAdminapisItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'path': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']]"],
    'supportsCustomUi': NotRequired['bool'],
})

PluginManifestInputApicontractsItem = TypedDict('PluginManifestInputApicontractsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'version': Required['str'],
    'viewId': Required['str'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'capabilities': NotRequired['list[str]'],
    'permissions': NotRequired['list[str]'],
    'modes': NotRequired["list[Literal['service', 'delegated']]"],
})

PluginManifestInputCachehints = TypedDict('PluginManifestInputCachehints', {
    'metadataTtlSeconds': NotRequired['int'],
})

PluginManifestInputDeveloperresourcesItem = TypedDict('PluginManifestInputDeveloperresourcesItem', {
    'id': Required['str'],
    'kind': Required["Literal['guide', 'template', 'skill', 'example']"],
    'title': Required['str'],
    'description': NotRequired['str'],
    'mediaType': Required['str'],
    'language': NotRequired['str'],
    'content': Required['str'],
})

PluginManifestInputM2mrequestsItem = TypedDict('PluginManifestInputM2mrequestsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'contractId': Required['str'],
    'version': NotRequired['str'],
    'requiredCapabilities': NotRequired['list[str]'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'permissions': NotRequired['list[str]'],
    'mode': NotRequired["Literal['service', 'delegated']"],
    'optional': NotRequired['bool'],
})

PluginManifestInputPermissionsItem = TypedDict('PluginManifestInputPermissionsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'defaultRoles': NotRequired['list[str]'],
})

PluginManifestInputShell = TypedDict('PluginManifestInputShell', {
    'service': Required['str'],
    'renderer': Required['str'],
    'fragments': NotRequired['list[PluginManifestInputShellFragmentsItem]'],
})

PluginManifestInputShellFragmentsItem = TypedDict('PluginManifestInputShellFragmentsItem', {
    'id': Required['str'],
    'kind': Required["Literal['fragment', 'block']"],
    'title': Required['str'],
    'description': Required['str'],
    'defaultItems': NotRequired['list[str]'],
})

PluginManifestM2mrequestsItem = TypedDict('PluginManifestM2mrequestsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'contractId': Required['str'],
    'version': NotRequired['str'],
    'requiredCapabilities': Required['list[str]'],
    'methods': Required["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'permissions': Required['list[str]'],
    'mode': Required["Literal['service', 'delegated']"],
    'optional': Required['bool'],
})

PluginManifestPermissionsItem = TypedDict('PluginManifestPermissionsItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': Required['str'],
    'defaultRoles': Required['list[str]'],
})

PluginManifestShell = TypedDict('PluginManifestShell', {
    'service': Required['str'],
    'renderer': Required['str'],
    'fragments': Required['list[PluginManifestShellFragmentsItem]'],
})

PluginManifestShellFragmentsItem = TypedDict('PluginManifestShellFragmentsItem', {
    'id': Required['str'],
    'kind': Required["Literal['fragment', 'block']"],
    'title': Required['str'],
    'description': Required['str'],
    'defaultItems': Required['list[str]'],
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
    'oidc': NotRequired['PreviewEnvironmentGroupOidc'],
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
    'oidc': NotRequired['PreviewEnvironmentGroupInputOidc'],
    'services': NotRequired['list[PreviewEnvironmentGroupServiceInput]'],
    'createdAt': Required['str'],
    'updatedAt': Required['str'],
})

PreviewEnvironmentGroupInputOidc = TypedDict('PreviewEnvironmentGroupInputOidc', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'subjectPrefix': NotRequired['str'],
    'requiredClaims': NotRequired['dict[str, str]'],
})

PreviewEnvironmentGroupOidc = TypedDict('PreviewEnvironmentGroupOidc', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'subjectPrefix': NotRequired['str'],
    'requiredClaims': Required['dict[str, str]'],
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

RenderMode: TypeAlias = "Literal['page', 'fragment', 'embed']"

RenderModeInput: TypeAlias = "Literal['page', 'fragment', 'embed']"

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
    'tenants': Required['list[ScopedServiceConfigConfigmanagementContextTenant]'],
    'configApps': NotRequired['list[ScopedServiceConfigConfigappsItem]'],
    'apps': Required['list[ScopedServiceConfigConfigmanagementContextApp]'],
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
    'tenant': Required['ScopedServiceConfigConfigmanagementContextTenant'],
    'app': Required['ScopedServiceConfigConfigmanagementContextApp'],
})

ScopedServiceConfigConfigmanagementContextApp = TypedDict('ScopedServiceConfigConfigmanagementContextApp', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': Required['list[str]'],
    'refererOverrides': Required['list[str]'],
    'themeConfig': Required['ScopedServiceConfigConfigmanagementContextAppThemeconfig'],
    'defaultRoute': Required['str'],
    'seo': NotRequired['ScopedServiceConfigConfigmanagementContextAppSeo'],
    'routes': Required['list[ScopedServiceConfigConfigmanagementContextAppRoutesItem]'],
    'menu': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItem]'],
    'slots': Required['list[ScopedServiceConfigConfigmanagementContextAppSlotsItem]'],
    'fragments': Required['dict[str, list[BetterPortalConfigAppsItemFragmentsItemItem]]'],
    'shellFragments': Required['dict[str, dict[str, Union[BetterPortalConfigAppsItemShellfragmentsItemItemVariant1, BetterPortalConfigAppsItemShellfragmentsItemItemVariant2, BetterPortalConfigAppsItemShellfragmentsItemItemVariant3]]]'],
    'auth': NotRequired['ScopedServiceConfigConfigmanagementContextAppAuth'],
    'shell': NotRequired['ScopedServiceConfigConfigmanagementContextAppShell'],
    'appRoutes': NotRequired['list[BetterPortalConfigAppsItemRoutesItem]'],
    'appFragments': NotRequired['dict[str, list[BetterPortalConfigAppsItemFragmentsItemItem]]'],
})

ScopedServiceConfigConfigmanagementContextAppAuth = TypedDict('ScopedServiceConfigConfigmanagementContextAppAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[BetterPortalConfigAppsItemAuthProviderVariant1, ScopedServiceConfigConfigmanagementContextAppAuthProviderVariant2]'],
    'roleAuthority': NotRequired["Literal['provider', 'betterportal']"],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['ScopedServiceConfigConfigmanagementContextAppAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigPlatformservicesItemAuthproviderPublickeys'],
    'roles': Required['list[ScopedServiceConfigConfigmanagementContextAppAuthRolesItem]'],
})

ScopedServiceConfigConfigmanagementContextAppAuthProviderVariant2 = TypedDict('ScopedServiceConfigConfigmanagementContextAppAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': Required['str'],
    'subjectClaimPath': Required['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

ScopedServiceConfigConfigmanagementContextAppAuthRedirects = TypedDict('ScopedServiceConfigConfigmanagementContextAppAuthRedirects', {
    'afterLogin': NotRequired['BetterPortalConfigAppsItemAuthRedirectsAfterlogin'],
    'afterLogout': NotRequired['BetterPortalConfigAppsItemAuthRedirectsAfterlogin'],
})

ScopedServiceConfigConfigmanagementContextAppAuthRolesItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': Required['list[BetterPortalConfigAppsItemAuthRolesItemPermissionsItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': Required['list[ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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

ScopedServiceConfigConfigmanagementContextAppRoutesItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppRoutesItem', {
    'id': Required['str'],
    'kind': Required["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['ScopedServiceConfigConfigmanagementContextAppRoutesItemSitemap'],
    'robots': NotRequired['list[ScopedServiceConfigConfigmanagementContextAppRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': Required['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
})

ScopedServiceConfigConfigmanagementContextAppRoutesItemRobotsItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

ScopedServiceConfigConfigmanagementContextAppRoutesItemSitemap = TypedDict('ScopedServiceConfigConfigmanagementContextAppRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

ScopedServiceConfigConfigmanagementContextAppSeo = TypedDict('ScopedServiceConfigConfigmanagementContextAppSeo', {
    'visibility': Required["Literal['auto', 'public', 'private']"],
    'serviceFailure': Required["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': Required["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

ScopedServiceConfigConfigmanagementContextAppShell = TypedDict('ScopedServiceConfigConfigmanagementContextAppShell', {
    'serviceId': Required['str'],
    'service': Required['str'],
    'renderer': Required['str'],
})

ScopedServiceConfigConfigmanagementContextAppSlotsItem = TypedDict('ScopedServiceConfigConfigmanagementContextAppSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': Required['bool'],
})

ScopedServiceConfigConfigmanagementContextAppThemeconfig = TypedDict('ScopedServiceConfigConfigmanagementContextAppThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': Required["Literal['light', 'dark', 'system']"],
    'bootstrap': Required['ScopedServiceConfigConfigmanagementContextAppThemeconfigBootstrap'],
    'light': Required['ScopedServiceConfigConfigmanagementContextAppThemeconfigLight'],
    'dark': Required['ScopedServiceConfigConfigmanagementContextAppThemeconfigLight'],
})

ScopedServiceConfigConfigmanagementContextAppThemeconfigBootstrap = TypedDict('ScopedServiceConfigConfigmanagementContextAppThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

ScopedServiceConfigConfigmanagementContextAppThemeconfigLight = TypedDict('ScopedServiceConfigConfigmanagementContextAppThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

ScopedServiceConfigConfigmanagementContextTenant = TypedDict('ScopedServiceConfigConfigmanagementContextTenant', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': Required['bool'],
    'branding': Required['ScopedServiceConfigConfigmanagementContextTenantBranding'],
    'activatedPlatformServices': Required['list[str]'],
    'services': Required['list[ScopedServiceConfigConfigmanagementContextTenantServicesItem]'],
})

ScopedServiceConfigConfigmanagementContextTenantBranding = TypedDict('ScopedServiceConfigConfigmanagementContextTenantBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

ScopedServiceConfigConfigmanagementContextTenantServicesItem = TypedDict('ScopedServiceConfigConfigmanagementContextTenantServicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['ScopedServiceConfigConfigmanagementContextTenantServicesItemAuthprovider'],
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

ScopedServiceConfigConfigmanagementContextTenantServicesItemAuthprovider = TypedDict('ScopedServiceConfigConfigmanagementContextTenantServicesItemAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigPlatformservicesItemAuthproviderPublickeys'],
})

ScopedServiceConfigInput = TypedDict('ScopedServiceConfigInput', {
    'serviceIdentity': NotRequired['ScopedServiceConfigInputServiceidentity'],
    'm2m': NotRequired['ScopedServiceConfigInputM2m'],
    'previewConfig': NotRequired['ScopedServiceConfigInputPreviewconfig'],
    'configManagement': NotRequired['ScopedServiceConfigInputConfigmanagement'],
    'managementOrigins': Required['list[str]'],
    'tenants': Required['list[ScopedServiceConfigInputConfigmanagementContextTenant]'],
    'configApps': NotRequired['list[ScopedServiceConfigInputConfigappsItem]'],
    'apps': Required['list[ScopedServiceConfigInputConfigmanagementContextApp]'],
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
    'tenant': Required['ScopedServiceConfigInputConfigmanagementContextTenant'],
    'app': Required['ScopedServiceConfigInputConfigmanagementContextApp'],
})

ScopedServiceConfigInputConfigmanagementContextApp = TypedDict('ScopedServiceConfigInputConfigmanagementContextApp', {
    'id': Required['str'],
    'tenantId': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'hostnames': Required['list[str]'],
    'originOverrides': NotRequired['list[str]'],
    'refererOverrides': NotRequired['list[str]'],
    'themeConfig': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppThemeconfig'],
    'defaultRoute': NotRequired['str'],
    'seo': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppSeo'],
    'routes': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppRoutesItem]'],
    'menu': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItem]'],
    'slots': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppSlotsItem]'],
    'fragments': NotRequired['dict[str, list[BetterPortalConfigInputAppsItemFragmentsItemItem]]'],
    'shellFragments': NotRequired['dict[str, dict[str, Union[BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant1, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant2, BetterPortalConfigInputAppsItemShellfragmentsItemItemVariant3]]]'],
    'auth': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppAuth'],
    'shell': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppShell'],
    'appRoutes': NotRequired['list[BetterPortalConfigInputAppsItemRoutesItem]'],
    'appFragments': NotRequired['dict[str, list[BetterPortalConfigInputAppsItemFragmentsItemItem]]'],
})

ScopedServiceConfigInputConfigmanagementContextAppAuth = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppAuth', {
    'serviceId': Required['str'],
    'provider': NotRequired['Union[BetterPortalConfigInputAppsItemAuthProviderVariant1, ScopedServiceConfigInputConfigmanagementContextAppAuthProviderVariant2]'],
    'roleAuthority': NotRequired["Literal['provider', 'betterportal']"],
    'loginViewId': NotRequired['str'],
    'logoutViewId': NotRequired['str'],
    'refreshViewId': NotRequired['str'],
    'redirects': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppAuthRedirects'],
    'expectedIssuer': Required['str'],
    'expectedAudience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys'],
    'roles': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppAuthRolesItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppAuthProviderVariant2 = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppAuthProviderVariant2', {
    'kind': Required["Literal['authress.io']"],
    'roleClaimPath': NotRequired['str'],
    'subjectClaimPath': NotRequired['str'],
    'nameClaimPath': NotRequired['str'],
    'emailClaimPath': NotRequired['str'],
    'pictureClaimPath': NotRequired['str'],
})

ScopedServiceConfigInputConfigmanagementContextAppAuthRedirects = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppAuthRedirects', {
    'afterLogin': NotRequired['BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin'],
    'afterLogout': NotRequired['BetterPortalConfigInputAppsItemAuthRedirectsAfterlogin'],
})

ScopedServiceConfigInputConfigmanagementContextAppAuthRolesItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppAuthRolesItem', {
    'id': Required['str'],
    'title': Required['str'],
    'description': NotRequired['str'],
    'permissions': NotRequired['list[BetterPortalConfigInputAppsItemAuthRolesItemPermissionsItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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
    'children': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem]'],
})

ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppMenuItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItemChildrenItem', {
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

ScopedServiceConfigInputConfigmanagementContextAppRoutesItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppRoutesItem', {
    'id': Required['str'],
    'kind': NotRequired["Literal['page', 'api']"],
    'path': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'servicePathVariant': NotRequired['str'],
    'fixedParams': NotRequired['dict[str, str]'],
    'authRequired': NotRequired['bool'],
    'sitemap': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppRoutesItemSitemap'],
    'robots': NotRequired['list[ScopedServiceConfigInputConfigmanagementContextAppRoutesItemRobotsItem]'],
    'targetPath': NotRequired['str'],
    'resolvedServicePath': NotRequired['str'],
    'resolvedMethods': NotRequired["list[Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']]"],
    'query': NotRequired['str'],
    'title': NotRequired['str'],
    'icon': NotRequired['str'],
    'enabled': NotRequired['bool'],
    'enablement': NotRequired["Literal['auto', 'enabled', 'disabled']"],
    'operations': Required['list[str]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
})

ScopedServiceConfigInputConfigmanagementContextAppRoutesItemRobotsItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppRoutesItemRobotsItem', {
    'userAgent': Required['str'],
    'access': Required["Literal['allow', 'disallow']"],
    'crawlDelaySeconds': NotRequired['int'],
})

ScopedServiceConfigInputConfigmanagementContextAppRoutesItemSitemap = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppRoutesItemSitemap', {
    'kind': Required["Literal['default', 'exclude', 'metadata', 'provider']"],
    'lastModified': NotRequired['str'],
    'changeFrequency': NotRequired["Literal['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']"],
    'priority': NotRequired['float'],
})

ScopedServiceConfigInputConfigmanagementContextAppSeo = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppSeo', {
    'visibility': NotRequired["Literal['auto', 'public', 'private']"],
    'serviceFailure': NotRequired["Literal['known-routes', 'omit-service', 'error']"],
    'serviceCache': NotRequired["Literal['none', '1h', '24h', '7d']"],
    'canonicalOrigin': NotRequired['str'],
})

ScopedServiceConfigInputConfigmanagementContextAppShell = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppShell', {
    'serviceId': Required['str'],
    'service': Required['str'],
    'renderer': Required['str'],
})

ScopedServiceConfigInputConfigmanagementContextAppSlotsItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppSlotsItem', {
    'slotId': Required['str'],
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'renderer': NotRequired['str'],
    'enabled': NotRequired['bool'],
})

ScopedServiceConfigInputConfigmanagementContextAppThemeconfig = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppThemeconfig', {
    'brandName': NotRequired['str'],
    'documentTitle': NotRequired['str'],
    'lightLogoUrl': NotRequired['str'],
    'darkLogoUrl': NotRequired['str'],
    'faviconUrl': NotRequired['str'],
    'mode': NotRequired["Literal['light', 'dark', 'system']"],
    'bootstrap': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppThemeconfigBootstrap'],
    'light': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppThemeconfigLight'],
    'dark': NotRequired['ScopedServiceConfigInputConfigmanagementContextAppThemeconfigLight'],
})

ScopedServiceConfigInputConfigmanagementContextAppThemeconfigBootstrap = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppThemeconfigBootstrap', {
    'primary': NotRequired['str'],
    'secondary': NotRequired['str'],
    'success': NotRequired['str'],
    'info': NotRequired['str'],
    'warning': NotRequired['str'],
    'danger': NotRequired['str'],
    'light': NotRequired['str'],
    'dark': NotRequired['str'],
})

ScopedServiceConfigInputConfigmanagementContextAppThemeconfigLight = TypedDict('ScopedServiceConfigInputConfigmanagementContextAppThemeconfigLight', {
    'background': NotRequired['str'],
    'surface': NotRequired['str'],
    'surfaceAlt': NotRequired['str'],
    'text': NotRequired['str'],
    'textSoft': NotRequired['str'],
    'border': NotRequired['str'],
    'accentSoft': NotRequired['str'],
})

ScopedServiceConfigInputConfigmanagementContextTenant = TypedDict('ScopedServiceConfigInputConfigmanagementContextTenant', {
    'id': Required['str'],
    'slug': Required['str'],
    'title': Required['str'],
    'active': NotRequired['bool'],
    'branding': NotRequired['ScopedServiceConfigInputConfigmanagementContextTenantBranding'],
    'activatedPlatformServices': NotRequired['list[str]'],
    'services': Required['list[ScopedServiceConfigInputConfigmanagementContextTenantServicesItem]'],
})

ScopedServiceConfigInputConfigmanagementContextTenantBranding = TypedDict('ScopedServiceConfigInputConfigmanagementContextTenantBranding', {
    'brandName': NotRequired['str'],
    'logoUrl': NotRequired['str'],
    'primaryColor': NotRequired['str'],
    'secondaryColor': NotRequired['str'],
})

ScopedServiceConfigInputConfigmanagementContextTenantServicesItem = TypedDict('ScopedServiceConfigInputConfigmanagementContextTenantServicesItem', {
    'id': Required['str'],
    'hostname': Required['str'],
    'publicKeyPem': NotRequired['str'],
    'keyId': NotRequired['str'],
    'serviceId': NotRequired['str'],
    'authProvider': NotRequired['ScopedServiceConfigInputConfigmanagementContextTenantServicesItemAuthprovider'],
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

ScopedServiceConfigInputConfigmanagementContextTenantServicesItemAuthprovider = TypedDict('ScopedServiceConfigInputConfigmanagementContextTenantServicesItemAuthprovider', {
    'issuer': Required['str'],
    'audience': Required['str'],
    'jwksUri': Required['str'],
    'publicKeys': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthproviderPublickeys'],
})

ScopedServiceConfigInputM2m = TypedDict('ScopedServiceConfigInputM2m', {
    'localServiceIds': Required['list[str]'],
    'services': Required['list[ScopedServiceConfigInputM2mServicesItem]'],
    'bindings': Required['list[BetterPortalConfigInputM2mBindingsItem]'],
    'grants': Required['list[BetterPortalConfigInputM2mGrantsItem]'],
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
    'bindings': Required['list[BetterPortalConfigM2mBindingsItem]'],
    'grants': Required['list[BetterPortalConfigM2mGrantsItem]'],
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
    'deploymentModes': Required["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
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
    'deploymentModes': Required["list[Literal['bp-hosted', 'customer-hosted', 'third-party-saas', 'self-hosted', 'saas-managed']]"],
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
    'mode': Required["Literal['static', 'bp-managed', 'hybrid']"],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'supportsCustomUi': Required['bool'],
    'customUiPath': NotRequired['str'],
    'supportsWrite': Required['bool'],
})

ServiceConfigSchemaResponseInput = TypedDict('ServiceConfigSchemaResponseInput', {
    'serviceId': Required['str'],
    'mode': Required["Literal['static', 'bp-managed', 'hybrid']"],
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

ServiceManifestCacheEntry = TypedDict('ServiceManifestCacheEntry', {
    'serviceId': Required['str'],
    'manifestVersion': Required['str'],
    'fetchedAt': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigPlatformservicesItemAuthprovider'],
    'capabilities': Required['list[str]'],
    'm2mRequests': Required['list[PluginManifestM2mrequestsItem]'],
    'apiContracts': Required['list[PluginManifestApicontractsItem]'],
    'developerResources': Required['list[PluginManifestDeveloperresourcesItem]'],
    'configSchemas': Required['list[ConfigSchemaDescriptor]'],
    'webhooks': Required['list[WebhookEventDescriptor]'],
    'shell': NotRequired['PluginManifestShell'],
    'viewIndex': Required['dict[str, ServiceManifestCacheEntryViewindexItem]'],
})

ServiceManifestCacheEntryInput = TypedDict('ServiceManifestCacheEntryInput', {
    'serviceId': Required['str'],
    'manifestVersion': Required['str'],
    'fetchedAt': Required['str'],
    'title': NotRequired['str'],
    'authProvider': NotRequired['BetterPortalConfigInputPlatformservicesItemAuthprovider'],
    'capabilities': NotRequired['list[str]'],
    'm2mRequests': NotRequired['list[PluginManifestInputM2mrequestsItem]'],
    'apiContracts': NotRequired['list[PluginManifestInputApicontractsItem]'],
    'developerResources': NotRequired['list[PluginManifestInputDeveloperresourcesItem]'],
    'configSchemas': NotRequired['list[ConfigSchemaDescriptorInput]'],
    'webhooks': NotRequired['list[WebhookEventDescriptorInput]'],
    'shell': NotRequired['PluginManifestInputShell'],
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
    'fragments': NotRequired['list[ServiceManifestCacheEntryInputViewindexItemFragmentsItem]'],
})

ServiceManifestCacheEntryInputViewindexItemFragmentsItem = TypedDict('ServiceManifestCacheEntryInputViewindexItemFragmentsItem', {
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
})

ServiceManifestCacheEntryInputViewindexItemOperationsItem = TypedDict('ServiceManifestCacheEntryInputViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': NotRequired['list[str]'],
    'renderModes': NotRequired["list[Literal['page', 'fragment', 'embed']]"],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalConfigInputAppsItemRoutesItemSitemap'],
    'robots': NotRequired['list[BetterPortalConfigInputAppsItemRoutesItemRobotsItem]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
    'dependencies': NotRequired['list[ServiceManifestCacheEntryInputViewindexItemOperationsItemDependenciesItem]'],
    'permissions': NotRequired['list[ServiceManifestCacheEntryInputViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ServiceManifestCacheEntryInputViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': NotRequired['list[PluginManifestInputApicontractsItem]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
})

ServiceManifestCacheEntryInputViewindexItemOperationsItemDependenciesItem = TypedDict('ServiceManifestCacheEntryInputViewindexItemOperationsItemDependenciesItem', {
    'serviceId': NotRequired['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
})

ServiceManifestCacheEntryInputViewindexItemOperationsItemPermissionsItem = TypedDict('ServiceManifestCacheEntryInputViewindexItemOperationsItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': NotRequired['list[str]'],
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
    'fragments': Required['list[ServiceManifestCacheEntryViewindexItemFragmentsItem]'],
})

ServiceManifestCacheEntryViewindexItemFragmentsItem = TypedDict('ServiceManifestCacheEntryViewindexItemFragmentsItem', {
    'fragmentId': Required['str'],
    'targetPath': Required['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
})

ServiceManifestCacheEntryViewindexItemOperationsItem = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItem', {
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
    'title': Required['str'],
    'description': Required['str'],
    'renderers': Required['list[str]'],
    'renderModes': Required["list[Literal['page', 'fragment', 'embed']]"],
    'role': NotRequired['str'],
    'authRequired': Required['bool'],
    'sitemap': NotRequired['BetterPortalConfigAppsItemRoutesItemSitemap'],
    'robots': Required['list[BetterPortalConfigAppsItemRoutesItemRobotsItem]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
    'dependencies': Required['list[ServiceManifestCacheEntryViewindexItemOperationsItemDependenciesItem]'],
    'permissions': Required['list[ServiceManifestCacheEntryViewindexItemOperationsItemPermissionsItem]'],
    'renderable': Required['bool'],
    'schemas': NotRequired['ServiceManifestCacheEntryViewindexItemOperationsItemSchemas'],
    'raw': NotRequired['bool'],
    'apiContracts': Required['list[PluginManifestApicontractsItem]'],
    'demoScenarios': Required['list[DemoScenario]'],
})

ServiceManifestCacheEntryViewindexItemOperationsItemDependenciesItem = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItemDependenciesItem', {
    'serviceId': NotRequired['str'],
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
})

ServiceManifestCacheEntryViewindexItemOperationsItemPermissionsItem = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItemPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required['list[str]'],
})

ServiceManifestCacheEntryViewindexItemOperationsItemSchemas = TypedDict('ServiceManifestCacheEntryViewindexItemOperationsItemSchemas', {
    'query': NotRequired['JsonObject'],
    'headers': NotRequired['JsonObject'],
    'request': NotRequired['JsonObject'],
    'multipart': NotRequired['JsonObject'],
    'response': NotRequired['JsonObject'],
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
    'scope': NotRequired['SetupTokenClaimsScope'],
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
    'scope': NotRequired['SetupTokenClaimsInputScope'],
})

SetupTokenClaimsInputScope = TypedDict('SetupTokenClaimsInputScope', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
})

SetupTokenClaimsScope = TypedDict('SetupTokenClaimsScope', {
    'tenantId': Required['str'],
    'appId': NotRequired['str'],
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
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
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
    'html': Required['ViewOperationMetadataHtml'],
    'auth': Required['ViewOperationMetadataAuth'],
    'sitemap': NotRequired['BetterPortalConfigAppsItemRoutesItemSitemap'],
    'robots': Required['list[BetterPortalConfigAppsItemRoutesItemRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': Required['list[ServiceManifestCacheEntryViewindexItemOperationsItemDependenciesItem]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
    'apiContracts': Required['list[PluginManifestApicontractsItem]'],
    'demoScenarios': Required['list[DemoScenario]'],
    'cacheHints': Required['ViewOperationMetadataCachehints'],
})

ViewOperationMetadataAuth = TypedDict('ViewOperationMetadataAuth', {
    'required': Required['bool'],
    'callers': Required["list[Literal['user', 'service', 'delegated']]"],
    'permissions': Required['list[ViewOperationMetadataAuthPermissionsItem]'],
})

ViewOperationMetadataAuthPermissionsItem = TypedDict('ViewOperationMetadataAuthPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required["list[Literal['read', 'create', 'update', 'delete']]"],
})

ViewOperationMetadataCachehints = TypedDict('ViewOperationMetadataCachehints', {
    'ttlSeconds': Required['int'],
    'varyBy': Required['list[str]'],
})

ViewOperationMetadataHtml = TypedDict('ViewOperationMetadataHtml', {
    'renderers': Required['dict[str, ViewOperationMetadataHtmlRenderersItem]'],
})

ViewOperationMetadataHtmlRenderersItem = TypedDict('ViewOperationMetadataHtmlRenderersItem', {
    'defaultRenderer': Required['str'],
    'renderModes': Required["list[Literal['page', 'fragment', 'embed']]"],
    'slots': Required['list[str]'],
    'renderers': Required['list[ViewOperationMetadataHtmlRenderersItemRenderersItem]'],
})

ViewOperationMetadataHtmlRenderersItemRenderersItem = TypedDict('ViewOperationMetadataHtmlRenderersItemRenderersItem', {
    'id': Required['str'],
    'title': Required['str'],
    'slotId': Required['str'],
    'renderModes': Required["list[Literal['page', 'fragment', 'embed']]"],
})

ViewOperationMetadataInput = TypedDict('ViewOperationMetadataInput', {
    'operationId': Required['str'],
    'method': Required["Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']"],
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
    'html': Required['ViewOperationMetadataInputHtml'],
    'auth': Required['ViewOperationMetadataInputAuth'],
    'sitemap': NotRequired['BetterPortalConfigInputAppsItemRoutesItemSitemap'],
    'robots': NotRequired['list[BetterPortalConfigInputAppsItemRoutesItemRobotsItem]'],
    'role': NotRequired['str'],
    'dependencies': NotRequired['list[ServiceManifestCacheEntryInputViewindexItemOperationsItemDependenciesItem]'],
    'chrome': NotRequired['dict[str, Union[str, float, bool]]'],
    'apiContracts': NotRequired['list[PluginManifestInputApicontractsItem]'],
    'demoScenarios': NotRequired['list[DemoScenarioInput]'],
    'cacheHints': Required['ViewOperationMetadataInputCachehints'],
})

ViewOperationMetadataInputAuth = TypedDict('ViewOperationMetadataInputAuth', {
    'required': NotRequired['bool'],
    'callers': NotRequired["list[Literal['user', 'service', 'delegated']]"],
    'permissions': NotRequired['list[ViewOperationMetadataInputAuthPermissionsItem]'],
})

ViewOperationMetadataInputAuthPermissionsItem = TypedDict('ViewOperationMetadataInputAuthPermissionsItem', {
    'serviceId': Required['str'],
    'viewId': Required['str'],
    'permissions': Required["list[Literal['read', 'create', 'update', 'delete']]"],
})

ViewOperationMetadataInputCachehints = TypedDict('ViewOperationMetadataInputCachehints', {
    'ttlSeconds': NotRequired['int'],
    'varyBy': NotRequired['list[str]'],
})

ViewOperationMetadataInputHtml = TypedDict('ViewOperationMetadataInputHtml', {
    'renderers': NotRequired['dict[str, ViewOperationMetadataInputHtmlRenderersItem]'],
})

ViewOperationMetadataInputHtmlRenderersItem = TypedDict('ViewOperationMetadataInputHtmlRenderersItem', {
    'defaultRenderer': NotRequired['str'],
    'renderModes': NotRequired["list[Literal['page', 'fragment', 'embed']]"],
    'slots': NotRequired['list[str]'],
    'renderers': NotRequired['list[ViewOperationMetadataInputHtmlRenderersItemRenderersItem]'],
})

ViewOperationMetadataInputHtmlRenderersItemRenderersItem = TypedDict('ViewOperationMetadataInputHtmlRenderersItemRenderersItem', {
    'id': Required['str'],
    'title': Required['str'],
    'slotId': Required['str'],
    'renderModes': NotRequired["list[Literal['page', 'fragment', 'embed']]"],
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
