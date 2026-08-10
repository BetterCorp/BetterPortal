import ts from "typescript";

export type SchemaPolicyIssueKind = "loose" | "allow" | "redundant-strip";
export interface SchemaPolicyIssue {
  kind: SchemaPolicyIssueKind;
  severity: "error" | "warning";
  line: number;
  column: number;
}

interface Bindings { namespaces: Set<string>; calls: Map<string, string> }

function bindingsFor(sourceFile: ts.SourceFile): Bindings {
  const bindings: Bindings = { namespaces: new Set(), calls: new Map() };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.getText(sourceFile).replace(/["']/g, "") !== "anyvali") continue;
    const imports = statement.importClause?.namedBindings;
    if (imports && ts.isNamespaceImport(imports)) bindings.namespaces.add(imports.name.text);
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) bindings.calls.set(item.name.text, item.propertyName?.text ?? item.name.text);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const target = ts.isIdentifier(node.initializer)
          ? bindings.calls.get(node.initializer.text)
          : ts.isPropertyAccessExpression(node.initializer)
            && ts.isIdentifier(node.initializer.expression)
            && bindings.namespaces.has(node.initializer.expression.text)
            ? node.initializer.name.text
            : undefined;
        if (target && bindings.calls.get(node.name.text) !== target) {
          bindings.calls.set(node.name.text, target);
          changed = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return bindings;
}

function callName(expression: ts.Expression, bindings: Bindings): string | undefined {
  if (ts.isIdentifier(expression)) return bindings.calls.get(expression.text);
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
    && bindings.namespaces.has(expression.expression.text)) return expression.name.text;
  return undefined;
}

function stringValue(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function option(object: ts.ObjectLiteralExpression): { value: string; node: ts.Node } | undefined {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined;
    const value = stringValue(property.initializer);
    if (name === "unknownKeys" && value) return { value, node: property.initializer };
  }
  return undefined;
}

function issue(sourceFile: ts.SourceFile, node: ts.Node, kind: SchemaPolicyIssueKind): SchemaPolicyIssue {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { kind, severity: kind === "redundant-strip" ? "warning" : "error", line: position.line + 1, column: position.character + 1 };
}

export function inspectAnyValiSchemaNode(sourceFile: ts.SourceFile, root: ts.Node): SchemaPolicyIssue[] {
  const bindings = bindingsFor(sourceFile);
  const issues: SchemaPolicyIssue[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression, bindings);
      if (name === "any" || name === "unknown") issues.push(issue(sourceFile, node.expression, "loose"));
      if (name === "object" && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
        const mode = option(node.arguments[1]);
        if (mode?.value === "allow") issues.push(issue(sourceFile, mode.node, "allow"));
        if (mode?.value === "strip") issues.push(issue(sourceFile, mode.node, "redundant-strip"));
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "unknownKeys") {
        const mode = stringValue(node.arguments[0]);
        if (mode === "allow") issues.push(issue(sourceFile, node.arguments[0], "allow"));
        if (mode === "strip") issues.push(issue(sourceFile, node.arguments[0], "redundant-strip"));
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
      if (name === "unknownKeys" && stringValue(node.initializer) === "allow") {
        const call = node.parent.parent;
        const objectOption = ts.isCallExpression(call) && callName(call.expression, bindings) === "object" && call.arguments[1] === node.parent;
        if (!objectOption) issues.push(issue(sourceFile, node.initializer, "allow"));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return issues;
}

export function inspectAnyValiSchemaSource(source: string, fileName: string): SchemaPolicyIssue[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return inspectAnyValiSchemaNode(sourceFile, sourceFile);
}
