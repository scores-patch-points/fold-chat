// node --test fold-chat-falsify-refine.test.mjs — fix (a): a true paraphrase must clear, and the controls must still fail.
// 2026-10-07: the judge reported "unsupported"/"contested" on sentences the pages plainly state (predicate negation read
// as a reversal; "Joe Biden" rejected where the page says "Biden"; a compound claim whose clauses are in two sentences).
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer, clausesOf } from "./fold-chat-falsify-answer.js";

const P = (text) => ({ ref: "x", source: "https://a.example/x", url: "https://a.example/x", text });
const one = (claim, ...texts) => falsifyAnswer([claim], texts.map(P)).claims[0];

test("predicate negation is not a reversal: \"refused to concede\" is not contradicted by \"did not concede\"", () => {
  const c = one(
    "Donald Trump has consistently refused to concede the results.",
    "Donald Trump did not concede the results after the 2020 election.");
  assert.notEqual(c.verdict, "contested", `read as a reversal: ${JSON.stringify(c.witnesses.map((w) => w.why))}`);
  assert.equal(c.contradictions, 0);
});

test("a name is present by its head token: \"Joe Biden\" where the page says \"Biden\"", () => {
  const c = one("Joe Biden won the 2020 presidential election.", "Biden won the 2020 presidential election.");
  assert.equal(c.verdict, "held"); assert.equal(c.witnesses[0].verdict, "states");
});

test("a compound claim whose clauses a source states in different sentences is held", () => {
  const c = one(
    "Joe Biden won the 2020 election and Donald Trump disputed the result.",
    "Joe Biden won the 2020 election. Officials counted for days. Donald Trump disputed the result.");
  assert.ok(c.verdict === "held" || c.verdict === "corroborated", `got ${c.verdict}`);
});

test("CONTROL: a real reversal still contradicts", () => {
  const c = one("Joe Biden won the 2020 presidential election.", "Joe Biden did not win the 2020 presidential election.");
  assert.equal(c.verdict, "contested");
});

test("CONTROL: a different person is not accepted", () => {
  const c = one("Joe Biden won the 2020 presidential election.", "Donald Trump won the 2020 presidential election.");
  assert.notEqual(c.verdict, "held"); assert.notEqual(c.verdict, "corroborated");
});

test("CONTROL: an unwitnessed clause keeps a compound claim unstated", () => {
  const c = one(
    "Joe Biden won the 2020 election and Donald Trump won the 2020 election.",
    "Joe Biden won the 2020 election.");
  assert.ok(c.verdict === "unsupported" || c.verdict === "weak", `got ${c.verdict}`);
});

test("clausesOf never splits a bare list", () => {
  assert.deepEqual(clausesOf("He won Michigan and Wisconsin."), ["He won Michigan and Wisconsin."]);
  assert.equal(clausesOf("Biden won the election and Trump disputed the result.").length, 2);
});

test("CONTROL: a false claim whose subject is the page's OBJECT is not cleared (Trump-won vs a page that says Biden won)", () => {
  const c = one("Donald Trump won the 2020 United States presidential election.", "Joe Biden won the 2020 United States presidential election, defeating incumbent Donald Trump.");
  assert.notEqual(c.verdict, "held"); assert.notEqual(c.verdict, "corroborated");
});
test("CONTROL: the same page still HOLDS the true claim about its subject", () => {
  const c = one("Joe Biden won the 2020 presidential election.", "Joe Biden won the 2020 United States presidential election, defeating incumbent Donald Trump.");
  assert.ok(c.verdict === "held" || c.verdict === "corroborated", c.verdict);
});
