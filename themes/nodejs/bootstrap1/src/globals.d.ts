export {};

interface BootstrapComponentInstance {
  dispose(): void;
}

interface BootstrapModalInstance extends BootstrapComponentInstance {
  hide(): void;
}

interface BootstrapComponentStatic<T extends BootstrapComponentInstance = BootstrapComponentInstance> {
  getInstance(el: Element): T | null;
  new (el: Element): T;
}

declare global {
  interface Window {
    bootstrap?: {
      Tooltip: BootstrapComponentStatic;
      Popover: BootstrapComponentStatic;
      Modal: BootstrapComponentStatic<BootstrapModalInstance>;
    };
  }
}
