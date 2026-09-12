import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  BetterPortalConfigSchema,
  BPService,
  type BPServiceDefinition
} from "@betterportal/plugin-bsb";
import {
  ServiceConfigWriteError,
  createBpTokenIssuer,
  loadOrGenerateKeyPair,
  publicKeyToJwk,
  type BpTokenIssuer,
  type JwtVerifier,
  type RsaKeyPair,
  type JwtClaims,
  type ElevationRequirement,
  type TenantAppValidation
} from "@betterportal/framework";
import type { BetterPortalEvent } from "@betterportal/framework/lib/runtime/h3.js";
import { atomicWrite, openAuthStorage, type Scope } from "../../storage.js";
import { AuthError, IdentityService, SecretCipher, equalSecret, type IdentityPolicy, type User } from "../../identity.js";
import { Factors } from "../../factors.js";
import { MailQueue, type MailConfig } from "../../mail.js";
import { AuthConfigSchemas } from "../../config.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(80),
  issuer: av.string().minLength(1),
  audience: av.string().minLength(1).default("betterportal-runtime"),
  accessTokenSeconds: av.int().min(1).default(60 * 15),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7),
  keyStorePath: av.string().minLength(1).default("./.bp-auth-state/keys.json"),
  userStorePath: av.string().minLength(1).default("./.bp-auth-state/users.json"),
  mode: av.enum_(["simple", "advanced"] as const).default("simple"),
  postgresUrl: av.string().default(""),
  encryptionKey: av.string().default(""),
  setupToken: av.string().default(""),
  betterportal: BetterPortalConfigSchema
});
export type AuthPluginConfig = av.Infer<typeof PluginConfigSchema>;

const Config = createConfigSchema(
  {
    name: "service-betterportal-auth-default",
    description: "Default BetterPortal auth: app-scoped accounts, social sign-in, MFA and JWT sessions",
    tags: ["betterportal", "auth", "jwt", "jwks"],
    documentation: ["./README.md"],
    image: "./betterportal-logo.png"
  },
  PluginConfigSchema
);

const EventSchemas = createEventSchemas({
  emitEvents: {},
  onEvents: {},
  emitReturnableEvents: {},
  onReturnableEvents: {},
  emitBroadcast: {},
  onBroadcast: {}
});

export interface AuthRuntime {
  readonly tokenIssuer: BpTokenIssuer;
  readonly identity: IdentityService;
  readonly factors: Factors;
  readonly mail: MailQueue;
  readonly policy: (scope: Scope) => Promise<IdentityPolicy>;
  readonly isManagement: (scope: Scope) => boolean;
  readonly verifySetup: (token: string) => boolean;
  readonly configuration: (scope: Scope) => Record<string, unknown>;
  readonly accessTokenSeconds: number;
  readonly refreshTokenSeconds: number;
}

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;

  private keyPair!: RsaKeyPair;
  private identity!: IdentityService;
  private factors!: Factors;
  private mail!: MailQueue;
  private setupSecret = "";
  private mailTimer?: ReturnType<typeof setInterval>;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "org.betterportal.auth.default",
        title: "BetterPortal Default Auth",
        description: "JWT-issuing auth service with isolated account directories, MFA and JSON/PostgreSQL storage.",
        capabilities: ["auth"],
        configSchemas: AuthConfigSchemas
      }
    };
  }

  async init(obs: Observable): Promise<void> {
    const cfg = this.config;

    if (cfg.mode === "advanced" && !existsSync(resolve(cfg.keyStorePath))) throw new Error("Advanced auth requires provisioned signing keys shared by its replicas");
    this.keyPair = loadOrGenerateKeyPair(resolve(cfg.keyStorePath));

    await super.init(obs);

    const keyPath = `${resolve(cfg.userStorePath)}.crypto.json`;
    const localKey = existsSync(keyPath) ? JSON.parse(readFileSync(keyPath, "utf8")).key as string : undefined;
    if (cfg.mode === "advanced" && !cfg.encryptionKey) throw new Error("Advanced auth requires a shared encryptionKey (base64, 32 bytes); use the existing crypto file key when migrating");
    if (localKey && cfg.encryptionKey && localKey !== cfg.encryptionKey) throw new Error("Encryption key differs from the Simple store key");
    const encryptionKey = cfg.encryptionKey || localKey || randomBytes(32).toString("base64");
    if (!localKey) atomicWrite(keyPath, { key: encryptionKey });
    const portal = this.getPortalConfig();
    const appIds: Record<string, string[]> = {};
    for (const app of portal?.apps ?? []) (appIds[app.tenantId] ??= []).push(app.id);
    const storage = await openAuthStorage({ mode: cfg.mode, path: cfg.userStorePath, connectionString: cfg.postgresUrl, installationId: createHash("sha256").update(cfg.issuer).digest("hex"), appIds });
    this.identity = new IdentityService(storage, new SecretCipher(Buffer.from(encryptionKey, "base64")));
    this.factors = new Factors(this.identity);
    this.mail = new MailQueue(this.identity, scope => this.mailConfiguration(scope));
    const setupPath = `${resolve(cfg.userStorePath)}.setup.json`;
    if (cfg.setupToken) this.setupSecret = cfg.setupToken;
    else if (existsSync(setupPath)) this.setupSecret = JSON.parse(readFileSync(setupPath, "utf8")).token;
    else if (await this.identity.hasNoUsers()) { this.setupSecret = randomBytes(32).toString("base64url"); atomicWrite(setupPath, { token: this.setupSecret }); }
    this.mailTimer = setInterval(() => { void this.mail.drain().catch(() => obs.log.error("Auth mail delivery queue unavailable")); }, 15000);
    this.mailTimer.unref();

    const jwk = publicKeyToJwk(this.keyPair.publicKeyPem, this.keyPair.kid);
    this.registerAsAuthProvider({
      tokenIssuer: this.tokenIssuer(),
      issuer: cfg.issuer,
      audience: cfg.audience,
      jwksUri: `${cfg.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
      jwks: { keys: [jwk] }
    });

    obs.log.info("Auth service initialized: issuer={issuer} audience={audience} kid={kid}", {
      issuer: cfg.issuer,
      audience: cfg.audience,
      kid: this.keyPair.kid
    });
  }

  get runtime(): AuthRuntime {
    return {
      tokenIssuer: this.tokenIssuer(),
      identity: this.identity,
      factors: this.factors,
      mail: this.mail,
      policy: scope => this.policy(scope),
      isManagement: scope => this.isManagement(scope),
      verifySetup: token => !!this.setupSecret && equalSecret(this.setupSecret, token),
      configuration: scope => this.effectiveServiceConfig(scope.tenantId, scope.appId),
      accessTokenSeconds: this.config.accessTokenSeconds,
      refreshTokenSeconds: this.config.refreshTokenSeconds
    };
  }

  /**
   * Override BPService hook so the auth service can verify its own access tokens
   * (e.g., for routes that require auth, even on the auth service itself).
   */
  protected getJwtVerifier(_tenantId: string, _appId: string): JwtVerifier | undefined {
    return this.tokenIssuer().verifier("access");
  }

  protected async validateTenantApp(tenantId: string, appId: string): Promise<TenantAppValidation> {
    if (!this.identity) return { allowed: false, reason: "Auth storage is initializing" };
    if (await this.validateConfigScope(tenantId, appId)) return this.config.mode === "simple" ? super.validateTenantApp(tenantId, appId) : { allowed: true };
    return {
      allowed: false,
      reason: `Default auth service is not activated for tenant ${tenantId} app ${appId}.`
    };
  }

  async dispose(): Promise<void> {
    if (this.mailTimer) clearInterval(this.mailTimer);
    await super.dispose();
    if (this.identity) await this.identity.storage.close();
  }

  protected async mutateServiceConfiguration<T>(tenantId: string, appId: string | undefined, values: Record<string, unknown>, write: () => T | Promise<T>): Promise<T> {
    if (!this.identity) throw new ServiceConfigWriteError("Auth storage is initializing.", 503);
    return this.identity.storage.transaction({ tenantId, appId: "" }, async tx => {
      if (appId && values.defaultRoleIds !== undefined) {
        let roles: unknown;
        try { roles = typeof values.defaultRoleIds === "string" ? JSON.parse(values.defaultRoleIds) : values.defaultRoleIds; }
        catch { throw new ServiceConfigWriteError("Default roles must be a JSON array."); }
        const allowed = this.getPortalConfig()?.apps.find(app => app.tenantId === tenantId && app.id === appId)?.auth?.roles.map(role => role.id) ?? [];
        if (!Array.isArray(roles) || roles.some(id => typeof id !== "string" || id === "*" || !allowed.includes(id))) throw new ServiceConfigWriteError("Default roles must reference existing app roles and cannot include root.");
      }
      if (values.requireMfa !== undefined && typeof values.requireMfa !== "boolean") throw new ServiceConfigWriteError("Require MFA must be a boolean.");
      if (values.registration !== undefined && !["public", "invite-only", "closed"].includes(String(values.registration))) throw new ServiceConfigWriteError("Choose a supported registration policy.");
      if (Object.hasOwn(values, "directoryAdminAppId")) {
        if (appId) throw new ServiceConfigWriteError("Directory administration can only be configured at tenant scope.");
        if (values.directoryAdminAppId && !this.getPortalConfig()?.apps.some(app => app.tenantId === tenantId && app.id === values.directoryAdminAppId)) throw new ServiceConfigWriteError("Choose a directory administration app in this tenant.");
      }
      if (Object.hasOwn(values, "userIsolation")) {
        if (appId) throw new ServiceConfigWriteError("User isolation can only be configured at tenant scope.");
        const settings = await tx.get("tenant", tenantId, { tenantId, appId: "" });
        const isolation = values.userIsolation ?? settings?.isolation ?? "app";
        if (isolation !== "app" && isolation !== "tenant") throw new ServiceConfigWriteError("Choose app or tenant isolation.");
        if (settings?.lockedAt && settings.isolation !== isolation) throw new ServiceConfigWriteError("User isolation is permanently locked because this tenant has accounts.");
        await tx.put("tenant", { tenantId, appId: "" }, { ...settings, id: tenantId, isolation });
      }
      return write();
    });
  }

  private isManagement(scope: Scope): boolean {
    const management = this.getPortalConfig()?.configManagement;
    return !!management && management.adminTenantId === scope.tenantId && management.managementAppId === scope.appId;
  }

  private async policy(scope: Scope): Promise<IdentityPolicy> {
    const tenant = this.effectiveServiceConfig(scope.tenantId);
    const config = this.effectiveServiceConfig(scope.tenantId, scope.appId);
    const requested = tenant.userIsolation;
    if (requested !== undefined && requested !== "app" && requested !== "tenant") throw new AuthError("Invalid user isolation configuration.", 503);
    const isolation = await this.identity.effectiveIsolation(scope.tenantId, requested);
    const registration = config.registration ?? "invite-only";
    if (registration !== "public" && registration !== "invite-only" && registration !== "closed") throw new AuthError("Invalid registration configuration.", 503);
    const defaults = typeof config.defaultRoleIds === "string" ? JSON.parse(config.defaultRoleIds) : config.defaultRoleIds ?? [];
    if (!Array.isArray(defaults) || defaults.some(v => typeof v !== "string")) throw new AuthError("Default roles must be a JSON array.", 503);
    const roles = this.getPortalConfig()?.apps.find(a => a.id === scope.appId && a.tenantId === scope.tenantId)?.auth?.roles ?? [];
    return { isolation, registration, defaultRoleIds: defaults, allowedRoleIds: roles.map(r => r.id), requireMfa: config.requireMfa === true, canManageDirectory: isolation === "app" || tenant.directoryAdminAppId === scope.appId || this.isManagement(scope) };
  }

  private mailConfiguration(scope: Scope): MailConfig | undefined {
    const config = this.effectiveServiceConfig(scope.tenantId, scope.appId);
    if (!config.mailUrl || !config.mailFrom || !["postal", "http"].includes(String(config.mailTransport))) return undefined;
    return { transport: config.mailTransport as "postal" | "http", url: String(config.mailUrl), from: String(config.mailFrom), apiKey: String(config.mailApiKey ?? ""), headers: config.mailHeaders ? JSON.parse(String(config.mailHeaders)) : undefined };
  }

  protected async beginAuthElevation(claims: JwtClaims, requirement: ElevationRequirement, event: BetterPortalEvent, actionContext: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const scope = { tenantId: claims.tenantId, appId: claims.appId };
    const policy = await this.policy(scope);
    const user = await this.identity.findUser(scope, policy, claims.sub, true);
    if (!user?.enabled) throw new AuthError("Account unavailable.");
    await this.identity.storage.transaction(scope, tx => this.identity.assertActiveSession(tx, scope, claims, user));
    await this.identity.rateLimit(scope, "elevation", user.id, 20);
    const hasFactors = await this.factors.hasFactors(user);
    if (!hasFactors && requirement.minimum === "mfa") throw new AuthError("Enroll an authentication factor in your account settings first.");
    const prepared = hasFactors ? await this.factors.prepare(user, event.req.headers.get("origin") ?? event.url.origin) : undefined;
    const challenge = await this.identity.challenge(scope, "elevation", { jti: claims.jti, version: user.refreshVersion, actionContext, factor: prepared?.private ?? null }, user.id, Math.min(300, claims.exp - Math.floor(Date.now() / 1000)));
    return { challengeId: challenge.id, secret: challenge.secret, method: hasFactors ? "factor" : "confirm", ...prepared?.public };
  }

  protected async finishAuthElevation(claims: JwtClaims, body: Record<string, unknown>, _event: BetterPortalEvent): Promise<{ user: JwtClaims; assurance: "confirmed" | "mfa" }> {
    const scope = { tenantId: claims.tenantId, appId: claims.appId };
    const policy = await this.policy(scope);
    return this.identity.consume(scope, "elevation", String(body.challengeId ?? ""), String(body.secret ?? ""), async (challenge, tx) => {
      const dir = { tenantId: scope.tenantId, appId: policy.isolation === "app" ? scope.appId : "" };
      const user = await tx.get<User>("user", claims.sub, dir);
      if (!user?.enabled || user.refreshVersion !== challenge.data.version || challenge.data.jti !== claims.jti || challenge.userId !== user.id) throw new AuthError("Session changed; sign in again.");
      await this.identity.assertActiveSession(tx, scope, claims, user);
      if (challenge.data.factor && (challenge.data.factor as Record<string, unknown>).origin !== (_event.req.headers.get("origin") ?? _event.url.origin)) throw new AuthError("Verification belongs to another origin.");
      if (challenge.data.factor) await this.factors.complete(tx, scope, user, challenge.data.factor as Record<string, unknown>, body);
      else if (body.confirm !== true) throw new AuthError("Confirmation required.");
      const roles = await this.identity.roles(tx, scope, user, policy);
      await this.identity.audit(tx, scope, user.id, "auth.elevated", { reportedAction: challenge.data.actionContext ?? {} });
      return { user: { ...claims, roles }, assurance: challenge.data.factor ? "mfa" : "confirmed" };
    });
  }

  private tokenIssuer(): BpTokenIssuer {
    return createBpTokenIssuer({
      keyPair: this.keyPair,
      issuer: this.config.issuer,
      audience: this.config.audience,
      accessTokenSeconds: this.config.accessTokenSeconds,
      refreshTokenSeconds: this.config.refreshTokenSeconds
    });
  }
}

export type PluginFeature = Pick<Plugin, "runtime">;

export { Config, EventSchemas };
