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

Each ban names its target with `package` (an exact specifier) or `pathSuffix` (the tail of a first-party module's path, matched at any depth). `allowlist` is one or more paths from `root`: an exact file or `/dir/**`. Add `allowedExports` to leave some of a module's exports free and fence the rest.

Static imports, re-exports and dynamic imports are all covered; type-only imports are exempt. `confineImport` also turns on `trellis/require-literal-dynamic-import`, because a computed `import()` is the one import a fence cannot read.

The ESLint config that declares the fence belongs in your frame. Otherwise an agent can add its own file to the allowlist.
