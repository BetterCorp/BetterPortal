import { createRawHandler, type ApiAuthRequirement, type BetterPortalEvent, type CacheHints } from "@betterportal/framework";
import * as av from "anyvali";
import type { Plugin } from "../../../../../index.js";

export const operationId = "workos.roles.fragment.read";
export const title = "WorkOS Role Sync";
export const description = "Render the WorkOS role synchronization controls.";
export const role = "auth.roles.sync";
export const auth: ApiAuthRequirement = { required: true, permissions: [{ serviceId: "org.betterportal.auth.workos", viewId: "workos-role-sync.index", permissions: ["read"] }] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };
export const QuerySchema = av.object({ tenantId: av.string().minLength(1), appId: av.string().minLength(1) });
export const handleGet = createRawHandler.forContext<Plugin>()({ query: QuerySchema }, async (ctx) =>
  (ctx.plugin as Plugin).renderRoleSyncFragment(ctx.rawEvent as BetterPortalEvent, undefined, ctx));
export default handleGet;
