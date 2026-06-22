export { };

interface BootstrapComponentInstance {
  dispose(): void;
}

interface BootstrapModalInstance extends BootstrapComponentInstance {
  hide(): void;
}

interface BootstrapComponentStatic<T extends BootstrapComponentInstance = BootstrapComponentInstance> {
  getInstance(el: Element): T | null;
  new(el: Element): T;
}

interface HtmxSseConfig {
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectMaxDelay?: number;
  reconnectMaxAttempts?: number;
  reconnectJitter?: number;
  pauseOnBackground?: boolean;
}

interface Htmx {
  config: {
    sse?: HtmxSseConfig;
  };
  process(elt: Element): void;
  registerExtension(name: string, extension: Record<string, unknown>): void;
}

type Bootstrap = {
  Tooltip: BootstrapComponentStatic;
  Popover: BootstrapComponentStatic;
  Modal: BootstrapComponentStatic<BootstrapModalInstance>;
}

declare global {
  const htmx: Htmx;
  //const bootstrap: Bootstrap;

  interface Window {
    bootstrap?: Bootstrap;
    htmx: Htmx;
  }
}
