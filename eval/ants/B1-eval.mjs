#!/usr/bin/env node
// eval/ants/B1-eval.mjs — measures the claims pre-registered in eval/ants/B1-PREREG.md (written before any run). Real canon, real conversation turns, real Wikipedia pages.
//   node eval/ants/B1-eval.mjs --dev-only     DEV phase only (choose mu, T, (m,tau), session bonus on DEV; the TEST split is not touched)
//   node eval/ants/B1-eval.mjs --write        DEV phase, write the chosen calibration INTO voice/thinkers-profile.json, then the TEST phase and the 12 questions; results -> eval/ants/B1-results.json
// The profile is fit on TRAIN units only (scripts/build-thinkers.mjs). Nothing here edits a number after the fact.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCanon, buildProfile, WORLD } from "../../scripts/build-thinkers.mjs";
import { decodeProfile, classify, contentStems, knownStems, scoreKnown, posteriorOf, DECLARED } from "../../fold-chat-thinkers.js";
import { sentencesWithOffsets } from "../../fold-chat-impression.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = path.join(ROOT, "voice/thinkers-profile.json");
const DEV_ONLY = process.argv.includes("--dev-only"), WRITE = process.argv.includes("--write");
const Ns = [3, 6, 12, 40], POOL = [6, 12, 40], PER = 150;
const GRID = { mu: [100, 500, 2000, 8000], m: [1, 2, 3, 4], tau: Array.from({ length: 14 }, (_, i) => +(0.30 + 0.05 * i).toFixed(2)), bonus: [0, 1, 2, 4] };
const QUESTIONS = ["Is there a God?", "What is justice?", "How should I treat my enemies?", "Is suffering necessary?", "Can a person change?", "What is a good ruler?", "Is it wrong to lie?", "What happens after death?", "What is the self?", "Why obey the law?", "Is war ever just?", "What is virtue?"];

// ── seeded randomness (a stream per purpose, so phases do not disturb each other) ──
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngFor = (name) => { let a = hash(name); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, n) => Math.floor(r() * n);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x) => (100 * x).toFixed(1) + "%";
const f2 = (x) => (+x).toFixed(3);
const out = { at: new Date().toISOString(), phases: {} };
const say = (...a) => console.log(...a);

// ── data ──
say("loading canon …");
const canon = loadCanon({ keepText: true });
const prof = buildProfile(canon);                      // identical to voice/thinkers-profile.json (checked below)
const disk = JSON.parse(fs.readFileSync(PROFILE, "utf8"));
if (disk.vocab !== prof.vocab || JSON.stringify(disk.thinkers) !== JSON.stringify(prof.thinkers)) { console.error("voice/thinkers-profile.json is stale: run scripts/build-thinkers.mjs"); process.exit(2); }
const model = decodeProfile(disk);
say(`${model.T} thinkers, ${model.V} stems; profile ${fs.statSync(PROFILE).size} bytes`);
const tIndex = new Map(model.handles.map((h, i) => [h, i]));

const canonWindows = (split, N, per, tag) => {
  const w = [];
  for (const th of canon.thinkers) {
    const r = rngFor(`${tag}|${split}|${N}|${th.handle}`);
    const us = th.units.filter((u) => u.split === split && u.stems.length >= N);
    if (!us.length) continue;
    for (let k = 0; k < per; k++) { const u = us[pick(r, us.length)]; const s0 = pick(r, u.stems.length - N + 1); w.push({ t: tIndex.get(th.handle), stems: u.stems.slice(s0, s0 + N), unit: u.i }); }
  }
  return w;
};

// NEG-X: organic chat, e-mail, SMS, science / history Wikipedia — files split by index parity
const NEGX_DIRS = [
  ["ubuntu-irc", path.join(WORLD, "ethos/19-organic-community/ubuntu-irc/ubuntu"), 23],
  ["enron", path.join(WORLD, "ethos/19-organic-community/enron"), 20],
  ["nus-sms", path.join(WORLD, "ethos/19-organic-community/nus-sms/en"), 8],
];
const WIKI = "Cell_biology Chemistry DNA Entropy General_relativity Mathematics Neuroscience Quantum_mechanics Thermodynamics Industrial_Revolution Cold_War Ming_dynasty Mongol_Empire Byzantine_Empire".split(" ");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])).sort();
const negxFiles = [];
for (const [fam, dir, cap] of NEGX_DIRS) { const all = walk(dir).filter((f) => f.endsWith(".txt")); const step = Math.max(1, Math.floor(all.length / cap)); all.filter((_, i) => i % step === 0).slice(0, cap).forEach((f, i) => negxFiles.push({ fam, f, split: i % 2 === 0 ? "dev" : "test" })); }
WIKI.forEach((n, i) => negxFiles.push({ fam: "wiki-science", f: path.join(WORLD, "ethos/02-encyclopedic/wikipedia", n + ".txt"), split: i % 2 === 0 ? "dev" : "test" }));
const negxWindows = (split, N = 12, per = 100) => {
  const w = [];
  for (const { fam, f, split: sp } of negxFiles) {
    if (sp !== split) continue;
    let txt = fs.readFileSync(f, "utf8"); if (txt.startsWith("---")) { const e = txt.indexOf("\n---", 3); if (e > 0) txt = txt.slice(e + 4); }
    const st = contentStems(txt); if (st.length < N) continue;
    const r = rngFor(`negx|${f}|${N}`);
    for (let k = 0; k < per; k++) { const s0 = pick(r, st.length - N + 1); w.push({ fam, stems: st.slice(s0, s0 + N) }); }
  }
  return w;
};

// ── core measures (the gate here is the module's own rule, applied arithmetically over precomputed windows; the final numbers are re-run through classify()) ──
const prep = (wins, mu) => wins.map((w) => { const known = knownStems(model, w.stems); return { ...w, known, kn: known.length, s: scoreKnown(model, known, mu) }; });
const rankOf = (post, t) => { let r = 0; for (let i = 0; i < post.length; i++) if (post[i] > post[t] || (post[i] === post[t] && i < t)) r++; return r; };
const SP = model.speaks;
const spOrder = (post) => [...post.keys()].filter((t) => SP[t]).sort((a, b) => post[b] - post[a] || a - b);
const mass3Of = (post) => spOrder(post).slice(0, 3).reduce((a, t) => a + post[t], 0);
function measure(pw, Temp, gate = null, { speakingOnly = false } = {}) {
  const per = new Map(); let acc = 0, accN = 0, tot = 0, techN = 0, techAcc = 0; const conf = [];
  for (const w of pw) {
    const post = posteriorOf(w.s, Temp), ord = [...post.keys()].sort((a, b) => post[b] - post[a] || a - b), sp = spOrder(post);
    const isSp = SP[w.t];
    if (speakingOnly && !isSp) continue;
    const r = w.kn ? ord.indexOf(w.t) : 99;
    const e = per.get(w.t) || { n: 0, top1: 0, top3: 0 }; e.n++; if (r === 0) e.top1++; if (r < 3) e.top3++; per.set(w.t, e);
    conf.push([post[ord[0]], r === 0 ? 1 : 0]);
    if (gate) {
      const accepted = w.kn >= gate.m && mass3Of(post) >= gate.tau;
      if (!isSp) { techN++; if (accepted) techAcc++; continue; }
      tot++; if (accepted) { accN++; if (sp.slice(0, 3).includes(w.t)) acc++; }
    } else tot++;
  }
  const macro = (k) => mean([...per.values()].map((e) => e[k] / e.n));
  const ece = (() => { const B = 10; let e = 0; for (let b = 0; b < B; b++) { const c = conf.filter(([p]) => p >= b / B && (p < (b + 1) / B || (b === B - 1 && p <= 1))); if (c.length) e += (c.length / conf.length) * Math.abs(mean(c.map((x) => x[0])) - mean(c.map((x) => x[1]))); } return e; })();
  return { top1: macro("top1"), top3: macro("top3"), ece, n: tot, accepted: accN, coverage: gate ? accN / tot : null, precision: gate && accN ? acc / accN : null, techOffer: gate && techN ? techAcc / techN : null };
}
const falseOffer = (pw, Temp, gate) => { let a = 0; for (const w of pw) { const post = posteriorOf(w.s, Temp); if (w.kn >= gate.m && mass3Of(post) >= gate.tau) a++; } return a / pw.length; };
const nll = (pw, Temp) => mean(pw.map((w) => { const post = posteriorOf(w.s, Temp); return -Math.log(Math.max(1e-12, post[w.t])); }));

// ── DEV phase ──
say("\n=== DEV phase (the TEST split is not touched) ===");
const devWins = Object.fromEntries(Ns.map((N) => [N, canonWindows("dev", N, PER, "w")]));
// (1) mu by DEV top-3 at N=12
const muRows = GRID.mu.map((mu) => ({ mu, top3: measure(prep(devWins[12], mu), 10).top3, top3_6: measure(prep(devWins[6], mu), 10).top3 }));
muRows.forEach((r) => say(`  mu=${String(r.mu).padStart(5)}  DEV top-3 @N=12 ${f2(r.top3)}  @N=6 ${f2(r.top3_6)}`));
const MU = muRows.slice().sort((a, b) => b.top3 - a.top3 || a.mu - b.mu)[0].mu;
// (2) T by DEV log-loss, pooled over all four N
const poolAll = Ns.flatMap((N) => prep(devWins[N], MU));
let T = 1, best = Infinity; for (let x = 1; x <= 60; x *= 1.12) { const l = nll(poolAll, x); if (l < best) { best = l; T = x; } }
T = +T.toFixed(2);
say(`  mu=${MU}   T=${T} (DEV log-loss ${f2(best)}; at T=1 ${f2(nll(poolAll, 1))})`);
// (3) (m, tau): max coverage s.t. DEV canon precision >= 0.92 (pooled N in {6,12,40}) and DEV NEG-X false-offer <= 0.07
const devPool = POOL.flatMap((N) => prep(devWins[N], MU));
const devNeg = prep(negxWindows("dev").map((w) => ({ ...w, t: 0 })), MU);
const rows = [];
for (const m of GRID.m) for (const tau of GRID.tau) { const c = measure(devPool, T, { m, tau }); const fa = falseOffer(devNeg, T, { m, tau }); rows.push({ m, tau, coverage: c.coverage, precision: c.precision, fa, techOffer: c.techOffer }); }
const feas = rows.filter((r) => r.precision != null && r.precision >= 0.92 && r.fa <= 0.07);
const closest = rows.filter((r) => r.precision != null).sort((a, b) => (Math.max(0, 0.92 - b.precision) + Math.max(0, b.fa - 0.07)) - (Math.max(0, 0.92 - a.precision) + Math.max(0, a.fa - 0.07)))[0];
const chosen = (feas.length ? feas.sort((a, b) => b.coverage - a.coverage || b.tau - a.tau)[0] : rows.slice().sort((a, b) => (Math.max(0, 0.92 - (a.precision ?? 0)) + Math.max(0, a.fa - 0.07)) - (Math.max(0, 0.92 - (b.precision ?? 0)) + Math.max(0, b.fa - 0.07)) || b.coverage - a.coverage)[0]);
say(`  gate: ${feas.length ? feas.length + " feasible (m,tau) pairs" : "NO pair met both DEV constraints (shipping the closest)"}; chosen m=${chosen.m} tau=${chosen.tau}  DEV precision ${f2(chosen.precision)}  coverage ${f2(chosen.coverage)}  NEG-X false-offer ${f2(chosen.fa)}`);
say("  (m,tau) frontier on DEV (m=" + chosen.m + "):"); rows.filter((r) => r.m === chosen.m).forEach((r) => say(`    tau=${r.tau}  prec ${r.precision == null ? " -- " : f2(r.precision)}  cov ${f2(r.coverage)}  falseOffer ${f2(r.fa)}  technical-canon windows offered ${f2(r.techOffer)}`));
// (4) session bonus on DEV sessions
const sessionPairs = (split, tag, per = 100) => {
  const s = [];
  for (const th of canon.thinkers) {
    const r = rngFor(`${tag}|${split}|${th.handle}`); const us = th.units.filter((u) => u.split === split && u.stems.length >= 40);
    if (us.length < 2) continue;
    for (let k = 0; k < per; k++) { const a = pick(r, us.length); let b = pick(r, us.length - 1); if (b >= a) b++; const u1 = us[a], u2 = us[b]; const s1 = pick(r, u1.stems.length - 40 + 1), s2 = pick(r, u2.stems.length - 4 + 1); s.push({ t: tIndex.get(th.handle), t1: u1.stems.slice(s1, s1 + 40), t2: u2.stems.slice(s2, s2 + 4), r }); }
  }
  return s;
};
function sessionEval(pairs, bonus, Temp, mu, which) {
  const per = new Map();
  for (const p of pairs) {
    const known = knownStems(model, p.t2); const s = scoreKnown(model, known, mu); const bv = new Float64Array(model.T);
    if (which === "correct") bv[p.t] = bonus; else if (which === "wrong") { const r = rngFor("wrong|" + p.t + "|" + p.t2.join("")); let w = pick(r, model.T); if (w === p.t) w = (w + 1) % model.T; bv[w] = bonus; }
    const post = posteriorOf(s, Temp, which === "none" ? null : bv); const r = known.length ? rankOf(post, p.t) : 99;
    const e = per.get(p.t) || { n: 0, k: 0 }; e.n++; if (r < 3) e.k++; per.set(p.t, e);
  }
  return mean([...per.values()].map((e) => e.k / e.n));
}
const devPairs = sessionPairs("dev", "sess");
const base0 = sessionEval(devPairs, 0, T, MU, "none");
const bonusRows = GRID.bonus.map((b) => ({ b, correct: sessionEval(devPairs, b, T, MU, "correct") - base0, wrong: base0 - sessionEval(devPairs, b, T, MU, "wrong") }));
say(`  session turn-2 (N=4) DEV top-3 without prior ${f2(base0)}`); bonusRows.forEach((r) => say(`    bonus=${r.b}  lift with correct prior ${(r.correct >= 0 ? "+" : "") + f2(r.correct)}   cost of wrong prior ${f2(r.wrong)}`));
const okB = bonusRows.filter((r) => r.wrong <= 0.12); const BONUS = (okB.length ? okB.sort((a, b) => b.correct - a.correct)[0] : bonusRows[0]).b;
say(`  chosen session bonus = ${BONUS} nats (max lift with wrong-prior cost <= 0.12)`);
const CAL = { mu: MU, T, m: chosen.m, tau: chosen.tau, bonus: BONUS, chosenOn: "DEV split (position blocks 3 of 5)", devPrecision: +chosen.precision.toFixed(4), devCoverage: +chosen.coverage.toFixed(4), devNegFalseOffer: +chosen.fa.toFixed(4), bars: "eval/ants/B1-PREREG.md", at: out.at };
out.phases.dev = { muRows, T, chosen, calibration: CAL, bonusRows, base0 };
if (DEV_ONLY) { fs.writeFileSync(path.join(ROOT, "eval/ants/B1-dev.json"), JSON.stringify(out, null, 1)); say("\n--dev-only: done (TEST untouched)."); process.exit(0); }
if (WRITE) { disk.calibration = CAL; fs.writeFileSync(PROFILE, JSON.stringify(disk)); say("  wrote calibration into voice/thinkers-profile.json"); }
const cmodel = decodeProfile({ ...disk, calibration: CAL });
const params = { mu: MU, T, m: chosen.m, tau: chosen.tau, bonus: BONUS };

// ── TEST phase ──
say("\n=== TEST phase ===");
const R = out.phases.test = {};
const testWins = Object.fromEntries(Ns.map((N) => [N, canonWindows("test", N, PER, "w")]));
say("B1-a held-out top-3 / top-1 accuracy (macro over thinkers, ungated); chance top-3 ~ " + f2(3 / model.T));
R.a = {}; const bars = { 3: 0.25, 6: null, 12: 0.60, 40: 0.85 };
for (const N of Ns) { const mm = measure(prep(testWins[N], MU), T); const sp = measure(prep(testWins[N], MU), T, null, { speakingOnly: true }); R.a[N] = { top3: mm.top3, top1: mm.top1, n: mm.n, speakingTop3: sp.top3, speakingTop1: sp.top1 }; say(`  (speaking thinkers only: top-3 ${f2(sp.top3)} top-1 ${f2(sp.top1)})`); say(`  N=${String(N).padStart(2)}  top-3 ${f2(mm.top3)}  top-1 ${f2(mm.top1)}   (n=${mm.n})${bars[N] != null ? "  bar >= " + bars[N] + (mm.top3 >= bars[N] ? "  MET" : "  NOT MET") : ""}`); }
// gate through classify()
const viaClassify = (wins, prior = null) => wins.map((w) => ({ w, r: classify(w.stems, { model: cmodel, prior }) }));
say("B1-c gate precision on TEST canon windows (the module's own classify(); chosen m=" + chosen.m + " tau=" + chosen.tau + ")");
R.c = {}; let pa = 0, pn = 0, pt = 0;
for (const N of Ns) {
  const resAll = viaClassify(testWins[N]); const tech = resAll.filter((x) => !SP[x.w.t]); const res = resAll.filter((x) => SP[x.w.t]); const acc = res.filter((x) => !x.r.undetermined); const hit = acc.filter((x) => x.r.ranked.some((e) => e.handle === model.handles[x.w.t]));
  R.c[N] = { coverage: acc.length / res.length, precision: acc.length ? hit.length / acc.length : null, n: res.length, techCanonOffered: tech.filter((x) => !x.r.undetermined).length / tech.length };
  say(`  N=${String(N).padStart(2)}  coverage ${pct(acc.length / res.length)}  precision ${acc.length ? pct(hit.length / acc.length) : "  -- "}   | technical-canon windows (NEG-T) offered ${pct(R.c[N].techCanonOffered)}`);
  if (POOL.includes(N)) { pa += hit.length; pn += acc.length; pt += res.length; }
}
R.c.pooled = { precision: pn ? pa / pn : null, coverage: pt ? pn / pt : null }; say(`  pooled N in {6,12,40}: precision ${pct(R.c.pooled.precision)} (bar >= 90%: ${R.c.pooled.precision >= 0.9 ? "MET" : "NOT MET"}), coverage ${pct(R.c.pooled.coverage)} (no bar)`);
// per-thinker macro precision spread
{ const per = new Map(); for (const N of POOL) for (const x of viaClassify(testWins[N])) { if (x.r.undetermined || !SP[x.w.t]) continue; const e = per.get(x.w.t) || { n: 0, k: 0 }; e.n++; if (x.r.ranked.some((q) => q.handle === model.handles[x.w.t])) e.k++; per.set(x.w.t, e); }
  const lows = [...per].map(([t, e]) => [model.handles[t], e.k / e.n, e.n]).filter((x) => x[1] < 0.8).sort((a, b) => a[1] - b[1]); R.c.lowPrecisionThinkers = lows; say("  thinkers with accepted-precision < 0.8: " + (lows.map((x) => `${x[0]} ${x[1].toFixed(2)} (n=${x[2]})`).join(", ") || "none")); }
// candidate recall (not a registered claim): is the true SPEAKING thinker among the top-5 SPEAKING candidates (what a pointing call could try to tie to a sentence)?
R.cand = {}; for (const N of Ns) { const pw = prep(testWins[N], MU).filter((w) => SP[w.t] && w.kn); const k5 = pw.filter((w) => spOrder(posteriorOf(w.s, T)).slice(0, 5).includes(w.t)).length / pw.length; R.cand[N] = k5; } say("  candidate recall (truth among top-5 speaking candidates, known>0): " + Ns.map((N) => `N=${N} ${f2(R.cand[N])}`).join("  "));
// B1-d calibration
{ const pool = POOL.flatMap((N) => prep(testWins[N], MU)); const mm = measure(pool, T); R.d = { ece: mm.ece, eceUncalibratedT1: measure(pool, 1).ece }; say(`B1-d ECE of top-1 posterior (pooled N in {6,12,40}): ${f2(mm.ece)} at T=${T} (bar <= 0.05: ${mm.ece <= 0.05 ? "MET" : "NOT MET"}); at T=1 ${f2(R.d.eceUncalibratedT1)}`); }
// B1-b negatives
say("B1-b negatives (false offer = the module returned a thinker list)");
const negx = negxWindows("test").map((w) => ({ ...w, stems: w.stems })); const nx = negx.map((w) => ({ w, r: classify(w.stems, { model: cmodel }) }));
R.b = { negxTest: { n: nx.length, falseOffer: nx.filter((x) => !x.r.undetermined).length / nx.length } };
const fams = [...new Set(negx.map((w) => w.fam))]; R.b.negxTest.byFamily = Object.fromEntries(fams.map((f) => { const xs = nx.filter((x) => x.w.fam === f); return [f, { n: xs.length, falseOffer: xs.filter((x) => !x.r.undetermined).length / xs.length }]; }));
say(`  NEG-X TEST (n=${nx.length}) false-offer ${pct(R.b.negxTest.falseOffer)}  (bar <= 10%: ${R.b.negxTest.falseOffer <= 0.1 ? "MET" : "NOT MET"})   by family: ` + fams.map((f) => `${f} ${pct(R.b.negxTest.byFamily[f].falseOffer)}`).join(", "));
// NEG-A
const threads = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/voice/threads.json"), "utf8")).threads;
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/pivot/data/pages.json"), "utf8"));
const negA = [];
for (const k of ["L1", "L2", "L3"]) for (const t of threads[k].turns) { negA.push({ kind: "lookup-ask", text: t.ask }); negA.push({ kind: "lookup-spoken", text: t.spoken }); }
for (const [title, p] of Object.entries(pages)) {
  const st = contentStems(p.text); for (let i = 0; i + 12 <= st.length; i += 12) negA.push({ kind: "page-window12", text: st.slice(i, i + 12), label: title });
  for (const s of sentencesWithOffsets(p.text)) if (contentStems(s.text).length >= 3) negA.push({ kind: "page-sentence", text: s.text, label: title });
}
const na = negA.map((x) => ({ ...x, r: classify(x.text, { model: cmodel }) }));
R.b.negA = { n: na.length, falseOffer: na.filter((x) => !x.r.undetermined).length / na.length, byKind: {} };
for (const kind of [...new Set(na.map((x) => x.kind))]) { const xs = na.filter((x) => x.kind === kind); R.b.negA.byKind[kind] = { n: xs.length, offers: xs.filter((x) => !x.r.undetermined).length }; }
say(`  NEG-A (n=${na.length}) false-offer ${pct(R.b.negA.falseOffer)}  (bar <= 10%: ${R.b.negA.falseOffer <= 0.1 ? "MET" : "NOT MET"})   ` + Object.entries(R.b.negA.byKind).map(([k, v]) => `${k} ${v.offers}/${v.n}`).join(", "));
const offers = na.filter((x) => !x.r.undetermined); R.b.negA.offers = offers.map((x) => ({ kind: x.kind, label: x.label, text: Array.isArray(x.text) ? x.text.join(" ") : x.text.slice(0, 120), ranked: x.r.ranked.map((e) => e.handle + ":" + e.confidence) }));
for (const o of R.b.negA.offers) say("    OFFER on non-canon:", o.kind, o.label || "", "|", o.text.slice(0, 80), "->", o.ranked.join(" "));
{ const kn = na.map((x) => x.r.known); say(`  NEG-A known-stem counts: mean ${mean(kn).toFixed(1)}, zero-known ${kn.filter((k) => k === 0).length}/${kn.length}`); }
// B1-e sessions
say("B1-e session prior (turn 2 = N=4; bonus " + BONUS + " nats)");
const tp = sessionPairs("test", "sess"), tb0 = sessionEval(tp, 0, T, MU, "none"), tc = sessionEval(tp, BONUS, T, MU, "correct"), tw = sessionEval(tp, BONUS, T, MU, "wrong");
R.e = { none: tb0, correct: tc, wrong: tw, lift: tc - tb0, cost: tb0 - tw };
say(`  turn-2 top-3: no prior ${f2(tb0)}   correct prior ${f2(tc)} (lift ${f2(tc - tb0)}, bar >= +0.10: ${tc - tb0 >= 0.1 ? "MET" : "NOT MET"})   wrong prior ${f2(tw)} (cost ${f2(tb0 - tw)}, bar <= 0.15: ${tb0 - tw <= 0.15 ? "MET" : "NOT MET"})`);
// natural chain through classify(): turn 1 accepted -> its thinkers are the prior
{ let k = 0, a2 = 0, a2np = 0, c2 = 0, c2np = 0, accN = 0; for (const p of tp) { const r1 = classify(p.t1, { model: cmodel }); if (r1.undetermined) continue; accN++; const pr = { handles: r1.ranked.map((e) => e.handle) }; const r2 = classify(p.t2, { model: cmodel, prior: pr }), r2n = classify(p.t2, { model: cmodel });
    if (r1.ranked.some((e) => e.handle === model.handles[p.t])) k++; const hit = (r) => !r.undetermined && r.ranked.some((e) => e.handle === model.handles[p.t]); if (!r2.undetermined) a2++; if (!r2n.undetermined) a2np++; if (hit(r2)) c2++; if (hit(r2n)) c2np++; }
  R.e.natural = { turn1Accepted: accN, turn1Correct: k, turn2AcceptedWithPrior: a2, turn2AcceptedNoPrior: a2np, turn2CorrectWithPrior: c2, turn2CorrectNoPrior: c2np };
  say(`  natural chain (turn 1 accepted on ${accN} of ${tp.length}; its offer held the truth ${pct(k / accN)}): turn-2 offers with prior ${a2} (correct ${c2}) vs without ${a2np} (correct ${c2np})`); }
// zero-evidence turns with a prior
{ const zero = ["and what about that?", "tell me more", "why though?", "ok and then?", "what do you think", "xyzzy plugh", "hmm", "yes please", "how so", "can you say more about it", "go on", "really?", "what does that mean", "and him?", "why not"];
  const pri = { handles: ["laozi", "mozi", "xunzi"], bonus: 4 }; const rr = zero.map((t) => classify(t, { model: cmodel, prior: pri })); R.e.zeroEvidenceUndetermined = rr.filter((x) => x.undetermined).length + "/" + rr.length; say(`  zero-evidence follow-ups with a prior (bonus 4): undetermined ${R.e.zeroEvidenceUndetermined} (bar 100%)`); }
{ const r = rngFor("negx-wrong-prior"); const fa = negx.filter(() => true).map((w) => { const pr = { handles: [0, 1, 2].map(() => model.handles[pick(r, model.T)]) }; return !classify(w.stems, { model: cmodel, prior: pr }).undetermined; }).filter(Boolean).length / negx.length; R.e.negxWrongPriorFalseOffer = fa; say(`  NEG-X TEST false-offer with a random 3-thinker prior: ${pct(fa)} (bar <= 10%: ${fa <= 0.1 ? "MET" : "NOT MET"})`); }
// B1-f leakage control
{ const r = rngFor("leak"); const all = canon.thinkers.flatMap((t) => t.units.filter((u) => u.split === "train").map(() => t.handle)); for (let i = all.length - 1; i > 0; i--) { const j = pick(r, i + 1); [all[i], all[j]] = [all[j], all[i]]; }
  let k = 0; const shuffled = { gaps: [], thinkers: canon.thinkers.map((t) => ({ ...t, units: t.units.map((u) => ({ ...u })) })) };
  // permute the thinker labels of the TRAIN units (each thinker keeps its number of train units, gets other thinkers' units)
  const pool = canon.thinkers.flatMap((t) => t.units.filter((u) => u.split === "train")); for (let i = pool.length - 1; i > 0; i--) { const j = pick(r, i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let c = 0; for (const t of shuffled.thinkers) { const nTrain = t.units.filter((u) => u.split === "train").length; const mine = pool.slice(c, c + nTrain); c += nTrain; let q = 0; t.units = t.units.map((u) => (u.split === "train" ? { ...mine[q++], split: "train" } : u)); }
  const sm = decodeProfile(buildProfile(shuffled)); const w = prep(testWins[12], MU); const sw = w.map((x) => ({ ...x, known: knownStems(sm, x.stems) })).map((x) => ({ ...x, s: scoreKnown(sm, x.known, MU), kn: x.known.length }));
  const saveModel = model; const mm = (() => { const per = new Map(); for (const x of sw) { const post = posteriorOf(x.s, T), rk = x.kn ? rankOf(post, x.t) : 99; const e = per.get(x.t) || { n: 0, k: 0 }; e.n++; if (rk < 3) e.k++; per.set(x.t, e); } return mean([...per.values()].map((e) => e.k / e.n)); })();
  R.f = { permutedTop3_N12: mm }; say(`B1-f leakage control: a profile fit on label-permuted TRAIN units scores top-3 ${f2(mm)} at N=12 (bar <= 0.15: ${mm <= 0.15 ? "MET" : "NOT MET"}); real profile ${f2(R.a[12].top3)}`); void k; void saveModel; }

// ── reading: REFLECT threads and the 12 questions ──
const unitSentences = new Map();
const sentencesOf = (th) => { if (!unitSentences.has(th.handle)) { const rows = []; for (const u of th.units) for (const s of sentencesWithOffsets(u.text)) { const len = s.end - s.start; if (len < 30 || len > 420 || !/[.!?]["')\]”’]*$/u.test(s.text)) continue; rows.push({ text: s.text, stems: new Set(contentStems(s.text)) }); } unitSentences.set(th.handle, rows); } return unitSentences.get(th.handle); };
const bestSentence = (handle, qStems) => { const th = canon.thinkers.find((t) => t.handle === handle); let b = null, bk = 0; for (const r of sentencesOf(th)) { let k = 0; for (const s of qStems) if (r.stems.has(s)) k++; if (k > bk || (k === bk && k > 0 && b && r.text.length < b.text.length)) { b = r; bk = k; } } return b ? { hits: bk, text: b.text.replace(/\s+/g, " ") } : null; };
say("\n=== the 12 contested questions (frozen in the PREREG), classify() with the DEV-chosen calibration ===");
R.questions = [];
for (const q of QUESTIONS) {
  const r = classify(q, { model: cmodel }); const qs = [...new Set(contentStems(q))]; const known = qs.filter((s) => model.index.has(s));
  say(`\nQ: ${q}   content stems [${qs.join(", ")}], known [${known.join(", ")}]`);
  say(`   ${r.undetermined ? "UNDETERMINED — " + r.why : "OFFER"}   top-3 mass ${r.mass3}   candidates: ` + (r.candidates || []).map((e) => `${e.handle} ${e.confidence} (hits ${e.hits})`).join(", "));
  const show = (r.undetermined ? r.considered : r.ranked).slice(0, 3).map((e) => { const bs = bestSentence(e.handle, new Set(known)); say(`     ${e.handle}: ` + (bs ? `[${bs.hits}/${known.length}] “${bs.text.slice(0, 260)}”` : "(no sentence shares a stem)")); return { handle: e.handle, confidence: e.confidence, sentence: bs }; });
  R.questions.push({ q, stems: qs, known, undetermined: r.undetermined, why: r.why, mass3: r.mass3, thinkers: show });
}
say("\n=== REFLECT threads (no bar): asks, session prior carried turn to turn ===");
R.reflect = {};
for (const k of ["R1", "R2", "R3", "R4", "R5"]) {
  const asks = threads[k].turns.map((t) => t.ask); let prior = null; R.reflect[k] = [];
  asks.forEach((a, i) => { const r = classify(a, { model: cmodel, prior }); const win = classify(asks.slice(0, i + 1).join(" "), { model: cmodel });
    say(`${k}.${i + 1} “${a}”  → turn ${r.undetermined ? "UNDETERMINED (" + r.why + ")" : r.ranked.map((e) => e.handle + " " + e.confidence).join(", ")}   | window of asks so far → ${win.undetermined ? "UNDETERMINED (" + win.why + ")" : win.ranked.map((e) => e.handle + " " + e.confidence).join(", ")}`);
    R.reflect[k].push({ ask: a, turn: r.undetermined ? null : r.ranked, window: win.undetermined ? null : win.ranked, whyTurn: r.why, whyWindow: win.why });
    prior = r.undetermined ? (r.carried ? { handles: r.carried } : prior) : { handles: r.ranked.map((e) => e.handle) }; });
}
fs.writeFileSync(path.join(ROOT, "eval/ants/B1-results.json"), JSON.stringify(out, null, 1));
say("\nwrote eval/ants/B1-results.json");
