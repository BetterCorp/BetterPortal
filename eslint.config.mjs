import betterportal from "./framework/nodejs/lib/eslint.js";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";

export default defineConfig(
  { ignores: ["**/node_modules/**", "**/lib/**", "**/dist/**", "**/.bsb/**", "**/.bp-generated/**", "**/.betterportal/**", ".tmp-run/**", "old_project/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    linterOptions: { reportUnusedDisableDirectives: "error" }
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    plugins: { tsdoc, betterportal },
    rules: {
      "tsdoc/syntax": "error",
      "betterportal/routing-contract": "error",
      // Existing schema/HTMX interop uses explicit any; strict TS remains the type gate.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }]
    }
  },
  {
    files: ["plugins/nodejs/**/src/**/*.{ts,tsx}", "framework/nodejs/src/**/*.{ts,tsx}",
      "services/nodejs/**/src/**/*.{ts,tsx}", "themes/nodejs/**/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[object.name='process'][property.name='env'], MemberExpression[object.name='process'][property.value='env'], MemberExpression[object.property.name='process'][property.name='env'], VariableDeclarator[init.name='process'] > ObjectPattern > Property[key.name='env']",
        message: "Read runtime settings through BSB configuration. Environment access belongs to the BSB configuration manager."
      }],
      "no-restricted-imports": ["error", { paths: [
        { name: "node:process", message: "Use BSB configuration for runtime settings and the global process object for lifecycle operations." },
        { name: "process", message: "Use BSB configuration for runtime settings and the global process object for lifecycle operations." }
      ] }]
    }
  },
  { files: ["**/tests/**", "tests/**"], rules: { "betterportal/routing-contract": "off" } }
);
