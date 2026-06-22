import * as av from "anyvali";
import type { Infer } from "anyvali";
import {
  createHandler,
  type ApiAuthRequirement,
  type CacheHints
} from "@betterportal/framework";

const PermissionActionSchema = av.enum_(["read", "create", "update", "delete"] as const);

const ViewWithPermsSchema = av.object({
  viewId: av.string().minLength(1),
  path: av.string().minLength(1),
  methods: av.array(av.string()).default([]),
  role: av.optional(av.string()),
  requiredPermissions: av.array(av.object({
    serviceId: av.string().minLength(1),
    viewId: av.string().minLength(1),
    permissions: av.array(av.string())
  }, { unknownKeys: "strip" })).default([])
}, { unknownKeys: "strip" });

const ServiceWithViewsSchema = av.object({
  serviceId: av.string().minLength(1),
  title: av.string().minLength(1),
  hostname: av.string(),
  manifestVersion: av.optional(av.string()),
  views: av.array(ViewWithPermsSchema).default([])
}, { unknownKeys: "strip" });

const RolePermissionGrantSchema = av.object({
  serviceId: av.string().minLength(1),
  viewId: av.string().minLength(1),
  permissions: av.array(PermissionActionSchema).minItems(1)
}, { unknownKeys: "strip" });

const AppRoleSchema = av.object({
  id: av.string().minLength(1),
  title: av.string().minLength(1),
  description: av.optional(av.string()),
  permissions: av.array(RolePermissionGrantSchema).default([])
}, { unknownKeys: "strip" });

const AppSummarySchema = av.object({
  id: av.string().minLength(1),
  tenantId: av.string().minLength(1),
  title: av.string().minLength(1)
}, { unknownKeys: "strip" });

export const QuerySchema = av.object({
  appId: av.optional(av.string().minLength(1))
}, { unknownKeys: "strip" });

export const HeadersSchema = av.object({}, { unknownKeys: "strip" });

export const RequestSchema = av.object({}, { unknownKeys: "strip" });

export const ResponseSchema = av.object({
  title: av.string().minLength(1),
  apps: av.array(AppSummarySchema).default([]),
  selectedAppId: av.optional(av.string()),
  selectedTenantId: av.optional(av.string()),
  authConfigured: av.bool().default(false),
  servicePermissions: av.array(ServiceWithViewsSchema).default([]),
  currentRoles: av.array(AppRoleSchema).default([]),
  adminApiBase: av.string().default("/.well-known/bp/admin"),
  serviceBaseUrl: av.optional(av.string())
}, { unknownKeys: "strip" });
export type ResponseData = Infer<typeof ResponseSchema>;

export const title = "Permission Manager";
export const description = "Define role → permission grants per app. Services advertise per-view permission requirements via their manifest.";

export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [
    { serviceId: "service.betterportal.config-manager", viewId: "auth.index", permissions: ["read","create","update","delete"] }
  ]
};

export const cacheHints: CacheHints = {
  ttlSeconds: 0,
  varyBy: ["accept", "origin"]
};

export const handleGet = createHandler(
  { response: ResponseSchema, query: QuerySchema },
  (ctx) => {
    if (ctx.responseModel) return ctx.responseModel as ResponseData;
    return {
      title: "Permission Manager",
      apps: [],
      authConfigured: false,
      servicePermissions: [],
      currentRoles: [],
      adminApiBase: "/.well-known/bp/admin"
    };
  }
);
