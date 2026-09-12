import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import bcrypt from "bcrypt";
import * as av from "anyvali";
import { uuidv7, type BpTokenIssuer, type JwtClaims } from "@betterportal/framework";
import type { AuthStorage, AuthTransaction, RecordValue, Scope } from "./storage.js";

export class AuthError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export interface IdentityPolicy {
  isolation: "app" | "tenant";
  registration: "public" | "invite-only" | "closed";
  defaultRoleIds: string[];
  allowedRoleIds: string[];
  requireMfa: boolean;
  canManageDirectory?: boolean;
}
export interface User extends RecordValue {
  username: string; tenantId: string; appId: string; passwordHash?: string;
  email?: string; emailVerified: boolean; name?: string; picture?: string;
  enabled: boolean; refreshVersion: number; createdAt: number; updatedAt: number;
  totp?: string; totpLastStep?: number; recoveryCodes?: string[];
}
export interface Challenge extends RecordValue {
  purpose: string; userId?: string; hash: string; expiresAt: number; attempts: number;
  data: Record<string, unknown>;
}
export interface Session extends RecordValue {
  userId: string; userAppId: string; version: number; jti: string; previousJtis: string[];
  expiresAt: number; createdAt: number; revoked: boolean;
}
interface TenantSettings extends RecordValue { isolation: "app" | "tenant"; lockedAt?: number; bootstrapComplete?: boolean }
interface Assignment extends RecordValue { roles: string[]; initialized: boolean }
const tenantScope = (tenantId: string): Scope => ({ tenantId, appId: "" });
export const secretHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");
export const normalizeAccountIdentifier = (value: string) => value.trim().toLowerCase();
const EmailSchema = av.string().maxLength(254).format("email");
export function isValidEmail(value: string): boolean {
  // Bound input before parsing: AnyVali collects issues rather than stopping at maxLength.
  return value.length <= 254 && EmailSchema.safeParse(value).success;
}
export function equalSecret(a: string, b: string): boolean {
  const aa = Buffer.from(secretHash(a)); const bb = Buffer.from(secretHash(b));
  return timingSafeEqual(aa, bb);
}
export class SecretCipher {
  constructor(private readonly key: Buffer) { if (key.length !== 32) throw new Error("Invalid auth encryption key"); }
  encrypt(value: string): string {
    const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  }
  decrypt(value: string): string {
    const input = Buffer.from(value, "base64url"); const decipher = createDecipheriv("aes-256-gcm", this.key, input.subarray(0, 12));
    decipher.setAuthTag(input.subarray(12, 28));
    return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]).toString("utf8");
  }
}
export function validatePassword(value: string): void {
  if (value.length < 12 || Buffer.byteLength(value, "utf8") > 1024) throw new AuthError("Use a password between 12 and 1024 bytes.");
  if (/^(password|qwerty|letmein|welcome|123456|betterportal|admin)/i.test(value)) throw new AuthError("Choose a less common password.");
}
export async function hashPassword(value: string): Promise<string> { validatePassword(value); return argon2.hash(value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }); }
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | undefined, value: string): Promise<boolean> {
  // Legacy bcrypt accepted UTF-8 input beyond its 72-byte effective key length.
  if (hash?.startsWith("$2")) return bcrypt.compare(value, hash);
  if (Buffer.byteLength(value, "utf8") > 1024) return false;
  if (!hash) { dummyHash ??= hashPassword("unavailable account timing check"); await argon2.verify(await dummyHash, value); return false; }
  if (hash.startsWith("$argon2")) return argon2.verify(hash, value);
  return false;
}

export class IdentityService {
  constructor(readonly storage: AuthStorage, readonly cipher: SecretCipher) {}

  private async directory(tx: AuthTransaction, scope: Scope, isolation: IdentityPolicy["isolation"], lock = false): Promise<Scope> {
    const root = tenantScope(scope.tenantId);
    const settings = await tx.get<TenantSettings>("tenant", scope.tenantId, root);
    if (settings && settings.isolation !== isolation) throw new AuthError("User isolation is locked for this tenant.", 409);
    if (lock) {
      if (this.storage.mode === "simple") {
        const tenants = await tx.list<TenantSettings>("tenant");
        if (tenants.some(t => t.id !== scope.tenantId)) throw new AuthError("Simple auth supports one tenant. Upgrade to Advanced.", 426);
      }
      await tx.put("tenant", root, { ...settings, id: scope.tenantId, isolation, lockedAt: settings?.lockedAt ?? Date.now() });
    }
    return { tenantId: scope.tenantId, appId: (settings?.lockedAt ? settings.isolation : isolation) === "tenant" ? "" : scope.appId };
  }
  async effectiveIsolation(tenantId: string, requested?: "app" | "tenant"): Promise<"app" | "tenant"> {
    return this.storage.transaction(tenantScope(tenantId), async tx => {
      const settings = await tx.get<TenantSettings>("tenant", tenantId, tenantScope(tenantId));
      if (settings?.lockedAt && requested && requested !== settings.isolation) throw new AuthError("User isolation cannot change after account creation.", 409);
      return requested ?? settings?.isolation ?? "app";
    });
  }
  async hasNoUsers(): Promise<boolean> { return this.storage.transaction(tenantScope(""), async tx => !(await tx.list("user")).length); }
  async bootstrapAvailable(scope: Scope): Promise<boolean> {
    return this.storage.transaction(scope, async tx => !(await tx.get<TenantSettings>("tenant", scope.tenantId, tenantScope(scope.tenantId)))?.bootstrapComplete);
  }
  async createUser(scope: Scope, policy: IdentityPolicy, input: { username: string; password?: string; email?: string; name?: string; verified?: boolean }, roles?: string[], root = false): Promise<User> {
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    return this.storage.transaction(scope, async tx => this.createInTransaction(tx, scope, policy, input, passwordHash, roles, root));
  }
  async createInTransaction(tx: AuthTransaction, scope: Scope, policy: IdentityPolicy, input: { username: string; email?: string; name?: string; verified?: boolean }, passwordHash?: string, roles?: string[], root = false): Promise<User> {
    const dir = await this.directory(tx, scope, policy.isolation, true);
    if (this.storage.mode === "simple" && (await tx.list("user")).length >= 10) throw new AuthError("Simple auth is limited to 10 stored users. Upgrade to Advanced.", 426);
    const username = normalizeAccountIdentifier(input.username); const email = input.email ? normalizeAccountIdentifier(input.email) : undefined;
    if (!username || username.length > 254 || (email !== undefined && !isValidEmail(email))) throw new AuthError("Enter a valid account identifier and email.");
    for (const id of new Set([username, ...(email ? [email] : [])])) if (await tx.get("identifier", id, dir)) throw new AuthError("This account cannot be registered.", 409);
    if (roles?.includes("*") && !root) throw new AuthError("Root cannot be assigned by account provisioning.", 403);
    if (root) {
      if ((await tx.get<TenantSettings>("tenant", scope.tenantId, tenantScope(scope.tenantId)))?.bootstrapComplete) throw new AuthError("Bootstrap already completed.", 409);
      const settings = await tx.get<TenantSettings>("tenant", scope.tenantId, tenantScope(scope.tenantId));
      await tx.put("tenant", tenantScope(scope.tenantId), { ...settings!, bootstrapComplete: true });
    }
    const user: User = { id: uuidv7(), username, tenantId: dir.tenantId, appId: dir.appId, passwordHash, email, emailVerified: input.verified ?? false, name: input.name, enabled: true, bootstrapAdmin: root, refreshVersion: 0, createdAt: Date.now(), updatedAt: Date.now() };
    await tx.put("user", dir, user);
    for (const id of new Set([username, ...(email ? [email] : [])])) await tx.put("identifier", dir, { id, userId: user.id });
    if (roles) await tx.put("roles", scope, { id: user.id, roles, initialized: true });
    await this.audit(tx, scope, user.id, "user.created");
    return user;
  }
  async findUser(scope: Scope, policy: IdentityPolicy, identifier: string, byId = false): Promise<User | undefined> {
    return this.storage.transaction(scope, async tx => {
      const dir = await this.directory(tx, scope, policy.isolation);
      const id = byId ? identifier : (await tx.get("identifier", normalizeAccountIdentifier(identifier), dir))?.userId as string | undefined;
      return id ? tx.get<User>("user", id, dir) : undefined;
    });
  }
  async authenticate(scope: Scope, policy: IdentityPolicy, username: string, password: string): Promise<User | undefined> {
    const before = await this.storage.transaction(scope, async tx => {
      const dir = await this.directory(tx, scope, policy.isolation);
      // Only password sign-in accepts exact legacy usernames for ambiguous identifiers.
      // Email recovery and all other lookups continue to reject ambiguous ownership.
      const index = await tx.get("legacy-username", username, dir) ?? await tx.get("identifier", normalizeAccountIdentifier(username), dir);
      return typeof index?.userId === "string" ? tx.get<User>("user", index.userId, dir) : undefined;
    });
    const verified = await verifyPassword(before?.passwordHash, password);
    if (!before?.enabled || !verified) return undefined;
    const nextHash = before.passwordHash?.startsWith("$2") && Buffer.byteLength(password, "utf8") <= 1024 ? await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }) : undefined;
    return this.storage.transaction(scope, async tx => {
      const dir = await this.directory(tx, scope, policy.isolation);
      const current = await tx.get<User>("user", before.id, dir);
      if (!current?.enabled || current.passwordHash !== before.passwordHash || current.refreshVersion !== before.refreshVersion) return undefined;
      if (nextHash) { current.passwordHash = nextHash; await tx.put("user", dir, current); }
      return current;
    });
  }
  async updateUser(scope: Scope, policy: IdentityPolicy, id: string, update: (user: User, tx: AuthTransaction) => Promise<void>): Promise<User> {
    return this.storage.transaction(scope, async tx => {
      const dir = await this.directory(tx, scope, policy.isolation);
      const user = await tx.get<User>("user", id, dir);
      if (!user) throw new AuthError("Account unavailable.", 404);
      await update(user, tx); user.updatedAt = Date.now(); await tx.put("user", dir, user); return user;
    });
  }
  async roles(tx: AuthTransaction, scope: Scope, user: User, policy: IdentityPolicy, initialize = false): Promise<string[]> {
    let assignment = await tx.get<Assignment>("roles", user.id, scope);
    if (!assignment?.initialized && initialize) {
      if (policy.defaultRoleIds.some(id => id === "*" || !policy.allowedRoleIds.includes(id))) throw new AuthError("Default roles reference unavailable roles.", 503);
      assignment = { id: user.id, roles: [...new Set(policy.defaultRoleIds)], initialized: true };
      await tx.put("roles", scope, assignment);
      await this.audit(tx, scope, user.id, "roles.initialized", { roles: assignment.roles });
    }
    const groups = await tx.list("group", { tenantId: user.tenantId, appId: user.appId });
    const groupRoles = groups.filter(g => (g.members as string[]).includes(user.id)).flatMap(g => (g.appRoles as Record<string, string[]>)[scope.appId] ?? []);
    return [...new Set([...(assignment?.roles ?? []), ...groupRoles])].filter(id => id === "*" || policy.allowedRoleIds.includes(id));
  }
  async issueSession(scope: Scope, policy: IdentityPolicy, user: User, issuer: BpTokenIssuer, refreshSeconds: number) {
    return this.storage.transaction(scope, async tx => {
      const dir = await this.directory(tx, scope, policy.isolation);
      const current = await tx.get<User>("user", user.id, dir);
      if (!current?.enabled || current.refreshVersion !== user.refreshVersion) throw new AuthError("Account changed; sign in again.", 401);
      const id = uuidv7();
      const roles = await this.roles(tx, scope, current, policy, true);
      const issued = issuer.issueTokenPair({ sub: user.id, ...scope, roles, sessionId: id, sessionVersion: user.refreshVersion, name: current.name ?? current.username, email: current.email, picture: current.picture, authProvider: "betterportal.default", refreshContext: { sessionId: id, version: user.refreshVersion } });
      await tx.put("session", scope, { id, userId: user.id, userAppId: dir.appId, version: user.refreshVersion, jti: issued.tokenId, previousJtis: [], expiresAt: Date.now() + refreshSeconds * 1000, createdAt: Date.now(), revoked: false });
      await this.audit(tx, scope, user.id, "login.success");
      return issued;
    });
  }
  async refresh(scope: Scope, policy: IdentityPolicy, claims: JwtClaims, issuer: BpTokenIssuer) {
    return this.storage.transaction(scope, async tx => {
      const id = String(claims.refreshContext?.sessionId ?? "");
      const session = await tx.get<Session>("session", id, scope);
      const dir = await this.directory(tx, scope, policy.isolation);
      const user = session ? await tx.get<User>("user", session.userId, dir) : undefined;
      if (!session || !user?.enabled || session.revoked || session.expiresAt <= Date.now() || user.id !== claims.sub || user.refreshVersion !== session.version) return undefined;
      if (session.jti !== claims.jti) { session.revoked = true; await tx.put("session", scope, session); await this.audit(tx, scope, user.id, "refresh.replay"); return undefined; }
      const roles = await this.roles(tx, scope, user, policy);
      const issued = issuer.issueTokenPair({ sub: user.id, ...scope, roles, sessionId: id, sessionVersion: user.refreshVersion, name: user.name ?? user.username, email: user.email, picture: user.picture, authProvider: "betterportal.default", refreshContext: { sessionId: id, version: user.refreshVersion } });
      session.previousJtis = [...session.previousJtis.slice(-4), session.jti]; session.jti = issued.tokenId;
      await tx.put("session", scope, session); return issued;
    });
  }
  async assertActiveSession(tx: AuthTransaction, scope: Scope, claims: JwtClaims, user: User): Promise<void> {
    const session = await tx.get<Session>("session", claims.sessionId ?? "", scope);
    if (!session || session.revoked || session.expiresAt <= Date.now() || session.userId !== user.id || session.version !== user.refreshVersion
      || claims.sessionVersion !== user.refreshVersion) throw new AuthError("Session changed; sign in again.", 401);
  }
  async revokeSession(scope: Scope, claims: JwtClaims): Promise<void> {
    await this.storage.transaction(scope, async tx => {
      const session = await tx.get<Session>("session", String(claims.refreshContext?.sessionId ?? ""), scope);
      if (session?.userId === claims.sub) { session.revoked = true; await tx.put("session", scope, session); await this.audit(tx, scope, claims.sub, "session.revoked"); }
    });
  }
  async challenge(scope: Scope, purpose: string, data: Record<string, unknown>, userId?: string, lifetimeSeconds = 600): Promise<{ id: string; secret: string }> {
    return this.storage.transaction(scope, async tx => this.challengeInTransaction(tx, scope, purpose, data, userId, lifetimeSeconds));
  }
  async challengeInTransaction(tx: AuthTransaction, scope: Scope, purpose: string, data: Record<string, unknown>, userId?: string, lifetimeSeconds = 600) {
    const id = uuidv7(); const secret = newSecret();
    const records = await tx.list<Challenge>("challenge", scope);
    for (const record of records) if (record.expiresAt <= Date.now()) await tx.remove("challenge", record.id, scope);
    if (records.filter(c => c.expiresAt > Date.now()).length >= 1000) throw new AuthError("Too many pending requests. Try later.", 429);
    await tx.put("challenge", scope, { id, purpose, data, userId, hash: secretHash(secret), attempts: 0, expiresAt: Date.now() + lifetimeSeconds * 1000 });
    return { id, secret };
  }
  async consume<T>(scope: Scope, purpose: string, id: string, secret: string, complete: (challenge: Challenge, tx: AuthTransaction) => Promise<T>): Promise<T> {
    return this.consumeWithPreparation(scope, purpose, id, secret, async () => undefined, complete);
  }
  async consumeWithPreparation<T, P>(scope: Scope, purpose: string, id: string, secret: string, prepare: (challenge: Challenge) => Promise<P>, complete: (challenge: Challenge, tx: AuthTransaction, prepared: P) => Promise<T>): Promise<T> {
    // Charge the attempt independently. The application transaction must roll back
    // every side effect on failure, while a failed factor still consumes an attempt.
    const accepted = await this.storage.transaction(scope, async tx => {
      const challenge = await tx.get<Challenge>("challenge", id, scope);
      if (!challenge || challenge.purpose !== purpose || challenge.expiresAt <= Date.now() || challenge.attempts >= 5) return false;
      challenge.attempts++; await tx.put("challenge", scope, challenge);
      return equalSecret(challenge.hash, secretHash(secret)) ? challenge : false;
    });
    if (!accepted) throw new AuthError("Verification expired or unavailable.");
    // Remote work happens without a store/tenant lock. Revalidate and consume only on commit.
    const prepared = await prepare(accepted);
    return this.storage.transaction(scope, async tx => {
      const challenge = await tx.get<Challenge>("challenge", id, scope);
      if (!challenge || challenge.purpose !== purpose || challenge.expiresAt <= Date.now()
        || !equalSecret(challenge.hash, secretHash(secret))) throw new AuthError("Verification expired or unavailable.");
      const value = await complete(challenge, tx, prepared);
      await tx.remove("challenge", id, scope);
      return value;
    });
  }

  async rateLimit(scope: Scope, action: string, actor: string, max = 10, seconds = 600): Promise<void> {
    const allowed = await this.storage.transaction(scope, async tx => {
      const records = await tx.list("limit", scope);
      for (const row of records) if (Number(row.reset) <= Date.now()) await tx.remove("limit", row.id, scope);
      if (records.filter(row => Number(row.reset) > Date.now()).length >= 10000) return false;
      const id = secretHash(`${action}:${actor}`); const old = await tx.get("limit", id, scope);
      const reset = Number(old?.reset ?? 0) > Date.now() ? Number(old!.reset) : Date.now() + seconds * 1000;
      const count = Number(old?.reset ?? 0) > Date.now() ? Number(old?.count ?? 0) + 1 : 1;
      await tx.put("limit", scope, { id, reset, count }); return count <= max;
    });
    if (!allowed) throw new AuthError("Too many attempts. Try again later.", 429);
  }
  async audit(tx: AuthTransaction, scope: Scope, actor: string, event: string, data: Record<string, unknown> = {}): Promise<void> {
    await tx.put("audit", scope, { id: uuidv7(), actor, event, data, at: Date.now() });
    if (this.storage.mode === "simple") {
      const entries = await tx.list("audit", scope);
      for (const row of entries.slice(0, Math.max(0, entries.length - 1000))) await tx.remove("audit", row.id, scope);
    }
  }
}
