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
  const payloads = new Set(["data", "result", "response"]);
  const initializers = new Map<ts.Node, Map<string, ts.Expression>>();
  const collect = (node: ts.Node): void => {
    if (file.includes("_renderer.") && ts.isFunctionDeclaration(node) && node.name?.text === "render" && node.parameters[0] && ts.isIdentifier(node.parameters[0].name)) payloads.add(node.parameters[0].name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = initializers.get(scope) ?? new Map<string, ts.Expression>();
      bindings.set(node.name.text, node.initializer); initializers.set(scope, bindings);
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const report = (node: ts.Node, message: string) => {
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    errors.push({ file: `${file}:${position.line + 1}:${position.character + 1}`, message, severity: "error" });
  };
  const internalValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isPrefixUnaryExpression(expression) || ts.isPostfixUnaryExpression(expression)
      || ts.isTypeOfExpression(expression) || ts.isVoidExpression(expression) || ts.isDeleteExpression(expression)) return false;
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
      ts.SyntaxKind.InKeyword, ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken,
      ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken, ts.SyntaxKind.AsteriskAsteriskToken, ts.SyntaxKind.AmpersandToken,
      ts.SyntaxKind.BarToken, ts.SyntaxKind.CaretToken, ts.SyntaxKind.LessThanLessThanToken,
      ts.SyntaxKind.GreaterThanGreaterThanToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken].includes(expression.operatorToken.kind)) return false;
    if (ts.isConditionalExpression(expression)) return internalValue(expression.whenTrue, seen) || internalValue(expression.whenFalse, seen);
    if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return internalValue(initializer, new Set([...seen, expression.text]));
        if (ts.isFunctionLike(scope) && scope.parameters.some(param => ts.isIdentifier(param.name) && param.name.text === expression.text)) break;
        scope = scope.parent;
      }
    }
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === "absoluteUiPath") return false;
    if (ts.isPropertyAccessExpression(expression) && internalPaths.has(expression.name.text)) return true;
    if (ts.isCallExpression(expression) && (ts.isIdentifier(expression.expression) && expression.expression.text === "resolveAppAuthRedirect"
      || ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "routeUrl")) return true;
    if (ts.isPropertyAccessExpression(expression)) return internalValue(expression.expression, seen);
    if (ts.isPropertyAssignment(expression)) return internalValue(expression.initializer, seen);
    // An arbitrary function may consume a URL while returning unrelated domain data.
    if (ts.isCallExpression(expression)) return false;
    return expression.getChildren(tree).some(child => internalValue(child, seen));
  };
  const inReturnedObject = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if (ts.isCallExpression(current) || ts.isNewExpression(current) || ts.isJsxAttribute(current) || ts.isJsxSpreadAttribute(current)) return false;
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
    const payloadAccess = (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && ts.isIdentifier(node.expression) && payloads.has(node.expression.text);
    const payloadBinding = ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)
      && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.initializer
      && ts.isIdentifier(node.parent.parent.initializer) && payloads.has(node.parent.parent.initializer.text);
    if (field && legacyFields.has(field) && (payloadAccess || payloadBinding)) report(node, `Legacy internal URL field '${field}' was removed. Return domain data/cursors and resolve destinations in the renderer.`);
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
