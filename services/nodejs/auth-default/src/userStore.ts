import bcrypt from "bcrypt";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { uuidv7 } from "@betterportal/framework";

const BCRYPT_ROUNDS = 12;

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  name?: string;
  picture?: string;
  tenantId: string;
  appRoles: Record<string, string[]>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  refreshVersion?: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email?: string;
  name?: string;
  picture?: string;
  tenantId: string;
  roles: string[];
}

interface UserStoreFile {
  version: 1;
  users: StoredUser[];
  revokedRefreshTokens?: Record<string, number>;
}

export interface CreateUserInput {
  username: string;
  password: string;
  tenantId: string;
  email?: string;
  name?: string;
  picture?: string;
  appRoles?: Record<string, string[]>;
}

export class UserStore {
  private readonly filePath: string;
  private cache: UserStoreFile | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async createUser(input: CreateUserInput, firstAdminOnly = false): Promise<StoredUser> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    // File auth is single-process: no await between the uniqueness check and commit.
    const file = this.load();
    if (firstAdminOnly && file.users.length > 0) throw new Error("First admin has already been created");
    if (file.users.some((user) => user.username === input.username && user.tenantId === input.tenantId)) {
      throw new Error(`User ${input.username} already exists for tenant ${input.tenantId}`);
    }

    const now = Date.now();
    const user: StoredUser = {
      id: generateUserId(),
      username: input.username,
      passwordHash,
      email: input.email,
      name: input.name,
      picture: input.picture,
      tenantId: input.tenantId,
      appRoles: input.appRoles ?? {},
      enabled: true,
      createdAt: now,
      updatedAt: now
    };

    file.users.push(user);
    this.save(file);
    return user;
  }

  /**
   * True when no users exist. Bootstrap flows use this to allow open registration
   * for the first admin user only. Once any user exists, registration is closed.
   */
  hasNoUsers(): boolean {
    return this.load().users.length === 0;
  }

  userCount(): number {
    return this.load().users.length;
  }

  async authenticate(tenantId: string, appId: string, username: string, password: string): Promise<AuthenticatedUser | null> {
    const file = this.load();
    const user = file.users.find((entry) => entry.username === username && entry.tenantId === tenantId);

    if (!user) {
      await bcrypt.compare(password, "$2b$12$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvalidsa");
      return null;
    }
    if (!user.enabled) {
      return null;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return null;
    }

    const roles = user.appRoles[appId] ?? [];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      picture: user.picture,
      tenantId: user.tenantId,
      roles
    };
  }

  findById(id: string): StoredUser | null {
    const file = this.load();
    return file.users.find((user) => user.id === id) ?? null;
  }

  resolveRolesForApp(userId: string, appId: string): string[] {
    const user = this.findById(userId);
    if (!user || !user.enabled) return [];
    return user.appRoles[appId] ?? [];
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const file = this.load();
    const user = file.users.find((entry) => entry.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.refreshVersion = (user.refreshVersion ?? 0) + 1;
    user.updatedAt = Date.now();
    this.save(file);
  }

  setEnabled(userId: string, enabled: boolean): void {
    const file = this.load();
    const user = file.users.find((entry) => entry.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    user.enabled = enabled;
    if (!enabled) user.refreshVersion = (user.refreshVersion ?? 0) + 1;
    user.updatedAt = Date.now();
    this.save(file);
  }

  setAppRoles(userId: string, appId: string, roles: string[]): void {
    const file = this.load();
    const user = file.users.find((entry) => entry.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    user.appRoles[appId] = roles;
    user.updatedAt = Date.now();
    this.save(file);
  }

  revokeRefreshToken(jti: string, expiresAt: number): void {
    const file = this.load();
    const now = Math.floor(Date.now() / 1000);
    file.revokedRefreshTokens = Object.fromEntries(Object.entries(file.revokedRefreshTokens ?? {}).filter(([, exp]) => exp > now));
    if (expiresAt > now) file.revokedRefreshTokens[jti] = expiresAt;
    this.save(file);
  }

  isRefreshTokenRevoked(jti: string): boolean {
    return (this.load().revokedRefreshTokens?.[jti] ?? 0) > Math.floor(Date.now() / 1000);
  }

  private load(): UserStoreFile {
    if (this.cache) return this.cache;
    if (!existsSync(this.filePath)) {
      this.cache = { version: 1, users: [] };
      return this.cache;
    }
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as UserStoreFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.users)) {
      throw new Error(`User store ${this.filePath} is malformed`);
    }
    this.cache = parsed;
    return this.cache;
  }

  private save(file: UserStoreFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${uuidv7()}.tmp`;
    writeFileSync(temp, JSON.stringify(file, null, 2), { mode: 0o600 });
    renameSync(temp, this.filePath);
    this.cache = file;
  }
}

function generateUserId(): string {
  return uuidv7();
}
