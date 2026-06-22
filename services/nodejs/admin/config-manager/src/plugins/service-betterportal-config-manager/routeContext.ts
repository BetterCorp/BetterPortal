import type { PlatformConfigStore } from "@betterportal/framework";
import type { CpBootstrapState } from "./cpBootstrap.js";

export interface ConfigManagerRouteContext {
  storage: PlatformConfigStore;
  cpState: CpBootstrapState;
  serviceBaseUrl: string;
}

let routeContext: ConfigManagerRouteContext | undefined;

export function setConfigManagerRouteContext(context: ConfigManagerRouteContext): void {
  routeContext = context;
}

export function getConfigManagerRouteContext(): ConfigManagerRouteContext {
  if (!routeContext) {
    throw new Error("Config manager route context is not initialized");
  }
  return routeContext;
}
