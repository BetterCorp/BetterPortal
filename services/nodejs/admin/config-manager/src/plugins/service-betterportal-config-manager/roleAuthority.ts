import type { AuthRoleAuthority } from "@betterportal/framework";
import type { CachedManifest } from "./syncApi.js";

export const PROVIDER_ROLE_AUTHORITY_CAPABILITY = "auth.roles.authority.provider";
export const BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY = "auth.roles.authority.betterportal";

export function supportedRoleAuthorities(capabilities: readonly string[]): AuthRoleAuthority[] {
  const supported: AuthRoleAuthority[] = [];
  if (capabilities.includes(PROVIDER_ROLE_AUTHORITY_CAPABILITY) || capabilities.includes("auth.roles.sync")) supported.push("provider");
  if (capabilities.includes(BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY)) supported.push("betterportal");
  return supported.length ? supported : ["betterportal"];
}

export function resolveRoleAuthority(
  capabilities: readonly string[],
  requested?: AuthRoleAuthority
): AuthRoleAuthority {
  const supported = supportedRoleAuthorities(capabilities);
  if (requested && supported.includes(requested)) return requested;
  return supported.includes("provider") ? "provider" : supported[0]!;
}

export function resolveRoleSyncUrl(
  serviceBaseUrl: string,
  manifest: Pick<CachedManifest, "capabilities" | "viewIndex"> | undefined,
  authority: AuthRoleAuthority,
  tenantId: string,
  appId: string
): string | undefined {
  if (!manifest) return undefined;
  if (authority === "provider" && !manifest.capabilities.includes("auth.roles.sync")) return undefined;
  if (authority === "betterportal" && !manifest.capabilities.includes(BETTERPORTAL_ROLE_AUTHORITY_CAPABILITY)) return undefined;

  const role = authority === "provider" ? "auth.roles.sync.view" : "auth.roles.sync";
  const method = authority === "provider" ? "GET" : "POST";
  const paths = Object.values(manifest.viewIndex).flatMap((view) =>
    view.operations.some((operation) => operation.role === role && operation.method === method) ? [view.path] : []
  );
  if (paths.length !== 1) return undefined;

  try {
    const url = new URL(`${serviceBaseUrl.replace(/\/+$/, "")}/${paths[0]!.replace(/^\/+/, "")}`);
    url.searchParams.set("tenantId", tenantId);
    url.searchParams.set("appId", appId);
    return url.toString();
  } catch {
    return undefined;
  }
}
