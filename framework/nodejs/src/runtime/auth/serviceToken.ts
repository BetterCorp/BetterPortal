import jwt from "jsonwebtoken";
import type { HttpMethod } from "../../contracts/common.js";
import {
  type M2MCallerMode,
  ServiceTokenClaimsSchema,
  type ServiceTokenClaims
} from "../../contracts/m2m.js";
import type { ScopedM2MConfig } from "../../contracts/controlPlane.js";
import type { RsaKeyPair } from "./keypair.js";
import { uuidv7 } from "../uuid.js";

const ALGORITHM = "RS256" as const;
const TOKEN_TYP = "BP-S2S-JWT";
const MAX_LIFETIME_SECONDS = 60;
const KID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export interface SignServiceTokenOptions {
  readonly keyPair: RsaKeyPair;
  readonly sourceServiceId: string;
  readonly targetServiceId: string;
  readonly tenantId: string;
  readonly appId: string;
  readonly bindingId: string;
  readonly expiresInSeconds?: number;
}

export interface AuthorizeServiceTokenOptions {
  readonly policy: ScopedM2MConfig;
  readonly tenantId: string;
  readonly appId: string;
  readonly viewId: string;
  readonly method: HttpMethod;
  readonly mode: M2MCallerMode;
  readonly sourceServiceId: string;
  readonly requiredPermissions?: ReadonlyArray<string>;
  readonly clockToleranceSeconds?: number;
}

export interface AuthorizedServiceCaller {
  readonly claims: ServiceTokenClaims;
  readonly permissions: ReadonlyArray<string>;
}

export class ServiceTokenAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403) {
    super(message);
    this.name = "ServiceTokenAuthorizationError";
  }
}

export function signServiceToken(options: SignServiceTokenOptions): string {
  const lifetime = options.expiresInSeconds ?? MAX_LIFETIME_SECONDS;
  if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > MAX_LIFETIME_SECONDS) {
    throw new ServiceTokenAuthorizationError("Service token lifetime must be between 1 and " + MAX_LIFETIME_SECONDS + " seconds", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  const claims = ServiceTokenClaimsSchema.parse({
    iss: options.sourceServiceId,
    sub: options.sourceServiceId,
    aud: options.targetServiceId,
    tenantId: options.tenantId,
    appId: options.appId,
    bindingId: options.bindingId,
    iat: now,
    nbf: now,
    exp: now + lifetime,
    jti: uuidv7(),
    tokenType: "service"
  });
  return jwt.sign(claims as object, options.keyPair.privateKeyPem, {
    algorithm: ALGORITHM,
    keyid: options.keyPair.kid,
    header: { alg: ALGORITHM, typ: TOKEN_TYP, kid: options.keyPair.kid }
  });
}

export function isServiceToken(token: string): boolean {
  try {
    return readHeader(token).typ === TOKEN_TYP;
  } catch {
    return false;
  }
}

export async function authorizeServiceToken(
  token: string,
  options: AuthorizeServiceTokenOptions
): Promise<AuthorizedServiceCaller> {
  const header = readHeader(token);
  if (header.alg !== ALGORITHM || header.typ !== TOKEN_TYP || typeof header.kid !== "string" || !KID_PATTERN.test(header.kid)) {
    throw new ServiceTokenAuthorizationError("Invalid service token header", 401);
  }
  if ("jku" in header || "x5u" in header) throw new ServiceTokenAuthorizationError("Service token contains an untrusted key reference", 401);

  const untrusted = readPayload(token);
  const sourceServiceId = typeof untrusted.iss === "string" ? untrusted.iss : "";
  const source = options.policy.services.find((service) =>
    service.id === sourceServiceId && service.keyId === header.kid && typeof service.publicKeyPem === "string"
  );
  if (!source?.publicKeyPem) throw new ServiceTokenAuthorizationError("Service signing key is not trusted", 401);

  let verified: unknown;
  try {
    verified = jwt.verify(token, source.publicKeyPem, {
      algorithms: [ALGORITHM],
      clockTolerance: options.clockToleranceSeconds ?? 5
    });
  } catch (error) {
    throw new ServiceTokenAuthorizationError("Service token verification failed: " + (error as Error).message, 401);
  }
  const claims = ServiceTokenClaimsSchema.parse(verified);
  if (claims.sub !== claims.iss) throw new ServiceTokenAuthorizationError("Service token subject does not match issuer", 401);
  if (claims.iss !== options.sourceServiceId) throw new ServiceTokenAuthorizationError("Service token source does not match request headers", 401);
  if (claims.exp - claims.iat > MAX_LIFETIME_SECONDS) throw new ServiceTokenAuthorizationError("Service token lifetime exceeds the maximum", 401);
  if (!options.policy.localServiceIds.includes(claims.aud)) throw new ServiceTokenAuthorizationError("Service token targets another service", 401);
  if (claims.tenantId !== options.tenantId || claims.appId !== options.appId) {
    throw new ServiceTokenAuthorizationError("Service token is bound to another tenant/app", 401);
  }

  const binding = options.policy.bindings.find((candidate) =>
    candidate.enabled
    && candidate.id === claims.bindingId
    && candidate.sourceServiceId === claims.iss
    && candidate.targetServiceId === claims.aud
    && candidate.mode === options.mode
    && candidate.tenantId === claims.tenantId
    && (!candidate.appId || candidate.appId === claims.appId)
    && candidate.targetViewId === options.viewId
  );
  if (!binding) throw new ServiceTokenAuthorizationError("Service binding is unavailable", 403);

  const grant = options.policy.grants.find((candidate) =>
    candidate.enabled
    && candidate.bindingId === binding.id
    && candidate.tenantId === claims.tenantId
    && (!candidate.appId || candidate.appId === claims.appId)
    && candidate.methods.includes(options.method)
  );
  if (!grant) throw new ServiceTokenAuthorizationError("Service grant is unavailable", 403);
  const required = options.requiredPermissions ?? [];
  if (!required.every((permission) => grant.permissions.includes(permission))) {
    throw new ServiceTokenAuthorizationError("Service grant has insufficient permissions", 403);
  }
  return { claims, permissions: grant.permissions };
}

function readHeader(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Service token must have three parts");
  return readJsonPart(parts[0], "header");
}

function readPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Service token must have three parts");
  return readJsonPart(parts[1], "payload");
}

function readJsonPart(value: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Service token " + label + " is invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Service token " + label + " is not an object");
  }
  return parsed as Record<string, unknown>;
}
