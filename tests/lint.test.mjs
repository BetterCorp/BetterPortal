import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

test("shared lint config checks source and documentation, excluding generated output", async () => {
  const eslint = new ESLint();
  const filePath = "framework/nodejs/src/lint-probe.ts";
  const [valid] = await eslint.lintText("/** Return the current value. */\nexport function value(): number { return 1; }", { filePath });
  assert.equal(valid.errorCount, 0);
  assert.equal(valid.warningCount, 0);

  const [invalid] = await eslint.lintText("/** @param value missing separator */\nexport function value(value: number): number { const unused = 1; return value; }", { filePath });
  assert.ok(invalid.messages.some(({ ruleId }) => ruleId === "tsdoc/syntax"));
  assert.ok(invalid.messages.some(({ ruleId }) => ruleId === "@typescript-eslint/no-unused-vars"));

  const [suppression] = await eslint.lintText("// eslint-disable-next-line no-debugger -- Deliberately unused for this test.\nexport const value = 1;", { filePath });
  assert.equal(suppression.errorCount, 1);
  assert.match(suppression.messages[0].message, /Unused eslint-disable directive/);

  for (const path of ["framework/nodejs/lib/index.js", "themes/nodejs/bootstrap1/src/.bp-generated/registry.ts", "node_modules/example/index.js"]) {
    assert.equal(await eslint.isPathIgnored(path), true, path);
  }
});


test("routing ESLint documents and enforces the same breaking contract as prebuild", async () => {
  const eslint = new ESLint();
  for (const source of [
    'export function render(data, ctx) { return <a href={ctx.route()?.uiPath}>Item</a>; }',
    'export function render(data, ctx) { return <bp-ok hx-get hx-delete>Delete</bp-ok>; }',
    'export function handler(ctx) { return { link: String(ctx.route()) }; }'
  ]) {
    const [result] = await eslint.lintText(source, { filePath: source.includes("function handler") ? "services/nodejs/examples/hello-view/src/plugin/bp-routes/items/GET.ts" : "services/nodejs/examples/hello-view/src/plugin/bp-routes/items/_renderer.bootstrap5/GET.tsx" });
    assert.ok(result.messages.some(message => message.ruleId === "betterportal/routing-contract"), source);
  }
});


test("routing JSX diagnostics point at the offending element instead of the file start", async () => {
  const eslint = new ESLint();
  const source = 'export function render(data, ctx) {\n  return (\n    <BPRoute ctx={ctx} component="summary" fragment="badge" />\n  );\n}';
  const [result] = await eslint.lintText(source, { filePath: "services/nodejs/examples/hello-view/src/plugin/bp-routes/items/_renderer.bootstrap5/GET.tsx" });
  const diagnostic = result.messages.find(message => message.ruleId === "betterportal/routing-contract");
  assert.ok(diagnostic);
  assert.equal(diagnostic.line, 3);
  assert.equal(diagnostic.column, 5);
});
