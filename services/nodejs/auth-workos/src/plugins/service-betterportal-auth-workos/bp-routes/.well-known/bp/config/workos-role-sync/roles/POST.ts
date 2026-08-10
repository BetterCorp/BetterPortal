import { createRawHandler, type ApiAuthRequirement, type BetterPortalEvent, type CacheHints } from "@betterportal/framework";
import * as av from "anyvali";
import type { Plugin } from "../../../../../../index.js";

export const operationId = "workos.roles.sync";
export const title = "Sync WorkOS Roles";
export const description = "Synchronize WorkOS roles into BetterPortal.";
export const role = "auth.roles.sync";
export const auth: ApiAuthRequirement = { required: true, permissions: [{ serviceId: "org.betterportal.auth.workos", viewId: "workos-role-sync.roles", permissions: ["update"] }] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };
export const QuerySchema = av.object({ tenantId: av.string().minLength(1), appId: av.string().minLength(1) });
export const handlePost = createRawHandler.forContext<Plugin>()({ query: QuerySchema }, async (ctx) =>
  (ctx.plugin as Plugin).handleRoleSync(ctx.rawEvent as BetterPortalEvent, ctx));
export default handlePost;
