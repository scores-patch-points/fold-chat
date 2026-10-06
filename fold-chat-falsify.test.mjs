// fold-chat-falsify.test.mjs — the search that tries to refute a candidate answer. Hand-written rows (the contract's examples);
// the network step is a stub. FALSIFIERS are marked: each one fails if the claim it guards is wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { probesFor, judge, runFalsify, askTense, parseLifespan, firstParenthetical, sameFiller, DECLARED } from "./fold-chat-falsify.js";

const NOW = { year: 2026 };
const FIX = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/probes.json", import.meta.url), "utf8"));

const FRAME = { ok: true, lang: "en", said: "Who is the king of the UK?", slot: "person",
  referents: [{ surface: "UK", title: "United Kingdom", aliases: ["UK", "United Kingdom"] }], predicate: [{ surface: "king", stem: "king" }], gap: null };
const src = (ref, title, url) => ({ ref, title, url, host: "en.wikipedia.org", lang: "en" });
const CHARLES_ROW = { tier: "T1", sentence: "Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded to the throne on 8 September 2022.",
  source: src("S1", "Monarchy of the United Kingdom", "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom"), span: [0, 120], polarity: "+", tense: "present",
  filler: { text: "Charles III", span: [0, 11] }, emphasis: [[0, 11]] };
const ELIZABETH_ROW = { tier: "T1", sentence: "Elizabeth II is the queen of the United Kingdom, reigning since 1952.",
  source: src("S2", "Old page", "https://en.wikipedia.org/wiki/Old_page"), span: [0, 60], polarity: "+", tense: "present",
  filler: { text: "Elizabeth II", span: [0, 12] }, emphasis: [[0, 12]] };
const T2_ROW = { tier: "T2", sentence: "The United Kingdom has a long history of monarchs.", source: src("S3", "History", "https://en.wikipedia.org/wiki/History"), span: [0, 40], polarity: "+", tense: "present", filler: null, emphasis: [] };
const NEG_ROW = { tier: "T1", sentence: "The United Kingdom has no king at present.", source: src("S4", "Constitution", "https://en.wikipedia.org/wiki/Constitution"), span: [0, 40], polarity: "-", tense: "present", filler: null, emphasis: [] };

const CHARLES_LEAD = { title: "Charles III", url: "https://en.wikipedia.org/wiki/Charles_III", extract: FIX.cases.find((c) => c.id === "charles-born").lead.extract };
const ELIZABETH_LEAD = FIX.cases.find((c) => c.id === "elizabeth-to").lead;

const cand = (row) => ({ filler: row.filler, row });
const run = (row, rows, over = {}) => runFalsify({ candidate: cand(row), frame: FRAME, rows, now: NOW, ...over });

test("the life-dates probe's query names the filler (the C9 falsifier) and nothing else", () => {
  const ps = probesFor(cand(CHARLES_ROW), FRAME, { now: NOW, rows: [CHARLES_ROW] });
  const life = ps.find((p) => p.kind === "life-dates");
  assert.ok(life, "a present-tense person ask gets a life-dates probe");
  assert.equal(life.query, "Charles III");
  assert.match(life.query, /Charles III/);
  assert.equal(life.network, true);
  assert.ok(ps.filter((p) => !p.network).every((p) => p.query === null), "local probes issue no query");
  assert.deepEqual(ps.map((p) => p.kind), ["life-dates", "rival-holder", "negation", "later-date"]);
});

test("FALSIFIER: a death year at or before now refutes a CURRENT-holder claim, and the refuting passage is the page's own words", async () => {
  const r = await run(ELIZABETH_ROW, [ELIZABETH_ROW, CHARLES_ROW], { fetchLead: async () => ELIZABETH_LEAD });
  assert.equal(r.standing, "refuted");
  const ref = r.refuters.find((x) => x.probe.kind === "life-dates");
  assert.ok(ref);
  assert.match(ref.why, /died in 2022/);
  assert.match(ref.why, /can't be the current holder/);
  assert.ok(ELIZABETH_LEAD.extract.includes(ref.passage.text), "the passage is verbatim from the lead");
  assert.match(ref.passage.text, /Elizabeth II \(1926 to 8 September 2022\)/);
  assert.equal(ref.passage.url, ELIZABETH_LEAD.url);
  assert.equal(ref.passage.title, "Elizabeth II");
  assert.ok(!r.survived.some((s) => /Elizabeth II's page/.test(s)), "a refuted probe is not also listed as survived");
});

test("FALSIFIER: a living person '(born 1948)' survives the life-dates probe", async () => {
  const r = await run(CHARLES_ROW, [CHARLES_ROW, T2_ROW], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r.standing, "survived");
  assert.deepEqual(r.refuters, []);
  assert.ok(r.survived.some((s) => /Charles III's page gives 1948 and no death date/.test(s)), r.survived.join(" | "));
});

test("FALSIFIER: '(1948–)' (a year then a dash with nothing after) does not refute", async () => {
  const lead = FIX.cases.find((c) => c.id === "open-range-1948").lead;
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => lead });
  assert.equal(r.standing, "survived");
  assert.deepEqual(r.refuters, []);
});

test("FALSIFIER: a probe whose fetchLead returns null is UNMEASURED, never survived; zero runnable probes -> standing 'unmeasured'", async () => {
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => null });
  assert.equal(r.queries.length, 1, "the lookup was attempted");
  assert.equal(r.standing, "unmeasured");
  assert.deepEqual(r.survived, []);
  assert.ok(r.unmeasured.length >= 1);
  assert.match(r.unmeasured.join(" "), /could not read a page for “Charles III”/);
  const life = r.checks.find((k) => k.probe.kind === "life-dates");
  assert.equal(life.outcome, "unmeasured");
  // no pool at all
  const r2 = await runFalsify({ candidate: cand(CHARLES_ROW), frame: FRAME, now: NOW, fetchLead: async () => null });
  assert.equal(r2.standing, "unmeasured");
  assert.ok(r2.checks.every((k) => k.outcome === "unmeasured"));
});

test("a lookup that throws, or that is stopped by the signal, is unmeasured — and an aborted signal issues no query", async () => {
  const thrown = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => { throw new Error("502"); } });
  assert.equal(thrown.standing, "unmeasured");
  const ac = new AbortController(); ac.abort();
  let calls = 0;
  const pre = await run(CHARLES_ROW, [CHARLES_ROW], { signal: ac.signal, fetchLead: async () => { calls++; return CHARLES_LEAD; } });
  assert.equal(calls, 0);
  assert.deepEqual(pre.queries, []);
  assert.equal(pre.standing, "unmeasured");
  // aborted while in flight: fetchLead never settles on its own
  const ac2 = new AbortController();
  const p = run(CHARLES_ROW, [CHARLES_ROW], { signal: ac2.signal, fetchLead: () => new Promise(() => {}) });
  setTimeout(() => ac2.abort(), 5);
  const mid = await p;
  assert.equal(mid.standing, "unmeasured");
  assert.match(mid.unmeasured.join(" "), /stopped/);
});

test("fetchLead is handed the signal, and the turn never issues more than the declared number of network queries", async () => {
  const seen = [];
  const ac = new AbortController();
  await run(CHARLES_ROW, [CHARLES_ROW], { signal: ac.signal, fetchLead: async (q, o) => { seen.push([q, o && o.signal === ac.signal]); return CHARLES_LEAD; } });
  assert.deepEqual(seen, [["Charles III", true]]);
  assert.equal(DECLARED.maxQueries, 3);
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => CHARLES_LEAD });
  assert.ok(r.queries.length <= DECLARED.maxQueries);
});

test("FALSIFIER: a rival row with a different filler gives 'contested' and BOTH rows are kept (never a silent pick)", async () => {
  const r = await run(ELIZABETH_ROW, [ELIZABETH_ROW, CHARLES_ROW], { fetchLead: async () => null, current: true });
  assert.equal(r.standing, "contested");
  assert.equal(r.contest.length, 2);
  assert.ok(r.contest.includes(ELIZABETH_ROW) && r.contest.includes(CHARLES_ROW));
  const rival = r.refuters.find((x) => x.probe.kind === "rival-holder");
  assert.equal(rival.passage.text, CHARLES_ROW.sentence);
  assert.equal(rival.passage.title, "Monarchy of the United Kingdom");
  assert.match(rival.why, /Charles III/);
});

test("a rival's alias is not a rival: 'King Charles III' and 'Charles III' name the same holder", async () => {
  const alias = { ...CHARLES_ROW, sentence: "King Charles III is the monarch of the United Kingdom.", filler: { text: "King Charles III", span: [0, 16] }, source: src("S9", "Other", "https://x/other") };
  const r = await run(CHARLES_ROW, [CHARLES_ROW, alias], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r.standing, "survived");
  assert.ok(sameFiller("Charles III", "King Charles III"));
  assert.ok(!sameFiller("Charles II", "Charles III"), "two different regnal numbers are two holders");
});

test("a past-tense row is a former holder, not a rival, for a CURRENT ask; for a non-current ask it is", async () => {
  const former = { ...ELIZABETH_ROW, tense: "past", sentence: "Elizabeth II was the queen of the United Kingdom until 2022." };
  const cur = await run(CHARLES_ROW, [CHARLES_ROW, former], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(cur.standing, "survived", "a former holder does not contest the present one");
  const past = await runFalsify({ candidate: cand(CHARLES_ROW), frame: { ...FRAME, said: "Who was the king?" }, rows: [CHARLES_ROW, former], now: NOW, fetchLead: async () => { throw new Error("no network for a past ask"); } });
  assert.equal(past.standing, "contested");
  assert.deepEqual(past.queries, [], "a past ask runs no life-dates query");
});

test("negation: a '-' row for the same frame is a contest with both rows kept; a '-' row about someone else is not", async () => {
  const r = await run(CHARLES_ROW, [CHARLES_ROW, NEG_ROW], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r.standing, "contested");
  assert.ok(r.contest.includes(CHARLES_ROW) && r.contest.includes(NEG_ROW));
  assert.equal(r.refuters.find((x) => x.probe.kind === "negation").passage.text, NEG_ROW.sentence);
  const other = { ...NEG_ROW, filler: { text: "Elizabeth II", span: [0, 12] }, sentence: "Elizabeth II is not the king." };
  const r2 = await run(CHARLES_ROW, [CHARLES_ROW, other], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r2.standing, "survived");
});

test("later-date: a different filler dated after the candidate's row is reported as later", async () => {
  const r = await run(ELIZABETH_ROW, [ELIZABETH_ROW, CHARLES_ROW], { fetchLead: async () => null, current: true });
  const later = r.refuters.find((x) => x.probe.kind === "later-date");
  assert.ok(later, "the 2022 row is later than the 1952 row");
  assert.match(later.why, /later than 1952/);
  // an earlier-dated rival is a rival, not a later one
  const older = { ...ELIZABETH_ROW, sentence: "George VI is the king of the United Kingdom, reigning since 1936.", filler: { text: "George VI", span: [0, 9] }, source: src("S7", "Older", "https://x/older") };
  const r2 = await run(CHARLES_ROW, [CHARLES_ROW, older], { fetchLead: async () => CHARLES_LEAD });
  assert.ok(!r2.refuters.some((x) => x.probe.kind === "later-date"));
  assert.ok(r2.refuters.some((x) => x.probe.kind === "rival-holder"));
});

test("the survived list is plain words and counts the other sources it looked in", async () => {
  const more = { ...T2_ROW, source: src("S5", "Another", "https://x/another") };
  const r = await run(CHARLES_ROW, [CHARLES_ROW, T2_ROW, more], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r.standing, "survived");
  assert.ok(r.survived.includes("no other holder found in the other 2 sources"), r.survived.join(" | "));
  assert.ok(r.survived.includes("no source says otherwise in the other 2 sources"));
  assert.deepEqual(r.unmeasured, []);
});

test("survived with a check that could not be run lists it under 'unmeasured' (it is said, not hidden)", async () => {
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => CHARLES_LEAD });
  assert.equal(r.standing, "survived");
  assert.ok(r.unmeasured.some((s) => /no other source to compare/.test(s)), r.unmeasured.join(" | "));
});

test("tense: only a PRESENT ask about a person gets a life-dates probe; a past ask or a non-person slot does not", () => {
  const kinds = (frame, o) => probesFor(cand(CHARLES_ROW), frame, { now: NOW, rows: [CHARLES_ROW], ...o }).map((p) => p.kind);
  assert.ok(kinds(FRAME).includes("life-dates"));
  assert.ok(!kinds({ ...FRAME, said: "Who was the king?" }).includes("life-dates"));
  assert.ok(!kinds({ ...FRAME, said: "Who wrote Hamlet?" }).includes("life-dates"), "no copula: a death says nothing about it");
  assert.ok(!kinds({ ...FRAME, slot: "place" }).includes("life-dates"));
  assert.ok(kinds({ ...FRAME, said: "Who wrote Hamlet?" }, { current: true }).includes("life-dates"), "the caller may say it is a current ask");
  assert.ok(!kinds(FRAME, { current: false }).includes("life-dates"));
  assert.equal(askTense({ lang: "en", said: "Who's the king?" }), "present");
  assert.equal(askTense({ lang: "en", said: "Who is the king, and who was the last?" }), "past");
});

test("FALSIFIER: a language with no declared tense table yields an UNMEASURED life-dates probe — no query, no English guess", async () => {
  const frame = { ...FRAME, lang: "xx", said: "Quis est rex?" };
  const ps = probesFor(cand(CHARLES_ROW), frame, { now: NOW, rows: [CHARLES_ROW] });
  const life = ps.find((p) => p.kind === "life-dates");
  assert.ok(life && life.unmeasured);
  let calls = 0;
  const r = await runFalsify({ candidate: cand(CHARLES_ROW), frame, rows: [CHARLES_ROW], now: NOW, fetchLead: async () => { calls++; return CHARLES_LEAD; } });
  assert.equal(calls, 0);
  assert.deepEqual(r.queries, []);
  assert.equal(r.checks.find((k) => k.probe.kind === "life-dates").outcome, "unmeasured");
  assert.equal(r.standing, "unmeasured");
});

test("the fixture table: every lead is read the way the fixture says (shape-based, per-language word lists only where declared)", () => {
  assert.ok(FIX.cases.length >= 15);
  for (const c of FIX.cases) {
    const probe = probesFor({ filler: { text: c.filler } }, { lang: c.lang, said: "x", slot: "person" }, { now: FIX.now, rows: [], current: true }).find((p) => p.kind === "life-dates");
    const j = judge({ filler: { text: c.filler } }, [{ probe, lead: c.lead }], { now: FIX.now });
    const k = j.checks[0];
    assert.equal(k.outcome, c.expect.outcome, `${c.id}: ${k.outcome} (${k.reason || k.text || k.why})`);
    if (c.expect.deathYear) assert.equal(k.deathYear, c.expect.deathYear, c.id);
    if (c.expect.outcome === "unmeasured") assert.notEqual(j.standing, "survived", `${c.id} must not survive`);
  }
});

test("parseLifespan / firstParenthetical: the shapes", () => {
  assert.deepEqual(parseLifespan("1926 – 2022", "en"), { kind: "range", birth: 1926, death: 2022 });
  assert.deepEqual(parseLifespan("1948–", "en"), { kind: "open", birth: 1948 });
  assert.deepEqual(parseLifespan("born 1948", "en"), { kind: "born", birth: 1948 });
  assert.equal(parseLifespan("born 1948, king since 2022", "en").kind, "unreadable");
  assert.equal(parseLifespan("a nickname", "en").kind, "none");
  assert.equal(parseLifespan("Saint-Denis 1926 in Saint-Denis, 2022", "en").kind, "unreadable", "a hyphen inside a word is not a range");
  assert.deepEqual(firstParenthetical("A (b (c) d) e (f)").inner, "b (c) d");
  assert.equal(firstParenthetical("x".repeat(400) + " (1926–2022)"), null, "a parenthesis far from the start is not the life-dates one");
  assert.equal(firstParenthetical("no parens"), null);
});

test("the unmeasured check names what could not be checked, in plain words", async () => {
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => ({ title: "Charles III", url: "u", extract: "Charles III is King." }) });
  assert.match(r.unmeasured.join(" "), /whether Charles III is still living: the opening of that page gives no dates I can read/);
  assert.notEqual(r.standing, "survived");
});

test("a lead for a different page (disambiguation) is unmeasured, not a refutation of the right person", async () => {
  const spain = FIX.cases.find((c) => c.id === "wrong-page-for-the-name").lead;
  const r = await run(CHARLES_ROW, [CHARLES_ROW], { fetchLead: async () => spain });
  assert.notEqual(r.standing, "refuted");
  assert.match(r.unmeasured.join(" "), /not clearly about “Charles III”/);
});

test("NO CASE LOGIC: the module contains no capital-letter class, uppercase property or upper-casing call", () => {
  const code = fs.readFileSync(new URL("./fold-chat-falsify.js", import.meta.url), "utf8");
  for (const bad of ["[A-" + "Z]", "\\p{L" + "u}", "\\p{L" + "t}", "toUpper" + "Case", "isUpper" + "Case", "toLocaleUpper" + "Case"]) assert.ok(!code.includes(bad), `found ${bad}`);
  // and it does not import the witness (built in parallel)
  assert.ok(!/fold-chat-witness/.test(code));
});

test("judge is pure: the same results give the same verdict, and it does not mutate the candidate or rows", async () => {
  const rows = Object.freeze([Object.freeze(CHARLES_ROW), Object.freeze(ELIZABETH_ROW)]);
  const a = await run(ELIZABETH_ROW, rows, { fetchLead: async () => ELIZABETH_LEAD });
  const b = await run(ELIZABETH_ROW, rows, { fetchLead: async () => ELIZABETH_LEAD });
  assert.deepEqual(a.standing, b.standing);
  assert.deepEqual(a.survived, b.survived);
  assert.deepEqual(a.refuters.map((x) => x.why), b.refuters.map((x) => x.why));
});

test("no candidate filler -> no probes, and judging nothing is 'unmeasured'", () => {
  assert.deepEqual(probesFor({}, FRAME, { now: NOW, rows: [] }), []);
  assert.equal(judge({}, [], { now: NOW }).standing, "unmeasured");
});
