// arm C — A + a mechanical fold/narrow pass (no model): rank the SENTENCES of the passages by question-stem coverage (idf-weighted), keep whole sentences, verbatim; rewrite a leading
// pronoun to the page's entity name when the page is one entity's page (a mechanical rewrite, flagged). Gap when the best sentence covers < tau_c of the question's content stems.
// Summary rung: 'fold' = the sentences carrying the most central referents (the door's referents, ranked by how often the page mentions them), shown with lead3 and salience3 as baselines.
import { passageSet, gradeSnippets, gradeSummary, store, timed, selected, norm } from "../lib.mjs";
import { stems, sentencesOfText } from "../ctx.mjs";
import { pagesFor } from "../mech.mjs";
import { door } from "./e.mjs";
import { salientSentences } from "../../../../fold-chat-present.js";
export const TAU_C = 0.5;                        // declared in P1-PREREG.md section 1
const WH = new Set("who whom what which when where why how".split(" "));
const qStems = (q) => [...new Set(stems(q).filter((w) => !WH.has(w)))];
const PRON = /^(He|She|It|They)\b/;
const junk = (s) => /^==|^\s*=+/.test(s) || s.length < 25 || s.length > 600;
export function rank(question, passages) {
  const qs = qStems(question);
  const pool = passages.flatMap((p) => sentencesOfText(p.text).filter((s) => !junk(s)).map((s, i) => ({ s, i, title: p.ref.replace(/^.*— /, ""), p })));
  const df = new Map(); for (const x of pool) for (const w of new Set(stems(x.s))) df.set(w, (df.get(w) || 0) + 1);
  const N = pool.length || 1;
  const idf = (w) => Math.log(1 + N / (1 + (df.get(w) || 0)));
  const wsum = qs.reduce((a, w) => a + idf(w), 0) || 1;
  return pool.map((x) => { const have = new Set(stems(x.s)); const hit = qs.filter((w) => have.has(w)); const cov = hit.length / (qs.length || 1); const sc = hit.reduce((a, w) => a + idf(w), 0) / wsum + (/\d/.test(x.s) ? 0.03 : 0) - x.i * 0.0005; return { ...x, sc, cov, hit }; }).sort((a, b) => b.sc - a.sc);
}
const rewritePronoun = (x) => { const m = PRON.exec(x.s); if (!m) return { text: x.s, rewrite: false }; const name = x.title.replace(/\s*\(.*\)$/, ""); return { text: name + x.s.slice(m[1].length), rewrite: true }; };
export async function runC(q, passages = passageSet(q)) {
  if (q.rung === 12) return runC12(q, passages);
  const ranked = rank(q.q, passages);
  if (!ranked.length) return { gap: true, why: "no-sentences", snips: [] };
  let picks;
  const named = pagesFor(q.q, passages);
  if (q.rung === 13 || (named.length >= 2 && [6, 7, 8, 9].includes(q.rung))) {
    // one best sentence per named page (a comparison / two-hop / agreement needs a fact from each)
    const pages = q.rung === 13 ? passages : named.map((n) => n.p);
    picks = []; for (const p of pages) { const best = ranked.find((x) => x.p === p); if (best) picks.push(best); }
    if (q.rung === 7) { const extra = ranked.filter((x) => !picks.includes(x)).slice(0, 1); picks = picks.concat(extra); }
  } else picks = ranked.slice(0, 2);
  const best = ranked[0];
  if (best.cov < TAU_C) return { gap: true, why: `best sentence covers ${best.cov.toFixed(2)} < ${TAU_C}`, snips: [], best: best.s.slice(0, 160) };
  const snips = picks.map((x) => { const r = rewritePronoun(x); return { text: r.text, rewrite: r.rewrite, from: x.s, title: x.title, sc: +x.sc.toFixed(3), cov: +x.cov.toFixed(2) }; });
  return { gap: false, snips, best: { cov: best.cov, sc: best.sc } };
}
// ── summaries ──
const lead3 = (p) => sentencesOfText(p.text).filter((s) => !junk(s)).slice(0, 3).join(" ");
export async function foldSummary(p, n = 3) {
  const sents = sentencesOfText(p.text).filter((s) => !junk(s)).slice(0, 260);
  // ONE door read of the page head: the referents it returns (surfaces that recur past its floor) are the page's addressed holons
  const head = norm(p.text).slice(0, 20000);
  const whole = await door(head);
  const names = [...new Set(whole.referents.flat().map((x) => x.toLowerCase()).filter((x) => x.length > 2))];
  const lowText = head.toLowerCase();
  const cent = new Map(names.map((nm) => [nm, lowText.split(nm).length - 1]));
  const scored = sents.map((s, i) => { const l = s.toLowerCase(); let c = 0; for (const [nm, k] of cent) if (k >= 2 && l.includes(nm)) c += Math.log(1 + k); return { s, i, sc: c / Math.sqrt(s.split(/\s+/).length) - i * 0.02 }; }).sort((a, b) => b.sc - a.sc).slice(0, n).sort((a, b) => a.i - b.i);
  return scored.map((x) => x.s).join(" ");
}
async function runC12(q, passages) {
  const p = passages[0];
  const fold = await foldSummary(p), l3 = lead3(p), sal = salientSentences(p.text, p.ref.replace(/^.*— /, ""), 3).join(" ");
  return { gap: false, summaries: { fold, lead3: l3, salience3: sal }, snips: [{ text: fold }] };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const st = store("C");
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const { out, err, ms } = await timed(() => runC(q));
    const o = out || { gap: true, why: "error", snips: [] };
    const g = gradeSnippets(q, o.snips, { gap: o.gap });
    const extra = {};
    if (o.summaries) for (const [k, v] of Object.entries(o.summaries)) extra["sum_" + k] = { text: v, grade: gradeSummary(q, v) };
    st.put({ id: q.id, rung: q.rung, ms, err, gap: o.gap, why: o.why || null, text: (o.snips || []).map((s) => s.text).join("\n"), rewrites: (o.snips || []).filter((s) => s.rewrite).length, best: o.best || null, grade: g, ...extra });
    console.log(q.id, g.ok ? "OK " : "-- ", o.gap ? "gap:" + (o.why || "").slice(0, 40) : "", g.why, g.chars, ms + "ms");
  }
}
