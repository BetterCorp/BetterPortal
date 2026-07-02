import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import {
  BetterPortalConfigSchema,
  BPService,
  type BPServiceDefinition
} from "@betterportal/plugin-bsb";
import { verify as verifySignature } from "node:crypto";
import jwt, { type Algorithm, type JwtHeader } from "jsonwebtoken";
import {
  createBpTokenIssuer,
  getSigningKeyForKid,
  loadOrGenerateKeyPair,
  publicKeyToJwk,
  type BpTokenIssuer,
  type ConfigSchemaDescriptor,
  type JwtClaims,
  type JwtVerifier,
  type RsaKeyPair,
  type ServiceConfigTicketClaims,
  type TenantAppValidation
} from "@betterportal/framework";
import { registry } from "./.bp-generated/registry.js";
import { resolve } from "node:path";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3211),
  issuer: av.string().minLength(1),
  audience: av.string().minLength(1).default("betterportal-runtime"),
  accessTokenSeconds: av.int().min(1).default(60 * 15),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7),
  keyStorePath: av.string().minLength(1).default("./.bp-authress-state/keys.json"),
  betterportal: BetterPortalConfigSchema
}, { unknownKeys: "strip" });
export type AuthressPluginConfig = av.Infer<typeof PluginConfigSchema>;

const Config = createConfigSchema(
  {
    name: "service.betterportal.auth.authress-io",
    description: "BetterPortal Authress.io auth service",
    tags: ["betterportal", "auth", "authress"],
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

const STRONG_JWT_ALGORITHMS: Algorithm[] = [
  "RS256", "RS384", "RS512",
  "PS256", "PS384", "PS512",
  "ES256", "ES384", "ES512"
];
const STRONG_EXTERNAL_ALGORITHMS = new Set<string>([...STRONG_JWT_ALGORITHMS, "EdDSA"]);

export interface AuthressAppConfig {
  authressApiUrl: string;
  applicationId: string;
  expectedIssuer: string;
  expectedAudience?: string;
  jwksUri: string;
  scopes?: string;
  loginRedirectPath?: string;
  logoutRedirectPath?: string;
  roleClaimPath?: string;
  subjectClaimPath?: string;
  nameClaimPath?: string;
  emailClaimPath?: string;
  pictureClaimPath?: string;
  clientSecret?: string;
  apiKey?: string;
}

export type AuthressBrowserConfig = Pick<AuthressAppConfig, "authressApiUrl" | "applicationId" | "scopes">;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveAuthressBrowserConfig(raw: Record<string, unknown> | undefined): AuthressBrowserConfig | null {
  const authressApiUrl = nonEmptyString(raw?.authressApiUrl);
  const applicationId = nonEmptyString(raw?.applicationId);
  if (!authressApiUrl || !applicationId) return null;
  return {
    authressApiUrl,
    applicationId,
    ...(nonEmptyString(raw?.scopes) ? { scopes: nonEmptyString(raw?.scopes) } : {})
  };
}

export function resolveAuthressAppConfig(raw: Record<string, unknown> | undefined): AuthressAppConfig | null {
  const browser = resolveAuthressBrowserConfig(raw);
  if (!browser) return null;
  const authressApiUrl = stripTrailingSlash(browser.authressApiUrl);
  return {
    ...browser,
    authressApiUrl,
    expectedIssuer: nonEmptyString(raw?.expectedIssuer) ?? authressApiUrl,
    ...(nonEmptyString(raw?.expectedAudience) ? { expectedAudience: nonEmptyString(raw?.expectedAudience) } : {}),
    jwksUri: nonEmptyString(raw?.jwksUri) ?? `${authressApiUrl}/.well-known/openid-configuration/jwks`,
    ...(nonEmptyString(raw?.loginRedirectPath) ? { loginRedirectPath: nonEmptyString(raw?.loginRedirectPath) } : {}),
    ...(nonEmptyString(raw?.logoutRedirectPath) ? { logoutRedirectPath: nonEmptyString(raw?.logoutRedirectPath) } : {}),
    ...(nonEmptyString(raw?.roleClaimPath) ? { roleClaimPath: nonEmptyString(raw?.roleClaimPath) } : {}),
    ...(nonEmptyString(raw?.subjectClaimPath) ? { subjectClaimPath: nonEmptyString(raw?.subjectClaimPath) } : {}),
    ...(nonEmptyString(raw?.nameClaimPath) ? { nameClaimPath: nonEmptyString(raw?.nameClaimPath) } : {}),
    ...(nonEmptyString(raw?.emailClaimPath) ? { emailClaimPath: nonEmptyString(raw?.emailClaimPath) } : {}),
    ...(nonEmptyString(raw?.pictureClaimPath) ? { pictureClaimPath: nonEmptyString(raw?.pictureClaimPath) } : {}),
    ...(nonEmptyString(raw?.clientSecret) ? { clientSecret: nonEmptyString(raw?.clientSecret) } : {}),
    ...(nonEmptyString(raw?.apiKey) ? { apiKey: nonEmptyString(raw?.apiKey) } : {})
  };
}

export const AuthressConfigSchemas: ConfigSchemaDescriptor[] = [
  {
    id: "authress.app",
    title: "Authress App Config",
    description: "App-scoped Authress settings for browser login and JWT verification.",
    scope: "app",
    jsonSchema: {
      authressApiUrl: "string",
      applicationId: "string",
      expectedIssuer: "string",
      expectedAudience: "string",
      jwksUri: "string",
      scopes: "string",
      loginRedirectPath: "string",
      logoutRedirectPath: "string",
      roleClaimPath: "string",
      subjectClaimPath: "string",
      nameClaimPath: "string",
      emailClaimPath: "string",
      pictureClaimPath: "string",
      clientSecret: "string",
      apiKey: "string"
    },
    groups: [
      { id: "connection", title: "Connection", description: "Authress application and API endpoints.", order: 10, optional: false },
      { id: "jwt", title: "JWT Verification", description: "Optional overrides for Authress token verification. Leave blank to derive from the Authress API URL.", order: 20, optional: true },
      { id: "login", title: "Login", description: "Browser login request options.", order: 30, optional: true },
      { id: "claims", title: "Claims", description: "JWT claim paths mapped into the BetterPortal user context.", order: 40, optional: true },
      { id: "secrets", title: "Server Credentials", description: "Optional encrypted credentials for server-side Authress API calls.", order: 50, optional: true }
    ],
    fields: [
      { key: "authressApiUrl", title: "Authress API URL", description: "Authress account API URL used by the browser SDK.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "connection", order: 10, required: true },
      { key: "applicationId", title: "Application ID", description: "Authress application ID for this BP app.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "connection", order: 20, required: true },
      { key: "expectedIssuer", title: "Expected Issuer", description: "Optional JWT issuer override. Blank uses the Authress API URL.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "jwt", order: 10, required: false },
      { key: "expectedAudience", title: "Expected Audience", description: "Optional JWT audience override. Blank disables audience validation.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "jwt", order: 20, required: false },
      { key: "jwksUri", title: "JWKS URI", description: "Optional JWKS endpoint override. Blank uses Authress API URL + /.well-known/openid-configuration/jwks.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "jwt", order: 30, required: false },
      { key: "scopes", title: "Scopes", description: "Space-separated scopes requested by the browser login flow.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 10, required: false },
      { key: "loginRedirectPath", title: "Logged In Route", description: "Tenant route shown after signing in when no next path is supplied.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 20, defaultValue: "/", ui: { control: "select", optionsSource: "app.routes" }, required: false },
      { key: "logoutRedirectPath", title: "Logged Out Route", description: "Tenant route shown after signing out.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 30, defaultValue: "/", ui: { control: "select", optionsSource: "app.routes" }, required: false },
      { key: "roleClaimPath", title: "Role Claim Path", description: "Dot path to roles in the Authress token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 10, defaultValue: "roles", required: false },
      { key: "subjectClaimPath", title: "Subject Claim Path", description: "Dot path to the user subject in the Authress token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 20, defaultValue: "sub", required: false },
      { key: "nameClaimPath", title: "Name Claim Path", description: "Dot path to display name in the Authress token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 30, defaultValue: "name", required: false },
      { key: "emailClaimPath", title: "Email Claim Path", description: "Dot path to email in the Authress token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 40, defaultValue: "email", required: false },
      { key: "pictureClaimPath", title: "Picture Claim Path", description: "Dot path to avatar URL in the Authress token.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "claims", order: 50, defaultValue: "picture", required: false },
      { key: "clientSecret", title: "Client Secret", description: "Optional Authress client secret for server-side Authress flows.", scope: "app", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", groupId: "secrets", order: 10, required: false },
      { key: "apiKey", title: "API Key", description: "Optional Authress API key for server-side Authress API calls.", scope: "app", visibility: "secret", ownership: "bp", sourceOfTruth: "bp", groupId: "secrets", order: 20, required: false }
    ]
  }
];

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;
  private keyPair!: RsaKeyPair;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  async init(obs: Observable): Promise<void> {
    this.keyPair = loadOrGenerateKeyPair(resolve(this.config.keyStorePath));
    await super.init(obs);
    const jwk = publicKeyToJwk(this.keyPair.publicKeyPem, this.keyPair.kid);
    this.registerAsAuthProvider({
      issuer: this.config.issuer,
      audience: this.config.audience,
      jwksUri: `${this.config.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
      jwks: { keys: [jwk as unknown as Record<string, unknown>] }
    });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "service.betterportal.auth.authress-io",
        title: "BetterPortal Authress.io",
        description: "Authress-backed auth service for BetterPortal apps.",
        capabilities: ["auth"],
        configSchemas: AuthressConfigSchemas
      },
      registry
    };
  }

  protected getJwtVerifier(tenantId: string, appId: string): JwtVerifier | undefined {
    void tenantId;
    void appId;
    return this.tokenIssuer().verifier("access");
  }

  protected async validateTenantApp(tenantId: string, appId: string): Promise<TenantAppValidation> {
    if (await this.validateConfigScope(tenantId, appId)) return { allowed: true };
    return {
      allowed: false,
      reason: `Authress auth service is not activated for tenant ${tenantId} app ${appId}.`
    };
  }

  signAccessToken(input: {
    sub: string;
    tenantId: string;
    appId: string;
    roles: string[];
    name?: string;
    email?: string;
    picture?: string;
  }): string {
    return this.tokenIssuer().signAccessToken(input);
  }

  verifyAuthressToken(token: string, appConfig: AuthressAppConfig, scope: { tenantId: string; appId: string }): Promise<JwtClaims> {
    return verifyAuthressToken(token, appConfig, scope);
  }

  issueTokenPair(input: {
    sub: string;
    tenantId: string;
    appId: string;
    roles: string[];
    authProvider: string;
    providerSubject: string;
    provider?: JwtClaims["provider"];
    name?: string;
    email?: string;
    picture?: string;
  }, options?: { includeRefreshToken?: boolean }) {
    return this.tokenIssuer().issueTokenPair(input, options);
  }

  getAuthressAppConfig(tenantId: string, appId: string): AuthressAppConfig | null {
    return resolveAuthressAppConfig(this.getAuthressRawConfig(tenantId, appId));
  }

  getAuthressBrowserConfig(tenantId: string, appId: string): AuthressBrowserConfig | null {
    return resolveAuthressBrowserConfig(this.getAuthressRawConfig(tenantId, appId));
  }

  private getAuthressRawConfig(tenantId: string, appId: string): Record<string, unknown> {
    const ticket = this.authressConfigReadTicket(tenantId);
    const state = this.configStore.read(ticket);
    return { ...state.tenant, ...(state.app[appId] ?? {}) };
  }

  private authressConfigReadTicket(tenantId: string): ServiceConfigTicketClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: "service.betterportal.auth.authress-io",
      aud: "service.betterportal.auth.authress-io",
      sub: "service.betterportal.auth.authress-io",
      iat: now,
      exp: now + 60,
      jti: `${tenantId}:${now}`,
      realm: "control-plane",
      tenantId,
      serviceId: "service.betterportal.auth.authress-io",
      actions: ["config.read"]
    };
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

export { Config, EventSchemas };

async function verifyAuthressToken(token: string, appConfig: AuthressAppConfig, scope: { tenantId: string; appId: string }): Promise<JwtClaims> {
  const raw = await verifyExternalAuthressJwt(token, appConfig);
  const subjectPath = appConfig.subjectClaimPath ?? "sub";
  const sub = readStringClaim(raw, subjectPath) ?? readStringClaim(raw, "sub");
  if (!sub) throw new Error(`Authress token missing subject claim ${subjectPath}`);
  const name =
    readStringClaim(raw, appConfig.nameClaimPath ?? "name") ??
    readStringClaim(raw, "name") ??
    readStringClaim(raw, "data.name") ??
    readStringClaim(raw, "displayName") ??
    readStringClaim(raw, "preferred_username") ??
    readStringClaim(raw, "nickname") ??
    readStringClaim(raw, "data.login");
  const email =
    readStringClaim(raw, appConfig.emailClaimPath ?? "email") ??
    readStringClaim(raw, "email") ??
    readStringClaim(raw, "email_address");
  const picture =
    readStringClaim(raw, appConfig.pictureClaimPath ?? "picture") ??
    readStringClaim(raw, "picture") ??
    readStringClaim(raw, "avatar") ??
    readStringClaim(raw, "avatarUrl") ??
    readStringClaim(raw, "data.avatar_url");
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: String(raw.iss),
    aud: normalizeAudience(raw.aud),
    sub,
    exp: typeof raw.exp === "number" ? raw.exp : now,
    iat: typeof raw.iat === "number" ? raw.iat : now,
    ...(typeof raw.nbf === "number" ? { nbf: raw.nbf } : {}),
    jti: typeof raw.jti === "string" && raw.jti.length > 0 ? raw.jti : `${sub}:${raw.iat ?? now}`,
    realm: "runtime",
    tenantId: scope.tenantId,
    appId: scope.appId,
    roles: readStringArrayClaim(raw, appConfig.roleClaimPath ?? "roles"),
    tokenType: "access",
    authProvider: "authress.io",
    providerSubject: sub,
    provider: authressProviderReference(raw),
    ...optionalClaim("name", name),
    ...optionalClaim("email", email),
    ...optionalClaim("picture", picture)
  };
}

async function verifyExternalAuthressJwt(token: string, appConfig: AuthressAppConfig): Promise<Record<string, unknown>> {
  if (typeof token !== "string" || token.length === 0) throw new Error("Token is empty");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token must have exactly three parts");
  const header = parseHeader(parts[0]);
  if (!STRONG_EXTERNAL_ALGORITHMS.has(String(header.alg))) throw new Error(`Algorithm not allowed: ${String(header.alg)}`);
  if (typeof header.kid !== "string" || header.kid.length === 0) throw new Error("Token header missing kid");
  if ("jku" in header || "x5u" in header) throw new Error("Token header contains untrusted reference (jku/x5u)");

  const publicKeyPem = await getSigningKeyForKid({ jwksUri: appConfig.jwksUri, issuer: appConfig.expectedIssuer }, header.kid);
  const claims = header.alg === "EdDSA"
    ? verifyEdDsaJwt(token, publicKeyPem)
    : verifyJwtWithJsonwebtoken(token, publicKeyPem, appConfig);
  assertAuthressClaims(claims, appConfig);
  return claims;
}

function verifyJwtWithJsonwebtoken(token: string, publicKeyPem: string, appConfig: AuthressAppConfig): Record<string, unknown> {
  const verified = jwt.verify(token, publicKeyPem, {
    algorithms: STRONG_JWT_ALGORITHMS,
    issuer: appConfig.expectedIssuer,
    ...(appConfig.expectedAudience ? { audience: appConfig.expectedAudience } : {}),
    complete: false
  });
  if (!verified || typeof verified !== "object") throw new Error("Library returned non-object claims");
  return verified as Record<string, unknown>;
}

function verifyEdDsaJwt(token: string, publicKeyPem: string): Record<string, unknown> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const verified = verifySignature(
    null,
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKeyPem,
    Buffer.from(encodedSignature, "base64url")
  );
  if (!verified) throw new Error("Library verification failed: invalid signature");
  return parsePayload(encodedPayload);
}

function assertAuthressClaims(claims: Record<string, unknown>, appConfig: AuthressAppConfig): void {
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== appConfig.expectedIssuer) throw new Error(`Issuer mismatch (manual re-check) (${claims.iss} != ${appConfig.expectedIssuer})`);
  if (appConfig.expectedAudience) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(appConfig.expectedAudience)) {
      throw new Error(`Audience mismatch (manual re-check) (${appConfig.expectedAudience} != ${audiences.join(",")})`);
    }
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("Token is expired (manual re-check)");
  if (typeof claims.nbf === "number" && claims.nbf > now) throw new Error("Token is not yet valid (manual re-check)");
}

function parseHeader(encodedHeader: string): JwtHeader & { kid?: string; jku?: string; x5u?: string } {
  const parsed = parsePayload(encodedHeader);
  return parsed as unknown as JwtHeader & { kid?: string; jku?: string; x5u?: string };
}

function parsePayload(encodedPayload: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Token part is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Token part is not an object");
  return parsed as Record<string, unknown>;
}

function readStringClaim(claims: Record<string, unknown>, path: string): string | undefined {
  const value = readPath(claims, path);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArrayClaim(claims: Record<string, unknown>, path: string): string[] {
  const value = readPath(claims, path);
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function authressProviderReference(claims: Record<string, unknown>): JwtClaims["provider"] {
  const data = claims.data && typeof claims.data === "object" && !Array.isArray(claims.data)
    ? claims.data as Record<string, unknown>
    : {};
  return compactProviderReference({
    username: readStringClaim(claims, "preferred_username") ?? stringValue(data.login),
    profileUrl: stringValue(data.html_url),
    accountId: stringValue(data.id) ?? numberValue(data.id),
    nodeId: stringValue(data.node_id),
    scope: stringValue(claims.scope) ?? readStringClaim(claims, "context.scope")
  });
}

function compactProviderReference(input: NonNullable<JwtClaims["provider"]>): JwtClaims["provider"] {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as JwtClaims["provider"];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPath(claims: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, claims);
}

function normalizeAudience(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    const aud = value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    if (aud.length > 0) return aud;
  }
  return typeof value === "string" && value.length > 0 ? value : "authress";
}

function optionalClaim<K extends "name" | "email" | "picture">(key: K, value: string | undefined): Partial<Pick<JwtClaims, K>> {
  return value ? { [key]: value } as Partial<Pick<JwtClaims, K>> : {};
}
