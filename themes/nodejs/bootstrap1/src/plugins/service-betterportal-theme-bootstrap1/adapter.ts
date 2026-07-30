export const Bootstrap1AdapterSource = `
(() => {
  const bootstrap = window.bootstrap;
  const teleported = new Set();
  const convertSidebars = (root) => {
    if (!root) return;
    root.querySelectorAll('[data-bp-sidebar]:not([data-bp-sidebar-ready])').forEach((element) => {
      const id = element.getAttribute('data-bp-sidebar') || ('bp-sidebar-' + Math.random().toString(36).slice(2));
      const title = element.getAttribute('data-bp-sidebar-title') || '';
      const position = element.getAttribute('data-bp-sidebar-position') || 'end';
      const width = element.getAttribute('data-bp-sidebar-width');
      const content = element.innerHTML;
      element.id = id;
      element.setAttribute('data-bp-sidebar-ready', '');
      element.className = ('offcanvas offcanvas-' + position + ' ' + element.className).trim();
      element.setAttribute('tabindex', '-1');
      if (width) element.style.width = width;
      element.innerHTML = '<div class="offcanvas-header">' + (title ? '<h5 class="offcanvas-title">' + title + '</h5>' : '<span></span>') + '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button></div><div class="offcanvas-body">' + content + '</div>';
    });
    root.querySelectorAll('[data-bp-sidebar-open]:not([data-bp-trigger-ready])').forEach((button) => {
      button.setAttribute('data-bp-trigger-ready', '');
      button.setAttribute('data-bs-toggle', 'offcanvas');
      button.setAttribute('data-bs-target', '#' + button.getAttribute('data-bp-sidebar-open'));
    });
  };  const initComponents = (root) => {
    if (!root || !bootstrap) return;
    convertSidebars(root);
    root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
    });
    root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
      if (!bootstrap.Popover.getInstance(el)) new bootstrap.Popover(el);
    });
  };
  window.BetterPortalThemeAdapter = {
    initComponents,
    disposeComponents(root) {
      if (!root || !bootstrap) return;
      root.querySelectorAll('[data-bs-toggle="tooltip"],[data-bs-toggle="popover"]').forEach((el) => {
        bootstrap.Tooltip.getInstance(el)?.dispose();
        bootstrap.Popover.getInstance(el)?.dispose();
      });
    },
    prepareContent(root) {
      if (!root) return;
      root.querySelectorAll(".modal,.offcanvas").forEach((element) => {
        element.setAttribute("data-bp-content-owned", "true");
        const serviceId = root.closest("[data-bp-service]")?.getAttribute("data-bp-service")
          || document.querySelector("#bp-main")?.getAttribute("data-bp-service");
        if (serviceId && !element.hasAttribute("data-bp-service")) element.setAttribute("data-bp-service", serviceId);
        document.body.appendChild(element);
        teleported.add(element);
      });
    },
    cleanupTransientUi() {
      teleported.forEach((element) => {
        try {
          bootstrap?.Modal.getInstance(element)?.dispose();
          bootstrap?.Offcanvas.getInstance(element)?.dispose();
        } catch {}
        element.remove();
      });
      teleported.clear();
      document.querySelectorAll(".modal-backdrop,.offcanvas-backdrop").forEach((element) => element.remove());
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    },
    closeContainingOverlay(source) {
      const panel = source?.closest?.(".offcanvas.show,.offcanvas.showing,.offcanvas.hiding");
      if (!panel || !bootstrap) return;
      (bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel)).hide();
    },
    syncOverlays() {
      if (document.querySelector(".modal.show,.modal.showing,.offcanvas.show,.offcanvas.showing")) return;
      document.querySelectorAll(".modal-backdrop,.offcanvas-backdrop").forEach((element) => element.remove());
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    },
    scrollToTop() {
      document.querySelectorAll(".bp-admin__workspace,.bp-admin__content-frame,.bp-shell__main").forEach((element) => {
        element.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    setLoading(loading) {
      document.querySelector(".bp-admin__content-frame")?.classList.toggle("is-loading", loading);
      document.querySelector("#bp-topbar-progress")?.classList.toggle("is-active", loading);
    },
    showRequestError(status, content) {
      if (!bootstrap) {
        window.alert("Request failed (" + status + ")");
        return;
      }
      let modal = document.querySelector("#bp-request-error-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "bp-request-error-modal";
        modal.className = "modal fade";
        modal.tabIndex = -1;
        modal.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Request failed</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body" data-bp-request-error-body></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Dismiss</button></div></div></div>';
        document.body.appendChild(modal);
      }
      const body = modal.querySelector("[data-bp-request-error-body]");
      if (body) {
        body.innerHTML = content || '<div class="alert alert-danger mb-0">Request failed. Try again.</div>';
        window.htmx.process(body);
      }
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  };
})();`;
