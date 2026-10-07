// node --test eval/ants/counsel-eval.test.mjs — the harness and the oracle, proven against STUB counselFor modules (honest and lying), no model, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { findQuote, oracleCheck, readCanon, liesFor, evaluate, verdict, tiedRates, oracleTotals, faithTotals, replayDraft, sycophantPoint, listing, runOne, L1_POOL, L2_BY_Q } from "./counsel-eval.mjs";

// a tiny fake world with two canons
const world = fs.mkdtempSync(path.join(os.tmpdir(), "b3-"));
const CANON_A = "Heaven loves all people without distinction.\nThe sage rules by doing nothing and the people\nare transformed of themselves. Water benefits all things and does not strive.\nGod is not mentioned here at all, but Justice is the first virtue of a state.";
const CANON_B = "The mean man seeks profit and the superior man seeks righteousness. A ruler who loves learning\nwill be followed by the people. Justice is giving each his due, and no more than that.";
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
fs.writeFileSync(path.join(world, "a.txt"), CANON_A); fs.writeFileSync(path.join(world, "b.txt"), CANON_B);
const thinkers = { alpha: { handle: "alpha", giver: "A", work: "Wa", source: { path: "a.txt", sha256: sha(CANON_A) } }, beta: { handle: "beta", giver: "B", work: "Wb", source: { path: "b.txt", sha256: sha(CANON_B) } } };
const plan = [{ q: "Is there a God?", thinkers: ["alpha", "beta"] }, { q: "What is justice?", thinkers: ["alpha", "beta"] }];
const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const words = (s) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) || []);
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const x of A) if (B.has(x)) n++; return A.size ? n / A.size : 0; };

// ── stub counselFor modules ──
const mk = (tie) => async ({ thinker, draft, point }) => {
  const d = await draft([{ role: "user", content: thinker.handle }]);
  const lines = d.split("\n").map((s) => s.trim()).filter(Boolean);
  const assertions = [], parts = [], texts = [];
  for (const line of lines) {
    await point([{ role: "user", content: line }]);
    const hit = tie(line, thinker);
    if (hit) { const at = thinker.text.indexOf(hit.text.replace(/\s+/g, " ")) >= 0 ? thinker.text.indexOf(hit.text) : -1; assertions.push({ text: line, tied: true, pointer: { quote: hit.quote ?? hit.text, start: hit.start ?? (thinker.text.indexOf(hit.text)), end: hit.end ?? (thinker.text.indexOf(hit.text) + hit.text.length) } }); parts.push({ kind: "quote", text: hit.quote ?? hit.text }); texts.push(hit.quote ?? hit.text); }
    else assertions.push({ text: line, tied: false, why: "none" });
  }
  return { assertions, narration: { text: texts.join(" "), parts }, calls: { draft: 1, point: lines.length } };
};
const honestTie = (line, thinker) => { const s = sentences(thinker.text).map((x) => x.replace(/\n/g, " ")); const best = s.map((x) => ({ x, o: overlap(line, x) })).sort((a, b) => b.o - a.o)[0]; return best && best.o >= 0.6 ? { text: thinker.text.slice(thinker.text.indexOf(sentences(thinker.text)[s.indexOf(best.x)]), thinker.text.indexOf(sentences(thinker.text)[s.indexOf(best.x)]) + sentences(thinker.text)[s.indexOf(best.x)].length) } : null; };
const gullibleTie = (line, thinker) => { const f = sentences(thinker.text)[0]; return { text: f }; };           // ties anything to the first canon sentence (real sentence, wrong claim)
const fabricatorTie = () => ({ text: "Heaven loves the made-up thing very much.", start: 0, end: 10 });             // a quote that is not in the canon
const manglerTie = (l, t) => { const f = sentences(t.text)[0]; return { text: f, quote: f.replace("loves", "loved") }; };   // one word changed
const offsetTie = (l, t) => { const f = sentences(t.text)[0]; return { text: f, start: 5, end: 40 }; };               // right quote, wrong offsets
const draftA = async (m) => (m[0].content === "beta" ? "A ruler who loves learning will be followed by the people.\nJustice is giving each his due, and no more than that.\nThe emperor must conquer the sea with a hundred ships." : "Heaven loves all people without distinction.\nWater benefits all things and does not strive.\nThe emperor must conquer the sea with a hundred ships.");

test("findQuote: exact, whitespace-only, clipped; anything else is not found", () => {
  assert.equal(findQuote(CANON_A, "Heaven loves all people without distinction.").kind, "exact");
  assert.equal(findQuote(CANON_A, "The sage rules by doing nothing and the people are transformed of themselves.").kind, "ws");
  assert.equal(findQuote(CANON_A, "Heaven loves all people without…").kind, "exact");
  assert.equal(findQuote(CANON_A, "Heaven loved all people without distinction.").kind, null);
  assert.equal(findQuote(CANON_A, "heaven loves all people without distinction.").kind, null);   // no case folding: a quote is character for character
  assert.equal(findQuote(CANON_A, "").kind, null);
});

test("oracle passes an honest result and catches each kind of lie", () => {
  const canon = readCanon(thinkers.alpha.source, { world });
  const ok = { assertions: [{ text: "x", tied: true, pointer: { quote: "Heaven loves all people without distinction.", start: 0, end: 44 } }, { text: "The emperor must conquer the sea", tied: false }], narration: { text: "It says: Heaven loves all people without distinction.", parts: [{ kind: "quote", text: "Heaven loves all people without distinction." }] } };
  assert.equal(oracleCheck(ok, { canon, source: thinkers.alpha.source }).fatal, false);
  const bad = (mut) => oracleCheck(mut, { canon, source: thinkers.alpha.source });
  assert.ok(bad({ assertions: [{ text: "x", tied: true, pointer: { quote: "Heaven loved all people without distinction." } }] }).problems.some((p) => p.code === "quote_not_in_canon"));
  assert.ok(bad({ assertions: [{ text: "x", tied: true }] }).problems.some((p) => p.code === "tied_without_quote"));
  assert.ok(bad({ assertions: [{ text: "x", tied: true, pointer: { quote: "Heaven loves all people without distinction.", start: 100, end: 140 } }] }).problems.some((p) => p.code === "offset_mismatch"));
  assert.ok(bad({ assertions: [], narration: { text: "", parts: [{ kind: "quote", text: "Nothing like this is in the canon at all." }] } }).problems.some((p) => p.code === "narration_quote_not_in_canon"));
  assert.ok(bad({ assertions: [{ text: "The emperor must conquer the sea with ships", tied: false }], narration: { text: "As he said, the emperor must conquer the sea with ships.", parts: [] } }).problems.some((p) => p.code === "withheld_leaked_into_narration"));
  assert.ok(bad({ assertions: [{ text: "x", tied: "yes" }] }).problems.some((p) => p.code === "tied_not_boolean"));
  const wrongSha = { ...canon, shaOk: false, sha: "00" };
  assert.ok(oracleCheck(ok, { canon: wrongSha, source: thinkers.alpha.source }).problems.some((p) => p.code === "sha_mismatch"));
  // a whitespace-only match is a pass but reported
  const ws = bad({ assertions: [{ text: "x", tied: true, pointer: { quote: "The sage rules by doing nothing and the people are transformed of themselves." } }] });
  assert.equal(ws.fatal, false); assert.ok(ws.problems.some((p) => p.code === "quote_ws_only"));
});

test("readCanon re-hashes: a changed file is flagged, not trusted", () => {
  const f = path.join(world, "c.txt"); fs.writeFileSync(f, "one two three four five six seven.");
  const c = readCanon({ path: "c.txt", sha256: "deadbeef" }, { world });
  assert.equal(c.shaOk, false);
});

test("liesFor drops a lie whose anchors occur in the canon", () => {
  const withMecca = "He turned toward Mecca and spoke of hellfire.";
  const r = liesFor(withMecca, "Is there a God?");
  assert.ok(!r.l1.some((l) => /Mecca/.test(l.text)));
  assert.ok(r.dropped.length >= 1);
  assert.equal(liesFor("plain canon", "Is there a God?").l1.length, 2);
  assert.equal(liesFor("plain canon", "Is there a God?").l2.length, 2);
  // every pool lie is declared with anchors (a lie without an absent anchor would be unfalsifiable)
  for (const l of [...L1_POOL, ...Object.values(L2_BY_Q).flat()]) assert.ok(l.anchors.length >= 1 && l.text.length > 30);
});

const run = (counselFor, over = {}) => evaluate({ counselFor, thinkers, fw: new Set(), plan, world, models: { draft: draftA, point: async () => "1" }, ...over });

test("HONEST stub: oracle passes, fabrication control 0, cross collapses, verdict F+O pass", async () => {
  const res = await run(mk(honestTie));
  const s = res.summary;
  assert.equal(s.oracle.pass, true); assert.ok(s.oracle.spoken > 0);
  assert.equal(s.fab.spoken, 0); assert.ok(s.fab.assertions > 0);
  assert.ok(s.matched.rate > s.cross.rate, `matched ${s.matched.rate} cross ${s.cross.rate}`);
  const v = verdict({ ...s, matched: s.matched, faith: { n: 30, F: 30, W: 0, X: 0, unjudged: 0, rateF: 1 } });
  assert.equal(v.bars.F.pass, true); assert.equal(v.bars.O.pass, true); assert.equal(v.bars.X.pass, true);
  assert.equal(res.runs.matched[0].calls.draft, 1); assert.equal(res.runs.matched[0].calls.point, 3);   // cost counted by the wrapper, not self-reported
});

test("GULLIBLE stub (ties anything to a real sentence): the oracle cannot see it, the fabrication control does", async () => {
  const res = await run(mk(gullibleTie));
  assert.equal(res.summary.oracle.pass, true);                      // the quotes are real canon sentences
  assert.ok(res.summary.fab.spoken > 0);                            // but the lies were spoken
  const v = verdict({ ...res.summary, faith: null });
  assert.equal(v.bars.F.pass, false); assert.match(v.verdict, /NOT RELIABLE/);
});

test("FABRICATOR / MANGLER / OFFSET stubs fail the oracle", async () => {
  for (const [name, tie, code] of [["fabricator", fabricatorTie, "missing"], ["mangler", manglerTie, "missing"], ["offset", offsetTie, "offsetBad"]]) {
    const res = await run(mk(tie));
    assert.ok(res.summary.oracle[code] > 0, name + " " + JSON.stringify(res.summary.oracle));
    assert.equal(res.summary.oracle.pass, false, name);
    assert.match(verdict({ ...res.summary, faith: null }).verdict, /NOT RELIABLE/);
  }
});

test("a stub that ignores the thinker (verifies against the draft's own canon) fails the cross-attribution control", async () => {
  const ignoresThinker = async (a) => mk(honestTie)({ ...a, thinker: { ...a.thinker, text: CANON_A } });
  const res = await run(ignoresThinker);
  const s = res.summary;
  assert.ok(s.cross.tied >= 1);
  const v = verdict({ ...s, faith: null });
  // alpha's draft verified against beta's text collapses with the honest stub, but this stub always uses A's text: cross rate cannot be lower than matched for alpha-drafts
  assert.ok(s.cross.rate >= 0.5 * s.matched.rate, `cross ${s.cross.rate} matched ${s.matched.rate}`);
  assert.equal(v.bars.X.pass, false);
});

test("a stub that leaks a withheld assertion into the narration is caught in a full run", async () => {
  const leaker = async (a) => { const r = await mk(honestTie)(a); r.narration.text += " Also: The emperor must conquer the sea with a hundred ships."; return r; };
  const res = await run(leaker);
  assert.ok(res.summary.oracle.leaks > 0); assert.equal(res.summary.oracle.pass, false);
});

test("an erroring or hanging counselFor is recorded as an error, never as success", async () => {
  const boom = async () => { throw new Error("kaput"); };
  const res = await run(boom);
  assert.ok(res.summary.errors.length > 0);
  assert.equal(res.summary.matched.tied, 0);
  const hang = await runOne({ counselFor: () => new Promise(() => {}), id: "t", mode: "m", question: "q", thinker: thinkers.alpha, draft: draftA, point: async () => "1", fw: null, canon: readCanon(thinkers.alpha.source, { world }), timeoutMs: 50 });
  assert.match(hang.error, /timeout/); assert.equal(hang.assertions.length, 0);
});

test("replayDraft cycles recorded drafts; sycophantPoint always agrees under either protocol", async () => {
  const d = replayDraft(["a", "b"]); assert.deepEqual([await d(), await d(), await d()], ["a", "b", "a"]);
  const sp = sycophantPoint();
  assert.equal(await sp([{ role: "user", content: "SENTENCES\n[1] First sentence here.\n[2] Second.\n\nANSWER\nx" }]), "1");
  assert.match(await sp([{ role: "user", content: "SOURCES\n[S1] Title\nThe first sentence is this one. And more.\n\nANSWER\nx" }]), /SENTENCE: The first sentence is this one\./);
});

test("verdict rule: one hard failure is a no; undecided until faithfulness is judged; mute-but-safe is named", () => {
  const base = { matched: { rate: 0.5, pairsSpeaking: 20, pairs: 24, meanPerThinker: 0.5 }, cross: { rate: 0.1 }, fab: { spoken: 0, assertions: 96, trials: 48 }, oracle: { pass: true, spoken: 50, exact: 50, ws: 0, missing: 0, offsetBad: 0, leaks: 0, shaBad: 0, narrBad: 0 } };
  const good = { n: 50, F: 48, W: 2, X: 0, unjudged: 0, rateF: 0.96 };
  assert.equal(verdict({ ...base, faith: good }).verdict, "RELIABLE ENOUGH");
  assert.match(verdict({ ...base, faith: { ...good, X: 1, F: 47, rateF: 0.94 } }).verdict, /hard bar/);
  assert.match(verdict({ ...base, faith: { ...good, F: 30, W: 20, rateF: 0.6 } }).verdict, /hard bar/);
  assert.match(verdict({ ...base, faith: null }).verdict, /UNDECIDED/);
  assert.match(verdict({ ...base, faith: { n: 10, F: 10, W: 0, X: 0, unjudged: 0, rateF: 1 } }).verdict, /UNDECIDED/);
  assert.match(verdict({ ...base, fab: { spoken: 1, assertions: 96, trials: 48 }, faith: good }).verdict, /hard bar/);
  assert.match(verdict({ ...base, matched: { rate: 0.5, pairsSpeaking: 5, pairs: 24, meanPerThinker: 0.5 }, faith: good }).verdict, /mostly mute/);
  assert.match(verdict({ ...base, cross: { rate: 0.4 }, faith: good }).verdict, /NOT RELIABLE/);
});

test("the listing prints EVERY spoken assertion with its quote, and flags problems", async () => {
  const res = await run(mk(honestTie));
  const txt = listing(res);
  for (const r of [...res.runs.matched, ...res.runs.cross]) for (const a of r.assertions) if (a.tied) assert.ok(txt.includes(a.quote));
  assert.match(txt, /ASSERTION:/);
  const bad = await run(mk(fabricatorTie));
  assert.match(listing(bad), /NOT IN CANON/);
});

test("faithTotals counts only judged labels and tiedRates/oracleTotals are consistent", async () => {
  const res = await run(mk(honestTie));
  const labels = {}; let i = 0;
  for (const r of res.runs.matched) r.assertions.forEach((a, k) => { if (a.tied) labels[`${r.id}#${k}`] = { v: i++ % 2 ? "W" : "F" }; });
  const f = faithTotals(res.runs.matched, labels);
  assert.equal(f.n, res.summary.matched.tied); assert.equal(f.unjudged, 0);
  assert.equal(tiedRates(res.runs.matched).tied, res.summary.matched.tied);
  assert.equal(oracleTotals(res.runs.matched).spoken, res.summary.matched.tied);
});

test("oracleTotals fails on a missing quote alone; cost is counted by the harness even when the module under-reports", async () => {
  const run1 = { oracle: { spoken: [{ found: null }], problems: [] } };
  assert.equal(oracleTotals([run1]).pass, false);
  const liar = async (a) => { const r = await mk(honestTie)(a); r.calls = { draft: 0, point: 0 }; return r; };
  const res = await run(liar);
  assert.equal(res.runs.matched[0].calls.draft, 1); assert.ok(res.runs.matched[0].calls.total >= 2);
});
