import { createPrivateKey, createPublicKey, sign as signData } from "node:crypto";
import { errors, jwtVerify } from "jose";

export interface VerifyRs256JwtOptions {
  issuer?: string | string[];
  audience?: string | string[];
  clockToleranceSeconds?: number;
}

export function signRs256Jwt(
  payload: Readonly<Record<string, unknown>>,
  privateKeyPem: string,
  protectedHeader: Readonly<Record<string, unknown>>
): string {
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "rsa" || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error("RS256 requires an RSA private key with a modulus of at least 2048 bits");
  }
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signData("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export async function verifyRs256Jwt(
  token: string,
  publicKeyPem: string,
  options: VerifyRs256JwtOptions = {}
): Promise<Record<string, unknown>> {
  try {
    const { payload } = await jwtVerify(token, createPublicKey(publicKeyPem), {
      algorithms: ["RS256"],
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: options.clockToleranceSeconds ?? 0
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new Error("jwt expired", { cause: error });
    }
    if (error instanceof errors.JWTClaimValidationFailed) {
      const message = error.claim === "nbf"
        ? "jwt not active"
        : error.claim === "iss"
          ? "jwt issuer invalid"
          : error.claim === "aud"
            ? "jwt audience invalid"
            : undefined;
      if (message) throw new Error(message, { cause: error });
    }
    throw error;
  }
}
