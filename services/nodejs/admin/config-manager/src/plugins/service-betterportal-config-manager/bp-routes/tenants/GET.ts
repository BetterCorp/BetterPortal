import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.tenants.view";
export const title = "View tenants and apps";
export const description = "List BetterPortal tenants, applications, and available shell/auth services.";
export const dependencies = [
  { operationId: "admin.tenants.create", method: "POST" },
  { operationId: "admin.tenants.update", method: "PUT" },
  { operationId: "admin.tenants.delete", method: "DELETE" }
] as const;
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "tenants.index", permissions: ["read"] }]
};
export { cacheHints, demoScenarios } from "../../tenantManagement.js";
export { ResponseSchema } from "../../tenantManagement.js";
export { handleGet as default } from "../../tenantManagement.js";
