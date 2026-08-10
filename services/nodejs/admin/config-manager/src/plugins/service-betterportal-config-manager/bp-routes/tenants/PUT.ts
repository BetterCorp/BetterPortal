import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.tenants.update";
export const title = "Update tenant or app";
export const description = "Update a BetterPortal tenant or application.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "tenants.index", permissions: ["update"] }]
};
export { cacheHints, demoScenarios } from "./route.impl.js";
export { ResponseSchema } from "./route.impl.js";
export { handlePut as default } from "./route.impl.js";
