import assert from "node:assert/strict";
import { test } from "node:test";
import { Linter } from "eslint";
import { confineImport } from "./index.js";

const ROOT = "/repo";
const config = confineImport([{ package: "acme-db/server", allowlist: "/src/db.js", message: "use src/db.js" }], {
  files: ["src/**/*.js"],
  root: ROOT,
});
const messages = (code, filename) =>
  new Linter({ cwd: ROOT }).verify(code, [config], { filename }).map((m) => m.ruleId);

test("confineImport fences the ban and closes computed dynamic imports over its files", () => {
  assert.deepEqual(messages(`import "acme-db/server";`, "src/page.js"), ["trellis/confine-import"]);
  assert.deepEqual(messages(`import "acme-db/server";`, "src/db.js"), []);
  assert.deepEqual(messages(`const name = "x"; import(name);`, "src/page.js"), [
    "trellis/require-literal-dynamic-import",
  ]);
});
