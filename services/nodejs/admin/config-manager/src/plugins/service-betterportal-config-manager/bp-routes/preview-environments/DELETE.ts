import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.preview-environments.delete";
export const title = "Delete preview resources";
export const description = "Delete a preview deployment or group.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "preview-environments.index", permissions: ["delete"] }]
};
export { cacheHints, demoScenarios, ResponseSchema } from "../../previewEnvironmentManagement.js";
export { handleDelete as default } from "../../previewEnvironmentManagement.js";
