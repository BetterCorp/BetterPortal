import { getSigningKeyForKid, clearJwksCache } from "../nodejs/lib/runtime/auth/jwks.js";

export async function keyActions(body) {
  clearJwksCache();
  const results = [];
  for (const step of body.steps) {
    if (step.invalidate) {
      clearJwksCache();
      results.push({ invalidated: true });
      continue;
    }
    try {
      const resolve = () => getSigningKeyForKid({ issuer: body.issuer, jwksUri: body.uri }, step.kid);
      const values = await Promise.all(Array.from({ length: step.parallel ?? 1 }, resolve));
      if (new Set(values).size !== 1) throw new Error("Inconsistent parallel keys");
      results.push({ valid: true, pem: values[0] });
    } catch { results.push({ valid: false }); }
  }
  clearJwksCache();
  return { results };
}
