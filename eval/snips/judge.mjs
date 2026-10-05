// judge.mjs — scores data/out/*.json against gold (PREREG rules), plus controls. NO network, NO model.
//   node eval/snips/judge.mjs      -> judged.json (per ask, auto labels merged with judgments.json = my reading) + stdout summary
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokens, coverage, relevant, gnorm, squash } from "./lib/text.mjs";
import { sentencesWithOffsets } from "./app/fold-chat-impression.js";
import { strandS1 } from "./pipeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "data", "out"), PAGES = path.join(here, "data", "pages");
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const J0 = fs.existsSync(path.join(here, "judgments.json")) ? JSON.parse(fs.readFileSync(path.join(here, "judgments.json"), "utf8")) : { confirmed: [], edits: {} };
const manual = J0.edits || {}; const confirmed = new Set(J0.confirmed || []);
const re = (s) => new RegExp(s, "iu");
const _memo = new Map();
const load = (id) => { if (_memo.has(id)) return _memo.get(id); const f = path.join(OUT, id + ".json"); const v = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; _memo.set(id, v); return v; };

/** does one snip carry the gold? (same-snip rule) */
export function snipHasGold(ask, s) {
  const g = ask.gold; if (!g.all || !g.all.length) return false;
  const t = gnorm(s.text);
  return g.all.every((x) => re(x).test(t)) && (!(g.any || []).length || g.any.some((x) => re(x).test(t)));
}
export function goldCheck(ask, snips) {
  const g = ask.gold;
  if (g.expect !== "answer") return { answered: false, na: true };
  const per = snips.filter((s) => snipHasGold(ask, s));
  let answered = per.length > 0, how = "same-snip";
  if (!answered && g.strandwide) {
    const t = gnorm(snips.map((s) => s.text).join("\n"));
    answered = g.all.every((x) => re(x).test(t)); how = "strandwide";
  }
  let recipe = null;
  if (g.struct === "recipe") {
    const rs = snips.filter((s) => s.rung === "a.recipe");
    const full = rs.filter((s) => s.nIngredients >= 3 && s.nSteps >= 2 && !s.truncated && snipHasGold(ask, s));
    recipe = full.length ? "complete" : rs.length ? "block-without-gold-or-incomplete" : "no-block";
  }
  return { answered, how, snips: per.map((s) => s.id), recipe };
}
/** shortest answer-bearing unit: the smallest sentence (or segment) of an answer snip that holds every gold regex */
function shortSpan(ask, snips) {
  let best = null;
  for (const s of snips) {
    if (!snipHasGold(ask, s)) continue;
    const pieces = s.kind === "prose" ? s.segments.flatMap((g) => sentencesWithOffsets(g.text).map((x) => x.text)) : s.lines || [s.text];
    let hit = pieces.filter((p) => ask.gold.all.every((x) => re(x).test(gnorm(p))));
    if (!hit.length && s.kind !== "prose") hit = [s.text];
    for (const p of hit) if (!best || p.length < best.sentence) best = { sentence: p.length, snip: s.chars, id: s.id, rung: s.rung };
    if (!best) best = { sentence: null, snip: s.chars, id: s.id, rung: s.rung };
  }
  return best;
}

const classOf = (a) => a.class;
const rows = [];
const pagesOf = (r) => (r.reads || []).filter((x) => x.ok).map((x) => ({ srcIdx: x.srcIdx, text: fs.readFileSync(path.join(PAGES, x.pageHash + ".txt"), "utf8") }));

for (const ask of asks) {
  const r = load(ask.id);
  if (!r || r.error) { rows.push({ id: ask.id, class: ask.class, lang: ask.language, missing: !r, error: r && r.error }); continue; }
  const S1 = r.strands.S1, shown = r.gap ? [] : S1;
  const row = { id: ask.id, class: ask.class, lang: ask.language, xl: ask.xl || null, expect: ask.gold.expect, synth: ask.gold.synth || null, text: ask.text };
  const toks = r.askTokens || tokens(r.query);
  row.transport = r.search.transport; row.searchOk = r.search.transport === "relay" || /^engine:/.test(r.search.transport);
  row.nResults = r.nResults; row.readsOk = r.reads.filter((x) => x.ok).length; row.readsTried = r.reads.length;
  row.gap = r.gap ? r.gap.kind : null; row.volatileCue = r.volatile.said;
  row.chars = shown.reduce((n, s) => n + s.chars, 0); row.wouldHaveChars = S1.reduce((n, s) => n + s.chars, 0);
  // gold on the S1 strand: what would be shown (shown) and what the strand holds regardless of the gap rule (held)
  row.held = goldCheck(ask, S1); row.shownGold = r.gap ? { answered: false, gapped: true } : row.held;
  row.held.span = shortSpan(ask, S1);
  // per-rung coverage (each rung's strand on its own) and S1 rung attribution
  row.byRung = {}; for (const k of ["a", "b", "c", "cNoLead", "d"]) { const sn = r.strands[k] || []; row.byRung[k] = { n: sn.length, chars: sn.reduce((a, s) => a + s.chars, 0), answered: goldCheck(ask, sn).answered }; }
  row.s1Rungs = [...new Set(S1.map((s) => s.rung))]; row.goldRungs = [...new Set(S1.filter((s) => snipHasGold(ask, s)).map((s) => s.rung))];
  // coverage by the number of sources read (top-k)
  if (ask.gold.expect === "answer") {
    const pages = pagesOf(r); row.topK = {};
    const pi = Object.fromEntries(pages.map((p) => [p.srcIdx, p]));
    for (const k of [1, 2, 3, 5]) { const sub = strandS1(r.candidates.filter((c) => c.srcIdx < k), pages.filter((p) => p.srcIdx < k)); row.topK[k] = goldCheck(ask, sub).answered; }
    void pi;
  }
  // relevance (auto proxy) per S1 snip
  row.snipRel = S1.map((s) => ({ id: s.id, rung: s.rung, chars: s.chars, rel: relevant(toks, s.text) || (ask.gold.all && ask.gold.all.length > 0 && snipHasGold(ask, s)) }));
  row.snipRelTokenOnly = S1.map((s) => relevant(toks, s.text));
  // verbatim
  row.verbatim = { n: S1.length, exactFail: S1.filter((s) => s.check && !s.check.exact).map((s) => s.id), notCorroborated: S1.filter((s) => s.check && s.check.corroborated === false).map((s) => s.id), entityResidue: S1.filter((s) => s.check && s.check.entityResidue).map((s) => s.id) };
  const allC = r.candidates || []; row.verbatimAll = { n: allC.length, exactFail: allC.filter((s) => s.check && !s.check.exact).length, residue: allC.filter((s) => s.check && s.check.entityResidue).length, notCorroborated: allC.filter((s) => s.check && s.check.corroborated === false).length };
  // citable
  row.citable = S1.map((s) => ({ id: s.id, url: /^https?:\/\//.test(s.url || ""), site: !!(s.credit && s.credit.site), author: !!(s.credit && s.credit.author), date: !!(s.credit && (s.credit.dateModified || s.credit.datePublished)), title: !!s.title })).map((c) => ({ ...c, ok: c.url && c.site }));
  // dangerous / leak
  const trap = ask.gold.trap && ask.gold.trap !== "." ? re(ask.gold.trap) : null;
  const strandText = gnorm(S1.map((s) => s.text).join("\n"));
  row.trapInHeld = !!(trap && trap.test(strandText)); row.trapInShown = !!(trap && !r.gap && trap.test(strandText));
  row.netMs = r.netMs; row.netSearchMs = r.netSearchMs; row.readNetMs = r.readNetMs; row.snipMs = r.snipMs; row.wallMs = r.totalMs;
  // auto satisfaction
  const g = ask.gold;
  let sat, why;
  if (g.expect === "gap") { if (r.gap) { sat = "gap-correct"; why = "typed gap: " + r.gap.kind; } else { sat = row.trapInShown ? "dangerous-wrong" : "leak"; why = row.trapInShown ? "strand asserts the trap" : "strand shown where a gap was correct"; } }
  else if (g.expect === "correction") { if (r.gap) { sat = "gap-correct"; why = "typed gap"; } else if (row.trapInShown) { sat = "dangerous-wrong"; why = "asserts the false premise"; } else if (re(g.correction).test(strandText)) { sat = "yes-with-trim"; why = "strand carries the correction"; } else { sat = "leak"; why = "strand shown, no correction"; } }
  else if (r.gap) { sat = "failed"; why = "typed gap on an answerable ask: " + r.gap.kind; }
  else if (row.held.answered) {
    const span = row.held.span;
    const irrel = row.snipRel.filter((x) => !x.rel).length / Math.max(1, row.snipRel.length);
    if (g.synth === "comparison") { sat = "yes-with-trim"; why = "both sides quoted, the comparison is the reader's"; }
    else if (g.synth === "arithmetic") { sat = "yes"; why = "the result itself is in a source"; }
    else if (span && span.snip <= 400 && irrel <= 0.5) { sat = "yes"; why = `answer in a ${span.snip}-char snip`; }
    else { sat = "yes-with-trim"; why = span ? `answer inside a ${span.snip}-char snip; ${(irrel * 100).toFixed(0)}% of snips off-ask` : "answered strandwide"; }
  } else if (g.synth && g.partial && re(g.partial).test(strandText)) { sat = "needs-model"; why = "the inputs are quoted, the asked-for result is not in any source"; }
  else if (g.synth === "comparison" && g.all.some((x) => re(x).test(strandText))) { sat = "needs-model"; why = "one side of the comparison only"; }
  else { sat = "failed"; why = r.gap ? "gap" : (row.readsOk ? "gold not in the strand" : "nothing could be read"); }
  row.auto = { sat, why };
  const m = manual[ask.id];
  row.final = m ? { sat: m.sat || sat, why: m.why || why, by: "reading-edited", irrelevant: m.irrelevant, dangerous: !!m.dangerous, auto: sat } : { sat, why, by: confirmed.has(ask.id) ? "reading-confirmed" : "auto", irrelevant: undefined, dangerous: false };
  rows.push(row);
}

// ── controls (II.10) ───────────────────────────────────────────────────────
const have = rows.filter((x) => x.id && !x.missing && !x.error);
const ansAsks = have.filter((x) => x.expect === "answer");
const lcg = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const derange = (n, rnd) => { for (;;) { const p = [...Array(n).keys()].sort(() => rnd() - 0.5); if (p.every((v, i) => v !== i)) return p; } };
const askById = Object.fromEntries(asks.map((a) => [a.id, a]));
const controls = {};
{ // 1. gold shuffle: gold of ask i against strand of ask j (all ordered pairs among answer asks)
  let k = 0, n = 0, sameLang = 0, sameLangN = 0;
  for (const i of ansAsks) for (const j of ansAsks) { if (i.id === j.id) continue; const rj = load(j.id); const hit = goldCheck(askById[i.id], rj.strands.S1).answered; n++; k += hit; if (i.lang === j.lang) { sameLangN++; sameLang += hit; } }
  controls.goldShuffle = { pairs: n, falseAcceptances: k, rate: n ? k / n : null, sameLang: { n: sameLangN, k: sameLang } };
}
{ // 2. relevance-judge shuffle (token rule only)
  const rnd = lcg(7); const perm = derange(have.length, rnd); let k = 0, n = 0, kt = 0, nt = 0, ks = 0, ns = 0;
  have.forEach((x, idx) => { const rj = load(have[perm[idx]].id); const ri = load(x.id); const toks = ri.askTokens; for (const s of rj.strands.S1) { n++; k += relevant(toks, s.text); } for (const s of ri.strands.S1) { nt++; kt += relevant(toks, s.text); } });
  // same-class shuffle (harder: shared words like 'recipe', 'what')
  const byCls = {}; for (const x of have) (byCls[x.class] ||= []).push(x);
  for (const arr of Object.values(byCls)) { if (arr.length < 2) continue; const p2 = derange(arr.length, rnd); arr.forEach((x, idx) => { const rj = load(arr[p2[idx]].id), ri = load(x.id); for (const s of rj.strands.S1) { ns++; ks += relevant(ri.askTokens, s.text); } }); }
  controls.relevanceJudge = { trueAccept: { k: kt, n: nt }, shuffledAccept: { k, n }, sameClassShuffledAccept: { k: ks, n: ns } };
}
{ // 3. volatile gate confusion
  const live = have.filter((x) => x.class === "live-trap" || /^new[89]$/.test(x.id)); const rest = have.filter((x) => !(x.class === "live-trap" || /^new[89]$/.test(x.id)));
  controls.volatileGate = { liveN: live.length, liveCaught: live.filter((x) => x.volatileCue).length, restN: rest.length, restFlagged: rest.filter((x) => x.volatileCue).length, flaggedIds: rest.filter((x) => x.volatileCue).map((x) => x.id), missedIds: live.filter((x) => !x.volatileCue).map((x) => x.id) };
}
fs.writeFileSync(path.join(here, "judged.json"), JSON.stringify({ at: new Date().toISOString(), controls, rows }, null, 1));
console.log(`judged ${have.length}/${asks.length} asks`);
const cnt = {}; for (const x of have) cnt[x.auto.sat] = (cnt[x.auto.sat] || 0) + 1; console.log(cnt); console.log(JSON.stringify(controls));
