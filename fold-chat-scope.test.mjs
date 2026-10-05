// fold-chat-scope.test.mjs — what a model needs to see for ONE edit, computed without a model.
import test from "node:test";
import assert from "node:assert/strict";
import { scopeFor, termsOf, indexFile, renderScope, renderFull } from "./fold-chat-scope.js";

const FILES = {
  "src/money.js": "export function fmtMoney(cents) { return '$' + cents; }\n",
  "src/policy.js": "// money rounding policy\nexport function roundCents(x) { return Math.round(x); }\n",
  "src/tax.js": "import { roundCents } from './policy.js';\nexport function taxFor(c) { return roundCents(c * 0.08); }\n",
  "src/cart.js": "import { createItem } from './catalog.js';\nexport function bulk(n) { return createItem(n, 5); }\nexport function qualifiesForFreeShipping(c) { return c >= 5000; }\n",
  "src/catalog.js": "export function createItem(name, price) { return { name, price }; }\n",
  "src/seed.js": "import { createItem } from './catalog.js';\nexport const SEED = [createItem('a', 1)];\n",
  "src/report.js": "import { taxFor } from './tax.js';\nimport { t } from './i18n.js';\nexport function receipt(c) { return t('x') + taxFor(c); }\n",
  "src/i18n.js": "export function t(k) { return k; }\n",
  "src/unrelated.js": "export function parseQuery(s) { return {}; }\n",
  "tests/money.test.js": "import { fmtMoney } from '../src/money.js';\n",
  "README.md": "# shop\n",
};

test("termsOf reads identifiers, paths, literals and words from an ask", () => {
  const t = termsOf("Change createItem({ name }) in src/catalog.js so the `taxFor` limit goes from $50 to 7500 cents");
  assert.ok(t.idents.includes("createItem") && t.idents.includes("taxFor"));
  assert.deepEqual(t.files, ["src/catalog.js"]);
  assert.ok(t.literals.includes("50") && t.literals.includes("7500"));
  assert.ok(t.words.includes("limit"));
});

test("indexFile finds definitions, imports and the names a file uses", () => {
  const i = indexFile("src/cart.js", FILES["src/cart.js"]);
  assert.ok(i.defs.has("bulk") && i.defs.has("qualifiesForFreeShipping"));
  assert.ok(i.imports.has("./catalog.js")); assert.ok(i.uses.has("createItem"));
});

test("a signature change reaches its CALLERS, not only its definition", () => {
  const s = scopeFor(FILES, "Change createItem to take an options object and update everything that calls it.", { budget: 5000 });
  const p = s.include.map((x) => x.path);
  for (const need of ["src/catalog.js", "src/cart.js", "src/seed.js"]) assert.ok(p.includes(need), need + " in " + p);
  assert.ok(!p.includes("src/unrelated.js"));
  assert.match(s.include.find((x) => x.path === "src/catalog.js").why.join(" "), /named/);
  assert.match(s.include.find((x) => x.path === "src/seed.js").why.join(" "), /caller/);
});

test("a symptom in one file pulls in the thing it calls (the cause)", () => {
  const s = scopeFor(FILES, "The receipt(c) tax line is wrong.", { budget: 5000 });
  const p = s.include.map((x) => x.path);
  assert.ok(p.includes("src/report.js")); assert.ok(p.includes("src/tax.js"), "callee of the named file: " + p);
});

test("the import of the file the ask names outranks weak shared-symbol edges", () => {
  const s = scopeFor(FILES, "Add a note to receipt(c) output.", { budget: 400, maxFiles: 3 });
  assert.ok(s.include.map((x) => x.path).includes("src/i18n.js"), "the one import that matters survives a tight budget: " + JSON.stringify(s.include.map((x) => x.path)));
});

test("a literal named in the ask finds every file that hard-codes it", () => {
  const s = scopeFor(FILES, "Raise the limit from 5000 to 7500 everywhere.", { budget: 5000 });
  assert.ok(s.include.find((x) => x.path === "src/cart.js").why.some((w) => w.startsWith("literal")));
});

test("identifier NAMES carry domain words: 'free shipping' finds qualifiesForFreeShipping", () => {
  const s = scopeFor(FILES, "Raise the free shipping threshold.", { budget: 5000 });
  assert.ok(s.include.find((x) => x.path === "src/cart.js")?.why.some((w) => w.startsWith("name")), JSON.stringify(s.include));
});

test("a file the ask names by path is included, and a NEW file's directory shows the pattern", () => {
  const s = scopeFor(FILES, "Create src/tip.js exporting tipFor.", { budget: 5000 });
  assert.ok(s.include.some((x) => x.why.some((w) => w.startsWith("sibling"))));
  assert.ok(scopeFor(FILES, "Edit src/seed.js to add an item.", { budget: 5000 }).include.find((x) => x.path === "src/seed.js").why.includes("path:named"));
});

test("a failing trace puts its files in scope", () => {
  const s = scopeFor(FILES, "Fix the failure.", { budget: 5000, trace: ["src/policy.js"] });
  assert.ok(s.include.find((x) => x.path === "src/policy.js").why.includes("trace"));
});

test("the budget is a wall, everything outside it becomes an outline, and the saving is real", () => {
  const s = scopeFor(FILES, "Change createItem to take an options object.", { budget: 150 });
  assert.ok(s.chars <= 150 + 130, "at most one file past the wall: " + s.chars);
  assert.ok(s.outline.length > 0 && s.outline.every((o) => Array.isArray(o.defs)));
  const text = renderScope(FILES, s);
  assert.match(text, /outline only/); assert.ok(text.length < renderFull(FILES).length);
});

test("falsifier: a convention in a file with no name, import, literal, trace or term linking it is NOT found — and the result says so", () => {
  const s = scopeFor(FILES, "Create src/tip.js exporting tipFor(bill, pct): the gratuity on a bill.", { budget: 200, maxFiles: 3 });
  assert.ok(!s.include.some((x) => x.path === "src/policy.js"), "nothing links policy.js to this ask");
  assert.ok(s.notes.some((n) => /cannot be found mechanically/.test(n)), "the limit is stated in the result, not hidden");
});

test("legacy weighting is kept for the experiment and behaves differently on purpose", () => {
  const a = scopeFor(FILES, "Raise the free shipping threshold.", { budget: 5000, legacy: true });
  const b = scopeFor(FILES, "Raise the free shipping threshold.", { budget: 5000 });
  assert.ok(!a.include.some((x) => x.why.some((w) => w.startsWith("name"))), "v1 has no name matching");
  assert.ok(b.include.some((x) => x.why.some((w) => w.startsWith("name"))));
});

test("an empty or hopeless ask never throws and says nothing matched", () => {
  assert.doesNotThrow(() => scopeFor({}, ""));
  assert.doesNotThrow(() => scopeFor(FILES, ""));
  const s = scopeFor({ "a.js": "x" }, "zzz qqq");
  assert.ok(s.notes.some((n) => /nothing in the codebase matches/.test(n)));
});
