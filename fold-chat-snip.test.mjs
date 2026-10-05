import { test } from "node:test";
import assert from "node:assert/strict";
import { TIP, SNIP_LIMITS, snipOfPassage, recipeSnips, creditLine, metaLine, CARD_PROMPT } from "./fold-chat-snip.js";

const R = { name: "My Favorite Banana Bread", author: "Sally McKenney", publisher: "Sally's Baking Addiction", yield: "1", prep: "10 min", cook: "1 h 5 min", total: "3 h", calories: "", ingredients: ["2 cups (250g) all-purpose flour", "1 teaspoon baking soda"], steps: ["Preheat the oven to 350°F.", "Whisk the dry ingredients."] };
const P = (url, recipe = R) => ({ ref: "x — T", url, source: url, text: "t", recipe });
const fixed = { now: () => "2026-10-05T00:00:00.000Z" };

test("a snip carries the page's own words unchanged, who made it, where it is, and when it was snipped", () => {
  const s = snipOfPassage(P("https://www.sallysbakingaddiction.com/best-banana-bread-recipe/"), fixed);
  assert.equal(s.kind, "recipe"); assert.equal(s.verbatim, true);
  assert.deepEqual(s.ingredients, R.ingredients); assert.deepEqual(s.steps, R.steps);
  assert.equal(s.title, "My Favorite Banana Bread");
  assert.equal(s.url, "https://www.sallysbakingaddiction.com/best-banana-bread-recipe/");
  assert.equal(s.credit.site, "sallysbakingaddiction.com");
  assert.equal(s.snippedAt, "2026-10-05T00:00:00.000Z");
});

test("a passage with no declared recipe makes no snip (control: nothing is invented, no empty card)", () => {
  assert.equal(snipOfPassage({ url: "https://a.test/", text: "prose" }), null);
  assert.equal(snipOfPassage(P("https://a.test/", { name: "x", ingredients: [], steps: [] })), null);
  assert.equal(snipOfPassage(null), null);
});

test("recipeSnips: one per page, in the order read, capped", () => {
  const ps = [P("https://a.test/1"), P("https://a.test/1"), { url: "https://b.test/", text: "no recipe" }, P("https://a.test/2"), P("https://a.test/3"), P("https://a.test/4")];
  const out = recipeSnips(ps, fixed);
  assert.deepEqual(out.map((s) => s.url), ["https://a.test/1", "https://a.test/2", "https://a.test/3"]);
  assert.equal(out.length, SNIP_LIMITS.maxSnips);
});

test("a recipe over the cap keeps whole items and says it was cut — never a half step", () => {
  const big = { ...R, steps: Array.from({ length: 200 }, (_, i) => "Step number " + i + " " + "x".repeat(100)) };
  const s = snipOfPassage(P("https://a.test/", big), fixed);
  assert.equal(s.truncated, true);
  assert.ok(s.steps.length < 200);
  assert.ok(s.steps.every((x) => /^Step number \d+ x{100}$/.test(x)));
});

test("creditLine: the creator first, the site after; never an invented creator", () => {
  assert.equal(creditLine(snipOfPassage(P("https://www.sallysbakingaddiction.com/x"), fixed)), "Recipe by Sally McKenney · Sally's Baking Addiction");
  assert.equal(creditLine(snipOfPassage(P("https://food.test/x", { ...R, author: "", publisher: "" }), fixed)), "Recipe from food.test");
  assert.equal(creditLine(snipOfPassage(P("https://a.test/x", { ...R, author: "Ann", publisher: "Ann" }), fixed)), "Recipe by Ann · a.test", "an author who is also the publisher is not named twice");
  assert.equal(creditLine(null), "Recipe");
});

test("metaLine leaves out what the page did not declare", () => {
  assert.equal(metaLine(snipOfPassage(P("https://a.test/"), fixed)), "Makes 1 · Prep 10 min · Cook 1 h 5 min · Total 3 h");
  assert.equal(metaLine({ yield: "", prep: "", cook: "", total: "", calories: "" }), "");
});

test("the tip wording says it is in development and that nothing is sent; the model is told not to retype the recipe", () => {
  assert.match(TIP.status, /in development/i);
  assert.match(TIP.status, /email draft/i);
  assert.match(TIP.status, /nothing is paid or sent/i);
  assert.match(CARD_PROMPT, /Do NOT write out, retype/);
});
