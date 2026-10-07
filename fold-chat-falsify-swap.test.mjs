// node --test fold-chat-falsify-swap.test.mjs — the swap test must be able to PASS a right claim, and must not
// fail one for want of a rival. Falsified 2026-10-06: it swapped "246.3" for "8" (already in the claim, "8 ft 1 in")
// and a person's name for "Polish"/"Turkish" (an adjective in the same sentence), so it could never pass those.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const P = (text) => ({ ref: "x", source: "https://a.example/x", url: "https://a.example/x", text });
const one = (claim, text) => falsifyAnswer([claim], [P(text)]).claims[0];

test("a figure with a real rival in the source passes: the wrong version no longer matches", () => {
  const c = one("Mount Everest is 8,849 metres tall.", "Mount Everest is 8,849 metres tall. K2 is 8,611 metres tall.");
  assert.equal(c.swap.armed, true); assert.equal(c.swap.discriminates, true); assert.equal(c.verdict, "held");
});
test("a name with a real rival in the source passes", () => {
  const c = one("Albert Einstein won the Nobel Prize in 1921.", "Albert Einstein won the Nobel Prize in 1921. Marie Curie won it in 1903.");
  assert.equal(c.swap.discriminates, true); assert.equal(c.verdict, "held");
});
test("a figure already inside the claim is never its own rival", () => {
  const c = one("The tallest woman ever was 246.3 cm (8 ft 1 in) tall.", "The tallest woman ever was Zeng Jinlian at 246.3 cm (8 ft 1 in) tall.");
  assert.notEqual(c.swap.to, "8"); assert.equal(c.verdict, "held");
});
test("an adjective or role is not a rival name: nothing to swap is not a failure", () => {
  for (const [claim, text] of [["Marie Curie won the Nobel Prize in 1903.", "Marie Curie, a Polish physicist, won the Nobel Prize in 1903."], ["Rumeysa Gelgi was the tallest woman ever.", "Rumeysa Gelgi is a Turkish advocate and the tallest living woman."]]) {
    const c = one(claim, text); assert.equal(c.swap.armed, false); assert.equal(c.verdict, "held");
  }
});
test("a source that cannot tell two names apart still fails the claim", () => {
  const c = one("Marie Curie won the Nobel Prize in 1903.", "Marie Curie and Henri Becquerel won the Nobel Prize in 1903.");
  assert.equal(c.swap.armed, true); assert.equal(c.swap.discriminates, false); assert.equal(c.verdict, "weak");
});
test("a name in the stating sentence in another role is not a rival (\"recognised by Guinness World Records\")", () => {
  const c = one("Rumeysa Gelgi was the tallest woman ever.", "Rumeysa Gelgi is a Turkish advocate. Since 2021, she has been the tallest living woman recognised by Guinness World Records. Guinness World Records lists Zeng Jinlian too.");
  assert.notEqual(c.swap.to, "Guinness World Records");
});
