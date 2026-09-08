export function urlCalls(context, calls) {
  return calls.map(call => {
    try {
      const options = call.options ?? {};
      switch (call.kind) {
        case "route": return (context.url?.route ?? context.routeUrl)(call.viewId, options);
        case "uiRoute": return (context.url?.uiRoute ?? context.uiRouteUrl)(call.viewId, options);
        case "current": return context.url.current(options);
        case "path": return context.url.path(call.path, options);
        case "link": return context.routeUi.link(call.url, options);
        case "form": return context.routeUi.form(call.url, options);
        case "currentUi": return context.routeUi.current(options);
        case "element": return context.element(call.reference);
        default: throw new Error("Unknown URL fixture call");
      }
    } catch { return { invalid: true }; }
  });
}
