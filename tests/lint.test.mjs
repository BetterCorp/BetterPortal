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
