# Import fences

A fence makes one file the only way to reach a module. Everything else that imports it fails lint, with a message saying where to go instead.

Use one when a module is only safe behind a wrapper: a database driver that must be tenant-scoped, a secrets reader, a raw query builder.

```js
// eslint.config.js
import { confineImport } from "@grovehq/trellis/eslint";

export default [
  confineImport(
    [
      {
        package: "pg",
        allowlist: "/src/db/client.js",
        message: "Reach the database through src/db/client.js, which scopes every query to the tenant.",
      },
    ],
    { files: ["src/**/*.js"], root: import.meta.dirname },
  ),
];
```

Each ban names its target with `package` (an npm package or Node built-in, including its subpaths) or `pathSuffix` (the tail of a first-party module's path, matched at any depth). `allowlist` is one or more paths from `root`: an exact file or `/dir/**`. Add `allowedExports` to leave some of a module's exports free and fence the rest.

Static imports, re-exports and dynamic imports are all covered; type-only imports are exempt. `confineImport` also turns on `trellis/require-literal-dynamic-import`, because a computed `import()` is the one import a fence cannot read.

The ESLint config that declares the fence belongs in your frame. Otherwise an agent can add its own file to the allowlist.

## What a fence assumes

A fence reads `import` and `export` statements. It stops the obvious shortcut, and it relies on the rest of your setup to close the others:

- **Other ways to load a module.** `require()`, `eval` and `process.getBuiltinModule()` are not read. Ban them with their own lint rules.
- **Other names for a module.** An alias in `tsconfig.json` or `package.json` gives a fenced module a name no ban mentions. Those files belong in your frame.
- **Turning the rule off.** A disable comment, an ESLint config file in a subfolder, or a file your `files` globs miss all switch a fence off. Check for the first, put the second in your frame, and keep the globs wide.
