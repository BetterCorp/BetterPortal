import type { AuthRoleAuthority } from "@betterportal/framework";

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
