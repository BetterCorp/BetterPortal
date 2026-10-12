import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

export interface RouteUrlPolicyError { file: string; message: string; severity: "error" }

const legacyFields = new Set(["accountUrl", "loginUrl", "logoutUrl", "socialUrl", "firstAdminUrl", "nextUrl", "mailNextUrl", "sessionNextUrl"]);
const internalPaths = new Set(["apiPath", "viewPath", "uiPath", "absoluteApiPath", "absoluteViewPath"]);

/** Reject the old routing API and renderer-only URL payloads even in loosely typed source. */
export function inspectRouteUrlSource(file: string, source: string): RouteUrlPolicyError[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors: RouteUrlPolicyError[] = [];
  const initializers = new Map<string, ts.Expression>();
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) initializers.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const report = (node: ts.Node, message: string) => {
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    errors.push({ file: `${file}:${position.line + 1}:${position.character + 1}`, message, severity: "error" });
  };
  const internalValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
      const initializer = initializers.get(expression.text);
      if (initializer) return internalValue(initializer, new Set([...seen, expression.text]));
    }
    if (ts.isPropertyAccessExpression(expression) && internalPaths.has(expression.name.text)) return true;
    return expression.getChildren(tree).some(child => internalValue(child, seen));
  };
  const inReturnedObject = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if (ts.isReturnStatement(current)) return true;
      current = current.parent;
    }
    return Boolean(current && ts.isArrowFunction(current) && !ts.isBlock(current.body));
  };
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "uiRouteUrl") {
      report(node, "uiRouteUrl was removed. Use ctx.routeUrl({ ... }) and select uiPath or absoluteUiPath.");
    }
    if (ts.isPropertyAccessExpression(node) && ["route", "uiRoute", "current", "path"].includes(node.name.text)
      && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "url") {
      report(node, "ctx.url helpers were removed. Use ctx.routeUrl({ ... }); omit the target for self.");
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const property = node.expression;
      if (property.name.text === "routeUrl" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])
        && node.arguments[0].properties.some(item => item.name && ["absolute", "origin"].includes(item.name.getText(tree)))) {
        report(node, "absolute/origin options were removed. Select the corresponding absolute destination field.");
      }
      if (property.name.text === "routeUrl" && (node.arguments.length > 1 || node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))) {
        report(node, "routeUrl no longer accepts a positional view id or returns a string. Pass one options object and select a destination field.");
      }
    }
    let field: string | undefined;
    if (ts.isPropertyAccessExpression(node)) field = node.name.text;
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isBindingElement(node)) && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))) field = node.name.text;
    if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) field = node.argumentExpression.text;
    if (field && legacyFields.has(field)) report(node, `Legacy internal URL field '${field}' was removed. Return domain data/cursors and resolve destinations in the renderer.`);
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && inReturnedObject(node) && internalValue(ts.isPropertyAssignment(node) ? node.initializer : node.name)) {
      report(node, "Do not return internal route paths as API response fields. Resolve them at the point of use; only public absoluteUiPath links belong in domain responses.");
    }
    if ((ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /(?:href|action|hx-(?:get|post|put|patch|delete|download))=["']\{[A-Za-z0-9_$.-]+\}["']/.test(node.text)) {
      report(node, "Legacy route tokens were removed. Resolve the destination with ctx.routeUrl in the renderer.");
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteralLike(node.initializer)
      && ["href", "action", "hx-get", "hx-post", "hx-put", "hx-patch", "hx-delete", "hx-download", "sse-connect"].includes(node.name.getText(tree))
      && /^\{[A-Za-z0-9_$.-]+\}$/.test(node.initializer.text)) {
      report(node, "Legacy route tokens were removed. Resolve the destination with ctx.routeUrl in the renderer.");
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return errors;
}

/** Inspect project source, including domain helpers outside bp-routes, before generation/build. */
export function checkProjectRouteUrls(directory: string): RouteUrlPolicyError[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if ((entry.name.startsWith(".") && entry.name !== ".well-known") || ["node_modules", "lib", "dist"].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? checkProjectRouteUrls(file) : /\.tsx?$/.test(file) ? inspectRouteUrlSource(file, fs.readFileSync(file, "utf8")) : [];
  });
}
