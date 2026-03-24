import { App } from "../contracts/binding";
import { type HeaderMap, resolveEmbeddedHostname, resolveThemeHostname } from "./http";

export function resolveAppFromHeaders(headers: HeaderMap, apps: readonly App[]): App | null {
  const refererHostname = resolveEmbeddedHostname(headers);
  const originHostname = resolveThemeHostname(headers);

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
