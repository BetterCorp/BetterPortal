import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import {
  BetterPortalConfigSchema,
  BPService,
  type BPServiceDefinition
} from "@betterportal/plugin-bsb";
import { WorkOS, type AuthenticationResponse, type OrganizationMembership, type Session } from "@workos-inc/node";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  htmlResponse,
  jsonResponse,
  createBpTokenIssuer,
  eventObservability,
  loadOrGenerateKeyPair,
  publicKeyToJwk,
  type AppAuthPermissionAction,
  type AppAuthRole,
  type BetterPortalEvent,
  type RouteHandlerContext,
  type BetterPortalRouteMount,
  type BpTokenIssuer,
  type ConfigSchemaDescriptor,
  type JsonValue,
  type JwtClaims,
  type JwtVerifier,
  type RsaKeyPair,
  type ServiceConfigTicketClaims,
  type TenantAppValidation
} from "@betterportal/framework";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { registry } from "./.bp-generated/registry.js";

const SERVICE_ID = "org.betterportal.auth.workos";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3213),
  issuer: av.string().minLength(1),
  audience: av.string().minLength(1).default("betterportal-runtime"),
  accessTokenSeconds: av.int().min(1).default(60 * 15),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7),
  keyStorePath: av.string().minLength(1).default("./.bp-workos-state/keys.json"),
  workosStatePath: av.string().minLength(1).default("./workos-state.json"),
  syncIntervalSeconds: av.int().min(60).default(60 * 60 * 6),
  betterportal: BetterPortalConfigSchema
}, { unknownKeys: "strip" });
export type WorkOSPluginConfig = av.Infer<typeof PluginConfigSchema>;

const Config = createConfigSchema(
  {
    name: SERVICE_ID,
    description: "BetterPortal WorkOS auth service",
    tags: ["betterportal", "auth", "workos"],
    documentation: ["./README.md"],
    image: "./betterportal-logo.png"
  },
  PluginConfigSchema
);

const EventSchemas = createEventSchemas({
  emitEvents: {},
  onEvents: {},
  emitReturnableEvents: {},
  onReturnableEvents: {},
  emitBroadcast: {},
  onBroadcast: {}
});

export interface WorkOSAppConfig {
  clientId: string;
  apiKey: string;
  provider?: string;
  connectionId?: string;
  organizationId?: string;
  domainHint?: string;
  scopes?: string;
  loginUI?: "default" | "clean" | "redirect";
  roleClaimPath?: string;
  webhookSecret?: string;
}

export type WorkOSBrowserConfig = Omit<WorkOSAppConfig, "apiKey">;

export const WorkOSRefreshContextSchema = av.object({
  providerToken: av.string().minLength(1),
  sessionId: av.string().minLength(1),
  organizationId: av.optional(av.string().minLength(1))
}, { unknownKeys: "strip" });

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveWorkOSAppConfig(raw: Record<string, unknown> | undefined): WorkOSAppConfig | null {
  const clientId = nonEmptyString(raw?.clientId);
  const apiKey = nonEmptyString(raw?.apiKey);
  if (!clientId || !apiKey) return null;
  return {
    clientId,
    apiKey,
    provider: nonEmptyString(raw?.provider) ?? "authkit",
    ...(nonEmptyString(raw?.connectionId) ? { connectionId: nonEmptyString(raw?.connectionId) } : {}),
    ...(nonEmptyString(raw?.organizationId) ? { organizationId: nonEmptyString(raw?.organizationId) } : {}),
    ...(nonEmptyString(raw?.domainHint) ? { domainHint: nonEmptyString(raw?.domainHint) } : {}),
    ...(nonEmptyString(raw?.scopes) ? { scopes: nonEmptyString(raw?.scopes) } : {}),
    ...(raw?.loginUI === "clean" || raw?.loginUI === "redirect" ? { loginUI: raw.loginUI } : {}),
    ...(nonEmptyString(raw?.roleClaimPath) ? { roleClaimPath: nonEmptyString(raw?.roleClaimPath) } : {}),
    ...(nonEmptyString(raw?.webhookSecret) ? { webhookSecret: nonEmptyString(raw?.webhookSecret) } : {})
  };
}

export function resolveWorkOSBrowserConfig(raw: Record<string, unknown> | undefined): WorkOSBrowserConfig | null {
  const config = resolveWorkOSAppConfig(raw);
  if (!config) return null;
  const { apiKey: _apiKey, ...browserConfig } = config;
  return browserConfig;
}

export const WorkOSConfigSchemas: ConfigSchemaDescriptor[] = [
  {
    id: "workos.app",
    title: "WorkOS App Config",
    description: "App-scoped WorkOS AuthKit settings.",
    scope: "app",
    jsonSchema: {
      clientId: "string",
      apiKey: "string",
      provider: "string",
      connectionId: "string",
      organizationId: "string",
      domainHint: "string",
      scopes: "string",
      loginUI: "string",
      roleClaimPath: "string",
      webhookSecret: "string"
    },
    groups: [
      { id: "connection", title: "Connection", description: "WorkOS AuthKit application credentials.", order: 10, optional: false },
      { id: "login", title: "Login", description: "Provider routing and post-login routes.", order: 20, optional: true },
      { id: "claims", title: "Claims", description: "WorkOS access-token claim paths mapped into BP roles.", order: 30, optional: true },
      { id: "sync", title: "Role Sync", description: "WorkOS webhook + BP role sync settings.", order: 40, optional: true }
    ],
    fields: [
      { key: "clientId", title: "Client ID", description: "WorkOS client ID for this BP app.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "connection", order: 10, required: true },
      { key: "apiKey", title: "API Key", description: "WorkOS API key used server-side for code exchange and refresh.", scope: "app", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", groupId: "connection", order: 20, required: true },
      { key: "provider", title: "Provider", description: "WorkOS provider, usually authkit.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 10, defaultValue: "authkit", required: false },
      { key: "connectionId", title: "Connection ID", description: "Optional WorkOS connection to force.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 20, required: false },
      { key: "organizationId", title: "Organization ID", description: "Optional WorkOS organization to force.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 30, required: false },
      { key: "domainHint", title: "Domain Hint", description: "Optional WorkOS domain hint.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 40, required: false },
      { key: "scopes", title: "Scopes", description: "Space-separated provider scopes.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 50, defaultValue: "openid profile email", required: false },
      { key: "loginUI", title: "Login UI", description: "Default provider UI, clean button UI, or clean UI with automatic redirect.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 60, defaultValue: "default", ui: { control: "select", options: [{ value: "default", label: "Default" }, { value: "clean", label: "Clean" }, { value: "redirect", label: "Redirect" }] }, required: false },
      { key: "roleClaimPath", title: "Role Claim Path", description: "Dot path to roles in the WorkOS access token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 10, defaultValue: "roles", required: false },
      { key: "webhookSecret", title: "Webhook Secret", description: "WorkOS webhook signing secret for role sync events.", scope: "app", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", groupId: "sync", order: 10, required: false }
    ]
  }
];

type WorkOSRole = {
  slug: string;
  name?: string;
  description?: string | null;
  permissions: string[];
  type?: "EnvironmentRole" | "OrganizationRole";
};

type WorkOSPermission = {
  slug: string;
  name: string;
  description?: string | null;
};

export type BpPermissionCatalogEntry = {
  slug: string;
  serviceName: string;
  serviceId: string;
  viewId: string;
  action: AppAuthPermissionAction;
  title: string;
  description: string;
};

type WorkOSPermissionMapping = {
  shortId: string;
  tenantId: string;
  serviceId: string;
  viewId: string;
  createdAt: string;
  updatedAt: string;
};

type WorkOSRoleMapping = {
  tenantId: string;
  appId: string;
  workosRoleSlug: string;
  updatedAt: string;
};

type WorkOSSyncAppState = {
  tenantId: string;
  appId: string;
  lastPermissionSyncAt?: string;
  lastRoleSyncAt?: string;
};

export type WorkOSState = {
  permissionMappings: Record<string, WorkOSPermissionMapping>;
  roleMappings: Record<string, WorkOSRoleMapping>;
  appSync: Record<string, WorkOSSyncAppState>;
};

type SyncStatus = {
  level: "success" | "danger" | "warning" | "info";
  message: string;
  details?: string[];
};

const BP_PERMISSION_PREFIX = "bp_";
const LEGACY_BP_PERMISSION_PREFIX = "bp:";
const STALE_PERMISSION_PREFIX = "DEL: ";
const WORKOS_PERMISSION_NAME_MAX = 48;
const WORKOS_PERMISSION_DESCRIPTION_MAX = 150;
const ROLE_EVENTS = new Set([
  "role.created",
  "role.updated",
  "role.deleted",
  "organization_role.created",
  "organization_role.updated",
  "organization_role.deleted"
]);

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  private keyPair!: RsaKeyPair;
  private syncTimer: ReturnType<typeof setInterval> | undefined;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  async init(obs: Observable): Promise<void> {
    this.keyPair = loadOrGenerateKeyPair(resolve(this.config.keyStorePath));
    await super.init(obs);
    const jwk = publicKeyToJwk(this.keyPair.publicKeyPem, this.keyPair.kid);
    this.registerAsAuthProvider({
      issuer: this.config.issuer,
      audience: this.config.audience,
      jwksUri: `${this.config.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
      jwks: { keys: [jwk as unknown as Record<string, unknown>] }
    });
    this.syncTimer = setInterval(() => {
      void this.syncStaleConfiguredApps();
    }, this.config.syncIntervalSeconds * 1000);
    this.syncTimer.unref?.();
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: SERVICE_ID,
        title: "BetterPortal WorkOS",
        description: "WorkOS-backed auth service for BetterPortal apps.",
        capabilities: [
          "auth",
          "auth.roles.sync",
          "auth.roles.authority.provider",
          "auth.roles.authority.betterportal"
        ],
        configSchemas: WorkOSConfigSchemas
      },
      registry
    };
  }

  protected onRegistered(): void {
    this.app.post("/.well-known/workos/webhooks", (event) => this.handleWorkOSWebhook(event));
  }

  protected getJwtVerifier(tenantId: string, appId: string): JwtVerifier | undefined {
    void tenantId;
    void appId;
    return this.tokenIssuer().verifier("access");
  }

  protected async validateTenantApp(tenantId: string, appId: string): Promise<TenantAppValidation> {
    if (await this.validateConfigScope(tenantId, appId)) return { allowed: true };
    return {
      allowed: false,
      reason: `WorkOS auth service is not activated for tenant ${tenantId} app ${appId}.`
    };
  }

  getWorkOSAppConfig(tenantId: string, appId: string): WorkOSAppConfig | null {
    return resolveWorkOSAppConfig(this.getWorkOSRawConfig(tenantId, appId));
  }

  getAuthorizationUrl(config: WorkOSAppConfig, input: { redirectUri: string; state: string }): string {
    return this.client(config).userManagement.getAuthorizationUrl({
      provider: config.provider ?? "authkit",
      clientId: config.clientId,
      redirectUri: input.redirectUri,
      state: input.state,
      ...(config.connectionId ? { connectionId: config.connectionId } : {}),
      ...(config.organizationId ? { organizationId: config.organizationId } : {}),
      ...(config.domainHint ? { domainHint: config.domainHint } : {}),
      ...(config.scopes ? { providerScopes: splitScopes(config.scopes) } : {})
    });
  }

  authenticateWithCode(config: WorkOSAppConfig, code: string): Promise<AuthenticationResponse> {
    return this.client(config).userManagement.authenticateWithCode({
      clientId: config.clientId,
      code
    });
  }

  refreshWorkOSToken(config: WorkOSAppConfig, refreshToken: string, organizationId?: string): Promise<AuthenticationResponse> {
    return this.client(config).userManagement.authenticateWithRefreshToken({
      clientId: config.clientId,
      refreshToken,
      ...(organizationId ? { organizationId } : {})
    });
  }

  async getWorkOSSessionState(config: WorkOSAppConfig, input: { userId: string; sessionId: string; organizationId?: string }): Promise<{ sessionActive: boolean; membershipActive: boolean }> {
    const userManagement = this.client(config).userManagement;
    const sessionsPromise = userManagement.listSessions(input.userId).then((list) => list.autoPagination());
    const membershipsPromise: Promise<OrganizationMembership[]> = input.organizationId
      ? userManagement.listOrganizationMemberships({
          userId: input.userId,
          organizationId: input.organizationId,
          statuses: ["active", "inactive", "pending"]
        }).then((list) => list.autoPagination())
      : Promise.resolve([]);
    const [sessions, memberships] = await Promise.all([sessionsPromise, membershipsPromise]);
    return {
      sessionActive: (sessions as Session[]).some((session) =>
        session.id === input.sessionId
        && session.userId === input.userId
        && session.status === "active"
        && (!input.organizationId || session.organizationId === input.organizationId)),
      membershipActive: !input.organizationId || memberships.some((membership) =>
        membership.userId === input.userId
        && membership.organizationId === input.organizationId
        && membership.status === "active")
    };
  }

  async syncPermissionsToWorkOS(tenantId: string, appId: string): Promise<{ created: number; updated: number; deleted: number; deprecated: number; current: number }> {
    const config = this.getWorkOSAppConfig(tenantId, appId);
    if (!config) throw new Error("WorkOS app config is missing clientId or apiKey.");
    const catalog = this.bpPermissionCatalog(tenantId);
    const currentSlugs = new Set(catalog.map((entry) => entry.slug));
    const client = this.client(config);
    const [permissions, roles] = await Promise.all([
      client.authorization.listPermissions().then((list) => list.autoPagination()),
      this.listWorkOSRoles(config)
    ]);
    const rolePermissionSlugs = new Set(roles.flatMap((role) => role.permissions));
    const bySlug = new Map((permissions as WorkOSPermission[]).map((permission) => [permission.slug, permission]));
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let deprecated = 0;

    for (const entry of catalog) {
      const existing = bySlug.get(entry.slug);
      if (!existing) {
        await client.authorization.createPermission({
          slug: entry.slug,
          name: entry.title,
          description: entry.description
        });
        created++;
      } else if (existing.name !== entry.title || existing.description !== entry.description) {
        await client.authorization.updatePermission(entry.slug, {
          name: entry.title,
          description: entry.description
        });
        updated++;
      }
    }

    for (const permission of permissions as WorkOSPermission[]) {
      if (!isBpOwnedPermissionSlug(permission.slug) || currentSlugs.has(permission.slug)) continue;
      if (rolePermissionSlugs.has(permission.slug)) {
        const nextName = permission.name.startsWith(STALE_PERMISSION_PREFIX)
          ? permission.name
          : limitWorkOSField(`${STALE_PERMISSION_PREFIX}${permission.name}`, WORKOS_PERMISSION_NAME_MAX);
        if (permission.name !== nextName) {
          await client.authorization.updatePermission(permission.slug, {
            name: nextName,
            description: permission.description ?? "Removed BetterPortal permission; remove from roles before deletion."
          });
          deprecated++;
        }
      } else {
        await client.authorization.deletePermission(permission.slug);
        deleted++;
      }
    }

    this.markAppSync(tenantId, appId, { permissions: true });
    return { created, updated, deleted, deprecated, current: catalog.length };
  }

  async syncRolesFromWorkOS(tenantId: string, appId: string): Promise<{ roles: number; grants: number }> {
    const config = this.getWorkOSAppConfig(tenantId, appId);
    if (!config) throw new Error("WorkOS app config is missing clientId or apiKey.");
    if (!this.isAuthoritativeService(tenantId, appId, "auth")) {
      throw new Error("WorkOS service is not configured as the authoritative auth service for this app.");
    }
    const currentSlugs = new Set(this.bpPermissionCatalog(tenantId).map((entry) => entry.slug));
    const roles = (await this.listWorkOSRoles(config))
      .map((role) => this.toBpRole(role, currentSlugs));
    await this.updateAuthoritativeService(tenantId, appId, "auth", { roles });
    this.markRoleMappings(tenantId, appId, roles.map((role) => role.id));
    this.markAppSync(tenantId, appId, { roles: true });
    return {
      roles: roles.length,
      grants: roles.reduce((sum, role) => sum + role.permissions.length, 0)
    };
  }

  async syncRolesToWorkOS(tenantId: string, appId: string): Promise<{ roles: number; grants: number }> {
    const config = this.getWorkOSAppConfig(tenantId, appId);
    if (!config) throw new Error("WorkOS app config is missing clientId or apiKey.");
    if (!this.isAuthoritativeService(tenantId, appId, "auth")) {
      throw new Error("WorkOS service is not configured as the authoritative auth service for this app.");
    }
    const app = this.getPortalConfig()?.apps.find((candidate) => candidate.id === appId && candidate.tenantId === tenantId);
    if (!app?.auth) throw new Error("BetterPortal auth config is missing for this app.");

    const catalog = this.bpPermissionCatalog(tenantId);
    const providerRoles = await this.listWorkOSRoles(config);
    const roles = [...app.auth.roles];
    for (const providerRole of providerRoles) {
      if (roles.some((role) => role.id === providerRole.slug)) continue;
      roles.push({
        id: providerRole.slug,
        title: providerRole.name ?? providerRole.slug,
        ...(providerRole.description ? { description: providerRole.description } : {}),
        permissions: []
      });
    }
    if (roles.length !== app.auth.roles.length) {
      await this.updateAuthoritativeService(tenantId, appId, "auth", { roles });
    }

    const authorization = this.client(config).authorization;
    const providerBySlug = new Map(providerRoles.map((role) => [role.slug, role]));
    for (const role of roles) {
      let providerRole = providerBySlug.get(role.id);
      if (!providerRole) {
        providerRole = config.organizationId
          ? await authorization.createOrganizationRole(config.organizationId, {
              slug: role.id,
              name: role.title,
              ...(role.description ? { description: role.description } : {})
            }) as WorkOSRole
          : await authorization.createEnvironmentRole({
              slug: role.id,
              name: role.title,
              ...(role.description ? { description: role.description } : {})
            }) as WorkOSRole;
      } else if (providerRole.name !== role.title || (providerRole.description ?? "") !== (role.description ?? "")) {
        providerRole = providerRole.type === "OrganizationRole" && config.organizationId
          ? await authorization.updateOrganizationRole(config.organizationId, role.id, {
              name: role.title,
              description: role.description ?? null
            }) as WorkOSRole
          : await authorization.updateEnvironmentRole(role.id, {
              name: role.title,
              description: role.description ?? null
            }) as WorkOSRole;
      }

      const permissions = workOSPermissionsForBpRole(role, catalog, providerRole.permissions);
      if (!sameStrings(permissions, providerRole.permissions)) {
        if (providerRole.type === "OrganizationRole" && config.organizationId) {
          await authorization.setOrganizationRolePermissions(config.organizationId, role.id, { permissions });
        } else {
          await authorization.setEnvironmentRolePermissions(role.id, { permissions });
        }
      }
    }

    this.markRoleMappings(tenantId, appId, roles.map((role) => role.id));
    this.markAppSync(tenantId, appId, { roles: true });
    return {
      roles: roles.length,
      grants: roles.reduce((sum, role) => sum + role.permissions.length, 0)
    };
  }

  issueTokenPair(input: {
    sub: string;
    tenantId: string;
    appId: string;
    roles: string[];
    authProvider: string;
    refreshContext: Record<string, unknown>;
    providerSubject: string;
    provider?: JwtClaims["provider"];
    name?: string;
    email?: string;
    picture?: string;
  }, options?: { includeRefreshToken?: boolean }) {
    return this.tokenIssuer().issueTokenPair(input, options);
  }

  verifyRefreshToken(input: { refreshToken: string; tenantId: string; appId: string }): Promise<JwtClaims> {
    return this.tokenIssuer().verifyRefreshToken(input);
  }

  private getWorkOSRawConfig(tenantId: string, appId: string): Record<string, unknown> {
    const ticket = this.workosConfigReadTicket(tenantId);
    const state = this.configStore.read(ticket);
    return { ...state.tenant, ...(state.app[appId] ?? {}) };
  }

  private workosConfigReadTicket(tenantId: string): ServiceConfigTicketClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: SERVICE_ID,
      aud: SERVICE_ID,
      sub: SERVICE_ID,
      iat: now,
      exp: now + 60,
      jti: `${tenantId}:${now}`,
      realm: "control-plane",
      tenantId,
      serviceId: SERVICE_ID,
      actions: ["config.read"]
    };
  }

  private client(config: WorkOSAppConfig): WorkOS {
    return new WorkOS({ apiKey: config.apiKey, clientId: config.clientId });
  }

  private async listWorkOSRoles(config: WorkOSAppConfig): Promise<WorkOSRole[]> {
    const authorization = this.client(config).authorization;
    if (config.organizationId) {
      const list = await authorization.listOrganizationRoles(config.organizationId);
      return (list.data ?? []) as WorkOSRole[];
    }
    const list = await authorization.listEnvironmentRoles();
    return (list.data ?? []) as WorkOSRole[];
  }

  private bpPermissionCatalog(tenantId: string): BpPermissionCatalogEntry[] {
    const portal = this.getPortalConfig();
    if (!portal) return [];
    const state = this.loadWorkOSState();
    const tenant = portal.tenants.find((candidate) => candidate.id === tenantId);
    const servicesById = new Map(
      (tenant?.services ?? []).map((service) => [
        service.id,
        service.title ?? service.serviceId ?? service.id
      ])
    );
    const entries: BpPermissionCatalogEntry[] = [];
    const seen = new Set<string>();
    for (const app of portal.apps.filter((candidate) => candidate.tenantId === tenantId)) {
      for (const route of app.routes.filter((candidate) => candidate.enabled !== false)) {
        const key = permissionMappingKey(tenantId, route.serviceId, route.viewId);
        if (seen.has(key)) continue;
        seen.add(key);
        const mapping = getOrCreatePermissionMapping(state, tenantId, route.serviceId, route.viewId);
        entries.push(...permissionCatalogForRoute(route as BetterPortalRouteMount, mapping, servicesById.get(route.serviceId) ?? route.serviceId));
      }
    }
    this.saveWorkOSState(state);
    return entries;
  }

  private routeCatalogCounts(tenantId: string): { page: number; api: number; total: number } {
    const portal = this.getPortalConfig();
    const routes = portal?.apps
      .filter((candidate) => candidate.tenantId === tenantId)
      .flatMap((app) => app.routes.filter((route) => route.enabled !== false)) ?? [];
    const page = routes.filter((route) => (route.kind ?? "page") === "page").length;
    const api = routes.filter((route) => route.kind === "api").length;
    return { page, api, total: routes.length };
  }

  private toBpRole(role: WorkOSRole, currentSlugs: Set<string>): AppAuthRole {
    const state = this.loadWorkOSState();
    const byTarget = new Map<string, AppAuthRole["permissions"][number]>();
    for (const slug of role.permissions) {
      if (!currentSlugs.has(slug)) continue;
      const parsed = parseBpPermissionSlug(slug, state);
      if (!parsed) continue;
      const key = `${parsed.serviceId}\n${parsed.viewId}`;
      const grant = byTarget.get(key) ?? { serviceId: parsed.serviceId, viewId: parsed.viewId, permissions: [] };
      if (!grant.permissions.includes(parsed.action)) grant.permissions.push(parsed.action);
      byTarget.set(key, grant);
    }
    const permissions = Array.from(byTarget.values());
    return {
      id: role.slug,
      title: role.name ?? role.slug,
      ...(role.description ? { description: role.description } : {}),
      permissions
    };
  }

  private loadWorkOSState(): WorkOSState {
    const path = resolve(this.config.workosStatePath);
    if (!existsSync(path)) return emptyWorkOSState();
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<WorkOSState>;
    return {
      permissionMappings: raw.permissionMappings ?? {},
      roleMappings: raw.roleMappings ?? {},
      appSync: raw.appSync ?? {}
    };
  }

  private saveWorkOSState(state: WorkOSState): void {
    const path = resolve(this.config.workosStatePath);
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(tmp, path);
  }

  private markAppSync(tenantId: string, appId: string, flags: { permissions?: boolean; roles?: boolean }): void {
    const state = this.loadWorkOSState();
    const key = appSyncKey(tenantId, appId);
    const current = state.appSync[key] ?? { tenantId, appId };
    const now = new Date().toISOString();
    state.appSync[key] = {
      ...current,
      ...(flags.permissions ? { lastPermissionSyncAt: now } : {}),
      ...(flags.roles ? { lastRoleSyncAt: now } : {})
    };
    this.saveWorkOSState(state);
  }

  private markRoleMappings(tenantId: string, appId: string, roleSlugs: string[]): void {
    const state = this.loadWorkOSState();
    const now = new Date().toISOString();
    for (const roleSlug of roleSlugs) {
      state.roleMappings[roleMappingKey(tenantId, appId, roleSlug)] = { tenantId, appId, workosRoleSlug: roleSlug, updatedAt: now };
    }
    this.saveWorkOSState(state);
  }

  private async syncStaleConfiguredApps(): Promise<void> {
    const state = this.loadWorkOSState();
    const cutoff = Date.now() - this.config.syncIntervalSeconds * 1000;
    for (const app of this.matchingConfiguredApps()) {
      const sync = state.appSync[appSyncKey(app.tenantId, app.appId)];
      if (sync?.lastPermissionSyncAt && sync?.lastRoleSyncAt
        && Date.parse(sync.lastPermissionSyncAt) >= cutoff
        && Date.parse(sync.lastRoleSyncAt) >= cutoff) continue;
      try {
        this.observability.logger.info("WorkOS scheduled sync started tenant={tenantId} app={appId}", { tenantId: app.tenantId, appId: app.appId });
        await this.syncPermissionsToWorkOS(app.tenantId, app.appId);
        await this.syncRoles(app.tenantId, app.appId);
        this.observability.logger.info("WorkOS scheduled sync completed tenant={tenantId} app={appId}", { tenantId: app.tenantId, appId: app.appId });
      } catch (error) {
        this.observability.logger.error(asError(error), { "bp.tenant.id": app.tenantId, "bp.app.id": app.appId, "workos.sync.kind": "scheduled" });
      }
    }
  }

  private syncRoles(tenantId: string, appId: string): Promise<{ roles: number; grants: number }> {
    const app = this.getPortalConfig()?.apps.find((candidate) => candidate.id === appId && candidate.tenantId === tenantId);
    return app?.auth?.roleAuthority === "betterportal"
      ? this.syncRolesToWorkOS(tenantId, appId)
      : this.syncRolesFromWorkOS(tenantId, appId);
  }

  private matchingConfiguredApps(event?: unknown): Array<{ tenantId: string; appId: string; config: WorkOSAppConfig }> {
    const portal = this.getPortalConfig();
    if (!portal) return [];
    const eventOrgId = event && typeof event === "object"
      ? readNestedString(event as Record<string, unknown>, ["data", "organizationId"]) ?? readNestedString(event as Record<string, unknown>, ["data", "organization_id"])
      : undefined;
    return portal.apps.flatMap((app) => {
      const config = this.getWorkOSAppConfig(app.tenantId, app.id);
      if (!config) return [];
      if (eventOrgId && config.organizationId && config.organizationId !== eventOrgId) return [];
      return [{ tenantId: app.tenantId, appId: app.id, config }];
    });
  }

  async renderRoleSyncFragment(event: BetterPortalEvent, status?: SyncStatus, route?: RouteHandlerContext): Promise<Response> {
    const url = new URL(event.req.url, "http://betterportal.invalid");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    if (!tenantId || !appId) return htmlResponse(`<div class="alert alert-danger">tenantId and appId are required.</div>`, 400, "text/html; mode=fragment");
    const permissionsUrl = route?.routeUrl?.("workos-role-sync.permissions", { absolute: true, query: { tenantId, appId } });
    const rolesUrl = route?.routeUrl?.("workos-role-sync.roles", { absolute: true, query: { tenantId, appId } });
    if (!permissionsUrl || !rolesUrl) {
      return htmlResponse(`<div class="alert alert-danger">WorkOS role sync routes could not be resolved.</div>`, 500, "text/html; mode=fragment");
    }
    const config = this.getWorkOSAppConfig(tenantId, appId);
    if (!config) return htmlResponse(`<div class="alert alert-warning">WorkOS app config is missing clientId or apiKey.</div>`, 409, "text/html; mode=fragment");
    const portal = this.getPortalConfig();
    const app = portal?.apps.find((candidate) => candidate.id === appId);
    const bpRoles = ((app?.auth?.roles ?? []) as AppAuthRole[]);
    let workosRoles: WorkOSRole[] = [];
    let workosPermissions: WorkOSPermission[] = [];
    let error = "";
    try {
      [workosRoles, workosPermissions] = await Promise.all([
        this.listWorkOSRoles(config),
        this.client(config).authorization.listPermissions().then((list) => list.autoPagination())
      ]);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const permissionCatalog = this.bpPermissionCatalog(tenantId);
    const currentSlugs = new Set(permissionCatalog.map((entry) => entry.slug));
    const workosBySlug = new Map(workosPermissions.map((permission) => [permission.slug, permission]));
    const permissionRows = permissionCatalog.map((entry) => {
      const workos = workosBySlug.get(entry.slug);
      const state = !workos ? "Missing" : workos.name === entry.title && (workos.description ?? "") === entry.description ? "Synced" : "Needs update";
      return `<tr><td>${escapeHtml(entry.serviceName)}</td><td>${escapeHtml(entry.viewId)}</td><td>${escapeHtml(entry.action)}</td><td><code>${escapeHtml(entry.slug)}</code></td><td>${state}</td></tr>`;
    });
    const currentCatalogSlugs = new Set(permissionCatalog.map((entry) => entry.slug));
    const removedRows = workosPermissions.filter((permission) => isBpOwnedPermissionSlug(permission.slug) && !currentCatalogSlugs.has(permission.slug)).map((permission) => `<tr><td class="text-secondary">—</td><td class="text-secondary">—</td><td class="text-secondary">—</td><td><code>${escapeHtml(permission.slug)}</code></td><td>Removed from BP</td></tr>`);
    const permissionTableRows = [...permissionRows, ...removedRows].join("");
    const routeCounts = this.routeCatalogCounts(tenantId);
    const syncedIds = new Set(bpRoles.map((role) => role.id));
    const roleRows = workosRoles
      .filter((role) => role.permissions.some((permission) => currentSlugs.has(permission)))
      .map((role) => `<tr><td><code>${escapeHtml(role.slug)}</code></td><td>${escapeHtml(role.name ?? role.slug)}</td><td>${role.permissions.filter((permission) => currentSlugs.has(permission)).length}</td><td>${syncedIds.has(role.slug) ? "Synced" : "Pending"}</td></tr>`)
      .join("");
    return htmlResponse(`
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h5 class="card-title mb-1">WorkOS Role Sync</h5>
              <div class="text-secondary small">BP permissions sync to WorkOS; WorkOS roles mirror back to this app.</div>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" hx-post="${permissionsUrl}" hx-target="closest .card" hx-swap="outerHTML">Sync permissions</button>
              <button class="btn btn-outline-primary" hx-post="${rolesUrl}" hx-target="closest .card" hx-swap="outerHTML">Sync roles</button>
            </div>
          </div>
          ${status ? renderSyncStatus(status) : ""}
          ${error ? `<div class="alert alert-danger">WorkOS role read failed: ${escapeHtml(error)}</div>` : ""}
          <div class="mb-2 small"><strong>BP permissions:</strong> ${currentSlugs.size} <span class="text-secondary">|</span> <strong>Routes:</strong> ${routeCounts.total} (${routeCounts.page} page, ${routeCounts.api} API) <span class="text-secondary">|</span> <strong>Mirrored BP roles:</strong> ${bpRoles.length}</div>
          <div class="table-responsive mb-4">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>Service</th><th>View</th><th>Action</th><th>WorkOS slug</th><th>State</th></tr></thead>
              <tbody>${permissionTableRows || `<tr><td colspan="5" class="text-secondary">No BetterPortal permissions found.</td></tr>`}</tbody>
            </table>
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>Role slug</th><th>Name</th><th>Current BP grants</th><th>Status</th></tr></thead>
              <tbody>${roleRows || `<tr><td colspan="4" class="text-secondary">No WorkOS roles with current BP permissions.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>
    `, 200, "text/html; mode=fragment");
  }

  async handlePermissionSync(event: BetterPortalEvent, route?: RouteHandlerContext): Promise<Response> {
    const url = new URL(event.req.url, "http://betterportal.invalid");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const obs = eventObservability(event);
    const span = obs?.startSpan("workos.permissions.sync", {
      "bp.tenant.id": tenantId,
      "bp.app.id": appId
    });
    obs?.logger.info("WorkOS permission sync started tenant={tenantId} app={appId}", { tenantId, appId });
    try {
      const result = await this.syncPermissionsToWorkOS(tenantId, appId);
      span?.setAttributes({
        "workos.permissions.created": result.created,
        "workos.permissions.updated": result.updated,
        "workos.permissions.deleted": result.deleted,
        "workos.permissions.deprecated": result.deprecated,
        "workos.permissions.current": result.current
      }).end();
      obs?.logger.info(
        "WorkOS permission sync completed tenant={tenantId} app={appId} created={created} updated={updated} deleted={deleted} deprecated={deprecated} current={current}",
        { tenantId, appId, ...result }
      );
      const fragment = await this.renderRoleSyncFragment(event, {
        level: "success",
        message: "WorkOS permissions synced.",
        details: [
          `${result.created} created`,
          `${result.updated} updated`,
          `${result.deleted} deleted`,
          `${result.deprecated} marked removed`,
          `${result.current} current`
        ]
      }, route);
      fragment.headers.set("HX-Trigger", JSON.stringify({ "bp:toast": `WorkOS permissions synced (${result.created} created, ${result.updated} updated).` }));
      return fragment;
    } catch (err) {
      const error = asError(err);
      span?.error(error, { "bp.tenant.id": tenantId, "bp.app.id": appId });
      span?.end({ "workos.sync.failed": true });
      obs?.logger.error(error, { "bp.tenant.id": tenantId, "bp.app.id": appId, "workos.sync.kind": "permissions" });
      return this.renderSyncFailure(event, error, "Permission sync failed", route);
    }
  }

  async handleRoleSync(event: BetterPortalEvent, route?: RouteHandlerContext): Promise<Response> {
    const url = new URL(event.req.url, "http://betterportal.invalid");
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const appId = url.searchParams.get("appId") ?? "";
    const obs = eventObservability(event);
    const span = obs?.startSpan("workos.roles.sync", {
      "bp.tenant.id": tenantId,
      "bp.app.id": appId
    });
    obs?.logger.info("WorkOS role sync started tenant={tenantId} app={appId}", { tenantId, appId });
    try {
      const result = await this.syncRoles(tenantId, appId);
      span?.setAttributes({
        "workos.roles.synced": result.roles,
        "workos.roles.grants": result.grants
      }).end();
      obs?.logger.info(
        "WorkOS role sync completed tenant={tenantId} app={appId} roles={roles} grants={grants}",
        { tenantId, appId, roles: result.roles, grants: result.grants }
      );
      const fragment = await this.renderRoleSyncFragment(event, {
        level: "success",
        message: "WorkOS roles synced.",
        details: [`${result.roles} roles`, `${result.grants} grants`]
      }, route);
      fragment.headers.set("HX-Trigger", JSON.stringify({ "bp:toast": `WorkOS roles synced (${result.roles} roles).` }));
      return fragment;
    } catch (err) {
      const error = asError(err);
      span?.error(error, { "bp.tenant.id": tenantId, "bp.app.id": appId });
      span?.end({ "workos.sync.failed": true });
      obs?.logger.error(error, { "bp.tenant.id": tenantId, "bp.app.id": appId, "workos.sync.kind": "roles" });
      return this.renderSyncFailure(event, error, "Role sync failed", route);
    }
  }

  private async renderSyncFailure(event: BetterPortalEvent, error: Error, title: string, route?: RouteHandlerContext): Promise<Response> {
    const fragment = await this.renderRoleSyncFragment(event, {
      level: "danger",
      message: title,
      details: [error.message]
    }, route);
    fragment.headers.set("HX-Trigger", JSON.stringify({ "bp:toast": `${title}: ${error.message}` }));
    return fragment;
  }

  private async handleWorkOSWebhook(event: BetterPortalEvent): Promise<Response> {
    const obs = eventObservability(event);
    const span = obs?.startSpan("workos.webhook");
    const payload = await event.req.text();
    const sigHeader = event.req.headers.get("workos-signature");
    if (!sigHeader) {
      span?.end({ "workos.webhook.rejected": true });
      obs?.logger.warn("WorkOS webhook rejected: missing signature");
      return jsonResponse({ error: "Missing WorkOS signature" }, 401);
    }
    let configuredSecrets = 0;
    for (const candidate of this.matchingConfiguredApps()) {
      if (!candidate.config.webhookSecret) continue;
      configuredSecrets++;
      try {
        const workosEvent = await this.client(candidate.config).webhooks.constructEvent({
          payload,
          sigHeader,
          secret: candidate.config.webhookSecret
        });
        span?.setAttribute("workos.webhook.event", workosEvent.event);
        if (!ROLE_EVENTS.has(workosEvent.event)) {
          span?.end({ "workos.webhook.ignored": true });
          obs?.logger.info("WorkOS webhook ignored event={event}", { event: workosEvent.event });
          return jsonResponse({ ok: true, ignored: true });
        }
        const apps = this.matchingConfiguredApps(workosEvent);
        for (const app of apps) {
          await this.syncRoles(app.tenantId, app.appId);
        }
        span?.end({ "workos.webhook.synced_apps": apps.length });
        obs?.logger.info("WorkOS webhook synced event={event} apps={apps}", {
          event: workosEvent.event,
          apps: apps.length
        });
        return jsonResponse({ ok: true, synced: apps.length } as JsonValue);
      } catch (err) {
        span?.setAttribute("workos.webhook.last_error", asError(err).message);
        // Try the next configured webhook secret.
      }
    }
    span?.end({ "workos.webhook.rejected": true, "workos.webhook.configured_secrets": configuredSecrets });
    obs?.logger.warn("WorkOS webhook rejected: invalid signature configuredSecrets={configuredSecrets}", { configuredSecrets });
    return jsonResponse({ error: "Invalid WorkOS signature" }, 401);
  }

  private tokenIssuer(): BpTokenIssuer {
    return createBpTokenIssuer({
      keyPair: this.keyPair,
      issuer: this.config.issuer,
      audience: this.config.audience,
      accessTokenSeconds: this.config.accessTokenSeconds,
      refreshTokenSeconds: this.config.refreshTokenSeconds
    });
  }
}

export { Config, EventSchemas };

export function workOSAccessTokenDetails(token: string, roleClaimPath = "roles"): { roles: string[]; sessionId: string; organizationId?: string } | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof claims.sid !== "string" || !claims.sid) return null;
    return {
      roles: readStringArrayClaim(claims, roleClaimPath),
      sessionId: claims.sid,
      ...(typeof claims.org_id === "string" && claims.org_id ? { organizationId: claims.org_id } : {})
    };
  } catch {
    return null;
  }
}

export function rolesFromWorkOSAccessToken(token: string, roleClaimPath = "roles"): string[] {
  return workOSAccessTokenDetails(token, roleClaimPath)?.roles ?? [];
}

function splitScopes(value: string): string[] {
  return value.split(/\s+/).map((entry) => entry.trim()).filter(Boolean);
}

function readStringArrayClaim(claims: Record<string, unknown>, path: string): string[] {
  const value = path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, claims);
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function permissionCatalogForRoute(route: BetterPortalRouteMount, mapping: WorkOSPermissionMapping, serviceTitle: string): BpPermissionCatalogEntry[] {
  const title = route.title ?? route.viewId;
  const kind = route.kind ?? "page";
  const appPath = route.path;
  const servicePath = route.resolvedServicePath ?? route.targetPath ?? route.path;
  const methods = route.methods.length ? route.methods.join(",") : "GET";
  return (["read", "create", "update", "delete"] as const).map((action) => ({
    slug: bpPermissionSlug(mapping.shortId, action),
    serviceName: serviceTitle,
    serviceId: route.serviceId,
    viewId: route.viewId,
    action,
    title: workOSPermissionName(serviceTitle, title, action),
    description: workOSPermissionDescription(`${kind.toUpperCase()} ${methods} app:${appPath} service:${servicePath} view:${route.viewId} serviceId:${route.serviceId}`)
  }));
}

export function workOSPermissionName(serviceTitle: string, routeTitle: string, action: AppAuthPermissionAction): string {
  const suffix = ` - ${action}`;
  return `${limitWorkOSField(`${serviceTitle} - ${routeTitle}`, WORKOS_PERMISSION_NAME_MAX - suffix.length)}${suffix}`;
}

export function workOSPermissionDescription(description: string): string {
  return limitWorkOSField(description, WORKOS_PERMISSION_DESCRIPTION_MAX);
}

function limitWorkOSField(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function bpPermissionSlug(shortId: string, action: AppAuthPermissionAction): string {
  return `${BP_PERMISSION_PREFIX}${shortId}_${action}`;
}

export function parseBpPermissionSlug(slug: string, state: WorkOSState = emptyWorkOSState()): { serviceId: string; viewId: string; action: AppAuthPermissionAction } | null {
  if (!slug.startsWith(BP_PERMISSION_PREFIX)) return null;
  const body = slug.slice(BP_PERMISSION_PREFIX.length);
  const splitAt = body.lastIndexOf("_");
  if (splitAt <= 0) return null;
  const shortId = body.slice(0, splitAt);
  const action = body.slice(splitAt + 1);
  if (!shortId || !isPermissionAction(action)) return null;
  const mapping = Object.values(state.permissionMappings).find((entry) => entry.shortId === shortId);
  if (!mapping) return null;
  return { serviceId: mapping.serviceId, viewId: mapping.viewId, action };
}

function isPermissionAction(value: string): value is AppAuthPermissionAction {
  return value === "read" || value === "create" || value === "update" || value === "delete";
}

function emptyWorkOSState(): WorkOSState {
  return { permissionMappings: {}, roleMappings: {}, appSync: {} };
}

function permissionMappingKey(tenantId: string, serviceId: string, viewId: string): string {
  return `${tenantId}|${serviceId}|${viewId}`;
}

function roleMappingKey(tenantId: string, appId: string, workosRoleSlug: string): string {
  return `${tenantId}|${appId}|${workosRoleSlug}`;
}

function appSyncKey(tenantId: string, appId: string): string {
  return `${tenantId}|${appId}`;
}

function getOrCreatePermissionMapping(state: WorkOSState, tenantId: string, serviceId: string, viewId: string): WorkOSPermissionMapping {
  const key = permissionMappingKey(tenantId, serviceId, viewId);
  const existing = state.permissionMappings[key];
  if (existing) return existing;
  const used = new Set(Object.values(state.permissionMappings).map((entry) => entry.shortId));
  let shortId = randomShortId();
  while (used.has(shortId)) shortId = randomShortId();
  const now = new Date().toISOString();
  const mapping = { shortId, tenantId, serviceId, viewId, createdAt: now, updatedAt: now };
  state.permissionMappings[key] = mapping;
  return mapping;
}

function randomShortId(): string {
  return randomBytes(4).toString("hex");
}

function isBpOwnedPermissionSlug(slug: string): boolean {
  return slug.startsWith(BP_PERMISSION_PREFIX) || slug.startsWith(LEGACY_BP_PERMISSION_PREFIX);
}

export function workOSPermissionsForBpRole(
  role: AppAuthRole,
  catalog: BpPermissionCatalogEntry[],
  existing: string[]
): string[] {
  const byGrant = new Map(catalog.map((entry) => [
    `${entry.serviceId}\n${entry.viewId}\n${entry.action}`,
    entry.slug
  ]));
  const permissions = new Set(existing.filter((slug) => !isBpOwnedPermissionSlug(slug)));
  for (const grant of role.permissions) {
    for (const action of grant.permissions) {
      const slug = byGrant.get(`${grant.serviceId}\n${grant.viewId}\n${action}`);
      if (slug) permissions.add(slug);
    }
  }
  return [...permissions];
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function readNestedString(value: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.length > 0 ? current : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]!));
}

function renderSyncStatus(status: SyncStatus): string {
  const details = status.details?.length
    ? `<ul class="mb-0 mt-2">${status.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
    : "";
  return `<div class="alert alert-${status.level}">${escapeHtml(status.message)}${details}</div>`;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
