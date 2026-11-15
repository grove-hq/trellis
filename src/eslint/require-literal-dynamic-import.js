// trellis/require-literal-dynamic-import — every dynamic import() names its
// module with a plain string literal.
//
// trellis/confine-import fences a module by reading the specifier. A computed
// specifier (`import(name)`, `import("a" + b)`) cannot be read at lint time, so
// it is the one module edge a fence cannot see. A zero-expression template must
// be a literal too, leaving one shape to reason about.
//
// A rule of its own rather than `no-restricted-syntax`: flat config does not
// merge a rule's settings, so a later config object setting that key for the
// same files would replace this guard with no diagnostic.

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require dynamic import() specifiers to be string literals.",
    },
    schema: [],
    messages: {
      computed:
        "Dynamic import() must use a plain string-literal specifier. A computed " +
        "specifier cannot be read at lint time, so it can reach a module that " +
        "trellis/confine-import fences. Write the specifier as a string literal, " +
        "or refactor to a lookup of static imports.",
    },
  },
  create(context) {
    return {
      ImportExpression(node) {
        if (node.source.type !== "Literal") {
          context.report({ node, messageId: "computed" });
        }
      },
    };
  },
};
