// The question frame is shed from an encyclopedia query without losing what the ask is ABOUT (fold-chat-frame.js). Pure.
import test from "node:test";
import assert from "node:assert/strict";
import { stripFrame, askFrame, GRAMMAR, caseless } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { resolveTitlesWikipedia } from "./fold-chat-titles.js";
import fs from "node:fs";

const FW = functionWordsOf("en");

test("the frame of a question is cut from the front; the topic is kept as the person wrote it", () => {
  assert.equal(stripFrame("Who is the king of the UK?", FW), "king of the UK");
  assert.equal(stripFrame("What is the capital of Australia?", FW), "capital of Australia");
  assert.equal(stripFrame("Who is the prime minister of the UK?", FW), "prime minister of the UK");
});

test("FALSIFIER: no prior, no cut — a language the khora holds no function words for is returned exactly as said", () => {
  assert.equal(stripFrame("Who is the king of the UK?", null), "Who is the king of the UK?");
  assert.equal(stripFrame("东京有多少人口？", FW), "东京有多少人口？");
  assert.equal(stripFrame("¿Cuál es la capital de Francia?", FW), "¿Cuál es la capital de Francia?");
});

test("FALSIFIER: never empties the ask and never leaves only function words (a name made of them is not a frame)", () => {
  for (const q of ["Who are The Who?", "Is it?", "What is it?", "Who is he?", "the", "", "   ", "?"]) {
    const out = stripFrame(q, FW);
    assert.ok(out === q.trim() || /[\p{L}\p{N}]/u.test(out), JSON.stringify(q) + " -> " + JSON.stringify(out));
    const words = out.replace(/[?!¿¡]+\s*$/u, "").split(/\s+/).filter(Boolean);
    assert.ok(!words.length || words.some((w) => !FW.has(w.toLowerCase())) || out === q.trim(), JSON.stringify(q) + " -> only function words: " + out);
  }
  assert.equal(stripFrame("Who are The Who?", FW), "Who are The Who?");
});

test("FALSIFIER: only a question has a frame — a name or noun phrase with no question mark is untouched", () => {
  for (const q of ["The Who albums", "the king of the UK", "It follows", "Take That discography", "king of the UK"]) assert.equal(stripFrame(q, FW), q);
});

test("a question with no leading function word is returned exactly as said", () => {
  for (const q of ["How many legs does a spider have?", "Compare Canberra, Brasilia and Ottawa?", "Tell me about Nashville?"]) assert.equal(stripFrame(q, FW), q);
});

test("idempotent: stripping a stripped ask changes nothing", () => {
  for (const q of ["Who is the king of the UK?", "What is the capital of Australia?"]) { const a = stripFrame(q, FW); assert.equal(stripFrame(a, FW), a); }
});

// ── the Wikipedia scope uses the frame (fold-chat-web.js search) ────────────────────────────────────────────────────────
import { search } from "./fold-chat-web.js";
const hits = (titles) => ({ query: { search: titles.map((t) => ({ title: t, snippet: "", wordcount: 100 })) } });
const fakeFetch = (byQuery, log) => async (url) => {
  const q = decodeURIComponent((String(url).match(/srsearch=([^&]*)/) || [])[1] || "");
  log.push(q);
  const body = byQuery(q);
  if (body === "FAIL") throw new Error("down");
  return { ok: true, status: 200, json: async () => body };
};

test("the Wikipedia scope searches the ask AND its frame-shed form; the lists interleave, frame-shed first, deduplicated", async () => {
  const log = [];
  const out = await search("wikipedia", "Who is the king of the UK?", 0, { fetchImpl: fakeFetch((q) => q === "king of the UK" ? hits(["Monarchy of the United Kingdom", "Succession to the British throne"]) : hits(["The Kid Who Would Be King", "The Who", "Monarchy of the United Kingdom"]), log), lang: "en" });
  assert.deepEqual(log.sort(), ["Who is the king of the UK?", "king of the UK"].sort());
  assert.deepEqual(out.results.map((r) => r.title).slice(0, 4), ["Monarchy of the United Kingdom", "The Kid Who Would Be King", "Succession to the British throne", "The Who"]);
  assert.equal(new Set(out.results.map((r) => r.url)).size, out.results.length, "no duplicate page");
});

test("FALSIFIER: the frame-shed search failing leaves the ask's own results exactly as before (never worse than today)", async () => {
  const log = [];
  const out = await search("wikipedia", "Who is the king of the UK?", 0, { fetchImpl: fakeFetch((q) => q === "king of the UK" ? "FAIL" : hits(["The Kid Who Would Be King", "The Who"]), log), lang: "en" });
  assert.deepEqual(out.results.map((r) => r.title), ["The Kid Who Would Be King", "The Who"]);
});

test("FALSIFIER: an ask with no frame, and a language with no prior, make ONE Wikipedia search, as before", async () => {
  for (const [q, lang] of [["king of the UK", "en"], ["How many legs does a spider have?", "en"], ["东京有多少人口？", "zh"]]) {
    const log = [];
    await search("wikipedia", q, 0, { fetchImpl: fakeFetch(() => hits(["X"]), log), lang });
    assert.equal(log.length, 1, q + " → " + log.join(" | "));
  }
});

// ══ askFrame — the grammar of the ASK (docs/ANSWER-PIPELINE.md, Frame) ═════════════════════════════════════════════════
// The title service is stubbed with the SYNTHETIC tables of eval/falsify/fixtures/tierA/rows.json (labelled synthetic there).
const FIX = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const resolverFrom = (table, spy = []) => async (cands) => { spy.push(cands.slice()); return new Map(cands.map((c) => [c, table[caseless(c)] ?? null])); };
const resolveEverything = (spy = []) => async (cands) => { spy.push(cands.slice()); return new Map(cands.map((c) => [c, { title: c, redirectedFrom: null, disambiguation: false }])); };
const shape = (f) => ({ slot: f.slot, referents: f.referents.map((r) => [r.surface, r.title]), predicate: f.predicate.map((p) => p.stem) });
const frameOf = (c, spy) => askFrame(c.ask, { fw: FW, lang: "en", resolveTitles: resolverFrom(c.titles, spy) });
const tokensIn = (s) => s.match(/[\p{L}\p{N}]+/gu) || [];

test("the fixture is labelled synthetic", () => { assert.equal(FIX.synthetic, true); assert.match(FIX.label, /SYNTHETIC/); });

test("every fixture ask reads to its expected Frame, with ONE title call", async () => {
  for (const c of FIX.cases) {
    const spy = [];
    const f = await frameOf(c, spy);
    assert.equal(f.ok, true, c.id);
    assert.equal(f.gap, null, c.id);
    assert.equal(f.said, c.ask, c.id);
    assert.equal(f.lang, "en", c.id);
    assert.deepEqual(shape(f), c.expectedFrame, c.id + " " + JSON.stringify(f));
    assert.equal(spy.length, 1, c.id + ": exactly one resolveTitles call");
    assert.equal(new Set(spy[0]).size, spy[0].length, c.id + ": candidates are asked once each");
  }
});

test("a resolved title and its redirect give the referent its aliases ('UK' = 'United Kingdom', 'World War 2' = 'World War II')", async () => {
  const f1 = await frameOf(FIX.cases.find((c) => c.id === "A1"));
  const uk = f1.referents.find((r) => r.title === "United Kingdom");
  assert.deepEqual([...uk.aliases].sort(), ["UK", "United Kingdom"]);
  const f8 = await frameOf(FIX.cases.find((c) => c.id === "A8"));
  assert.deepEqual([...f8.referents[0].aliases].sort(), ["World War 2", "World War II"]);
});

test("the slot comes from the DECLARED interrogative table (giver named), not from the ask's capitals or any guess", async () => {
  assert.match(String(GRAMMAR.en.giver), /author/i);
  const R = resolveEverything();
  const want = [
    ["Who is the king of the UK?", "person"], ["Who's the king of the UK?", "person"], ["Whom did Lincoln appoint?", "person"],
    ["When did Lincoln die?", "time"], ["What year did Lincoln die?", "time"], ["In what year did Lincoln die?", "time"], ["What date was Lincoln born?", "time"],
    ["How many legs does a spider have?", "quantity"], ["How much sugar is in a cola?", "quantity"],
    ["Where is Canberra?", "place"], ["What is the capital of Australia?", "thing"], ["Which river is longest?", "thing"],
  ];
  for (const [q, slot] of want) assert.equal((await askFrame(q, { fw: FW, lang: "en", resolveTitles: R })).slot, slot, q);
});

test("an ask that is not a slot ask is not read as one: slot null, no gap, the title service is NOT called", async () => {
  const spy = [];
  for (const q of ["Tell me about spiders", "Is Paris the capital of France?", "king of the UK", "Compare Canberra and Ottawa"]) {
    const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles: resolveEverything(spy) });
    assert.equal(f.slot, null, q); assert.equal(f.gap, null, q); assert.equal(f.ok, false, q); assert.deepEqual(f.referents, [], q);
  }
  assert.equal(spy.length, 0);
});

test("FALSIFIER: a language with no declared grammar gets the typed gap no_grammar_for_language, never an English guess (zh / ar / hi / fr / es)", async () => {
  const asks = [["zh", "谁是英国的国王？"], ["ar", "من هو ملك المملكة المتحدة؟"], ["hi", "ब्रिटेन का राजा कौन है?"], ["fr", "Qui est le roi de France ?"], ["es", "¿Quién es el rey de España?"], ["en", "Who is the king of the UK?"]];
  for (const [lang, q] of asks) {
    const spy = [];
    const f = await askFrame(q, { fw: lang === "en" ? null : functionWordsOf(lang), lang, resolveTitles: resolveEverything(spy) });
    assert.equal(f.ok, false, lang); assert.equal(f.gap?.kind, "no_grammar_for_language", lang);
    assert.equal(f.slot, null, lang); assert.deepEqual(f.referents, [], lang); assert.deepEqual(f.predicate, [], lang);
    assert.equal(f.said, q, lang); assert.equal(spy.length, 0, lang + ": no title call for a language with no grammar");
  }
  // an unknown language (no code at all) is the same gap
  assert.equal((await askFrame("Who is the king of the UK?", { fw: FW, lang: undefined, resolveTitles: resolveEverything() })).gap?.kind, "no_grammar_for_language");
});

test("FALSIFIER: no capital letter is read — lowercase and ALL-CAPS asks read exactly as the ask as typed", async () => {
  for (const c of FIX.cases) {
    const base = shape(await frameOf(c));
    for (const q of [c.ask.toLocaleLowerCase("und"), c.ask.toLocaleUpperCase("und")]) {
      const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles: resolverFrom(c.titles) });
      assert.equal(f.ok, true, c.id + " " + q);
      assert.equal(f.slot, base.slot, c.id + " " + q);
      assert.deepEqual(f.referents.map((r) => r.title), base.referents.map((r) => r[1]), c.id + " " + q);
      assert.deepEqual(f.predicate.map((p) => p.stem), base.predicate, c.id + " " + q);
    }
  }
});

test("FALSIFIER: the source reads no case anywhere (no [A-Z] range, no \\p{Lu}, no upper-casing, no 'starts with a capital')", () => {
  for (const file of ["fold-chat-frame.js", "fold-chat-witness.js", "fold-chat-titles.js"]) {
    const code = fs.readFileSync(new URL("./" + file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const bad of [/A-Z/, /\\p\{Lu\}/, /\\p\{Lt\}/, /\\p\{Uppercase/, /Script_Extensions/, /toUpperCase|toLocaleUpperCase/, /isUpper|capital/i]) assert.ok(!bad.test(code), file + " matches " + bad);
  }
});

test("FALSIFIER: a function word is never a referent and never a predicate — even when the title service claims every run is a page", async () => {
  const asks = ["Who is the king of the UK?", "What is the capital of Australia?", "How many legs does a spider have?", "What year did World War 2 end?", "Who was the first president of the United States of America?", "Where is the tower of London in the city?", "Which of the two is it?"];
  for (const q of asks) {
    const spy = [];
    const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles: resolveEverything(spy) });
    for (const run of spy[0] || []) { const w = tokensIn(run).map((x) => caseless(x)); assert.ok(!FW.has(w[0]) && !FW.has(w[w.length - 1]), q + " asked a run with a function word at its edge: " + run); assert.ok(w.length <= 4, q + " asked a run longer than 4 tokens: " + run); }
    for (const r of f.referents) { const w = tokensIn(r.surface).map((x) => caseless(x)); assert.ok(!FW.has(w[0]) && !FW.has(w[w.length - 1]), q + " referent " + r.surface); }
    for (const p of f.predicate) assert.ok(!FW.has(caseless(p.surface)) && !FW.has(p.stem), q + " predicate " + p.surface);
    const used = new Set([...f.referents.flatMap((r) => tokensIn(r.surface)), ...f.predicate.map((p) => p.surface)].map(caseless));
    for (const w of ["is", "the", "of", "does", "did", "a", "was", "have"]) assert.ok(!used.has(w) || f.referents.some((r) => r.surface.split(/\s+/).slice(1, -1).map(caseless).includes(w)), q + ": '" + w + "' leaked");
  }
});

test("function words may sit INSIDE a run: 'king of the UK' is asked as one candidate, 'of the UK' and 'king of' are not", async () => {
  const spy = [];
  await askFrame("Who is the king of the UK?", { fw: FW, lang: "en", resolveTitles: resolveEverything(spy) });
  const asked = spy[0].map(caseless);
  assert.ok(asked.includes("king of the uk")); assert.ok(asked.includes("king")); assert.ok(asked.includes("uk"));
  assert.ok(!asked.includes("of the uk")); assert.ok(!asked.includes("king of")); assert.ok(!asked.includes("the king"));
});

test("runs never cross punctuation", async () => {
  const spy = [];
  await askFrame("Who is Charles III, king of the UK?", { fw: FW, lang: "en", resolveTitles: resolveEverything(spy) });
  assert.ok(spy[0].every((s) => !/[,;]/.test(s)), JSON.stringify(spy[0]));
  assert.ok(spy[0].includes("Charles III") && spy[0].includes("king of the UK"));
});

test("the LONGEST resolving non-overlapping runs win; a shorter run inside a taken one is not taken twice", async () => {
  const T = (t, r = null) => ({ title: t, redirectedFrom: r, disambiguation: false });
  const f = await askFrame("What year did World War 2 end?", { fw: FW, lang: "en", resolveTitles: resolverFrom({ "world war 2": T("World War II", "World War 2"), "world": T("World"), "war": T("War"), "world war": T("World war") }) });
  assert.deepEqual(f.referents.map((r) => r.title), ["World War II"]);
  assert.deepEqual(f.predicate.map((p) => p.stem), ["end"]);
});

test("title agreement: a long run whose redirect shares NO content word with it ('capital of Australia' → 'Canberra') does not swallow the role; a redirect that agrees does ('World War 2' → 'World War II')", async () => {
  const c = FIX.cases.find((x) => x.id === "A6");
  const f = await frameOf(c);
  assert.deepEqual(f.referents.map((r) => r.title), ["Australia"]);
  assert.deepEqual(f.predicate.map((p) => p.stem), ["capital"]);
});

test("a disambiguation page is not a referent (the word stays a predicate)", async () => {
  const f = await frameOf(FIX.cases.find((c) => c.id === "A8"));
  assert.deepEqual(f.predicate.map((p) => p.stem), ["end"]);
  assert.ok(!f.referents.some((r) => r.title === "End"));
});

test("FALSIFIER: 'Who are The Who?' does not produce an empty frame — it is the typed gap frame_unread, said kept, and no title call is made for words that name nothing", async () => {
  for (const q of ["Who are The Who?", "Who is he?", "What is it?", "Is it?"]) {
    const spy = [];
    const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles: resolveEverything(spy) });
    assert.equal(f.said, q);
    assert.ok(f.gap?.kind === "frame_unread" || f.slot === null, q + " -> " + JSON.stringify(f));
    if (/^(who|what)\b/i.test(q)) { assert.equal(f.gap?.kind, "frame_unread", q); assert.equal(f.ok, false); assert.ok(f.slot, "the slot is still read: " + q); }
    assert.equal(spy.length, 0, q);
    assert.ok(!(f.gap === null && f.slot !== null && !f.referents.length), q + ": an empty frame with no gap");
  }
});

test("FALSIFIER: a title-service failure is the gap referents_unresolved — never a throw, never an empty-but-ok frame", async () => {
  const q = "Who is the king of the UK?";
  const down = [
    async () => { throw new Error("offline"); },
    () => { throw new Error("sync"); },
    async () => { throw Object.assign(new Error("typed"), { kind: "titles_unavailable" }); },
    null, undefined,
    async () => null,
    async () => "not a map",
  ];
  for (const resolveTitles of down) {
    const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles });
    assert.equal(f.ok, false); assert.equal(f.gap?.kind, "referents_unresolved"); assert.equal(f.slot, "person"); assert.deepEqual(f.referents, []);
  }
  // through the REAL resolver with a dead network
  const f = await askFrame(q, { fw: FW, lang: "en", resolveTitles: (c) => resolveTitlesWikipedia(c, { fetchImpl: async () => { throw new TypeError("fetch failed"); } }) });
  assert.equal(f.gap?.kind, "referents_unresolved");
});

test("nothing resolving, or only disambiguation pages resolving, is referents_unresolved", async () => {
  assert.equal((await askFrame("Who is the king of the UK?", { fw: FW, lang: "en", resolveTitles: resolverFrom({}) })).gap?.kind, "referents_unresolved");
  const dis = { title: "King", redirectedFrom: null, disambiguation: true };
  assert.equal((await askFrame("Who is the king of the UK?", { fw: FW, lang: "en", resolveTitles: resolverFrom({ king: dis, uk: dis }) })).gap?.kind, "referents_unresolved");
});

test("the real resolver, driven by a stub fetch, gives a frame whose referents came from titles only", async () => {
  const fetchImpl = async (url) => {
    const t = (new URL(url).searchParams.get("titles") || "").split("|");
    const pages = {}; t.forEach((x, i) => { if (x === "UK") pages[i + 1] = { pageid: i + 1, ns: 0, title: "United Kingdom" }; else pages["-" + (i + 1)] = { ns: 0, title: x, missing: "" }; });
    return { ok: true, json: async () => ({ query: { redirects: [{ from: "UK", to: "United Kingdom" }], pages } }) };
  };
  const f = await askFrame("Who is the king of the UK?", { fw: FW, lang: "en", resolveTitles: (c) => resolveTitlesWikipedia(c, { fetchImpl }) });
  assert.equal(f.ok, true);
  assert.deepEqual(f.referents.map((r) => [r.surface, r.title]), [["UK", "United Kingdom"]]);
  assert.deepEqual(f.predicate.map((p) => p.stem), ["king"]);
});

test("stripFrame is untouched by the extension (its own tests above stay green)", () => { assert.equal(stripFrame("Who is the king of the UK?", FW), "king of the UK"); });
