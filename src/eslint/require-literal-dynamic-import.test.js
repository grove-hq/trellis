import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import rule from "./require-literal-dynamic-import.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
});

ruleTester.run("require-literal-dynamic-import", rule, {
  valid: [
    { code: `const p = import("./mod");` },
    { code: `async function f() { await import("acme-db/server"); }` },
    // Static import/re-export forms are not dynamic imports.
    { code: `import x from "y";` },
    { code: `export { a } from "b";` },
  ],
  invalid: [
    { code: `const n = "x"; const p = import(n);`, errors: [{ messageId: "computed" }] },
    { code: `const p = import("a" + "b");`, errors: [{ messageId: "computed" }] },
    { code: "const y = 'q'; const p = import(`x/${y}`);", errors: [{ messageId: "computed" }] },
    // A zero-expression template must be a plain literal too.
    { code: "const p = import(`foo`);", errors: [{ messageId: "computed" }] },
  ],
});
