import { App } from "../contracts/binding";

export interface HeaderMap {
  origin?: string;
  referer?: string;
}

function hostnameFromHeaderValue(value?: string): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    try {
      return new URL(`https://${value}`).hostname;
    } catch {
      return null;
    }
  }
}

export function resolveAppFromHeaders(headers: HeaderMap, apps: readonly App[]): App | null {
  const refererHostname = hostnameFromHeaderValue(headers.referer);
  const originHostname = hostnameFromHeaderValue(headers.origin);

  if (refererHostname) {
    const refererMatch = apps.find((app) => app.hostname === refererHostname);
    if (refererMatch) {
      return refererMatch;
    }
  }

  if (originHostname) {
    const originMatch = apps.find((app) => app.hostname === originHostname);
    if (originMatch) {
      return originMatch;
    }
  }

  return null;
}
