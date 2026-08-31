import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  buildPreviewConfigSchema,
  type CacheHints,
  type BetterPortalConfig,
  type JsonObject,
  type DemoScenario,
  type PreviewEnvironmentGroup,
  type RouteHandlerContext
} from "@betterportal/framework";
import { getConfigManagerRouteContext } from "./routeContext.js";
import { getCachedManifestForService } from "./syncApi.js";
import {
  PREVIEW_DEPLOYMENT_API_BASE,
  PreviewEnvironmentError,
  createPreviewGroup,
  deletePreviewDeployment,
  deletePreviewGroup,
  provisionPreviewDeployment,
  managedServiceIdsForPreviewApp,
  rotatePreviewGroupApiKey,
  updatePreviewDeploymentExpiry,
  updatePreviewGroup,
  visibleAdminConfig,
  type IssuedPreviewCredential
} from "./previewEnvironments.js";

const SourceAppSchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  tenantTitle: av.string().minLength(1),
  title: av.string().minLength(1),
  serviceIds: av.array(av.string()).default([]),
  requiredServiceIds: av.array(av.string()).default([])
});

const PreviewConfigFieldSchema = av.object({
  key: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.string(),
  scope: av.enum_(["tenant", "app"] as const),
  secret: av.bool(),
  required: av.bool(),
  control: av.optional(av.string()),
  options: av.array(av.object({ value: av.string(), label: av.string() })).default([])
});

const GroupServiceSchema = av.object({
  serviceId: av.string().minLength(1),
  title: av.string().minLength(1),
  fields: av.array(PreviewConfigFieldSchema).default([]),
  encryptedTenantConfig: av.string(),
  encryptedAppConfig: av.string()
});

const DeploymentServiceSchema = av.object({
  serviceId: av.string().minLength(1),
  instanceId: av.string().minLength(1),
  url: av.string().minLength(1),
  lastSyncAt: av.optional(av.string()),
  ready: av.bool()
});

const DeploymentSchema = av.object({
  id: av.string().minLength(1),
  groupId: av.string().minLength(1),
  key: av.string().minLength(1),
  name: av.string().minLength(1),
  hostname: av.string().minLength(1),
  expiresInDays: av.optional(av.int().min(1)),
  expiresAt: av.optional(av.string()),
  createdAt: av.string().minLength(1),
  updatedAt: av.string().minLength(1),
  ready: av.bool(),
  services: av.array(DeploymentServiceSchema)
});

const OidcSchema = av.object({
  issuer: av.string().minLength(1),
  audience: av.string().minLength(1),
  jwksUri: av.string().minLength(1),
  subjectPrefix: av.optional(av.string()),
  requiredClaimsJson: av.string()
});

const GroupSchema = av.object({
  id: av.string().minLength(1),
  name: av.string().minLength(1),
  sourceTenantId: av.string().minLength(1),
  sourceAppId: av.string().minLength(1),
  sourceLabel: av.string().minLength(1),
  expiresInDays: av.optional(av.int().min(1)),
  oidc: av.optional(OidcSchema),
  services: av.array(GroupServiceSchema),
  deployments: av.array(DeploymentSchema),
  createdAt: av.string().minLength(1),
  updatedAt: av.string().minLength(1)
});

const CredentialSchema = av.object({
  serviceId: av.string().minLength(1),
  instanceId: av.string().minLength(1),
  url: av.string().minLength(1),
  controlPlaneUrl: av.string().minLength(1),
  apiKey: av.string().minLength(1)
});

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  previewPath: av.string().minLength(1),
  deploymentApiBase: av.string().minLength(1),
  sourceTenants: av.array(av.object({ id: av.string().minLength(1), title: av.string().minLength(1) })),
  sourceApps: av.array(SourceAppSchema),
  groups: av.array(GroupSchema),
  notice: av.optional(av.string()),
  error: av.optional(av.string()),
  issuedApiKey: av.optional(av.string()),
  issuedCredentials: av.array(CredentialSchema).default([])
});
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Preview Environments";
export const description = "Manage isolated, disposable application clones for development deployments.";
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: ["accept", "origin"] };
export const demoScenarios: DemoScenario<ResponseData>[] = [{
  id: "default",
  title: "Default",
  response: {
    title,
    previewPath: "/preview-environments",
    deploymentApiBase: PREVIEW_DEPLOYMENT_API_BASE,
    sourceTenants: [],
    sourceApps: [],
    groups: [],
    issuedCredentials: []
  }
}];

export const handleGet = createHandler(
  { response: ResponseSchema },
  (ctx) => buildResponse(previewPath(ctx))
);

export const handlePost = createHandler(
  { response: ResponseSchema },
  async (ctx) => mutate(ctx, async () => {
    const action = stringValue(ctx.request.action);
    const routeContext = getConfigManagerRouteContext();
    const config = await routeContext.storage.loadConfig();
    if (action === "create-group") {
      const sourceTenantId = stringValue(ctx.request.sourceTenantId);
      const sourceAppId = stringValue(ctx.request.sourceAppId);
      const result = createPreviewGroup(config, {
        name: stringValue(ctx.request.name),
        sourceTenantId,
        sourceAppId,
        serviceIds: splitList(ctx.request.serviceIds),
        expiresInDays: expiryValue(ctx.request.expiresInDays),
        oidc: oidcValue(ctx.request)
      });
      await routeContext.storage.saveConfig(config);
      return { notice: "Preview group created.", issuedApiKey: result.apiKey };
    }
    if (action === "rotate-key") {
      const apiKey = rotatePreviewGroupApiKey(config, stringValue(ctx.request.groupId));
      await routeContext.storage.saveConfig(config);
      return { notice: "API key rotated. Existing key is no longer valid.", issuedApiKey: apiKey };
    }
    if (action === "save-config") {
      saveGroupConfig(config, stringValue(ctx.request.groupId), stringValue(ctx.request.configs));
      await routeContext.storage.saveConfig(config);
      return { notice: "Encrypted preview config saved." };
    }
    if (action === "create-deployment") {
      const groupId = stringValue(ctx.request.groupId);
      const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
      if (!group) throw new PreviewEnvironmentError("Preview group was not found", 404);
      const result = provisionPreviewDeployment(config, groupId, {
        key: stringValue(ctx.request.key),
        name: stringValue(ctx.request.name) || undefined,
        hostname: stringValue(ctx.request.hostname),
        expiresInDays: optionalExpiryValue(ctx.request.expiresInDays),
        services: group.services.map((service) => ({
          serviceId: service.serviceId,
          url: stringValue(ctx.request[`service.${service.serviceId}`])
        }))
      }, routeContext.serviceBaseUrl);
      await routeContext.storage.saveConfig(config);
      return {
        notice: result.created ? "Preview created." : "Preview refreshed.",
        issuedCredentials: issuedCredentials(result.credentials)
      };
    }
    throw new PreviewEnvironmentError("Unsupported preview action");
  })
);

export const handlePut = createHandler(
  { response: ResponseSchema },
  async (ctx) => mutate(ctx, async () => {
    const routeContext = getConfigManagerRouteContext();
    const config = await routeContext.storage.loadConfig();
    if (stringValue(ctx.request.action) === "update-group") {
      updatePreviewGroup(config, stringValue(ctx.request.groupId), {
        name: stringValue(ctx.request.name),
        expiresInDays: expiryValue(ctx.request.expiresInDays),
        oidc: oidcValue(ctx.request)
      });
      await routeContext.storage.saveConfig(config);
      return { notice: "Preview group updated." };
    }
    if (stringValue(ctx.request.action) === "update-expiry") {
      updatePreviewDeploymentExpiry(
        config,
        stringValue(ctx.request.deploymentId),
        expiryValue(ctx.request.expiresInDays)
      );
      await routeContext.storage.saveConfig(config);
      return { notice: "Preview expiry updated." };
    }
    throw new PreviewEnvironmentError("Unsupported preview action");
  })
);

export const handleDelete = createHandler(
  { response: ResponseSchema },
  async (ctx) => mutate(ctx, async () => {
    const routeContext = getConfigManagerRouteContext();
    const config = await routeContext.storage.loadConfig();
    const entity = stringValue(ctx.query.entity);
    const id = stringValue(ctx.query.id);
    const deleted = entity === "group" ? deletePreviewGroup(config, id) : deletePreviewDeployment(config, id);
    if (!deleted) throw new PreviewEnvironmentError("Preview resource was not found", 404);
    await routeContext.storage.saveConfig(config);
    return { notice: entity === "group" ? "Preview group deleted." : "Preview deleted." };
  })
);

async function mutate(
  ctx: Pick<RouteHandlerContext, "routeUrl">,
  action: () => Promise<Partial<ResponseData>>
): Promise<ResponseData> {
  try {
    return buildResponse(previewPath(ctx), await action());
  } catch (error) {
    if (!(error instanceof PreviewEnvironmentError)) throw error;
    return buildResponse(previewPath(ctx), { error: error.message });
  }
}

function previewPath(ctx: Pick<RouteHandlerContext, "routeUrl">): string {
  return ctx.routeUrl?.("preview-environments.index", { absolute: true })
    ?? ctx.routeUrl?.("preview-environments.index")
    ?? "/preview-environments";
}

async function buildResponse(path: string, transient: Partial<ResponseData> = {}): Promise<ResponseData> {
  const routeContext = getConfigManagerRouteContext();
  const fullConfig = await routeContext.storage.loadConfig();
  const config = visibleAdminConfig(fullConfig);
  const sourceApps = config.apps.map((app) => {
    const tenant = config.tenants.find((candidate) => candidate.id === app.tenantId)!;
    const services = tenant.services.filter((service) => service.serviceId);
    return {
      id: app.id,
      tenantId: tenant.id,
      tenantTitle: tenant.title,
      title: app.title,
      serviceIds: [...new Set(services.map((service) => service.serviceId!))],
      requiredServiceIds: managedServiceIdsForPreviewApp(config, app)
    };
  });
  const groups = fullConfig.previewEnvironmentGroups.map((group) => groupModel(fullConfig, group));
  return {
    title,
    previewPath: path,
    deploymentApiBase: PREVIEW_DEPLOYMENT_API_BASE,
    sourceTenants: config.tenants.map((tenant) => ({ id: tenant.id, title: tenant.title })),
    sourceApps,
    groups,
    issuedCredentials: [],
    ...transient
  };
}

function groupModel(config: BetterPortalConfig, group: PreviewEnvironmentGroup) {
  const sourceTenant = config.tenants.find((tenant) => tenant.id === group.sourceTenantId);
  const sourceApp = config.apps.find((app) => app.id === group.sourceAppId);
  return {
    id: group.id,
    name: group.name,
    sourceTenantId: group.sourceTenantId,
    sourceAppId: group.sourceAppId,
    sourceLabel: `${sourceTenant?.title ?? "Missing tenant"} / ${sourceApp?.title ?? "Missing app"}`,
    expiresInDays: group.expiresInDays ?? undefined,
    oidc: group.oidc ? {
      issuer: group.oidc.issuer,
      audience: group.oidc.audience,
      jwksUri: group.oidc.jwksUri,
      subjectPrefix: group.oidc.subjectPrefix,
      requiredClaimsJson: JSON.stringify(group.oidc.requiredClaims, null, 2)
    } : undefined,
    services: group.services.map((service) => {
      const sourceService = sourceTenant?.services.find((candidate) => candidate.serviceId === service.serviceId);
      const descriptors = sourceService ? getCachedManifestForService(config, sourceService.id)?.configSchemas ?? [] : [];
      const fields = [...new Map(descriptors.flatMap((descriptor) => descriptor.fields).map((field) => [
        `${field.scope}:${field.key}`,
        {
          key: field.key,
          title: field.title,
          description: field.description,
          scope: field.scope,
          secret: field.visibility === "secret",
          required: field.required,
          control: field.ui?.control,
          options: field.ui?.options ?? []
        }
      ] as const)).values()];
      return {
        serviceId: service.serviceId,
        title: service.title ?? service.serviceId,
        fields,
        encryptedTenantConfig: JSON.stringify(service.config.tenant),
        encryptedAppConfig: JSON.stringify(service.config.app)
      };
    }),
    deployments: config.previewEnvironmentDeployments
      .filter((deployment) => deployment.groupId === group.id)
      .map((deployment) => {
        const tenant = config.tenants.find((candidate) => candidate.id === deployment.tenantId);
        const services = deployment.services.map((binding) => {
          const registration = tenant?.services.find((candidate) => candidate.id === binding.instanceId);
          return {
            ...binding,
            lastSyncAt: registration?.lastSyncAt,
            ready: Boolean(registration?.lastSyncAt)
          };
        });
        return {
          ...deployment,
          expiresInDays: deployment.expiresInDays ?? undefined,
          ready: services.length > 0 && services.every((service) => service.ready),
          services
        };
      }),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

function saveGroupConfig(config: BetterPortalConfig, groupId: string, raw: string): void {
  const group = config.previewEnvironmentGroups.find((candidate) => candidate.id === groupId);
  const sourceTenant = group ? config.tenants.find((tenant) => tenant.id === group.sourceTenantId) : undefined;
  if (!group || !sourceTenant) throw new PreviewEnvironmentError("Preview group source is unavailable", 404);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new PreviewEnvironmentError("Encrypted preview config must be valid JSON"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PreviewEnvironmentError("Encrypted preview config must be an object");

  for (const service of group.services) {
    const sourceService = sourceTenant.services.find((candidate) => candidate.serviceId === service.serviceId);
    const descriptors = sourceService ? getCachedManifestForService(config, sourceService.id)?.configSchemas : undefined;
    if (!descriptors) throw new PreviewEnvironmentError(`Config schema is not synced for ${service.serviceId}`, 409);
    const value = (input as Record<string, unknown>)[service.serviceId];
    const scopes = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    service.config = {
      tenant: parseEncryptedScope(buildPreviewConfigSchema(descriptors, "tenant"), scopes.tenant, descriptors, "tenant"),
      app: parseEncryptedScope(buildPreviewConfigSchema(descriptors, "app"), scopes.app, descriptors, "app")
    };
  }
  group.updatedAt = new Date().toISOString();
}

function parseEncryptedScope(
  schema: av.BaseSchema,
  value: unknown,
  descriptors: NonNullable<ReturnType<typeof getCachedManifestForService>>["configSchemas"],
  scope: "tenant" | "app"
): JsonObject {
  const parsed = av.safeParseEncrypted(schema, value ?? {});
  if (!parsed.success) throw new PreviewEnvironmentError(parsed.issues[0]?.message ?? `Invalid ${scope} config`);
  const object = parsed.data as JsonObject;
  const secretKeys = new Set(descriptors.flatMap((descriptor) => descriptor.fields)
    .filter((field) => field.scope === scope && field.visibility === "secret")
    .map((field) => field.key));
  for (const [key, encrypted] of Object.entries(object)) {
    if (secretKeys.has(key) && (typeof encrypted !== "string" || !/^encrypted:bp-aes256gcm-v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(encrypted))) {
      throw new PreviewEnvironmentError(`Encrypted preview config value ${scope}.${key} has an unsupported envelope`);
    }
  }
  return object;
}

function oidcValue(body: Record<string, unknown>): PreviewEnvironmentGroup["oidc"] | undefined {
  const issuer = stringValue(body.oidcIssuer);
  const audience = stringValue(body.oidcAudience);
  const jwksUri = stringValue(body.oidcJwksUri);
  const subjectPrefix = stringValue(body.oidcSubjectPrefix);
  const claimsText = stringValue(body.oidcRequiredClaims) || "{}";
  if (!issuer && !audience && !jwksUri && !subjectPrefix && claimsText === "{}") return undefined;
  if (!issuer || !audience || !jwksUri) throw new PreviewEnvironmentError("OIDC issuer, audience and JWKS URL are all required");
  let claims: unknown;
  try { claims = JSON.parse(claimsText); } catch { throw new PreviewEnvironmentError("OIDC required claims must be valid JSON"); }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)
    || Object.values(claims).some((value) => typeof value !== "string")) {
    throw new PreviewEnvironmentError("OIDC required claims must be a JSON object with string values");
  }
  return {
    issuer,
    audience,
    jwksUri,
    ...(subjectPrefix ? { subjectPrefix } : {}),
    requiredClaims: claims as Record<string, string>
  };
}

function issuedCredentials(values: IssuedPreviewCredential[]): ResponseData["issuedCredentials"] {
  return values.map((credential) => ({
    serviceId: credential.serviceId,
    instanceId: credential.instanceId,
    url: credential.url,
    controlPlaneUrl: credential.environment.BP_CONTROL_PLANE_URL,
    apiKey: credential.environment.BP_SERVICE_API_KEY
  }));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value: unknown): string[] {
  return stringValue(value).split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
}

function optionalExpiryValue(value: unknown): number | null | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  return text === "never" ? null : numericExpiry(text);
}

function expiryValue(value: unknown): number | null {
  const text = stringValue(value);
  return text === "never" ? null : numericExpiry(text || "30");
}

function numericExpiry(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new PreviewEnvironmentError("Expiry must be a whole number of days or never");
  return parsed;
}
