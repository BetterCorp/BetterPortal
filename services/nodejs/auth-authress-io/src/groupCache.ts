import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const AUTHRESS_GROUP_CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = {
  refreshedAt: number;
  rolesByUser: Record<string, string[]>;
};

type CacheFile = {
  version: 1;
  scopes: Record<string, CacheEntry>;
};

export class AuthressGroupCache {
  private state: CacheFile | undefined;

  constructor(private readonly filePath: string) {}

  read(tenantId: string, appId: string, userId: string, now = Date.now()): { roles: string[]; fresh: boolean } {
    const entry = this.load().scopes[`${tenantId}/${appId}`];
    return {
      roles: entry?.rolesByUser[userId] ?? [],
      fresh: !!entry && now - entry.refreshedAt < AUTHRESS_GROUP_CACHE_TTL_MS
    };
  }

  write(tenantId: string, appId: string, rolesByUser: Record<string, string[]>, refreshedAt = Date.now()): void {
    const state = this.load();
    state.scopes[`${tenantId}/${appId}`] = { refreshedAt, rolesByUser };
    const path = resolve(this.filePath);
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, path);
  }

  private load(): CacheFile {
    if (this.state) return this.state;
    try {
      const parsed = existsSync(this.filePath)
        ? JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<CacheFile>
        : {};
      this.state = { version: 1, scopes: parsed.version === 1 ? parsed.scopes ?? {} : {} };
    } catch {
      this.state = { version: 1, scopes: {} };
    }
    return this.state;
  }
}
