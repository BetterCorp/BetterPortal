import ts from "typescript";

export interface RoutingDiagnostic { message: string; start: number; length: number }
/** Shared ESLint/build diagnostics. Service renderers use service destinations; shell history may use UI fields. */
export function routingDiagnostics(file: string, source: string): RoutingDiagnostic[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors: RoutingDiagnostic[] = [];
  const report = (node: ts.Node, message: string) => errors.push({ message, start: node.getStart(tree), length: node.getWidth(tree) });
  const routeComponents = new Set(["BPRoute"]);
  const legacyComponents = new Set(["BPElement"]);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text === "@betterportal/framework") {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        const name = item.propertyName?.text ?? item.name.text;
        if (name === "BPRoute") routeComponents.add(item.name.text);
        if (name === "BPElement") { legacyComponents.add(item.name.text); report(item, "BPElement was removed. Use BPRoute with component/fragment embedding and bp-error states."); }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(tree);
      if (legacyComponents.has(tag)) report(node, "BPElement was removed. Use BPRoute.");
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      if ((routeComponents.has(tag) || tag === "bp-ok") && attrs.some(attr => attr.name.getText(tree) === "method" && attr.initializer?.getText(tree).replace(/[{}"']/g, "").toUpperCase() === "OPTIONS")) report(node, "BPRoute actions do not support OPTIONS. Use ctx.route for protocol requests.");
      if ((tag.startsWith("bp-") || routeComponents.has(tag)) && attrs.filter(attr => /^hx-(get|post|put|patch|delete)$/.test(attr.name.getText(tree))).length > 1) {
        report(node, "A BPRoute state accepts only one HTMX request method.");
      }
      if (routeComponents.has(tag) && attrs.some(attr => attr.name.getText(tree) === "path") && attrs.some(attr => attr.name.getText(tree) === "viewId")) report(node, "Select a service path or a viewId, never both.");
      if (routeComponents.has(tag) && attrs.some(attr => attr.name.getText(tree) === "component") && attrs.some(attr => attr.name.getText(tree) === "fragment")) report(node, "Select component or fragment, never both. Each selects embedding rather than a link.");
      if (file.includes("_renderer.") && ["a", "button", "form"].includes(tag)) {
        for (const attr of attrs.filter(attr => ["href", "action", "hx-get", "hx-post", "hx-put", "hx-patch", "hx-delete"].includes(attr.name.getText(tree)))) {
          const check = (value: ts.Node): void => {
            if (ts.isPropertyAccessExpression(value) && value.name.text === "uiPath") report(value, "Service-renderer controls must not prefer uiPath. Use BPRoute, or an explicit service view destination. UI fields belong to shell navigation/history or public links.");
            ts.forEachChild(value, check);
          };
          if (attr.initializer) check(attr.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return errors;
}
