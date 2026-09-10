import * as av from "anyvali";
import { JsonObjectSchema, JSON_VALUE_DEFINITION, JsonValueSchemaNode } from "./json.js";
import { UuidV7Schema } from "./common.js";
import {
  BetterPortalAppSchema, BetterPortalTenantSchema, TenantServiceRegistrationSchema,
  BetterPortalRouteMountSchema, BetterPortalFragmentAssignmentSchema, M2MBindingSchema, M2MGrantSchema
} from "./platformConfig.js";

/** Derive wire projections from canonical platform fields, retaining defaults and constraints. */
function project(schema: av.BaseSchema, omit: string[], extra: Record<string, av.BaseSchema>) {
  const document = av.exportSchema(schema);
  if (document.root.kind !== "object") throw new Error("Expected object contract");
  const properties: Record<string, av.BaseSchema> = {};
  for (const [name, node] of Object.entries(document.root.properties)) {
    if (omit.includes(name) || name in extra) continue;
    const field = av.importSchema({ ...document, root: node, definitions: {
      ...document.definitions, [JSON_VALUE_DEFINITION]: JsonValueSchemaNode
    } });
    properties[name] = document.root.required?.includes(name) ? field : av.optional(field);
  }
  return av.object({ ...properties, ...extra });
}

const text = av.string().minLength(1);
export const ScopedTenantServiceSchema = project(TenantServiceRegistrationSchema, ["apiKeyHash"], {
  source: av.optional(av.enum_(["tenant", "platform", "shared"])),
  sharedServiceId: av.optional(text), baseUrl: av.optional(av.string().format("url")),
  logoUrl: av.optional(text), category: av.optional(text), tags: av.optional(av.array(text))
});
export const ScopedTenantSchema = project(BetterPortalTenantSchema, [], {
  services: av.array(ScopedTenantServiceSchema)
});
export const ScopedAppSchema = project(BetterPortalAppSchema, ["layoutId", "statusViewIds"], {
  managementAuthServiceOrigins: av.optional(av.record(av.string().format("url"))),
  shell: av.optional(av.object({ serviceId: UuidV7Schema, service: text, renderer: text })),
  appRoutes: av.optional(av.array(BetterPortalRouteMountSchema)),
  appFragments: av.optional(av.record(av.array(BetterPortalFragmentAssignmentSchema)))
});
export const ScopedServiceConfigSchema = av.object({
  serviceIdentity: av.optional(av.object({ id: UuidV7Schema, publicKeyPem: av.optional(text), keyId: av.optional(text) })),
  m2m: av.optional(av.object({
    localServiceIds: av.array(UuidV7Schema),
    services: av.array(av.object({ id: UuidV7Schema, serviceId: av.optional(text), hostname: av.string().format("url"),
      publicKeyPem: av.optional(text), keyId: av.optional(text) })),
    bindings: av.array(M2MBindingSchema), grants: av.array(M2MGrantSchema)
  })),
  previewConfig: av.optional(av.object({ revision: text, tenant: JsonObjectSchema, app: JsonObjectSchema })),
  configManagement: av.optional(av.object({
    adminTenantId: av.optional(UuidV7Schema), managementAppId: av.optional(UuidV7Schema),
    context: av.optional(av.object({ tenant: ScopedTenantSchema, app: ScopedAppSchema }))
  })),
  managementOrigins: av.array(av.string().format("url")), tenants: av.array(ScopedTenantSchema),
  configApps: av.optional(av.array(av.object({ id: UuidV7Schema, tenantId: UuidV7Schema, title: text }))),
  apps: av.array(ScopedAppSchema)
});
