// fold-chat-witness.js — the grammar of the PASSAGE: sentences, and which ones bind to the frame of the ask. Pure; the title service is stubbed.
// Fixtures: eval/falsify/fixtures/tierA/rows.json (SYNTHETIC, labelled so there).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sentencesOf, bindSentence } from "./fold-chat-witness.js";
import { askFrame, caseless, stemOf } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { verifySnip } from "./fold-chat-strand.js";

const FW = functionWordsOf("en");
const FIX = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const byId = (id) => FIX.cases.find((c) => c.id === id);
const frameOf = (c) => askFrame(c.ask, { fw: FW, lang: "en", resolveTitles: async (cands) => new Map(cands.map((x) => [x, c.titles[caseless(x)] ?? null])) });
const SRC = (p, i) => ({ ref: "S" + (i + 1), title: p.title, url: p.url, host: "en.wikipedia.org", lang: "en" });
const bind = (frame, text, opts = {}) => bindSentence({ text, start: 0, end: text.length }, frame, { fw: FW, lang: "en", ...opts });
const rowsOf = (frame, pages, opts = {}) => pages.flatMap((p, i) => sentencesOf(p.text).map((s) => ({ page: p, row: bindSentence(s, frame, { fw: FW, lang: "en", source: SRC(p, i), ...opts }) })).filter((x) => x.row));
// a frame written by hand (so a test does not depend on the ask reader)
const mk = (slot, referents, predicate = []) => ({ ok: true, lang: "en", said: "", slot, gap: null,
  referents: referents.map(([surface, title]) => ({ surface, title, aliases: [...new Set([surface, title])] })), predicate: predicate.map((w) => ({ surface: w, stem: stemOf(caseless(w), "en") })) });

test("sentencesOf: sentences with UTF-16 offsets that slice back exactly; a line break and 。 end one; a decimal point does not", () => {
  const text = "Charles III is the king. He lives in London now.\nA second line stays apart. 東京は日本の首都です。次の文。 The tower is 3.5 m tall.";
  const ss = sentencesOf(text);
  assert.ok(ss.length >= 6, JSON.stringify(ss.map((s) => s.text)));
  for (const s of ss) { assert.equal(text.slice(s.start, s.end), s.text); assert.ok(s.text.trim() === s.text && s.text.length); }
  assert.ok(ss.some((s) => s.text === "He lives in London now."));
  assert.ok(ss.some((s) => s.text === "The tower is 3.5 m tall."));
  assert.ok(ss.some((s) => s.text === "東京は日本の首都です。"));
  assert.deepEqual(sentencesOf(""), []); assert.deepEqual(sentencesOf(null), []);
});

test("every fixture page binds to exactly the expected rows (tier, polarity, tense, filler), in order", async () => {
  for (const c of FIX.cases) {
    const frame = await frameOf(c);
    const got = rowsOf(frame, c.pages);
    assert.equal(got.length, c.expectedRows.length, c.id + ": " + JSON.stringify(got.map((g) => [g.row.tier, g.row.sentence.slice(0, 50)])));
    c.expectedRows.forEach((e, k) => {
      const r = got[k].row;
      assert.ok(r.sentence.startsWith(e.sentenceStart), c.id + " row " + k + ": " + r.sentence);
      assert.equal(r.tier, e.tier, c.id + " " + e.sentenceStart);
      assert.equal(r.polarity, e.polarity, c.id + " " + e.sentenceStart);
      assert.equal(r.tense, e.tense, c.id + " " + e.sentenceStart);
      assert.equal(r.filler ? r.filler.text : null, e.filler, c.id + " " + e.sentenceStart);
      assert.deepEqual(r.fillerCandidates ? r.fillerCandidates.map((x) => x.text) : undefined, e.fillerCandidates, c.id + " " + e.sentenceStart);
    });
  }
});

test("the page topic (opt-in) lets a sentence that leaves the place unsaid bind — and says nothing without it", async () => {
  const c = byId("A4");
  const frame = await frameOf(c);
  const plain = rowsOf(frame, c.pages).map((x) => x.row.sentence.slice(0, 30));
  assert.equal(plain.length, c.expectedRows.length);
  assert.ok(!plain.some((s) => /Andy Burnham|current prime minister/.test(s)));
  const topical = rowsOf(frame, c.pages, { topic: c.topic });
  assert.equal(topical.length, c.expectedRowsWithTopic.length);
  c.expectedRowsWithTopic.forEach((e, k) => { const r = topical[k].row; assert.ok(r.sentence.startsWith(e.sentenceStart)); assert.equal(r.tier, e.tier); assert.equal(r.filler ? r.filler.text : null, e.filler); });
  assert.equal(rowsOf(frame, c.pages, { topic: "Something Else Entirely" }).length, c.expectedRows.length, "an unrelated topic carries nothing");
});

test("Row is exactly the contract's shape, and its offsets re-verify against the passage (strand.verifySnip)", async () => {
  for (const c of FIX.cases) {
    const frame = await frameOf(c);
    for (const { page, row } of rowsOf(frame, c.pages)) {
      assert.deepEqual(Object.keys(row).filter((k) => k !== "fillerCandidates").sort(), ["emphasis", "filler", "polarity", "sentence", "source", "span", "tense", "tier"], c.id);
      assert.ok(row.tier === "T1" || row.tier === "T2");
      assert.equal(page.text.slice(row.span[0], row.span[1]), row.sentence, c.id);
      assert.ok(verifySnip({ text: row.sentence }, { text: page.text }), c.id + " verifySnip");
      assert.equal(row.source.title, page.title); assert.match(row.source.ref, /^S\d+$/); assert.equal(row.source.host, "en.wikipedia.org");
      if (row.filler) assert.equal(row.sentence.slice(row.filler.span[0], row.filler.span[1]), row.filler.text, c.id);
      for (const [a, b] of row.emphasis) { assert.ok(a >= 0 && b > a && b <= row.sentence.length, c.id); }
      if (row.filler) assert.ok(row.emphasis.some(([a, b]) => a <= row.filler.span[0] && b >= row.filler.span[1]), c.id + ": the filler is drawn bold");
      assert.ok(row.emphasis.length >= 1, c.id);
      const sorted = [...row.emphasis].sort((x, y) => x[0] - y[0]);
      assert.deepEqual(row.emphasis, sorted); sorted.forEach((s, k) => { if (k) assert.ok(s[0] >= sorted[k - 1][1], c.id + ": emphasis spans do not overlap"); });
    }
  }
});

test("FALSIFIER: the UK-president ask against the US and France presidency pages has ZERO rows of any tier", async () => {
  const c = byId("A2");
  assert.equal(rowsOf(await frameOf(c), c.pages).length, 0);
});

test("FALSIFIER: 'The war began in 1939' does not bind the predicate 'end'; the World War II lead binds the referent but is T2, never a witness", async () => {
  const c = byId("A8");
  const frame = await frameOf(c);
  assert.equal(bind(frame, "The war began in 1939 with the invasion of Poland."), null);
  const began = bind(frame, "World War II began in 1939 when Germany invaded Poland.");
  assert.equal(began.tier, "T2"); assert.equal(began.filler, null);
  const lead = rowsOf(frame, c.pages);
  assert.equal(lead.length, 1); assert.equal(lead[0].row.tier, "T2"); assert.equal(lead[0].row.filler, null);
  assert.ok(!lead.some((x) => x.row.tier === "T1"));
});

test("FALSIFIER: a sentence with the referent but the wrong predicate is T2, not T1 (and one without the referent is nothing)", async () => {
  const frame = await frameOf(byId("A6"));
  const wrong = bind(frame, "Canberra is a city in Australia.");
  assert.equal(wrong.tier, "T2"); assert.equal(wrong.filler, null);
  assert.equal(bind(frame, "The capital is Canberra."), null, "the referent 'Australia' is not in the sentence");
  assert.equal(bind(frame, "The Australian capital is Canberra."), null, "'Australian' is another word, not a stem of 'Australia'");
  assert.equal(bind(frame, "Canberra is the capital city of Australia.").tier, "T1");
});

test("FALSIFIER: tense is read from the sentence's own copula and NOTHING else decides — the CALLER does (past 'Louis XVI was the last king' / forged present 'Louis XVI is the king')", async () => {
  const frame = await frameOf(byId("A3"));
  const past = bind(frame, "Louis XVI was the last king of France.");
  assert.equal(past.tier, "T1"); assert.equal(past.tense, "past"); assert.equal(past.polarity, "+"); assert.equal(past.filler.text, "Louis XVI");
  const forged = bind(frame, "Louis XVI is the king of France.");
  assert.equal(forged.tier, "T1"); assert.equal(forged.tense, "present"); assert.equal(forged.filler.text, "Louis XVI");
  assert.notEqual(past.tense, forged.tense, "the two rows differ in tense, which is all that separates them");
});

test("FALSIFIER: an alias NOT in the sentence binds through the resolved title ('UK' in the ask, 'United Kingdom' in the page — and the reverse)", async () => {
  const frame = await frameOf(byId("A1b"));
  assert.deepEqual(frame.referents[0].aliases.map(caseless).sort(), ["uk", "united kingdom"]);
  const viaTitle = bind(frame, "Charles III is the king of the United Kingdom.");
  assert.equal(viaTitle.tier, "T1"); assert.equal(viaTitle.filler.text, "Charles III");
  assert.ok(!/\bUK\b/.test(viaTitle.sentence));
  const viaSurface = bind(frame, "Charles III is the king of the UK.");
  assert.equal(viaSurface.tier, "T1"); assert.equal(viaSurface.filler.text, "Charles III");
  assert.equal(bind(frame, "Charles III is the king of the United States."), null);
});

test("no case is read: an ALL-CAPS and an all-lowercase passage bind the same, the filler as written", async () => {
  const frame = await frameOf(byId("A1b"));
  const up = bind(frame, "CHARLES III IS THE KING OF THE UNITED KINGDOM."), lo = bind(frame, "charles iii is the king of the united kingdom.");
  for (const r of [up, lo]) { assert.equal(r.tier, "T1"); assert.equal(r.tense, "present"); assert.equal(r.polarity, "+"); }
  assert.equal(up.filler.text, "CHARLES III"); assert.equal(lo.filler.text, "charles iii");
});

test("stems are folded: 'ended/ends/ending' meet 'end', 'Spiders' meets 'spider' — and 'kingdom' is not 'king', 'began' is not 'end'", async () => {
  const f8 = await frameOf(byId("A8"));
  for (const v of ["ended", "ends", "ending", "end"]) assert.equal(bind(f8, `World War II ${v} in 1945.`).tier, "T1", v);
  assert.equal(bind(f8, "World War II began in 1945.").tier, "T2");
  const f1 = await frameOf(byId("A1b"));
  assert.equal(bind(f1, "The United Kingdom is a kingdom.").tier, "T2", "'kingdom' does not witness 'king'");
});

test("polarity is read from a declared negation closed class — token by token, never a substring", async () => {
  const frame = await frameOf(byId("A1b"));
  const pol = (t) => bind(frame, t).polarity;
  assert.equal(pol("Charles III is the king of the United Kingdom."), "+");
  assert.equal(pol("Charles III is not the king of the United Kingdom."), "-");
  assert.equal(pol("The United Kingdom doesn't have a king."), "-");
  assert.equal(pol("The United Kingdom has no king."), "-");
  assert.equal(pol("The United Kingdom never had a king."), "-");
  assert.equal(pol("Charles III is known as the king of the United Kingdom now."), "+", "'known' and 'now' contain 'no' but are not negations");
  assert.equal(pol("Charles III is the king of the United Kingdom and nothing changes that."), "-");
});

test("tense comes from a declared copula/aux set: is/are/am/has/have → present, was/were/had → past, will/shall → future, else unknown", async () => {
  const frame = mk("person", [["United Kingdom", "United Kingdom"]], ["king"]);
  const t = (s) => bind(frame, s).tense;
  assert.equal(t("Charles III is the king of the United Kingdom."), "present");
  assert.equal(t("Kings are the heads of the United Kingdom."), "present");
  assert.equal(t("The United Kingdom has a king."), "present");
  assert.equal(t("The United Kingdom have kings."), "present");
  assert.equal(t("The king was the head of the United Kingdom."), "past");
  assert.equal(t("Kings were rulers of the United Kingdom."), "past");
  assert.equal(t("The United Kingdom had a king."), "past");
  assert.equal(t("A new king will rule the United Kingdom."), "future");
  assert.equal(t("A new king shall rule the United Kingdom."), "future");
  assert.equal(t("The king ruled the United Kingdom."), "unknown");
  assert.equal(t("The king was crowned in the United Kingdom and is its head."), "past", "the first copula/aux decides");
});

test("person filler: the COPULA-SIDE rule — the side that does not carry the referent is the filler, trimmed at the first clause boundary", async () => {
  const frame = await frameOf(byId("A1b"));
  const f = (t) => { const r = bind(frame, t); return r && r.filler ? r.filler.text : null; };
  assert.equal(f("Charles III is the king of the United Kingdom."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III, who acceded in 2022."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III who acceded in 2022."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III since 2022."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III (born 1948)."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III; he acceded in 2022."), "Charles III");
  assert.equal(f("The king of the United Kingdom is Charles III having acceded in 2022."), "Charles III");
  assert.equal(f("The king of the United Kingdom is the one that acceded."), "the one");
  assert.equal(f("Charles III, born in 1948, is the king of the United Kingdom."), "Charles III");
  assert.equal(f("Charles III is the king of the United Kingdom, having acceded in 2022."), "Charles III");
});

test("FALSIFIER: both sides carry the referent → filler null; no copula → filler null; a filler that is only function words ('It') → null", async () => {
  const frame = await frameOf(byId("A1b"));
  const both = bind(frame, "The king of the United Kingdom is the head of state of the United Kingdom.");
  assert.equal(both.tier, "T1"); assert.equal(both.filler, null);
  assert.equal(bind(frame, "The United Kingdom has had no king since 1066.").filler, null);
  assert.equal(bind(frame, "It is the king of the United Kingdom.").filler, null);
  assert.equal(bind(frame, "Charles III reigns as king of the United Kingdom.").filler, null, "no copula: no filler is guessed");
});

test("quantity filler: the number (digits or numeral words) NEAREST the predicate stem; numbers inside the referent are not fillers", () => {
  const frame = mk("quantity", [["spider", "Spider"]], ["legs"]);
  const f = (t) => { const r = bind(frame, t); return r && r.filler ? r.filler.text : null; };
  assert.equal(f("Spiders have eight legs."), "eight");
  assert.equal(f("A spider has 2 eyes and 8 legs."), "8");
  assert.equal(f("A spider with 8 legs and 2 eyes."), "8");
  assert.equal(f("Spiders have legs, and there are twenty-one of them... no, eight."), "twenty-one");
  assert.equal(f("A spider has two hundred legs."), "two hundred");
  assert.equal(f("A spider has 1,082 legs."), "1,082");
  assert.equal(f("A spider has 3.5 legs."), "3.5");
  assert.equal(f("Spiders have legs."), null, "no number, no filler");
  const wars = mk("quantity", [["World War 2", "World War II"]], ["casualties"]);
  const r = bind(wars, "World War 2 caused 70 million casualties.");
  assert.equal(r.filler.text, "70 million");
  assert.equal(bind(wars, "World War 2 had casualties.").filler, null, "the '2' of the referent is not a quantity");
});

test("time filler: the year in the sentence; SEVERAL years are reported as candidates and the filler is left null; a day of the month is not a year", () => {
  const frame = mk("time", [["World War 2", "World War II"]], ["end"]);
  const one = bind(frame, "World War II ended with the formal surrender of Japan on 2 September 1945.");
  assert.equal(one.tier, "T1"); assert.equal(one.filler.text, "1945"); assert.equal(one.fillerCandidates, undefined);
  const many = bind(frame, "World War II began in 1939 and ended in 1945.");
  assert.equal(many.filler, null); assert.deepEqual(many.fillerCandidates.map((x) => x.text), ["1939", "1945"]);
  for (const c of many.fillerCandidates) assert.equal(many.sentence.slice(c.span[0], c.span[1]), c.text);
  const none = bind(frame, "World War II ended on a hot day.");
  assert.equal(none.filler, null); assert.equal(none.fillerCandidates, undefined);
  const inRef = bind(mk("time", [["Apollo 1969", "Apollo 1969"]], ["end"]), "Apollo 1969 ended in 1972.");
  assert.equal(inRef.filler.text, "1972", "a year inside the referent is not the answer");
});

test("place and thing fillers use the same copula-side rule", () => {
  const thing = mk("thing", [["Australia", "Australia"]], ["capital"]);
  assert.equal(bind(thing, "Canberra is the capital city of Australia.").filler.text, "Canberra");
  assert.equal(bind(thing, "The capital city of Australia is Canberra.").filler.text, "Canberra");
  const place = mk("place", [["Eiffel Tower", "Eiffel Tower"]], ["located"]);
  assert.equal(bind(place, "The Eiffel Tower is located in Paris, France.").filler.text, "located in Paris");
});

test("emphasis: the filler and the matched referent and predicate words, as sentence offsets", async () => {
  const frame = await frameOf(byId("A6"));
  const r = bind(frame, "Canberra is the capital city of Australia.");
  const bold = r.emphasis.map(([a, b]) => r.sentence.slice(a, b));
  assert.deepEqual(bold, ["Canberra", "capital", "Australia"]);
  const t2 = bind(frame, "Canberra is a city in Australia.");
  assert.deepEqual(t2.emphasis.map(([a, b]) => t2.sentence.slice(a, b)), ["Australia"]);
});

test("a frame that is not ok, or a language with no declared table, binds nothing (never an English guess)", async () => {
  assert.equal(bind({ ...mk("person", [["UK", "United Kingdom"]]), ok: false, gap: { kind: "frame_unread" } }, "The UK is a country."), null);
  assert.equal(bind(null, "The UK is a country."), null);
  assert.equal(bind({ ...mk("person", [["UK", "United Kingdom"]]), lang: "fr" }, "Le UK est un pays.", { lang: "fr" }), null);
  assert.equal(bindSentence(null, mk("person", [["UK", "UK"]]), { fw: FW }), null);
});

test("with no predicate in the frame, every referent group in ONE sentence suffices; two groups in two sentences do not", async () => {
  const frame = await frameOf(byId("A1"));            // referents King + UK, no predicate
  assert.equal(frame.predicate.length, 0);
  assert.equal(bind(frame, "Charles III is the king of the United Kingdom.").tier, "T1");
  assert.equal(bind(frame, "The United Kingdom is a country."), null, "one of two referent groups is not enough for any row");
  assert.equal(bind(frame, "A king is a ruler."), null);
});

test("the source object the caller passes rides on the row untouched", async () => {
  const frame = await frameOf(byId("A1b"));
  const source = { ref: "S7", title: "X", url: "https://e.org/x", host: "e.org", lang: "en" };
  const r = bindSentence({ text: "Charles III is the king of the United Kingdom.", start: 10, end: 57 }, frame, { fw: FW, lang: "en", source });
  assert.deepEqual(r.source, source); assert.deepEqual(r.span, [10, 57]);
});
