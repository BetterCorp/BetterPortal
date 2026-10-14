import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_AGE_MS = 10 * 60_000;
const MAX_NEXT_LENGTH = 1024;
const MAX_STATE_LENGTH = 2048;
const CLAIM_CLEANUP_INTERVAL_MS = 60_000;
const MAX_PENDING_STATES = 10_000;
export const WORKOS_STATE_STORAGE_KEY = "bp:workos:oauth-state";
export const WORKOS_STATE_COOKIE = "__Host-bp_workos_oauth_state";

interface State {
  nonce: string;
  next: string;
  tenantId: string;
  appId: string;
  issuedAt: number;
}

/** Pending state files are consumed with one atomic unlink, including across replicas on shared storage. */
export class WorkOSStateClaims {
  private nextCleanup = 0;
  private pendingCount = -1;

  constructor(private readonly directory: string, private readonly maxPending = MAX_PENDING_STATES) {}

  private path(state: string): string {
    return join(this.directory, createHash("sha256").update(state).digest("hex"));
  }

  issue(state: string): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const now = Date.now();
    if (now >= this.nextCleanup || this.pendingCount < 0) {
      this.nextCleanup = now + CLAIM_CLEANUP_INTERVAL_MS;
      let pending = 0;
      for (const name of readdirSync(this.directory)) {
        if (!/^[0-9a-f]{64}$/.test(name)) continue;
        const path = join(this.directory, name);
        try {
          if (statSync(path).mtimeMs < now - MAX_AGE_MS - CLAIM_CLEANUP_INTERVAL_MS) unlinkSync(path);
          else pending++;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      this.pendingCount = pending;
    }
    if (this.pendingCount >= this.maxPending) throw new RangeError("Too many pending WorkOS sign-ins");
    writeFileSync(this.path(state), "", { flag: "wx", mode: 0o600 });
    this.pendingCount++;
  }

  claim(state: string): boolean {
    if (state.length > MAX_STATE_LENGTH) return false;
    try {
      unlinkSync(this.path(state));
      if (this.pendingCount > 0) this.pendingCount--;
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
}

export function createWorkOSState(next: string, scope: { tenantId: string; appId: string }): string {
  if (next.length > MAX_NEXT_LENGTH) throw new RangeError("WorkOS destination is too long.");
  const state: State = {
    nonce: randomBytes(32).toString("base64url"), next,
    tenantId: scope.tenantId, appId: scope.appId, issuedAt: Date.now()
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
  if (encoded.length > MAX_STATE_LENGTH) throw new RangeError("WorkOS state is too long.");
  return encoded;
}

export function workOSStateCookie(state: string): string {
  return `${WORKOS_STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure`;
}

export function clearWorkOSStateCookie(): string {
  return `${WORKOS_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

export function readWorkOSStateCookie(header: string | undefined): string | undefined {
  return header?.split(";").map(part => part.trim()).find(part => part.startsWith(`${WORKOS_STATE_COOKIE}=`))?.slice(WORKOS_STATE_COOKIE.length + 1);
}

export function verifyWorkOSState(
  encoded: string | undefined,
  proof: string | undefined,
  scope: { tenantId: string; appId: string }
): string | undefined {
  if (!encoded || !proof || encoded.length > MAX_STATE_LENGTH || proof.length > MAX_STATE_LENGTH) return undefined;
  const encodedBytes = Buffer.from(encoded);
  const proofBytes = Buffer.from(proof);
  if (encodedBytes.length !== proofBytes.length || !timingSafeEqual(encodedBytes, proofBytes)) return undefined;
  try {
    const state = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as State;
    if (!state || typeof state.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state.nonce)
      || typeof state.next !== "string" || state.next.length > MAX_NEXT_LENGTH
      || state.tenantId !== scope.tenantId || state.appId !== scope.appId
      || !Number.isSafeInteger(state.issuedAt) || state.issuedAt > Date.now()
      || Date.now() - state.issuedAt > MAX_AGE_MS) return undefined;
    return state.next;
  } catch { return undefined; }
}
