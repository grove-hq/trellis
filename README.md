# Trellis

Trellis keeps a codebase's most important guarantees true when most of its code is written by AI agents.

Trellis defends two things: the guarantees the codebase depends on, and the integrity of the checks that hold them. The agent may propose changes to a check and but it can't merge them without a human signing off.

> Trellis is being moved here from the private codebase it grew up in. The import fences below are the first piece. The tamper check, a sample app showing the patterns, and the npm package follow.

## The idea

Some guarantees are about all code, present and future: no route is served without the auth gate, nothing talks to the database except through the tenant-scoped client. Ask of each one whether a machine can confirm it by reading the code or only by running it.

- Confirmable by **reading** the code's form (imports, call sites, wrappers, types): make it an enforced invariant, a check that fails the build.
- Confirmable only by **running** the code: it is a test.
- A question of whether the outcome is **right**: it is for review.

An invariant usually protects the one sanctioned way a codebase does something important, against an author who would bypass it, strip it, or write a second version beside it.

A check the author can switch off is a suggestion, so the files that define the checks need a human to ratify any change to them. That is the tamper check.

## Import fences

A fence makes one file the only way to reach a module. Everything else that imports it fails lint, with a message saying where to go instead.

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

## What Trellis does not do

Trellis checks that a mechanism is present and reached the right way. It cannot judge whether the mechanism is correct, and a passing check is not a statement that a codebase is secure. Review still owns that.

## License

Apache-2.0. See [LICENSE](LICENSE).
