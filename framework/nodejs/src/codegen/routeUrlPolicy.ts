import { routingDiagnostics } from "./routingRules.js";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

export interface RouteUrlPolicyError { file: string; message: string; severity: "error" }

const legacyFields = new Set(["accountUrl", "loginUrl", "logoutUrl", "socialUrl", "firstAdminUrl", "nextUrl", "mailNextUrl", "sessionNextUrl", "previewPath", "tenantsPath"]);
const internalPaths = new Set(["apiPath", "viewPath", "uiPath", "absoluteApiPath", "absoluteViewPath"]);

/** Reject the old routing API and renderer-only URL payloads even in loosely typed source. */
export function inspectRouteUrlSource(file: string, source: string): RouteUrlPolicyError[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors: RouteUrlPolicyError[] = routingDiagnostics(file, source).map(item => ({ file, message: item.message, severity: "error" }));
  const rendererFunctions = new Set<ts.Node>();
  const declarations = new Map<ts.Node, Set<string>>();
  const selections = new Map<ts.Node, Map<string, { expression: ts.Node; field: string; rest: boolean; element?: number }>>();
  const initializers = new Map<ts.Node, Map<string, ts.Expression>>();
  const lengthTypes = new Map<ts.Node, Set<string>>();
  const stringTypes = new Map<ts.Node, Set<string>>();
  type Mutation = { target: ts.Expression; values: readonly ts.Expression[]; global?: ts.Expression; collection?: boolean };
  const pendingMutations: Mutation[] = [];
  const functions = new Map<ts.Node, Map<string, ts.FunctionDeclaration>>();
  const propertyKey = (name: ts.PropertyName): string | undefined => {
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
    if (ts.isComputedPropertyName(name) && (ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression))) return name.expression.text;
    return undefined;
  };
  const collect = (node: ts.Node): void => {
    if (file.includes("_renderer.") && ts.isFunctionLike(node)) {
      const declaration = ts.isVariableDeclaration(node.parent) ? node.parent : undefined;
      const name = ts.isFunctionDeclaration(node) ? node.name?.text : declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
      const owner = declaration?.parent.parent;
      const exported = ts.isFunctionDeclaration(node) ? ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
        : owner && ts.isVariableStatement(owner) && ts.getModifiers(owner)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (name?.startsWith("render") && exported) rendererFunctions.add(node);
    }
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name)
      && node.type && [ts.SyntaxKind.StringKeyword, ts.SyntaxKind.ArrayType, ts.SyntaxKind.TupleType].includes(node.type.kind)) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope) && !(ts.isParameter(node) && ts.isFunctionLike(scope))) scope = scope.parent;
      const bindings = lengthTypes.get(scope) ?? new Set<string>();
      bindings.add(node.name.text); lengthTypes.set(scope, bindings);
      if (node.type.kind === ts.SyntaxKind.StringKeyword) {
        const strings = stringTypes.get(scope) ?? new Set<string>(); strings.add(node.name.text); stringTypes.set(scope, strings);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = initializers.get(scope) ?? new Map<string, ts.Expression>();
      bindings.set(node.name.text, node.initializer); initializers.set(scope, bindings);
    }
    if ((ts.isVariableDeclaration(node) && node.initializer || ts.isParameter(node)) && ts.isObjectBindingPattern(node.name)) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope) && !(ts.isParameter(node) && ts.isFunctionLike(scope))) scope = scope.parent;
      const bindings = selections.get(scope) ?? new Map<string, { expression: ts.Node; field: string; rest: boolean; element?: number }>();
      for (const item of node.name.elements) {
        if (!ts.isIdentifier(item.name)) continue;
        const key = item.propertyName ?? item.name;
        if (!ts.isIdentifier(key) && !ts.isStringLiteralLike(key)) continue;
        bindings.set(item.name.text, { expression: node.initializer ?? node.name, field: key.text, rest: !!item.dotDotDotToken });
      }
      selections.set(scope, bindings);
    }
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = selections.get(scope) ?? new Map<string, { expression: ts.Node; field: string; rest: boolean; element?: number }>();
      for (const [index, item] of node.name.elements.entries()) {
        if (!ts.isBindingElement(item) || !ts.isIdentifier(item.name)) continue;
        bindings.set(item.name.text, { expression: node.initializer, field: String(index), rest: !!item.dotDotDotToken, element: index });
      }
      selections.set(scope, bindings);
    }
    const declare = (name: string): void => {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const names = declarations.get(scope) ?? new Set<string>(); names.add(name); declarations.set(scope, names);
    };
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) declare(node.name.text);
    if (ts.isFunctionDeclaration(node) && node.name) {
      let scope: ts.Node = node.parent;
      while (!ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
      const bindings = functions.get(scope) ?? new Map<string, ts.FunctionDeclaration>();
      bindings.set(node.name.text, node); functions.set(scope, bindings);
    }
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
      const assigned = (target: ts.Expression, value: ts.Expression): void => {
        if (ts.isParenthesizedExpression(target)) { assigned(target.expression, value); return; }
        if (ts.isArrayLiteralExpression(target)) {
          for (const [index, item] of target.elements.entries()) {
            if (ts.isOmittedExpression(item)) continue;
            if (ts.isSpreadElement(item)) {
              const values = ts.isArrayLiteralExpression(value) ? value.elements.slice(index) : [value];
              pendingMutations.push({ target: item.expression, values });
            } else assigned(item, ts.isArrayLiteralExpression(value) && !value.elements.some(ts.isSpreadElement)
              ? value.elements[index] ?? ts.factory.createIdentifier("undefined") : value);
          }
          return;
        }
        if (ts.isObjectLiteralExpression(target)) {
          for (const item of target.properties) {
            if (ts.isSpreadAssignment(item)) { pendingMutations.push({ target: item.expression, values: [value] }); continue; }
            if (!ts.isPropertyAssignment(item) && !ts.isShorthandPropertyAssignment(item)) continue;
            const name = propertyKey(item.name);
            if (name === undefined) continue;
            const source = ts.isObjectLiteralExpression(value) ? value.properties.find(property => property.name && propertyKey(property.name) === name) : undefined;
            const selected = source && ts.isPropertyAssignment(source) ? source.initializer : source && ts.isShorthandPropertyAssignment(source) ? source.name : ts.factory.createPropertyAccessExpression(value, name);
            assigned(ts.isPropertyAssignment(item) ? item.initializer : item.name, selected);
          }
          return;
        }
        pendingMutations.push({ target, values: [value] });
      };
      assigned(node.left, node.right);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (["push", "unshift", "splice", "fill"].includes(method)) pendingMutations.push({
        target: node.expression.expression,
        values: method === "splice" ? node.arguments.slice(2) : method === "fill" ? node.arguments.slice(0, 1) : node.arguments
      });
      if (["set", "append", "add"].includes(method)) pendingMutations.push({
        target: node.expression.expression, values: node.arguments, collection: true
      });
      if (["defineProperty", "defineProperties"].includes(method) && node.arguments[0]) pendingMutations.push({
        target: node.arguments[0], values: node.arguments.slice(method === "defineProperty" ? 2 : 1), global: node.expression.expression
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
  const collection = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return collection(expression.expression, seen);
    if (ts.isNewExpression(expression)) return ["Map", "Set", "Headers", "URLSearchParams", "FormData"].some(name => isGlobal(expression.expression, name));
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return collection(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return false;
      scope = scope.parent;
    }
    return false;
  };
  const report = (node: ts.Node, message: string) => {
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    errors.push({ file: `${file}:${position.line + 1}:${position.character + 1}`, message, severity: "error" });
  };
  const resolveCallback = (expression: ts.Node | undefined, seen = new Set<string>()): ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration | undefined => {
    if (!expression) return undefined;
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression) || ts.isFunctionDeclaration(expression) || ts.isMethodDeclaration(expression)) return expression;
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return resolveCallback(expression.expression, seen);
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "bind") return resolveCallback(expression.expression.expression, seen);
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
      const field = ts.isPropertyAccessExpression(expression) ? expression.name.text : (expression.argumentExpression as ts.StringLiteralLike).text;
      return resolveCallback(selectedProperty(expression.expression, field), seen);
    }
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return undefined;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return resolveCallback(initializer, new Set([...seen, expression.text]));
      const declaration = functions.get(scope)?.get(expression.text);
      if (declaration) return declaration;
      if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) return undefined;
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return undefined;
      scope = scope.parent;
    }
    return undefined;
  };
  const arrayValues = (expression: ts.Node, seen = new Set<string>()): readonly ts.Node[] | undefined => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return arrayValues(expression.expression, seen);
    if (ts.isArrayLiteralExpression(expression)) {
      const values: ts.Node[] = [];
      for (const element of expression.elements) {
        if (ts.isSpreadElement(element)) {
          const spread = arrayValues(element.expression, seen);
          if (!spread) return undefined;
          values.push(...spread);
        } else values.push(element);
      }
      return values;
    }
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Array") && expression.expression.name.text === "of") return expression.arguments;
    if (ts.isNewExpression(expression) && isGlobal(expression.expression, "Array")) return expression.arguments;
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return undefined;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return arrayValues(initializer, new Set([...seen, expression.text]));
      if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) return undefined;
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (parameter) { const input = parameterInputs.get(parameter); return input ? arrayValues(input, new Set([...seen, expression.text])) : undefined; }
      }
      scope = scope.parent;
    }
    return undefined;
  };
  const argumentValues = (inputs: readonly (ts.Node | undefined)[]): readonly (ts.Node | undefined)[] => inputs.flatMap<ts.Node | undefined>(input =>
    input && ts.isSpreadElement(input) ? arrayValues(input.expression) ?? [input.expression] : [input]);
  const boundInputs = (expression: ts.Node, inputs: readonly (ts.Node | undefined)[], seen = new Set<ts.Node>()): readonly (ts.Node | undefined)[] => {
    if (seen.has(expression)) return inputs;
    const next = new Set([...seen, expression]);
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "bind") return boundInputs(expression.expression.expression, [...argumentValues(expression.arguments).slice(1), ...inputs], next);
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return boundInputs(expression.expression, inputs, next);
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
      const field = ts.isPropertyAccessExpression(expression) ? expression.name.text : (expression.argumentExpression as ts.StringLiteralLike).text;
      const selected = selectedProperty(expression.expression, field);
      if (selected) return boundInputs(selected, inputs, next);
    }
    if (ts.isIdentifier(expression)) {
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return boundInputs(initializer, inputs, next);
        if (declarations.get(scope)?.has(expression.text)) break;
        scope = scope.parent;
      }
    }
    return inputs;
  };
  const rejectedValue = (expression: ts.Node, seen = new Set<ts.Node>()): ts.Node | undefined => {
    if (seen.has(expression)) return undefined;
    const next = new Set([...seen, expression]);
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)
      && isGlobal(expression.expression.expression, "Promise") && expression.expression.name.text === "reject") return expression.arguments[0];
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
      const operation = expression.expression.name.text;
      const handler = expression.arguments[operation === "then" ? 1 : 0];
      if (operation === "finally" || ["then", "catch"].includes(operation)
        && (!handler || handler.kind === ts.SyntaxKind.NullKeyword || isGlobal(handler, "undefined"))) return rejectedValue(expression.expression.expression, next);
      if (["then", "catch"].includes(operation) && handler) return callbackRejection(handler, rejectedValue(expression.expression.expression, next), next);
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return rejectedValue(expression.expression, next);
    if (ts.isIdentifier(expression)) {
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return rejectedValue(initializer, next);
        if (declarations.get(scope)?.has(expression.text)) break;
        if (ts.isFunctionLike(scope)) {
          const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
          if (parameter) {
            const input = parameterInputs.get(parameter);
            return input ? rejectedValue(input, next) : undefined;
          }
        }
        scope = scope.parent;
      }
    }
    return undefined;
  };
  const selectedElements = (selected: { expression: ts.Node; rest: boolean; element?: number }): readonly ts.Node[] => {
    const values = arrayValues(selected.expression);
    return values && selected.element !== undefined ? selected.rest ? values.slice(selected.element) : values.slice(selected.element, selected.element + 1) : [selected.expression];
  };
  const isStringValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return isStringValue(expression.expression, seen);
    if (ts.isStringLiteralLike(expression) || ts.isTemplateExpression(expression)) return true;
    if (ts.isPropertyAccessExpression(expression)) return (internalPaths.has(expression.name.text) || expression.name.text === "absoluteUiPath") && internalValue(expression.expression);
    if (ts.isCallExpression(expression) && isGlobal(expression.expression, "String") || ts.isNewExpression(expression) && isGlobal(expression.expression, "String")) return true;
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      if (stringTypes.get(scope)?.has(expression.text)) return true;
      const selected = selections.get(scope)?.get(expression.text);
      if (selected?.element !== undefined) return !selected.rest && selectedElements(selected).length === 1 && isStringValue(selectedElements(selected)[0], new Set([...seen, expression.text]));
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return isStringValue(initializer, new Set([...seen, expression.text]));
      if (declarations.get(scope)?.has(expression.text) || selected) return false;
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return false;
      scope = scope.parent;
    }
    return false;
  };
  const hasScalarLength = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return hasScalarLength(expression.expression, seen);
    if (ts.isArrayLiteralExpression(expression) || ts.isStringLiteralLike(expression) || ts.isTemplateExpression(expression)) return true;
    if (ts.isPropertyAccessExpression(expression)) return internalPaths.has(expression.name.text) && internalValue(expression.expression);
    if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return internalPaths.has(expression.argumentExpression.text) && internalValue(expression.expression);
    if (ts.isNewExpression(expression)) return isGlobal(expression.expression, "Array") || isGlobal(expression.expression, "String");
    if (ts.isCallExpression(expression) && isGlobal(expression.expression, "String")) return true;
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && ["trim", "trimStart", "trimEnd", "replace", "replaceAll", "toLowerCase", "toUpperCase", "normalize", "substring", "substr", "padStart", "padEnd", "repeat", "split", "slice", "filter", "map", "flatMap"].includes(expression.expression.name.text)) return hasScalarLength(expression.expression.expression, seen);
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Promise") && expression.expression.name.text === "resolve") return !!expression.arguments[0] && hasScalarLength(expression.arguments[0], seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      if (lengthTypes.get(scope)?.has(expression.text)) return true;
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return hasScalarLength(initializer, new Set([...seen, expression.text]));
      if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) return false;
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (parameter) {
          const input = parameterInputs.get(parameter);
          if (!input) return false;
          return elementParameters.has(parameter) ? ts.isArrayLiteralExpression(input) && input.elements.every(item => hasScalarLength(item, seen)) : hasScalarLength(input, seen);
        }
      }
      scope = scope.parent;
    }
    return false;
  };
  const parameterInputs = new Map<ts.ParameterDeclaration, ts.Node>();
  const elementParameters = new Set<ts.ParameterDeclaration>();
  const promiseResolvers = new Set<ts.ParameterDeclaration>();
  const isPromiseResolver = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return isPromiseResolver(expression.expression, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return isPromiseResolver(initializer, new Set([...seen, expression.text]));
      if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) return false;
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (parameter) return promiseResolvers.has(parameter) || parameterInputs.has(parameter) && isPromiseResolver(parameterInputs.get(parameter)!);
      }
      scope = scope.parent;
    }
    return false;
  };
  const evaluatingFunctions = new Set<ts.Node>();
  const parameterValue = (parameter: ts.ParameterDeclaration, index: number, inputs: readonly (ts.Node | undefined)[]): ts.Node | undefined =>
    parameter.dotDotDotToken ? ts.factory.createArrayLiteralExpression(inputs.slice(index).map(input => input as ts.Expression ?? ts.factory.createIdentifier("undefined"))) : inputs[index];
  const callbackInternal = (callback: ReturnType<typeof resolveCallback>, seen: Set<string>, inputs: readonly (ts.Node | undefined)[] = [], elements: readonly number[] = [], fulfillOnly = false): boolean => {
    if (!callback?.body || evaluatingFunctions.has(callback)) return false;
    evaluatingFunctions.add(callback);
    const previous = callback.parameters.map(parameter => ({ parameter, input: parameterInputs.get(parameter), element: elementParameters.has(parameter) }));
    for (const [index, parameter] of callback.parameters.entries()) {
      const input = parameterValue(parameter, index, inputs);
      if (input) parameterInputs.set(parameter, input); else parameterInputs.delete(parameter);
      if (elements.includes(index)) elementParameters.add(parameter); else elementParameters.delete(parameter);
    }
    try {
      if (!fulfillOnly && !ts.isBlock(callback.body)) return internalValue(callback.body, seen);
      let internal = false;
      const returned = (node: ts.Node): void => {
        if (node !== callback.body && ts.isFunctionLike(node)) return;
        if (!fulfillOnly && (ts.isReturnStatement(node) || ts.isYieldExpression(node)) && node.expression && internalValue(node.expression, seen)) internal = true;
        if (fulfillOnly && ts.isCallExpression(node)) {
          if (isPromiseResolver(node.expression)) {
            if (node.arguments[0] && internalValue(node.arguments[0], seen)) internal = true;
          } else {
            if (callbackValue(node.expression, seen, node.arguments, [], true)) internal = true;
            for (const argument of node.arguments)
              if (callbackValue(argument, seen, [], [], true)) internal = true;
          }
        }
        ts.forEachChild(node, returned);
      };
      returned(callback.body); return internal;
    } finally {
      for (const { parameter, input, element } of previous) {
        if (input) parameterInputs.set(parameter, input); else parameterInputs.delete(parameter);
        if (element) elementParameters.add(parameter); else elementParameters.delete(parameter);
      }
      evaluatingFunctions.delete(callback);
    }
  };
  const callbackValue = (expression: ts.Node | undefined, seen: Set<string>, inputs: readonly (ts.Node | undefined)[] = [], elements: readonly number[] = [], fulfillOnly = false): boolean => {
    if (!expression) return false;
    const expanded = argumentValues(inputs);
    const combined = boundInputs(expression, expanded);
    const offset = combined.length - expanded.length;
    return callbackInternal(resolveCallback(expression), seen, combined, elements.map(index => index + offset), fulfillOnly);
  };
  const rejectionOrigin = (expression: ts.Node, seen = new Set<ts.Node>()): ts.Node => {
    if (seen.has(expression) || !ts.isIdentifier(expression)) return expression;
    const next = new Set([...seen, expression]);
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return rejectionOrigin(initializer, next);
      if (declarations.get(scope)?.has(expression.text)) break;
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (parameter) { const input = parameterInputs.get(parameter); return input ? rejectionOrigin(input, next) : expression; }
      }
      scope = scope.parent;
    }
    return expression;
  };
  const callbackRejection = (expression: ts.Node, input: ts.Node | undefined, seen: Set<ts.Node>): ts.Node | undefined => {
    const callback = resolveCallback(expression);
    if (!callback?.body || evaluatingFunctions.has(callback)) return undefined;
    evaluatingFunctions.add(callback);
    const inputs = boundInputs(expression, input ? [input] : []);
    const previous = callback.parameters.map(parameter => ({ parameter, input: parameterInputs.get(parameter) }));
    for (const [index, parameter] of callback.parameters.entries()) {
      const value = parameterValue(parameter, index, inputs);
      if (value) parameterInputs.set(parameter, value); else parameterInputs.delete(parameter);
    }
    try {
      const reasons: ts.Expression[] = [];
      const returned = (node: ts.Node): void => {
        if (node !== callback.body && ts.isFunctionLike(node)) return;
        const value = ts.isThrowStatement(node) ? node.expression : ts.isReturnStatement(node) ? node.expression : node === callback.body && !ts.isBlock(node) ? node : undefined;
        const reason = value && (ts.isThrowStatement(node) ? value : rejectedValue(value, seen));
        if (reason) reasons.push(rejectionOrigin(reason) as ts.Expression);
        ts.forEachChild(node, returned);
      };
      returned(callback.body);
      return reasons.length === 1 ? reasons[0] : reasons.length ? ts.factory.createArrayLiteralExpression(reasons) : undefined;
    } finally {
      for (const { parameter, input: previousInput } of previous) {
        if (previousInput) parameterInputs.set(parameter, previousInput); else parameterInputs.delete(parameter);
      }
      evaluatingFunctions.delete(callback);
    }
  };
  const selectedProperty = (expression: ts.Node, field: string, seen = new Set<ts.Node>()): ts.Node | undefined => {
    if (seen.has(expression)) return undefined;
    const next = new Set([...seen, expression]);
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)
      || ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression)) return selectedProperty(expression.expression, field, next);
    if (ts.isObjectLiteralExpression(expression)) {
      const property = expression.properties.find(item => item.name && propertyKey(item.name) === field);
      return property && ts.isPropertyAssignment(property) ? property.initializer : property && ts.isShorthandPropertyAssignment(property) ? property.name : property && ts.isMethodDeclaration(property) ? property : undefined;
    }
    if (ts.isIdentifier(expression)) {
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return selectedProperty(initializer, field, next);
        if (declarations.get(scope)?.has(expression.text) || selections.get(scope)?.has(expression.text)) break;
        scope = scope.parent;
      }
    }
    return undefined;
  };
  const internalValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.some(value => internalValue(value, seen));
    if (ts.isElementAccessExpression(expression) && ts.isNumericLiteral(expression.argumentExpression)) {
      const values = arrayValues(expression.expression);
      const binding = reference(expression.expression);
      if (values && (!binding || !mutations.get(binding.scope)?.get(binding.name)?.length)) {
        const value = values[Number(expression.argumentExpression.text)];
        return !!value && internalValue(value, seen);
      }
    }
    if (ts.isElementAccessExpression(expression) && isStringValue(expression.expression)) {
      const index = expression.argumentExpression;
      if (ts.isNumericLiteral(index) || ts.isStringLiteralLike(index) && /^\d+$/.test(index.text)
        || ts.isPrefixUnaryExpression(index) && ts.isNumericLiteral(index.operand)) return false;
    }
    if (ts.isObjectBindingPattern(expression) && ts.isParameter(expression.parent)) {
      const input = parameterInputs.get(expression.parent);
      return !!input && internalValue(input, seen);
    }
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
        (!mutation.global || isGlobal(mutation.global, "Object")) && (!mutation.collection || collection(mutation.target))
        && mutation.values.some(value => internalValue(value, new Set([...seen, expression.text]))))) return true;
      let scope: ts.Node | undefined = expression.parent;
      while (scope) {
        const selected = selections.get(scope)?.get(expression.text);
        if (selected) return selected.element !== undefined ? selectedElements(selected).some(value => internalValue(value, new Set([...seen, expression.text]))) : (selected.rest || internalPaths.has(selected.field)) && internalValue(selected.expression, new Set([...seen, expression.text]));
        const initializer = initializers.get(scope)?.get(expression.text);
        if (initializer) return internalValue(initializer, new Set([...seen, expression.text]));
        if (ts.isFunctionLike(scope) && scope.parameters.some(param => ts.isIdentifier(param.name) && param.name.text === expression.text)) {
          const parameter = scope.parameters.find(param => ts.isIdentifier(param.name) && param.name.text === expression.text)!;
          const input = parameterInputs.get(parameter);
          if (input) return internalValue(input, seen);
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
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
      const field = ts.isPropertyAccessExpression(expression) ? expression.name.text : (expression.argumentExpression as ts.StringLiteralLike).text;
      const selected = selectedProperty(expression.expression, field);
      if (selected) return internalValue(selected, seen);
    }
    if ((ts.isPropertyAccessExpression(expression) && expression.name.text === "length"
      || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression) && expression.argumentExpression.text === "length") && hasScalarLength(expression.expression)) return false;
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === "size" && collection(expression.expression)) return false;
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === "absoluteUiPath"
      || ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression) && expression.argumentExpression.text === "absoluteUiPath") return false;
    if (ts.isPropertyAccessExpression(expression) && internalPaths.has(expression.name.text)) return internalValue(expression.expression, seen);
    if (ts.isCallExpression(expression) && (authRedirectFunction(expression.expression)
      || isResolverFunction(expression.expression))) return true;
    if (ts.isPropertyAccessExpression(expression)) return internalValue(expression.expression, seen);
    if (ts.isPropertyAssignment(expression)) return internalValue(expression.initializer, seen);
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)
      && ["component", "fragment", "toString"].includes(expression.expression.name.text)
      && internalValue(expression.expression.expression, seen)) return true;
    // An arbitrary function may consume a URL while returning unrelated domain data.
    if (ts.isCallExpression(expression)) {
      const localCallback = resolveCallback(expression.expression);
      if (localCallback) return callbackValue(expression.expression, seen, expression.arguments);
      if (ts.isPropertyAccessExpression(expression.expression) && ["call", "apply"].includes(expression.expression.name.text)) {
        const receiver = expression.expression.expression;
        const callback = resolveCallback(receiver);
        if (callback) {
          const arguments_ = argumentValues(expression.arguments);
          const inputs = expression.expression.name.text === "call" ? arguments_.slice(1)
            : arguments_[1] ? arrayValues(arguments_[1]) ?? [arguments_[1]] : [];
          return callbackValue(receiver, seen, inputs);
        }
      }
      if (isPromiseResolver(expression.expression)) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (["encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent", "escape", "unescape", "btoa", "atob"].some(name => isGlobal(expression.expression, name))) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (isGlobal(expression.expression, "String") || isGlobal(expression.expression, "Object")) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (isGlobal(expression.expression, "structuredClone")) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Array")) {
        if (expression.expression.name.text === "of") return expression.arguments.some(argument => internalValue(argument, seen));
        if (expression.expression.name.text === "from") {
          if (!expression.arguments[1]) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
          return callbackValue(expression.arguments[1], seen, [expression.arguments[0]], [0]);
        }
      }
      if (ts.isPropertyAccessExpression(expression.expression) && isGlobal(expression.expression.expression, "Object")) {
        if (expression.expression.name.text === "create") return !!expression.arguments[1] && internalValue(expression.arguments[1], seen);
        if (expression.expression.name.text === "defineProperty") return !!expression.arguments[0] && internalValue(expression.arguments[0], seen)
          || !!expression.arguments[2] && internalValue(expression.arguments[2], seen);
        if (expression.expression.name.text === "defineProperties") return expression.arguments.some(argument => internalValue(argument, seen));
        if (expression.expression.name.text === "assign") return expression.arguments.some(argument => internalValue(argument, seen));
        if (["values", "entries", "freeze", "seal", "preventExtensions"].includes(expression.expression.name.text)) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
        if (expression.expression.name.text === "fromEntries") return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      }
      if (ts.isPropertyAccessExpression(expression.expression)) {
        const operation = expression.expression.name.text;
        if ((operation === "charAt" || operation === "at") && isStringValue(expression.expression.expression)) return false;
        if (["replace", "replaceAll"].includes(operation) && hasScalarLength(expression.expression.expression)) {
          const replacement = expression.arguments[1];
          const callback = resolveCallback(replacement);
          return internalValue(expression.expression.expression, seen) || (callback
            ? callbackValue(replacement, seen, [expression.expression.expression]) : !!replacement && internalValue(replacement, seen));
        }
        if (["toString", "valueOf", "join", "trim", "trimStart", "trimEnd", "trimLeft", "trimRight", "replace", "replaceAll", "toLowerCase", "toUpperCase", "toLocaleLowerCase", "toLocaleUpperCase", "normalize", "substring", "substr", "charAt", "at", "padStart", "padEnd", "repeat", "split"].includes(operation)) return internalValue(expression.expression.expression, seen);
        if (operation === "fill") return internalValue(expression.expression.expression, seen) || !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
        if (operation === "splice") {
          const values = arrayValues(expression.expression.expression);
          const number = (value: ts.Expression | undefined): number | undefined => value && ts.isNumericLiteral(value) ? Number(value.text)
            : value && ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(value.operand) ? -Number(value.operand.text) : undefined;
          const start = number(expression.arguments[0]);
          const count = number(expression.arguments[1]);
          const binding = reference(expression.expression.expression);
          const earlierMutation = binding && mutations.get(binding.scope)?.get(binding.name)?.some(mutation => mutation.target.getStart(tree) < expression.getStart(tree)
            && mutation.values.some(value => internalValue(value, seen)));
          if (earlierMutation) return internalValue(expression.expression.expression, seen);
          if (values && (start !== undefined || !expression.arguments.length) && (count !== undefined || expression.arguments.length < 2)) {
            const index = Math.max(0, Math.min(values.length, start === undefined ? 0 : start < 0 ? values.length + start : start));
            const removed = !expression.arguments.length ? [] : values.slice(index, expression.arguments.length === 1 ? values.length : index + Math.max(0, count!));
            return removed.some(value => internalValue(value, seen));
          }
          return internalValue(expression.expression.expression, seen);
        }
        if (["filter", "slice", "sort", "reverse", "copyWithin", "toSorted", "toReversed", "flat", "find", "findLast", "pop", "shift"].includes(operation)) return internalValue(expression.expression.expression, seen);
        if (operation === "concat") return internalValue(expression.expression.expression, seen) || expression.arguments.some(argument => internalValue(argument, seen));
        if (["with", "toSpliced"].includes(operation)) return internalValue(expression.expression.expression, seen)
          || expression.arguments.slice(operation === "with" ? 1 : 2).some(argument => internalValue(argument, seen));
      }
      if (ts.isPropertyAccessExpression(expression.expression) && ["then", "catch", "finally"].includes(expression.expression.name.text)) {
        const operation = expression.expression.name.text;
        if ((operation === "charAt" || operation === "at") && isStringValue(expression.expression.expression)) return false;
        if (["replace", "replaceAll"].includes(operation) && hasScalarLength(expression.expression.expression)) {
          const replacement = expression.arguments[1];
          const callback = resolveCallback(replacement);
          return internalValue(expression.expression.expression, seen) || (callback
            ? callbackValue(replacement, seen, [expression.expression.expression]) : !!replacement && internalValue(replacement, seen));
        }
        if (operation === "finally") return internalValue(expression.expression.expression, seen);
        for (const [index, argument] of expression.arguments.slice(0, operation === "then" ? 2 : 1).entries()) {
          const input = operation === "then" && index === 0 ? expression.expression.expression : rejectedValue(expression.expression.expression);
          if (callbackValue(argument, seen, input ? [input] : [])) return true;
        }
        return (operation === "catch" || !expression.arguments[0]) && internalValue(expression.expression.expression, seen);
      }
      if (isResponseConstructor(expression.expression) || ts.isPropertyAccessExpression(expression.expression)
        && expression.expression.name.text === "response" && contextValue(expression.expression.expression)) return !!expression.arguments[0] && internalValue(expression.arguments[0], seen);
      if (ts.isPropertyAccessExpression(expression.expression) && ["map", "flatMap", "reduce", "reduceRight"].includes(expression.expression.name.text)) {
        if (["reduce", "reduceRight"].includes(expression.expression.name.text) && expression.arguments[1] && internalValue(expression.arguments[1], seen)) return true;
        return ["reduce", "reduceRight"].includes(expression.expression.name.text)
          ? callbackValue(expression.arguments[0], seen, [expression.arguments[1], expression.expression.expression], [1])
          : callbackValue(expression.arguments[0], seen, [expression.expression.expression], [0]);
      }
      return callbackValue(expression.expression, seen, expression.arguments);
    }
    if (ts.isNewExpression(expression) && isGlobal(expression.expression, "Promise")) {
      const executor = resolveCallback(expression.arguments?.[0]);
      const prefix = expression.arguments?.[0] ? boundInputs(expression.arguments[0], []).length : 0;
      const parameter = executor?.parameters[prefix];
      if (!executor || !parameter) return false;
      promiseResolvers.add(parameter);
      try { return callbackValue(expression.arguments?.[0], seen, [], [], true); }
      finally { promiseResolvers.delete(parameter); }
    }
    if (ts.isNewExpression(expression) && ["Array", "Map", "Set", "URLSearchParams", "Headers", "FormData", "URL", "String", "Object"].some(name => isGlobal(expression.expression, name))) return !!expression.arguments?.some(argument => internalValue(argument, seen));
    if (ts.isNewExpression(expression)) return isGlobal(expression.expression, "Response") && !!expression.arguments?.[0] && internalValue(expression.arguments[0], seen);
    return expression.getChildren(tree).some(child => internalValue(child, seen));
  };
  const defaultExports = new Set(tree.statements.flatMap(statement => ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression) ? [statement.expression.text] : []));
  const factoryNames = new Set(["createHandler", "createRawHandler", "createStreamHandler", "createSse"]);
  const handlerFactories = new Set<string>();
  const handlerNamespaces = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
    const module = statement.moduleSpecifier.text;
    if (module !== "@betterportal/framework" && !module.startsWith("@betterportal/framework/")
      && !/(?:^|[/])\.bp-generated[/]route-runtime(?:\.[cm]?[jt]s)?$/.test(module)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) handlerNamespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if (!binding.isTypeOnly && factoryNames.has(binding.propertyName?.text ?? binding.name.text)) handlerFactories.add(binding.name.text);
    }
  }
  const factoryImport = (expression: ts.Expression, namespace = false, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return factoryImport(expression.expression, namespace, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return namespace ? factoryImport(initializer, true, new Set([...seen, expression.text])) : factory(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return false;
      scope = scope.parent;
    }
    return (namespace ? handlerNamespaces : handlerFactories).has(expression.text) && isGlobal(expression, expression.text, true);
  };
  const factory = (expression: ts.Expression, seen = new Set<string>()): boolean => ts.isIdentifier(expression) ? factoryImport(expression, false, seen)
    : ts.isPropertyAccessExpression(expression) ? factoryNames.has(expression.name.text) && factoryImport(expression.expression, true, seen)
      || expression.name.text === "forContext" && factory(expression.expression, seen)
        : ts.isCallExpression(expression) ? factory(expression.expression, seen) : false;
  const routeHandlerFile = /(?:^|[/])bp-routes[/](?:.*[/])?(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|SSE|STREAM)\.(?:[cm]?ts|tsx)$/.test(file.replace(/\\/g, "/"));
  const isReturnedValue = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if ((ts.isReturnStatement(current) || ts.isYieldExpression(current))) return true;
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
    return ts.isPropertyAccessExpression(callee) && ["map", "flatMap", "reduce", "reduceRight", "transaction", "then", "catch"].includes(callee.name.text)
      && isReturnedValue(parent) && belongsToHandler(parent.parent);
  };
  const inReturnedObject = (node: ts.Node): boolean => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current)) {
      if (ts.isCallExpression(current) || ts.isNewExpression(current) || ts.isJsxAttribute(current) || ts.isJsxSpreadAttribute(current)) return false;
      if ((ts.isReturnStatement(current) || ts.isYieldExpression(current))) return belongsToHandler(current.parent);
      current = current.parent;
    }
    return Boolean(current && ts.isArrowFunction(current) && !ts.isBlock(current.body) && belongsToHandler(current));
  };
  const contextValue = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isObjectBindingPattern(expression) && ts.isParameter(expression.parent)) {
      const parameter = expression.parent;
      const input = parameterInputs.get(parameter);
      if (input) return contextValue(input, seen);
      const owner = parameter.parent;
      return ts.isFunctionLike(owner) && (owner.parameters[0] === parameter && ownsHandlerContext(owner)
        || owner.parameters[1] === parameter && rendererFunctions.has(owner)
        || /(?:RouteHandlerContext|ViewRenderContext|HandlerContext)/.test(parameter.type?.getText(tree) ?? ""));
    }
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
      || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) return contextValue(expression.expression, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const selected = selections.get(scope)?.get(expression.text);
      if (selected) return selected.element !== undefined ? !selected.rest && selectedElements(selected).some(value => contextValue(value, new Set([...seen, expression.text]))) : selected.rest && contextValue(selected.expression, new Set([...seen, expression.text]));
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return contextValue(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope)) {
        const index = scope.parameters.findIndex(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (index >= 0 && parameterInputs.has(scope.parameters[index])) return contextValue(parameterInputs.get(scope.parameters[index])!, seen);
        if (index >= 0) return index === 0 && ownsHandlerContext(scope)
          || index === 1 && rendererFunctions.has(scope)
          || /(?:RouteHandlerContext|ViewRenderContext|HandlerContext)/.test(scope.parameters[index].type?.getText(tree) ?? "");
      }
      scope = scope.parent;
    }
    return false;
  };
  const isResolverFunction = (expression: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return isResolverFunction(expression.expression, seen);
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text === "route" && contextValue(expression.expression);
    if (ts.isElementAccessExpression(expression)) return ts.isStringLiteralLike(expression.argumentExpression) && expression.argumentExpression.text === "route" && contextValue(expression.expression);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const selected = selections.get(scope)?.get(expression.text);
      if (selected) return selected.element !== undefined ? !selected.rest && selectedElements(selected).some(value => isResolverFunction(value, new Set([...seen, expression.text]))) : selected.field === "route" && contextValue(selected.expression);
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return isResolverFunction(initializer, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope)) {
        const parameter = scope.parameters.find(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text);
        if (parameter) return parameterInputs.has(parameter) && isResolverFunction(parameterInputs.get(parameter)!);
      }
      scope = scope.parent;
    }
    return false;
  };
  const authRedirectHelpers = new Set<string>();
  const authRedirectNamespaces = new Set<string>();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || !/^@betterportal\/framework(?:\/|$)/.test(statement.moduleSpecifier.text) || statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) authRedirectNamespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements)
      if (!binding.isTypeOnly && (binding.propertyName?.text ?? binding.name.text) === "resolveAppAuthRedirect") authRedirectHelpers.add(binding.name.text);
  }
  const authRedirectFunction = (expression: ts.Node, namespace = false, seen = new Set<string>()): boolean => {
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) return authRedirectFunction(expression.expression, namespace, seen);
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text === "resolveAppAuthRedirect" && authRedirectFunction(expression.expression, true, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return false;
    let scope: ts.Node | undefined = expression.parent;
    while (scope) {
      const initializer = initializers.get(scope)?.get(expression.text);
      if (initializer) return authRedirectFunction(initializer, namespace, new Set([...seen, expression.text]));
      const selected = selections.get(scope)?.get(expression.text);
      if (selected) return selected.field === "resolveAppAuthRedirect" && authRedirectFunction(selected.expression, true, new Set([...seen, expression.text]));
      if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === expression.text)) return false;
      scope = scope.parent;
    }
    return (namespace ? authRedirectNamespaces : authRedirectHelpers).has(expression.text) && isGlobal(expression, expression.text, true);
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
      || isGlobal(expression.expression, "JSON") && ["stringify", "parse"].includes(expression.name.text)
      || isGlobal(expression.expression, "Promise") && ["resolve", "all", "allSettled", "race", "any"].includes(expression.name.text));
  };
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && ["uiRouteUrl", "routeUrl", "routeUi"].includes(node.name.text) && contextValue(node.expression)
      || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && ["uiRouteUrl", "routeUrl", "routeUi"].includes(node.argumentExpression.text) && contextValue(node.expression)
      || ts.isBindingElement(node) && ["uiRouteUrl", "routeUrl", "routeUi"].includes((node.propertyName ?? node.name).getText(tree).replace(/^["']|["']$/g, ""))
        && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(node.parent.parent)
        && !!node.parent.parent.initializer && contextValue(node.parent.parent.initializer)
      || ts.isBindingElement(node) && ["uiRouteUrl", "routeUrl", "routeUi"].includes((node.propertyName ?? node.name).getText(tree).replace(/^["']|["']$/g, ""))
        && ts.isObjectBindingPattern(node.parent) && ts.isParameter(node.parent.parent) && contextValue(node.parent)) {
      report(node, "Legacy routing helpers were removed. Prefer BPRoute; use ctx.route({ ... }) for explicit destinations.");
    }
    if (ts.isPropertyAccessExpression(node) && ["route", "uiRoute", "current", "path"].includes(node.name.text)
      && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "url" && contextValue(node.expression.expression)) {
      report(node, "ctx.url helpers were removed. Use ctx.route({ ... }); omit the target for self.");
    }
    if (ts.isCallExpression(node) && isResolverFunction(node.expression)) {
      if (node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])
        && node.arguments[0].properties.some(item => item.name && ["absolute", "origin"].includes(ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name) ? item.name.text : item.name.getText(tree)))) {
        report(node, "absolute/origin options were removed. Select the corresponding absolute destination field.");
      }
      if ((node.arguments.length > 1 || node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))) {
        report(node, "route no longer accepts a positional view id or returns a string. Pass one options object and select a destination field.");
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
    const returned = (ts.isReturnStatement(node) || ts.isYieldExpression(node)) && node.expression && belongsToHandler(node.parent) ? node.expression
      : ts.isArrowFunction(node) && !ts.isBlock(node.body) && belongsToHandler(node) ? node.body : undefined;
    if (returned && internalValue(returned)) report(node, "Do not return internal route destinations from API handlers. Return domain data and resolve destinations at the point of use.");
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isSpreadAssignment(node)) && inReturnedObject(node) && internalValue(ts.isSpreadAssignment(node) ? node.expression : ts.isPropertyAssignment(node) ? node.initializer : node.name)) {
      report(node, "Do not return internal route paths as API response fields. Resolve them at the point of use; only public absoluteUiPath links belong in domain responses.");
    }
    if ((ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /(?:href|action|hx-(?:get|post|put|patch|delete|download))=["']\{[A-Za-z0-9_$.-]+\}["']/.test(node.text)) {
      report(node, "Legacy route tokens were removed. Resolve the destination with ctx.route in the renderer.");
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteralLike(node.initializer)
      && ["href", "action", "hx-get", "hx-post", "hx-put", "hx-patch", "hx-delete", "hx-download", "sse-connect"].includes(node.name.getText(tree))
      && /^\{[A-Za-z0-9_$.-]+\}$/.test(node.initializer.text)) {
      report(node, "Legacy route tokens were removed. Resolve the destination with ctx.route in the renderer.");
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
    if ((entry.name.startsWith(".") && entry.name !== ".well-known") || entry.name === "node_modules") return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? checkProjectRouteUrls(file) : /\.(?:[cm]?ts|tsx)$/.test(file) ? inspectRouteUrlSource(file, fs.readFileSync(file, "utf8")) : [];
  });
}


/** Inspect default source helpers and every configured route/shell input root. */
export function checkConfiguredRouteUrls(packageDir: string, config: { routes?: readonly string[]; shells?: readonly string[] } = {}): RouteUrlPolicyError[] {
  const roots = [...new Set(["src", ...config.routes ?? [], ...config.shells ?? []].map(directory => path.resolve(packageDir, directory)))];
  const minimal = roots.filter(root => !roots.some(parent => {
    if (parent === root) return false;
    const relative = path.relative(parent, root);
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
  }));
  return minimal.flatMap(checkProjectRouteUrls);
}
