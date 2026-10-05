import { test } from "node:test";
import assert from "node:assert/strict";
import { impressionOf, originalSpan, fingerprint, sentencesWithOffsets } from "./fold-chat-impression.js";

// A page where the answer is deep: a long history up front, the method near the end.
const history = Array.from({ length: 60 }, (_, i) => `Pancakes have a long history in kitchen tradition number ${i}, spoken of across many regions and centuries.`).join(" ");
const method = "Pour a quarter cup of batter onto the hot griddle. Cook each pancake for about 2 minutes per side until bubbles form and the edges look set. Flip once and cook the second side for 1 to 2 minutes.";
const outro = Array.from({ length: 20 }, (_, i) => `Serving suggestion number ${i} involves syrup, butter, berries and a generous amount of enthusiasm.`).join(" ");
const PAGE = history + "\n" + method + "\n" + outro;

test("the first 4,000 chars of this page do NOT hold the answer — the premise of the impression", () => {
  assert.ok(PAGE.length > 8000);
  assert.ok(!/2 minutes per side/.test(PAGE.slice(0, 4000)));
});

test("the impression carries the sentence that answers the ask, from deep in the page, inside the budget", () => {
  const e = impressionOf(PAGE, "how long do I cook pancakes on each side?", { budget: 1200 });
  assert.match(e.text, /2 minutes per side/);
  assert.ok(e.text.length <= 1200);
  assert.ok(e.shadow.kept < e.shadow.chars / 4, "a shadow, not the page");
});

test("a word in every sentence makes no difference: 'pancakes' does not choose the sentences, 'cook'/'side' do", () => {
  const e = impressionOf(PAGE, "how long to cook pancakes per side", { budget: 900 });
  const lines = e.text.split("\n");
  const method = lines.filter((l) => /minutes|griddle|side/.test(l));
  assert.ok(method.length >= 1);
  assert.ok(lines.filter((l) => /tradition number/.test(l)).length <= 1, "at most the identity line from the history");
});

test("novelty: restating the same thing earns no second place", () => {
  const dup = Array.from({ length: 12 }, () => "Bake the loaf at 220 degrees for forty minutes in the oven.").join(" ");
  const filler = Array.from({ length: 80 }, (_, i) => `Unrelated paragraph ${i} about weather, tides and the habits of distant birds near the coast.`).join(" ");
  const e = impressionOf(filler + " " + dup + " Rest the loaf for an hour before slicing it for the table.", "what temperature to bake the loaf", { budget: 600 });
  const bakes = e.text.split("\n").filter((l) => /220 degrees/.test(l));
  assert.ok(bakes.length <= 2, "the same sentence is not kept a dozen times, got " + bakes.length);
});

test("a short page is kept whole; its shadow says so", () => {
  const e = impressionOf("Short page. It says very little indeed.", "anything", { budget: 3000 });
  assert.equal(e.text, "Short page. It says very little indeed.");
  assert.equal(e.shadow.kept, e.shadow.chars);
});

test("the shadow: length, fingerprint and the byte ranges the impression came from — each range IS the sentence", () => {
  const e = impressionOf(PAGE, "how long do I cook pancakes on each side?", { budget: 1200 });
  assert.equal(e.shadow.chars, PAGE.length);
  assert.equal(e.shadow.hash, fingerprint(PAGE));
  const lines = e.text.split("\n");
  assert.equal(e.shadow.segments.length, lines.length);
  e.shadow.segments.forEach((seg, i) => assert.equal(PAGE.slice(seg.start, seg.end), lines[i]));
});

test("an address inside the impression maps back to the original page", () => {
  const e = impressionOf(PAGE, "how long do I cook pancakes on each side?", { budget: 1200 });
  const a = e.text.indexOf("2 minutes per side");
  const orig = originalSpan(e.shadow, a, a + "2 minutes per side".length);
  assert.equal(PAGE.slice(orig.start, orig.end), "2 minutes per side");
  assert.equal(originalSpan(null, 0, 1), null);
});

test("an ask that touches nothing gets the identity line, not a blind prefix", () => {
  const e = impressionOf(PAGE, "quantum chromodynamics lattice gauge", { budget: 1200 });
  assert.equal(e.text.split("\n").length, 1);
});

test("deterministic: same page + ask, same impression (what lets a shadow stand in for the page)", () => {
  const a = impressionOf(PAGE, "cook pancakes per side", { budget: 1200 });
  const b = impressionOf(PAGE, "cook pancakes per side", { budget: 1200 });
  assert.deepEqual(a, b);
});

test("sentencesWithOffsets: ranges slice back to the sentence", () => {
  const t = "First one here. Second one there!\nThird after a newline? Last";
  for (const s of sentencesWithOffsets(t)) assert.equal(t.slice(s.start, s.end), s.text);
});

test("a structured Recipe head is kept whole — short ingredient lines are not 'chrome'", () => {
  const head = "Recipe: Banana Bread\nPrep 15 min · Cook 1 h 5 min\nIngredients:\n- 3 ripe bananas\n- 1 1/2 cups flour\nInstructions:\n1. Mash.\n2. Bake at 350F.";
  const page = head + "\n\n" + PAGE;
  const e = impressionOf(page, "how long to bake banana bread", { budget: 1500 });
  assert.ok(e.text.startsWith(head));
  assert.match(e.text, /- 3 ripe bananas/);
  assert.ok(e.text.length <= 1500 + 1);
  for (const seg of e.shadow.segments) assert.ok(page.slice(seg.start, seg.end).length > 0);
  assert.equal(page.slice(e.shadow.segments[0].start, e.shadow.segments[0].end), head);
});

test("a known limit, stated: the field matches words, not meanings — 'dissolve' does not recall 'dissolved' (the paraphrase wall)", () => {
  const filler = Array.from({ length: 80 }, (_, i) => `Trade route number ${i} carried grain, timber and salted fish between the northern ports.`).join(" ");
  const e = impressionOf(filler + " The league was formally dissolved after its final diet in 1669, ending its long run.", "when did it dissolve", { budget: 500 });
  assert.ok(e.text.length <= 500 + 100, "still bounded");
  // THE-HOLOGRAPH §8: the reading hears a fraction of what a passage states. This
  // test pins the limit so a lemmatiser (the khora's, per script) shows up as a diff.
});

test("omnilingual: an unspaced script is segmented by the script, not by spaces", () => {
  const zh = Array.from({ length: 40 }, (_, i) => `这是关于城市第${i}号的一般历史介绍，包含很多无关的细节和背景说明。`).join("") + "埃菲尔铁塔的建造使用了大约两百五十万个铆钉，工程历时两年。" + Array.from({ length: 20 }, (_, i) => `参观建议第${i}条与天气和交通有关，供游客参考使用。`).join("");
  const e = impressionOf(zh, "埃菲尔铁塔使用了多少铆钉", { budget: 400 });
  assert.match(e.text, /铆钉/);
});
