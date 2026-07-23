import type { ApiAuthRequirement, CacheHints } from "@betterportal/framework";
import * as av from "anyvali";


export const viewId = "workos-role-sync.index";
export const title = "WorkOS Role Sync";
export const description = "Synchronize BetterPortal permissions and roles with WorkOS.";
export const role = "auth.roles.sync";
export const auth: ApiAuthRequirement = { required: true, permissions: [{ serviceId: "org.betterportal.auth.workos", viewId: "workos-role-sync.index", permissions: ["read"] }] };
export const cacheHints: CacheHints = { ttlSeconds: 0, varyBy: [] };
export const QuerySchema = av.object({ tenantId: av.string().minLength(1), appId: av.string().minLength(1) });
export const ResponseSchema = av.object({ fragment: av.string() });
