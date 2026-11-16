// trellis/confine-import — confine a module's import to an allowlist of files,
// so it is reached only through one sanctioned wrapper.
//
// A ban names its target one of two ways, and supplies exactly one:
//   - `package`    — an npm package or Node built-in ("pg"), with its subpaths.
//   - `pathSuffix` — the import path ends with this, for a first-party module
//                    whose relative spelling varies with the importer's depth.
//
// Each ban carries its own allowlist, so a file exempt from one ban is still
// held to every other. The ES module forms are covered: static import,
// re-export, and dynamic import() with a literal specifier. A computed
// specifier is unreadable here; trellis/require-literal-dynamic-import closes
// it. Type-only forms erase at compile time and are exempt. `require()` and
// other ways to load a module are not read: ban them separately.

import { isBuiltin } from "node:module";
import { isAbsolute, posix, relative, resolve } from "node:path";

// A string literal or a zero-expression template; null for a computed specifier.
function staticSpecifier(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

// The linted file's path relative to the root, or null when it lies outside.
// A relative filename is read against the linter's cwd.
function rootRelative(filename, root, cwd) {
  const rel = relative(root, resolve(cwd, filename)).replaceAll("\\", "/");
  return rel === "" || rel.startsWith("../") || isAbsolute(rel) ? null : rel;
}

// Match a root-relative path against one allowlist entry, anchored at the root so
// a file elsewhere whose path ends the same way never inherits it:
//   - "/a/b.ts" → exactly that file; * matches within one segment
//   - "/dir/**" → every file under dir/
function matchesPattern(rel, pattern) {
  const dir = pattern.endsWith("/**") ? pattern.slice(1, -"/**".length) : null;
  const escaped = (dir ?? pattern.slice(1)).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp("^" + escaped + (dir === null ? "$" : "/"), "u").test(rel);
}

function isAllowlisted(filename, allowlist, root, cwd) {
  const rel = rootRelative(filename, root, cwd);
  if (rel === null) return false;
  const patterns = Array.isArray(allowlist) ? allowlist : [allowlist];
  return patterns.some((pattern) => matchesPattern(rel, pattern));
}

// A Node built-in is one module with or without its "node:" prefix.
function packageName(specifier) {
  return isBuiltin(specifier) && !specifier.startsWith("node:") ? "node:" + specifier : specifier;
}

// The module a path names once resolution's own spellings are removed: a source
// extension, the folder's index, a trailing slash, and any "." or ".." segment.
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/u;
function modulePath(path) {
  return posix.normalize(path.replaceAll("\\", "/")).replace(/\/+$/u, "").replace(SOURCE_EXTENSION, "").replace(/\/index$/u, "");
}

// `package` covers the package and its subpaths. `pathSuffix` is matched against
// the specifier as spelled and, for a relative one, as resolved from the
// importing file, so a sibling's `./x` matches a suffix naming the module's directory.
function banTargetsSpecifier(specifier, ban, filename) {
  if (specifier === null) return false;
  if (ban.package !== undefined) {
    const banned = packageName(ban.package);
    const imported = packageName(specifier);
    return imported === banned || imported.startsWith(banned + "/");
  }
  const suffix = modulePath(ban.pathSuffix);
  if (modulePath(specifier).endsWith(suffix)) return true;
  if (!specifier.startsWith(".")) return false;
  const importer = "/" + filename.replaceAll("\\", "/");
  return modulePath(posix.join(posix.dirname(importer), specifier.replaceAll("\\", "/"))).endsWith(suffix);
}

// A root-relative path: a leading "/", no "./", and "**" only as a trailing "/**".
const allowlistEntrySchema = { type: "string", pattern: "^/(?:[^*]|\\*(?!\\*))*(?:/\\*\\*)?$" };

const banSchema = {
  type: "object",
  properties: {
    package: { type: "string" },
    pathSuffix: { type: "string" },
    allowedExports: { type: "array", items: { type: "string" }, minItems: 1 },
    allowlist: {
      anyOf: [allowlistEntrySchema, { type: "array", items: allowlistEntrySchema }],
    },
    message: { type: "string" },
  },
  oneOf: [{ required: ["package"] }, { required: ["pathSuffix"] }],
  required: ["allowlist", "message"],
  additionalProperties: false,
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Confine a module's import (npm package or first-party path) to an allowlist of files.",
    },
    schema: [
      {
        type: "object",
        properties: {
          // Stated by the config rather than searched for upward from the linted
          // file, where a planted marker could re-root it.
          root: { type: "string" },
          bans: { type: "array", items: banSchema },
        },
        required: ["root", "bans"],
        additionalProperties: false,
      },
    ],
    messages: { confined: "{{message}}" },
  },
  create(context) {
    const { root, bans = [] } = context.options[0] ?? {};
    if (typeof root !== "string" || !isAbsolute(root)) {
      throw new Error(`trellis/confine-import: "root" must be an absolute path, got "${root}".`);
    }
    const filename = context.filename;
    const active = bans.filter((ban) => !isAllowlisted(filename, ban.allowlist, root, context.cwd));
    if (active.length === 0) return {};

    const report = (node, ban) =>
      context.report({ node, messageId: "confined", data: { message: ban.message } });

    // A whole-module ban (no `allowedExports`) flags any runtime edge. A partial
    // ban flags each named export outside `allowedExports`, and fails closed on a
    // namespace/`*` form (`wildcard`) or a specifier-less import (`bareSideEffect`),
    // which name nothing to check.
    const checkNamed = (node, namedSpecifiers, wildcard, bareSideEffect) => {
      for (const ban of active) {
        if (!banTargetsSpecifier(staticSpecifier(node.source), ban, filename)) continue;
        if (!ban.allowedExports) {
          if (bareSideEffect || wildcard || namedSpecifiers.length > 0) report(node, ban);
          continue;
        }
        if (wildcard || bareSideEffect) {
          report(node, ban);
          continue;
        }
        const allowed = new Set(ban.allowedExports);
        for (const { node: specNode, name } of namedSpecifiers) {
          if (!allowed.has(name)) report(specNode, ban);
        }
      }
    };

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const named = [];
        let wildcard = false;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier") {
            if (spec.importKind === "type") continue;
            named.push({ node: spec, name: spec.imported.name });
          } else if (spec.type === "ImportDefaultSpecifier") {
            named.push({ node: spec, name: "default" });
          } else if (spec.type === "ImportNamespaceSpecifier") {
            wildcard = true;
          }
        }
        checkNamed(node, named, wildcard, node.specifiers.length === 0);
      },
      ExportNamedDeclaration(node) {
        if (!node.source) return;
        if (node.exportKind === "type") return;
        const named = node.specifiers
          .filter((spec) => spec.exportKind !== "type")
          .map((spec) => ({ node: spec, name: spec.local.name }));
        // `export {} from "pkg"` is a side-effect re-export. Keyed on the raw
        // count: specifiers that are all type-only erase and stay non-bare.
        checkNamed(node, named, false, node.specifiers.length === 0);
      },
      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        checkNamed(node, [], true, false);
      },
      ImportExpression(node) {
        const specifier = staticSpecifier(node.source);
        if (specifier === null) return;
        for (const ban of active) {
          if (banTargetsSpecifier(specifier, ban, filename)) report(node, ban);
        }
      },
    };
  },
};
