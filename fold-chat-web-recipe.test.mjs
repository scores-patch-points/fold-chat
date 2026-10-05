import { test } from "node:test";
import assert from "node:assert/strict";
import { entitiesOf, contentTerms, applyGate, recipeFromHtml, readText, searchWeb, EFFORT, looksBlocked } from "./fold-chat-web.js";

const resp = (body, { ok = true, status = 200 } = {}) => ({
  ok, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

test("entitiesOf: a sentence opener or contraction is never a name (the recipe ask read nothing because of 'What's')", () => {
  assert.deepEqual(entitiesOf("What's a good recipe for banana bread?"), []);
  assert.deepEqual(entitiesOf("Where's the best pizza?"), []);
  assert.deepEqual(entitiesOf("How do I reverse a string in Python?"), ["Python"]);
  assert.deepEqual(entitiesOf("Who founded the city of Nashville, and when?"), ["Nashville"]);
  assert.deepEqual(entitiesOf("Tell me about Judy Liff in Nashville"), ["Judy Liff", "Nashville"]);
  assert.deepEqual(entitiesOf("Was Henderson's party the first?"), ["Henderson"], "a possessive keeps its stem");
});

test("contentTerms: content words, language-neutral, no names required", () => {
  assert.deepEqual(contentTerms("What's a good recipe for banana bread?"), ["recipe", "banana", "bread"]);
  assert.deepEqual(contentTerms("东京有多少人口？"), [], "a script with no such tokens asks nothing of a result");
  assert.ok(contentTerms("Cuál es la capital de Francia").includes("capital"));
});

const cand = (title, snippet, url) => ({ title, snippet, url: url || "https://x.test/" + title.length, source: "x.test", kind: "web" });

test("applyGate: an ask that names nothing is judged by its content words, and off-topic results are skipped", () => {
  const pool = [cand("Best Banana Bread Recipe", "Moist banana bread with ripe bananas and butter, easy and quick to make at home"), cand("U.S. Route 240", "Highway in the United States connecting two interstate routes across states"), cand("Banana Banana Bread", "A classic loaf; mash bananas, fold into batter and bake until golden brown")];
  const g = applyGate(pool, [], "What's a good recipe for banana bread?", { read: 3 });
  assert.equal(g.pool.length, 2);
  assert.equal(g.skippedOff, 1);
  assert.equal(g.fallback, false);
  assert.equal(g.why["no-content-word"], 1);
});

test("applyGate: a gate that would pass NOTHING falls back to the ranked list and says so", () => {
  const pool = [cand("Zebra migration", "Large herds cross the plains every year in search of grass and water"), cand("Volcano types", "Shield, cinder cone and composite volcanoes differ in shape and eruption style")];
  const g = applyGate(pool, [], "What's a good recipe for banana bread?", { read: 3 });
  assert.equal(g.fallback, true);
  assert.equal(g.pool.length, 2, "the ranked results are read instead of leaving the turn with nothing");
});

test("applyGate: with named entities the swarm gate still decides (control: it must still reject)", () => {
  const pool = [cand("Nashville, Tennessee", "Nashville is the capital of Tennessee and a music centre"), cand("Photosynthesis", "Plants convert light into chemical energy in chloroplasts for growth")];
  const g = applyGate(pool, ["Nashville"], "Who founded Nashville?", { read: 3 });
  assert.equal(g.pool.length, 1);
  assert.match(g.pool[0].title, /Nashville/);
});

const LD = (obj) => `<html><head><title>R</title><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body><p>${"filler ".repeat(40)}</p></body></html>`;

test("recipeFromHtml: schema.org Recipe in a graph, with sections and steps, becomes plain text", () => {
  const html = LD({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "Site" }, { "@type": ["Recipe", "Thing"], name: "Banana Bread", recipeYield: ["1", "1 loaf"], prepTime: "PT15M", cookTime: "PT1H5M", totalTime: "PT1H20M", nutrition: { calories: "230 calories" }, recipeIngredient: ["3 ripe bananas", "1 1/2 cups flour &amp; salt"], recipeInstructions: [{ "@type": "HowToSection", name: "Batter", itemListElement: [{ "@type": "HowToStep", text: "Mash the bananas." }, { "@type": "HowToStep", text: "Mix with flour." }] }, { "@type": "HowToStep", text: "Bake at 350F." }] }] });
  const t = recipeFromHtml(html);
  assert.match(t, /^Recipe: Banana Bread/);
  assert.match(t, /Yield: 1/);
  assert.match(t, /Prep 15 min · Cook 1 h 5 min · Total 1 h 20 min/);
  assert.match(t, /Calories: 230 calories/);
  assert.match(t, /- 3 ripe bananas/);
  assert.match(t, /- 1 1\/2 cups flour & salt/);
  assert.match(t, /1\. Mash the bananas\.\n2\. Mix with flour\.\n3\. Bake at 350F\./);
});

test("recipeFromHtml: no recipe, broken JSON, or a recipe with nothing in it → empty string (control)", () => {
  assert.equal(recipeFromHtml("<html><body>no data</body></html>"), "");
  assert.equal(recipeFromHtml('<script type="application/ld+json">{ not json</script>'), "");
  assert.equal(recipeFromHtml(LD({ "@type": "Article", name: "A post" })), "");
  assert.equal(recipeFromHtml(LD({ "@type": "Recipe", name: "Empty" })), "");
  assert.equal(recipeFromHtml(LD([{ "@type": "Recipe", name: "In array", recipeIngredient: ["x"] }])).startsWith("Recipe: In array"), true);
});

test("readText: a recipe page's structured recipe comes FIRST in the text", async () => {
  const html = LD({ "@type": "Recipe", name: "Pancakes", recipeIngredient: ["2 eggs", "1 cup milk"], recipeInstructions: "Whisk. Fry." });
  const rd = await readText("https://good.test/p", { fetchImpl: async () => resp(html) });
  assert.equal(rd.ok, true);
  assert.ok(rd.text.startsWith("Recipe: Pancakes"), rd.text.slice(0, 60));
  assert.match(rd.text, /- 2 eggs/);
});

function webFetch({ blocked = [], good = [], results }) {
  return async (url) => {
    const u = decodeURIComponent(url);
    if (/\/search\?scope=web/.test(u)) return resp({ scope: "web", engine: "DuckDuckGo", count: results.length, results });
    if (blocked.some((b) => u.includes(b))) return resp("", { ok: false, status: 402 });
    if (good.some((g) => u.includes(g))) return resp(LD({ "@type": "Recipe", name: "Banana Bread", recipeIngredient: ["3 bananas", "flour"], recipeInstructions: ["Mash", "Bake"] }));
    return resp({}, { ok: false, status: 500 });
  };
}
const RES = (n, label) => Array.from({ length: n }, (_, i) => ({ title: `${label} ${i + 1} banana bread recipe`, url: `https://${label}${i + 1}.test/banana-bread`, snippet: `A tested banana bread recipe number ${i + 1} with ripe bananas, butter and flour, ready in an hour`, source: `${label}${i + 1}.test`, kind: "web", meta: "" }));

test("searchWeb: failed reads are REPLACED by the next candidates until enough succeed", async () => {
  const want = EFFORT.balanced.read; // the effort level, not the caller, decides how many pages are read
  const results = [...RES(3, "blocked"), ...RES(want, "good")];
  const f = webFetch({ blocked: ["blocked"], good: ["good"], results });
  const out = await searchWeb("What's a good recipe for banana bread?", { fetchImpl: f, effort: "balanced", scopes: ["web"] });
  assert.equal(out.passages.length, want, JSON.stringify(out.trace).slice(0, 500));
  assert.ok(out.passages.every((p) => /good\d\.test/.test(p.url)), "every kept passage is a page that was actually read");
  assert.ok(out.passages.every((p) => p.text.startsWith("Recipe: Banana Bread")));
  assert.ok(!out.passages.some((p) => p.snippetOnly));
});

test("searchWeb: nothing readable is not nothing found — the snippets stand, labelled as snippets", async () => {
  const f = webFetch({ blocked: ["blocked"], good: [], results: RES(4, "blocked") });
  const out = await searchWeb("What's a good recipe for banana bread?", { fetchImpl: f, read: 2, effort: "balanced", scopes: ["web"] });
  assert.ok(out.passages.length >= 1 && out.passages.length <= 3);
  assert.ok(out.passages.every((p) => p.snippetOnly === true && p.via === "snippet"));
  assert.ok(out.trace.some((t) => t.snippet));
});

test("searchWeb: no results at all stays empty (control: snippets are never invented)", async () => {
  const f = webFetch({ results: [] });
  const out = await searchWeb("What's a good recipe for banana bread?", { fetchImpl: f, read: 2, effort: "balanced", scopes: ["web"] });
  assert.equal(out.passages.length, 0);
});

test("looksBlocked: a short block page is recognised; a real long page and a short real page are not", () => {
  assert.equal(looksBlocked("<p>If you are a reader experiencing an access issue, please contact support@people.inc</p>"), true);
  assert.equal(looksBlocked("Just a moment... Checking your browser"), true);
  assert.equal(looksBlocked("x".repeat(9000) + " captcha"), false, "a long page that merely mentions a captcha is a page");
  assert.equal(looksBlocked("Example Domain. This domain is for use in illustrative examples."), false);
});

test("readText: a 200 block page from a proxy is a FAILED read, never page text", async () => {
  const f = async (url) => { if (/^https:\/\/paywalled\.test/.test(url)) throw new Error("CORS"); return resp("<p>If you are a reader experiencing an access issue, please contact support@people.inc</p>"); };
  const rd = await readText("https://paywalled.test/p", { fetchImpl: f });
  assert.equal(rd.ok, false);
});
