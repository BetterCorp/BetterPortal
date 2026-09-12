import { generateSecret, generateURI, verify } from "otplib";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { AuthError, newSecret, secretHash, type IdentityService, type User } from "./identity.js";
import type { AuthTransaction, RecordValue, Scope } from "./storage.js";

interface Passkey extends RecordValue { userId: string; rpId: string; publicKey: string; counter: number; name: string }
export interface FactorRequest { method?: string; code?: string; credential?: unknown }
export class Factors {
  constructor(private readonly identity: IdentityService) {}
  // This is account-wide: an unusable passkey must not turn MFA into password-only login.
  async hasFactors(user: User): Promise<boolean> {
    if (user.totp) return true;
    return this.identity.storage.transaction(user, async tx => (await tx.list<Passkey>("passkey", user)).some(p => p.userId === user.id));
  }
  async prepare(user: User, origin: string, enroll = false): Promise<{ public: Record<string, unknown>; private: Record<string, unknown> }> {
    const rpId = new URL(origin).hostname;
    const keys = await this.identity.storage.transaction(user, async tx => (await tx.list<Passkey>("passkey", user)).filter(p => p.userId === user.id && p.rpId === rpId));
    const methods = enroll ? ["totp", "passkey"] : [...(user.totp ? ["totp"] : []), ...(keys.length ? ["passkey"] : []), ...(user.recoveryCodes?.length ? ["recovery"] : [])];
    if (!methods.length) throw new AuthError("No authentication factor is available for this app. Sign in to an app where your passkey works and add an authenticator in Account, then try again.", 403);
    const options = enroll
      ? await generateRegistrationOptions({ rpName: "BetterPortal", rpID: rpId, userName: user.username, userID: new Uint8Array(Buffer.from(secretHash(`${user.tenantId}:${user.appId}:${user.id}`), "hex")), excludeCredentials: keys.map(p => ({ id: p.id })), authenticatorSelection: { residentKey: "preferred", userVerification: "required" } })
      : await generateAuthenticationOptions({ rpID: rpId, allowCredentials: keys.map(p => ({ id: p.id })), userVerification: "required" });
    const secret = enroll ? generateSecret() : undefined;
    // WebAuthn options may include undefined optional fields; expose their JSON wire representation.
    const publicOptions = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
    return {
      public: { methods, options: publicOptions, enroll, ...(secret ? { totpSecret: secret, totpUri: generateURI({ issuer: "BetterPortal", label: user.username, secret }) } : {}) },
      private: { origin, rpId, challenge: options.challenge, enroll, ...(secret ? { totpSecret: this.identity.cipher.encrypt(secret) } : {}) }
    };
  }
  async complete(tx: AuthTransaction, scope: Scope, user: User, data: Record<string, unknown>, input: FactorRequest): Promise<string[] | undefined> {
    try {
    const dir = { tenantId: user.tenantId, appId: user.appId };
    const enroll = data.enroll === true;
    if (input.method === "totp") {
      const encrypted = enroll ? String(data.totpSecret ?? "") : user.totp;
      if (!encrypted) throw new AuthError("Authenticator not available.");
      if (!/^[0-9]{6}$/.test(input.code ?? "")) throw new AuthError("Enter a six-digit authenticator code.");
      const result = await verify({ secret: this.identity.cipher.decrypt(encrypted), token: input.code ?? "", epochTolerance: [30, 0], ...(user.totpLastStep === undefined ? {} : { afterTimeStep: user.totpLastStep }) });
      if (!result.valid || !("timeStep" in result)) throw new AuthError("Invalid or reused verification code.");
      user.totpLastStep = result.timeStep;
      if (enroll) user.totp = encrypted;
    } else if (input.method === "passkey") {
      if (enroll) {
        const result = await verifyRegistrationResponse({ response: input.credential as RegistrationResponseJSON, expectedChallenge: String(data.challenge), expectedOrigin: String(data.origin), expectedRPID: String(data.rpId), requireUserVerification: true });
        if (!result.verified || !result.registrationInfo) throw new AuthError("Passkey registration failed.");
        const { credential } = result.registrationInfo;
        if (await tx.get("passkey", credential.id, dir)) throw new AuthError("Passkey already registered.");
        await tx.put("passkey", dir, { id: credential.id, userId: user.id, rpId: String(data.rpId), publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, name: "Passkey" });
      } else {
        const response = input.credential as AuthenticationResponseJSON;
        const key = await tx.get<Passkey>("passkey", response?.id ?? "", dir);
        if (!key || key.userId !== user.id || key.rpId !== data.rpId) throw new AuthError("Passkey unavailable.");
        const result = await verifyAuthenticationResponse({ response, expectedChallenge: String(data.challenge), expectedOrigin: String(data.origin), expectedRPID: key.rpId, requireUserVerification: true, credential: { id: key.id, publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")), counter: key.counter } });
        if (!result.verified) throw new AuthError("Passkey verification failed.");
        await tx.put("passkey", dir, { ...key, counter: result.authenticationInfo.newCounter });
      }
    } else if (input.method === "recovery" && !enroll) {
      const hash = secretHash(input.code ?? "");
      if (!user.recoveryCodes?.includes(hash)) throw new AuthError("Invalid recovery code.");
      user.recoveryCodes = user.recoveryCodes.filter(c => c !== hash);
    } else throw new AuthError("Choose an available verification method.");
    let codes: string[] | undefined;
    if (enroll) { user.refreshVersion++; codes = Array.from({ length: 10 }, () => newSecret().slice(0, 20)); user.recoveryCodes = codes.map(secretHash); }
    await tx.put("user", dir, user);
    await this.identity.audit(tx, scope, user.id, enroll ? "factor.enrolled" : input.method === "recovery" ? "factor.recovered" : "factor.verified");
    return codes;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("Authentication factor verification failed.");
    }
  }
}
