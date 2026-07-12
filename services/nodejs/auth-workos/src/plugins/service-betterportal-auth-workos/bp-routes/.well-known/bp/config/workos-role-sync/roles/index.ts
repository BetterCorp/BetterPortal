import type { ApiAuthRequirement, CacheHints } from "@betterportal/framework";
import * as av from "anyvali";


export const viewId = "workos-role-sync.roles";
export const title = "Sync WorkOS Roles";
export const description = "Synchronize WorkOS roles into BetterPortal.";
export const role = "auth.roles.sync";
export const auth: ApiAuthRequirement = { required: true, permissions: [{ serviceId: "service.betterportal.auth.workos", viewId: "workos-role-sync.roles", permissions: ["update"] }] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };
export const QuerySchema = av.object({ tenantId: av.string().minLength(1), appId: av.string().minLength(1) });
export const ResponseSchema = av.object({ fragment: av.string() });
