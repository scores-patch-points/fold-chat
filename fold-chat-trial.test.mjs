// fold-chat-trial.test.mjs — finding a code's functions and choosing sample calls for them, from NAMES only.
import test from "node:test";
import assert from "node:assert/strict";
import { functionsIn, samplesFor, sampleCalls, formatValue, describeTrial } from "./fold-chat-trial.js";

test("functionsIn finds declarations, exports, arrows and function expressions — and not nested or private ones", () => {
  const code = [
    "export function slugify(title) { return title; }",
    "const add = (a, b = 2) => a + b;",
    "export const double = x => x * 2;",
    "let fmt = function (n, ...rest) { return n; };",
    "function _private(z) {}",
    "async function load(url) {}",
    "function outer() {\n  function inner(q) {}\n}",
  ].join("\n");
  const f = Object.fromEntries(functionsIn(code).map((x) => [x.name, x.params]));
  assert.deepEqual(f.slugify, ["title"]);
  assert.deepEqual(f.add, ["a", "b"], "a default value is dropped, the name kept");
  assert.deepEqual(f.double, ["x"]);
  assert.deepEqual(f.fmt, ["n", "rest"]);
  assert.deepEqual(f.load, ["url"]);
  assert.ok(!("_private" in f), "underscore names are private");
  assert.ok(!("inner" in f), "only top-level functions are tried");
});

test("samples are chosen from the parameter NAME: text for titles, numbers for counts, lists for arrays", () => {
  assert.equal(typeof samplesFor("title")[0], "string");
  assert.equal(typeof samplesFor("count")[0], "number");
  assert.ok(Array.isArray(samplesFor("items")[0]));
  assert.ok(samplesFor("whatever").length >= 2, "an unknown name still gets generic inputs");
  assert.ok(samplesFor("title").some((s) => /[^\w\s]/.test(s)), "the text samples include punctuation — where slug/format bugs live");
});

test("sampleCalls is deterministic, bounded, and never reads the answer's own examples", () => {
  const code = "function slugify(title) { return title; }\nfunction add(a, b) { return a + b; }";
  const c1 = sampleCalls(code), c2 = sampleCalls(code);
  assert.deepEqual(c1, c2);
  assert.ok(c1.some((c) => c.startsWith('slugify("Hello, World!")')));
  assert.ok(c1.some((c) => c.startsWith("add(")));
  assert.ok(c1.length <= 6, "three calls per function, three functions at most");
  assert.deepEqual(sampleCalls("const x = 1;"), [], "no functions, no calls");
});

test("a result is described honestly: the value, or what it threw", () => {
  assert.equal(describeTrial({ ok: true, expr: 'slugify("A b")', value: '"a-b"' }), 'slugify("A b") → "a-b"');
  assert.equal(describeTrial({ ok: false, expr: "f(1)", error: "TypeError: x is not a function" }), "f(1) threw TypeError: x is not a function");
  assert.equal(formatValue(undefined), "undefined");
  assert.equal(formatValue("hi"), '"hi"');
  assert.equal(formatValue([1, 2]), "[1,2]");
  assert.ok(formatValue("x".repeat(500)).length <= 160);
});
