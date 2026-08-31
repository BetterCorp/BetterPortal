import type { ApiAuthRequirement } from "@betterportal/framework";

export const operationId = "admin.preview-environments.view";
export const title = "View preview environments";
export const description = "List preview groups and their disposable deployments.";
export const dependencies = [
  { operationId: "admin.preview-environments.create", method: "POST" },
  { operationId: "admin.preview-environments.update", method: "PUT" },
  { operationId: "admin.preview-environments.delete", method: "DELETE" }
] as const;
export const auth: ApiAuthRequirement = {
  required: true,
  permissions: [{ serviceId: "org.betterportal.config-manager", viewId: "preview-environments.index", permissions: ["read"] }]
};
export { cacheHints, demoScenarios, ResponseSchema } from "../../previewEnvironmentManagement.js";
export { handleGet as default } from "../../previewEnvironmentManagement.js";
