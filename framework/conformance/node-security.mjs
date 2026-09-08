// Test-only adapter to the real Node security entry points. Never expose this server.
import { generateKeyPair, publicKeyToJwk } from "../nodejs/lib/runtime/auth/keypair.js";
import { keyActions } from "./node-keys.mjs";
import { signRs256Jwt } from "../nodejs/lib/runtime/auth/jwtCrypto.js";
import { signJwt, verifyJwt } from "../nodejs/lib/runtime/auth/tokens.js";
import { signCpEnvelope, signSetupToken, verifyCpEnvelope, verifySetupToken } from "../nodejs/lib/runtime/auth/envelope.js";
import { signServiceToken, authorizeServiceToken } from "../nodejs/lib/runtime/auth/serviceToken.js";
import { signServiceConfigTicket, verifyServiceConfigTicket } from "../nodejs/lib/runtime/configTicket.js";
import { createBpTokenIssuer } from "../nodejs/lib/runtime/auth/issuer.js";

const key = generateKeyPair();
export async function security(body) {
  const { action, purpose, claims } = body;
  if (action.startsWith("keys-")) return keyActions(body);
  if (action === "jwt-key") return { publicKeyPem: key.publicKeyPem, kid: key.kid, jwk: publicKeyToJwk(key.publicKeyPem, key.kid) };
  const typ = purpose === "service" ? "BP-S2S-JWT" : "JWT";
  if (action === "jwt-raw") return { token: signRs256Jwt(claims, key.privateKeyPem, { alg: "RS256", typ, kid: key.kid, ...body.header }) };
  if (action === "jwt-pair") return createBpTokenIssuer({ keyPair: key, issuer: body.issuer, audience: body.audience,
    accessTokenSeconds: 900, refreshTokenSeconds: 604800 }).issueTokenPair(body.user);
  if (action === "jwt-refresh-verify") {
    try {
      const claims = await createBpTokenIssuer({ keyPair: key, issuer: body.issuer, audience: body.audience,
        accessTokenSeconds: 900, refreshTokenSeconds: 604800 }).verifyRefreshToken({ refreshToken: body.token, tenantId: body.tenantId, appId: body.appId });
      return { valid: true, output: claims.sub };
    } catch { return { valid: false }; }
  }
  if (action === "jwt-sign") {
    const seconds = claims.exp - claims.iat;
    const common = { privateKeyPem: key.privateKeyPem, kid: key.kid, claims: { ...claims, expiresInSeconds: seconds } };
    let token;
    if (purpose === "access" || purpose === "refresh") token = signJwt(common);
    else if (purpose === "cp-envelope") token = signCpEnvelope(common);
    else if (purpose === "setup") token = signSetupToken(common);
    else if (purpose === "service") token = signServiceToken({ keyPair: key, sourceServiceId: claims.iss,
      targetServiceId: claims.aud, tenantId: claims.tenantId, appId: claims.appId, bindingId: claims.bindingId, expiresInSeconds: seconds });
    else if (purpose === "config-ticket") token = signServiceConfigTicket({ privateKeyPem: key.privateKeyPem, kid: key.kid,
      issuer: claims.iss, tenantId: claims.tenantId, serviceId: claims.serviceId, actions: claims.actions,
      subject: claims.sub, bindingId: claims.bindingId, expiresInSeconds: seconds, jti: claims.jti });
    else throw new Error("Unknown purpose");
    return { token };
  }
  if (action === "jwt-verify") {
    try {
      const keyResolver = async (kid) => {
        if (kid !== body.kid) throw new Error("Unknown signing key");
        return body.publicKeyPem;
      };
      const options = { keyResolver, expectedIssuer: body.issuer, expectedAudience: body.audience ?? undefined, expectedTokenType: purpose };
      let output;
      if (purpose === "access" || purpose === "refresh") output = await verifyJwt(body.token, options);
      else if (purpose === "cp-envelope") output = await verifyCpEnvelope(body.token, options);
      else if (purpose === "setup") output = await verifySetupToken(body.token, options);
      else if (purpose === "config-ticket") {
        output = await verifyServiceConfigTicket(body.token, { keyResolver, issuer: body.issuer, serviceId: body.scope.serviceId });
        if (output.tenantId !== body.scope.tenantId || !output.actions.includes(body.scope.action)) throw new Error("Ticket scope mismatch");
      } else if (purpose === "service") {
        const policy = structuredClone(body.service.policy);
        policy.services = policy.services.map(service => ({ ...service, keyId: body.kid, publicKeyPem: body.publicKeyPem }));
        output = (await authorizeServiceToken(body.token, { ...body.service, policy, sourceServiceId: body.issuer, clockToleranceSeconds: 0 })).claims;
      } else throw new Error("Unknown purpose");
      return { valid: true, output };
    } catch { return { valid: false }; }
  }
  throw new Error("Unknown security action");
}
