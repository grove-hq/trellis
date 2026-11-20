import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  // The framework's tests drop a key with a rest pattern: `const { [key]: _, ...rest } = obj`.
  { files: ["framework/**/*.mjs"], rules: { "no-unused-vars": ["error", { ignoreRestSiblings: true }] } },
];
