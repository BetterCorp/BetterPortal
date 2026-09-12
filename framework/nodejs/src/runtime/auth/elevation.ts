import { ElevationRequirementSchema, type ElevationRequirement, type JwtClaims } from "../../contracts/auth.js";

/** An authenticated caller still needs ordinary route and resource permissions. */
export function satisfiesElevation(claims: JwtClaims | undefined, requirement: ElevationRequirement, now = Math.floor(Date.now() / 1000)): boolean {
  const elevation = claims?.elevation;
  return !!claims && claims.tokenType === "access" && claims.exp > now && !!elevation
    && elevation.verifiedAt <= now && elevation.verifiedAt < elevation.expiresAt
    && elevation.expiresAt > now && elevation.expiresAt <= claims.exp
    && (elevation.assurance === "confirmed" || elevation.assurance === "mfa")
    && (requirement.minimum !== "mfa" || elevation.assurance === "mfa")
    && (requirement.maxAgeSeconds === undefined || now - elevation.verifiedAt <= requirement.maxAgeSeconds);
}

export class ElevationRequired extends Error {
  readonly requirement: ElevationRequirement;
  constructor(requirement: ElevationRequirement) {
    super("Additional authentication required");
    this.requirement = ElevationRequirementSchema.parse(requirement);
  }
}

/** Invoke before effects; an exception cannot undo work already performed by a handler. */
export function requireElevation(claims: JwtClaims | undefined, requirement: ElevationRequirement): void {
  const parsed = ElevationRequirementSchema.parse(requirement);
  if (!satisfiesElevation(claims, parsed)) throw new ElevationRequired(parsed);
}

export function elevationResponse(requirement: ElevationRequirement, context: { tenantId: string; appId: string; serviceId?: string; operationId?: string; method?: string }): Response {
  const challenge = {
    version: 1, tenantId: context.tenantId, appId: context.appId, minimum: requirement.minimum,
    ...(requirement.maxAgeSeconds === undefined ? {} : { maxAgeSeconds: requirement.maxAgeSeconds }),
    ...(context.serviceId ? { serviceId: context.serviceId } : {}),
    ...(context.operationId ? { operationId: context.operationId } : {}),
    ...(context.method ? { method: context.method } : {})
  };
  return Response.json({ error: "insufficient_user_authentication", ...challenge }, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer error="insufficient_user_authentication", acr_values="${requirement.minimum === "mfa" ? "urn:betterportal:mfa" : "urn:betterportal:confirmed"}"${requirement.maxAgeSeconds ? `, max_age="${requirement.maxAgeSeconds}"` : ""}`,
      "BP-Auth-Challenge": JSON.stringify(challenge),
      "Cache-Control": "no-store"
    }
  });
}
