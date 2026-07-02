import {
  type BSBServiceConstructor,
  createConfigSchema,
  createEventSchemas,
  type Observable
} from "@bsb/base";
import * as av from "anyvali";
import { resolve } from "node:path";
import {
  BetterPortalConfigSchema,
  BPService,
  type BPServiceDefinition
} from "@betterportal/plugin-bsb";
import {
  createBpTokenIssuer,
  loadOrGenerateKeyPair,
  publicKeyToJwk,
  type BpTokenIssuer,
  type ConfigSchemaDescriptor,
  type JwtVerifier,
  type RsaKeyPair,
  type TenantAppValidation
} from "@betterportal/framework";
import { UserStore } from "../../userStore.js";
import { registry } from "./.bp-generated/registry.js";

const PluginConfigSchema = av.object({
  host: av.string().minLength(1).default("0.0.0.0"),
  port: av.int().min(1).default(3210),
  issuer: av.string().minLength(1),
  audience: av.string().minLength(1).default("betterportal-runtime"),
  accessTokenSeconds: av.int().min(1).default(60 * 15),
  refreshTokenSeconds: av.int().min(1).default(60 * 60 * 24 * 7),
  keyStorePath: av.string().minLength(1).default("./.bp-auth-state/keys.json"),
  userStorePath: av.string().minLength(1).default("./.bp-auth-state/users.json"),
  betterportal: BetterPortalConfigSchema
}, { unknownKeys: "strip" });
export type AuthPluginConfig = av.Infer<typeof PluginConfigSchema>;

const Config = createConfigSchema(
  {
    name: "service-betterportal-auth-default",
    description: "Default BetterPortal v10 auth service: JWKS, login/logout/refresh, bcrypt user store",
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

export interface DefaultAuthAppConfig {
  loginRedirectPath?: string;
  logoutRedirectPath?: string;
}

export function resolveDefaultAuthAppConfig(raw: Record<string, unknown> | undefined): DefaultAuthAppConfig {
  const loginRedirectPath = typeof raw?.loginRedirectPath === "string" && raw.loginRedirectPath.trim()
    ? raw.loginRedirectPath.trim()
    : undefined;
  const logoutRedirectPath = typeof raw?.logoutRedirectPath === "string" && raw.logoutRedirectPath.trim()
    ? raw.logoutRedirectPath.trim()
    : undefined;
  return {
    ...(loginRedirectPath ? { loginRedirectPath } : {}),
    ...(logoutRedirectPath ? { logoutRedirectPath } : {})
  };
}

const DefaultAuthConfigSchemas: ConfigSchemaDescriptor[] = [{
  id: "auth.default.app",
  title: "Default Auth Config",
  description: "App-scoped default auth settings.",
  scope: "app",
  jsonSchema: { loginRedirectPath: "string", logoutRedirectPath: "string" },
  groups: [
    { id: "login", title: "Login", description: "Routes used after signing in.", order: 10, optional: true },
    { id: "logout", title: "Logout", description: "Routes used after signing out.", order: 20, optional: true }
  ],
  fields: [
    { key: "loginRedirectPath", title: "Logged In Route", description: "Tenant route shown after signing in when no next path is supplied.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "login", order: 10, defaultValue: "/", ui: { control: "select", optionsSource: "app.routes" }, required: false },
    { key: "logoutRedirectPath", title: "Logged Out Route", description: "Tenant route shown after signing out.", scope: "app", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", groupId: "logout", order: 10, defaultValue: "/", ui: { control: "select", optionsSource: "app.routes" }, required: false }
  ]
}];

export interface AuthRuntime {
  readonly tokenIssuer: BpTokenIssuer;
  readonly userStore: UserStore;
  readonly accessTokenSeconds: number;
  readonly refreshTokenSeconds: number;
}

export class Plugin extends BPService<InstanceType<typeof Config>, typeof EventSchemas> {
  static Config = Config;
  static EventSchemas = EventSchemas;

  private keyPair!: RsaKeyPair;
  private userStore!: UserStore;

  constructor(cfg: BSBServiceConstructor<InstanceType<typeof Config>, typeof EventSchemas>) {
    super({ ...cfg, eventSchemas: EventSchemas });
  }

  protected definition(): BPServiceDefinition {
    return {
      manifest: {
        pluginId: "service.betterportal.auth.default",
        title: "BetterPortal Default Auth",
        description: "JWT-issuing auth service (RS256 + JWKS + bcrypt user store).",
        capabilities: ["auth"],
        configSchemas: DefaultAuthConfigSchemas
      },
      registry
    };
  }

  async init(obs: Observable): Promise<void> {
    const cfg = this.config;

    this.keyPair = loadOrGenerateKeyPair(resolve(cfg.keyStorePath));
    this.userStore = new UserStore(resolve(cfg.userStorePath));

    await super.init(obs);

    const jwk = publicKeyToJwk(this.keyPair.publicKeyPem, this.keyPair.kid);
    this.registerAsAuthProvider({
      issuer: cfg.issuer,
      audience: cfg.audience,
      jwksUri: `${cfg.issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
      jwks: { keys: [jwk as unknown as Record<string, unknown>] }
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
      userStore: this.userStore,
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
    if (await this.validateConfigScope(tenantId, appId)) return { allowed: true };
    return {
      allowed: false,
      reason: `Default auth service is not activated for tenant ${tenantId} app ${appId}.`
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
