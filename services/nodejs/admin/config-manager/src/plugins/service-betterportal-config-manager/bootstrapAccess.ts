import { createPrivateKey, createPublicKey } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { CpBootstrapState } from "./cpBootstrap.js";

const AUDIENCE = "betterportal-bootstrap-admin";
const TYPE = "bp-bootstrap-admin+jwt";

/** A short-lived capability for the two admin calls needed before first login. */
export async function issueBootstrapAdminToken(state: CpBootstrapState, tenantId: string, appId: string): Promise<string> {
  return new SignJWT({ purpose: "bootstrap-admin", tenantId, appId })
    .setProtectedHeader({ alg: "RS256", typ: TYPE, kid: state.keyPair.kid })
    .setIssuer(state.issuer)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(createPrivateKey(state.keyPair.privateKeyPem));
}

export async function verifyBootstrapAdminToken(state: CpBootstrapState, token: string): Promise<{ tenantId: string; appId: string }> {
  const { payload, protectedHeader } = await jwtVerify(token, createPublicKey(state.keyPair.publicKeyPem), {
    issuer: state.issuer,
    audience: AUDIENCE,
    algorithms: ["RS256"],
    typ: TYPE
  });
  if (protectedHeader.kid !== state.keyPair.kid || payload.purpose !== "bootstrap-admin"
    || typeof payload.tenantId !== "string" || typeof payload.appId !== "string") {
    throw new Error("Invalid bootstrap authorization scope");
  }
  return { tenantId: payload.tenantId, appId: payload.appId };
}
