import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.tenants.delete";
export const title = "Delete tenant or app";
export const description = "Delete a BetterPortal tenant or application.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "tenants.index", permissions: ["delete"] }]
};
export { cacheHints, demoScenarios } from "./route.impl.js";
export { ResponseSchema } from "./route.impl.js";
export { handleDelete as default } from "./route.impl.js";
