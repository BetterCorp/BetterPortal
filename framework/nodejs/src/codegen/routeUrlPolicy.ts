import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

export interface RouteUrlPolicyError { file: string; message: string; severity: "error" }

const legacyFields = new Set(["accountUrl", "loginUrl", "logoutUrl", "socialUrl", "firstAdminUrl", "nextUrl", "mailNextUrl", "sessionNextUrl", "previewPath", "tenantsPath"]);
const internalPaths = new Set(["apiPath", "viewPath", "uiPath", "absoluteApiPath", "absoluteViewPath"]);

/** Reject the old routing API and renderer-only URL payloads even in loosely typed source. */
export function inspectRouteUrlSource(file: string, source: string): RouteUrlPolicyError[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors: RouteUrlPolicyError[] = [];
  const rendererFunctions = new Set<ts.Node>();
  const declarations = new Map<ts.Node, Set<string>>();
  const selections = new Map<ts.Node, Map<string, { expression: ts.Expression; field: string; rest: boolean }>>();
  const initializers = new Map<ts.Node, Map<string, ts.Expression>>();
  type Mutation = { target: ts.Expression; values: readonly ts.Expression[]; global?: ts.Expression };
  const pendingMutations: Mutation[] = [];
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
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = selections.get(scope) ?? new Map<string, { expression: ts.Expression; field: string; rest: boolean }>();
      for (const item of node.name.elements) {
        if (!ts.isIdentifier(item.name)) continue;
        const key = item.propertyName ?? item.name;
        if (!ts.isIdentifier(key) && !ts.isStringLiteralLike(key)) continue;
        bindings.set(item.name.text, { expression: node.initializer, field: key.text, rest: !!item.dotDotDotToken });
      }
      selections.set(scope, bindings);
    }
    const declare = (name: string): void => {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const names = declarations.get(scope) ?? new Set<string>(); names.add(name); declarations.set(scope, names);
    };
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) declare(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declare(node.name.text);
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      if (node.importClause?.name) declare(node.importClause.name.text);
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) declare(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) if (!binding.isTypeOnly) declare(binding.name.text);
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.QuestionQuestionEqualsToken].includes(node.operatorToken.kind)) {
      pendingMutations.push({ target: node.left, values: [node.right] });
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (["push", "unshift", "splice", "fill"].includes(method)) pendingMutations.push({
        target: node.expression.expression,
        values: method === "splice" ? node.arguments.slice(2) : method === "fill" ? node.arguments.slice(0, 1) : node.arguments
      });
      if (method === "assign" && node.arguments[0]) pendingMutations.push({
        target: node.arguments[0], values: node.arguments.slice(1), global: node.expression.expression
      });
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const references = new Map<ts.Node, { scope: ts.Node; name: string } | undefined>();
  const reference = (expression: ts.Node, seen = new Set<ts.Node>()): { scope: ts.Node; name: string } | undefined => {
    if (seen.has(expression)) return undefined;
    if (references.has(expression)) return references.get(expression);
    const next = new Set([...seen, expression]);
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)
      || ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) return reference(expression.expression, next);
    if (!ts.isIdentifier(expression)) return undefined;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) {
        const initializer = initializers.get(scope)?.get(expression.text);
        const selected = selections.get(scope)?.get(expression.text);
        const alias = initializer ? reference(initializer, next) : selected ? reference(selected.expression, next) : undefined;
        const binding = alias ?? { scope, name: expression.text };
        references.set(expression, binding); return binding;
      }
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return undefined;
      scope = scope.parent;
    }
    return undefined;
  };
  const mutations = new Map<ts.Node, Map<string, Mutation[]>>();
  for (const mutation of pendingMutations) {
    const binding = reference(mutation.target);
    if (!binding) continue;
    const bindings = mutations.get(binding.scope) ?? new Map<string, Mutation[]>();
    bindings.set(binding.name, [...bindings.get(binding.name) ?? [], mutation]); mutations.set(binding.scope, bindings);
  }
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
      const binding = reference(expression);
      if (binding && mutations.get(binding.scope)?.get(binding.name)?.some(mutation =>
        (!mutation.global || isGlobal(mutation.global, "Object"))
        && mutation.values.some(value => internalValue(value, new Set([...seen, expression.text]))))) return true;
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const selected = selections.get(scope)?.get(expression.text);
        if (selected) return (selected.rest || internalPaths.has(selected.field)) && internalValue(selected.expression, new Set([...seen, expression.text]));
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return internalValue(initializer, new Set([...seen, expression.text]));
        if (ts.isFunctionLike(scope) && scope.parameters.some(param => ts.isIdentifier(param.name) && param.name.text === expression.text)) {
          const call = scope.parent;
          const first = scope.parameters[0]?.name;
          if (first && ts.isIdentifier(first) && first.text === expression.text && ts.isCallExpression(call)
            && call.arguments[1] === scope && ts.isPropertyAccessExpression(call.expression)
            && isGlobal(call.expression.expression, "Array") && call.expression.name.text === "from") {
            return !!call.arguments[0] && internalValue(call.arguments[0], new Set([...seen, expression.text]));
          }
          break;
        }
        scope = scope.parent;
      }
    }
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === "absoluteUiPath"
      || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression) && expression.argumentExpression.text === "absoluteUiPath") return false;
    if (ts.isPropertyAccessExpression(expression) && internalPaths.has(expression.name.text)) return internalValue(expression.expression, seen);
    if (ts.isCallExpression(expression) && (ts.isIdentifier(expression.expression) && expression.expression.text === "resolveAppAuthRedirect"
      || isResolverFunction(expression.expression))) return true;
    if (ts.isPropertyAccessExpression(expression)) return internalValue(expression.expression, seen);
    if (ts.isPropertyAssignment(expression)) return internalValue(expression.initializer, seen);
    // An arbitrary function may consume a URL while returning unrelated domain data.
    if (ts.isCallExpression(expression)) {
      if (isGlobal(expression.expression, "structuredClone")) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Array")) {
        if (expression.expression.name.text === "of") return expression.arguments.some(argument => internalValue(argument, seen));
        if (expression.expression.name.text === "from") {
          const callback = expression.arguments[1];
          if (!callback) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
          if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
            if (!ts.isBlock(callback.body)) return internalValue(callback.body, seen);
            let internal = false;
            const returned = (node: ts.Node): void => {
              if (node !== callback.body && ts.isFunctionLike(node)) return;
              if (ts.isReturnStatement(node) && node.expression && internalValue(node.expression, seen)) internal = true;
              ts.forEachChild(node, returned);
            };
            returned(callback.body); return internal;
          }
          return false;
        }
      }
      if (ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Object")) {
        if (expression.expression.name.text === "assign") return expression.arguments.some(argument => internalValue(argument, seen));
        if (expression.expression.name.text === "fromEntries") return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      }
      if (ts.isPropertyAccessExpression(expression.expression)) {
        const operation = expression.expression.name.text;
        if (["filter", "slice", "sort", "reverse", "toSorted", "toReversed", "flat"].includes(operation)) return internalValue(expression.expression.expression, seen);
        if (operation === "concat") return internalValue(expression.expression.expression, seen) || expression.arguments.some(argument => internalValue(argument, seen));
        if (["with", "toSpliced"].includes(operation)) return internalValue(expression.expression.expression, seen)
          || expression.arguments.slice(operation === "with" ? 1 : 2).some(argument => internalValue(argument, seen));
      }
      if (isResponseConstructor(expression.expression)) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (ts.isPropertyAccessExpression(expression.expression) && ["map", "flatMap"].includes(expression.expression.name.text)) {
        const callback = expression.arguments[0];
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          if (!ts.isBlock(callback.body)) return internalValue(callback.body, seen);
          let internal = false;
          const returned = (node: ts.Node): void => {
            if (node !== callback.body && ts.isFunctionLike(node)) return;
            if (ts.isReturnStatement(node) && node.expression && internalValue(node.expression, seen)) internal = true;
            ts.forEachChild(node, returned);
          };
          returned(callback.body); return internal;
        }
      }
      return false;
    }
    if (ts.isNewExpression(expression) && isGlobal(expression.expression, "Array")) return !!expression.arguments?.some(argument => internalValue(argument, seen));
    if (ts.isNewExpression(expression) && isGlobal(expression.expression, "Response")) return !!expression.arguments?.[0] && internalValue(expression.arguments[0], seen);
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
  const isReturnedValue = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if (ts.isReturnStatement(current)) return true;
      if (ts.isCallExpression(current) || ts.isNewExpression(current) || ts.isVariableDeclaration(current)) return false;
      current = current.parent;
    }
    return Boolean(current && ts.isArrowFunction(current) && !ts.isBlock(current.body));
  };
  const ownsHandlerContext = (node: ts.Node): boolean => {
    if (file.includes("_renderer.")) return false;
    if (routeHandlerFile && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node))) {
      if (node.name && (["handler", "handle"].includes(node.name.text) || defaultExports.has(node.name.text))) return true;
      if (ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return true;
    }
    const parent = node.parent;
    if (routeHandlerFile && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
      && (["handler", "handle"].includes(parent.name.text) || defaultExports.has(parent.name.text))) return true;
    if (routeHandlerFile && ts.isExportAssignment(parent)) return true;
    if (!ts.isCallExpression(parent)) return false;
    const factory = (expression: ts.Expression): boolean => ts.isIdentifier(expression) ? handlerFactories.has(expression.text)
      : ts.isPropertyAccessExpression(expression) ? handlerFactories.has(expression.name.text) || expression.name.text === "forContext" && factory(expression.expression)
        : ts.isCallExpression(expression) ? factory(expression.expression) : false;
    return factory(parent.expression);
  };
  const belongsToHandler = (node: ts.Node | undefined): boolean => {
    if (file.includes("_renderer.")) return false;
    while (node && !ts.isFunctionLike(node) && !ts.isSourceFile(node)) node = node.parent;
    if (!node || !ts.isFunctionLike(node)) return false;
    if (ownsHandlerContext(node)) return true;
    const parent = node.parent;
    if (!ts.isCallExpression(parent)) return false;
    const callee = parent.expression;
    // A callback contributes to the response only when its call result is returned.
    return ts.isPropertyAccessExpression(callee) && ["map", "flatMap", "transaction"].includes(callee.name.text)
      && isReturnedValue(parent) && belongsToHandler(parent.parent);
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
  const contextValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) return contextValue(expression.expression, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return contextValue(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope)) {
        const index = scope.parameters.findIndex(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (index >= 0) return index === 0 && ownsHandlerContext(scope)
          || index === 1 && rendererFunctions.has(scope)
          || /(?:RouteHandlerContext|ViewRenderContext|HandlerContext)/.test(scope.parameters[index].type?.getText(tree) ?? "");
      }
      scope = scope.parent;
    }
    return false;
  };
  const isResolverFunction = (expression: ts.Expression, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return isResolverFunction(expression.expression, seen);
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text === "routeUrl" && contextValue(expression.expression);
    if (ts.isElementAccessExpression(expression)) return ts.isStringLiteralLike(expression.argumentExpression) && expression.argumentExpression.text === "routeUrl" && contextValue(expression.expression);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const selected = selections.get(scope)?.get(expression.text);
      if (selected) return selected.field === "routeUrl" && contextValue(selected.expression);
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return isResolverFunction(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return false;
      scope = scope.parent;
    }
    return false;
  };
  const jsonHelpers = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "@betterportal/framework" || statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (!binding.isTypeOnly && (binding.propertyName?.text ?? binding.name.text) === "jsonResponse") jsonHelpers.add(binding.name.text);
    }
  }
  const isGlobal = (expression: ts.Expression, name: string, allowImport = false): boolean => {
    if (!ts.isIdentifier(expression) || expression.text !== name) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      if (declarations.get(scope)?.has(name) && !(allowImport && ts.isSourceFile(scope)) || initializers.get(scope)?.has(name) || selections.get(scope)?.has(name)) return false;
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === name)) return false;
      scope = scope.parent;
    }
    return true;
  };
  const isResponseConstructor = (expression: ts.Expression): boolean => {
    if (ts.isIdentifier(expression)) return jsonHelpers.has(expression.text) && isGlobal(expression, expression.text, true);
    return ts.isPropertyAccessExpression(expression) && (isGlobal(expression.expression, "Response") && expression.name.text === "json"
      || isGlobal(expression.expression, "JSON") && expression.name.text === "stringify"
      || isGlobal(expression.expression, "Promise") && ["resolve", "all", "allSettled", "race"].includes(expression.name.text));
  };
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "uiRouteUrl" && contextValue(node.expression)
      || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === "uiRouteUrl" && contextValue(node.expression)
      || ts.isBindingElement(node) && (node.propertyName ?? node.name).getText(tree).replace(/^["']|["']$/g, "") === "uiRouteUrl"
        && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent)
        && !!node.parent.parent.initializer && contextValue(node.parent.parent.initializer)) {
      report(node, "uiRouteUrl was removed. Use ctx.routeUrl({ ... }) and select uiPath or absoluteUiPath.");
    }
    if (ts.isPropertyAccessExpression(node) && ["route", "uiRoute", "current", "path"].includes(node.name.text)
      && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "url" && contextValue(node.expression.expression)) {
      report(node, "ctx.url helpers were removed. Use ctx.routeUrl({ ... }); omit the target for self.");
    }
    if (ts.isCallExpression(node) && isResolverFunction(node.expression)) {
      if (node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])
        && node.arguments[0].properties.some(item => item.name && ["absolute", "origin"].includes(ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name) ? item.name.text : item.name.getText(tree)))) {
        report(node, "absolute/origin options were removed. Select the corresponding absolute destination field.");
      }
      if ((node.arguments.length > 1 || node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))) {
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
    const returned = ts.isReturnStatement(node) && node.expression && belongsToHandler(node.parent) ? node.expression
      : ts.isArrowFunction(node) && !ts.isBlock(node.body) && belongsToHandler(node) ? node.body : undefined;
    if (returned && internalValue(returned)) report(node, "Do not return internal route destinations from API handlers. Return domain data and resolve destinations at the point of use.");
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isSpreadAssignment(node)) && inReturnedObject(node) && internalValue(ts.isSpreadAssignment(node) ? node.expression : ts.isPropertyAssignment(node) ? node.initializer : node.name)) {
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
