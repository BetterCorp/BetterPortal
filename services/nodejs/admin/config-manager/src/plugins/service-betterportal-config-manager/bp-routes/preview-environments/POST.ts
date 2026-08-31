import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.preview-environments.create";
export const title = "Create preview resources";
export const description = "Create preview groups, rotate group credentials, or create a preview deployment.";
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "preview-environments.index", permissions: ["create"] }]
};
export { cacheHints, demoScenarios, ResponseSchema } from "../../previewEnvironmentManagement.js";
export { handlePost as default } from "../../previewEnvironmentManagement.js";
