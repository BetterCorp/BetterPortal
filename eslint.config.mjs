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
    plugins: { tsdoc },
    rules: {
      "tsdoc/syntax": "error",
      // Existing schema/HTMX interop uses explicit any; strict TS remains the type gate.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }]
    }
  }
);
