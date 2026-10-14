import { randomBytes, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 10 * 60_000;
export const WORKOS_STATE_STORAGE_KEY = "bp:workos:oauth-state";
export const WORKOS_STATE_COOKIE = "bp_workos_oauth_state";

interface State {
  nonce: string;
  next: string;
  tenantId: string;
  appId: string;
  issuedAt: number;
}

export function createWorkOSState(next: string, scope: { tenantId: string; appId: string }): string {
  const state: State = {
    nonce: randomBytes(32).toString("base64url"), next,
    tenantId: scope.tenantId, appId: scope.appId, issuedAt: Date.now()
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function workOSStateCookie(state: string, secure: boolean): string {
  return `${WORKOS_STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearWorkOSStateCookie(secure: boolean): string {
  return `${WORKOS_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function readWorkOSStateCookie(header: string | undefined): string | undefined {
  return header?.split(";").map(part => part.trim()).find(part => part.startsWith(`${WORKOS_STATE_COOKIE}=`))?.slice(WORKOS_STATE_COOKIE.length + 1);
}

export function verifyWorkOSState(
  encoded: string | undefined,
  proof: string | undefined,
  scope: { tenantId: string; appId: string }
): string | undefined {
  if (!encoded || !proof || encoded.length > 2048 || proof.length !== encoded.length) return undefined;
  if (!timingSafeEqual(Buffer.from(encoded), Buffer.from(proof))) return undefined;
  try {
    const state = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as State;
    if (!state || typeof state.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state.nonce)
      || typeof state.next !== "string" || state.next.length > 1024
      || state.tenantId !== scope.tenantId || state.appId !== scope.appId
      || !Number.isSafeInteger(state.issuedAt) || state.issuedAt > Date.now()
      || Date.now() - state.issuedAt > MAX_AGE_MS) return undefined;
    return state.next;
  } catch { return undefined; }
}
