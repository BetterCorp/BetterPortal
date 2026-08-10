import { createRawHandler, type ApiAuthRequirement, type BetterPortalEvent, type CacheHints } from "@betterportal/framework";
import * as av from "anyvali";
import type { Plugin } from "../../../../../../index.js";

export const operationId = "workos.permissions.sync";
export const title = "Sync WorkOS Permissions";
export const description = "Synchronize BetterPortal permissions to WorkOS.";
export const role = "auth.roles.sync";
export const auth: ApiAuthRequirement = { required: true, permissions: [{ serviceId: "org.betterportal.auth.workos", viewId: "workos-role-sync.permissions", permissions: ["create"] }] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };
export const QuerySchema = av.object({ tenantId: av.string().minLength(1), appId: av.string().minLength(1) });
export const handlePost = createRawHandler.forContext<Plugin>()({ query: QuerySchema }, async (ctx) =>
  (ctx.plugin as Plugin).handlePermissionSync(ctx.rawEvent as BetterPortalEvent, ctx));
export default handlePost;
