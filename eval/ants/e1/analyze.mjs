// eval/ants/e1/analyze.mjs — tables, paired bootstrap CIs, verdicts for the pre-registered hypotheses (E1-PREREG.md).
//   node eval/ants/e1/analyze.mjs [results-e1.json] [results-e1-serial.json]    prints markdown; writes analysis-e1.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const mainF = process.argv[2] || path.join(HERE, "results-e1.json");
const serF = process.argv[3] || path.join(HERE, "results-e1-serial.json");
const Qs = JSON.parse(fs.readFileSync(path.join(HERE, "questions.json"), "utf8"));
const main = JSON.parse(fs.readFileSync(mainF, "utf8"));
const serial = fs.existsSync(serF) ? JSON.parse(fs.readFileSync(serF, "utf8")) : [];
const ANSW = new Set(Qs.filter((q) => q.gt).map((q) => q.id)), NOANS = new Set(Qs.filter((q) => !q.gt).map((q) => q.id));
const CELLS = { fast: ["fast", "facing"], balanced: ["balanced", "facing"], deep: ["deep", "facing"], snips: ["balanced", "snips"] };
const cellOf = (r) => Object.keys(CELLS).find((k) => CELLS[k][0] === r.effort && CELLS[k][1] === r.answer);
// seeded rng
let S = 12345; const rnd = () => ((S = (Math.imul(S, 1664525) + 1013904223) >>> 0) / 4294967296);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const median = (a) => { const b = [...a].sort((x, y) => x - y); const n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? "n/a" : (100 * x).toFixed(d));
const f1 = (x) => (x == null || Number.isNaN(x) ? "n/a" : x.toFixed(1));
function boot(vec, stat = mean, B = 10000) { // vec: per-question values (cluster); percentile CI
  const n = vec.length, out = [];
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < n; i++) s.push(vec[Math.floor(rnd() * n)]); out.push(stat(s)); }
  out.sort((x, y) => x - y); return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}
// per-question per-cell vectors
function perQ(runs, metric, ids, cell) {
  const m = new Map();
  for (const r of runs) { if (cellOf(r) !== cell || !ids.has(r.qid)) continue; const v = metric(r); if (v == null || Number.isNaN(v)) continue; (m.get(r.qid) || m.set(r.qid, []).get(r.qid)).push(+v); }
  return m;
}
function paired(runs, metric, ids, a, b) { // mean over questions of (cell a - cell b), per-question means over repeats
  const A = perQ(runs, metric, ids, a), B = perQ(runs, metric, ids, b), d = [];
  for (const [q, v] of A) if (B.has(q)) d.push(mean(v) - mean(B.get(q)));
  return d;
}
function ratio(runs, ids, a, b) { // median over questions of per-question time ratio a/b
  const A = perQ(runs, (r) => r.turn_s, ids, a), B = perQ(runs, (r) => r.turn_s, ids, b), d = [];
  for (const [q, v] of A) if (B.has(q)) d.push(mean(v) / mean(B.get(q)));
  return d;
}
const metrics = {
  right: (r) => (r.right ? 1 : 0), gc: (r) => (r.gc ? 1 : 0), gcFold: (r) => (r.gcFold == null ? null : r.gcFold ? 1 : 0), concise: (r) => (r.concise ? 1 : 0),
  fail: (r) => (r.fail || r.error || r.timeout ? 1 : 0), honest: (r) => (r.honest ? 1 : 0), turn: (r) => r.turn_s, nSources: (r) => r.nSources, reads: (r) => r.n_read_ok,
  covRatio: (r) => (r.coverage && r.coverage.total ? r.coverage.grounded / r.coverage.total : null),
};
const out = {};
const L = [];
const P = (s = "") => L.push(s);
const runsOK = main.filter((r) => !r.error);
P(`runs: ${main.length} (errors ${main.length - runsOK.length}); serial: ${serial.length}`);
const N = (runs, cell, ids) => runs.filter((r) => cellOf(r) === cell && ids.has(r.qid)).length;

// 1. cell summary
function summary(runs, ids, title) {
  P(`### ${title}`); P(); P("| cell | runs | RIGHT % | GC % | GC_fold % | concise-correct % | FAIL % | median turn s | mean search/read/post s | mean pages read | mean sources | mean cov N/M |"); P("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of Object.keys(CELLS)) {
    const rs = runs.filter((r) => cellOf(r) === c && ids.has(r.qid)); if (!rs.length) continue;
    const m = (f) => mean(rs.map(f).filter((x) => x != null && !Number.isNaN(x)));
    const gcf = rs.map(metrics.gcFold).filter((x) => x != null);
    out[title + "|" + c] = { n: rs.length, right: m(metrics.right), gc: m(metrics.gc), fail: m(metrics.fail), medTurn: median(rs.map((r) => r.turn_s).filter((x) => x != null)) };
    P(`| ${c} | ${rs.length} | ${pct(m(metrics.right))} | ${pct(m(metrics.gc))} | ${gcf.length ? pct(mean(gcf)) : "n/a"} | ${pct(m(metrics.concise))} | ${pct(m(metrics.fail))} | ${f1(median(rs.map((r) => r.turn_s).filter((x) => x != null)))} | ${f1(m((r) => r.search_s))}/${f1(m((r) => r.read_s))}/${f1(m((r) => r.post_s))} | ${f1(m(metrics.reads))} | ${f1(m(metrics.nSources))} | ${pct(m(metrics.covRatio))} |`);
  }
  P();
}
summary(main, ANSW, "Main battery, answerable (34 questions), contended 2 workers");
if (serial.length) summary(serial, ANSW, "Serial timing pass, answerable, 1 worker");
for (const cat of ["easy", "hard", "multihop", "live", "ambiguous"]) summary(main, new Set(Qs.filter((q) => q.cat === cat).map((q) => q.id)), `Main, category ${cat}`);

// 2. paired differences
function diffRow(runs, ids, metric, a, b, label, scale = 100) {
  const d = paired(runs, metrics[metric], ids, a, b); if (!d.length) return null;
  const [lo, hi] = boot(d); const mu = mean(d);
  return { label, metric, a, b, nq: d.length, mean: mu, lo, hi };
}
P("### Paired differences on GC (points; per-question means over repeats; 95% bootstrap CI over questions)"); P();
P("| contrast | metric | questions | diff (pts) | 95% CI | time ratio (median of per-question ratios; main) | CI |"); P("|---|---|---|---|---|---|---|");
const contrasts = [["deep", "balanced"], ["balanced", "fast"], ["deep", "fast"], ["snips", "balanced"]];
const H = {};
for (const [a, b] of contrasts) for (const metric of ["gc", "right", "concise"]) {
  const r = diffRow(main, ANSW, metric, a, b); if (!r) continue;
  const tr = ratio(main, ANSW, a, b); const [tl, th] = tr.length ? boot(tr, median) : [NaN, NaN];
  P(`| ${a} - ${b} | ${metric} | ${r.nq} | ${(100 * r.mean).toFixed(1)} | [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}] | ${f1(median(tr))} | [${f1(tl)}, ${f1(th)}] |`);
  H[`${a}-${b}|${metric}`] = { ...r, timeRatioMain: median(tr), trCI: [tl, th] };
}
P();
if (serial.length) {
  P("### Time ratios, serial pass (authority for the time conditions)"); P();
  P("| contrast | questions | median per-question ratio | 95% CI | median turn s a / b |"); P("|---|---|---|---|---|");
  for (const [a, b] of contrasts) {
    const tr = ratio(serial, new Set([...ANSW, ...NOANS]), a, b); if (!tr.length) continue; const [tl, th] = boot(tr, median);
    const ta = serial.filter((r) => cellOf(r) === a && r.turn_s != null).map((r) => r.turn_s), tb = serial.filter((r) => cellOf(r) === b && r.turn_s != null).map((r) => r.turn_s);
    P(`| ${a}/${b} | ${tr.length} | ${f1(median(tr))} | [${f1(tl)}, ${f1(th)}] | ${f1(median(ta))} / ${f1(median(tb))} |`);
    H[`${a}/${b}|timeSerial`] = { ratio: median(tr), ci: [tl, th] };
  }
  P();
}

// 3. noise: repeat disagreement on GC / right per cell (answerable)
P("### Run-to-run noise: how often the two repeats of the same (question, cell) disagree"); P();
P("| cell | pairs | GC disagree % | RIGHT disagree % | turn_s mean abs diff (s) | turn_s mean |"); P("|---|---|---|---|---|---|");
const noise = {};
for (const c of Object.keys(CELLS)) {
  const by = new Map(); for (const r of main) if (cellOf(r) === c && ANSW.has(r.qid)) (by.get(r.qid) || by.set(r.qid, []).get(r.qid)).push(r);
  const pairs = [...by.values()].filter((v) => v.length >= 2);
  const dg = pairs.map((v) => (!!v[0].gc !== !!v[1].gc ? 1 : 0)), dr = pairs.map((v) => (!!v[0].right !== !!v[1].right ? 1 : 0));
  const dt = pairs.filter((v) => v[0].turn_s != null && v[1].turn_s != null).map((v) => Math.abs(v[0].turn_s - v[1].turn_s));
  const tm = main.filter((r) => cellOf(r) === c && r.turn_s != null).map((r) => r.turn_s);
  noise[c] = { gc: mean(dg), right: mean(dr) };
  P(`| ${c} | ${pairs.length} | ${pct(mean(dg))} | ${pct(mean(dr))} | ${f1(mean(dt))} | ${f1(mean(tm))} |`);
}
P(); out.noise = noise;
const noiseAll = mean(Object.values(noise).map((x) => x.gc));
P(`Mean GC repeat-disagreement across cells = ${pct(noiseAll)}%. A between-level difference smaller than that is declared not a difference.`); P();

// 4. deep's falsify: did it flag, and were the flags right
P("### Deep falsify pass and the REC loop"); P();
const deep = main.filter((r) => cellOf(r) === "deep" && ANSW.has(r.qid) && r.falsify && r.falsify.checked > 0);
const flagged = deep.filter((r) => r.falsify.weak + r.falsify.unsupported > 0), clean = deep.filter((r) => r.falsify.weak + r.falsify.unsupported === 0);
const wrongRate = (rs) => (rs.length ? mean(rs.map((r) => (r.right ? 0 : 1))) : NaN);
P(`Deep runs with >=1 checked claim: ${deep.length}. Flagged (>=1 weak or unsupported): ${flagged.length}; all-supported: ${clean.length}.`);
P(`P(answer not RIGHT | flagged) = ${pct(wrongRate(flagged))}% (n=${flagged.length}); P(not RIGHT | all supported) = ${pct(wrongRate(clean))}% (n=${clean.length}); ratio = ${(wrongRate(flagged) / wrongRate(clean)).toFixed(2)}.`);
const cl = (v) => ({ checked: v.reduce((n, r) => n + r.falsify.checked, 0), supported: v.reduce((n, r) => n + r.falsify.supported, 0), weak: v.reduce((n, r) => n + r.falsify.weak, 0), unsupported: v.reduce((n, r) => n + r.falsify.unsupported, 0) });
const cc = cl(deep); P(`Claims at deep: checked ${cc.checked}: supported ${cc.supported}, weak ${cc.weak}, unsupported ${cc.unsupported}.`);
// if the flagged answers were turned into gaps ("flips"): right flip = answer was wrong, wrong flip = answer was right
const unsupRuns = deep.filter((r) => r.falsify.unsupported > 0), weakRuns = deep.filter((r) => r.falsify.weak > 0 && r.falsify.unsupported === 0);
const flipTbl = (rs) => ({ n: rs.length, wasRight: rs.filter((r) => r.right).length, wasWrong: rs.filter((r) => !r.right).length });
out.falsify = { deepRuns: deep.length, flagged: flagged.length, claims: cc, unsupported: flipTbl(unsupRuns), weakOnly: flipTbl(weakRuns) };
P(`If "unsupported" flags had been acted on (answer withdrawn): ${JSON.stringify(flipTbl(unsupRuns))} (wasRight = correct answers that would be lost; wasWrong = wrong answers that would be caught).`);
P(`If "weak only" flags had been acted on: ${JSON.stringify(flipTbl(weakRuns))}.`);
const rec = (c) => main.filter((r) => cellOf(r) === c && ANSW.has(r.qid) && r.loop);
for (const c of ["balanced", "deep"]) { const rs = rec(c); P(`REC loop at ${c}: ${rs.length} runs had a loop record; cleared first try ${rs.filter((r) => r.loop.firstTry).length}; went back (>=1 lap) ${rs.filter((r) => r.loop.passes > 0).length}; sentences restated ${rs.reduce((n, r) => n + r.loop.restated, 0)}.`); }
// does the final answer's RIGHT-ness at deep vs balanced differ on the same question beyond noise: count questions where deep right & balanced wrong etc
const qs = [...ANSW]; let dOnly = 0, bOnly = 0, both = 0, neither = 0;
for (const q of qs) { const d = main.filter((r) => r.qid === q && cellOf(r) === "deep"), b = main.filter((r) => r.qid === q && cellOf(r) === "balanced"); if (!d.length || !b.length) continue; const dm = mean(d.map(metrics.gc)) >= 0.5, bm = mean(b.map(metrics.gc)) >= 0.5; if (dm && bm) both++; else if (dm) dOnly++; else if (bm) bOnly++; else neither++; }
P(`Per question (GC majority of repeats): both deep and balanced ${both}; deep only ${dOnly}; balanced only ${bOnly}; neither ${neither}.`); P();
out.deepVsBalancedQuestions = { both, dOnly, bOnly, neither };

// 5. failures
P("### Failures, timeouts, empty answers (all questions)"); P(); P("| cell | runs | errors | timeouts | empty answer | no source reached | web scope failed (but turn ran) | any search ok % |"); P("|---|---|---|---|---|---|---|---|");
for (const c of Object.keys(CELLS)) { const rs = main.filter((r) => cellOf(r) === c); if (!rs.length) continue; P(`| ${c} | ${rs.length} | ${rs.filter((r) => r.error).length} | ${rs.filter((r) => r.timeout).length} | ${rs.filter((r) => r.empty).length} | ${rs.filter((r) => r.fail).length} | ${rs.filter((r) => !r.error && !r.webOk).length} | ${pct(mean(rs.filter((r) => !r.error).map((r) => (r.anySearchOk ? 1 : 0))))} |`); }
P();
// conditional on web scope answered
const webOkIds = (r) => r.webOk;
P("### Conditional on the open-web scope having answered (GC / RIGHT %, answerable)"); P(); P("| cell | runs | GC % | RIGHT % |"); P("|---|---|---|---|");
for (const c of Object.keys(CELLS)) { const rs = main.filter((r) => cellOf(r) === c && ANSW.has(r.qid) && !r.error && webOkIds(r)); P(`| ${c} | ${rs.length} | ${pct(mean(rs.map(metrics.gc)))} | ${pct(mean(rs.map(metrics.right)))} |`); }
P();


// web-state strata: did the open-web scope answer in that run?
P("### By web state (answerable): open-web scope answered vs not (balanced/deep/snips fall back to Wikipedia scope; fast has nothing to fall back to)"); P();
P("| cell | web | runs | RIGHT % | GC % | FAIL % | median turn s |"); P("|---|---|---|---|---|---|---|");
for (const c of Object.keys(CELLS)) for (const w of [true, false]) { const rs = main.filter((r) => cellOf(r) === c && ANSW.has(r.qid) && !r.error && !!r.webOk === w); if (!rs.length) continue; P(`| ${c} | ${w ? "answered" : "down"} | ${rs.length} | ${pct(mean(rs.map(metrics.right)))} | ${pct(mean(rs.map(metrics.gc)))} | ${pct(mean(rs.map(metrics.fail)))} | ${f1(median(rs.map((r) => r.turn_s).filter((x) => x != null)))} |`); }
P();
// all-down stratum: paired contrasts using only runs where web was down
P("### Paired contrasts restricted to runs where the web scope was DOWN (per-question means over the available repeats)"); P();
const downRuns = main.filter((r) => !r.webOk);
for (const [a, b] of [["deep", "balanced"], ["snips", "balanced"], ["balanced", "fast"]]) { const r = diffRow(downRuns, ANSW, "gc", a, b); if (r) P(`GC ${a} - ${b}: ${(100 * r.mean).toFixed(1)} pts [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}] over ${r.nq} questions`); }
P();
// 6. honest gaps
P("### The 5 questions with no good answer on the web"); P(); P("| cell | runs | HONEST % | hallucinated % | void on record % |"); P("|---|---|---|---|---|");
for (const c of Object.keys(CELLS)) { const rs = main.filter((r) => cellOf(r) === c && NOANS.has(r.qid) && !r.error); if (!rs.length) continue; P(`| ${c} | ${rs.length} | ${pct(mean(rs.map(metrics.honest)))} | ${pct(1 - mean(rs.map(metrics.honest)))} | ${pct(mean(rs.map((r) => (r.void ? 1 : 0))))} |`); out["honest|" + c] = mean(rs.map(metrics.honest)); }
P();
for (const [a, b] of [["balanced", "fast"], ["deep", "fast"], ["deep", "balanced"], ["snips", "balanced"]]) { const r = diffRow(main, NOANS, "honest", a, b); if (r) { P(`HONEST ${a} - ${b}: ${(100 * r.mean).toFixed(1)} pts, 95% CI [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}] (5 questions, so wide)`); H[`${a}-${b}|honest`] = r; } }
P();
// live subset
P("### Live subset GC by cell"); P();
const LIVE = new Set(Qs.filter((q) => q.cat === "live").map((q) => q.id));
for (const [a, b] of [["deep", "balanced"], ["balanced", "fast"], ["snips", "balanced"]]) { const r = diffRow(main, LIVE, "gc", a, b); if (r) P(`live GC ${a} - ${b}: ${(100 * r.mean).toFixed(1)} pts, CI [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}] (4 questions)`); }
P();

// 7. per-question table
P("### Per question: GC count out of 2 repeats, and mean turn s (main)"); P(); P("| q | cat | question | fast | balanced | deep | snips |"); P("|---|---|---|---|---|---|---|");
for (const q of Qs) { const cell = (c) => { const rs = main.filter((r) => r.qid === q.id && cellOf(r) === c); if (!rs.length) return "-"; const k = q.gt ? rs.filter((r) => r.gc).length : rs.filter((r) => r.honest).length; return `${k}/${rs.length}${q.gt ? "" : " honest"} ${f1(mean(rs.map((r) => r.turn_s).filter((x) => x != null)))}s`; }; P(`| ${q.id} | ${q.cat} | ${q.q.slice(0, 55)} | ${cell("fast")} | ${cell("balanced")} | ${cell("deep")} | ${cell("snips")} |`); }
P();

// 8. policies (adaptive vs fixed): use main-battery outcomes; cost = serial median per-cell time if available else main median
P("### Candidate controls: GC and time cost, answerable questions"); P();
const tcost = {}; for (const c of Object.keys(CELLS)) { const src = serial.length ? serial : main; tcost[c] = median(src.filter((r) => cellOf(r) === c && r.turn_s != null).map((r) => r.turn_s)); }
P(`cost per turn used (median ${serial.length ? "serial" : "main"} s): ${Object.entries(tcost).map(([k, v]) => k + "=" + f1(v)).join(", ")}`); P();
const outcomeOf = (q, c) => main.filter((r) => r.qid === q && cellOf(r) === c && !r.error);
const gcRate = (q, c) => { const rs = outcomeOf(q, c); return rs.length ? mean(rs.map(metrics.gc)) : null; };
const pols = {
  "always fast": (q) => ({ gc: gcRate(q, "fast"), t: tcost.fast }),
  "always balanced": (q) => ({ gc: gcRate(q, "balanced"), t: tcost.balanced }),
  "always deep": (q) => ({ gc: gcRate(q, "deep"), t: tcost.deep }),
  "always snips": (q) => ({ gc: gcRate(q, "snips"), t: tcost.snips }),
  "snips, then facing(balanced) if snips has no GC": (q) => { const s = outcomeOf(q, "snips"), b = outcomeOf(q, "balanced"); if (!s.length || !b.length) return { gc: null, t: null }; const p = mean(s.map(metrics.gc)); return { gc: p + (1 - p) * mean(b.map(metrics.gc)), t: tcost.snips + (1 - p) * tcost.balanced }; },
  "fast, then balanced if fast is not GC": (q) => { const f = outcomeOf(q, "fast"), b = outcomeOf(q, "balanced"); if (!f.length || !b.length) return { gc: null, t: null }; const p = mean(f.map(metrics.gc)); return { gc: p + (1 - p) * mean(b.map(metrics.gc)), t: tcost.fast + (1 - p) * tcost.balanced }; },
  "balanced, then deep if balanced is not GC": (q) => { const f = outcomeOf(q, "balanced"), b = outcomeOf(q, "deep"); if (!f.length || !b.length) return { gc: null, t: null }; const p = mean(f.map(metrics.gc)); return { gc: p + (1 - p) * mean(b.map(metrics.gc)), t: tcost.balanced + (1 - p) * tcost.deep }; },
};
P("| policy | GC % | 95% CI | expected turn s |"); P("|---|---|---|---|");
for (const [name, fn] of Object.entries(pols)) { const v = [...ANSW].map((q) => fn(q)).filter((x) => x.gc != null); if (!v.length) continue; const [lo, hi] = boot(v.map((x) => x.gc)); P(`| ${name} | ${pct(mean(v.map((x) => x.gc)))} | [${pct(lo)}, ${pct(hi)}] | ${f1(mean(v.map((x) => x.t)))} |`); out["policy|" + name] = { gc: mean(v.map((x) => x.gc)), t: mean(v.map((x) => x.t)) }; }
P(); out.H = H; out.tcost = tcost;
fs.writeFileSync(path.join(HERE, "analysis-" + path.basename(mainF, ".json") + ".json"), JSON.stringify(out, null, 1));
console.log(L.join("\n"));
