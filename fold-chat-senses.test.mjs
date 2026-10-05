// fold-chat-senses.test.mjs — one bare word that names several things: say so (an app-authored line).
import test from "node:test";
import assert from "node:assert/strict";
import { senseTerm, disambiguationOf, sensesLine } from "./fold-chat-senses.js";

// What Wikipedia's search returned for the bare term (measured 2026-10-05, trimmed).
const MERCURY = [
  { title: "Mercury", url: "https://en.wikipedia.org/wiki/Mercury", snippet: "up Mercury or mercury in Wiktionary, the free dictionary. Mercury most commonly refers to: Mercury (planet), the closest planet to the Sun" },
  { title: "Freddie Mercury", url: "https://en.wikipedia.org/wiki/Freddie_Mercury", snippet: "Freddie Mercury (born Farrokh Bulsara) was a British singer" },
  { title: "Mercury (element)", url: "https://en.wikipedia.org/wiki/Mercury_(element)", snippet: "Mercury is a chemical element; it has symbol Hg" },
  { title: "Mercury (planet)", url: "https://en.wikipedia.org/wiki/Mercury_(planet)", snippet: "Mercury is the first planet from the Sun" },
  { title: "Mercury Records", url: "https://en.wikipedia.org/wiki/Mercury_Records", snippet: "Mercury Records is an American record label" },
  { title: "Mercury (disambiguation)", url: "https://en.wikipedia.org/wiki/Mercury_(disambiguation)", snippet: "Mercury commonly refers to" },
];
const PARIS = [
  { title: "Paris", snippet: "Paris is the capital and largest city of France, with an estimated city population of 2.04 million" },
  { title: "Paris (disambiguation)", snippet: "Look up Paris in Wiktionary, the free dictionary. Paris most commonly refers to" },
  { title: "Paris Hilton", snippet: "Paris Whitney Hilton is an American socialite" },
];

test("senseTerm: the WHOLE ask is one bare term (with a declared stem) — nothing else in it", () => {
  for (const [q, t] of [["tell me about mercury", "mercury"], ["What is Python?", "Python"], ["mercury", "mercury"], ["who is Einstein", "Einstein"], ["Amazon", "Amazon"], ["háblame de Mercurio", "Mercurio"], ["что такое Ртуть", "Ртуть"], ["什么是水星", "水星"]]) assert.equal(senseTerm(q), t, q);
});

test("senseTerm: a question that carries any other content word has already chosen a sense — no term", () => {
  for (const q of ["tell me about mercury poisoning in fish", "what is the capital of France", "How tall is the Eiffel Tower?", "mercury planet orbit period", "tell me about 2024", "", "a", "who won the world cup in 2018"]) assert.equal(senseTerm(q), null, q);
});

test("disambiguationOf: Wikipedia's own disambiguation page makes it ambiguous; the senses are its distinct titles", () => {
  const d = disambiguationOf("mercury", MERCURY);
  assert.deepEqual(d.senses.map((s) => s.label), ["Freddie Mercury", "Mercury (element)", "Mercury (planet)", "Mercury Records"]);
  assert.equal(d.page.title, "Mercury");
  assert.equal(d.senses[1].url, "https://en.wikipedia.org/wiki/Mercury_(element)");
  assert.equal(sensesLine(d), "Mercury can mean: Freddie Mercury, Mercury (element), Mercury (planet), Mercury Records");
});

test("disambiguationOf: a term whose exact title is a real ARTICLE (Paris) is not flagged; neither is one with no exact page", () => {
  assert.equal(disambiguationOf("paris", PARIS), null);
  assert.equal(disambiguationOf("mercury", MERCURY.slice(1)), null, "no exact-title page");
  assert.equal(disambiguationOf("mercury", []), null);
  assert.equal(disambiguationOf("mercury", MERCURY.slice(0, 2)), null, "fewer than two senses is not an ambiguity");
  assert.equal(disambiguationOf("", MERCURY), null);
});

test("sensesLine: non-English asks get a language-neutral line; the list is capped and marked", () => {
  const d = disambiguationOf("mercury", MERCURY, { max: 2 });
  assert.equal(d.senses.length, 2); assert.equal(d.more, true);
  assert.equal(sensesLine(d, { english: false }), "Mercury · Freddie Mercury, Mercury (element) …");
  assert.equal(sensesLine(null), "");
});
