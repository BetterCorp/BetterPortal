import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.tenants.view";
export const title = "View tenants and apps";
export const description = "List BetterPortal tenants, applications, and available shell/auth services.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "tenants.index", permissions: ["read"] }]
};
export { cacheHints, demoScenarios } from "./route.impl.js";
export { ResponseSchema } from "./route.impl.js";
export { handleGet as default } from "./route.impl.js";
