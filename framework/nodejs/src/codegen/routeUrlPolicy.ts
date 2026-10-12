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
  const rendererFunctions = new Set<ts.Node>();
  const initializers = new Map<ts.Node, Map<string, ts.Expression>>();
  const collect = (node: ts.Node): void => {
    if (file.includes("_renderer.") && ts.isFunctionLike(node)) {
      const declaration = ts.isVariableDeclaration(node.parent) ? node.parent : undefined;
      const name = ts.isFunctionDeclaration(node) ? node.name?.text : declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
      const owner = declaration?.parent.parent;
      const exported = ts.isFunctionDeclaration(node) ? ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
        : owner && ts.isVariableStatement(owner) && ts.getModifiers(owner)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (name?.startsWith("render") && exported) rendererFunctions.add(node);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = initializers.get(scope) ?? new Map<string, ts.Expression>();
      bindings.set(node.name.text, node.initializer); initializers.set(scope, bindings);
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const rendererPayload = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) return rendererPayload(expression.expression, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return rendererPayload(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope) && scope.parameters.some(param => ts.isIdentifier(param.name) && param.name.text === expression.text)) {
        const input = scope.parameters[0]?.name;
        return rendererFunctions.has(scope) && input !== undefined && ts.isIdentifier(input) && input.text === expression.text;
      }
      scope = scope.parent;
    }
    return false;
  };
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
  const defaultExports = new Set(tree.statements.flatMap(statement => ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression) ? [statement.expression.text] : []));
  const handlerFactories = new Set(["createHandler", "createRawHandler", "createStreamHandler", "createSse"]);
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (handlerFactories.has(binding.propertyName?.text ?? binding.name.text)) handlerFactories.add(binding.name.text);
    }
  }
  const routeHandlerFile = /(?:^|[/])bp-routes[/](?:.*[/])?(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|SSE|STREAM)\.tsx?$/.test(file.replace(/\\/g, "/"));
  const belongsToHandler = (node: ts.Node | undefined): boolean => {
    if (file.includes("_renderer.")) return false;
    while (node && !ts.isSourceFile(node)) {
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
        if (routeHandlerFile && node.name && (["handler", "handle"].includes(node.name.text) || defaultExports.has(node.name.text))) return true;
        if (routeHandlerFile && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return true;
      }
      if (routeHandlerFile && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && (["handler", "handle"].includes(node.name.text) || defaultExports.has(node.name.text))) return true;
      if (routeHandlerFile && ts.isExportAssignment(node)) return true;
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee) && handlerFactories.has(callee.text)
          || ts.isPropertyAccessExpression(callee) && handlerFactories.has(callee.name.text)) return true;
      }
      node = node.parent;
    }
    return false;
  };
  const inReturnedObject = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if (ts.isCallExpression(current) || ts.isNewExpression(current) || ts.isJsxAttribute(current) || ts.isJsxSpreadAttribute(current)) return false;
      if (ts.isReturnStatement(current)) return belongsToHandler(current.parent);
      current = current.parent;
    }
    return Boolean(current && ts.isArrowFunction(current) && !ts.isBlock(current.body) && belongsToHandler(current));
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
    if (ts.isBindingElement(node) && node.propertyName && (ts.isIdentifier(node.propertyName) || ts.isStringLiteralLike(node.propertyName))) field = node.propertyName.text;
    if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) field = node.argumentExpression.text;
    const payloadAccess = (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && rendererPayload(node.expression);
    const payloadBinding = ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)
      && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.initializer
      && rendererPayload(node.parent.parent.initializer);
    const payloadParameter = ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)
      && ts.isParameter(node.parent.parent) && rendererFunctions.has(node.parent.parent.parent)
      && ts.isFunctionLike(node.parent.parent.parent) && node.parent.parent.parent.parameters[0] === node.parent.parent;
    if (field && legacyFields.has(field) && (payloadAccess || payloadBinding || payloadParameter)) report(node, `Legacy internal URL field '${field}' was removed. Return domain data/cursors and resolve destinations in the renderer.`);
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
