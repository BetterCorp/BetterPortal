export function urlCalls(context, calls) {
  return calls.map(call => {
    try {
      if (call.kind === "routeUrl") return context.routeUrl(call.input);
      if (call.kind === "element") return context.element(call.reference);
      throw new Error("Unknown URL fixture call");
    } catch { return { invalid: true }; }
  });
}
