// eval/backward/measure.mjs — S1..S6 of docs/BACKWARDS-GROUNDING-PREREG.md: the BACKWARD arm (fold-chat-assemble.js, model off) on the cached pages
// each recorded `default` turn read. Writes eval/backward/<out> (default assembled-run.json).
//   node eval/backward/measure.mjs [--out assembled-run1.json] [--label default]
import fs from "node:fs";
import path from "node:path";
import { here, root, evalDir, CASES, turnPages, goldPass, readJson, pageText, LATIN_LANGS, NONLATIN_LANGS } from "./lib.mjs";
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const label = arg("label", "default");
const asm = await import(path.join(root, "fold-chat-assemble.js"));
const fwd = readJson(path.join(here, "forward.json"));
const fwdBy = new Map(fwd.rows.map((r) => [r.id, r]));
const textOf = (r) => r.sentences.map((s) => s.text).join("\n");
const pagesOf = (tp) => tp.pages.map((p) => ({ url: p.url, text: p.text }));
const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
const p90 = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)]; };

const rows = [], violations = [];
const lat = [];
for (const c of CASES.filter((x) => ["a_single", "b_numeric", "c_multihop", "e_multilingual"].includes(x.stratum))) {
  const f = fwdBy.get(c.id);
  const tp = turnPages(label, c.id, 0);
  const lang = c.lang || "en";
  const pages = tp ? pagesOf(tp) : [];
  const res = asm.assemble({ question: c.turns[0], pages });
  const chk = asm.verifyAssembly(res, pages);
  if (!chk.ok) violations.push({ id: c.id, v: chk.violations });
  if (pages.length) lat.push(res.ms);
  rows.push({ id: c.id, stratum: c.stratum, lang, set: c.stratum === "e_multilingual" ? (LATIN_LANGS.has(lang) ? "S2" : "S3") : "S1", hasPages: pages.length > 0,
    question: c.turns[0], gold: c.gold.answer,
    ceiling: f?.ceiling ?? null, forwardGroundedRecall: f?.forwardGroundedRecall ?? null,
    answered: res.sentences.length > 0, recall: pages.length ? goldPass(c, 0, textOf(res)) : null,
    gaps: res.gaps, sentences: res.sentences.map((s) => ({ text: s.text, address: s.address, how: s.how, ...(s.derivation ? { derivation: s.derivation } : {}) })), ms: res.ms, verified: chk.ok });
}
// S4 falsifiers
const f4 = [];
for (const c of CASES.filter((x) => x.stratum === "f_gap")) {
  const tp = turnPages(label, c.id, 0);
  const pages = tp ? pagesOf(tp) : [];
  const res = asm.assemble({ question: c.turns[0], pages });
  const chk = asm.verifyAssembly(res, pages); if (!chk.ok) violations.push({ id: c.id, v: chk.violations });
  const body = textOf(res);
  const fab = (c.fabrication || []).find((s) => new RegExp(s, "iu").test(body)) || null;
  f4.push({ id: c.id, question: c.turns[0], pages: pages.length, sentences: res.sentences.length, gap: res.gaps[0]?.kind || null, fabrication: fab, text: res.sentences.map((s) => s.text) });
}
// S5 answer-absent single pages
const s5 = [];
for (const c of CASES.filter((x) => ["a_single", "b_numeric", "c_multihop"].includes(x.stratum))) {
  const tp = turnPages(label, c.id, 0); if (!tp) continue;
  for (const p of tp.pages) {
    if (goldPass(c, 0, p.text) !== false) continue;           // only pages that alone do NOT state the gold
    const res = asm.assemble({ question: c.turns[0], pages: [{ url: p.url, text: p.text }] });
    const chk = asm.verifyAssembly(res, [{ url: p.url, text: p.text }]); if (!chk.ok) violations.push({ id: c.id + "@" + p.url, v: chk.violations });
    s5.push({ id: c.id, url: p.url, sentences: res.sentences.length, gap: res.gaps[0]?.kind || null, text: res.sentences.map((s) => s.text.slice(0, 160)) });
  }
}
// S6 supported-claim address recall
const s6 = [];
{
  const labels = readJson(path.join(evalDir, "labels.json")).sentences;
  const base = readJson(path.join(evalDir, "rescore-baseline.json")).rows;
  const live = readJson(path.join(evalDir, "rescore-live.json")).rows;
  const seen = new Set();
  const cand = [];
  const lab = new Map(labels.map((l) => [`${l.key}#${l.idx}`, l]));
  for (const r of base) { const l = lab.get(`${r.key}#${r.idx}`); if (l?.quoteSupports === true && r.gate && r.span && r.source) cand.push({ key: r.key, idx: r.idx, source: r.source, span: r.span, from: "v1-baseline" }); }
  for (const r of live) if (r.gate && r.quoteSupports === true && r.span && r.source) cand.push({ key: r.key, idx: r.idx, source: r.source, span: r.span, from: "live/" + r.labelledBy });
  const turnCache = new Map();
  for (const x of cand) {
    const id = `${x.key}#${x.idx}#${x.source}#${x.span.start}-${x.span.end}`; if (seen.has(id)) continue; seen.add(id);
    const [lab_, cid, , t] = x.key.split("/");
    const tk = `${lab_}/${cid}/${t}`;
    if (!turnCache.has(tk)) {
      const c = CASES.find((k) => k.id === cid); const ti = Number(t.slice(1));
      const tpp = turnPages(lab_, cid, ti);
      turnCache.set(tk, tpp && c ? { c, ti, pages: pagesOf(tpp), q: c.turns[ti], res: null } : null);
      if (turnCache.get(tk)) { const e = turnCache.get(tk); e.res = asm.assemble({ question: e.q, pages: e.pages }); }
    }
    const e = turnCache.get(tk); if (!e) { s6.push({ ...x, covered: null, why: "no-pages" }); continue; }
    const pi = e.pages.findIndex((p) => p.url === x.source);
    const refName = pi >= 0 ? decodeURIComponent(e.pages[pi].url.split("/").pop() || e.pages[pi].url) : null;
    const len = x.span.end - x.span.start;
    let cov = 0;
    for (const s of e.res.sentences) for (const a of s.address || []) {
      const m = a.match(/^(.*)#(\d+)-(\d+)$/); if (!m || m[1] !== refName) continue;
      cov = Math.max(cov, Math.max(0, Math.min(x.span.end, +m[3]) - Math.max(x.span.start, +m[2])) / Math.max(1, len));
    }
    s6.push({ ...x, covered: cov >= 0.5, overlap: Number(cov.toFixed(2)), answered: e.res.sentences.length > 0, gap: e.res.gaps[0]?.kind || null });
  }
}
const sum = (xs, f) => xs.reduce((a, x) => a + (f(x) ? 1 : 0), 0);
const grp = (name, xs) => ({ name, n: xs.length, withPages: sum(xs, (r) => r.hasPages), recall: sum(xs, (r) => r.recall === true), answered: sum(xs, (r) => r.answered), ceiling: sum(xs, (r) => r.ceiling === true), forwardGroundedRecall: sum(xs, (r) => r.forwardGroundedRecall === true), aboveCeiling: sum(xs, (r) => r.recall === true && r.ceiling === false), sentences: xs.reduce((a, r) => a + r.sentences.length, 0), derived: xs.reduce((a, r) => a + r.sentences.filter((s) => s.how === "derived").length, 0) });
const wp = rows.filter((r) => r.hasPages);
const S1 = wp.filter((r) => r.set === "S1"), S2 = wp.filter((r) => r.set === "S2"), S3 = wp.filter((r) => r.set === "S3");
const S3x = rows.filter((r) => !r.hasPages);
const summary = {
  at: new Date().toISOString(), label,
  groups: [grp("S1 a+b+c", S1), grp("a_single", S1.filter((r) => r.stratum === "a_single")), grp("b_numeric", S1.filter((r) => r.stratum === "b_numeric")), grp("c_multihop", S1.filter((r) => r.stratum === "c_multihop")), grp("S2 e Latin", S2), grp("S3 e non-Latin", S3)],
  S1_unansweredAllTyped: S1.filter((r) => !r.answered).every((r) => r.gaps.length > 0),
  S3x: { n: S3x.length, typedNoSource: sum(S3x, (r) => r.gaps[0]?.kind === "no-source"), ids: S3x.map((r) => r.id) },
  S4: { n: f4.length, gap: sum(f4, (r) => r.sentences === 0), fabrications: sum(f4, (r) => r.fabrication), rows: f4 },
  S5: { n: s5.length, gap: sum(s5, (r) => r.sentences === 0), rate: s5.length ? Number((sum(s5, (r) => r.sentences === 0) / s5.length).toFixed(3)) : null },
  S6: { n: s6.length, covered: sum(s6, (r) => r.covered === true), notCovered: sum(s6, (r) => r.covered === false), noPages: sum(s6, (r) => r.covered === null) },
  B2_violations: violations.length, violations,
  latencyMs: { n: lat.length, median: med(lat), p90: p90(lat), max: lat.length ? Math.max(...lat) : null },
};
fs.writeFileSync(path.join(here, arg("out", "assembled-run.json")), JSON.stringify({ summary, rows, S4: f4, S5: s5, S6: s6 }, null, 1));
console.log(JSON.stringify(summary, (k, v) => (k === "rows" || k === "violations" && v.length === 0 ? undefined : v), 1));
for (const r of rows) console.log(r.id.padEnd(26), r.set, r.hasPages ? `rec=${r.recall} ans=${r.answered} ceil=${r.ceiling} fwd=${r.forwardGroundedRecall} n=${r.sentences.length} ${r.gaps[0] ? "gap=" + r.gaps[0].kind : ""}` : "no-pages " + (r.gaps[0]?.kind || ""));
