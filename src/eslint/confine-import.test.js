import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { Linter, RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import rule from "./confine-import.js";

const ROOT = resolve("/repo");
const at = (path) => join(ROOT, path);

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

// A whole-module ban, a partial ban (only the listed exports are importable),
// and a pathSuffix ban on a first-party module.
const BANS = [
  {
    package: "acme-db/server",
    allowlist: "/packages/services/src/db-client.ts",
    message: "server client only in the factory",
  },
  {
    package: "acme-db/react",
    allowedExports: ["useQuery", "useMutation", "useAction"],
    allowlist: ["/apps/web/src/providers/db-provider.tsx", "/apps/web/src/lib/sync/**"],
    message: "browser client only in the provider",
  },
  {
    pathSuffix: "/_generated/server",
    allowedExports: ["internalQuery", "internalMutation", "internalAction"],
    allowlist: ["/packages/backend/src/lib/wrappers.ts"],
    message: "raw builders only in the wrapper factory",
  },
];
const options = [{ root: ROOT, bans: BANS }];

ruleTester.run("confine-import", rule, {
  valid: [
    // The allowlisted factory may import the whole-module-banned package.
    {
      code: `import { HttpClient } from "acme-db/server";`,
      filename: at("packages/services/src/db-client.ts"),
      options,
    },
    // The allowlisted provider may import the banned acme-db/react constructors.
    {
      code: `import { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/providers/db-provider.tsx"),
      options,
    },
    // A directory allowlist (`/apps/web/src/lib/sync/**`) exempts files under it.
    {
      code: `import { Provider } from "acme-db/react";`,
      filename: at("apps/web/src/lib/sync/setup.ts"),
      options,
    },
    // An allowlisted export from a partially-banned module stays importable anywhere.
    {
      code: `import { useQuery, useMutation } from "acme-db/react";`,
      filename: at("apps/web/src/anything.tsx"),
      options,
    },
    // A type-only import erases at compile time — no runtime edge — so a
    // non-allowlisted export imported as a type is fine even in a fenced file.
    {
      code: `import type { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
    },
    // Same for a whole-module ban: a type-only import reaches nothing at runtime.
    {
      code: `import type { HttpClient } from "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
    },
    // Mixed import: the `type` specifier is dropped (erases), the value one is
    // allowlisted — so the whole statement is clean.
    {
      code: `import { type ReactClient, useQuery } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
    },
    // Unrelated package, untouched.
    {
      code: `import { useState } from "react";`,
      filename: at("apps/web/src/anything.tsx"),
      options,
    },
    // Literal dynamic import of an unrelated package.
    {
      code: `async function f() { await import("react-dom"); }`,
      filename: at("apps/web/src/anything.tsx"),
      options,
    },
    // An allowlisted re-export from a partially-banned module stays allowed.
    {
      code: `export { useQuery } from "acme-db/react";`,
      filename: at("apps/web/src/anything.tsx"),
      options,
    },
    // The allowlisted provider may re-export the fenced acme-db/react constructors.
    {
      code: `export { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/providers/db-provider.tsx"),
      options,
    },
    // Type-only re-export forms erase at compile time — no runtime edge — so
    // re-exporting a fenced export *as a type* is fine even in a fenced file.
    // `export type { X } from` (whole statement is type-only):
    {
      code: `export type { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
    },
    // `export { type X } from` (per-specifier type modifier erases the specifier):
    {
      code: `export { type ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
    },
    // `export type * from` (type-only star re-export):
    {
      code: `export type * from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
    },
    // A *computed* template specifier is out of scope for this rule — it's
    // closed repo-wide by the separate computed-specifier guard, not here.
    {
      code: "async function f(x) { await import(`acme-db/${x}`); }",
      filename: at("apps/web/src/lib/thing.ts"),
      options,
    },
    // No bans configured → no-op.
    {
      code: `import { HttpClient } from "acme-db/server";`,
      filename: at("apps/web/src/anything.ts"),
      options: [{ root: ROOT, bans: [] }],
    },
    // pathSuffix: the allowlisted wrapper factory may import the raw builders.
    {
      code: `import { query, mutation, action } from "../_generated/server";`,
      filename: at("packages/backend/src/lib/wrappers.ts"),
      options,
    },
    // pathSuffix: internal* builders are allowed anywhere (not doors).
    {
      code: `import { internalQuery, internalMutation } from "./_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
    },
    // pathSuffix: a same-named import from a DIFFERENT module isn't matched.
    {
      code: `import { query } from "other-helpers/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
    },
    // pathSuffix: type-only import of a builder-adjacent type erases.
    {
      code: `import type { MutationCtx } from "./_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
    },
  ],

  invalid: [
    // A package ban covers the package's subpaths.
    {
      code: `import { HttpClient } from "acme-db/server/lib/client.js";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: 1,
    },
    // pathSuffix: an extension on the specifier names the same module.
    {
      code: `import { query } from "./_generated/server.js";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: 1,
    },
    // pathSuffix: so do the folder's index, a trailing slash and a detour through "..".
    {
      code: `import { query } from "./_generated/server/index.js";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: 1,
    },
    {
      code: `import { query } from "./_generated/server/";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: 1,
    },
    {
      code: `import { query } from "@acme/backend/lib/../_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: 1,
    },
    {
      code: `export { query } from "../_generated/server.ts";`,
      filename: at("packages/backend/src/lib/things.ts"),
      options,
      errors: 1,
    },
    // Whole-module ban, static import, non-allowlisted file.
    {
      code: `import { HttpClient } from "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Whole-module ban, dynamic import.
    {
      code: `async function f() { await import("acme-db/server"); }`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Partial ban, dynamic import: a dynamic import hands back the whole module
    // namespace (any export, incl. the fenced constructors), so it is fenced
    // regardless of `allowedExports` — fail-closed by design.
    {
      code: `async function f() { await import("acme-db/react"); }`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Whole-module ban, bare side-effect import.
    {
      code: `import "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Partial ban: a bare side-effect import names no export, so it can't be
    // checked against allowedExports — fail closed like a wildcard.
    {
      code: `import "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Partial ban: a non-allowlisted named export in a non-allowlisted file.
    {
      code: `import { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Default-deny: an export that is neither a known constructor nor in the
    // allow set (e.g. one a future version of the package ships) is
    // fenced by default — this is the posture win over a denylist.
    {
      code: `import { useConnectionState } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Partial ban: renamed import is still the banned export at the source.
    {
      code: `import { ReactClient as C } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Partial ban: namespace import can reach a banned export → flagged.
    {
      code: `import * as cr from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // THE cross-ban isolation guarantee: a file allowlisted for acme-db/server
    // is NOT thereby exempt from the acme-db/react ban. This is the bug a shared
    // config-level `ignores` allowlist would have (silently) reintroduced.
    {
      code: `import { ReactClient } from "acme-db/react";`,
      filename: at("packages/services/src/db-client.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Two independent violations in one non-allowlisted file both report.
    {
      code:
        `import { HttpClient } from "acme-db/server";\n` +
        `import { Provider } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }, { messageId: "confined" }],
    },
    // Re-export launders a banned export just like an import — must be caught.
    {
      code: `export { ReactClient } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Renamed re-export is still the banned export at the source.
    {
      code: `export { ReactClient as C } from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // `export *` from a partially-banned module re-exposes the banned exports.
    {
      code: `export * from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Re-export of a whole-module-banned package (named and star forms).
    {
      code: `export { x } from "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    {
      code: `export * from "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // An empty re-export (`export {} from "pkg"`) is a side-effect re-export: a
    // runtime edge that names nothing, so it fails closed like a bare
    // `import "pkg"`. (Regression guard: previously slipped through with no
    // specifiers, no wildcard, and bareSideEffect=false.)
    {
      code: `export {} from "acme-db/server";`,
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Same for a PARTIAL ban (allowedExports): an empty re-export names no
    // export to check against the allowlist, so it fails closed like a bare
    // side-effect import — even though `export { useQuery } from "acme-db/react"`
    // would pass. Pins the partial-ban side of the empty-re-export fix.
    {
      code: `export {} from "acme-db/react";`,
      filename: at("apps/web/src/lib/thing.tsx"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // A zero-expression template dynamic import is a statically-known specifier.
    {
      code: "async function f() { await import(`acme-db/server`); }",
      filename: at("apps/web/src/lib/thing.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Cross-ban isolation holds for re-exports too: a acme-db/server-allowlisted
    // file re-exporting acme-db/react's banned constructor is still flagged.
    {
      code: `export { ReactClient } from "acme-db/react";`,
      filename: at("packages/services/src/db-client.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // pathSuffix: raw builder import in a non-allowlisted file.
    {
      code: `import { mutation } from "./_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // pathSuffix is alias-proof (matches the exported name) and depth-invariant
    // (a deeper "../../" specifier still matches the tail).
    {
      code: `import { query as q } from "../../_generated/server";`,
      filename: at("packages/backend/src/a/b/deep.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // pathSuffix: the package-export spelling of the same module is matched too.
    {
      code: `import { action } from "@acme/backend/_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // pathSuffix: namespace import can reach every builder — fail closed.
    {
      code: `import * as server from "./_generated/server";`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // pathSuffix: dynamic import of the builder module — fail closed.
    {
      code: `async function f() { await import("./_generated/server"); }`,
      filename: at("packages/backend/src/things.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // An allowlist entry names one file from the repo root: a file elsewhere
    // whose path merely ends the same way inherits no exemption.
    {
      code: `import { HttpClient } from "acme-db/server";`,
      filename: at("apps/web/vendor/packages/services/src/db-client.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
    // Same for a directory entry: another `lib/sync/` elsewhere is not it.
    {
      code: `import { Provider } from "acme-db/react";`,
      filename: at("packages/features/src/lib/sync/setup.ts"),
      options,
      errors: [{ messageId: "confined" }],
    },
  ],
});

// A pathSuffix that names a module's own directory must also catch a sibling's
// "./x" import, which spells none of that directory: the suffix is checked
// against the specifier resolved from the importing file.
const DIR_BAN = [
  {
    root: ROOT,
    bans: [
      {
        pathSuffix: "/lib/sync/shared",
        allowedExports: ["readDoc"],
        allowlist: ["/apps/web/src/lib/sync/allowed.ts"],
        message: "content writes only from a fenced module",
      },
    ],
  },
];
ruleTester.run("confine-import (relative spellings)", rule, {
  valid: [
    {
      code: `import { readDoc } from "./shared";`,
      filename: at("apps/web/src/lib/sync/new-writer.ts"),
      options: DIR_BAN,
    },
    {
      code: `import { writeDoc } from "./shared";`,
      filename: at("apps/web/src/lib/other/new-writer.ts"),
      options: DIR_BAN,
    },
  ],
  invalid: [
    {
      code: `import { writeDoc } from "./shared";`,
      filename: at("apps/web/src/lib/sync/new-writer.ts"),
      options: DIR_BAN,
      errors: [{ messageId: "confined" }],
    },
    {
      code: `import { writeDoc } from "../sync/shared.ts";`,
      filename: at("apps/web/src/lib/documents/new-writer.ts"),
      options: DIR_BAN,
      errors: [{ messageId: "confined" }],
    },
    {
      code: `import { writeDoc } from "../shared";`,
      filename: at("apps/web/src/lib/sync/nested/new-writer.ts"),
      options: DIR_BAN,
      errors: [{ messageId: "confined" }],
    },
    {
      code: `import { writeDoc } from "@/lib/sync/shared";`,
      filename: at("apps/web/src/app/route.ts"),
      options: DIR_BAN,
      errors: [{ messageId: "confined" }],
    },
  ],
});

// A subpath that reaches none of the fenced exports, such as a stylesheet, can
// be left free by name. Every other subpath stays fenced.
const SUBPATH_BANS = [
  {
    root: ROOT,
    bans: [
      {
        package: "acme-editor",
        allowedExports: ["Toolbar"],
        allowedSubpaths: ["styles.css"],
        allowlist: ["/src/editor.ts"],
        message: "the editor only through src/editor.ts",
      },
    ],
  },
];
ruleTester.run("confine-import (allowed subpaths)", rule, {
  valid: [{ code: `import "acme-editor/styles.css";`, filename: at("src/layout.tsx"), options: SUBPATH_BANS }],
  invalid: [
    { code: `import "acme-editor/other.css";`, filename: at("src/layout.tsx"), options: SUBPATH_BANS, errors: 1 },
    { code: `import "acme-editor";`, filename: at("src/layout.tsx"), options: SUBPATH_BANS, errors: 1 },
  ],
});

// A Node built-in is one module whether or not it is spelled with "node:".
// "sqlite" has no bare spelling, so that name is an npm package.
const BUILTIN_BANS = [
  {
    root: ROOT,
    bans: [
      { package: "node:fs", allowlist: [], message: "files only through the store" },
      { package: "node:sqlite", allowlist: [], message: "the database only through the client" },
    ],
  },
];
ruleTester.run("confine-import (Node built-ins)", rule, {
  valid: [
    { code: `import sqlite from "sqlite";`, filename: at("src/thing.ts"), options: BUILTIN_BANS },
    { code: `import path from "node:path";`, filename: at("src/thing.ts"), options: BUILTIN_BANS },
  ],
  invalid: [
    { code: `import fs from "fs";`, filename: at("src/thing.ts"), options: BUILTIN_BANS, errors: 1 },
    { code: `import { readFile } from "node:fs/promises";`, filename: at("src/thing.ts"), options: BUILTIN_BANS, errors: 1 },
    { code: `import { DatabaseSync } from "node:sqlite";`, filename: at("src/thing.ts"), options: BUILTIN_BANS, errors: 1 },
  ],
});

const lint = (cwd, root) =>
  new Linter({ cwd }).verify(
    `import { HttpClient } from "acme-db/server";`,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tsParser },
        plugins: { trellis: { rules: { r: rule } } },
        rules: { "trellis/r": ["error", { root, bans: BANS }] },
      },
    ],
    { filename: "packages/services/src/db-client.ts" },
  );

// The same spelling is the sanctioned file from the root and a different file from anywhere else.
test("a relative filename is read against the linter's cwd", () => {
  assert.equal(lint(ROOT, ROOT).length, 0);
  assert.equal(lint(join(ROOT, "apps/web"), ROOT).length, 1);
});

test("the allowlist is anchored at the root option", () => {
  assert.equal(lint(ROOT, join(ROOT, "packages/services")).length, 1);
});

test("a relative root is refused", () => {
  assert.throws(() => lint(ROOT, "."), /absolute/);
});
