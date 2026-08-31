import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.preview-environments.update";
export const title = "Update preview resources";
export const description = "Update a preview group or deployment expiry.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "preview-environments.index", permissions: ["update"] }]
};
export { cacheHints, demoScenarios, ResponseSchema } from "../../previewEnvironmentManagement.js";
export { handlePut as default } from "../../previewEnvironmentManagement.js";
