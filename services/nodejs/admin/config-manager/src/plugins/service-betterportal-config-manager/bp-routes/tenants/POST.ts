import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.tenants.create";
export const title = "Create tenant or app";
export const description = "Create a BetterPortal tenant or application.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "tenants.index", permissions: ["create"] }]
};
export { cacheHints, demoScenarios } from "./route.impl.js";
export { ResponseSchema } from "./route.impl.js";
export { handlePost as default } from "./route.impl.js";
