// fold-chat-attribution.test.mjs — the model may never name a source the page did not give it (II.9),
// and never shows the fold's own source-block scaffolding ([W1] …).
import test from "node:test";
import assert from "node:assert/strict";
import { stripScaffolding, checkAttributions, attributionNotice, sourceIdentities } from "./fold-chat-attribution.js";

const WEATHER = [{
  ref: "weather.com — Weather Forecast and Conditions for Seattle, Washington - The Weather Channel | Weather.com",
  url: "https://weather.com/weather/today/l/Seattle", source: "https://weather.com/weather/today/l/Seattle",
  text: "Seattle, WA weather. Sign in to see the forecast. Cookies policy applies to this website and all its content.",
}];
const WIKI = [{
  ref: "Wikipedia — Tokyo", url: "https://en.wikipedia.org/wiki/Tokyo", source: "https://en.wikipedia.org/wiki/Tokyo",
  text: "Tokyo is the capital and most populous city of Japan. The population of the Tokyo metropolis was 14 million people in 2021. Tokyo hosted the Summer Olympics in 1964.",
}];

// ── stripScaffolding ──────────────────────────────────────────────────────
test("stripScaffolding: [W#] / [S#] / [M] / 'in [W1]' never reach the person", () => {
  const r = stripScaffolding("According to the information provided in [W1], the population of Tokyo in 2021 was 14 million [W2][S3]. Also see (W2) and [M].", WIKI.concat([{ ref: "A — B", url: "https://a.org/b" }]));
  assert.doesNotMatch(r.text, /\[[WSM]\d*\]|\(W2\)/);
  assert.match(r.text, /According to the information provided, the population of Tokyo in 2021 was 14 million\./);
  assert.ok(r.removed >= 4);
});

test("stripScaffolding: the passages the model pointed at come back as real citations (title, link, domain), once each", () => {
  const r = stripScaffolding("It is large [W1]. It is old [W1, W2].", [{ ref: "Wikipedia — Tokyo", url: "https://en.wikipedia.org/wiki/Tokyo" }, { ref: "x — Edo", url: "https://x.org/edo" }]);
  assert.deepEqual(r.cited.map((c) => [c.n, c.title, c.domain]), [["W1", "Tokyo", "en.wikipedia.org"], ["W2", "Edo", "x.org"]]);
  assert.equal(r.cited[0].url, "https://en.wikipedia.org/wiki/Tokyo");
});

test("stripScaffolding: a marker for a source that does not exist is removed but cited as nothing; plain text is untouched", () => {
  const r = stripScaffolding("Fine [W9].", WIKI);
  assert.equal(r.text, "Fine.");
  assert.deepEqual(r.cited, []);
  const t = "Nothing to strip here, not even [brackets] or a note about W3C.";
  assert.equal(stripScaffolding(t, WIKI).text, t);
  assert.equal(stripScaffolding("", []).text, "");
});

// ── checkAttributions ─────────────────────────────────────────────────────
test("FABRICATED ATTRIBUTION: 'According to The Weather Channel' when no such source was read is neutralised", () => {
  const r = checkAttributions("According to The Weather Channel, today's weather in Seattle is not available.", { sources: [] });
  assert.equal(r.text, "Today's weather in Seattle is not available.");
  assert.equal(r.removed[0].name, "The Weather Channel"); assert.equal(r.removed[0].reason, "not-a-source");
});

test("a source that WAS read does not license a claim it does not make (the measured 2026-10-05 case)", () => {
  const r = checkAttributions("According to The Weather Channel, today's weather in Seattle is not available.", { sources: WEATHER });
  assert.equal(r.text, "Today's weather in Seattle is not available.");
  assert.equal(r.removed[0].reason, "not-supported-by-source");
});

test("a named attribution that the named source DOES support is kept", () => {
  const r = checkAttributions("According to Wikipedia, the population of the Tokyo metropolis was 14 million people in 2021.", { sources: WIKI });
  assert.equal(r.removed.length, 0); assert.deepEqual(r.kept, ["Wikipedia"]);
  assert.match(r.text, /^According to Wikipedia,/);
});

test("the shapes: 'X says', 'per X', 'as reported by X', mid-sentence and trailing 'according to X'", () => {
  const none = { sources: [] };
  assert.equal(checkAttributions("Wikipedia says that Tokyo has 14 million people.", none).text, "Tokyo has 14 million people.");
  assert.equal(checkAttributions("Per the BBC, Tokyo is large.", none).text, "Tokyo is large.");
  assert.equal(checkAttributions("Tokyo is large, according to the BBC.", none).text, "Tokyo is large.");
  assert.equal(checkAttributions("Tokyo is large, as reported by Reuters.", none).text, "Tokyo is large.");
  assert.equal(checkAttributions("The city is huge — according to CNN — and old.", none).removed[0].name, "CNN");
});

test("other languages: según / selon / laut / по данным / 根据", () => {
  const none = { sources: [] };
  assert.equal(checkAttributions("Según Wikipedia, la capital es París.", none).text, "La capital es París.");
  assert.equal(checkAttributions("Selon Le Monde, la capitale est Paris.", none).text, "La capitale est Paris.");
  assert.equal(checkAttributions("Laut Spiegel ist die Hauptstadt Berlin.", none).removed[0].name, "Spiegel");
  assert.equal(checkAttributions("По данным Интерфакс, столица — Москва.", none).text, "Столица — Москва.");
  assert.equal(checkAttributions("根据百度百科的报道，东京人口很多。", none).text, "东京人口很多。");
});

test("a 'Source:' line keeps only the sources that were actually read", () => {
  const r = checkAttributions("Tokyo is big.\nSources: Wikipedia, BBC, Reuters", { sources: WIKI });
  assert.match(r.text, /Sources: Wikipedia$/m);
  assert.deepEqual(r.removed.map((x) => x.name).sort(), ["BBC", "Reuters"]);
  assert.equal(checkAttributions("Tokyo is big.\nSources: BBC", { sources: WIKI }).text.trim(), "Tokyo is big.");
});

test("generic references need something read; names the PERSON typed are theirs; pronouns and plural nouns are not sources", () => {
  assert.equal(checkAttributions("According to the information provided, Tokyo is big.", { sources: WIKI }).removed.length, 0);
  assert.equal(checkAttributions("According to the information provided, Tokyo is big.", { sources: [] }).text, "Tokyo is big.");
  assert.equal(checkAttributions("According to Sarah, the move is in May.", { sources: [], userText: "my friend Sarah is moving in May" }).removed.length, 0);
  const t = "Studies show that sleep helps. He says that it works. Experts say it is true.";
  assert.equal(checkAttributions(t, { sources: [] }).text, t);
});

test("a name that occurs in the text that was read is kept only if the claim is supported there", () => {
  const sources = [{ ref: "Wikipedia — Relativity", url: "https://en.wikipedia.org/wiki/Relativity", text: "Albert Einstein published the theory of general relativity in 1915, and the theory changed physics." }];
  assert.equal(checkAttributions("According to Einstein, the theory of general relativity was published in 1915.", { sources }).removed.length, 0);
  const r = checkAttributions("According to Einstein, pancakes are delicious.", { sources });
  assert.equal(r.removed[0].reason, "not-supported-by-source"); assert.equal(r.text, "Pancakes are delicious.");
});

test("never throws and never mangles clean text", () => {
  for (const t of ["", "Plain answer. No attribution at all.", "```python\nprint('according to X')\n```", null, undefined]) assert.doesNotThrow(() => checkAttributions(t, { sources: WIKI }));
  assert.equal(checkAttributions("Plain answer.", { sources: WIKI }).text, "Plain answer.");
});

test("attributionNotice: one typed notice naming what was removed and why; null when nothing was", () => {
  assert.equal(attributionNotice([]), null);
  const n = attributionNotice([{ name: "The Weather Channel", reason: "not-supported-by-source" }, { name: "BBC", reason: "not-a-source" }]);
  assert.equal(n.kind, "attribution"); assert.match(n.text, /The Weather Channel/); assert.match(n.text, /BBC/); assert.match(n.text, /not in that source's text/);
  assert.ok(attributionNotice([{ name: "X", reason: "not-a-source" }]).text.includes("no such source was read"));
});

test("sourceIdentities: title pieces, site, and the registrable domain label", () => {
  const [id] = sourceIdentities(WEATHER);
  for (const n of ["weather channel", "weather.com", "weather"]) assert.ok(id.names.some((x) => x.replace(/^the /, "") === n), n + " in " + id.names.join("|"));
});
