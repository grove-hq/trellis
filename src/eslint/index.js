import confineImportRule from "./confine-import.js";
import requireLiteralDynamicImport from "./require-literal-dynamic-import.js";

const plugin = {
  meta: { name: "@grovehq/trellis" },
  rules: {
    "confine-import": confineImportRule,
    "require-literal-dynamic-import": requireLiteralDynamicImport,
  },
};

export default plugin;

/**
 * @typedef {object} Ban
 * @property {string} [package] - npm package or Node built-in to confine, with its subpaths (e.g. "pg"). Provide this OR `pathSuffix`.
 * @property {string} [pathSuffix] - Confine a first-party module by the tail of its import path (e.g. "/db/raw"), matching every relative depth. Provide this OR `package`.
 * @property {string[]} [allowedExports] - Allow ONLY these named exports anywhere; every other export is fenced. Omit to fence the whole module.
 * @property {string | string[]} allowlist - Root-relative path(s) with a leading "/" (an exact file, or `/dir/**`) of the file(s) allowed to import it. Pass `[]` when no file is exempt.
 * @property {string} message - Shown when the ban fires; say where to go instead.
 */

/**
 * The flat-config object that fences `bans` over `files`, with computed
 * dynamic imports closed alongside so no fence can be routed around.
 *
 * @param {Ban[]} bans
 * @param {{ files: string[], root: string }} options - `root` is the absolute path allowlists are read from.
 * @returns {import("eslint").Linter.Config}
 */
export function confineImport(bans, { files, root }) {
  return {
    files,
    plugins: { trellis: plugin },
    rules: {
      "trellis/confine-import": ["error", { root, bans }],
      "trellis/require-literal-dynamic-import": "error",
    },
  };
}
